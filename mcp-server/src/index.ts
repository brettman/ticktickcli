#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigManager } from './lib/config.js';
import { ProjectManager } from './lib/project.js';
import { TickTickClient } from './lib/api-client.js';
import type { Task } from './types/index.js';

// Define available tools
const TOOLS: Tool[] = [
  {
    name: 'create_task',
    description: 'Create a new task in TickTick. If no project is specified, uses the current project from the working directory (.ticktick file).',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Task title (required)',
        },
        content: {
          type: 'string',
          description: 'Task description/content (optional)',
        },
        priority: {
          type: 'number',
          description: 'Priority level: 0=none, 1=low, 3=medium, 5=high (optional)',
          enum: [0, 1, 3, 5],
        },
        dueDate: {
          type: 'string',
          description: 'Due date in YYYY-MM-DD format (optional)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of tags (optional)',
        },
        projectId: {
          type: 'string',
          description: 'Project ID to create task in (optional, uses current project if not specified)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List all incomplete tasks in a project. If no project is specified, uses the current project from the working directory.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID to list tasks from (optional, uses current project if not specified)',
        },
        priority: {
          type: 'number',
          description: 'Filter by priority level (optional)',
          enum: [0, 1, 3, 5],
        },
      },
    },
  },
  {
    name: 'search_tasks',
    description: 'Search for tasks by text, tags, or priority. Can search across all projects or just the current project.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search text (searches in title and description)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags (matches any)',
        },
        priority: {
          type: 'number',
          description: 'Filter by priority level',
          enum: [0, 1, 3, 5],
        },
        allProjects: {
          type: 'boolean',
          description: 'Search across all projects (default: false, searches current project only)',
          default: false,
        },
      },
    },
  },
  {
    name: 'get_task',
    description: 'Get detailed information about a specific task by ID. Supports both full IDs and short IDs (first 8-12 characters).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID (full or short ID)',
        },
        projectId: {
          type: 'string',
          description: 'Project ID (optional, uses current project if not specified)',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing task. Only provided fields will be updated.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID (full or short ID)',
        },
        title: {
          type: 'string',
          description: 'New task title',
        },
        content: {
          type: 'string',
          description: 'New task description (use empty string to clear)',
        },
        priority: {
          type: 'number',
          description: 'New priority level',
          enum: [0, 1, 3, 5],
        },
        dueDate: {
          type: 'string',
          description: 'New due date in YYYY-MM-DD format (use empty string to clear)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'New tags (use empty array to clear)',
        },
        projectId: {
          type: 'string',
          description: 'Project ID (optional, uses current project if not specified)',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID (full or short ID)',
        },
        projectId: {
          type: 'string',
          description: 'Project ID (optional, uses current project if not specified)',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task permanently.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID (full or short ID)',
        },
        projectId: {
          type: 'string',
          description: 'Project ID (optional, uses current project if not specified)',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'get_projects',
    description: 'List all active TickTick projects.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_current_project',
    description: 'Get the current project linked to the working directory via .ticktick file.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Helper to get project ID from context or parameter
async function getProjectId(projectIdParam?: string): Promise<{ projectId: string; projectName?: string }> {
  if (projectIdParam) {
    return { projectId: projectIdParam };
  }

  // Try to get from current context
  const ctx = await ProjectManager.getCurrentProjectContext();
  if (ctx) {
    return {
      projectId: ctx.file.projectId,
      projectName: ctx.file.projectName,
    };
  }

  throw new Error('No project specified and no .ticktick file found in current directory');
}

// Format task for output
function formatTask(task: Task): string {
  const lines = [
    `**${task.title}**`,
    `ID: ${task.id.slice(0, 8)}`,
  ];

  if (task.content) {
    lines.push(`Description: ${task.content}`);
  }

  if (task.priority) {
    const priorityLabels: Record<number, string> = {
      1: 'Low',
      3: 'Medium',
      5: 'High',
    };
    lines.push(`Priority: ${priorityLabels[task.priority] || task.priority}`);
  }

  if (task.dueDate) {
    lines.push(`Due: ${task.dueDate}`);
  }

  if (task.tags && task.tags.length > 0) {
    lines.push(`Tags: ${task.tags.join(', ')}`);
  }

  return lines.join('\n');
}

// Create MCP server
const server = new Server(
  {
    name: 'ticktick-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    // Load config and check authentication
    const config = await ConfigManager.load();
    if (!ConfigManager.isAuthenticated(config)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Not authenticated with TickTick. Please run `ticktick auth login` first.',
          },
        ],
      };
    }

    const client = new TickTickClient(config.auth.accessToken);

    switch (request.params.name) {
      case 'create_task': {
        const { title, content, priority, dueDate, tags, projectId } = request.params.arguments as any;

        const { projectId: resolvedProjectId, projectName } = await getProjectId(projectId);

        const task = await client.createTask({
          title,
          projectId: resolvedProjectId,
          content,
          priority,
          dueDate,
          tags,
        });

        return {
          content: [
            {
              type: 'text',
              text: `✓ Task created successfully${projectName ? ` in project "${projectName}"` : ''}!\n\n${formatTask(task)}`,
            },
          ],
        };
      }

      case 'list_tasks': {
        const { projectId, priority } = request.params.arguments as any;

        const { projectId: resolvedProjectId, projectName } = await getProjectId(projectId);

        let tasks = await client.getTasks(resolvedProjectId);

        // Filter out completed tasks
        tasks = tasks.filter((t) => t.status !== 2);

        // Filter by priority if specified
        if (priority !== undefined) {
          tasks = tasks.filter((t) => t.priority === priority);
        }

        if (tasks.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No tasks found${projectName ? ` in project "${projectName}"` : ''}.`,
              },
            ],
          };
        }

        const taskList = tasks.map((task) => formatTask(task)).join('\n\n---\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${tasks.length} task(s)${projectName ? ` in "${projectName}"` : ''}:\n\n${taskList}`,
            },
          ],
        };
      }

      case 'search_tasks': {
        const { query, tags, priority, allProjects } = request.params.arguments as any;

        let allTasks: Task[] = [];

        if (allProjects) {
          const projects = await client.getProjects();
          const activeProjects = projects.filter((p) => !p.closed);

          for (const project of activeProjects) {
            const projectTasks = await client.getTasks(project.id);
            allTasks.push(...projectTasks);
          }
        } else {
          const { projectId: resolvedProjectId } = await getProjectId();
          allTasks = await client.getTasks(resolvedProjectId);
        }

        // Filter out completed tasks
        let filteredTasks = allTasks.filter((t) => t.status !== 2);

        // Apply text search
        if (query) {
          const lowerQuery = query.toLowerCase();
          filteredTasks = filteredTasks.filter((task) => {
            const titleMatch = task.title.toLowerCase().includes(lowerQuery);
            const contentMatch = task.content?.toLowerCase().includes(lowerQuery);
            return titleMatch || contentMatch;
          });
        }

        // Apply tag filter
        if (tags && tags.length > 0) {
          const searchTags = tags.map((t: string) => t.toLowerCase());
          filteredTasks = filteredTasks.filter((task) => {
            if (!task.tags || task.tags.length === 0) return false;
            const taskTags = task.tags.map((t) => t.toLowerCase());
            return searchTags.some((searchTag: string) => taskTags.includes(searchTag));
          });
        }

        // Apply priority filter
        if (priority !== undefined) {
          filteredTasks = filteredTasks.filter((task) => task.priority === priority);
        }

        if (filteredTasks.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No tasks found matching your search criteria.',
              },
            ],
          };
        }

        const taskList = filteredTasks.map((task) => formatTask(task)).join('\n\n---\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${filteredTasks.length} task(s):\n\n${taskList}`,
            },
          ],
        };
      }

      case 'get_task': {
        const { taskId, projectId } = request.params.arguments as any;

        const { projectId: resolvedProjectId } = await getProjectId(projectId);

        const task = await client.findTaskById(resolvedProjectId, taskId);

        if (!task) {
          return {
            content: [
              {
                type: 'text',
                text: `Task not found with ID: ${taskId}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: formatTask(task),
            },
          ],
        };
      }

      case 'update_task': {
        const { taskId, title, content, priority, dueDate, tags, projectId } = request.params.arguments as any;

        const { projectId: resolvedProjectId } = await getProjectId(projectId);

        const task = await client.findTaskById(resolvedProjectId, taskId);
        if (!task) {
          return {
            content: [
              {
                type: 'text',
                text: `Task not found with ID: ${taskId}`,
              },
            ],
          };
        }

        const updateReq: any = {};
        if (title !== undefined) updateReq.title = title;
        if (content !== undefined) updateReq.content = content;
        if (priority !== undefined) updateReq.priority = priority;
        if (dueDate !== undefined) updateReq.dueDate = dueDate;
        if (tags !== undefined) updateReq.tags = tags;

        const updatedTask = await client.updateTask(task.id, resolvedProjectId, updateReq);

        return {
          content: [
            {
              type: 'text',
              text: `✓ Task updated successfully!\n\n${formatTask(updatedTask)}`,
            },
          ],
        };
      }

      case 'complete_task': {
        const { taskId, projectId } = request.params.arguments as any;

        const { projectId: resolvedProjectId } = await getProjectId(projectId);

        const task = await client.findTaskById(resolvedProjectId, taskId);
        if (!task) {
          return {
            content: [
              {
                type: 'text',
                text: `Task not found with ID: ${taskId}`,
              },
            ],
          };
        }

        await client.completeTask(resolvedProjectId, task.id);

        return {
          content: [
            {
              type: 'text',
              text: `✓ Task completed: ${task.title}`,
            },
          ],
        };
      }

      case 'delete_task': {
        const { taskId, projectId } = request.params.arguments as any;

        const { projectId: resolvedProjectId } = await getProjectId(projectId);

        const task = await client.findTaskById(resolvedProjectId, taskId);
        if (!task) {
          return {
            content: [
              {
                type: 'text',
                text: `Task not found with ID: ${taskId}`,
              },
            ],
          };
        }

        await client.deleteTask(resolvedProjectId, task.id);

        return {
          content: [
            {
              type: 'text',
              text: `✓ Task deleted: ${task.title}`,
            },
          ],
        };
      }

      case 'get_projects': {
        const projects = await client.getProjects();
        const activeProjects = projects.filter((p) => !p.closed);

        if (activeProjects.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No active projects found.',
              },
            ],
          };
        }

        const projectList = activeProjects
          .map((p) => `- **${p.name}** (ID: ${p.id.slice(0, 12)})`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Your TickTick Projects (${activeProjects.length} total):\n\n${projectList}`,
            },
          ],
        };
      }

      case 'get_current_project': {
        const ctx = await ProjectManager.getCurrentProjectContext();

        if (!ctx) {
          return {
            content: [
              {
                type: 'text',
                text: 'No .ticktick file found in current directory or parent directories.',
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Current project: **${ctx.file.projectName}**\nID: ${ctx.file.projectId}\nDirectory: ${ctx.file.folderPath}`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${request.params.name}`,
            },
          ],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${(error as Error).message}`,
        },
      ],
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TickTick MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
