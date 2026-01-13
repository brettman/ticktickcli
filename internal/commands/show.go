package commands

import (
	"context"
	"fmt"
	"strings"

	"github.com/brettman/ticktickcli/internal/api"
	"github.com/brettman/ticktickcli/internal/config"
	"github.com/brettman/ticktickcli/internal/project"
	"github.com/fatih/color"
	"github.com/spf13/cobra"
)

// NewShowCmd creates the show command
func NewShowCmd() *cobra.Command {
	var projectID string

	cmd := &cobra.Command{
		Use:   "show <task-id>",
		Short: "Show task details",
		Long: `Show detailed information about a task.

The task ID can be the full ID or a short ID (first 8 characters).

Examples:
  ticktick show abc12345
  ticktick show abc12345 --project xyz789`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			taskID := args[0]
			return runShow(taskID, projectID)
		},
	}

	cmd.Flags().StringVar(&projectID, "project", "", "Project ID (overrides .ticktick file)")

	return cmd
}

// runShow handles showing task details
func runShow(taskID, projectID string) error {
	// Load config and check authentication
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	if !cfg.IsAuthenticated() {
		return fmt.Errorf("not authenticated. Run 'ticktick auth login' first")
	}

	// Determine which project to use
	if projectID == "" {
		// Try to find .ticktick file
		ctx, err := project.GetCurrentProjectContext()
		if err == nil {
			projectID = ctx.File.ProjectID
		} else if err == project.ErrNoTickTickFile {
			// Use default project from config
			if cfg.Preferences.DefaultProject != "" {
				projectID = cfg.Preferences.DefaultProject
			} else {
				return fmt.Errorf("no project specified. Run 'ticktick init' or use --project flag")
			}
		} else {
			return fmt.Errorf("failed to load project context: %w", err)
		}
	}

	// Create API client
	client := api.NewClientFromConfig(
		cfg.Auth.ClientID,
		cfg.Auth.ClientSecret,
		cfg.Auth.AccessToken,
		cfg.Auth.RefreshToken,
		cfg.Auth.Expiry,
	)

	ctx := context.Background()

	// Find the task by ID (handle short IDs)
	fullTaskID, _, err := findTaskByID(ctx, client, projectID, taskID)
	if err != nil {
		return err
	}

	// Get full task details
	task, err := client.GetTask(ctx, projectID, fullTaskID)
	if err != nil {
		return fmt.Errorf("failed to fetch task: %w", err)
	}

	// Display task details
	cyan := color.New(color.FgCyan, color.Bold)
	cyan.Println("\n=== Task Details ===\n")

	fmt.Printf("Title:      %s\n", task.Title)
	fmt.Printf("ID:         %s\n", task.ID)
	fmt.Printf("Project ID: %s\n", task.ProjectID)

	if task.Content != "" {
		fmt.Printf("\nContent:\n%s\n", task.Content)
	}

	if task.Priority > 0 {
		fmt.Printf("\nPriority:   %s\n", formatPriority(task.Priority))
	}

	if task.DueDate != "" {
		fmt.Printf("Due Date:   %s\n", task.DueDate)
	}

	if task.StartDate != "" {
		fmt.Printf("Start Date: %s\n", task.StartDate)
	}

	if len(task.Tags) > 0 {
		fmt.Printf("\nTags:       %s\n", strings.Join(task.Tags, ", "))
	}

	// Status
	statusStr := "Open"
	statusColor := color.New(color.FgGreen)
	switch task.Status {
	case 2:
		statusStr = "Completed"
		statusColor = color.New(color.FgBlue)
	case 1:
		statusStr = "In Progress"
		statusColor = color.New(color.FgYellow)
	}
	fmt.Printf("\nStatus:     ")
	statusColor.Println(statusStr)

	// Timestamps
	fmt.Printf("\nCreated:    %s\n", task.CreatedAt.Format("2006-01-02 15:04:05"))
	fmt.Printf("Modified:   %s\n", task.ModifiedAt.Format("2006-01-02 15:04:05"))

	if !task.CompletedAt.IsZero() {
		fmt.Printf("Completed:  %s\n", task.CompletedAt.Format("2006-01-02 15:04:05"))
	}

	fmt.Println()

	return nil
}
