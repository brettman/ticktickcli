import fs from 'fs/promises';
import path from 'path';
import type { TickTickFile } from '../types/index.js';

const TICKTICK_FILE_NAME = '.ticktick';
const CURRENT_VERSION = '1.0';

export class ProjectManager {
  static createTickTickFile(
    projectId: string,
    projectName: string,
    folderPath: string
  ): TickTickFile {
    const now = new Date().toISOString();
    return {
      version: CURRENT_VERSION,
      projectId,
      projectName,
      folderPath,
      createdAt: now,
      syncedAt: now,
    };
  }

  static async load(filePath: string): Promise<TickTickFile> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const ttFile = JSON.parse(data) as TickTickFile;
      this.validate(ttFile);
      return ttFile;
    } catch (error) {
      throw new Error(`Failed to read .ticktick file: ${(error as Error).message}`);
    }
  }

  static async save(directory: string, ttFile: TickTickFile): Promise<void> {
    try {
      const filePath = path.join(directory, TICKTICK_FILE_NAME);
      await fs.writeFile(filePath, JSON.stringify(ttFile, null, 2), {
        mode: 0o644,
      });
    } catch (error) {
      throw new Error(`Failed to save .ticktick file: ${(error as Error).message}`);
    }
  }

  static validate(ttFile: TickTickFile): void {
    if (!ttFile.version) {
      throw new Error('.ticktick file: version is required');
    }
    if (!ttFile.projectId) {
      throw new Error('.ticktick file: projectId is required');
    }
    if (!ttFile.projectName) {
      throw new Error('.ticktick file: projectName is required');
    }
    if (!ttFile.folderPath) {
      throw new Error('.ticktick file: folderPath is required');
    }
  }

  static async updateSyncTime(filePath: string): Promise<void> {
    const ttFile = await this.load(filePath);
    ttFile.syncedAt = new Date().toISOString();
    const directory = path.dirname(filePath);
    await this.save(directory, ttFile);
  }

  static async findTickTickFile(startDir: string): Promise<string | null> {
    let current = path.resolve(startDir);

    while (true) {
      const ticktickPath = path.join(current, TICKTICK_FILE_NAME);

      try {
        await fs.access(ticktickPath);
        return ticktickPath;
      } catch {
        // File doesn't exist, continue up the tree
      }

      const parent = path.dirname(current);
      if (parent === current) {
        // Reached root
        return null;
      }
      current = parent;
    }
  }

  static async getCurrentProjectContext(): Promise<{
    file: TickTickFile;
    filePath: string;
  } | null> {
    const cwd = process.cwd();
    const filePath = await this.findTickTickFile(cwd);

    if (!filePath) {
      return null;
    }

    const file = await this.load(filePath);
    return { file, filePath };
  }

  static async hasTickTickFile(directory: string): Promise<boolean> {
    const ticktickPath = path.join(directory, TICKTICK_FILE_NAME);
    try {
      await fs.access(ticktickPath);
      return true;
    } catch {
      return false;
    }
  }
}
