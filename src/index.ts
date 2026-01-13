#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { listCommand } from './commands/list.js';
import { completeCommand } from './commands/complete.js';
import { deleteCommand } from './commands/delete.js';
import { showCommand } from './commands/show.js';
import { projectsCommand } from './commands/projects.js';

const program = new Command();

program
  .name('ticktick')
  .description('TickTick CLI - Manage your tasks from the command line')
  .version('1.0.0');

// Register commands
program.addCommand(authCommand);
program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(listCommand);
program.addCommand(completeCommand);
program.addCommand(deleteCommand);
program.addCommand(showCommand);
program.addCommand(projectsCommand);

program.parse(process.argv);
