import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../lib/config.js';
import { ProjectManager } from '../lib/project.js';
import { TickTickClient } from '../lib/api-client.js';

export const completeCommand = new Command('complete')
  .description('Mark a task as complete')
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

      // Complete task
      await client.completeTask(projectId, task.id);

      console.log(chalk.green.bold('✓ Task completed!'));
      console.log(`\nTask: ${task.title}`);
      console.log(`ID: ${task.id}`);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });
