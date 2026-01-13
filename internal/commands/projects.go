package commands

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/brettman/ticktickcli/internal/api"
	"github.com/brettman/ticktickcli/internal/config"
	"github.com/fatih/color"
	"github.com/jedib0t/go-pretty/v6/table"
	"github.com/spf13/cobra"
)

// NewProjectsCmd creates the projects command
func NewProjectsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "projects",
		Short: "Manage projects",
		Long:  "Manage TickTick projects",
	}

	cmd.AddCommand(newProjectsListCmd())

	return cmd
}

// newProjectsListCmd creates the projects list command
func newProjectsListCmd() *cobra.Command {
	var formatType string

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all projects",
		Long: `List all projects from TickTick.

Output formats:
  table - Pretty table format (default)
  json  - JSON format

Examples:
  ticktick projects list
  ticktick projects list --format json`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runProjectsList(formatType)
		},
	}

	cmd.Flags().StringVarP(&formatType, "format", "f", "table", "Output format (table, json)")

	return cmd
}

// runProjectsList handles listing projects
func runProjectsList(formatType string) error {
	// Validate format
	validFormats := map[string]bool{"table": true, "json": true}
	if !validFormats[formatType] {
		return fmt.Errorf("invalid format: %s (must be table or json)", formatType)
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

	// Fetch projects
	projects, err := client.GetProjects(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch projects: %w", err)
	}

	// Display projects
	if len(projects) == 0 {
		yellow := color.New(color.FgYellow)
		yellow.Println("No projects found.")
		return nil
	}

	switch formatType {
	case "json":
		return outputProjectsJSON(projects)
	default:
		return outputProjectsTable(projects)
	}
}

// outputProjectsTable displays projects in table format
func outputProjectsTable(projects []api.Project) error {
	cyan := color.New(color.FgCyan, color.Bold)
	cyan.Printf("\nYour Projects (%d total)\n\n", len(projects))

	t := table.NewWriter()
	t.SetStyle(table.StyleLight)
	t.AppendHeader(table.Row{"ID", "Name", "Status", "Sort Order"})

	for _, proj := range projects {
		// Truncate ID for display
		shortID := proj.ID
		if len(shortID) > 12 {
			shortID = shortID[:12]
		}

		// Status
		status := "Active"
		if proj.Closed {
			status = "Closed"
		}

		t.AppendRow(table.Row{shortID, proj.Name, status, proj.SortOrder})
	}

	fmt.Println(t.Render())

	return nil
}

// outputProjectsJSON displays projects in JSON format
func outputProjectsJSON(projects []api.Project) error {
	data, err := json.MarshalIndent(projects, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal projects to JSON: %w", err)
	}
	fmt.Println(string(data))
	return nil
}
