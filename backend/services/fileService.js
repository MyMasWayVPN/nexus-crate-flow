import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { dockerManager } from '../config/docker.js';
import { Container } from '../models/Container.js';
import Helpers from '../utils/helpers.js';

export class FileService {
  static async listContainerFiles(containerId, filePath = '/') {
    try {
      const container = await Container.findById(containerId);
      if (!container || !container.docker_id) {
        throw new Error('Container not found or has no Docker ID');
      }

      // Execute ls command in container
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
          path: path.posix.join(filePath, name),
          is_text_file: !isDirectory && Helpers.isTextFile(name)
        });
      }

      return files;

    } catch (error) {
      console.error('Error listing container files:', error);
      throw error;
    }
  }

  static async readContainerFile(containerId, filePath) {
    try {
      const container = await Container.findById(containerId);
      if (!container || !container.docker_id) {
        throw new Error('Container not found or has no Docker ID');
      }

      // Check if file is text file
      if (!Helpers.isTextFile(filePath)) {
        throw new Error('File is not a text file');
      }

      // Execute cat command in container
      const command = ['cat', filePath];
      const stream = await dockerManager.executeCommand(container.docker_id, command);
      
      let content = '';
      let error = '';

      stream.on('data', (chunk) => {
        const data = chunk.toString();
        if (data.includes('stderr') || data.includes('No such file')) {
          error += data;
        } else {
          content += data;
        }
      });

      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      if (error) {
        throw new Error(error);
      }

      return {
        path: filePath,
        content,
        size: Buffer.byteLength(content, 'utf8'),
        encoding: 'utf8'
      };

    } catch (error) {
      console.error('Error reading container file:', error);
      throw error;
    }
  }

  static async writeContainerFile(containerId, filePath, content) {
    try {
      const container = await Container.findById(containerId);
      if (!container || !container.docker_id) {
        throw new Error('Container not found or has no Docker ID');
      }

      // Escape content for shell
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

      await container.addLog(`File written: ${filePath}`, 'info');

      return {
        path: filePath,
        size: Buffer.byteLength(content, 'utf8'),
        success: true
      };

    } catch (error) {
      console.error('Error writing container file:', error);
      throw error;
    }
  }

  static async deleteContainerFile(containerId, filePath) {
    try {
      const container = await Container.findById(containerId);
      if (!container || !container.docker_id) {
        throw new Error('Container not found or has no Docker ID');
      }

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
        throw new Error('File not found');
      }

      await container.addLog(`File deleted: ${filePath}`, 'info');

      return { success: true, path: filePath };

    } catch (error) {
      console.error('Error deleting container file:', error);
      throw error;
    }
  }

  static async createContainerDirectory(containerId, dirPath) {
    try {
      const container = await Container.findById(containerId);
      if (!container || !container.docker_id) {
        throw new Error('Container not found or has no Docker ID');
      }

      // Execute mkdir command in container
      const command = ['mkdir', '-p', dirPath];
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

      await container.addLog(`Directory created: ${dirPath}`, 'info');

      return { success: true, path: dirPath };

    } catch (error) {
      console.error('Error creating container directory:', error);
      throw error;
    }
  }

  static async copyFileToContainer(containerId, localFilePath, containerPath) {
    try {
      const container = await Container.findById(containerId);
      if (!container || !container.docker_id) {
        throw new Error('Container not found or has no Docker ID');
      }

      const dockerContainer = dockerManager.docker.getContainer(container.docker_id);
      
      // Create tar stream for the file
      const tarStream = require('tar-fs').pack(path.dirname(localFilePath), {
        entries: [path.basename(localFilePath)]
      });

      // Upload to container
      await dockerContainer.putArchive(tarStream, { path: containerPath });

      await container.addLog(`File copied to container: ${path.basename(localFilePath)} -> ${containerPath}`, 'info');

      return {
        success: true,
        local_path: localFilePath,
        container_path: containerPath
      };

    } catch (error) {
      console.error('Error copying file to container:', error);
      throw error;
    }
  }

  static async copyFileFromContainer(containerId, containerPath, localPath) {
    try {
      const container = await Container.findById(containerId);
      if (!container || !container.docker_id) {
        throw new Error('Container not found or has no Docker ID');
      }

      const dockerContainer = dockerManager.docker.getContainer(container.docker_id);
      
      // Get archive from container
      const stream = await dockerContainer.getArchive({ path: containerPath });
      
      // Ensure local directory exists
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      
      // Write to local file
      const writeStream = require('fs').createWriteStream(localPath);
      stream.pipe(writeStream);

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      await container.addLog(`File copied from container: ${containerPath} -> ${localPath}`, 'info');

      return {
        success: true,
        container_path: containerPath,
        local_path: localPath
      };

    } catch (error) {
      console.error('Error copying file from container:', error);
      throw error;
    }
  }

  static async getFileStats(containerId, filePath) {
    try {
      const container = await Container.findById(containerId);
      if (!container || !container.docker_id) {
        throw new Error('Container not found or has no Docker ID');
      }

      // Execute stat command in container
      const command = ['stat', '-c', '%s,%Y,%A,%U,%G', filePath];
      const stream = await dockerManager.executeCommand(container.docker_id, command);
      
      let output = '';
      let error = '';

      stream.on('data', (chunk) => {
        const data = chunk.toString();
        if (data.includes('stderr') || data.includes('No such file')) {
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
        throw new Error('File not found');
      }

      const [size, mtime, permissions, owner, group] = output.trim().split(',');

      return {
        path: filePath,
        size: parseInt(size),
        modified: new Date(parseInt(mtime) * 1000),
        permissions,
        owner,
        group,
        is_directory: permissions.startsWith('d'),
        is_readable: permissions.includes('r'),
        is_writable: permissions.includes('w'),
        is_executable: permissions.includes('x')
      };

    } catch (error) {
      console.error('Error getting file stats:', error);
      throw error;
    }
  }

  static async searchFiles(containerId, searchPath, pattern, options = {}) {
    try {
      const container = await Container.findById(containerId);
      if (!container || !container.docker_id) {
        throw new Error('Container not found or has no Docker ID');
      }

      const { 
        caseSensitive = false, 
        includeContent = false,
        maxResults = 100 
      } = options;

      // Build find command
      let command = ['find', searchPath, '-type', 'f'];
      
      if (caseSensitive) {
        command.push('-name', pattern);
      } else {
        command.push('-iname', pattern);
      }

      command.push('-print0');

      const stream = await dockerManager.executeCommand(container.docker_id, command);
      
      let output = '';
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      // Parse null-separated output
      const files = output
        .split('\0')
        .filter(file => file.trim())
        .slice(0, maxResults)
        .map(file => ({
          path: file,
          name: path.basename(file),
          directory: path.dirname(file)
        }));

      // If includeContent is true, search within file contents
      if (includeContent) {
        const contentResults = [];
        
        for (const file of files.slice(0, 20)) { // Limit content search
          try {
            if (Helpers.isTextFile(file.path)) {
              const fileContent = await this.readContainerFile(containerId, file.path);
              const lines = fileContent.content.split('\n');
              const matchingLines = [];

              lines.forEach((line, index) => {
                const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
                if (regex.test(line)) {
                  matchingLines.push({
                    line_number: index + 1,
                    content: line.trim(),
                    matches: [...line.matchAll(regex)].map(match => ({
                      text: match[0],
                      index: match.index
                    }))
                  });
                }
              });

              if (matchingLines.length > 0) {
                contentResults.push({
                  ...file,
                  matching_lines: matchingLines
                });
              }
            }
          } catch (error) {
            // Skip files that can't be read
            console.warn(`Could not search content in ${file.path}:`, error.message);
          }
        }

        return {
          file_matches: files,
          content_matches: contentResults,
          total_files: files.length,
          total_content_matches: contentResults.length
        };
      }

      return {
        file_matches: files,
        total_files: files.length
      };

    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  }

  static async createBackup(containerId, backupPath = '/tmp') {
    try {
      const container = await Container.findById(containerId);
      if (!container || !container.docker_id) {
        throw new Error('Container not found or has no Docker ID');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${container.name}-backup-${timestamp}.tar.gz`;
      const containerBackupPath = path.posix.join(backupPath, backupFileName);

      // Create tar archive in container
      const command = ['tar', '-czf', containerBackupPath, '-C', '/', '.'];
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

      await container.addLog(`Backup created: ${backupFileName}`, 'info');

      return {
        success: true,
        backup_file: backupFileName,
        backup_path: containerBackupPath,
        container_id: containerId
      };

    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }
}

export default FileService;
