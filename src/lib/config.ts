import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { Config, AuthConfig } from '../types/index.js';

const CONFIG_DIR_NAME = '.ticktick';
const CONFIG_FILE_NAME = 'config';

export class ConfigManager {
  private static getConfigDir(): string {
    return path.join(os.homedir(), CONFIG_DIR_NAME);
  }

  private static getConfigPath(): string {
    return path.join(this.getConfigDir(), CONFIG_FILE_NAME);
  }

  static getDefaultConfig(): Config {
    return {
      version: '1.0',
      auth: {
        clientId: '',
        clientSecret: '',
        accessToken: '',
        refreshToken: '',
        expiry: '',
      },
      preferences: {
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '24h',
        defaultPriority: 0,
        colorOutput: true,
      },
      cache: {
        enabled: true,
        ttl: 300, // 5 minutes
      },
    };
  }

  static async load(): Promise<Config> {
    try {
      const configPath = this.getConfigPath();
      const data = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(data) as Config;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Config doesn't exist, return default
        return this.getDefaultConfig();
      }
      throw new Error(`Failed to load config: ${(error as Error).message}`);
    }
  }

  static async save(config: Config): Promise<void> {
    try {
      const configDir = this.getConfigDir();
      const configPath = this.getConfigPath();

      // Create config directory if it doesn't exist
      await fs.mkdir(configDir, { recursive: true, mode: 0o700 });

      // Write config file
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), {
        mode: 0o600,
      });
    } catch (error) {
      throw new Error(`Failed to save config: ${(error as Error).message}`);
    }
  }

  static async updateAuth(
    clientId: string,
    clientSecret: string,
    accessToken: string,
    refreshToken: string,
    expiry: Date
  ): Promise<void> {
    const config = await this.load();
    config.auth = {
      clientId,
      clientSecret,
      accessToken,
      refreshToken,
      expiry: expiry.toISOString(),
    };
    await this.save(config);
  }

  static async clearAuth(): Promise<void> {
    const config = await this.load();
    config.auth = {
      clientId: '',
      clientSecret: '',
      accessToken: '',
      refreshToken: '',
      expiry: '',
    };
    await this.save(config);
  }

  static isAuthenticated(config: Config): boolean {
    return !!(config.auth.accessToken && config.auth.refreshToken);
  }

  static isTokenExpired(config: Config): boolean {
    if (!config.auth.expiry) return true;
    return new Date() > new Date(config.auth.expiry);
  }

  static async setPreference(key: string, value: string): Promise<void> {
    const config = await this.load();
    switch (key) {
      case 'defaultProject':
        config.preferences.defaultProject = value;
        break;
      case 'dateFormat':
        config.preferences.dateFormat = value;
        break;
      case 'timeFormat':
        if (value === '12h' || value === '24h') {
          config.preferences.timeFormat = value;
        } else {
          throw new Error('timeFormat must be "12h" or "24h"');
        }
        break;
      case 'colorOutput':
        config.preferences.colorOutput = value === 'true';
        break;
      default:
        throw new Error(`Unknown preference key: ${key}`);
    }
    await this.save(config);
  }

  static async getPreference(key: string): Promise<string> {
    const config = await this.load();
    switch (key) {
      case 'defaultProject':
        return config.preferences.defaultProject || '';
      case 'dateFormat':
        return config.preferences.dateFormat;
      case 'timeFormat':
        return config.preferences.timeFormat;
      case 'colorOutput':
        return config.preferences.colorOutput.toString();
      default:
        throw new Error(`Unknown preference key: ${key}`);
    }
  }
}
