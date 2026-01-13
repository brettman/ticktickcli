import http from 'http';
import { URL } from 'url';
import crypto from 'crypto';
import open from 'open';
import chalk from 'chalk';
import axios from 'axios';

const AUTH_URL = 'https://ticktick.com/oauth/authorize';
const TOKEN_URL = 'https://ticktick.com/oauth/token';
const REDIRECT_URI = 'http://localhost:8080/callback';
const OAUTH_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export interface OAuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class OAuthManager {
  static async startOAuthFlow(
    clientId: string,
    clientSecret: string
  ): Promise<OAuthResult> {
    return new Promise((resolve, reject) => {
      const state = crypto.randomBytes(32).toString('base64url');
      let serverClosed = false;
      const connections = new Set<any>();

      // Create HTTP server for callback
      const server = http.createServer(async (req, res) => {
        if (req.url?.startsWith('/callback')) {
          try {
            const url = new URL(req.url, `http://localhost:8080`);
            const code = url.searchParams.get('code');
            const returnedState = url.searchParams.get('state');
            const error = url.searchParams.get('error');

            if (error) {
              const errorDesc = url.searchParams.get('error_description');
              res.writeHead(400, {
                'Content-Type': 'text/html',
                'Connection': 'close',
              });
              res.end(this.getErrorPage(error, errorDesc || ''));
              reject(new Error(`OAuth error: ${error} - ${errorDesc}`));
              setTimeout(() => {
                this.closeServer(server, connections);
                serverClosed = true;
              }, 100);
              return;
            }

            if (returnedState !== state) {
              res.writeHead(400, {
                'Content-Type': 'text/html',
                'Connection': 'close',
              });
              res.end(this.getErrorPage('Invalid state', 'Possible CSRF attack'));
              reject(new Error('Invalid state parameter'));
              setTimeout(() => {
                this.closeServer(server, connections);
                serverClosed = true;
              }, 100);
              return;
            }

            if (!code) {
              res.writeHead(400, {
                'Content-Type': 'text/html',
                'Connection': 'close',
              });
              res.end(this.getErrorPage('No code', 'No authorization code received'));
              reject(new Error('No authorization code received'));
              setTimeout(() => {
                this.closeServer(server, connections);
                serverClosed = true;
              }, 100);
              return;
            }

            // Show success page with Connection: close header
            res.writeHead(200, {
              'Content-Type': 'text/html',
              'Connection': 'close',
            });
            res.end(this.getSuccessPage());

            // Exchange code for token
            try {
              console.log(chalk.cyan('\nExchanging authorization code for access token...'));
              const result = await this.exchangeCodeForToken(
                clientId,
                clientSecret,
                code
              );

              // Give browser a moment to receive the response, then close
              setTimeout(() => {
                this.closeServer(server, connections);
                serverClosed = true;
              }, 100);

              resolve(result);
            } catch (error) {
              reject(error);
              this.closeServer(server, connections);
              serverClosed = true;
            }
          } catch (error) {
            res.writeHead(500, {
              'Content-Type': 'text/html',
              'Connection': 'close',
            });
            res.end(this.getErrorPage('Server Error', (error as Error).message));
            reject(error);
            setTimeout(() => {
              this.closeServer(server, connections);
              serverClosed = true;
            }, 100);
          }
        }
      });

      // Configure server to close connections quickly
      server.keepAliveTimeout = 1;
      server.headersTimeout = 1;

      // Track connections so we can force close them
      server.on('connection', (conn) => {
        connections.add(conn);
        conn.on('close', () => {
          connections.delete(conn);
        });
      });

      server.listen(8080, () => {
        console.log(chalk.cyan('Starting OAuth 2.0 authentication flow...\n'));

        // Build authorization URL
        const authUrl = new URL(AUTH_URL);
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('scope', 'tasks:read tasks:write');
        authUrl.searchParams.set('response_type', 'code');

        console.log('Opening browser for authorization...');
        console.log(`If the browser doesn't open, visit this URL:\n${authUrl.toString()}\n`);

        // Open browser
        open(authUrl.toString()).catch((err) => {
          console.log(chalk.yellow(`Failed to open browser automatically: ${err.message}`));
        });
      });

      // Set timeout
      setTimeout(() => {
        if (!serverClosed) {
          this.closeServer(server, connections);
          reject(new Error(`OAuth flow timed out after ${OAUTH_TIMEOUT / 1000} seconds`));
        }
      }, OAUTH_TIMEOUT);

      server.on('error', (err) => {
        reject(new Error(`Failed to start callback server: ${err.message}`));
      });
    });
  }

  private static async exchangeCodeForToken(
    clientId: string,
    clientSecret: string,
    code: string
  ): Promise<OAuthResult> {
    try {
      const response = await axios.post(
        TOKEN_URL,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: REDIRECT_URI,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          timeout: 30000,
        }
      );

      const data = response.data;

      if (data.error) {
        throw new Error(`OAuth error: ${data.error} - ${data.error_description}`);
      }

      if (!data.access_token) {
        throw new Error('No access token in response');
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in || 3600,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`
        );
      }
      throw error;
    }
  }

  private static closeServer(server: http.Server, connections: Set<any>): void {
    // Destroy all active connections
    for (const conn of connections) {
      conn.destroy();
    }
    connections.clear();

    // Close the server
    server.close();
  }

  private static getSuccessPage(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>TickTick CLI - Authorization Successful</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 3rem;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
          }
          h1 { color: #667eea; margin-bottom: 1rem; }
          p { color: #666; margin-bottom: 1.5rem; }
          .checkmark {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: block;
            stroke-width: 2;
            stroke: #4CAF50;
            stroke-miterlimit: 10;
            margin: 0 auto 2rem;
            box-shadow: inset 0px 0px 0px #4CAF50;
            animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both;
          }
          .checkmark__circle {
            stroke-dasharray: 166;
            stroke-dashoffset: 166;
            stroke-width: 2;
            stroke-miterlimit: 10;
            stroke: #4CAF50;
            fill: none;
            animation: stroke .6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
          }
          .checkmark__check {
            transform-origin: 50% 50%;
            stroke-dasharray: 48;
            stroke-dashoffset: 48;
            animation: stroke .3s cubic-bezier(0.65, 0, 0.45, 1) .8s forwards;
          }
          @keyframes stroke {
            100% { stroke-dashoffset: 0; }
          }
          @keyframes fill {
            100% { box-shadow: inset 0px 0px 0px 30px #4CAF50; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
          <h1>Authorization Successful!</h1>
          <p>You have successfully authorized the TickTick CLI.</p>
          <p>You can now close this window and return to your terminal.</p>
        </div>
      </body>
      </html>
    `;
  }

  private static getErrorPage(error: string, description: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>TickTick CLI - Authorization Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          }
          .container {
            background: white;
            padding: 3rem;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
          }
          h1 { color: #f5576c; margin-bottom: 1rem; }
          p { color: #666; margin-bottom: 1rem; }
          .error { color: #f5576c; font-family: monospace; background: #fee; padding: 1rem; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Authorization Failed</h1>
          <p class="error">${error}: ${description}</p>
          <p>Please close this window and try again in your terminal.</p>
        </div>
      </body>
      </html>
    `;
  }
}
