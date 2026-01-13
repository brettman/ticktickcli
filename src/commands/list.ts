import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ConfigManager } from '../lib/config.js';
import { ProjectManager } from '../lib/project.js';
import { TickTickClient } from '../lib/api-client.js';
import type { Task } from '../types/index.js';

export const listCommand = new Command('list')
  .description('List tasks')
  .option('--all', 'List tasks from all projects')
  .option('--project <id>', 'List tasks from specific project')
  .option('-f, --format <type>', 'Output format (table, json, compact)', 'table')
  .option('--priority <number>', 'Filter by priority (0-5)', parseInt)
  .action(async (options) => {
    try {
      const config = await ConfigManager.load();
      if (!ConfigManager.isAuthenticated(config)) {
        throw new Error('Not authenticated. Run \'ticktick auth login\' first');
      }

      const client = new TickTickClient(config.auth.accessToken);

      let tasks: Task[] = [];
      let projectName = '';

      if (options.all) {
        // Get all tasks from all projects
        const projects = await client.getProjects();
        for (const project of projects) {
          if (!project.closed) {
            const projectTasks = await client.getTasks(project.id);
            tasks.push(...projectTasks);
          }
        }
        projectName = 'All Projects';
      } else {
        // Get specific project
        let projectId = options.project;
        if (!projectId) {
          const ctx = await ProjectManager.getCurrentProjectContext();
          if (ctx) {
            projectId = ctx.file.projectId;
            projectName = ctx.file.projectName;
          } else if (config.preferences.defaultProject) {
            projectId = config.preferences.defaultProject;
            const project = await client.getProject(projectId);
            projectName = project.name;
          } else {
            throw new Error('No project specified. Run \'ticktick init\' or use --project or --all flag');
          }
        } else {
          const project = await client.getProject(projectId);
          projectName = project.name;
        }

        tasks = await client.getTasks(projectId);
      }

      // Filter tasks
      tasks = tasks.filter(t => t.status !== 2); // Exclude completed
      if (options.priority !== undefined) {
        tasks = tasks.filter(t => t.priority === options.priority);
      }

      if (tasks.length === 0) {
        console.log(chalk.yellow('No tasks found.'));
        return;
      }

      // Output based on format
      switch (options.format) {
        case 'json':
          console.log(JSON.stringify(tasks, null, 2));
          break;
        case 'compact':
          outputCompact(tasks, projectName);
          break;
        default:
          outputTable(tasks, projectName);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

function outputTable(tasks: Task[], projectName: string) {
  console.log(chalk.cyan.bold(`\n${projectName} - ${tasks.length} task(s)\n`));

  const table = new Table({
    head: ['ID', 'Title', 'Priority', 'Due Date', 'Tags'],
    style: { head: ['cyan'] },
  });

  for (const task of tasks) {
    const shortId = task.id.slice(0, 8);
    const title = task.title.length > 50 ? task.title.slice(0, 47) + '...' : task.title;
    const priority = task.priority || '-';
    const dueDate = task.dueDate || '-';
    const tags = task.tags && task.tags.length ? task.tags.join(', ') : '-';

    table.push([shortId, title, priority, dueDate, tags]);
  }

  console.log(table.toString());
}

function outputCompact(tasks: Task[], projectName: string) {
  console.log(chalk.cyan.bold(`${projectName} - ${tasks.length} task(s)\n`));

  for (const task of tasks) {
    const shortId = task.id.slice(0, 8);
    const priority = task.priority ? ` [P${task.priority}]` : '';
    const due = task.dueDate ? ` (due: ${task.dueDate})` : '';
    const tags = task.tags && task.tags.length ? ` #${task.tags.join(' #')}` : '';

    console.log(`${shortId}: ${task.title}${priority}${due}${tags}`);
  }
}
