import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigManager } from '../lib/config.js';
import { ProjectManager } from '../lib/project.js';
import { TickTickClient } from '../lib/api-client.js';
import type { UpdateTaskRequest } from '../types/index.js';

export const updateCommand = new Command('update')
  .description('Update an existing task')
  .argument('<task-id>', 'Task ID (full or short ID)')
  .option('--title <text>', 'Update task title')
  .option('--desc <text>', 'Update task description')
  .option('--priority <level>', 'Update priority (0-5: 0=none, 1=low, 3=medium, 5=high)', parseInt)
  .option('--due <date>', 'Update due date (YYYY-MM-DD format)')
  .option('--tags <tags>', 'Update tags (comma-separated)')
  .option('--clear-desc', 'Clear the task description')
  .option('--clear-due', 'Clear the due date')
  .option('--clear-tags', 'Clear all tags')
  .option('--project <id>', 'Project ID (overrides .ticktick file)')
  .action(async (taskId, options) => {
    try {
      const config = await ConfigManager.load();
      if (!ConfigManager.isAuthenticated(config)) {
        throw new Error('Not authenticated. Run \'ticktick auth login\' first');
      }

      // Determine project
      let projectId = options.project;
      if (!projectId) {
        const ctx = await ProjectManager.getCurrentProjectContext();
        if (ctx) {
          projectId = ctx.file.projectId;
        } else if (config.preferences.defaultProject) {
          projectId = config.preferences.defaultProject;
        } else {
          throw new Error('No project specified. Run \'ticktick init\' or use --project flag');
        }
      }

      const client = new TickTickClient(config.auth.accessToken);

      // Find the task
      const task = await client.findTaskById(projectId, taskId);
      if (!task) {
        throw new Error(`Task not found with ID: ${taskId}`);
      }

      // Check if any options were provided
      const hasOptions = options.title || options.desc || options.priority !== undefined ||
                        options.due || options.tags || options.clearDesc ||
                        options.clearDue || options.clearTags;

      // Build update request from provided options
      const updateReq: UpdateTaskRequest = {};
      let hasChanges = false;

      if (!hasOptions) {
        // Interactive mode - show current task and prompt for changes
        console.log(chalk.cyan('\n✏️  Update task (interactive mode)\n'));
        console.log(chalk.gray('Current values:'));
        console.log(`  Title: ${task.title}`);
        console.log(`  Description: ${task.content || '(none)'}`);
        console.log(`  Priority: ${task.priority || 0}`);
        console.log(`  Due Date: ${task.dueDate || '(none)'}`);
        console.log(`  Tags: ${task.tags && task.tags.length > 0 ? task.tags.join(', ') : '(none)'}`);
        console.log();

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'title',
            message: 'New title (leave empty to keep current):',
            default: '',
          },
          {
            type: 'input',
            name: 'content',
            message: 'New description (leave empty to keep current, type "clear" to remove):',
            default: '',
          },
          {
            type: 'list',
            name: 'priority',
            message: 'New priority:',
            choices: [
              { name: `Keep current (${task.priority || 0})`, value: null },
              { name: 'None', value: 0 },
              { name: 'Low', value: 1 },
              { name: 'Medium', value: 3 },
              { name: 'High', value: 5 },
            ],
            default: null,
          },
          {
            type: 'input',
            name: 'dueDate',
            message: 'New due date (YYYY-MM-DD, leave empty to keep current, type "clear" to remove):',
            default: '',
            validate: (input: string) => {
              if (!input || input.toLowerCase() === 'clear') return true;
              const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
              return dateRegex.test(input) || 'Date must be in YYYY-MM-DD format';
            },
          },
          {
            type: 'input',
            name: 'tags',
            message: 'New tags (comma-separated, leave empty to keep current, type "clear" to remove):',
            default: '',
          },
        ]);

        if (answers.title) {
          updateReq.title = answers.title;
          hasChanges = true;
        }

        if (answers.content) {
          if (answers.content.toLowerCase() === 'clear') {
            updateReq.content = '';
          } else {
            updateReq.content = answers.content;
          }
          hasChanges = true;
        }

        if (answers.priority !== null) {
          updateReq.priority = answers.priority;
          hasChanges = true;
        }

        if (answers.dueDate) {
          if (answers.dueDate.toLowerCase() === 'clear') {
            updateReq.dueDate = '';
          } else {
            updateReq.dueDate = answers.dueDate;
          }
          hasChanges = true;
        }

        if (answers.tags) {
          if (answers.tags.toLowerCase() === 'clear') {
            updateReq.tags = [];
          } else {
            updateReq.tags = answers.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
          }
          hasChanges = true;
        }

        if (!hasChanges) {
          console.log(chalk.yellow('\nNo changes made.'));
          return;
        }
      } else {
        // Flag mode - process provided options
        if (options.title) {
          updateReq.title = options.title;
          hasChanges = true;
        }

        if (options.desc) {
          updateReq.content = options.desc;
          hasChanges = true;
        }

        if (options.clearDesc) {
          updateReq.content = '';
          hasChanges = true;
        }

        if (options.priority !== undefined) {
          if (options.priority < 0 || options.priority > 5) {
            throw new Error('Priority must be between 0 and 5');
          }
          updateReq.priority = options.priority;
          hasChanges = true;
        }

        if (options.due) {
          // Validate date format
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(options.due)) {
            throw new Error('Due date must be in YYYY-MM-DD format');
          }
          updateReq.dueDate = options.due;
          hasChanges = true;
        }

        if (options.clearDue) {
          updateReq.dueDate = '';
          hasChanges = true;
        }

        if (options.tags) {
          updateReq.tags = options.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
          hasChanges = true;
        }

        if (options.clearTags) {
          updateReq.tags = [];
          hasChanges = true;
        }
      }

      // Update the task
      const updatedTask = await client.updateTask(task.id, projectId, updateReq);

      console.log(chalk.green.bold('\n✓ Task updated successfully!'));
      console.log(`\nTask: ${updatedTask.title}`);
      console.log(`ID: ${updatedTask.id}`);

      // Show what changed
      console.log(chalk.cyan('\nUpdated fields:'));
      if (updateReq.title) {
        console.log(`  Title: ${updateReq.title}`);
      }
      if (updateReq.content !== undefined) {
        console.log(`  Description: ${updateReq.content || '(cleared)'}`);
      }
      if (updateReq.priority !== undefined) {
        console.log(`  Priority: ${updateReq.priority}`);
      }
      if (updateReq.dueDate !== undefined) {
        console.log(`  Due Date: ${updateReq.dueDate || '(cleared)'}`);
      }
      if (updateReq.tags !== undefined) {
        console.log(`  Tags: ${updateReq.tags.length > 0 ? updateReq.tags.join(', ') : '(cleared)'}`);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });
