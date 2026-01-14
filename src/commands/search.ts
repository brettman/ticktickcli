import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ConfigManager } from '../lib/config.js';
import { ProjectManager } from '../lib/project.js';
import { TickTickClient } from '../lib/api-client.js';
import type { Task } from '../types/index.js';

export const searchCommand = new Command('search')
  .description('Search for tasks')
  .argument('[query]', 'Search query (searches title and description)')
  .option('--tag <tags>', 'Filter by tags (comma-separated, matches any)')
  .option('--priority <level>', 'Filter by priority level', parseInt)
  .option('--all-projects', 'Search across all projects')
  .option('--format <type>', 'Output format: table, json, compact', 'table')
  .action(async (query, options) => {
    try {
      const config = await ConfigManager.load();
      if (!ConfigManager.isAuthenticated(config)) {
        throw new Error('Not authenticated. Run \'ticktick auth login\' first');
      }

      const client = new TickTickClient(config.auth.accessToken);

      let allTasks: Task[] = [];
      let projectNames: Map<string, string> = new Map();

      if (options.allProjects) {
        // Search across all projects
        console.log('Searching across all projects...');
        const projects = await client.getProjects();
        const activeProjects = projects.filter(p => !p.closed);

        for (const project of activeProjects) {
          const tasks = await client.getTasks(project.id);
          allTasks.push(...tasks);
          projectNames.set(project.id, project.name);
        }
      } else {
        // Search in current project only
        const ctx = await ProjectManager.getCurrentProjectContext();
        let projectId: string;
        let projectName: string;

        if (ctx) {
          projectId = ctx.file.projectId;
          projectName = ctx.file.projectName;
        } else if (config.preferences.defaultProject) {
          projectId = config.preferences.defaultProject;
          const project = await client.getProject(projectId);
          projectName = project.name;
        } else {
          throw new Error('No project specified. Run \'ticktick init\' or use --all-projects flag');
        }

        allTasks = await client.getTasks(projectId);
        projectNames.set(projectId, projectName);
      }

      // Apply filters
      let filteredTasks = allTasks;

      // Text search
      if (query) {
        const lowerQuery = query.toLowerCase();
        filteredTasks = filteredTasks.filter((task) => {
          const titleMatch = task.title.toLowerCase().includes(lowerQuery);
          const contentMatch = task.content?.toLowerCase().includes(lowerQuery);
          return titleMatch || contentMatch;
        });
      }

      // Tag filter
      if (options.tag) {
        const searchTags = options.tag.split(',').map((t: string) => t.trim().toLowerCase());
        filteredTasks = filteredTasks.filter((task) => {
          if (!task.tags || task.tags.length === 0) return false;
          const taskTags = task.tags.map(t => t.toLowerCase());
          return searchTags.some((searchTag: string) => taskTags.includes(searchTag));
        });
      }

      // Priority filter
      if (options.priority !== undefined) {
        filteredTasks = filteredTasks.filter((task) => task.priority === options.priority);
      }

      // Only show incomplete tasks
      filteredTasks = filteredTasks.filter((task) => task.status !== 2);

      if (filteredTasks.length === 0) {
        console.log(chalk.yellow('\nNo tasks found matching your search criteria.'));
        return;
      }

      // Output results
      switch (options.format) {
        case 'json':
          console.log(JSON.stringify(filteredTasks, null, 2));
          break;

        case 'compact':
          console.log(chalk.cyan.bold(`\nFound ${filteredTasks.length} task(s)\n`));
          for (const task of filteredTasks) {
            const shortId = task.id.slice(0, 8);
            const priority = task.priority ? `[P${task.priority}]` : '';
            const tags = task.tags && task.tags.length > 0 ? `#${task.tags.join(' #')}` : '';
            const projectName = projectNames.get(task.projectId) || 'Unknown';
            const projectLabel = options.allProjects ? chalk.gray(`[${projectName}]`) : '';

            console.log(`${shortId}: ${task.title} ${priority} ${tags} ${projectLabel}`);
          }
          break;

        case 'table':
        default:
          console.log(chalk.cyan.bold(`\nFound ${filteredTasks.length} task(s)\n`));

          const table = new Table({
            head: options.allProjects
              ? ['ID', 'Title', 'Project', 'Priority', 'Tags']
              : ['ID', 'Title', 'Priority', 'Tags'],
            style: { head: ['cyan'] },
            wordWrap: true,
            colWidths: options.allProjects
              ? [10, 35, 15, 10, 20]
              : [10, 50, 10, 20],
          });

          for (const task of filteredTasks) {
            const shortId = task.id.slice(0, 8);
            const priority = task.priority ? task.priority.toString() : '-';
            const tags = task.tags && task.tags.length > 0 ? task.tags.join(', ') : '-';
            const projectName = projectNames.get(task.projectId) || 'Unknown';

            if (options.allProjects) {
              table.push([shortId, task.title, projectName, priority, tags]);
            } else {
              table.push([shortId, task.title, priority, tags]);
            }
          }

          console.log(table.toString());
          break;
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });
