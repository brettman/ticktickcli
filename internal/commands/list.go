package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/brettman/ticktickcli/internal/api"
	"github.com/brettman/ticktickcli/internal/config"
	"github.com/brettman/ticktickcli/internal/project"
	"github.com/fatih/color"
	"github.com/jedib0t/go-pretty/v6/table"
	"github.com/spf13/cobra"
)

// NewListCmd creates the list command
func NewListCmd() *cobra.Command {
	var (
		allProjects bool
		projectID   string
		formatType  string
		priorityFilter int
		dueFilter   string
		overdue     bool
	)

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List tasks",
		Long: `List tasks from TickTick.

By default, lists tasks from the current project (if .ticktick file exists).
Use --all to list tasks from all projects.

Output formats:
  table   - Pretty table format (default)
  json    - JSON format
  compact - Compact one-line format

Examples:
  ticktick list
  ticktick list --all
  ticktick list --format json
  ticktick list --priority 3
  ticktick list --due today
  ticktick list --overdue`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runList(allProjects, projectID, formatType, priorityFilter, dueFilter, overdue)
		},
	}

	cmd.Flags().BoolVar(&allProjects, "all", false, "List tasks from all projects")
	cmd.Flags().StringVar(&projectID, "project", "", "List tasks from specific project")
	cmd.Flags().StringVarP(&formatType, "format", "f", "table", "Output format (table, json, compact)")
	cmd.Flags().IntVar(&priorityFilter, "priority", -1, "Filter by priority (0-5)")
	cmd.Flags().StringVar(&dueFilter, "due", "", "Filter by due date (today, tomorrow, week)")
	cmd.Flags().BoolVar(&overdue, "overdue", false, "Show only overdue tasks")

	return cmd
}

// runList handles listing tasks
func runList(allProjects bool, projectID, formatType string, priorityFilter int, dueFilter string, overdue bool) error {
	// Validate format
	validFormats := map[string]bool{"table": true, "json": true, "compact": true}
	if !validFormats[formatType] {
		return fmt.Errorf("invalid format: %s (must be table, json, or compact)", formatType)
	}

	// Validate priority filter
	if priorityFilter != -1 && (priorityFilter < 0 || priorityFilter > 5) {
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

	// Create API client
	client := api.NewClientFromConfig(
		cfg.Auth.ClientID,
		cfg.Auth.ClientSecret,
		cfg.Auth.AccessToken,
		cfg.Auth.RefreshToken,
		cfg.Auth.Expiry,
	)

	ctx := context.Background()

	var tasks []api.Task
	var projectName string

	if allProjects {
		// Get all tasks across all projects
		projects, err := client.GetProjects(ctx)
		if err != nil {
			return fmt.Errorf("failed to fetch projects: %w", err)
		}

		for _, proj := range projects {
			if proj.Closed {
				continue
			}
			projTasks, err := client.GetTasks(ctx, proj.ID)
			if err != nil {
				fmt.Printf("Warning: failed to fetch tasks for project %s: %v\n", proj.Name, err)
				continue
			}
			tasks = append(tasks, projTasks...)
		}
		projectName = "All Projects"
	} else {
		// Determine which project to use
		if projectID == "" {
			// Try to find .ticktick file
			ctx, err := project.GetCurrentProjectContext()
			if err == nil {
				projectID = ctx.File.ProjectID
				projectName = ctx.File.ProjectName
			} else if err == project.ErrNoTickTickFile {
				// Use default project from config
				if cfg.Preferences.DefaultProject != "" {
					projectID = cfg.Preferences.DefaultProject
					// Fetch project name
					proj, err := client.GetProject(context.Background(), projectID)
					if err == nil {
						projectName = proj.Name
					} else {
						projectName = "Default Project"
					}
				} else {
					return fmt.Errorf("no project specified. Run 'ticktick init' or use --project or --all flag")
				}
			} else {
				return fmt.Errorf("failed to load project context: %w", err)
			}
		} else {
			// Fetch project name
			proj, err := client.GetProject(ctx, projectID)
			if err == nil {
				projectName = proj.Name
			} else {
				projectName = "Unknown Project"
			}
		}

		// Fetch tasks for the specific project
		tasks, err = client.GetTasks(ctx, projectID)
		if err != nil {
			return fmt.Errorf("failed to fetch tasks: %w", err)
		}
	}

	// Filter tasks
	tasks = filterTasks(tasks, priorityFilter, dueFilter, overdue)

	// Display tasks
	if len(tasks) == 0 {
		yellow := color.New(color.FgYellow)
		yellow.Println("No tasks found.")
		return nil
	}

	switch formatType {
	case "json":
		return outputJSON(tasks)
	case "compact":
		return outputCompact(tasks, projectName)
	default:
		return outputTable(tasks, projectName)
	}
}

// filterTasks filters tasks based on criteria
func filterTasks(tasks []api.Task, priorityFilter int, dueFilter string, overdue bool) []api.Task {
	var filtered []api.Task

	for _, task := range tasks {
		// Skip completed tasks
		if task.Status == 2 {
			continue
		}

		// Filter by priority
		if priorityFilter != -1 && task.Priority != priorityFilter {
			continue
		}

		// TODO: Add date filtering logic
		// For now, just add the task
		filtered = append(filtered, task)
	}

	return filtered
}

// outputTable displays tasks in table format
func outputTable(tasks []api.Task, projectName string) error {
	cyan := color.New(color.FgCyan, color.Bold)
	cyan.Printf("\n%s - %d task(s)\n\n", projectName, len(tasks))

	t := table.NewWriter()
	t.SetStyle(table.StyleLight)
	t.AppendHeader(table.Row{"ID", "Title", "Priority", "Due Date", "Tags"})

	for _, task := range tasks {
		// Truncate ID for display
		shortID := task.ID
		if len(shortID) > 8 {
			shortID = shortID[:8]
		}

		// Truncate title if too long
		title := task.Title
		if len(title) > 50 {
			title = title[:47] + "..."
		}

		// Format priority
		priorityStr := formatPriorityShort(task.Priority)

		// Format due date
		dueDate := task.DueDate
		if dueDate == "" {
			dueDate = "-"
		}

		// Format tags
		tagsStr := "-"
		if len(task.Tags) > 0 {
			tagsStr = strings.Join(task.Tags, ", ")
			if len(tagsStr) > 30 {
				tagsStr = tagsStr[:27] + "..."
			}
		}

		t.AppendRow(table.Row{shortID, title, priorityStr, dueDate, tagsStr})
	}

	fmt.Println(t.Render())
	return nil
}

// outputJSON displays tasks in JSON format
func outputJSON(tasks []api.Task) error {
	data, err := json.MarshalIndent(tasks, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal tasks to JSON: %w", err)
	}
	fmt.Println(string(data))
	return nil
}

// outputCompact displays tasks in compact format
func outputCompact(tasks []api.Task, projectName string) error {
	cyan := color.New(color.FgCyan, color.Bold)
	cyan.Printf("%s - %d task(s)\n\n", projectName, len(tasks))

	for _, task := range tasks {
		shortID := task.ID
		if len(shortID) > 8 {
			shortID = shortID[:8]
		}

		priorityStr := ""
		if task.Priority > 0 {
			priorityStr = fmt.Sprintf(" [P%d]", task.Priority)
		}

		dueStr := ""
		if task.DueDate != "" {
			dueStr = fmt.Sprintf(" (due: %s)", task.DueDate)
		}

		tagsStr := ""
		if len(task.Tags) > 0 {
			tagsStr = fmt.Sprintf(" #%s", strings.Join(task.Tags, " #"))
		}

		fmt.Printf("%s: %s%s%s%s\n", shortID, task.Title, priorityStr, dueStr, tagsStr)
	}

	return nil
}

// formatPriorityShort formats priority for table display
func formatPriorityShort(priority int) string {
	if priority == 0 {
		return "-"
	}
	return fmt.Sprintf("%d", priority)
}
