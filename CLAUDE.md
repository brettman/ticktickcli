# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A TypeScript/Node.js toolkit for TickTick task management with two components:
1. **CLI Tool** - Command-line interface for developers to manage tasks from the terminal
2. **MCP Server** - Model Context Protocol server for AI assistants (Claude Desktop, etc.)

Both components share code and configuration, enabling seamless task management across human and AI workflows.

## Architecture

**Dual-Mode Design:**
- **TypeScript CLI** (`ticktick` command): Fast CLI with interactive and command-line modes
- **TypeScript MCP Server**: AI integration layer for Claude Desktop and other AI tools
- **Shared Code**: Both use the same API client, config manager, and type definitions
- **Shared State**: Both read/write `.ticktick` files in project folders and `~/.ticktick/config`

**Key Design Principles:**
- Project folders contain `.ticktick` files linking them to TickTick projects
- CLI is context-aware: auto-detects `.ticktick` in current/parent directories
- MCP server exposes 9 tools for AI assistants
- Single source of truth: TickTick API (local files are for linking/config only)
- Short ID support: Use first 8-12 characters of IDs for quick access

## Repository Structure

```
/src/                    # CLI source code
  /commands/             # CLI commands (add, list, update, search, etc.)
  /lib/                  # Shared libraries
    api-client.ts        # TickTick REST API client
    config.ts            # Config management (~/.ticktick/config)
    auth.ts              # OAuth 2.0 flow implementation
    project.ts           # .ticktick file operations
  /types/                # TypeScript type definitions
    index.ts             # Config, Task, Project types
  index.ts               # CLI entry point

/mcp-server/             # MCP server for AI assistants
  /src/
    index.ts             # MCP server implementation (9 tools)
    lib/                 # Symlink to ../src/lib (shared code)
    types/               # Symlink to ../src/types (shared types)
  install-claude-desktop.sh  # Auto-configuration script

/dist/                   # CLI compiled output
/mcp-server/dist/        # MCP server compiled output
```

## File Formats

**.ticktick file** (in project directories):
```json
{
  "version": "1.0",
  "projectId": "ticktick-project-id",
  "projectName": "Project Name",
  "folderPath": "/absolute/path/to/folder",
  "createdAt": "2026-01-13T14:41:17.810Z",
  "syncedAt": "2026-01-13T14:41:17.810Z"
}
```

**~/.ticktick/config**:
```json
{
  "version": "1.0",
  "auth": {
    "clientId": "...",
    "clientSecret": "...",
    "accessToken": "...",
    "refreshToken": "",
    "expiry": "2026-07-12T15:53:19.000Z"
  },
  "preferences": {
    "dateFormat": "YYYY-MM-DD",
    "timeFormat": "24h",
    "defaultPriority": 0,
    "colorOutput": true
  },
  "cache": {
    "enabled": true,
    "ttl": 300
  }
}
```

## Common Workflows

### Building and Testing

**CLI:**
```bash
# Development
npm run dev -- <command>

# Build
npm run build

# Global install
npm link
ticktick <command>

# Test commands
ticktick auth status
ticktick list
ticktick add "Test task"
ticktick search "keyword"
```

**MCP Server:**
```bash
cd mcp-server
npm install
npm run build

# Configure Claude Desktop
./install-claude-desktop.sh

# Test in Claude Desktop
(Restart Claude Desktop and use natural language)
```

### Adding New CLI Commands

1. Create command file in `src/commands/`
2. Import and register in `src/index.ts`
3. Add to README.md with examples
4. Test interactively: `npm run dev -- yourcommand`

### Adding New MCP Tools

1. Add tool definition to `TOOLS` array in `mcp-server/src/index.ts`
2. Add handler in `CallToolRequestSchema` switch statement
3. Update `mcp-server/README.md` with tool documentation
4. Test with Claude Desktop

### TickTick API Integration

- **API Reference**: https://developer.ticktick.com/api
- **Authentication**: OAuth 2.0 via browser flow
- **Client Location**: `src/lib/api-client.ts` (shared by both CLI and MCP)
- **Important Notes**:
  - API doesn't support fetching individual tasks/projects by ID
  - Always fetch all and filter locally
  - API returns tasks wrapped in `{tasks: [...]}` format
  - OAuth callback server must be aggressively closed to prevent hanging

## Development Notes

### Shared Code Architecture

The CLI and MCP server share code via symbolic links:
- `mcp-server/src/lib/` → `../../src/lib/`
- `mcp-server/src/types/` → `../../src/types/`

**When modifying shared code:**
- Changes to `src/lib/*` affect both CLI and MCP server
- Changes to `src/types/*` affect both CLI and MCP server
- Rebuild both after changes: `npm run build` in root and `mcp-server/`

### Key Implementation Details

**API Client (`src/lib/api-client.ts`):**
- `getProject()` - Fetches all projects, filters by ID (API limitation)
- `findTaskById()` - Fetches all tasks, supports short ID matching
- `updateTask()` - Fetches full task, merges changes, sends complete object

**Project Detection (`src/lib/project.ts`):**
- `getCurrentProjectContext()` - Traverses directory tree upward
- Finds nearest `.ticktick` file
- Used by both CLI and MCP for context-awareness

**OAuth Flow (`src/lib/auth.ts`):**
- Creates HTTP server on port 8080
- Tracks all connections to force-close them
- Uses 100ms delay + process.exit(0) to prevent hanging

### Interactive Mode Pattern

Both `add` and `update` commands support interactive mode:
- No required args → Interactive prompts
- Args provided → Direct execution
- Use `inquirer` for prompts
- Show current values when updating

### Testing Checklist

Before pushing changes:
- [ ] CLI builds: `npm run build`
- [ ] MCP server builds: `cd mcp-server && npm run build`
- [ ] Auth works: `ticktick auth login`
- [ ] All commands work: test add, list, search, update, complete, delete
- [ ] Interactive modes work: `ticktick add`, `ticktick update <id>`
- [ ] Short IDs work in all commands
- [ ] MCP server starts without errors
- [ ] README examples are accurate

## Future Enhancements

Potential features to add:
- Recurring tasks support
- Bulk operations (complete multiple, delete multiple)
- Task templates
- Custom views and filters
- Export/import functionality
- Sync status and conflict resolution
- Rich text formatting in descriptions
- Subtask support
- Time tracking integration
