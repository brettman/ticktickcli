import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigManager } from '../lib/config.js';
import { TickTickClient } from '../lib/api-client.js';

export const configCommand = new Command('config')
  .description('Manage global configuration');

// Default project subcommand group
const defaultCommand = new Command('default')
  .description('Manage default project');

// config default set [project-id]
defaultCommand
  .command('set [project-id]')
  .description('Set the global default project (interactive if no ID provided)')
  .action(async (projectId?: string) => {
    try {
      // Load config and check auth
      const config = await ConfigManager.load();
      if (!ConfigManager.isAuthenticated(config)) {
        throw new Error('Not authenticated. Run \'ticktick auth login\' first');
      }

      // Create API client
      const client = new TickTickClient(config.auth.accessToken);

      let selectedProject;

      if (projectId) {
        // Direct mode - validate and set
        try {
          selectedProject = await client.getProject(projectId);

          if (selectedProject.closed) {
            console.log(chalk.yellow(`Warning: Project "${selectedProject.name}" is closed.`));
            console.log('You can still set it as default.\n');
          }
        } catch (error) {
          if ((error as Error).message.includes('Project not found')) {
            throw new Error(
              `Project not found: ${projectId}\n` +
              `Use 'ticktick projects list' to see available projects.\n` +
              `Tip: You can use short IDs (first 8-12 characters).`
            );
          }
          throw error;
        }
      } else {
        // Interactive mode - show project picker
        console.log('Fetching your projects...');
        const projects = await client.getProjects();
        const activeProjects = projects.filter(p => !p.closed);
        const closedProjects = projects.filter(p => p.closed);

        if (projects.length === 0) {
          throw new Error('No projects found. Create a project first.');
        }

        if (activeProjects.length === 0) {
          console.log(chalk.yellow('Warning: All your projects are closed.'));
          console.log('Showing closed projects...\n');
        } else if (closedProjects.length > 0) {
          console.log(chalk.gray(`Note: ${closedProjects.length} closed project(s) hidden. Use --project-id to set a closed project.\n`));
        }

        const projectsToShow = activeProjects.length > 0 ? activeProjects : projects;

        const { project } = await inquirer.prompt([
          {
            type: 'list',
            name: 'project',
            message: 'Select a default project:',
            choices: projectsToShow.map(p => ({
              name: `${p.name} ${chalk.gray(`(${p.id.slice(0, 12)})`)}`,
              value: p,
            })),
          },
        ]);

        selectedProject = project;
      }

      // Set the default project
      await ConfigManager.setPreference('defaultProject', selectedProject.id);

      console.log(chalk.green.bold('\n✓ Default project set successfully!'));
      console.log(`\nProject: ${chalk.cyan(selectedProject.name)} (${selectedProject.id.slice(0, 12)})`);
      console.log('\nAll commands will now use this project by default.');
      console.log('You can still override with:');
      console.log('  - .ticktick files in project directories');
      console.log('  - --project flag on any command');
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// config default clear
defaultCommand
  .command('clear')
  .description('Clear the global default project')
  .action(async () => {
    try {
      const config = await ConfigManager.load();

      if (!config.preferences.defaultProject) {
        console.log(chalk.yellow('No default project is currently set.'));
        return;
      }

      // Get project name before clearing (for confirmation message)
      let projectName = 'Unknown';
      if (ConfigManager.isAuthenticated(config)) {
        try {
          const client = new TickTickClient(config.auth.accessToken);
          const project = await client.getProject(config.preferences.defaultProject);
          projectName = project.name;
        } catch (error) {
          // Ignore errors fetching project name
        }
      }

      // Clear the default project
      delete config.preferences.defaultProject;
      await ConfigManager.save(config);

      console.log(chalk.green('✓ Default project cleared successfully!'));
      console.log(`\nRemoved: ${chalk.gray(projectName)}`);
      console.log('\nYou\'ll need to use .ticktick files or --project flag for commands.');
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// config default show
defaultCommand
  .command('show')
  .description('Show the current default project')
  .action(async () => {
    try {
      const config = await ConfigManager.load();

      if (!config.preferences.defaultProject) {
        console.log(chalk.yellow('No default project is set.'));
        console.log('\nSet one with: ticktick config default set');
        return;
      }

      console.log(chalk.cyan.bold('\nDefault Project:\n'));

      // Try to fetch project details
      if (ConfigManager.isAuthenticated(config)) {
        try {
          const client = new TickTickClient(config.auth.accessToken);
          const project = await client.getProject(config.preferences.defaultProject);

          console.log(`  Name:   ${chalk.white(project.name)}`);
          console.log(`  ID:     ${chalk.gray(project.id)}`);
          console.log(`  Status: ${project.closed ? chalk.yellow('Closed') : chalk.green('Active')}`);
        } catch (error) {
          console.log(`  ID:     ${chalk.gray(config.preferences.defaultProject)}`);
          console.log(`  Status: ${chalk.red('Unable to fetch details (project may not exist)')}`);
        }
      } else {
        console.log(`  ID:     ${chalk.gray(config.preferences.defaultProject)}`);
        console.log(`  Status: ${chalk.yellow('Not authenticated - cannot fetch details')}`);
      }

      console.log();
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Register default subcommand group
configCommand.addCommand(defaultCommand);

// config show - Show all configuration
configCommand
  .command('show')
  .description('Show all configuration settings')
  .action(async () => {
    try {
      const config = await ConfigManager.load();

      console.log(chalk.cyan.bold('\n=== Configuration ===\n'));

      // Authentication section
      console.log(chalk.yellow('Authentication:'));
      const isAuthenticated = ConfigManager.isAuthenticated(config);
      const isExpired = ConfigManager.isTokenExpired(config);

      console.log(`  Status:       ${isAuthenticated ? chalk.green('✓ Authenticated') : chalk.red('✗ Not authenticated')}`);

      if (isAuthenticated) {
        console.log(`  Client ID:    ${config.auth.clientId}`);
        if (config.auth.expiry) {
          const expiry = new Date(config.auth.expiry);
          console.log(`  Token Expiry: ${expiry.toLocaleString()}`);
          if (isExpired) {
            console.log(`  ${chalk.yellow('⚠ Token is expired - will refresh on next API call')}`);
          }
        }
      }

      // Preferences section
      console.log(chalk.yellow('\nPreferences:'));

      if (config.preferences.defaultProject) {
        // Try to fetch project name
        let projectDisplay = config.preferences.defaultProject.slice(0, 12);
        if (isAuthenticated && !isExpired) {
          try {
            const client = new TickTickClient(config.auth.accessToken);
            const project = await client.getProject(config.preferences.defaultProject);
            projectDisplay = `${project.name} (${project.id.slice(0, 12)})`;
          } catch (error) {
            projectDisplay = `${config.preferences.defaultProject.slice(0, 12)} ${chalk.red('(not found)')}`;
          }
        }
        console.log(`  Default Project:  ${projectDisplay}`);
      } else {
        console.log(`  Default Project:  ${chalk.gray('(not set)')}`);
      }

      console.log(`  Date Format:      ${config.preferences.dateFormat}`);
      console.log(`  Time Format:      ${config.preferences.timeFormat}`);
      console.log(`  Default Priority: ${config.preferences.defaultPriority}`);
      console.log(`  Color Output:     ${config.preferences.colorOutput ? chalk.green('enabled') : chalk.gray('disabled')}`);

      // Cache section
      console.log(chalk.yellow('\nCache:'));
      console.log(`  Enabled:          ${config.cache.enabled ? chalk.green('yes') : chalk.gray('no')}`);
      console.log(`  TTL:              ${config.cache.ttl} seconds`);

      console.log();
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });
