import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../lib/config.js';
import { ProjectManager } from '../lib/project.js';
import { TickTickClient } from '../lib/api-client.js';

export const showCommand = new Command('show')
  .description('Show task details')
  .argument('<task-id>', 'Task ID (full or short ID)')
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

      // Find task by ID
      const task = await client.findTaskById(projectId, taskId);
      if (!task) {
        throw new Error(`Task not found with ID: ${taskId}`);
      }

      // Display task details
      console.log(chalk.cyan.bold('\n=== Task Details ===\n'));
      console.log(`Title:      ${task.title}`);
      console.log(`ID:         ${task.id}`);
      console.log(`Project ID: ${task.projectId}`);

      if (task.content) {
        console.log(`\nContent:\n${task.content}`);
      }

      if (task.priority) {
        console.log(`\nPriority:   ${task.priority}`);
      }

      if (task.dueDate) {
        console.log(`Due Date:   ${task.dueDate}`);
      }

      if (task.startDate) {
        console.log(`Start Date: ${task.startDate}`);
      }

      if (task.tags && task.tags.length) {
        console.log(`\nTags:       ${task.tags.join(', ')}`);
      }

      // Status
      const statusMap: Record<number, string> = {
        0: 'Open',
        1: 'In Progress',
        2: 'Completed',
      };
      const status = statusMap[task.status] || 'Unknown';
      const statusColor = task.status === 2 ? chalk.blue : chalk.green;
      console.log(`\nStatus:     ${statusColor(status)}`);

      // Timestamps
      console.log(`\nCreated:    ${new Date(task.createdTime).toLocaleString()}`);
      console.log(`Modified:   ${new Date(task.modifiedTime).toLocaleString()}`);
      if (task.completedTime) {
        console.log(`Completed:  ${new Date(task.completedTime).toLocaleString()}`);
      }

      console.log();
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });
