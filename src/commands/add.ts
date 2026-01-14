import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigManager } from '../lib/config.js';
import { ProjectManager } from '../lib/project.js';
import { TickTickClient } from '../lib/api-client.js';

export const addCommand = new Command('add')
  .description('Add a new task')
  .argument('[title]', 'Task title (interactive mode if not provided)')
  .option('--desc <text>', 'Task description/content (alias: --content)')
  .option('--content <text>', 'Task description/content (alias: --desc)')
  .option('--due <date>', 'Due date (YYYY-MM-DD)')
  .option('--priority <number>', 'Priority (0-5)', parseInt)
  .option('--tags <tags>', 'Task tags (comma-separated)')
  .option('--project <id>', 'Project ID (overrides .ticktick file)')
  .action(async (title, options) => {
    try {
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

      // Interactive mode if no title provided
      let taskTitle = title;
      let content = options.desc || options.content;
      let priority = options.priority;
      let dueDate = options.due;
      let tags: string[] | undefined = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined;

      if (!taskTitle) {
        console.log(chalk.cyan('\n📝 Create a new task (interactive mode)\n'));

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'title',
            message: 'Task title:',
            validate: (input: string) => input.trim().length > 0 || 'Title is required',
          },
          {
            type: 'input',
            name: 'content',
            message: 'Description (optional):',
          },
          {
            type: 'list',
            name: 'priority',
            message: 'Priority:',
            choices: [
              { name: 'None', value: 0 },
              { name: 'Low', value: 1 },
              { name: 'Medium', value: 3 },
              { name: 'High', value: 5 },
            ],
            default: 0,
          },
          {
            type: 'input',
            name: 'dueDate',
            message: 'Due date (YYYY-MM-DD, optional):',
            validate: (input: string) => {
              if (!input) return true;
              const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
              return dateRegex.test(input) || 'Date must be in YYYY-MM-DD format';
            },
          },
          {
            type: 'input',
            name: 'tags',
            message: 'Tags (comma-separated, optional):',
          },
        ]);

        taskTitle = answers.title;
        content = answers.content || undefined;
        priority = answers.priority;
        dueDate = answers.dueDate || undefined;
        tags = answers.tags ? answers.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined;
      }

      // Validate priority
      if (priority !== undefined && (priority < 0 || priority > 5)) {
        throw new Error('Priority must be between 0 and 5');
      }

      // Create API client
      const client = new TickTickClient(config.auth.accessToken);

      // Create task
      const task = await client.createTask({
        title: taskTitle,
        projectId,
        content,
        dueDate,
        priority,
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
