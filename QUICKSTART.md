# Quick Start Guide

Get up and running with TickTick CLI and MCP Server in 5 minutes.

## Prerequisites

- Node.js 18+ and npm installed
- A TickTick account
- TickTick OAuth credentials ([get them here](https://developer.ticktick.com/))

## Part 1: CLI Setup (2 minutes)

### 1. Install Dependencies
```bash
cd /Users/bretthardman/_dev/ticktickcli
npm install
npm run build
npm link  # Makes 'ticktick' available globally
```

### 2. Create .env File
```bash
cp .env.example .env
```

Edit `.env` and add your OAuth credentials:
```
TICKTICK_CLIENT_ID=your_client_id_here
TICKTICK_CLIENT_SECRET=your_client_secret_here
```

### 3. Authenticate
```bash
ticktick auth login
```

This will:
- Open your browser for OAuth authorization
- Save your access token to `~/.ticktick/config`
- You only need to do this once!

### 4. Initialize a Project
```bash
cd ~/your-project
ticktick init
```

Pick a TickTick project to link to this directory.

### 5. Try It Out!
```bash
# Add a task (interactive)
ticktick add

# Add a task (command-line)
ticktick add "Review pull requests" --priority 3 --tags work

# List tasks
ticktick list

# Search tasks
ticktick search "review"

# Update a task (interactive - shows current values)
ticktick update abc12345

# Complete a task
ticktick complete abc12345
```

**✅ CLI Setup Complete!**

---

## Part 2: MCP Server Setup (3 minutes)

### 1. Build the MCP Server
```bash
cd mcp-server
npm install
npm run build
```

### 2. Configure Claude Desktop
```bash
./install-claude-desktop.sh
```

This automatically:
- Finds your Claude Desktop config location
- Backs up existing config
- Adds TickTick MCP server

**OR** manually edit `~/Library/Application Support/Claude/claude_desktop_config.json`:
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

### 3. Restart Claude Desktop

Close and reopen Claude Desktop completely.

### 4. Test in Claude Desktop

Open Claude Desktop and try:

```
You: "Add a high-priority task to review the security framework"

Claude: I'll create that task for you using TickTick.
[Uses create_task tool]
✓ Task created successfully in project "Work"!
...
```

```
You: "Show me all my tasks"

Claude: Let me get your current tasks.
[Uses list_tasks tool]
Found 15 task(s) in "Work":
...
```

**✅ MCP Server Setup Complete!**

---

## Common Commands Reference

### CLI Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ticktick auth login` | Authenticate with TickTick | - |
| `ticktick init` | Link directory to project | - |
| `ticktick switch` | Change projects | - |
| `ticktick add` | Create task (interactive) | - |
| `ticktick add "title"` | Create task (command-line) | `ticktick add "Fix bug" --priority 5` |
| `ticktick list` | List all tasks | `ticktick list --format compact` |
| `ticktick search` | Search tasks | `ticktick search "security" --tag urgent` |
| `ticktick show <id>` | View task details | `ticktick show abc12345` |
| `ticktick update <id>` | Update task (interactive) | - |
| `ticktick update <id> [opts]` | Update task (command-line) | `ticktick update abc123 --priority 5` |
| `ticktick complete <id>` | Mark complete | `ticktick complete abc12345` |
| `ticktick delete <id>` | Delete task | `ticktick delete abc12345` |

### MCP Tools (in Claude Desktop)

Just talk naturally:
- "Add a task to..."
- "Show me all my tasks"
- "Search for tasks about..."
- "Update task abc123 to..."
- "Mark task abc123 as complete"
- "Delete task abc123"

---

## Troubleshooting

### "Not authenticated" error
```bash
ticktick auth login
```

### "No project specified" error
```bash
ticktick init  # Run in your project directory
```

### MCP server not working in Claude Desktop
1. Check Claude Desktop config path is correct
2. Verify absolute path to `index.js`
3. Restart Claude Desktop completely
4. Check Developer Tools (Help → Developer Tools) for errors

### OAuth hanging after browser authentication
This is expected! The CLI will automatically exit after a brief delay. Your authentication is saved.

---

## Next Steps

- Read the [full CLI documentation](README.md)
- Read the [MCP server documentation](mcp-server/README.md)
- Check [CLAUDE.md](CLAUDE.md) for development guidance
- Explore all CLI features with `ticktick --help`

## Support

- File issues: https://github.com/brettman/ticktickcli/issues
- API docs: https://developer.ticktick.com/api

---

**Enjoy your new TickTick-powered workflow! 🚀**
