import express from 'express';
import { Container } from '../models/Container.js';
import { validateContainerId, validateContainerSettings } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// GET /api/settings/:id - Get container settings
router.get('/:id', validateContainerId, asyncHandler(async (req, res) => {
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

  const settings = await container.getSettings();

  res.json({
    container_id: container.id,
    container_name: container.name,
    settings: settings || {
      cloudflare_token: null,
      tunnel_enabled: false,
      tunnel_url: null,
      auto_restart: true,
      max_memory: null,
      max_cpu: null,
      settings_json: {}
    }
  });
}));

// PUT /api/settings/:id - Update container settings
router.put('/:id', validateContainerSettings, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    cloudflareToken,
    tunnelEnabled,
    tunnelUrl,
    autoRestart,
    maxMemory,
    maxCpu,
    customSettings
  } = req.body;

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

  const settingsData = {};

  if (cloudflareToken !== undefined) settingsData.cloudflare_token = cloudflareToken;
  if (tunnelEnabled !== undefined) settingsData.tunnel_enabled = tunnelEnabled;
  if (tunnelUrl !== undefined) settingsData.tunnel_url = tunnelUrl;
  if (autoRestart !== undefined) settingsData.auto_restart = autoRestart;
  if (maxMemory !== undefined) settingsData.max_memory = maxMemory;
  if (maxCpu !== undefined) settingsData.max_cpu = maxCpu;
  if (customSettings !== undefined) settingsData.settings_json = customSettings;

  const updatedSettings = await container.updateSettings(settingsData);

  await container.addLog('Container settings updated', 'info');

  res.json({
    message: 'Settings updated successfully',
    container_id: container.id,
    settings: updatedSettings
  });
}));

// POST /api/settings/:id/startup-script - Update startup script
router.post('/:id/startup-script', validateContainerId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { script } = req.body;

  if (!script) {
    return res.status(400).json({
      error: 'Startup script is required',
      code: 'MISSING_SCRIPT'
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

  // Update startup script
  const updatedContainer = await Container.update(id, { startup_script: script });

  if (updatedContainer) {
    await updatedContainer.addLog(`Startup script updated: ${script}`, 'info');
  }

  res.json({
    message: 'Startup script updated successfully',
    container_id: container.id,
    startup_script: script
  });
}));

// POST /api/settings/:id/execute-script - Execute startup script
router.post('/:id/execute-script', validateContainerId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { script: customScript } = req.body;

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

  const scriptToExecute = customScript || container.startup_script;

  if (!scriptToExecute) {
    return res.status(400).json({
      error: 'No startup script configured',
      code: 'NO_STARTUP_SCRIPT'
    });
  }

  try {
    const { dockerManager } = await import('../config/docker.js');
    
    // Execute script in container
    const command = ['sh', '-c', scriptToExecute];
    const stream = await dockerManager.executeCommand(container.docker_id, command);
    
    let output = '';
    let error = '';

    stream.on('data', (chunk) => {
      const data = chunk.toString();
      if (data.includes('stderr')) {
        error += data;
      } else {
        output += data;
      }
    });

    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    // Log the execution
    await container.addLog(`Executed startup script: ${scriptToExecute}`, 'info');
    
    if (output) {
      await container.addLog(`Script output: ${output}`, 'info');
    }
    
    if (error) {
      await container.addLog(`Script error: ${error}`, 'error');
    }

    res.json({
      message: 'Script executed successfully',
      container_id: container.id,
      script: scriptToExecute,
      output: output.trim(),
      error: error.trim(),
      success: !error || error.trim() === ''
    });

  } catch (error) {
    await container.addLog(`Script execution failed: ${error.message}`, 'error');
    console.error('Error executing startup script:', error);
    throw error;
  }
}));

// POST /api/settings/:id/tunnel/start - Start Cloudflare tunnel
router.post('/:id/tunnel/start', validateContainerId, asyncHandler(async (req, res) => {
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

  const settings = await container.getSettings();
  
  if (!settings || !settings.cloudflare_token) {
    return res.status(400).json({
      error: 'Cloudflare token not configured',
      code: 'NO_CLOUDFLARE_TOKEN'
    });
  }

  if (!container.docker_id) {
    return res.status(400).json({
      error: 'Container has no Docker ID',
      code: 'NO_DOCKER_ID'
    });
  }

  try {
    const { dockerManager } = await import('../config/docker.js');
    
    // Start cloudflared tunnel (this is a simplified example)
    // In production, you might want to run cloudflared as a separate container
    const tunnelCommand = [
      'sh', '-c', 
      `cloudflared tunnel --token ${settings.cloudflare_token} --no-autoupdate &`
    ];

    const stream = await dockerManager.executeCommand(container.docker_id, tunnelCommand);
    
    let output = '';
    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    // Don't wait for the tunnel to finish as it runs in background
    setTimeout(async () => {
      // Update settings to mark tunnel as enabled
      await container.updateSettings({ tunnel_enabled: true });
      await container.addLog('Cloudflare tunnel started', 'info');
    }, 2000);

    res.json({
      message: 'Cloudflare tunnel started',
      container_id: container.id,
      tunnel_enabled: true
    });

  } catch (error) {
    await container.addLog(`Failed to start Cloudflare tunnel: ${error.message}`, 'error');
    console.error('Error starting Cloudflare tunnel:', error);
    throw error;
  }
}));

// POST /api/settings/:id/tunnel/stop - Stop Cloudflare tunnel
router.post('/:id/tunnel/stop', validateContainerId, asyncHandler(async (req, res) => {
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
    const { dockerManager } = await import('../config/docker.js');
    
    // Kill cloudflared processes
    const killCommand = ['sh', '-c', 'pkill -f cloudflared || true'];
    const stream = await dockerManager.executeCommand(container.docker_id, killCommand);
    
    let output = '';
    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    // Update settings to mark tunnel as disabled
    await container.updateSettings({ tunnel_enabled: false, tunnel_url: null });
    await container.addLog('Cloudflare tunnel stopped', 'info');

    res.json({
      message: 'Cloudflare tunnel stopped',
      container_id: container.id,
      tunnel_enabled: false
    });

  } catch (error) {
    await container.addLog(`Failed to stop Cloudflare tunnel: ${error.message}`, 'error');
    console.error('Error stopping Cloudflare tunnel:', error);
    throw error;
  }
}));

// GET /api/settings/:id/tunnel/status - Get tunnel status
router.get('/:id/tunnel/status', validateContainerId, asyncHandler(async (req, res) => {
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

  const settings = await container.getSettings();
  
  let tunnelRunning = false;
  let tunnelUrl = null;

  if (container.docker_id && settings && settings.tunnel_enabled) {
    try {
      const { dockerManager } = await import('../config/docker.js');
      
      // Check if cloudflared is running
      const checkCommand = ['sh', '-c', 'pgrep -f cloudflared > /dev/null && echo "running" || echo "stopped"'];
      const stream = await dockerManager.executeCommand(container.docker_id, checkCommand);
      
      let output = '';
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      tunnelRunning = output.trim() === 'running';
      tunnelUrl = settings.tunnel_url;

    } catch (error) {
      console.warn('Error checking tunnel status:', error.message);
    }
  }

  res.json({
    container_id: container.id,
    tunnel_configured: !!(settings && settings.cloudflare_token),
    tunnel_enabled: !!(settings && settings.tunnel_enabled),
    tunnel_running: tunnelRunning,
    tunnel_url: tunnelUrl,
    cloudflare_token_set: !!(settings && settings.cloudflare_token)
  });
}));

// GET /api/settings/:id/environment - Get container environment variables
router.get('/:id/environment', validateContainerId, asyncHandler(async (req, res) => {
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

  res.json({
    container_id: container.id,
    environment_vars: container.environment_vars || []
  });
}));

// PUT /api/settings/:id/environment - Update container environment variables
router.put('/:id/environment', validateContainerId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { environment } = req.body;

  if (!Array.isArray(environment)) {
    return res.status(400).json({
      error: 'Environment variables must be an array',
      code: 'INVALID_ENVIRONMENT'
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

  // Validate environment variables format
  for (const env of environment) {
    if (typeof env !== 'string' || !env.includes('=')) {
      return res.status(400).json({
        error: 'Environment variables must be in KEY=VALUE format',
        code: 'INVALID_ENV_FORMAT'
      });
    }
  }

  const updatedContainer = await Container.update(id, { environment_vars: environment });

  if (updatedContainer) {
    await updatedContainer.addLog(`Environment variables updated (${environment.length} variables)`, 'info');
  }

  res.json({
    message: 'Environment variables updated successfully',
    container_id: container.id,
    environment_vars: environment
  });
}));

export default router;
