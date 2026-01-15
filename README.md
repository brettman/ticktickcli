# TickTick CLI

A command-line interface for managing TickTick tasks, designed for developer workflows and AI-assisted task management.

## Features

- **OAuth 2.0 Authentication** - Secure login with TickTick
- **Interactive & Command-Line Modes** - Choose guided prompts or fast command-line flags
- **Project-Based Workflow** - Link directories to TickTick projects with `.ticktick` files
- **Context-Aware Commands** - Automatically detects the current project
- **Short ID Support** - Use abbreviated IDs (e.g., `685cfca6` instead of full IDs)
- **Multiple Output Formats** - Table, JSON, and compact views
- **Rich Task Management** - Create, list, update, search, complete, delete, and view task details
- **Powerful Search** - Search by text, tags, priority across projects

## Installation

### Prerequisites

- Node.js 18+ and npm
- A TickTick account
- TickTick OAuth credentials (see [Getting OAuth Credentials](#getting-oauth-credentials))

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/brettman/ticktickcli.git
   cd ticktickcli
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Install globally** (optional, for easier access)
   ```bash
   npm link
   ```

   After this, you can use `ticktick` directly instead of `npm run dev --`

5. **Create a `.env` file** (optional, to avoid entering credentials each time)
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your TickTick OAuth credentials:
   ```
   TICKTICK_CLIENT_ID=your_client_id_here
   TICKTICK_CLIENT_SECRET=your_client_secret_here
   ```

## Getting OAuth Credentials

1. Visit [TickTick Developer Console](https://developer.ticktick.com/)
2. Sign in with your TickTick account
3. Create a new application
4. Set the redirect URI to: `http://localhost:8080/callback`
5. Copy your **Client ID** and **Client Secret**
6. Add them to your `.env` file or use them with `--client-id` and `--client-secret` flags

## Usage

**If you installed globally (with `npm link`):**

```bash
ticktick <command> [options]
```

**If running from the project directory:**

```bash
npm run dev -- <command> [options]
```

> For the rest of this README, examples use `ticktick` directly (assuming global installation). If you didn't install globally, replace `ticktick` with `npm run dev --`.

### Authentication

**Login to TickTick**
```bash
ticktick auth login
```

This will:
1. Open your browser for OAuth authorization
2. Save your access token to `~/.ticktick/config`
3. You only need to do this once

**Check authentication status**
```bash
ticktick auth status
```

**Logout**
```bash
ticktick auth logout
```

### Project Management

**Initialize a project** (links current directory to a TickTick project)
```bash
ticktick init
```

Options:
- `--project-id <id>` - Link to specific project by ID
- `--create <name>` - Create a new project
- `--force` - Overwrite existing `.ticktick` file

**Switch to a different project**
```bash
ticktick switch
```

Options:
- `--project-id <id>` - Switch directly to project by ID

**List all projects**
```bash
ticktick projects list
```

### Task Management

**Add a task**

*Interactive mode* (recommended for new users):
```bash
ticktick add
```
You'll be prompted for each field:
- Task title (required)
- Description (optional)
- Priority (None/Low/Medium/High)
- Due date (YYYY-MM-DD)
- Tags (comma-separated)

*Command-line mode* (faster for experienced users):
```bash
ticktick add "Task title" [options]
```

Options:
- `--desc <text>` - Add task description
- `--priority <0-5>` - Set priority (0=none, 1=low, 3=medium, 5=high)
- `--due <date>` - Set due date (YYYY-MM-DD)
- `--tags <tag1,tag2>` - Add comma-separated tags

Examples:
```bash
# Interactive mode
ticktick add

# Command-line mode with all options
ticktick add "Review security policy" --desc "Annual review required" --priority 3 --tags infosec,policy

# Quick add with just title
ticktick add "Quick task"
```

**List tasks**
```bash
ticktick list
```

Options:
- `--format <type>` - Output format: `table` (default), `json`, or `compact`
- `--priority <0-5>` - Filter by priority level
- `--project <id>` - List tasks from specific project

Examples:
```bash
# Table view (default)
ticktick list

# Compact view
ticktick list --format compact

# Filter high-priority tasks
ticktick list --priority 5

# JSON output
ticktick list --format json
```

**Search for tasks**
```bash
ticktick search [query]
```

Options:
- `[query]` - Search text (searches in title and description)
- `--tag <tags>` - Filter by tags (comma-separated)
- `--priority <0-5>` - Filter by priority level
- `--all-projects` - Search across all projects instead of current project
- `--format <type>` - Output format: `table` (default), `json`, or `compact`

Examples:
```bash
# Search for tasks containing "security"
ticktick search security

# Search by tag
ticktick search --tag infosec-policy

# Search high-priority tasks
ticktick search --priority 5

# Search across all projects
ticktick search "API" --all-projects

# Combine filters
ticktick search --tag work --priority 3 --format compact
```

**Update a task**

*Interactive mode* (recommended - shows current values):
```bash
ticktick update <task-id>
```
You'll see the current task values and be prompted for changes:
- New title (or leave empty to keep current)
- New description (type "clear" to remove, empty to keep)
- New priority (with option to keep current)
- New due date (type "clear" to remove, empty to keep)
- New tags (type "clear" to remove, empty to keep)

*Command-line mode* (faster for specific changes):
```bash
ticktick update <task-id> [options]
```

Options:
- `--title <text>` - Update task title
- `--desc <text>` - Update task description
- `--priority <0-5>` - Update priority (0=none, 1=low, 3=medium, 5=high)
- `--due <date>` - Update due date (YYYY-MM-DD format)
- `--tags <tags>` - Update tags (comma-separated)
- `--clear-desc` - Clear the task description
- `--clear-due` - Clear the due date
- `--clear-tags` - Clear all tags

Examples:
```bash
# Interactive mode - shows current values and prompts for changes
ticktick update 685cfca6

# Command-line mode examples:

# Update task title
ticktick update 685cfca6 --title "New task title"

# Update priority and add description
ticktick update 685cfca6 --priority 5 --desc "This is urgent"

# Update due date
ticktick update 685cfca6 --due 2026-01-20

# Update tags
ticktick update 685cfca6 --tags work,urgent,security

# Clear description
ticktick update 685cfca6 --clear-desc

# Update multiple fields at once
ticktick update 685cfca6 --title "Updated title" --priority 3 --tags important
```

**Show task details**
```bash
ticktick show <task-id>
```

Example:
```bash
ticktick show 685cfca6
```

**Complete a task**
```bash
ticktick complete <task-id>
```

Example:
```bash
ticktick complete 685cfca6
```

**Delete a task**
```bash
ticktick delete <task-id>
```

Options:
- `--force` - Skip confirmation prompt

Example:
```bash
ticktick delete 685cfca6
ticktick delete 685cfca6 --force  # No confirmation
```

## Project-Based Workflow

The CLI is designed around a project-based workflow:

1. **Initialize a project** in your working directory:
   ```bash
   cd ~/my-project
   ticktick init
   ```

2. This creates a `.ticktick` file linking the directory to a TickTick project

3. **All commands now operate on that project** automatically:
   ```bash
   ticktick add "Implement feature X"
   ticktick list
   ticktick complete 685cfca6
   ```

4. **Switch projects** when needed:
   ```bash
   ticktick switch
   ```

5. The CLI **searches up the directory tree** for `.ticktick` files, so subdirectories inherit the project context

## Global Default Project

Set a default project to use from anywhere on your machine, even without a `.ticktick` file:

**Set default project** (interactive mode - shows list of projects):
```bash
ticktick config default set
```

**Set default project** (direct mode - using project ID):
```bash
ticktick config default set 685bbc9b
```

**View default project**:
```bash
ticktick config default show
```

**Clear default project**:
```bash
ticktick config default clear
```

**View all configuration**:
```bash
ticktick config show
```

### How Project Resolution Works

When you run a command, the CLI determines which project to use in this order:

1. **Explicit `--project <id>` flag** (highest priority)
   ```bash
   ticktick list --project abc12345
   ```

2. **Local `.ticktick` file** in current or parent directory
   ```bash
   cd ~/my-project  # Has .ticktick file
   ticktick list    # Uses project from .ticktick
   ```

3. **Global default project** from `~/.ticktick/config`
   ```bash
   cd /tmp          # No .ticktick file
   ticktick list    # Uses global default
   ```

4. **Error** if none of the above are available

This means you can work from anywhere on your machine while maintaining project-specific contexts in your working directories.

## Configuration

Configuration is stored in `~/.ticktick/config`:

```json
{
  "version": "1.0",
  "auth": {
    "clientId": "...",
    "clientSecret": "...",
    "accessToken": "...",
    "refreshToken": "",
    "expiry": "..."
  },
  "preferences": {
    "dateFormat": "YYYY-MM-DD",
    "timeFormat": "24h",
    "defaultPriority": 0,
    "colorOutput": true,
    "defaultProject": "685bbc9b..."
  }
}
```

You can view your configuration with `ticktick config show` and manage the default project with the `ticktick config default` commands (see [Global Default Project](#global-default-project)).

## Development

**Run in development mode** (with auto-reload)
```bash
npm run dev -- <command>
```

**Build for production**
```bash
npm run build
```

**Run built version**
```bash
npm start <command>
```

## Tips

- **Interactive vs Command-Line Mode**:
  - Use **interactive mode** (`ticktick add` or `ticktick update <id>`) when:
    - You're new to the CLI
    - You want to see current values before updating
    - You're unsure what fields to set
  - Use **command-line mode** (`ticktick add "title" --flags`) when:
    - You know exactly what you want to set
    - You're scripting or automating
    - You want maximum speed

- **Use short IDs**: Instead of typing full task IDs like `685cfca6f8a4910289264dc5`, you can use just the first 8 characters: `685cfca6`

- **Store OAuth credentials in `.env`**: Avoid re-entering them by adding them to the `.env` file

- **Commit `.ticktick` files**: Consider committing `.ticktick` files to version control so team members can link to the same project

- **Use `--format json`** for scripting and automation:
  ```bash
  ticktick list --format json | jq '.[] | select(.priority == 5)'
  ```

## MCP Server (AI Integration)

This project includes an MCP (Model Context Protocol) server that enables AI assistants like Claude Desktop to manage your TickTick tasks through natural conversation.

### Quick Setup

1. **Build the MCP server:**
   ```bash
   cd mcp-server
   npm install
   npm run build
   ```

2. **Configure Claude Desktop:**

   Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):
   ```json
   {
     "mcpServers": {
       "ticktick": {
         "command": "node",
         "args": [
           "/FULL/PATH/TO/ticktickcli/mcp-server/dist/index.js"
         ]
       }
     }
   }
   ```

3. **Restart Claude Desktop**

4. **Start using it naturally:**
   ```
   You: "Add a task to review the security policy with high priority"
   Claude: [Creates the task in your current project]

   You: "Show me all my tasks"
   Claude: [Lists your tasks]

   You: "Mark task abc123 as complete"
   Claude: [Completes the task]
   ```

See [`mcp-server/README.md`](mcp-server/README.md) for detailed setup and usage instructions.

## Architecture

This is a hybrid TypeScript/Node.js project with two components:

1. **CLI Tool** (`src/`) - Fast, native command-line task management
   - Interactive and command-line modes
   - Context-aware via `.ticktick` files
   - Supports short IDs for quick access

2. **MCP Server** (`mcp-server/`) - AI assistant integration
   - Exposes 9 tools for task operations
   - Uses the same config and API client as CLI
   - Enables natural language task management in Claude Desktop

**Shared Components:**
- Authentication & config (`~/.ticktick/config`)
- API client and type definitions
- Project context detection (`.ticktick` files)

## Troubleshooting

**"Not authenticated" error**
- Run `ticktick auth login` to authenticate

**"No project specified" error**
- Run `ticktick init` to link the current directory to a project
- Or use `--project <id>` flag to specify a project

**OAuth callback hanging**
- Make sure no other service is using port 8080
- Check that your OAuth redirect URI is set to `http://localhost:8080/callback`

## License

MIT

## Contributing

Contributions welcome! Please open an issue or pull request.
