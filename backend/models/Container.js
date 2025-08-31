import { v4 as uuidv4 } from 'uuid';
import { database } from '../config/database.js';

export class Container {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.docker_id = data.docker_id;
    this.image = data.image;
    this.status = data.status || 'stopped';
    this.folder_path = data.folder_path;
    this.startup_script = data.startup_script;
    this.port_mappings = data.port_mappings ? JSON.parse(data.port_mappings) : {};
    this.environment_vars = data.environment_vars ? JSON.parse(data.environment_vars) : [];
    this.created_by = data.created_by;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async findById(id) {
    try {
      const containerData = await database.get(
        'SELECT * FROM containers WHERE id = ?',
        [id]
      );
      
      return containerData ? new Container(containerData) : null;
    } catch (error) {
      console.error('Error finding container by ID:', error);
      throw error;
    }
  }

  static async findByDockerId(dockerId) {
    try {
      const containerData = await database.get(
        'SELECT * FROM containers WHERE docker_id = ?',
        [dockerId]
      );
      
      return containerData ? new Container(containerData) : null;
    } catch (error) {
      console.error('Error finding container by Docker ID:', error);
      throw error;
    }
  }

  static async findByName(name) {
    try {
      const containerData = await database.get(
        'SELECT * FROM containers WHERE name = ?',
        [name]
      );
      
      return containerData ? new Container(containerData) : null;
    } catch (error) {
      console.error('Error finding container by name:', error);
      throw error;
    }
  }

  static async create(containerData, userId) {
    try {
      const id = uuidv4().replace(/-/g, '').substring(0, 12); // Generate short ID like Docker
      const folderPath = containerData.folder_path || `/home/containers/${id}`;

      const result = await database.run(
        `INSERT INTO containers (
          id, name, image, status, folder_path, startup_script, 
          port_mappings, environment_vars, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          containerData.name,
          containerData.image,
          'created',
          folderPath,
          containerData.startup_script || null,
          JSON.stringify(containerData.port_mappings || {}),
          JSON.stringify(containerData.environment_vars || []),
          userId
        ]
      );

      if (result.changes > 0) {
        return await Container.findById(id);
      }
      
      throw new Error('Failed to create container');
    } catch (error) {
      console.error('Error creating container:', error);
      throw error;
    }
  }

  static async update(id, updateData) {
    try {
      const allowedFields = [
        'name', 'status', 'docker_id', 'startup_script', 
        'port_mappings', 'environment_vars', 'folder_path'
      ];
      const updates = [];
      const values = [];

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key) && value !== undefined) {
          if (key === 'port_mappings' || key === 'environment_vars') {
            updates.push(`${key} = ?`);
            values.push(JSON.stringify(value));
          } else {
            updates.push(`${key} = ?`);
            values.push(value);
          }
        }
      }

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(id);
      
      const result = await database.run(
        `UPDATE containers SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      if (result.changes > 0) {
        return await Container.findById(id);
      }
      
      return null;
    } catch (error) {
      console.error('Error updating container:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const result = await database.run('DELETE FROM containers WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting container:', error);
      throw error;
    }
  }

  static async list(options = {}) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        sort = 'created_at', 
        order = 'desc',
        status = null,
        userId = null 
      } = options;
      
      const offset = (page - 1) * limit;
      let whereClause = '';
      let params = [];

      if (status) {
        whereClause += ' WHERE status = ?';
        params.push(status);
      }

      if (userId) {
        whereClause += whereClause ? ' AND created_by = ?' : ' WHERE created_by = ?';
        params.push(userId);
      }

      params.push(limit, offset);

      const containers = await database.all(
        `SELECT * FROM containers${whereClause} 
         ORDER BY ${sort} ${order.toUpperCase()} 
         LIMIT ? OFFSET ?`,
        params
      );

      // Get total count
      const countParams = params.slice(0, -2); // Remove limit and offset
      const total = await database.get(
        `SELECT COUNT(*) as count FROM containers${whereClause}`,
        countParams
      );

      return {
        containers: containers.map(container => new Container(container)),
        pagination: {
          page,
          limit,
          total: total.count,
          pages: Math.ceil(total.count / limit)
        }
      };
    } catch (error) {
      console.error('Error listing containers:', error);
      throw error;
    }
  }

  static async getByUser(userId, options = {}) {
    try {
      return await Container.list({ ...options, userId });
    } catch (error) {
      console.error('Error getting containers by user:', error);
      throw error;
    }
  }

  static async getStats() {
    try {
      const stats = await database.get(`
        SELECT 
          COUNT(*) as total_containers,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as running_containers,
          COUNT(CASE WHEN status = 'stopped' THEN 1 END) as stopped_containers,
          COUNT(CASE WHEN status = 'created' THEN 1 END) as created_containers,
          COUNT(CASE WHEN created_at >= datetime('now', '-24 hours') THEN 1 END) as new_containers_24h
        FROM containers
      `);

      return stats;
    } catch (error) {
      console.error('Error getting container stats:', error);
      throw error;
    }
  }

  static async exists(name, excludeId = null) {
    try {
      let query = 'SELECT id FROM containers WHERE name = ?';
      let params = [name];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const container = await database.get(query, params);
      return !!container;
    } catch (error) {
      console.error('Error checking container existence:', error);
      throw error;
    }
  }

  // Instance methods
  async updateStatus(status) {
    try {
      const result = await database.run(
        'UPDATE containers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, this.id]
      );

      if (result.changes > 0) {
        this.status = status;
        this.updated_at = new Date().toISOString();
      }

      return result.changes > 0;
    } catch (error) {
      console.error('Error updating container status:', error);
      throw error;
    }
  }

  async updateDockerId(dockerId) {
    try {
      const result = await database.run(
        'UPDATE containers SET docker_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [dockerId, this.id]
      );

      if (result.changes > 0) {
        this.docker_id = dockerId;
        this.updated_at = new Date().toISOString();
      }

      return result.changes > 0;
    } catch (error) {
      console.error('Error updating container Docker ID:', error);
      throw error;
    }
  }

  async getLogs(options = {}) {
    try {
      const { limit = 100, since = null, logType = null } = options;
      let query = 'SELECT * FROM container_logs WHERE container_id = ?';
      let params = [this.id];

      if (since) {
        query += ' AND timestamp >= ?';
        params.push(since);
      }

      if (logType) {
        query += ' AND log_type = ?';
        params.push(logType);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const logs = await database.all(query, params);
      return logs.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error getting container logs:', error);
      throw error;
    }
  }

  async addLog(content, logType = 'info') {
    try {
      await database.run(
        'INSERT INTO container_logs (container_id, log_content, log_type) VALUES (?, ?, ?)',
        [this.id, content, logType]
      );
    } catch (error) {
      console.error('Error adding container log:', error);
      throw error;
    }
  }

  async getSettings() {
    try {
      const settings = await database.get(
        'SELECT * FROM container_settings WHERE container_id = ?',
        [this.id]
      );

      if (settings && settings.settings_json) {
        settings.settings_json = JSON.parse(settings.settings_json);
      }

      return settings;
    } catch (error) {
      console.error('Error getting container settings:', error);
      throw error;
    }
  }

  async updateSettings(settingsData) {
    try {
      const existingSettings = await this.getSettings();
      
      if (existingSettings) {
        // Update existing settings
        const updates = [];
        const values = [];

        for (const [key, value] of Object.entries(settingsData)) {
          if (key === 'settings_json') {
            updates.push(`${key} = ?`);
            values.push(JSON.stringify(value));
          } else {
            updates.push(`${key} = ?`);
            values.push(value);
          }
        }

        values.push(this.id);

        await database.run(
          `UPDATE container_settings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE container_id = ?`,
          values
        );
      } else {
        // Create new settings
        await database.run(
          `INSERT INTO container_settings (
            container_id, cloudflare_token, tunnel_enabled, tunnel_url,
            auto_restart, max_memory, max_cpu, settings_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            this.id,
            settingsData.cloudflare_token || null,
            settingsData.tunnel_enabled || false,
            settingsData.tunnel_url || null,
            settingsData.auto_restart !== undefined ? settingsData.auto_restart : true,
            settingsData.max_memory || null,
            settingsData.max_cpu || null,
            settingsData.settings_json ? JSON.stringify(settingsData.settings_json) : null
          ]
        );
      }

      return await this.getSettings();
    } catch (error) {
      console.error('Error updating container settings:', error);
      throw error;
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      docker_id: this.docker_id,
      image: this.image,
      status: this.status,
      folder_path: this.folder_path,
      startup_script: this.startup_script,
      port_mappings: this.port_mappings,
      environment_vars: this.environment_vars,
      created_by: this.created_by,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

export default Container;
