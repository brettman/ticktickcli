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
- Three-tier project resolution: explicit `--project` flag > local `.ticktick` file > global default project
- Global default project enables CLI use from any directory (set via `ticktick config default set`)
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

**First-time Setup:**
```bash
# Install dependencies for both CLI and MCP server
npm install
cd mcp-server && npm install && cd ..

# Build both components
npm run build
cd mcp-server && npm run build && cd ..

# Optional: Install CLI globally
npm link
```

**CLI Development:**
```bash
# Development mode (with tsx for auto-reload)
npm run dev -- <command>

# Build CLI only
npm run build

# Test commands
ticktick auth status
ticktick config show
ticktick config default set        # Set global default project interactively
ticktick list
ticktick add "Test task"
ticktick search "keyword"
```

**MCP Server Development:**
```bash
cd mcp-server

# Development mode
npm run dev

# Build MCP server only
npm run build

# Configure Claude Desktop (one-time)
./install-claude-desktop.sh

# Test in Claude Desktop
# (Restart Claude Desktop and use natural language)
```

**Clean Build:**
```bash
# Clean and rebuild everything
npm run clean
npm run build
cd mcp-server && npm run clean && npm run build && cd ..
```

### Adding New CLI Commands

1. Create command file in `src/commands/`
2. Import and register in `src/index.ts`
3. Add to README.md with examples
4. Test interactively: `npm run dev -- yourcommand`

### Adding New MCP Tools

1. Add tool definition to `TOOLS` array in `mcp-server/src/index.ts` with:
   - `name`: Unique tool identifier (snake_case)
   - `description`: What the tool does (for AI to understand when to use it)
   - `inputSchema`: JSON Schema for parameters (required/optional fields)
2. Add handler case in `CallToolRequestSchema` switch statement
3. Return results as `{ content: [{ type: 'text', text: '...' }] }`
4. Update `mcp-server/README.md` with tool documentation and examples
5. Test with Claude Desktop: restart app and verify tool appears in conversation

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

### Project Structure

This is a **monorepo with two separate Node.js projects**:

1. **Root project** (`/package.json`): CLI tool
   - Dependencies: `commander`, `inquirer`, `chalk`, `cli-table3`, `axios`, `simple-oauth2`, `open`
   - Executable: `ticktick` command (in `bin` field)
   - Entry point: `dist/index.js`

2. **MCP Server** (`/mcp-server/package.json`): AI integration
   - Dependencies: `@modelcontextprotocol/sdk`, `axios`, `dotenv`
   - Executable: `ticktick-mcp` command
   - Entry point: `dist/index.js`

**Important**: Each project has its own `package.json` and `node_modules`. When installing dependencies or building, you must run commands in both locations.

### Shared Code Architecture

The CLI and MCP server share code via symbolic links:
- `mcp-server/src/lib/` → `../../src/lib/`
- `mcp-server/src/types/` → `../../src/types/`

**When modifying shared code:**
- Changes to `src/lib/*` affect both CLI and MCP server
- Changes to `src/types/*` affect both CLI and MCP server
- Must rebuild both after changes: `npm run build` in root AND `cd mcp-server && npm run build`
- Shared code includes: API client, config manager, project manager, auth flow, type definitions

**When adding dependencies:**
- CLI dependencies: `npm install <package>` in root
- MCP dependencies: `cd mcp-server && npm install <package>`
- If shared code needs it: install in BOTH projects

### Key Implementation Details

**API Client (`src/lib/api-client.ts`):**
- `TickTickClient` class wraps axios with Bearer token auth
- `getProject(id)` - Fetches all projects, filters by ID (API limitation - no individual fetch endpoint)
- `findTaskById(id)` - Fetches all tasks, supports short ID matching (first 8-12 chars)
- `updateTask()` - Must fetch full task first, merge changes, then PUT complete object
- All methods include error handling that wraps axios errors with context

**Project Detection (`src/lib/project.ts`):**
- `ProjectManager.getCurrentProjectContext()` - Traverses directory tree upward from cwd
- Finds nearest `.ticktick` file (stops at first match or filesystem root)
- `load()` validates `.ticktick` file format and returns parsed data
- Used by both CLI and MCP for automatic project context

**Config Management (`src/lib/config.ts`):**
- `ConfigManager` handles `~/.ticktick/config` file
- Stores OAuth tokens, preferences, and cache settings
- `ensureAuthenticated()` checks token validity and expiry
- Auto-creates config directory on first use

**OAuth Flow (`src/lib/auth.ts`):**
- Creates temporary HTTP server on port 8080 for OAuth callback
- Tracks all socket connections to force-close them after success
- Uses 100ms delay + process.exit(0) to prevent process hanging
- Opens browser automatically with `open` package

**MCP Server (`mcp-server/src/index.ts`):**
- Implements Model Context Protocol using `@modelcontextprotocol/sdk`
- Uses `StdioServerTransport` for communication with Claude Desktop
- Exposes 9 tools: `create_task`, `list_tasks`, `search_tasks`, `get_task`, `update_task`, `complete_task`, `delete_task`, `list_projects`, `init_project`
- Each tool handler returns `{ content: [{ type: 'text', text: result }] }` format
- Reads working directory from process.cwd() for project context detection
- Shares same config file (`~/.ticktick/config`) as CLI for auth

### Interactive Mode Pattern

Both `add` and `update` commands support interactive mode:
- No required args → Interactive prompts
- Args provided → Direct execution
- Use `inquirer` for prompts
- Show current values when updating

### Testing Checklist

Before pushing changes:
- [ ] CLI builds without errors: `npm run build`
- [ ] MCP server builds without errors: `cd mcp-server && npm run build`
- [ ] Authentication works: `ticktick auth login` and `ticktick auth status`
- [ ] Config commands work: `ticktick config default set` (interactive), `ticktick config show`
- [ ] Global default project fallback: test command from directory without `.ticktick` file
- [ ] Three-tier resolution: test `--project` flag > `.ticktick` file > global default priority order
- [ ] All CLI commands work: test `add`, `list`, `search`, `update`, `complete`, `delete`, `show`
- [ ] Interactive modes work: `ticktick add`, `ticktick update <id>`, `ticktick config default set`
- [ ] Short IDs work in all commands (first 8-12 chars)
- [ ] Project context detection: test commands in directory with `.ticktick` file
- [ ] MCP server starts: `cd mcp-server && npm run dev` (should not error)
- [ ] MCP tools work: test in Claude Desktop with natural language
- [ ] README and documentation examples are accurate

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
