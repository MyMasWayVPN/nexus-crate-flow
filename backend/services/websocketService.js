import jwt from 'jsonwebtoken';
import { Container } from '../models/Container.js';
import { dockerManager } from '../config/docker.js';
import { LogService } from './logService.js';

export class WebSocketService {
  constructor(wss) {
    this.wss = wss;
    this.clients = new Map(); // Map of client connections
    this.containerStreams = new Map(); // Map of container log streams
    this.logService = null;
  }

  initialize() {
    console.log('🔌 Initializing WebSocket service...');
    
    this.wss.on('connection', (ws, req) => {
      console.log('📡 New WebSocket connection');
      
      // Set up connection handlers
      this.setupConnection(ws, req);
    });

    // Initialize log service for real-time log streaming
    LogService.initialize().then(logService => {
      this.logService = logService;
      console.log('✅ WebSocket service initialized with log streaming');
    }).catch(error => {
      console.error('❌ Failed to initialize log service for WebSocket:', error);
    });
  }

  setupConnection(ws, req) {
    let clientId = null;
    let userId = null;
    let authenticated = false;
    let subscribedContainers = new Set();

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'authenticate':
            await this.handleAuthentication(ws, message, (id, user) => {
              clientId = id;
              userId = user;
              authenticated = true;
            });
            break;
            
          case 'subscribe_logs':
            if (authenticated) {
              await this.handleLogSubscription(ws, message, userId, subscribedContainers);
            } else {
              this.sendError(ws, 'Authentication required');
            }
            break;
            
          case 'unsubscribe_logs':
            if (authenticated) {
              await this.handleLogUnsubscription(ws, message, subscribedContainers);
            }
            break;
            
          case 'execute_command':
            if (authenticated) {
              await this.handleCommandExecution(ws, message, userId);
            } else {
              this.sendError(ws, 'Authentication required');
            }
            break;
            
          case 'get_container_status':
            if (authenticated) {
              await this.handleContainerStatus(ws, message, userId);
            } else {
              this.sendError(ws, 'Authentication required');
            }
            break;
            
          default:
            this.sendError(ws, 'Unknown message type');
        }
        
      } catch (error) {
        console.error('WebSocket message error:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    // Handle connection close
    ws.on('close', () => {
      console.log(`📡 WebSocket connection closed: ${clientId}`);
      
      if (clientId) {
        this.clients.delete(clientId);
      }
      
      // Clean up container subscriptions
      subscribedContainers.forEach(containerId => {
        this.unsubscribeFromContainerLogs(containerId, ws);
      });
    });

    // Handle connection errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: 'welcome',
      message: 'Connected to Nexus Crate Flow WebSocket server',
      timestamp: new Date().toISOString()
    });
  }

  async handleAuthentication(ws, message, callback) {
    try {
      const { token } = message;
      
      if (!token) {
        this.sendError(ws, 'Token required for authentication');
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store client connection
      this.clients.set(clientId, {
        ws,
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        connectedAt: new Date()
      });

      callback(clientId, decoded.userId);

      this.sendMessage(ws, {
        type: 'authenticated',
        client_id: clientId,
        user: {
          id: decoded.userId,
          username: decoded.username,
          role: decoded.role
        },
        timestamp: new Date().toISOString()
      });

      console.log(`✅ WebSocket client authenticated: ${decoded.username} (${clientId})`);

    } catch (error) {
      console.error('WebSocket authentication error:', error);
      this.sendError(ws, 'Authentication failed');
    }
  }

  async handleLogSubscription(ws, message, userId, subscribedContainers) {
    try {
      const { container_id } = message;
      
      if (!container_id) {
        this.sendError(ws, 'Container ID required');
        return;
      }

      // Check if container exists and user has access
      const container = await Container.findById(container_id);
      if (!container) {
        this.sendError(ws, 'Container not found');
        return;
      }

      // Check ownership (non-admin users can only access their own containers)
      const client = Array.from(this.clients.values()).find(c => c.ws === ws);
      if (client && client.role !== 'admin' && container.created_by !== userId) {
        this.sendError(ws, 'Access denied');
        return;
      }

      // Subscribe to container logs
      this.subscribeToContainerLogs(container_id, ws);
      subscribedContainers.add(container_id);

      this.sendMessage(ws, {
        type: 'log_subscription_success',
        container_id,
        container_name: container.name,
        timestamp: new Date().toISOString()
      });

      // Send recent logs
      if (this.logService) {
        try {
          const recentLogs = await this.logService.readLogs(container_id, { tail: 50 });
          
          recentLogs.forEach(log => {
            this.sendMessage(ws, {
              type: 'log_entry',
              container_id,
              log
            });
          });
        } catch (error) {
          console.error('Error sending recent logs:', error);
        }
      }

      console.log(`📝 Client subscribed to logs for container: ${container.name}`);

    } catch (error) {
      console.error('Log subscription error:', error);
      this.sendError(ws, 'Failed to subscribe to logs');
    }
  }

  async handleLogUnsubscription(ws, message, subscribedContainers) {
    try {
      const { container_id } = message;
      
      if (!container_id) {
        this.sendError(ws, 'Container ID required');
        return;
      }

      this.unsubscribeFromContainerLogs(container_id, ws);
      subscribedContainers.delete(container_id);

      this.sendMessage(ws, {
        type: 'log_unsubscription_success',
        container_id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Log unsubscription error:', error);
      this.sendError(ws, 'Failed to unsubscribe from logs');
    }
  }

  async handleCommandExecution(ws, message, userId) {
    try {
      const { container_id, command, working_dir = '/app' } = message;
      
      if (!container_id || !command) {
        this.sendError(ws, 'Container ID and command required');
        return;
      }

      const container = await Container.findById(container_id);
      if (!container) {
        this.sendError(ws, 'Container not found');
        return;
      }

      // Check ownership
      const client = Array.from(this.clients.values()).find(c => c.ws === ws);
      if (client && client.role !== 'admin' && container.created_by !== userId) {
        this.sendError(ws, 'Access denied');
        return;
      }

      if (!container.docker_id) {
        this.sendError(ws, 'Container has no Docker ID');
        return;
      }

      // Execute command
      const stream = await dockerManager.executeCommand(container.docker_id, command.split(' '), {
        WorkingDir: working_dir,
        AttachStdout: true,
        AttachStderr: true
      });

      this.sendMessage(ws, {
        type: 'command_started',
        container_id,
        command,
        timestamp: new Date().toISOString()
      });

      // Stream command output
      stream.on('data', (chunk) => {
        this.sendMessage(ws, {
          type: 'command_output',
          container_id,
          output: chunk.toString(),
          timestamp: new Date().toISOString()
        });
      });

      stream.on('end', () => {
        this.sendMessage(ws, {
          type: 'command_completed',
          container_id,
          command,
          timestamp: new Date().toISOString()
        });
      });

      stream.on('error', (error) => {
        this.sendMessage(ws, {
          type: 'command_error',
          container_id,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      });

      // Log command execution
      await container.addLog(`Command executed via WebSocket: ${command}`, 'info');

    } catch (error) {
      console.error('Command execution error:', error);
      this.sendError(ws, 'Failed to execute command');
    }
  }

  async handleContainerStatus(ws, message, userId) {
    try {
      const { container_id } = message;
      
      if (!container_id) {
        this.sendError(ws, 'Container ID required');
        return;
      }

      const container = await Container.findById(container_id);
      if (!container) {
        this.sendError(ws, 'Container not found');
        return;
      }

      // Check ownership
      const client = Array.from(this.clients.values()).find(c => c.ws === ws);
      if (client && client.role !== 'admin' && container.created_by !== userId) {
        this.sendError(ws, 'Access denied');
        return;
      }

      let dockerStatus = null;
      if (container.docker_id) {
        try {
          const dockerInfo = await dockerManager.getContainer(container.docker_id);
          dockerStatus = {
            status: dockerInfo.status,
            running: dockerInfo.running,
            created: dockerInfo.created
          };
        } catch (error) {
          dockerStatus = { status: 'not_found', running: false };
        }
      }

      this.sendMessage(ws, {
        type: 'container_status',
        container_id,
        container_name: container.name,
        database_status: container.status,
        docker_status: dockerStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Container status error:', error);
      this.sendError(ws, 'Failed to get container status');
    }
  }

  subscribeToContainerLogs(containerId, ws) {
    if (!this.containerStreams.has(containerId)) {
      this.containerStreams.set(containerId, new Set());
    }
    this.containerStreams.get(containerId).add(ws);
  }

  unsubscribeFromContainerLogs(containerId, ws) {
    if (this.containerStreams.has(containerId)) {
      this.containerStreams.get(containerId).delete(ws);
      if (this.containerStreams.get(containerId).size === 0) {
        this.containerStreams.delete(containerId);
      }
    }
  }

  // Broadcast log entry to all subscribed clients
  broadcastLogEntry(containerId, logEntry) {
    if (this.containerStreams.has(containerId)) {
      const subscribers = this.containerStreams.get(containerId);
      
      subscribers.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          this.sendMessage(ws, {
            type: 'log_entry',
            container_id: containerId,
            log: logEntry
          });
        } else {
          // Remove closed connections
          subscribers.delete(ws);
        }
      });
    }
  }

  // Broadcast container status change
  broadcastContainerStatus(containerId, status) {
    // Send to all authenticated clients (they can filter based on their access)
    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === client.ws.OPEN) {
        this.sendMessage(client.ws, {
          type: 'container_status_change',
          container_id: containerId,
          status,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  sendMessage(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendError(ws, error) {
    this.sendMessage(ws, {
      type: 'error',
      error,
      timestamp: new Date().toISOString()
    });
  }

  // Get connected clients info (for admin)
  getConnectedClients() {
    const clients = [];
    
    this.clients.forEach((client, clientId) => {
      clients.push({
        client_id: clientId,
        user_id: client.userId,
        username: client.username,
        role: client.role,
        connected_at: client.connectedAt,
        subscribed_containers: Array.from(this.containerStreams.entries())
          .filter(([containerId, subscribers]) => subscribers.has(client.ws))
          .map(([containerId]) => containerId)
      });
    });
    
    return clients;
  }

  // Cleanup closed connections
  cleanup() {
    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState !== client.ws.OPEN) {
        this.clients.delete(clientId);
        
        // Remove from container streams
        this.containerStreams.forEach((subscribers, containerId) => {
          subscribers.delete(client.ws);
          if (subscribers.size === 0) {
            this.containerStreams.delete(containerId);
          }
        });
      }
    });
  }
}

export default WebSocketService;
