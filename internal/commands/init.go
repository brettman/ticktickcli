package commands

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/bretthardman/ticktickcli/internal/api"
	"github.com/bretthardman/ticktickcli/internal/config"
	"github.com/bretthardman/ticktickcli/internal/project"
	"github.com/fatih/color"
	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

// NewInitCmd creates the init command
func NewInitCmd() *cobra.Command {
	var projectID, projectName string

	cmd := &cobra.Command{
		Use:   "init",
		Short: "Initialize a project with TickTick",
		Long: `Initialize the current directory with a .ticktick file.

This links the current directory to a TickTick project, allowing
context-aware task management. You can either:

1. Link to an existing project (--project-id)
2. Create a new project (--create)

If neither flag is provided, you'll be prompted to select a project.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runInit(projectID, projectName)
		},
	}

	cmd.Flags().StringVar(&projectID, "project-id", "", "Link to existing project by ID")
	cmd.Flags().StringVar(&projectName, "create", "", "Create new project with this name")

	return cmd
}

// runInit handles the init flow
func runInit(projectID, projectName string) error {
	// Check if .ticktick file already exists
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get current directory: %w", err)
	}

	if project.HasTickTickFile(cwd) {
		return fmt.Errorf(".ticktick file already exists in this directory")
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

	var selectedProject *api.Project

	// Handle different modes
	if projectName != "" {
		// Create new project
		fmt.Printf("Creating new project: %s\n", projectName)
		selectedProject, err = client.CreateProject(ctx, &api.CreateProjectRequest{
			Name: projectName,
		})
		if err != nil {
			return fmt.Errorf("failed to create project: %w", err)
		}
		green := color.New(color.FgGreen)
		green.Printf("✓ Created project: %s\n", selectedProject.Name)
	} else if projectID != "" {
		// Link to existing project by ID
		fmt.Printf("Fetching project: %s\n", projectID)
		selectedProject, err = client.GetProject(ctx, projectID)
		if err != nil {
			return fmt.Errorf("failed to fetch project: %w", err)
		}
	} else {
		// Interactive selection
		selectedProject, err = selectProject(client, ctx)
		if err != nil {
			return err
		}
	}

	// Create .ticktick file
	absPath, err := filepath.Abs(cwd)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	ttFile := project.NewTickTickFile(selectedProject.ID, selectedProject.Name, absPath)
	if err := ttFile.Save(cwd); err != nil {
		return fmt.Errorf("failed to save .ticktick file: %w", err)
	}

	green := color.New(color.FgGreen, color.Bold)
	green.Println("\n✓ Project initialized successfully!")
	fmt.Printf("\nProject: %s (ID: %s)\n", selectedProject.Name, selectedProject.ID)
	fmt.Printf("Directory: %s\n", absPath)
	fmt.Printf("\nYou can now use project-aware commands like:\n")
	fmt.Printf("  ticktick add \"My task\"\n")
	fmt.Printf("  ticktick list\n")

	return nil
}

// selectProject shows an interactive project selector
func selectProject(client *api.Client, ctx context.Context) (*api.Project, error) {
	fmt.Println("Fetching your projects...")

	projects, err := client.GetProjects(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch projects: %w", err)
	}

	if len(projects) == 0 {
		return nil, fmt.Errorf("no projects found. Create one with --create flag")
	}

	// Filter out closed projects
	var activeProjects []api.Project
	for _, p := range projects {
		if !p.Closed {
			activeProjects = append(activeProjects, p)
		}
	}

	if len(activeProjects) == 0 {
		return nil, fmt.Errorf("no active projects found. Create one with --create flag")
	}

	// Create prompt
	templates := &promptui.SelectTemplates{
		Label:    "{{ . }}?",
		Active:   "▸ {{ .Name | cyan }}",
		Inactive: "  {{ .Name }}",
		Selected: "{{ .Name | green }}",
	}

	prompt := promptui.Select{
		Label:     "Select a project to link",
		Items:     activeProjects,
		Templates: templates,
	}

	index, _, err := prompt.Run()
	if err != nil {
		return nil, fmt.Errorf("project selection cancelled")
	}

	return &activeProjects[index], nil
}
