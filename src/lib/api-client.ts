import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Project,
  Task,
  CreateProjectRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
} from '../types/index.js';

const BASE_URL = 'https://api.ticktick.com/open/v1';

export class TickTickClient {
  private client: AxiosInstance;

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  // Project operations
  async getProjects(): Promise<Project[]> {
    try {
      const response = await this.client.get<Project[]>('/project');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getProject(id: string): Promise<Project> {
    try {
      const response = await this.client.get<Project>(`/project/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createProject(req: CreateProjectRequest): Promise<Project> {
    try {
      const response = await this.client.post<Project>('/project', req);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteProject(id: string): Promise<void> {
    try {
      await this.client.delete(`/project/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Task operations
  async getTasks(projectId: string): Promise<Task[]> {
    try {
      const response = await this.client.get(`/project/${projectId}/data`);
      // TickTick API returns tasks in an object with 'tasks' property
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      } else if (data && Array.isArray(data.tasks)) {
        return data.tasks;
      } else {
        console.error('Unexpected response format:', data);
        return [];
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getTask(projectId: string, taskId: string): Promise<Task> {
    try {
      const response = await this.client.get<Task>(
        `/project/${projectId}/task/${taskId}`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createTask(req: CreateTaskRequest): Promise<Task> {
    try {
      const response = await this.client.post<Task>('/task', req);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateTask(
    taskId: string,
    projectId: string,
    req: UpdateTaskRequest
  ): Promise<Task> {
    try {
      const response = await this.client.post<Task>(
        `/project/${projectId}/task/${taskId}`,
        req
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async completeTask(projectId: string, taskId: string): Promise<void> {
    try {
      await this.client.post(`/project/${projectId}/task/${taskId}/complete`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteTask(projectId: string, taskId: string): Promise<void> {
    try {
      await this.client.delete(`/project/${projectId}/task/${taskId}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Helper to find task by short or full ID
  async findTaskById(projectId: string, taskId: string): Promise<Task | null> {
    // First try as full ID
    try {
      return await this.getTask(projectId, taskId);
    } catch {
      // If that fails and it's a short ID, search through all tasks
      if (taskId.length <= 8) {
        const tasks = await this.getTasks(projectId);
        const found = tasks.find((t) => t.id.startsWith(taskId));
        return found || null;
      }
      return null;
    }
  }

  // Error handling
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      const status = axiosError.response?.status;
      const message = axiosError.response?.data?.errorMsg || axiosError.message;

      switch (status) {
        case 401:
          return new Error(
            `Authentication failed: ${message}. Run 'ticktick auth login'`
          );
        case 403:
          return new Error(`Permission denied: ${message}`);
        case 404:
          return new Error(`Resource not found: ${message}`);
        case 429:
          return new Error(`Rate limit exceeded: ${message}`);
        case 500:
        case 502:
        case 503:
        case 504:
          return new Error(
            `TickTick service error: ${message}. Please try again later.`
          );
        default:
          return new Error(`API error (${status}): ${message}`);
      }
    }

    return error as Error;
  }
}
