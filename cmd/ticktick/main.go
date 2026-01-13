package main

import (
	"fmt"
	"os"

	"github.com/brettman/ticktickcli/internal/commands"
	"github.com/spf13/cobra"
)

var (
	// Version is the CLI version (set by build)
	Version = "dev"
)

func main() {
	rootCmd := &cobra.Command{
		Use:   "ticktick",
		Short: "TickTick CLI - Manage your tasks from the command line",
		Long: `TickTick CLI is a command-line interface for TickTick task management.

It provides seamless integration with your local development workflow,
allowing you to manage tasks directly from your terminal and integrate
with AI assistants via the MCP server.`,
		Version: Version,
	}

	// Add commands
	rootCmd.AddCommand(commands.NewAuthCmd())
	rootCmd.AddCommand(commands.NewInitCmd())

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
