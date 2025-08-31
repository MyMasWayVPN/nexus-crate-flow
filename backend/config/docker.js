import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';

class DockerManager {
  constructor() {
    this.docker = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Try different connection methods based on environment
      const dockerOptions = this.getDockerOptions();
      
      this.docker = new Docker(dockerOptions);
      
      // Test connection
      await this.docker.ping();
      this.isConnected = true;
      
      console.log('✅ Connected to Docker daemon');
      
      // Log Docker info
      const info = await this.docker.info();
      console.log(`🐳 Docker version: ${info.ServerVersion}`);
      console.log(`📊 Containers: ${info.Containers} (${info.ContainersRunning} running)`);
      
      return this.docker;
    } catch (error) {
      console.error('❌ Failed to connect to Docker:', error.message);
      throw new Error(`Docker connection failed: ${error.message}`);
    }
  }

  getDockerOptions() {
    const socketPath = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';
    
    // Check if running on Windows
    if (process.platform === 'win32') {
      return {
        host: '127.0.0.1',
        port: 2375,
        protocol: 'http'
      };
    }
    
    // Unix socket (Linux/macOS)
    if (fs.existsSync(socketPath)) {
      return { socketPath };
    }
    
    // Fallback to TCP connection
    return {
      host: process.env.DOCKER_HOST || '127.0.0.1',
      port: process.env.DOCKER_PORT || 2376,
      protocol: process.env.DOCKER_PROTOCOL || 'http'
    };
  }

  async listContainers(all = true) {
    if (!this.isConnected) {
      throw new Error('Docker not connected');
    }

    try {
      const containers = await this.docker.listContainers({ all });
      return containers.map(container => ({
        id: container.Id.substring(0, 12),
        dockerId: container.Id,
        name: container.Names[0].replace('/', ''),
        image: container.Image,
        status: container.State,
        state: container.Status,
        ports: container.Ports,
        created: new Date(container.Created * 1000),
        labels: container.Labels || {}
      }));
    } catch (error) {
      console.error('❌ Error listing containers:', error);
      throw error;
    }
  }

  async getContainer(containerId) {
    if (!this.isConnected) {
      throw new Error('Docker not connected');
    }

    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      
      return {
        id: info.Id.substring(0, 12),
        dockerId: info.Id,
        name: info.Name.replace('/', ''),
        image: info.Config.Image,
        status: info.State.Status,
        running: info.State.Running,
        created: new Date(info.Created),
        config: info.Config,
        hostConfig: info.HostConfig,
        networkSettings: info.NetworkSettings,
        mounts: info.Mounts || []
      };
    } catch (error) {
      console.error(`❌ Error getting container ${containerId}:`, error);
      throw error;
    }
  }

  async createContainer(options) {
    if (!this.isConnected) {
      throw new Error('Docker not connected');
    }

    try {
      const containerOptions = {
        Image: options.image,
        name: options.name,
        Env: options.environment || [],
        WorkingDir: options.workingDir || '/app',
        Cmd: options.command ? options.command.split(' ') : undefined,
        ExposedPorts: {},
        HostConfig: {
          PortBindings: {},
          Binds: options.volumes || [],
          Memory: this.parseMemory(options.memory),
          CpuShares: this.parseCpu(options.cpu),
          RestartPolicy: {
            Name: options.restartPolicy || 'unless-stopped'
          }
        }
      };

      // Handle port mappings
      if (options.ports) {
        for (const [containerPort, hostPort] of Object.entries(options.ports)) {
          const portKey = `${containerPort}/tcp`;
          containerOptions.ExposedPorts[portKey] = {};
          containerOptions.HostConfig.PortBindings[portKey] = [{ HostPort: hostPort.toString() }];
        }
      }

      const container = await this.docker.createContainer(containerOptions);
      
      console.log(`✅ Container created: ${options.name} (${container.id.substring(0, 12)})`);
      
      return {
        id: container.id.substring(0, 12),
        dockerId: container.id,
        name: options.name
      };
    } catch (error) {
      console.error('❌ Error creating container:', error);
      throw error;
    }
  }

  async startContainer(containerId) {
    if (!this.isConnected) {
      throw new Error('Docker not connected');
    }

    try {
      const container = this.docker.getContainer(containerId);
      await container.start();
      
      console.log(`✅ Container started: ${containerId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error starting container ${containerId}:`, error);
      throw error;
    }
  }

  async stopContainer(containerId, timeout = 10) {
    if (!this.isConnected) {
      throw new Error('Docker not connected');
    }

    try {
      const container = this.docker.getContainer(containerId);
      await container.stop({ t: timeout });
      
      console.log(`✅ Container stopped: ${containerId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error stopping container ${containerId}:`, error);
      throw error;
    }
  }

  async restartContainer(containerId, timeout = 10) {
    if (!this.isConnected) {
      throw new Error('Docker not connected');
    }

    try {
      const container = this.docker.getContainer(containerId);
      await container.restart({ t: timeout });
      
      console.log(`✅ Container restarted: ${containerId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error restarting container ${containerId}:`, error);
      throw error;
    }
  }

  async removeContainer(containerId, force = false) {
    if (!this.isConnected) {
      throw new Error('Docker not connected');
    }

    try {
      const container = this.docker.getContainer(containerId);
      await container.remove({ force });
      
      console.log(`✅ Container removed: ${containerId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error removing container ${containerId}:`, error);
      throw error;
    }
  }

  async getContainerLogs(containerId, options = {}) {
    if (!this.isConnected) {
      throw new Error('Docker not connected');
    }

    try {
      const container = this.docker.getContainer(containerId);
      const logOptions = {
        stdout: true,
        stderr: true,
        timestamps: true,
        tail: options.tail || 100,
        since: options.since || 0,
        ...options
      };

      const stream = await container.logs(logOptions);
      return stream.toString('utf8');
    } catch (error) {
      console.error(`❌ Error getting logs for container ${containerId}:`, error);
      throw error;
    }
  }

  async executeCommand(containerId, command, options = {}) {
    if (!this.isConnected) {
      throw new Error('Docker not connected');
    }

    try {
      const container = this.docker.getContainer(containerId);
      
      const execOptions = {
        Cmd: Array.isArray(command) ? command : command.split(' '),
        AttachStdout: true,
        AttachStderr: true,
        Tty: options.tty || false,
        ...options
      };

      const exec = await container.exec(execOptions);
      const stream = await exec.start({ hijack: true, stdin: true });
      
      return stream;
    } catch (error) {
      console.error(`❌ Error executing command in container ${containerId}:`, error);
      throw error;
    }
  }

  async getContainerStats(containerId) {
    if (!this.isConnected) {
      throw new Error('Docker not connected');
    }

    try {
      const container = this.docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });
      
      return {
        cpu: this.calculateCpuPercent(stats),
        memory: this.calculateMemoryUsage(stats),
        network: this.calculateNetworkUsage(stats),
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`❌ Error getting stats for container ${containerId}:`, error);
      throw error;
    }
  }

  // Helper methods
  parseMemory(memory) {
    if (!memory) return 0;
    const units = { 'b': 1, 'k': 1024, 'm': 1024 * 1024, 'g': 1024 * 1024 * 1024 };
    const match = memory.toLowerCase().match(/^(\d+)([bkmg]?)$/);
    if (!match) return 0;
    return parseInt(match[1]) * (units[match[2]] || 1);
  }

  parseCpu(cpu) {
    if (!cpu) return 0;
    return Math.floor(parseFloat(cpu) * 1024);
  }

  calculateCpuPercent(stats) {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuCount = stats.cpu_stats.online_cpus || 1;
    
    if (systemDelta > 0 && cpuDelta > 0) {
      return (cpuDelta / systemDelta) * cpuCount * 100;
    }
    return 0;
  }

  calculateMemoryUsage(stats) {
    const usage = stats.memory_stats.usage || 0;
    const limit = stats.memory_stats.limit || 0;
    
    return {
      usage: usage,
      limit: limit,
      percent: limit > 0 ? (usage / limit) * 100 : 0
    };
  }

  calculateNetworkUsage(stats) {
    const networks = stats.networks || {};
    let rxBytes = 0;
    let txBytes = 0;
    
    for (const network of Object.values(networks)) {
      rxBytes += network.rx_bytes || 0;
      txBytes += network.tx_bytes || 0;
    }
    
    return { rxBytes, txBytes };
  }
}

// Singleton instance
const dockerManager = new DockerManager();

export async function initializeDocker() {
  await dockerManager.connect();
  return dockerManager;
}

export { dockerManager };
export default dockerManager;
