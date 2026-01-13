package commands

import (
	"context"
	"fmt"

	"github.com/brettman/ticktickcli/internal/api"
	"github.com/brettman/ticktickcli/internal/config"
	"github.com/brettman/ticktickcli/internal/project"
	"github.com/fatih/color"
	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

// NewDeleteCmd creates the delete command
func NewDeleteCmd() *cobra.Command {
	var (
		projectID string
		force     bool
	)

	cmd := &cobra.Command{
		Use:   "delete <task-id>",
		Short: "Delete a task",
		Long: `Delete a task from TickTick.

The task ID can be the full ID or a short ID (first 8 characters).
By default, you will be prompted for confirmation unless --force is used.

Examples:
  ticktick delete abc12345
  ticktick delete abc12345 --force
  ticktick delete abc12345 --project xyz789`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			taskID := args[0]
			return runDelete(taskID, projectID, force)
		},
	}

	cmd.Flags().StringVar(&projectID, "project", "", "Project ID (overrides .ticktick file)")
	cmd.Flags().BoolVarP(&force, "force", "f", false, "Skip confirmation prompt")

	return cmd
}

// runDelete handles deleting a task
func runDelete(taskID, projectID string, force bool) error {
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

	// Confirm deletion unless --force is used
	if !force {
		prompt := promptui.Prompt{
			Label:     fmt.Sprintf("Delete task '%s'", taskTitle),
			IsConfirm: true,
		}

		result, err := prompt.Run()
		if err != nil || (result != "y" && result != "Y") {
			fmt.Println("Deletion cancelled.")
			return nil
		}
	}

	// Delete the task
	if err := client.DeleteTask(ctx, projectID, fullTaskID); err != nil {
		return fmt.Errorf("failed to delete task: %w", err)
	}

	// Display success
	green := color.New(color.FgGreen, color.Bold)
	green.Println("✓ Task deleted!")
	fmt.Printf("\nTask: %s\n", taskTitle)
	fmt.Printf("ID: %s\n", fullTaskID)

	return nil
}
