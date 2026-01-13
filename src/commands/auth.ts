import { Command } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { ConfigManager } from '../lib/config.js';
import { OAuthManager } from '../lib/auth.js';

dotenv.config();

export const authCommand = new Command('auth')
  .description('Manage authentication');

authCommand
  .command('login')
  .description('Authenticate with TickTick')
  .option('--client-id <id>', 'OAuth Client ID')
  .option('--client-secret <secret>', 'OAuth Client Secret')
  .action(async (options) => {
    try {
      // Get credentials from flags, env, or prompt
      let clientId = options.clientId || process.env.TICKTICK_CLIENT_ID || '';
      let clientSecret = options.clientSecret || process.env.TICKTICK_CLIENT_SECRET || '';

      if (!clientId || !clientSecret) {
        console.log(chalk.cyan('\nTip: Create a .env file with TICKTICK_CLIENT_ID and TICKTICK_CLIENT_SECRET to avoid entering these each time.\n'));

        if (!clientId) {
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          clientId = await new Promise<string>((resolve) => {
            rl.question('Enter Client ID: ', (answer) => {
              rl.close();
              resolve(answer);
            });
          });
        }

        if (!clientSecret) {
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          clientSecret = await new Promise<string>((resolve) => {
            rl.question('Enter Client Secret: ', (answer) => {
              rl.close();
              resolve(answer);
            });
          });
        }
      }

      if (!clientId || !clientSecret) {
        throw new Error('Both Client ID and Client Secret are required');
      }

      // Start OAuth flow
      const result = await OAuthManager.startOAuthFlow(clientId, clientSecret);

      // Calculate expiry
      const expiry = new Date(Date.now() + result.expiresIn * 1000);

      // Save credentials
      await ConfigManager.updateAuth(
        clientId,
        clientSecret,
        result.accessToken,
        result.refreshToken,
        expiry
      );

      console.log(chalk.green.bold('\n✓ Authentication successful!'));
      console.log(`Credentials saved to ~/.ticktick/config`);
      console.log(`Token expires: ${expiry.toLocaleString()}`);
    } catch (error) {
      console.error(chalk.red('Authentication failed:'), (error as Error).message);
      process.exit(1);
    }
  });

authCommand
  .command('status')
  .description('Check authentication status')
  .action(async () => {
    try {
      const config = await ConfigManager.load();

      if (!ConfigManager.isAuthenticated(config)) {
        console.log(chalk.yellow('✗ Not authenticated'));
        console.log('\nRun \'ticktick auth login\' to authenticate.');
        return;
      }

      console.log(chalk.green('✓ Authenticated'));
      console.log(`\nClient ID: ${config.auth.clientId}`);

      if (config.auth.expiry) {
        const expiry = new Date(config.auth.expiry);
        console.log(`Token expires: ${expiry.toLocaleString()}`);

        if (ConfigManager.isTokenExpired(config)) {
          console.log(chalk.yellow('\n⚠ Warning: Token is expired'));
          console.log('The token will be automatically refreshed on next API call.');
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

authCommand
  .command('logout')
  .description('Remove authentication credentials')
  .action(async () => {
    try {
      const config = await ConfigManager.load();

      if (!ConfigManager.isAuthenticated(config)) {
        console.log('Already logged out (no credentials found)');
        return;
      }

      await ConfigManager.clearAuth();

      console.log(chalk.green('✓ Successfully logged out'));
      console.log('Credentials removed from ~/.ticktick/config');
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });
