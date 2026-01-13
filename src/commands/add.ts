import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../lib/config.js';
import { ProjectManager } from '../lib/project.js';
import { TickTickClient } from '../lib/api-client.js';

export const addCommand = new Command('add')
  .description('Add a new task')
  .argument('<title>', 'Task title')
  .option('--content <text>', 'Task description/content')
  .option('--due <date>', 'Due date (YYYY-MM-DD)')
  .option('--priority <number>', 'Priority (0-5)', parseInt)
  .option('--tags <tags>', 'Task tags (comma-separated)')
  .option('--project <id>', 'Project ID (overrides .ticktick file)')
  .action(async (title, options) => {
    try {
      // Validate priority
      if (options.priority !== undefined && (options.priority < 0 || options.priority > 5)) {
        throw new Error('Priority must be between 0 and 5');
      }

      // Load config
      const config = await ConfigManager.load();
      if (!ConfigManager.isAuthenticated(config)) {
        throw new Error('Not authenticated. Run \'ticktick auth login\' first');
      }

      // Determine project
      let projectId = options.project;
      let projectName = '';

      if (!projectId) {
        const ctx = await ProjectManager.getCurrentProjectContext();
        if (ctx) {
          projectId = ctx.file.projectId;
          projectName = ctx.file.projectName;
          console.log(chalk.cyan(`Using project from .ticktick: ${projectName}`));
        } else if (config.preferences.defaultProject) {
          projectId = config.preferences.defaultProject;
          console.log('Using default project from config');
        } else {
          throw new Error('No project specified. Run \'ticktick init\' or use --project flag');
        }
      }

      // Create API client
      const client = new TickTickClient(config.auth.accessToken);

      // Parse tags
      const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined;

      // Create task
      const task = await client.createTask({
        title,
        projectId,
        content: options.content,
        dueDate: options.due,
        priority: options.priority,
        tags,
      });

      console.log(chalk.green.bold('\n✓ Task created successfully!'));
      console.log(`\nTitle: ${task.title}`);
      console.log(`ID: ${task.id}`);
      if (task.content) console.log(`Content: ${task.content}`);
      if (task.dueDate) console.log(`Due: ${task.dueDate}`);
      if (task.priority) console.log(`Priority: ${task.priority}`);
      if (task.tags && task.tags.length) console.log(`Tags: ${task.tags.join(', ')}`);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });
