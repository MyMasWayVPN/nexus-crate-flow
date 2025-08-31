import express from 'express';
import { Container } from '../models/Container.js';
import { dockerManager } from '../config/docker.js';
import { validateContainerId, validateLogQuery } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// GET /api/logs/:id - Get container logs
router.get('/:id', validateContainerId, validateLogQuery, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tail = 100, since, until, follow = false } = req.query;

  const container = await Container.findById(id);
  if (!container) {
    return res.status(404).json({
      error: 'Container not found',
      code: 'CONTAINER_NOT_FOUND'
    });
  }

  // Check ownership
  if (req.user.role !== 'admin' && container.created_by !== req.user.id) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'ACCESS_DENIED'
    });
  }

  try {
    // Get logs from database (application logs)
    const dbLogs = await container.getLogs({
      limit: parseInt(tail),
      since: since ? new Date(since).toISOString() : null
    });

    // Get logs from Docker (container output logs)
    let dockerLogs = '';
    if (container.docker_id) {
      try {
        const logOptions = {
          tail: parseInt(tail),
          timestamps: true
        };

        if (since) {
          logOptions.since = Math.floor(new Date(since).getTime() / 1000);
        }

        if (until) {
          logOptions.until = Math.floor(new Date(until).getTime() / 1000);
        }

        dockerLogs = await dockerManager.getContainerLogs(container.docker_id, logOptions);
      } catch (error) {
        console.warn(`Failed to get Docker logs for container ${container.docker_id}:`, error.message);
      }
    }

    // Parse Docker logs
    const parsedDockerLogs = dockerLogs
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Remove Docker log prefixes and parse timestamp
        const cleanLine = line.replace(/^\x01\x00\x00\x00.{4}/, '').replace(/^\x02\x00\x00\x00.{4}/, '');
        const timestampMatch = cleanLine.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
        
        if (timestampMatch) {
          return {
            timestamp: timestampMatch[1],
            content: timestampMatch[2],
            source: 'docker',
            type: 'stdout'
          };
        }
        
        return {
          timestamp: new Date().toISOString(),
          content: cleanLine,
          source: 'docker',
          type: 'stdout'
        };
      });

    // Format database logs
    const formattedDbLogs = dbLogs.map(log => ({
      timestamp: log.timestamp,
      content: log.log_content,
      source: 'application',
      type: log.log_type
    }));

    // Combine and sort logs by timestamp
    const allLogs = [...formattedDbLogs, ...parsedDockerLogs]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-parseInt(tail)); // Keep only the last N logs

    res.json({
      container_id: container.id,
      container_name: container.name,
      logs: allLogs,
      total_logs: allLogs.length,
      sources: {
        application: formattedDbLogs.length,
        docker: parsedDockerLogs.length
      }
    });

  } catch (error) {
    console.error('Error getting container logs:', error);
    throw error;
  }
}));

// GET /api/logs/:id/stream - Stream container logs via WebSocket
// This endpoint returns connection info for WebSocket streaming
router.get('/:id/stream', validateContainerId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const container = await Container.findById(id);

  if (!container) {
    return res.status(404).json({
      error: 'Container not found',
      code: 'CONTAINER_NOT_FOUND'
    });
  }

  // Check ownership
  if (req.user.role !== 'admin' && container.created_by !== req.user.id) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'ACCESS_DENIED'
    });
  }

  // Return WebSocket connection information
  res.json({
    message: 'Connect to WebSocket for real-time logs',
    websocket_url: `/ws/logs/${container.id}`,
    container_id: container.id,
    container_name: container.name,
    instructions: {
      connect: `ws://localhost:${process.env.PORT || 3001}/ws/logs/${container.id}`,
      authentication: 'Send JWT token as first message after connection',
      format: 'Logs will be sent as JSON objects with timestamp, content, source, and type fields'
    }
  });
}));

// POST /api/logs/:id - Add custom log entry
router.post('/:id', validateContainerId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, type = 'info' } = req.body;

  if (!content) {
    return res.status(400).json({
      error: 'Log content is required',
      code: 'MISSING_CONTENT'
    });
  }

  const container = await Container.findById(id);
  if (!container) {
    return res.status(404).json({
      error: 'Container not found',
      code: 'CONTAINER_NOT_FOUND'
    });
  }

  // Check ownership
  if (req.user.role !== 'admin' && container.created_by !== req.user.id) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'ACCESS_DENIED'
    });
  }

  // Validate log type
  const validTypes = ['info', 'warning', 'error', 'debug'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      error: 'Invalid log type',
      code: 'INVALID_LOG_TYPE',
      valid_types: validTypes
    });
  }

  await container.addLog(content, type);

  res.status(201).json({
    message: 'Log entry added successfully',
    log: {
      container_id: container.id,
      content,
      type,
      timestamp: new Date().toISOString()
    }
  });
}));

// DELETE /api/logs/:id - Clear container logs
router.delete('/:id', validateContainerId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { source = 'application' } = req.query;

  const container = await Container.findById(id);
  if (!container) {
    return res.status(404).json({
      error: 'Container not found',
      code: 'CONTAINER_NOT_FOUND'
    });
  }

  // Check ownership
  if (req.user.role !== 'admin' && container.created_by !== req.user.id) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'ACCESS_DENIED'
    });
  }

  try {
    if (source === 'application' || source === 'all') {
      // Clear application logs from database
      await database.run('DELETE FROM container_logs WHERE container_id = ?', [container.id]);
      await container.addLog('Application logs cleared', 'info');
    }

    if (source === 'docker' || source === 'all') {
      // Note: Docker logs cannot be cleared directly, but we can note this action
      await container.addLog('Docker logs clear requested (Docker logs are managed by Docker daemon)', 'info');
    }

    res.json({
      message: `Container logs cleared (source: ${source})`,
      container_id: container.id,
      cleared_source: source
    });

  } catch (error) {
    console.error('Error clearing container logs:', error);
    throw error;
  }
}));

// GET /api/logs/:id/download - Download container logs as file
router.get('/:id/download', validateContainerId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { format = 'txt', source = 'all' } = req.query;

  const container = await Container.findById(id);
  if (!container) {
    return res.status(404).json({
      error: 'Container not found',
      code: 'CONTAINER_NOT_FOUND'
    });
  }

  // Check ownership
  if (req.user.role !== 'admin' && container.created_by !== req.user.id) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'ACCESS_DENIED'
    });
  }

  try {
    let logs = [];

    if (source === 'application' || source === 'all') {
      const dbLogs = await container.getLogs({ limit: 10000 });
      logs.push(...dbLogs.map(log => ({
        timestamp: log.timestamp,
        content: log.log_content,
        source: 'application',
        type: log.log_type
      })));
    }

    if (source === 'docker' || source === 'all') {
      if (container.docker_id) {
        try {
          const dockerLogs = await dockerManager.getContainerLogs(container.docker_id, {
            tail: 10000,
            timestamps: true
          });

          const parsedDockerLogs = dockerLogs
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
              const cleanLine = line.replace(/^\x01\x00\x00\x00.{4}/, '').replace(/^\x02\x00\x00\x00.{4}/, '');
              const timestampMatch = cleanLine.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
              
              if (timestampMatch) {
                return {
                  timestamp: timestampMatch[1],
                  content: timestampMatch[2],
                  source: 'docker',
                  type: 'stdout'
                };
              }
              
              return {
                timestamp: new Date().toISOString(),
                content: cleanLine,
                source: 'docker',
                type: 'stdout'
              };
            });

          logs.push(...parsedDockerLogs);
        } catch (error) {
          console.warn(`Failed to get Docker logs for download:`, error.message);
        }
      }
    }

    // Sort logs by timestamp
    logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${container.name}-logs-${timestamp}.${format}`;

    // Set response headers
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.json({
        container: {
          id: container.id,
          name: container.name,
          exported_at: new Date().toISOString()
        },
        logs
      });
    } else {
      // Default to text format
      res.setHeader('Content-Type', 'text/plain');
      
      const logText = logs
        .map(log => `[${log.timestamp}] [${log.source}] [${log.type}] ${log.content}`)
        .join('\n');

      res.send(logText);
    }

  } catch (error) {
    console.error('Error downloading container logs:', error);
    throw error;
  }
}));

export default router;
