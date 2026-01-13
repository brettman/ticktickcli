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

// NewAddCmd creates the add command
func NewAddCmd() *cobra.Command {
	var (
		content     string
		dueDate     string
		priority    int
		tags        []string
		projectID   string
	)

	cmd := &cobra.Command{
		Use:   "add <title>",
		Short: "Add a new task",
		Long: `Add a new task to TickTick.

If run in a directory with a .ticktick file, the task will be added to that project.
Otherwise, you must specify a project with --project flag or it will use your default project.

Examples:
  ticktick add "Review pull request"
  ticktick add "Fix bug" --content "The login form is broken" --priority 3
  ticktick add "Deploy to production" --due 2026-01-15 --tags deploy,urgent
  ticktick add "Meeting notes" --project abc123`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			title := args[0]
			return runAdd(title, content, dueDate, priority, tags, projectID)
		},
	}

	cmd.Flags().StringVar(&content, "content", "", "Task description/content")
	cmd.Flags().StringVar(&dueDate, "due", "", "Due date (YYYY-MM-DD)")
	cmd.Flags().IntVar(&priority, "priority", 0, "Priority (0-5, where 5 is highest)")
	cmd.Flags().StringSliceVar(&tags, "tags", []string{}, "Task tags (comma-separated)")
	cmd.Flags().StringVar(&projectID, "project", "", "Project ID (overrides .ticktick file)")

	return cmd
}

// runAdd handles adding a new task
func runAdd(title, content, dueDate string, priority int, tags []string, projectID string) error {
	// Validate priority
	if priority < 0 || priority > 5 {
		return fmt.Errorf("priority must be between 0 and 5")
	}

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
			cyan := color.New(color.FgCyan)
			cyan.Printf("Using project from .ticktick: %s\n", ctx.File.ProjectName)
		} else if err == project.ErrNoTickTickFile {
			// Use default project from config
			if cfg.Preferences.DefaultProject != "" {
				projectID = cfg.Preferences.DefaultProject
				fmt.Printf("Using default project from config\n")
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

	// Create task request
	req := &api.CreateTaskRequest{
		Title:     title,
		ProjectID: projectID,
		Content:   content,
		DueDate:   dueDate,
		Priority:  priority,
		Tags:      tags,
	}

	// Create the task
	task, err := client.CreateTask(ctx, req)
	if err != nil {
		return fmt.Errorf("failed to create task: %w", err)
	}

	// Display success
	green := color.New(color.FgGreen, color.Bold)
	green.Println("\n✓ Task created successfully!")

	fmt.Printf("\nTitle: %s\n", task.Title)
	fmt.Printf("ID: %s\n", task.ID)
	if task.Content != "" {
		fmt.Printf("Content: %s\n", task.Content)
	}
	if task.DueDate != "" {
		fmt.Printf("Due: %s\n", task.DueDate)
	}
	if task.Priority > 0 {
		fmt.Printf("Priority: %s\n", formatPriority(task.Priority))
	}
	if len(task.Tags) > 0 {
		fmt.Printf("Tags: %s\n", strings.Join(task.Tags, ", "))
	}

	return nil
}

// formatPriority formats priority with visual indicator
func formatPriority(priority int) string {
	switch priority {
	case 5:
		return color.RedString("5 (Highest)")
	case 4:
		return color.RedString("4 (High)")
	case 3:
		return color.YellowString("3 (Medium)")
	case 2:
		return color.CyanString("2 (Low)")
	case 1:
		return color.CyanString("1 (Lowest)")
	default:
		return "0 (None)"
	}
}
