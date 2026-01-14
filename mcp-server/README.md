# TickTick MCP Server

Model Context Protocol (MCP) server for TickTick task management. This enables AI assistants like Claude Desktop to manage your TickTick tasks naturally through conversation.

## Features

- **Natural Task Management** - Create, update, complete, and delete tasks through conversation
- **Smart Context** - Automatically uses the current project from `.ticktick` files
- **Powerful Search** - Search tasks by text, tags, and priority across projects
- **Shared Configuration** - Uses the same auth and config as the TickTick CLI

## Available Tools

The MCP server exposes these tools to AI assistants:

| Tool | Description |
|------|-------------|
| `create_task` | Create a new task with title, description, priority, due date, and tags |
| `list_tasks` | List all incomplete tasks in a project, optionally filtered by priority |
| `search_tasks` | Search tasks by text, tags, or priority (current project or all projects) |
| `get_task` | Get detailed information about a specific task |
| `update_task` | Update task properties (title, description, priority, due date, tags) |
| `complete_task` | Mark a task as completed |
| `delete_task` | Delete a task permanently |
| `get_projects` | List all active TickTick projects |
| `get_current_project` | Show the current project linked to the working directory |

## Installation

### Prerequisites

- Node.js 18+ and npm
- TickTick CLI already installed and authenticated
- Claude Desktop app installed

### Setup

1. **Navigate to the MCP server directory**
   ```bash
   cd /Users/bretthardman/_dev/ticktickcli/mcp-server
   ```

2. **Install dependencies** (if not already done)
   ```bash
   npm install
   ```

3. **Build the server**
   ```bash
   npm run build
   ```

4. **Configure Claude Desktop**

   **Option A: Automatic (Recommended)**
   ```bash
   ./install-claude-desktop.sh
   ```

   This script will automatically:
   - Detect your operating system
   - Find your Claude Desktop config location
   - Backup any existing config
   - Configure the TickTick MCP server

   **Option B: Manual Configuration**

   Edit your Claude Desktop configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

   Add the TickTick MCP server:

   ```json
   {
     "mcpServers": {
       "ticktick": {
         "command": "node",
         "args": [
           "/Users/bretthardman/_dev/ticktickcli/mcp-server/dist/index.js"
         ]
       }
     }
   }
   ```

   **Important**: Replace `/Users/bretthardman/_dev/ticktickcli` with the actual path to your ticktickcli directory.

5. **Restart Claude Desktop**

   Close and reopen Claude Desktop for the changes to take effect.

## Usage

Once configured, you can interact with your TickTick tasks naturally in Claude Desktop:

### Example Conversations

**Creating Tasks:**
```
You: "Add a task to review the security policy with high priority"

Claude: I'll create that task for you.
[Uses create_task tool]
✓ Task created successfully in project "Work"!

**Review the security policy**
ID: abc12345
Priority: High
```

**Listing Tasks:**
```
You: "Show me all my tasks"

Claude: Let me get your current tasks.
[Uses list_tasks tool]
Found 15 task(s) in "Work":

**Formulation of a Security Steering Committee**
ID: 685bc6b5
Priority: Medium
Tags: infosec-policy

[... more tasks ...]
```

**Searching Tasks:**
```
You: "Find all tasks related to security"

Claude: I'll search for security-related tasks.
[Uses search_tasks tool]
Found 4 task(s):

**Formulation of a Security Steering Committee**
ID: 685bc6b5
Priority: Medium
...
```

**Updating Tasks:**
```
You: "Update task 685bc6b5 to have high priority and add a due date of next Friday"

Claude: I'll update that task for you.
[Uses update_task tool]
✓ Task updated successfully!

**Formulation of a Security Steering Committee**
ID: 685bc6b5
Priority: High
Due: 2026-01-17
```

**Completing Tasks:**
```
You: "Mark task 685bc6b5 as complete"

Claude: I'll mark that as completed.
[Uses complete_task tool]
✓ Task completed: Formulation of a Security Steering Committee
```

**Advanced Queries:**
```
You: "Show me all high-priority tasks with the tag 'urgent'"

Claude: Let me search for those tasks.
[Uses search_tasks tool with filters]
Found 3 task(s):
...
```

### Context-Aware Operations

The MCP server automatically detects the current project:

1. When Claude Desktop is working in a directory with a `.ticktick` file, it uses that project
2. All task operations default to the current project
3. You can explicitly specify a different project when needed

**Example:**
```
You: "List my tasks"
Claude: [Uses the current project from .ticktick file]

You: "Create a task in the Shopping project"
Claude: [Uses the Shopping project specifically]
```

## Project-Based Workflow

1. **Initialize a project** in your working directory using the CLI:
   ```bash
   cd ~/my-project
   ticktick init
   ```

2. **Open Claude Desktop** in that directory (or a subdirectory)

3. **Ask Claude to manage tasks** - it will automatically use the correct project:
   ```
   "Add a task to implement the login feature"
   "Show me all my tasks for this project"
   ```

## Troubleshooting

### Claude Desktop doesn't show TickTick tools

**Solution:**
1. Check that the config file path is correct
2. Verify the absolute path to `index.js` in the config
3. Restart Claude Desktop
4. Check Claude Desktop's developer console (Help → Developer Tools) for errors

### "Not authenticated" error

**Solution:**
Run the CLI authentication first:
```bash
ticktick auth login
```

The MCP server uses the same authentication as the CLI (stored in `~/.ticktick/config`).

### "No project specified" error

**Solution:**
Either:
1. Create a `.ticktick` file in your working directory:
   ```bash
   ticktick init
   ```
2. Explicitly specify a project ID when asking Claude to perform operations

### MCP server not starting

**Solution:**
1. Test the server manually:
   ```bash
   cd mcp-server
   npm run dev
   ```
2. Check for error messages
3. Ensure all dependencies are installed: `npm install`
4. Rebuild: `npm run build`

## Architecture

The MCP server:
- **Shares code** with the CLI via symbolic links (`lib/` and `types/`)
- **Uses the same config** (`~/.ticktick/config`) for authentication
- **Detects `.ticktick` files** to determine the current project
- **Communicates via stdio** with Claude Desktop using the MCP protocol
- **Formats output** in a conversation-friendly way

## Development

**Run in development mode:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

**Test manually:**
```bash
# The server expects MCP protocol messages on stdin
# Usually you'll test through Claude Desktop
npm start
```

## Security Notes

- The MCP server uses your TickTick access token from `~/.ticktick/config`
- It only runs when Claude Desktop is active
- All operations require authentication via the CLI first
- The server cannot perform operations without your TickTick credentials

## Contributing

This MCP server is part of the TickTick CLI project. See the main README for contribution guidelines.

## License

MIT
