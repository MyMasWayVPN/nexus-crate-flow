import express from 'express';
import { Container } from '../models/Container.js';
import { dockerManager } from '../config/docker.js';
import { requireRole } from '../middleware/auth.js';
import { 
  validateCreateContainer, 
  validateUpdateContainer, 
  validateContainerId,
  validatePagination 
} from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// GET /api/containers - List all containers
router.get('/', validatePagination, asyncHandler(async (req, res) => {
  const { page, limit, sort, order, status } = req.query;
  const userId = req.user.role === 'admin' ? null : req.user.id;

  const result = await Container.list({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    sort: sort || 'created_at',
    order: order || 'desc',
    status,
    userId
  });

  // Get Docker status for each container
  const containersWithStatus = await Promise.all(
    result.containers.map(async (container) => {
      try {
        if (container.docker_id) {
          const dockerContainer = await dockerManager.getContainer(container.docker_id);
          container.docker_status = dockerContainer.status;
          container.docker_running = dockerContainer.running;
        }
      } catch (error) {
        // Container might not exist in Docker anymore
        container.docker_status = 'not_found';
        container.docker_running = false;
      }
      return container;
    })
  );

  res.json({
    containers: containersWithStatus,
    pagination: result.pagination
  });
}));

// GET /api/containers/:id - Get specific container
router.get('/:id', validateContainerId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const container = await Container.findById(id);

  if (!container) {
    return res.status(404).json({
      error: 'Container not found',
      code: 'CONTAINER_NOT_FOUND'
    });
  }

  // Check ownership (non-admin users can only see their own containers)
  if (req.user.role !== 'admin' && container.created_by !== req.user.id) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'ACCESS_DENIED'
    });
  }

  // Get Docker status
  let dockerInfo = null;
  if (container.docker_id) {
    try {
      dockerInfo = await dockerManager.getContainer(container.docker_id);
    } catch (error) {
      console.warn(`Docker container ${container.docker_id} not found`);
    }
  }

  res.json({
    container: container.toJSON(),
    docker_info: dockerInfo
  });
}));

// POST /api/containers - Create new container
router.post('/', validateCreateContainer, asyncHandler(async (req, res) => {
  const {
    name,
    image,
    ports,
    environment,
    volumes,
    memory,
    cpu,
    startupScript,
    workingDir,
    command
  } = req.body;

  // Check if container name already exists
  const existingContainer = await Container.exists(name);
  if (existingContainer) {
    return res.status(409).json({
      error: 'Container name already exists',
      code: 'CONTAINER_NAME_EXISTS'
    });
  }

  // Create container in database
  const container = await Container.create({
    name,
    image,
    startup_script: startupScript,
    port_mappings: ports,
    environment_vars: environment,
    folder_path: `/home/containers/${name}`
  }, req.user.id);

  // Create Docker container
  try {
    const dockerContainer = await dockerManager.createContainer({
      name: container.name,
      image,
      ports,
      environment,
      volumes: volumes || [`${container.folder_path}:/app`],
      memory,
      cpu,
      workingDir: workingDir || '/app',
      command
    });

    // Update container with Docker ID
    await container.updateDockerId(dockerContainer.dockerId);
    await container.updateStatus('created');

    // Add creation log
    await container.addLog(`Container created with image ${image}`, 'info');

    res.status(201).json({
      message: 'Container created successfully',
      container: container.toJSON(),
      docker_id: dockerContainer.dockerId
    });
  } catch (error) {
    // If Docker creation fails, remove from database
    await Container.delete(container.id);
    
    console.error('Failed to create Docker container:', error);
    throw new Error(`Failed to create Docker container: ${error.message}`);
  }
}));

// PUT /api/containers/:id - Update container
router.put('/:id', validateUpdateContainer, asyncHandler(async (req, res) => {
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

  const updatedContainer = await Container.update(id, req.body);

  if (updatedContainer) {
    await updatedContainer.addLog('Container configuration updated', 'info');
  }

  res.json({
    message: 'Container updated successfully',
    container: updatedContainer.toJSON()
  });
}));

// DELETE /api/containers/:id - Delete container
router.delete('/:id', validateContainerId, asyncHandler(async (req, res) => {
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

  // Stop and remove Docker container if it exists
  if (container.docker_id) {
    try {
      await dockerManager.stopContainer(container.docker_id);
      await dockerManager.removeContainer(container.docker_id, true);
    } catch (error) {
      console.warn(`Failed to remove Docker container ${container.docker_id}:`, error.message);
    }
  }

  // Remove from database
  const deleted = await Container.delete(id);

  if (deleted) {
    res.json({
      message: 'Container deleted successfully'
    });
  } else {
    res.status(500).json({
      error: 'Failed to delete container',
      code: 'DELETE_FAILED'
    });
  }
}));

// POST /api/containers/:id/start - Start container
router.post('/:id/start', validateContainerId, asyncHandler(async (req, res) => {
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

  if (!container.docker_id) {
    return res.status(400).json({
      error: 'Container has no Docker ID',
      code: 'NO_DOCKER_ID'
    });
  }

  try {
    await dockerManager.startContainer(container.docker_id);
    await container.updateStatus('running');
    await container.addLog('Container started', 'info');

    res.json({
      message: 'Container started successfully',
      status: 'running'
    });
  } catch (error) {
    await container.addLog(`Failed to start container: ${error.message}`, 'error');
    throw error;
  }
}));

// POST /api/containers/:id/stop - Stop container
router.post('/:id/stop', validateContainerId, asyncHandler(async (req, res) => {
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

  if (!container.docker_id) {
    return res.status(400).json({
      error: 'Container has no Docker ID',
      code: 'NO_DOCKER_ID'
    });
  }

  try {
    await dockerManager.stopContainer(container.docker_id);
    await container.updateStatus('stopped');
    await container.addLog('Container stopped', 'info');

    res.json({
      message: 'Container stopped successfully',
      status: 'stopped'
    });
  } catch (error) {
    await container.addLog(`Failed to stop container: ${error.message}`, 'error');
    throw error;
  }
}));

// POST /api/containers/:id/restart - Restart container
router.post('/:id/restart', validateContainerId, asyncHandler(async (req, res) => {
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

  if (!container.docker_id) {
    return res.status(400).json({
      error: 'Container has no Docker ID',
      code: 'NO_DOCKER_ID'
    });
  }

  try {
    await dockerManager.restartContainer(container.docker_id);
    await container.updateStatus('running');
    await container.addLog('Container restarted', 'info');

    res.json({
      message: 'Container restarted successfully',
      status: 'running'
    });
  } catch (error) {
    await container.addLog(`Failed to restart container: ${error.message}`, 'error');
    throw error;
  }
}));

// GET /api/containers/:id/stats - Get container statistics
router.get('/:id/stats', validateContainerId, asyncHandler(async (req, res) => {
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

  if (!container.docker_id) {
    return res.status(400).json({
      error: 'Container has no Docker ID',
      code: 'NO_DOCKER_ID'
    });
  }

  try {
    const stats = await dockerManager.getContainerStats(container.docker_id);
    
    res.json({
      container_id: container.id,
      stats
    });
  } catch (error) {
    if (error.message.includes('not running')) {
      return res.status(409).json({
        error: 'Container is not running',
        code: 'CONTAINER_NOT_RUNNING'
      });
    }
    throw error;
  }
}));

// GET /api/containers/stats - Get all containers stats (admin only)
router.get('/system/stats', requireRole('admin'), asyncHandler(async (req, res) => {
  const containerStats = await Container.getStats();
  const dockerContainers = await dockerManager.listContainers(true);

  res.json({
    database_stats: containerStats,
    docker_stats: {
      total_containers: dockerContainers.length,
      running_containers: dockerContainers.filter(c => c.status === 'running').length,
      stopped_containers: dockerContainers.filter(c => c.status === 'exited').length
    }
  });
}));

export default router;
