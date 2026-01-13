package api

import "time"

// Project represents a TickTick project
type Project struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Color      string    `json:"color,omitempty"`
	ViewMode   string    `json:"viewMode,omitempty"`
	SortOrder  int       `json:"sortOrder"`
	Closed     bool      `json:"closed"`
	ModifiedAt time.Time `json:"modifiedTime"`
}

// Task represents a TickTick task
type Task struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"projectId"`
	Title       string    `json:"title"`
	Content     string    `json:"content,omitempty"`
	Priority    int       `json:"priority"`
	Status      int       `json:"status"`
	IsAllDay    bool      `json:"isAllDay"`
	StartDate   string    `json:"startDate,omitempty"`
	DueDate     string    `json:"dueDate,omitempty"`
	CompletedAt time.Time `json:"completedTime,omitempty"`
	CreatedAt   time.Time `json:"createdTime"`
	ModifiedAt  time.Time `json:"modifiedTime"`
	Tags        []string  `json:"tags,omitempty"`
}

// CreateProjectRequest represents a request to create a project
type CreateProjectRequest struct {
	Name     string `json:"name"`
	Color    string `json:"color,omitempty"`
	ViewMode string `json:"viewMode,omitempty"`
}

// CreateTaskRequest represents a request to create a task
type CreateTaskRequest struct {
	Title     string   `json:"title"`
	ProjectID string   `json:"projectId"`
	Content   string   `json:"content,omitempty"`
	DueDate   string   `json:"dueDate,omitempty"`
	Priority  int      `json:"priority,omitempty"`
	Tags      []string `json:"tags,omitempty"`
}

// UpdateTaskRequest represents a request to update a task
type UpdateTaskRequest struct {
	Title    string   `json:"title,omitempty"`
	Content  string   `json:"content,omitempty"`
	DueDate  string   `json:"dueDate,omitempty"`
	Priority int      `json:"priority,omitempty"`
	Tags     []string `json:"tags,omitempty"`
}

// ErrorResponse represents an API error response
type ErrorResponse struct {
	ErrorCode int    `json:"errorCode"`
	ErrorMsg  string `json:"errorMsg"`
}
