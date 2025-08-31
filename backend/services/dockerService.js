import { dockerManager } from '../config/docker.js';
import { Container } from '../models/Container.js';

export class DockerService {
  static async syncContainers() {
    try {
      console.log('🔄 Syncing containers with Docker...');
      
      // Get all containers from Docker
      const dockerContainers = await dockerManager.listContainers(true);
      
      // Get all containers from database
      const dbContainers = await Container.list({ limit: 1000 });
      
      let syncedCount = 0;
      let createdCount = 0;
      let updatedCount = 0;

      // Update existing containers with Docker status
      for (const dbContainer of dbContainers.containers) {
        const dockerContainer = dockerContainers.find(dc => 
          dc.dockerId === dbContainer.docker_id || 
          dc.name === dbContainer.name
        );

        if (dockerContainer) {
          // Update container status if different
          if (dbContainer.status !== dockerContainer.status) {
            await dbContainer.updateStatus(dockerContainer.status);
            updatedCount++;
          }

          // Update Docker ID if missing
          if (!dbContainer.docker_id && dockerContainer.dockerId) {
            await dbContainer.updateDockerId(dockerContainer.dockerId);
            updatedCount++;
          }

          syncedCount++;
        } else {
          // Container exists in DB but not in Docker - mark as stopped
          if (dbContainer.status !== 'stopped') {
            await dbContainer.updateStatus('stopped');
            await dbContainer.addLog('Container not found in Docker, marked as stopped', 'warning');
            updatedCount++;
          }
        }
      }

      // Find Docker containers not in database (optional - auto-import)
      for (const dockerContainer of dockerContainers) {
        const dbContainer = dbContainers.containers.find(dc => 
          dc.docker_id === dockerContainer.dockerId ||
          dc.name === dockerContainer.name
        );

        if (!dbContainer && dockerContainer.labels && dockerContainer.labels['nexus-crate-flow'] === 'true') {
          // Auto-import containers with our label
          try {
            const newContainer = await Container.create({
              name: dockerContainer.name,
              image: dockerContainer.image,
              folder_path: `/home/containers/${dockerContainer.name}`
            }, 1); // Default to admin user

            await newContainer.updateDockerId(dockerContainer.dockerId);
            await newContainer.updateStatus(dockerContainer.status);
            await newContainer.addLog('Container auto-imported from Docker', 'info');
            
            createdCount++;
          } catch (error) {
            console.error(`Failed to auto-import container ${dockerContainer.name}:`, error);
          }
        }
      }

      console.log(`✅ Container sync completed: ${syncedCount} synced, ${updatedCount} updated, ${createdCount} created`);
      
      return {
        synced: syncedCount,
        updated: updatedCount,
        created: createdCount,
        total_docker: dockerContainers.length,
        total_db: dbContainers.containers.length
      };

    } catch (error) {
      console.error('❌ Error syncing containers:', error);
      throw error;
    }
  }

  static async createAndStartContainer(containerData, userId) {
    try {
      console.log(`🚀 Creating container: ${containerData.name}`);

      // Create container in database first
      const container = await Container.create(containerData, userId);

      // Create Docker container with our label
      const dockerOptions = {
        ...containerData,
        name: container.name,
        labels: {
          'nexus-crate-flow': 'true',
          'nexus-crate-flow.container-id': container.id,
          'nexus-crate-flow.created-by': userId.toString()
        }
      };

      const dockerContainer = await dockerManager.createContainer(dockerOptions);

      // Update container with Docker ID
      await container.updateDockerId(dockerContainer.dockerId);
      await container.updateStatus('created');
      await container.addLog(`Container created with image ${containerData.image}`, 'info');

      // Start container if requested
      if (containerData.autoStart) {
        await dockerManager.startContainer(dockerContainer.dockerId);
        await container.updateStatus('running');
        await container.addLog('Container started automatically', 'info');
      }

      console.log(`✅ Container created successfully: ${container.name} (${container.id})`);

      return {
        container: container.toJSON(),
        docker_id: dockerContainer.dockerId,
        status: containerData.autoStart ? 'running' : 'created'
      };

    } catch (error) {
      console.error('❌ Error creating container:', error);
      throw error;
    }
  }

  static async executeScript(containerId, script, options = {}) {
    try {
      const container = await Container.findById(containerId);
      if (!container) {
        throw new Error('Container not found');
      }

      if (!container.docker_id) {
        throw new Error('Container has no Docker ID');
      }

      console.log(`📜 Executing script in container ${container.name}: ${script}`);

      await container.addLog(`Executing script: ${script}`, 'info');

      // Execute script in container
      const command = ['sh', '-c', script];
      const stream = await dockerManager.executeCommand(container.docker_id, command, options);

      let output = '';
      let error = '';

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          const data = chunk.toString();
          
          // Simple way to distinguish stdout from stderr
          if (data.includes('stderr') || data.includes('Error') || data.includes('error')) {
            error += data;
          } else {
            output += data;
          }

          // Log output in real-time
          if (options.logOutput !== false) {
            container.addLog(data.trim(), data.includes('error') ? 'error' : 'info').catch(console.error);
          }
        });

        stream.on('end', async () => {
          try {
            await container.addLog(`Script completed. Output: ${output.trim()}`, 'info');
            
            if (error.trim()) {
              await container.addLog(`Script errors: ${error.trim()}`, 'error');
            }

            resolve({
              success: !error.trim(),
              output: output.trim(),
              error: error.trim(),
              container_id: container.id
            });
          } catch (logError) {
            console.error('Error logging script completion:', logError);
            resolve({
              success: !error.trim(),
              output: output.trim(),
              error: error.trim(),
              container_id: container.id
            });
          }
        });

        stream.on('error', async (streamError) => {
          try {
            await container.addLog(`Script execution failed: ${streamError.message}`, 'error');
          } catch (logError) {
            console.error('Error logging script failure:', logError);
          }
          reject(streamError);
        });
      });

    } catch (error) {
      console.error('❌ Error executing script:', error);
      throw error;
    }
  }

  static async getContainerMetrics(containerId) {
    try {
      const container = await Container.findById(containerId);
      if (!container || !container.docker_id) {
        throw new Error('Container not found or has no Docker ID');
      }

      const stats = await dockerManager.getContainerStats(container.docker_id);
      const dockerInfo = await dockerManager.getContainer(container.docker_id);

      return {
        container_id: container.id,
        container_name: container.name,
        docker_id: container.docker_id,
        status: dockerInfo.status,
        running: dockerInfo.running,
        stats: {
          cpu_percent: stats.cpu,
          memory: stats.memory,
          network: stats.network,
          timestamp: stats.timestamp
        },
        uptime: dockerInfo.running ? new Date() - new Date(dockerInfo.created) : 0
      };

    } catch (error) {
      console.error('❌ Error getting container metrics:', error);
      throw error;
    }
  }

  static async cleanupOrphanedContainers() {
    try {
      console.log('🧹 Cleaning up orphaned containers...');

      const dbContainers = await Container.list({ limit: 1000 });
      let cleanedCount = 0;

      for (const container of dbContainers.containers) {
        if (container.docker_id) {
          try {
            // Try to get container info from Docker
            await dockerManager.getContainer(container.docker_id);
          } catch (error) {
            if (error.message.includes('No such container')) {
              // Container doesn't exist in Docker anymore
              await container.updateStatus('removed');
              await container.addLog('Container removed from Docker, status updated', 'warning');
              cleanedCount++;
            }
          }
        }
      }

      console.log(`✅ Cleanup completed: ${cleanedCount} orphaned containers updated`);
      return { cleaned: cleanedCount };

    } catch (error) {
      console.error('❌ Error cleaning up orphaned containers:', error);
      throw error;
    }
  }

  static async restartContainer(containerId, timeout = 10) {
    try {
      const container = await Container.findById(containerId);
      if (!container) {
        throw new Error('Container not found');
      }

      if (!container.docker_id) {
        throw new Error('Container has no Docker ID');
      }

      console.log(`🔄 Restarting container: ${container.name}`);

      await container.addLog('Container restart initiated', 'info');
      await dockerManager.restartContainer(container.docker_id, timeout);
      await container.updateStatus('running');
      await container.addLog('Container restarted successfully', 'info');

      // Execute startup script if configured
      if (container.startup_script) {
        setTimeout(async () => {
          try {
            await this.executeScript(containerId, container.startup_script, { logOutput: true });
          } catch (error) {
            console.error('Error executing startup script after restart:', error);
          }
        }, 2000); // Wait 2 seconds for container to be fully ready
      }

      return { success: true, status: 'running' };

    } catch (error) {
      const container = await Container.findById(containerId);
      if (container) {
        await container.addLog(`Container restart failed: ${error.message}`, 'error');
      }
      console.error('❌ Error restarting container:', error);
      throw error;
    }
  }

  static async monitorContainerHealth() {
    try {
      const dbContainers = await Container.list({ limit: 1000, status: 'running' });
      const healthChecks = [];

      for (const container of dbContainers.containers) {
        if (container.docker_id) {
          try {
            const dockerInfo = await dockerManager.getContainer(container.docker_id);
            
            if (!dockerInfo.running && container.status === 'running') {
              // Container should be running but isn't
              await container.updateStatus('stopped');
              await container.addLog('Container health check: status updated to stopped', 'warning');
              
              // Auto-restart if enabled
              const settings = await container.getSettings();
              if (settings && settings.auto_restart) {
                await container.addLog('Auto-restart enabled, attempting to restart container', 'info');
                try {
                  await this.restartContainer(container.id);
                } catch (restartError) {
                  await container.addLog(`Auto-restart failed: ${restartError.message}`, 'error');
                }
              }
            }

            healthChecks.push({
              container_id: container.id,
              name: container.name,
              expected_status: container.status,
              actual_status: dockerInfo.status,
              healthy: dockerInfo.running === (container.status === 'running')
            });

          } catch (error) {
            healthChecks.push({
              container_id: container.id,
              name: container.name,
              expected_status: container.status,
              actual_status: 'unknown',
              healthy: false,
              error: error.message
            });
          }
        }
      }

      return healthChecks;

    } catch (error) {
      console.error('❌ Error monitoring container health:', error);
      throw error;
    }
  }
}

export default DockerService;
