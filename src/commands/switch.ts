import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import { ConfigManager } from '../lib/config.js';
import { ProjectManager } from '../lib/project.js';
import { TickTickClient } from '../lib/api-client.js';

export const switchCommand = new Command('switch')
  .description('Switch to a different project')
  .option('--project-id <id>', 'Switch to project by ID')
  .action(async (options) => {
    try {
      const cwd = process.cwd();

      // Check if .ticktick exists
      if (!await ProjectManager.hasTickTickFile(cwd)) {
        console.log(chalk.yellow('No .ticktick file found in this directory.'));
        console.log('Run \'ticktick init\' first to initialize a project.');
        process.exit(1);
      }

      // Show current project
      const currentCtx = await ProjectManager.getCurrentProjectContext();
      if (currentCtx) {
        console.log(`Current project: ${chalk.cyan(currentCtx.file.projectName)} (ID: ${currentCtx.file.projectId})\n`);
      }

      // Load config and check auth
      const config = await ConfigManager.load();
      if (!ConfigManager.isAuthenticated(config)) {
        throw new Error('Not authenticated. Run \'ticktick auth login\' first');
      }

      // Create API client
      const client = new TickTickClient(config.auth.accessToken);

      let selectedProject;

      if (options.projectId) {
        // Switch to specific project by ID
        console.log(`Fetching project: ${options.projectId}`);
        selectedProject = await client.getProject(options.projectId);
      } else {
        // Interactive selection
        console.log('Fetching your projects...');
        const projects = await client.getProjects();
        const activeProjects = projects.filter(p => !p.closed);

        if (activeProjects.length === 0) {
          throw new Error('No active projects found.');
        }

        const { project } = await inquirer.prompt([
          {
            type: 'list',
            name: 'project',
            message: 'Select a project to switch to:',
            choices: activeProjects.map(p => ({
              name: p.name,
              value: p,
            })),
          },
        ]);

        selectedProject = project;
      }

      // Update .ticktick file
      const absPath = path.resolve(cwd);
      const ttFile = ProjectManager.createTickTickFile(
        selectedProject.id,
        selectedProject.name,
        absPath
      );

      await ProjectManager.save(cwd, ttFile);

      console.log(chalk.green.bold('\n✓ Successfully switched project!'));
      console.log(`\nNew project: ${chalk.cyan(selectedProject.name)} (ID: ${selectedProject.id})`);
      console.log(`Directory: ${absPath}`);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });
