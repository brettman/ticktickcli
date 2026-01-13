package commands

import (
	"context"
	"fmt"

	"github.com/brettman/ticktickcli/internal/api"
	"github.com/brettman/ticktickcli/internal/config"
	"github.com/brettman/ticktickcli/internal/project"
	"github.com/fatih/color"
	"github.com/spf13/cobra"
)

// NewCompleteCmd creates the complete command
func NewCompleteCmd() *cobra.Command {
	var projectID string

	cmd := &cobra.Command{
		Use:   "complete <task-id>",
		Short: "Mark a task as complete",
		Long: `Mark a task as complete in TickTick.

The task ID can be the full ID or a short ID (first 8 characters).
If run in a directory with a .ticktick file, it will use that project.

Examples:
  ticktick complete abc12345
  ticktick complete abc12345 --project xyz789`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			taskID := args[0]
			return runComplete(taskID, projectID)
		},
	}

	cmd.Flags().StringVar(&projectID, "project", "", "Project ID (overrides .ticktick file)")

	return cmd
}

// runComplete handles completing a task
func runComplete(taskID, projectID string) error {
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
	fullTaskID, taskTitle, err := findTaskByID(ctx, client, projectID, taskID)
	if err != nil {
		return err
	}

	// Complete the task
	if err := client.CompleteTask(ctx, projectID, fullTaskID); err != nil {
		return fmt.Errorf("failed to complete task: %w", err)
	}

	// Display success
	green := color.New(color.FgGreen, color.Bold)
	green.Println("✓ Task completed!")
	fmt.Printf("\nTask: %s\n", taskTitle)
	fmt.Printf("ID: %s\n", fullTaskID)

	return nil
}

// findTaskByID finds a task by full or short ID
func findTaskByID(ctx context.Context, client *api.Client, projectID, taskID string) (string, string, error) {
	// First try as full ID
	task, err := client.GetTask(ctx, projectID, taskID)
	if err == nil {
		return task.ID, task.Title, nil
	}

	// If that fails and it's a short ID, search through all tasks
	if len(taskID) <= 8 {
		tasks, err := client.GetTasks(ctx, projectID)
		if err != nil {
			return "", "", fmt.Errorf("failed to fetch tasks: %w", err)
		}

		for _, t := range tasks {
			if len(t.ID) >= len(taskID) && t.ID[:len(taskID)] == taskID {
				return t.ID, t.Title, nil
			}
		}

		return "", "", fmt.Errorf("task not found with ID: %s", taskID)
	}

	return "", "", fmt.Errorf("task not found: %w", err)
}
