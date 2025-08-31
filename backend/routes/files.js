import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { Container } from '../models/Container.js';
import { dockerManager } from '../config/docker.js';
import { validateContainerId, validateFilePath, validateFileUpload } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { id } = req.params;
    const container = await Container.findById(id);
    
    if (!container) {
      return cb(new Error('Container not found'));
    }

    const uploadPath = path.join(process.cwd(), 'uploads', container.id);
    
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Keep original filename
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10 // Max 10 files at once
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now, but you can add restrictions here
    cb(null, true);
  }
});

// GET /api/files/:id - List files in container
router.get('/:id', validateContainerId, validateFilePath, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { path: filePath = '/' } = req.query;

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
    // Execute ls command in container to list files
    const command = ['ls', '-la', filePath];
    const stream = await dockerManager.executeCommand(container.docker_id, command);
    
    let output = '';
    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    // Parse ls output
    const lines = output.split('\n').filter(line => line.trim());
    const files = [];

    for (let i = 1; i < lines.length; i++) { // Skip first line (total)
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;

      const permissions = parts[0];
      const links = parts[1];
      const owner = parts[2];
      const group = parts[3];
      const size = parts[4];
      const month = parts[5];
      const day = parts[6];
      const timeOrYear = parts[7];
      const name = parts.slice(8).join(' ');

      // Skip . and .. entries
      if (name === '.' || name === '..') continue;

      const isDirectory = permissions.startsWith('d');
      const isSymlink = permissions.startsWith('l');

      files.push({
        name,
        type: isDirectory ? 'folder' : 'file',
        size: isDirectory ? '-' : size,
        permissions,
        owner,
        group,
        modified: `${month} ${day} ${timeOrYear}`,
        is_symlink: isSymlink,
        path: path.posix.join(filePath, name)
      });
    }

    res.json({
      container_id: container.id,
      container_name: container.name,
      current_path: filePath,
      files,
      total_files: files.length
    });

  } catch (error) {
    console.error('Error listing container files:', error);
    
    if (error.message.includes('No such file or directory')) {
      return res.status(404).json({
        error: 'Path not found',
        code: 'PATH_NOT_FOUND'
      });
    }

    throw error;
  }
}));

// GET /api/files/:id/download - Download file from container
router.get('/:id/download', validateContainerId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { path: filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({
      error: 'File path is required',
      code: 'MISSING_FILE_PATH'
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

  if (!container.docker_id) {
    return res.status(400).json({
      error: 'Container has no Docker ID',
      code: 'NO_DOCKER_ID'
    });
  }

  try {
    // Use docker cp to copy file from container
    const dockerContainer = dockerManager.docker.getContainer(container.docker_id);
    const stream = await dockerContainer.getArchive({ path: filePath });

    const filename = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    stream.pipe(res);

  } catch (error) {
    console.error('Error downloading file:', error);
    
    if (error.message.includes('No such file or directory')) {
      return res.status(404).json({
        error: 'File not found',
        code: 'FILE_NOT_FOUND'
      });
    }

    throw error;
  }
}));

// POST /api/files/:id/upload - Upload files to container
router.post('/:id/upload', upload.array('files'), validateContainerId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { path: targetPath = '/app' } = req.body;

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

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      error: 'No files uploaded',
      code: 'NO_FILES'
    });
  }

  try {
    const uploadedFiles = [];
    const dockerContainer = dockerManager.docker.getContainer(container.docker_id);

    for (const file of req.files) {
      try {
        // Create tar stream for the file
        const tarStream = require('tar-fs').pack(path.dirname(file.path), {
          entries: [path.basename(file.path)]
        });

        // Upload to container
        await dockerContainer.putArchive(tarStream, { path: targetPath });

        uploadedFiles.push({
          original_name: file.originalname,
          size: file.size,
          uploaded_to: path.posix.join(targetPath, file.originalname)
        });

        // Clean up temporary file
        await fs.unlink(file.path);

      } catch (error) {
        console.error(`Error uploading file ${file.originalname}:`, error);
        // Clean up temporary file on error
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up temp file:', unlinkError);
        }
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(500).json({
        error: 'Failed to upload any files',
        code: 'UPLOAD_FAILED'
      });
    }

    await container.addLog(`Uploaded ${uploadedFiles.length} file(s) to ${targetPath}`, 'info');

    res.json({
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      container_id: container.id,
      target_path: targetPath,
      uploaded_files: uploadedFiles
    });

  } catch (error) {
    // Clean up any remaining temporary files
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up temp file:', unlinkError);
        }
      }
    }

    console.error('Error uploading files:', error);
    throw error;
  }
}));

// DELETE /api/files/:id - Delete file from container
router.delete('/:id', validateContainerId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { path: filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({
      error: 'File path is required',
      code: 'MISSING_FILE_PATH'
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

  if (!container.docker_id) {
    return res.status(400).json({
      error: 'Container has no Docker ID',
      code: 'NO_DOCKER_ID'
    });
  }

  try {
    // Execute rm command in container
    const command = ['rm', '-rf', filePath];
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

    if (error && error.includes('No such file or directory')) {
      return res.status(404).json({
        error: 'File not found',
        code: 'FILE_NOT_FOUND'
      });
    }

    await container.addLog(`Deleted file/directory: ${filePath}`, 'info');

    res.json({
      message: 'File deleted successfully',
      container_id: container.id,
      deleted_path: filePath
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}));

// POST /api/files/:id/create - Create new file or directory
router.post('/:id/create', validateContainerId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { path: filePath, type = 'file', content = '' } = req.body;

  if (!filePath) {
    return res.status(400).json({
      error: 'File path is required',
      code: 'MISSING_FILE_PATH'
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

  if (!container.docker_id) {
    return res.status(400).json({
      error: 'Container has no Docker ID',
      code: 'NO_DOCKER_ID'
    });
  }

  try {
    let command;
    
    if (type === 'directory') {
      command = ['mkdir', '-p', filePath];
    } else {
      // Create file with content
      if (content) {
        command = ['sh', '-c', `echo '${content.replace(/'/g, "'\\''")}' > '${filePath}'`];
      } else {
        command = ['touch', filePath];
      }
    }

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

    if (error && !error.includes('File exists')) {
      throw new Error(error);
    }

    await container.addLog(`Created ${type}: ${filePath}`, 'info');

    res.status(201).json({
      message: `${type} created successfully`,
      container_id: container.id,
      created_path: filePath,
      type
    });

  } catch (error) {
    console.error('Error creating file/directory:', error);
    throw error;
  }
}));

// PUT /api/files/:id/edit - Edit file content
router.put('/:id/edit', validateContainerId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { path: filePath, content } = req.body;

  if (!filePath) {
    return res.status(400).json({
      error: 'File path is required',
      code: 'MISSING_FILE_PATH'
    });
  }

  if (content === undefined) {
    return res.status(400).json({
      error: 'File content is required',
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

  if (!container.docker_id) {
    return res.status(400).json({
      error: 'Container has no Docker ID',
      code: 'NO_DOCKER_ID'
    });
  }

  try {
    // Write content to file
    const escapedContent = content.replace(/'/g, "'\\''");
    const command = ['sh', '-c', `cat > '${filePath}' << 'EOF'\n${content}\nEOF`];
    
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

    if (error) {
      throw new Error(error);
    }

    await container.addLog(`Edited file: ${filePath}`, 'info');

    res.json({
      message: 'File updated successfully',
      container_id: container.id,
      file_path: filePath,
      content_length: content.length
    });

  } catch (error) {
    console.error('Error editing file:', error);
    throw error;
  }
}));

export default router;
