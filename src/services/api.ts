const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Authentication methods
  async login(username: string, password: string) {
    const response = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    this.token = response.token;
    localStorage.setItem('auth_token', response.token);
    
    return response;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.token = null;
      localStorage.removeItem('auth_token');
    }
  }

  async getProfile() {
    return this.request<any>('/auth/me');
  }

  async updateProfile(data: any) {
    return this.request<any>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<any>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Container methods
  async getContainers() {
    return this.request<any[]>('/containers');
  }

  async getContainer(id: string) {
    return this.request<any>(`/containers/${id}`);
  }

  async createContainer(data: any) {
    return this.request<any>('/containers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateContainer(id: string, data: any) {
    return this.request<any>(`/containers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteContainer(id: string) {
    return this.request<any>(`/containers/${id}`, {
      method: 'DELETE',
    });
  }

  async startContainer(id: string) {
    return this.request<any>(`/containers/${id}/start`, {
      method: 'POST',
    });
  }

  async stopContainer(id: string) {
    return this.request<any>(`/containers/${id}/stop`, {
      method: 'POST',
    });
  }

  async restartContainer(id: string) {
    return this.request<any>(`/containers/${id}/restart`, {
      method: 'POST',
    });
  }

  // Log methods
  async getContainerLogs(id: string, options: { lines?: number; since?: string } = {}) {
    const params = new URLSearchParams();
    if (options.lines) params.append('lines', options.lines.toString());
    if (options.since) params.append('since', options.since);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ logs: string[] }>(`/logs/${id}${query}`);
  }

  async clearContainerLogs(id: string) {
    return this.request<any>(`/logs/${id}`, {
      method: 'DELETE',
    });
  }

  async downloadContainerLogs(id: string) {
    const url = `${API_BASE_URL}/logs/${id}/download`;
    const response = await fetch(url, {
      headers: {
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to download logs');
    }
    
    return response.blob();
  }

  // File methods
  async getContainerFiles(id: string, path: string = '/') {
    const params = new URLSearchParams({ path });
    return this.request<any[]>(`/files/${id}?${params.toString()}`);
  }

  async readContainerFile(id: string, filePath: string) {
    const params = new URLSearchParams({ path: filePath });
    return this.request<{ content: string; path: string }>(`/files/${id}/read?${params.toString()}`);
  }

  async writeContainerFile(id: string, filePath: string, content: string) {
    return this.request<any>(`/files/${id}/write`, {
      method: 'POST',
      body: JSON.stringify({ path: filePath, content }),
    });
  }

  async deleteContainerFile(id: string, filePath: string) {
    const params = new URLSearchParams({ path: filePath });
    return this.request<any>(`/files/${id}?${params.toString()}`, {
      method: 'DELETE',
    });
  }

  async createContainerDirectory(id: string, dirPath: string) {
    return this.request<any>(`/files/${id}/create`, {
      method: 'POST',
      body: JSON.stringify({ path: dirPath, type: 'directory' }),
    });
  }

  async uploadContainerFile(id: string, file: File, path: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    const url = `${API_BASE_URL}/files/${id}/upload`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Upload failed');
    }

    return await response.json();
  }

  async downloadContainerFile(id: string, filePath: string) {
    const params = new URLSearchParams({ path: filePath });
    const url = `${API_BASE_URL}/files/${id}/download?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to download file');
    }
    
    return response.blob();
  }

  // Settings methods
  async getContainerSettings(id: string) {
    return this.request<any>(`/settings/${id}`);
  }

  async updateContainerSettings(id: string, settings: any) {
    return this.request<any>(`/settings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async updateStartupScript(id: string, script: string) {
    return this.request<any>(`/settings/${id}/startup-script`, {
      method: 'POST',
      body: JSON.stringify({ script }),
    });
  }

  async executeScript(id: string, script: string) {
    return this.request<any>(`/settings/${id}/execute-script`, {
      method: 'POST',
      body: JSON.stringify({ script }),
    });
  }

  async startTunnel(id: string) {
    return this.request<any>(`/settings/${id}/tunnel/start`, {
      method: 'POST',
    });
  }

  async stopTunnel(id: string) {
    return this.request<any>(`/settings/${id}/tunnel/stop`, {
      method: 'POST',
    });
  }

  // WebSocket connection for real-time logs
  createLogWebSocket(containerId: string): WebSocket {
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/logs/${containerId}/stream`;
    const ws = new WebSocket(wsUrl);
    
    // Send authentication token after connection
    ws.onopen = () => {
      if (this.token) {
        ws.send(JSON.stringify({
          type: 'authenticate',
          token: this.token
        }));
      }
      
      // Subscribe to container logs
      ws.send(JSON.stringify({
        type: 'subscribe_logs',
        container_id: containerId
      }));
    };
    
    return ws;
  }

  // Execute command via WebSocket
  executeCommand(containerId: string, command: string, workingDir: string = '/'): WebSocket {
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/logs/${containerId}/stream`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      if (this.token) {
        ws.send(JSON.stringify({
          type: 'authenticate',
          token: this.token
        }));
      }
      
      ws.send(JSON.stringify({
        type: 'execute_command',
        container_id: containerId,
        command,
        working_dir: workingDir
      }));
    };
    
    return ws;
  }

  // Health check
  async healthCheck() {
    const url = `${API_BASE_URL.replace('/api', '')}/health`;
    return fetch(url).then(res => res.json());
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Get current token
  getToken(): string | null {
    return this.token;
  }
}

export const apiService = new ApiService();
export default apiService;
