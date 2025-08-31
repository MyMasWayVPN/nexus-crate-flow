import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || './database.sqlite';

class Database {
  constructor() {
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('❌ Error opening database:', err);
          reject(err);
        } else {
          console.log('✅ Connected to SQLite database');
          resolve();
        }
      });
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Database connection closed');
          resolve();
        }
      });
    });
  }

  async createTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Containers table
      `CREATE TABLE IF NOT EXISTS containers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        docker_id TEXT UNIQUE,
        image TEXT NOT NULL,
        status TEXT DEFAULT 'stopped',
        folder_path TEXT,
        startup_script TEXT,
        port_mappings TEXT, -- JSON string
        environment_vars TEXT, -- JSON string
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
      )`,

      // Container logs table
      `CREATE TABLE IF NOT EXISTS container_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        container_id TEXT NOT NULL,
        log_content TEXT NOT NULL,
        log_type TEXT DEFAULT 'info', -- info, error, warning, debug
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (container_id) REFERENCES containers (id) ON DELETE CASCADE
      )`,

      // Container settings table
      `CREATE TABLE IF NOT EXISTS container_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        container_id TEXT NOT NULL UNIQUE,
        cloudflare_token TEXT,
        tunnel_enabled BOOLEAN DEFAULT 0,
        tunnel_url TEXT,
        auto_restart BOOLEAN DEFAULT 1,
        max_memory TEXT,
        max_cpu TEXT,
        settings_json TEXT, -- Additional JSON settings
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (container_id) REFERENCES containers (id) ON DELETE CASCADE
      )`,

      // Sessions table for JWT blacklisting
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )`,

      // System settings table
      `CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    console.log('✅ Database tables created/verified');
  }

  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_containers_status ON containers(status)',
      'CREATE INDEX IF NOT EXISTS idx_containers_created_by ON containers(created_by)',
      'CREATE INDEX IF NOT EXISTS idx_container_logs_container_id ON container_logs(container_id)',
      'CREATE INDEX IF NOT EXISTS idx_container_logs_timestamp ON container_logs(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }

    console.log('✅ Database indexes created/verified');
  }

  async seedDefaultData() {
    // Check if admin user exists
    const adminUser = await this.get('SELECT id FROM users WHERE username = ?', ['admin']);
    
    if (!adminUser) {
      // Create default admin user (password: admin123)
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash('admin123', 12);
      
      await this.run(
        'INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)',
        ['admin', hashedPassword, 'admin@localhost', 'admin']
      );

      console.log('✅ Default admin user created (username: admin, password: admin123)');
    }

    // Insert default system settings
    const defaultSettings = [
      ['max_containers', '50', 'Maximum number of containers allowed'],
      ['default_memory_limit', '512m', 'Default memory limit for containers'],
      ['default_cpu_limit', '1', 'Default CPU limit for containers'],
      ['log_retention_days', '30', 'Number of days to retain container logs']
    ];

    for (const [key, value, description] of defaultSettings) {
      const existing = await this.get('SELECT id FROM system_settings WHERE setting_key = ?', [key]);
      if (!existing) {
        await this.run(
          'INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
          [key, value, description]
        );
      }
    }

    console.log('✅ Default system settings created');
  }
}

// Singleton instance
const database = new Database();

export async function initializeDatabase() {
  await database.connect();
  await database.createTables();
  await database.createIndexes();
  await database.seedDefaultData();
  return database;
}

export { database };
export default database;
