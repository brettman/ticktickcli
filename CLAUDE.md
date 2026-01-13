# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A hybrid Go + TypeScript CLI tool for TickTick task management, designed for AI-assisted workflows. The tool enables developers to manage tasks directly from the terminal and integrate task management with AI assistants via MCP (Model Context Protocol).

## Architecture

**Hybrid Approach:**
- **Go CLI** (`ticktick` command): Fast, native CLI for human users
- **TypeScript MCP Server**: AI integration layer for Claude Desktop and other AI tools
- **Shared State**: Both components read/write `.ticktick` files in project folders and shared config at `~/.ticktick/config`

**Key Design Principles:**
- Project folders contain `.ticktick` files linking them to TickTick projects
- CLI is context-aware: auto-detects `.ticktick` in current/parent directories
- MCP server exposes task operations as tools for AI assistants
- Single source of truth: TickTick API (local files are for linking/config only)

## Repository Structure

```
/cmd/ticktick/          # Go CLI entry point
/internal/
  /api/                 # TickTick API client
  /config/              # Configuration management
  /project/             # .ticktick file operations
/mcp-server/            # TypeScript MCP server
  /src/
    /tools/             # MCP tool implementations
    /ticktick/          # TickTick API client (TypeScript)
```

## File Formats

**.ticktick file** (in project directories):
```json
{
  "projectId": "ticktick-project-id",
  "projectName": "Project Name",
  "folderPath": "/absolute/path/to/folder"
}
```

**~/.ticktick/config**:
```json
{
  "apiToken": "...",
  "defaultProject": "project-id"
}
```

## Common Workflows

### Building and Testing
Commands will be added as the project develops.

### TickTick API Integration
- API Reference: https://developer.ticktick.com/api
- Authentication: OAuth 2.0 or API token
- Rate limiting considerations apply

## Development Notes

- The Go CLI and TypeScript MCP server must maintain compatible interpretations of `.ticktick` files
- Changes to file schemas require updates in both codebases
- MCP server should provide "smart" operations (organize, prioritize, cleanup) beyond basic CRUD
