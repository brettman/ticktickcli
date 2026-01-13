// Configuration types
export interface Config {
  version: string;
  auth: AuthConfig;
  preferences: Preferences;
  cache: CacheConfig;
}

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  expiry: string; // ISO date string
}

export interface Preferences {
  defaultProject?: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  defaultPriority: number;
  colorOutput: boolean;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // seconds
}

// .ticktick file type
export interface TickTickFile {
  version: string;
  projectId: string;
  projectName: string;
  folderPath: string;
  createdAt: string; // ISO date string
  syncedAt: string; // ISO date string
}

// TickTick API types
export interface Project {
  id: string;
  name: string;
  color?: string;
  viewMode?: string;
  sortOrder: number;
  closed: boolean;
  modifiedTime: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  priority: number;
  status: number; // 0 = open, 1 = in progress, 2 = completed
  isAllDay: boolean;
  startDate?: string;
  dueDate?: string;
  completedTime?: string;
  createdTime: string;
  modifiedTime: string;
  tags?: string[];
}

export interface CreateProjectRequest {
  name: string;
  color?: string;
  viewMode?: string;
}

export interface CreateTaskRequest {
  title: string;
  projectId: string;
  content?: string;
  dueDate?: string;
  priority?: number;
  tags?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  content?: string;
  dueDate?: string;
  priority?: number;
  tags?: string[];
}

// OAuth types
export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}
