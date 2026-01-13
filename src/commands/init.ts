import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import { ConfigManager } from '../lib/config.js';
import { ProjectManager } from '../lib/project.js';
import { TickTickClient } from '../lib/api-client.js';

export const initCommand = new Command('init')
  .description('Initialize a project with TickTick')
  .option('--project-id <id>', 'Link to existing project by ID')
  .option('--create <name>', 'Create new project with this name')
  .action(async (options) => {
    try {
      const cwd = process.cwd();

      // Check if .ticktick already exists
      if (await ProjectManager.hasTickTickFile(cwd)) {
        throw new Error('.ticktick file already exists in this directory');
      }

      // Load config and check auth
      const config = await ConfigManager.load();
      if (!ConfigManager.isAuthenticated(config)) {
        throw new Error('Not authenticated. Run \'ticktick auth login\' first');
      }

      // Create API client
      const client = new TickTickClient(config.auth.accessToken);

      let selectedProject;

      if (options.create) {
        // Create new project
        console.log(`Creating new project: ${options.create}`);
        selectedProject = await client.createProject({ name: options.create });
        console.log(chalk.green(`✓ Created project: ${selectedProject.name}`));
      } else if (options.projectId) {
        // Link to existing project by ID
        console.log(`Fetching project: ${options.projectId}`);
        selectedProject = await client.getProject(options.projectId);
      } else {
        // Interactive selection
        console.log('Fetching your projects...');
        const projects = await client.getProjects();
        const activeProjects = projects.filter(p => !p.closed);

        if (activeProjects.length === 0) {
          throw new Error('No active projects found. Create one with --create flag');
        }

        const { project } = await inquirer.prompt([
          {
            type: 'list',
            name: 'project',
            message: 'Select a project to link:',
            choices: activeProjects.map(p => ({
              name: p.name,
              value: p,
            })),
          },
        ]);

        selectedProject = project;
      }

      // Create .ticktick file
      const absPath = path.resolve(cwd);
      const ttFile = ProjectManager.createTickTickFile(
        selectedProject.id,
        selectedProject.name,
        absPath
      );

      await ProjectManager.save(cwd, ttFile);

      console.log(chalk.green.bold('\n✓ Project initialized successfully!'));
      console.log(`\nProject: ${selectedProject.name} (ID: ${selectedProject.id})`);
      console.log(`Directory: ${absPath}`);
      console.log('\nYou can now use project-aware commands like:');
      console.log('  ticktick add "My task"');
      console.log('  ticktick list');
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });
