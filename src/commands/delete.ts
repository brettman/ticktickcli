import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigManager } from '../lib/config.js';
import { ProjectManager } from '../lib/project.js';
import { TickTickClient } from '../lib/api-client.js';

export const deleteCommand = new Command('delete')
  .description('Delete a task')
  .argument('<task-id>', 'Task ID (full or short ID)')
  .option('--project <id>', 'Project ID (overrides .ticktick file)')
  .option('-f, --force', 'Skip confirmation prompt')
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

      // Confirm deletion unless --force
      if (!options.force) {
        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `Delete task '${task.title}'?`,
            default: false,
          },
        ]);

        if (!confirmed) {
          console.log('Deletion cancelled.');
          return;
        }
      }

      // Delete task
      await client.deleteTask(projectId, task.id);

      console.log(chalk.green.bold('✓ Task deleted!'));
      console.log(`\nTask: ${task.title}`);
      console.log(`ID: ${task.id}`);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });
