package commands

import (
	"fmt"
	"os"
	"time"

	"github.com/brettman/ticktickcli/internal/api"
	"github.com/brettman/ticktickcli/internal/config"
	"github.com/fatih/color"
	"github.com/joho/godotenv"
	"github.com/spf13/cobra"
)

// NewAuthCmd creates the auth command
func NewAuthCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Manage authentication",
		Long:  "Manage authentication with TickTick API",
	}

	cmd.AddCommand(newAuthLoginCmd())
	cmd.AddCommand(newAuthStatusCmd())
	cmd.AddCommand(newAuthLogoutCmd())

	return cmd
}

// newAuthLoginCmd creates the auth login command
func newAuthLoginCmd() *cobra.Command {
	var clientID, clientSecret string

	cmd := &cobra.Command{
		Use:   "login",
		Short: "Authenticate with TickTick",
		Long: `Authenticate with TickTick using OAuth 2.0.

You will need your Client ID and Client Secret from the TickTick Developer Portal.
If not provided as flags, you will be prompted to enter them.

The authentication process will:
1. Open your browser for authorization
2. Start a local server to receive the callback
3. Store your credentials securely in ~/.ticktick/config`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runAuthLogin(clientID, clientSecret)
		},
	}

	cmd.Flags().StringVar(&clientID, "client-id", "", "OAuth Client ID")
	cmd.Flags().StringVar(&clientSecret, "client-secret", "", "OAuth Client Secret")

	return cmd
}

// newAuthStatusCmd creates the auth status command
func newAuthStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Check authentication status",
		Long:  "Check if you are currently authenticated with TickTick",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runAuthStatus()
		},
	}
}

// newAuthLogoutCmd creates the auth logout command
func newAuthLogoutCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Short: "Remove authentication credentials",
		Long:  "Remove stored authentication credentials from ~/.ticktick/config",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runAuthLogout()
		},
	}
}

// runAuthLogin handles the login flow
func runAuthLogin(clientID, clientSecret string) error {
	// Try to load .env file (silently ignore if it doesn't exist)
	_ = godotenv.Load()

	// Priority order: flags > environment variables > prompts
	if clientID == "" {
		clientID = os.Getenv("TICKTICK_CLIENT_ID")
	}
	if clientSecret == "" {
		clientSecret = os.Getenv("TICKTICK_CLIENT_SECRET")
	}

	// Prompt for credentials if still not provided
	if clientID == "" {
		cyan := color.New(color.FgCyan)
		cyan.Println("\nTip: You can create a .env file with TICKTICK_CLIENT_ID and TICKTICK_CLIENT_SECRET to avoid entering these each time.")
		fmt.Print("\nEnter Client ID: ")
		fmt.Scanln(&clientID)
	}
	if clientSecret == "" {
		fmt.Print("Enter Client Secret: ")
		fmt.Scanln(&clientSecret)
	}

	if clientID == "" || clientSecret == "" {
		return fmt.Errorf("both Client ID and Client Secret are required")
	}

	fmt.Println("\nStarting OAuth 2.0 authentication flow...")

	// Start OAuth flow
	result, err := api.StartOAuthFlow(clientID, clientSecret)
	if err != nil {
		return fmt.Errorf("authentication failed: %w", err)
	}

	// Load or create config
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Update auth credentials
	if err := cfg.UpdateAuth(
		clientID,
		clientSecret,
		result.Token.AccessToken,
		result.Token.RefreshToken,
		result.Token.Expiry,
	); err != nil {
		return fmt.Errorf("failed to save credentials: %w", err)
	}

	green := color.New(color.FgGreen, color.Bold)
	green.Println("\n✓ Authentication successful!")
	fmt.Printf("Credentials saved to ~/.ticktick/config\n")
	fmt.Printf("Token expires: %s\n", result.Token.Expiry.Format(time.RFC1123))

	return nil
}

// runAuthStatus checks authentication status
func runAuthStatus() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	if !cfg.IsAuthenticated() {
		yellow := color.New(color.FgYellow)
		yellow.Println("✗ Not authenticated")
		fmt.Println("\nRun 'ticktick auth login' to authenticate.")
		return nil
	}

	green := color.New(color.FgGreen)
	green.Println("✓ Authenticated")

	fmt.Printf("\nClient ID: %s\n", cfg.Auth.ClientID)
	fmt.Printf("Token expires: %s\n", cfg.Auth.Expiry.Format(time.RFC1123))

	if cfg.IsTokenExpired() {
		yellow := color.New(color.FgYellow)
		yellow.Println("\n⚠ Warning: Token is expired")
		fmt.Println("The token will be automatically refreshed on next API call.")
	}

	return nil
}

// runAuthLogout removes authentication credentials
func runAuthLogout() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	if !cfg.IsAuthenticated() {
		fmt.Println("Already logged out (no credentials found)")
		return nil
	}

	if err := cfg.ClearAuth(); err != nil {
		return fmt.Errorf("failed to clear credentials: %w", err)
	}

	green := color.New(color.FgGreen)
	green.Println("✓ Successfully logged out")
	fmt.Println("Credentials removed from ~/.ticktick/config")

	return nil
}
