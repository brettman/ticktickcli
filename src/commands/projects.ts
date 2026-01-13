import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ConfigManager } from '../lib/config.js';
import { TickTickClient } from '../lib/api-client.js';
import type { Project } from '../types/index.js';

export const projectsCommand = new Command('projects')
  .description('Manage projects');

projectsCommand
  .command('list')
  .description('List all projects')
  .option('-f, --format <type>', 'Output format (table, json)', 'table')
  .action(async (options) => {
    try {
      const config = await ConfigManager.load();
      if (!ConfigManager.isAuthenticated(config)) {
        throw new Error('Not authenticated. Run \'ticktick auth login\' first');
      }

      const client = new TickTickClient(config.auth.accessToken);
      const projects = await client.getProjects();

      if (projects.length === 0) {
        console.log(chalk.yellow('No projects found.'));
        return;
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(projects, null, 2));
      } else {
        outputProjectsTable(projects);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

function outputProjectsTable(projects: Project[]) {
  console.log(chalk.cyan.bold(`\nYour Projects (${projects.length} total)\n`));

  const table = new Table({
    head: ['ID', 'Name', 'Status', 'Sort Order'],
    style: { head: ['cyan'] },
  });

  for (const project of projects) {
    const shortId = project.id.slice(0, 12);
    const status = project.closed ? 'Closed' : 'Active';

    table.push([shortId, project.name, status, project.sortOrder]);
  }

  console.log(table.toString());
}
