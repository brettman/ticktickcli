# Recent Changes Summary

This document summarizes recent changes to the TickTick CLI for quick reference when restarting sessions.

## Latest Commits

### 1. Global Default Project Feature (Commit: 7bb78df)
**Date**: 2026-01-15

Added ability to set a global default project that works from any directory.

**New Commands**:
```bash
ticktick config default set          # Interactive project picker
ticktick config default set <id>     # Direct mode with project ID
ticktick config default show         # Show current default
ticktick config default clear        # Remove default
ticktick config show                 # Display all configuration
```

**Project Resolution Priority**:
1. Explicit `--project` flag (highest)
2. Local `.ticktick` file in current/parent directory
3. Global default from `~/.ticktick/config`
4. Error if none available

**Benefits**: Work from any directory without `.ticktick` files while maintaining project-specific contexts in directories that have them.

### 2. Fix .ticktick Directory Handling (Commit: 320df15)
**Date**: 2026-01-15

Fixed EISDIR error when `.ticktick` directories exist instead of files.

**Problem**: CLI tried to read `.ticktick` directories as files, causing:
```
Error: Failed to read .ticktick file: EISDIR: illegal operation on a directory, read
```

**Solution**: Updated `ProjectManager.findTickTickFile()` and `hasTickTickFile()` to use `fs.stat()` and verify `.ticktick` is a file before reading.

**Files Changed**: `src/lib/project.ts`

### 3. Global .env File Support (Uncommitted)
**Date**: 2026-01-15

Added support for storing OAuth credentials in a global location.

**New Feature**: CLI now checks `~/.ticktick/.env` for credentials before prompting.

**Credential Loading Order**:
1. Command-line flags: `--client-id`, `--client-secret`
2. **Global**: `~/.ticktick/.env` (recommended)
3. Local: `.env` in current directory (takes precedence if exists)
4. Interactive prompt

**Setup**:
```bash
cat > ~/.ticktick/.env << 'EOF'
TICKTICK_CLIENT_ID=your_client_id_here
TICKTICK_CLIENT_SECRET=your_client_secret_here
EOF
chmod 600 ~/.ticktick/.env
```

**Benefits**: Never enter credentials again, works across all projects.

**Files Changed**: `src/commands/auth.ts`

## Configuration Files

### ~/.ticktick/config
Main configuration file containing:
- Authentication tokens (after `ticktick auth login`)
- Preferences (dateFormat, timeFormat, defaultPriority, colorOutput, **defaultProject**)
- Cache settings

### ~/.ticktick/.env (NEW)
OAuth credentials (optional but recommended):
```
TICKTICK_CLIENT_ID=...
TICKTICK_CLIENT_SECRET=...
```

### .ticktick (project file)
Links a directory to a TickTick project:
```json
{
  "version": "1.0",
  "projectId": "685bbc9be5eed14be223875c",
  "projectName": "🚖Work",
  "folderPath": "/path/to/project",
  "createdAt": "2026-01-14T10:07:17.951Z",
  "syncedAt": "2026-01-14T10:07:17.951Z"
}
```

## Common Issues & Solutions

### Issue: "EISDIR: illegal operation on a directory, read"
**Cause**: `.ticktick` directory exists in parent path
**Fixed**: Commit 320df15 - CLI now skips directories during search

### Issue: "No project specified"
**Solutions**:
1. Set global default: `ticktick config default set`
2. Use `--project` flag: `ticktick list --project <id>`
3. Initialize project: `ticktick init` (creates `.ticktick` file)

### Issue: Prompted for credentials every time
**Solution**: Create `~/.ticktick/.env` with credentials (see setup above)

## Testing Checklist

Before considering work complete:
- [x] CLI builds: `npm run build`
- [x] Global default project works from any directory
- [x] Config commands work: `set`, `clear`, `show`
- [x] .ticktick directories are properly skipped
- [x] Global .env credentials are loaded
- [x] Three-tier resolution priority works correctly
- [x] Documentation updated in README.md and CLAUDE.md

## Next Session Startup

When restarting work:
1. Check current branch: `git status`
2. Review recent commits: `git log --oneline -5`
3. Check for uncommitted changes: `git diff`
4. Verify CLI builds: `npm run build`
5. Test basic functionality: `ticktick config show`

## Pending Work

- [ ] Commit and push global .env support (currently built but uncommitted)
- [ ] Test auth login flow with global .env
- [ ] Update MCP server if needed (shares same config)
