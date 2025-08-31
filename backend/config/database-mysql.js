import mysql from 'mysql2/promise';
import { promisify } from 'util';

class MySQLDatabase {
  constructor() {
    this.connection = null;
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'container_manager',
      charset: 'utf8mb4',
      timezone: '+00:00',
      acquireTimeout: 60000,
      timeout: 60000,
      reconnect: true
    };
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection(this.config);
      console.log('✅ Connected to MySQL database');
      
      // Test connection
      await this.connection.ping();
      console.log('✅ MySQL connection is alive');
      
      return this.connection;
    } catch (error) {
      console.error('❌ Error connecting to MySQL:', error);
      throw error;
    }
  }

  async query(sql, params = []) {
    try {
      const [rows] = await this.connection.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('❌ MySQL Query Error:', error);
      throw error;
    }
  }

  async run(sql, params = []) {
    try {
      const [result] = await this.connection.execute(sql, params);
      return {
        id: result.insertId,
        changes: result.affectedRows,
        result
      };
    } catch (error) {
      console.error('❌ MySQL Run Error:', error);
      throw error;
    }
  }

  async get(sql, params = []) {
    try {
      const [rows] = await this.connection.execute(sql, params);
      return rows[0] || null;
    } catch (error) {
      console.error('❌ MySQL Get Error:', error);
      throw error;
    }
  }

  async all(sql, params = []) {
    try {
      const [rows] = await this.connection.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('❌ MySQL All Error:', error);
      throw error;
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.end();
      console.log('✅ MySQL connection closed');
    }
  }

  async createDatabase() {
    try {
      // Connect without database first
      const tempConnection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password
      });

      // Create database if not exists
      await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${this.config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`✅ Database '${this.config.database}' created/verified`);
      
      await tempConnection.end();
    } catch (error) {
      console.error('❌ Error creating database:', error);
      throw error;
    }
  }

  async createTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        role ENUM('admin', 'user') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Containers table
      `CREATE TABLE IF NOT EXISTS containers (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        docker_id VARCHAR(255) UNIQUE,
        image VARCHAR(255) NOT NULL,
        status ENUM('running', 'stopped', 'paused', 'restarting', 'removing', 'dead', 'created', 'exited') DEFAULT 'stopped',
        folder_path TEXT,
        startup_script TEXT,
        port_mappings JSON,
        environment_vars JSON,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_created_by (created_by),
        INDEX idx_docker_id (docker_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Container logs table
      `CREATE TABLE IF NOT EXISTS container_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        container_id VARCHAR(255) NOT NULL,
        log_content TEXT NOT NULL,
        log_type ENUM('info', 'error', 'warning', 'debug') DEFAULT 'info',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE,
        INDEX idx_container_id (container_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_log_type (log_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Container settings table
      `CREATE TABLE IF NOT EXISTS container_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        container_id VARCHAR(255) NOT NULL UNIQUE,
        cloudflare_token VARCHAR(500),
        tunnel_enabled BOOLEAN DEFAULT FALSE,
        tunnel_url VARCHAR(500),
        auto_restart BOOLEAN DEFAULT TRUE,
        max_memory VARCHAR(50),
        max_cpu VARCHAR(50),
        settings_json JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE,
        INDEX idx_container_id (container_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Sessions table for JWT blacklisting
      `CREATE TABLE IF NOT EXISTS sessions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_expires_at (expires_at),
        INDEX idx_token_hash (token_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // System settings table
      `CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_setting_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    console.log('✅ MySQL database tables created/verified');
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

// Initialize MySQL Database
export async function initializeMySQLDatabase() {
  const database = new MySQLDatabase();
  await database.createDatabase();
  await database.connect();
  await database.createTables();
  await database.seedDefaultData();
  return database;
}

export { MySQLDatabase };
export default MySQLDatabase;
