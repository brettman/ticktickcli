package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"golang.org/x/oauth2"
)

const (
	// BaseURL is the TickTick API base URL
	BaseURL = "https://api.ticktick.com/open/v1"
)

// Client is the TickTick API client
type Client struct {
	httpClient *http.Client
	baseURL    string
	oauth      *oauth2.Config
	token      *oauth2.Token
}

// NewClient creates a new API client
func NewClient(token *oauth2.Token, oauth *oauth2.Config) *Client {
	ctx := context.Background()

	return &Client{
		httpClient: oauth.Client(ctx, token),
		baseURL:    BaseURL,
		oauth:      oauth,
		token:      token,
	}
}

// NewClientFromConfig creates a client from OAuth configuration
func NewClientFromConfig(clientID, clientSecret, accessToken, refreshToken string, expiry time.Time) *Client {
	oauth := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Endpoint: oauth2.Endpoint{
			AuthURL:  AuthURL,
			TokenURL: TokenURL,
		},
		Scopes: []string{"tasks:read", "tasks:write"},
	}

	token := &oauth2.Token{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Expiry:       expiry,
	}

	return NewClient(token, oauth)
}

// GetProjects retrieves all projects
func (c *Client) GetProjects(ctx context.Context) ([]Project, error) {
	var projects []Project
	if err := c.doRequest(ctx, "GET", "/project", nil, &projects); err != nil {
		return nil, err
	}
	return projects, nil
}

// GetProject retrieves a specific project
func (c *Client) GetProject(ctx context.Context, id string) (*Project, error) {
	var project Project
	if err := c.doRequest(ctx, "GET", fmt.Sprintf("/project/%s", id), nil, &project); err != nil {
		return nil, err
	}
	return &project, nil
}

// CreateProject creates a new project
func (c *Client) CreateProject(ctx context.Context, req *CreateProjectRequest) (*Project, error) {
	var project Project
	if err := c.doRequest(ctx, "POST", "/project", req, &project); err != nil {
		return nil, err
	}
	return &project, nil
}

// DeleteProject deletes a project
func (c *Client) DeleteProject(ctx context.Context, id string) error {
	return c.doRequest(ctx, "DELETE", fmt.Sprintf("/project/%s", id), nil, nil)
}

// GetTasks retrieves all tasks in a project
func (c *Client) GetTasks(ctx context.Context, projectID string) ([]Task, error) {
	var tasks []Task
	if err := c.doRequest(ctx, "GET", fmt.Sprintf("/project/%s/task", projectID), nil, &tasks); err != nil {
		return nil, err
	}
	return tasks, nil
}

// GetTask retrieves a specific task
func (c *Client) GetTask(ctx context.Context, projectID, taskID string) (*Task, error) {
	var task Task
	if err := c.doRequest(ctx, "GET", fmt.Sprintf("/project/%s/task/%s", projectID, taskID), nil, &task); err != nil {
		return nil, err
	}
	return &task, nil
}

// CreateTask creates a new task
func (c *Client) CreateTask(ctx context.Context, req *CreateTaskRequest) (*Task, error) {
	var task Task
	if err := c.doRequest(ctx, "POST", "/task", req, &task); err != nil {
		return nil, err
	}
	return &task, nil
}

// UpdateTask updates a task
func (c *Client) UpdateTask(ctx context.Context, taskID string, req *UpdateTaskRequest) (*Task, error) {
	var task Task
	if err := c.doRequest(ctx, "POST", fmt.Sprintf("/task/%s", taskID), req, &task); err != nil {
		return nil, err
	}
	return &task, nil
}

// CompleteTask marks a task as complete
func (c *Client) CompleteTask(ctx context.Context, projectID, taskID string) error {
	return c.doRequest(ctx, "POST", fmt.Sprintf("/project/%s/task/%s/complete", projectID, taskID), nil, nil)
}

// DeleteTask deletes a task
func (c *Client) DeleteTask(ctx context.Context, projectID, taskID string) error {
	return c.doRequest(ctx, "DELETE", fmt.Sprintf("/project/%s/task/%s", projectID, taskID), nil, nil)
}

// doRequest performs an HTTP request
func (c *Client) doRequest(ctx context.Context, method, path string, body, result interface{}) error {
	url := c.baseURL + path

	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return handleErrorResponse(resp)
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("failed to decode response: %w", err)
		}
	}

	return nil
}

// handleErrorResponse handles API error responses
func handleErrorResponse(resp *http.Response) error {
	var errResp ErrorResponse
	if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
		return fmt.Errorf("API error (status %d)", resp.StatusCode)
	}

	switch resp.StatusCode {
	case 401:
		return fmt.Errorf("authentication failed: %s (run 'ticktick auth login')", errResp.ErrorMsg)
	case 403:
		return fmt.Errorf("permission denied: %s", errResp.ErrorMsg)
	case 404:
		return fmt.Errorf("resource not found: %s", errResp.ErrorMsg)
	case 429:
		return fmt.Errorf("rate limit exceeded: %s", errResp.ErrorMsg)
	case 500, 502, 503, 504:
		return fmt.Errorf("TickTick service error: %s (please try again later)", errResp.ErrorMsg)
	default:
		return fmt.Errorf("API error (status %d): %s", resp.StatusCode, errResp.ErrorMsg)
	}
}

// GetToken returns the current OAuth token
func (c *Client) GetToken() *oauth2.Token {
	return c.token
}
