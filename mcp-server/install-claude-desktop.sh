#!/bin/bash

# TickTick MCP Server - Claude Desktop Installation Script
# This script automatically configures Claude Desktop to use the TickTick MCP server

set -e

echo "📦 TickTick MCP Server - Claude Desktop Setup"
echo "=============================================="
echo

# Get the absolute path to the MCP server
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MCP_SERVER_PATH="$SCRIPT_DIR/dist/index.js"

# Check if the MCP server is built
if [ ! -f "$MCP_SERVER_PATH" ]; then
    echo "❌ MCP server not found at: $MCP_SERVER_PATH"
    echo "Please run 'npm run build' first"
    exit 1
fi

echo "✓ Found MCP server at: $MCP_SERVER_PATH"
echo

# Determine Claude Desktop config path based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CONFIG_DIR="$HOME/Library/Application Support/Claude"
    CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    CONFIG_DIR="$APPDATA/Claude"
    CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
else
    echo "❌ Unsupported operating system: $OSTYPE"
    echo "Please manually configure Claude Desktop"
    exit 1
fi

echo "Claude Desktop config location: $CONFIG_FILE"
echo

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Check if config file exists
if [ -f "$CONFIG_FILE" ]; then
    echo "⚠️  Claude Desktop config file already exists"
    echo "Creating backup at: ${CONFIG_FILE}.backup"
    cp "$CONFIG_FILE" "${CONFIG_FILE}.backup"
    echo
fi

# Create or update config
cat > "$CONFIG_FILE" <<EOF
{
  "mcpServers": {
    "ticktick": {
      "command": "node",
      "args": [
        "$MCP_SERVER_PATH"
      ]
    }
  }
}
EOF

echo "✓ Claude Desktop configured successfully!"
echo
echo "Next steps:"
echo "1. Restart Claude Desktop"
echo "2. Verify you're authenticated with TickTick CLI: ticktick auth status"
echo "3. Start using TickTick in Claude Desktop conversations!"
echo
echo "Example:"
echo '  You: "Add a task to review the security policy"'
echo "  Claude: [Creates the task using TickTick MCP server]"
echo
