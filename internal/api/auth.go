package api

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"time"

	"golang.org/x/oauth2"
)

const (
	// AuthURL is the TickTick OAuth authorization endpoint
	AuthURL = "https://ticktick.com/oauth/authorize"
	// TokenURL is the TickTick OAuth token endpoint
	TokenURL = "https://ticktick.com/oauth/token"
	// RedirectURL is the local callback URL for OAuth
	RedirectURL = "http://localhost:8080/callback"
	// OAuthTimeout is the timeout for the OAuth flow
	OAuthTimeout = 5 * time.Minute
)

// OAuthConfig holds OAuth configuration
type OAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
	Scopes       []string
}

// OAuthResult holds the result of an OAuth flow
type OAuthResult struct {
	Token        *oauth2.Token
	ClientID     string
	ClientSecret string
}

// StartOAuthFlow initiates the OAuth 2.0 authorization code flow
func StartOAuthFlow(clientID, clientSecret string) (*OAuthResult, error) {
	config := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  RedirectURL,
		Endpoint: oauth2.Endpoint{
			AuthURL:   AuthURL,
			TokenURL:  TokenURL,
			AuthStyle: oauth2.AuthStyleInParams, // TickTick requires credentials in request body
		},
		Scopes: []string{"tasks:read", "tasks:write"},
	}

	// Generate random state for CSRF protection
	state, err := generateRandomState()
	if err != nil {
		return nil, fmt.Errorf("failed to generate state: %w", err)
	}

	// Create channels for communication
	codeChan := make(chan string, 1)
	errChan := make(chan error, 1)

	// Create a new ServeMux for this OAuth flow
	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		handleCallback(w, r, state, codeChan, errChan)
	})

	// Start local HTTP server for callback
	server := &http.Server{
		Addr:    ":8080",
		Handler: mux,
	}

	// Start server in background
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errChan <- fmt.Errorf("failed to start callback server: %w", err)
		}
	}()

	// Give server time to start
	time.Sleep(100 * time.Millisecond)

	// Generate and open authorization URL
	authURL := config.AuthCodeURL(state, oauth2.AccessTypeOffline)
	fmt.Printf("Opening browser for authorization...\n")
	fmt.Printf("If the browser doesn't open, visit this URL:\n%s\n\n", authURL)

	if err := openBrowser(authURL); err != nil {
		fmt.Printf("Failed to open browser automatically: %v\n", err)
	}

	// Wait for callback with timeout
	var code string
	select {
	case code = <-codeChan:
		// Success - give browser time to receive the response page
		time.Sleep(500 * time.Millisecond)
	case err := <-errChan:
		server.Close()
		return nil, err
	case <-time.After(OAuthTimeout):
		server.Close()
		return nil, fmt.Errorf("OAuth flow timed out after %v", OAuthTimeout)
	}

	// Exchange authorization code for token manually (not using oauth2 library)
	fmt.Println("\nExchanging authorization code for access token...")
	
	token, err := exchangeCodeForToken(clientID, clientSecret, code)
	
	// Now close the server after token exchange completes
	server.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code for token: %w", err)
	}

	return &OAuthResult{
		Token:        token,
		ClientID:     clientID,
		ClientSecret: clientSecret,
	}, nil
}

// handleCallback handles the OAuth callback request
func handleCallback(w http.ResponseWriter, r *http.Request, expectedState string, codeChan chan string, errChan chan error) {
	// Check for errors
	if errMsg := r.URL.Query().Get("error"); errMsg != "" {
		errDesc := r.URL.Query().Get("error_description")
		errChan <- fmt.Errorf("OAuth error: %s - %s", errMsg, errDesc)
		http.Error(w, "Authorization failed. You can close this window.", http.StatusBadRequest)
		return
	}

	// Verify state
	state := r.URL.Query().Get("state")
	if state != expectedState {
		errChan <- fmt.Errorf("invalid state parameter (possible CSRF attack)")
		http.Error(w, "Invalid state parameter. You can close this window.", http.StatusBadRequest)
		return
	}

	// Get authorization code
	code := r.URL.Query().Get("code")
	if code == "" {
		errChan <- fmt.Errorf("no authorization code received")
		http.Error(w, "No authorization code received. You can close this window.", http.StatusBadRequest)
		return
	}

	// Send code to channel
	codeChan <- code

	// Show success page
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprintf(w, `
		<!DOCTYPE html>
		<html>
		<head>
			<title>TickTick CLI - Authorization Successful</title>
			<style>
				body {
					font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
					display: flex;
					justify-content: center;
					align-items: center;
					height: 100vh;
					margin: 0;
					background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%);
				}
				.container {
					background: white;
					padding: 3rem;
					border-radius: 10px;
					box-shadow: 0 10px 40px rgba(0,0,0,0.2);
					text-align: center;
				}
				h1 { color: #667eea; margin-bottom: 1rem; }
				p { color: #666; margin-bottom: 1.5rem; }
				.checkmark {
					width: 80px;
					height: 80px;
					border-radius: 50%%;
					display: block;
					stroke-width: 2;
					stroke: #4CAF50;
					stroke-miterlimit: 10;
					margin: 0 auto 2rem;
					box-shadow: inset 0px 0px 0px #4CAF50;
					animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both;
				}
				.checkmark__circle {
					stroke-dasharray: 166;
					stroke-dashoffset: 166;
					stroke-width: 2;
					stroke-miterlimit: 10;
					stroke: #4CAF50;
					fill: none;
					animation: stroke .6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
				}
				.checkmark__check {
					transform-origin: 50%% 50%%;
					stroke-dasharray: 48;
					stroke-dashoffset: 48;
					animation: stroke .3s cubic-bezier(0.65, 0, 0.45, 1) .8s forwards;
				}
				@keyframes stroke {
					100%% { stroke-dashoffset: 0; }
				}
				@keyframes fill {
					100%% { box-shadow: inset 0px 0px 0px 30px #4CAF50; }
				}
			</style>
		</head>
		<body>
			<div class="container">
				<svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
					<circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
					<path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
				</svg>
				<h1>Authorization Successful!</h1>
				<p>You have successfully authorized the TickTick CLI.</p>
				<p>You can now close this window and return to your terminal.</p>
			</div>
		</body>
		</html>
	`)
}

// generateRandomState generates a random state string for CSRF protection
func generateRandomState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// openBrowser opens the default browser to the given URL
func openBrowser(url string) error {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "darwin":
		cmd = "open"
		args = []string{url}
	case "linux":
		cmd = "xdg-open"
		args = []string{url}
	case "windows":
		cmd = "cmd"
		args = []string{"/c", "start", url}
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}

	return exec.Command(cmd, args...).Start()
}

// exchangeCodeForToken manually exchanges authorization code for access token
func exchangeCodeForToken(clientID, clientSecret, code string) (*oauth2.Token, error) {
	// Use curl as a workaround since Go's HTTP client is timing out
	// but curl works fine
	args := []string{
		"-s", "-S", // silent but show errors
		"-X", "POST",
		"-H", "Content-Type: application/x-www-form-urlencoded",
		"-H", "Accept: application/json",
		"-d", fmt.Sprintf("grant_type=authorization_code&code=%s&client_id=%s&client_secret=%s&redirect_uri=%s",
			url.QueryEscape(code),
			url.QueryEscape(clientID),
			url.QueryEscape(clientSecret),
			url.QueryEscape(RedirectURL)),
		"--max-time", "30",
		TokenURL,
	}

	cmd := exec.Command("curl", args...)
	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("curl failed: %s", string(exitErr.Stderr))
		}
		return nil, fmt.Errorf("curl failed: %w", err)
	}

	// Parse token response
	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		TokenType    string `json:"token_type"`
		ExpiresIn    int    `json:"expires_in"`
		RefreshToken string `json:"refresh_token"`
		Scope        string `json:"scope"`
		Error        string `json:"error"`
		ErrorDesc    string `json:"error_description"`
	}

	if err := json.Unmarshal(output, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w (body: %s)", err, string(output))
	}

	if tokenResp.Error != "" {
		return nil, fmt.Errorf("OAuth error: %s - %s", tokenResp.Error, tokenResp.ErrorDesc)
	}

	if tokenResp.AccessToken == "" {
		return nil, fmt.Errorf("no access token in response: %s", string(output))
	}

	// Create oauth2.Token
	token := &oauth2.Token{
		AccessToken:  tokenResp.AccessToken,
		TokenType:    tokenResp.TokenType,
		RefreshToken: tokenResp.RefreshToken,
	}

	if tokenResp.ExpiresIn > 0 {
		token.Expiry = time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	}

	return token, nil
}

// RefreshToken refreshes an expired OAuth token
func RefreshToken(ctx context.Context, config *oauth2.Config, token *oauth2.Token) (*oauth2.Token, error) {
	tokenSource := config.TokenSource(ctx, token)
	newToken, err := tokenSource.Token()
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}
	return newToken, nil
}
