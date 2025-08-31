import pkg from 'pg';
const { Pool } = pkg;

class PostgreSQLDatabase {
  constructor() {
    this.pool = null;
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'container_manager',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  }

  async connect() {
    try {
      this.pool = new Pool(this.config);
      
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      console.log('✅ Connected to PostgreSQL database');
      return this.pool;
    } catch (error) {
      console.error('❌ Error connecting to PostgreSQL:', error);
      throw error;
    }
  }

  async query(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('❌ PostgreSQL Query Error:', error);
      throw error;
    }
  }

  async run(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      return {
        id: result.rows[0]?.id || null,
        changes: result.rowCount,
        result
      };
    } catch (error) {
      console.error('❌ PostgreSQL Run Error:', error);
      throw error;
    }
  }

  async get(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ PostgreSQL Get Error:', error);
      throw error;
    }
  }

  async all(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('❌ PostgreSQL All Error:', error);
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('✅ PostgreSQL connection pool closed');
    }
  }

  async createDatabase() {
    try {
      // Connect to default postgres database first
      const tempPool = new Pool({
        ...this.config,
        database: 'postgres'
      });

      // Create database if not exists
      await tempPool.query(`CREATE DATABASE "${this.config.database}"`);
      console.log(`✅ Database '${this.config.database}' created/verified`);
      
      await tempPool.end();
    } catch (error) {
      if (error.code === '42P04') {
        // Database already exists
        console.log(`✅ Database '${this.config.database}' already exists`);
      } else {
        console.error('❌ Error creating database:', error);
        throw error;
      }
    }
  }

  async createTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Create trigger for updated_at
      `CREATE OR REPLACE FUNCTION update_updated_at_column()
       RETURNS TRIGGER AS $$
       BEGIN
         NEW.updated_at = CURRENT_TIMESTAMP;
         RETURN NEW;
       END;
       $$ language 'plpgsql'`,

      `DROP TRIGGER IF EXISTS update_users_updated_at ON users`,
      `CREATE TRIGGER update_users_updated_at 
       BEFORE UPDATE ON users 
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

      // Containers table
      `CREATE TABLE IF NOT EXISTS containers (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        docker_id VARCHAR(255) UNIQUE,
        image VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'stopped' CHECK (status IN ('running', 'stopped', 'paused', 'restarting', 'removing', 'dead', 'created', 'exited')),
        folder_path TEXT,
        startup_script TEXT,
        port_mappings JSONB,
        environment_vars JSONB,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `DROP TRIGGER IF EXISTS update_containers_updated_at ON containers`,
      `CREATE TRIGGER update_containers_updated_at 
       BEFORE UPDATE ON containers 
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

      // Container logs table
      `CREATE TABLE IF NOT EXISTS container_logs (
        id BIGSERIAL PRIMARY KEY,
        container_id VARCHAR(255) NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
        log_content TEXT NOT NULL,
        log_type VARCHAR(50) DEFAULT 'info' CHECK (log_type IN ('info', 'error', 'warning', 'debug')),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Container settings table
      `CREATE TABLE IF NOT EXISTS container_settings (
        id SERIAL PRIMARY KEY,
        container_id VARCHAR(255) NOT NULL UNIQUE REFERENCES containers(id) ON DELETE CASCADE,
        cloudflare_token VARCHAR(500),
        tunnel_enabled BOOLEAN DEFAULT FALSE,
        tunnel_url VARCHAR(500),
        auto_restart BOOLEAN DEFAULT TRUE,
        max_memory VARCHAR(50),
        max_cpu VARCHAR(50),
        settings_json JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `DROP TRIGGER IF EXISTS update_container_settings_updated_at ON container_settings`,
      `CREATE TRIGGER update_container_settings_updated_at 
       BEFORE UPDATE ON container_settings 
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

      // Sessions table for JWT blacklisting
      `CREATE TABLE IF NOT EXISTS sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // System settings table
      `CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings`,
      `CREATE TRIGGER update_system_settings_updated_at 
       BEFORE UPDATE ON system_settings 
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
      'CREATE INDEX IF NOT EXISTS idx_containers_status ON containers(status)',
      'CREATE INDEX IF NOT EXISTS idx_containers_created_by ON containers(created_by)',
      'CREATE INDEX IF NOT EXISTS idx_containers_docker_id ON containers(docker_id)',
      'CREATE INDEX IF NOT EXISTS idx_container_logs_container_id ON container_logs(container_id)',
      'CREATE INDEX IF NOT EXISTS idx_container_logs_timestamp ON container_logs(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_container_logs_log_type ON container_logs(log_type)',
      'CREATE INDEX IF NOT EXISTS idx_container_settings_container_id ON container_settings(container_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)',
      'CREATE INDEX IF NOT EXISTS idx_system_settings_setting_key ON system_settings(setting_key)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }

    console.log('✅ PostgreSQL database tables and indexes created/verified');
  }

  async seedDefaultData() {
    // Check if admin user exists
    const adminUser = await this.get('SELECT id FROM users WHERE username = $1', ['admin']);
    
    if (!adminUser) {
      // Create default admin user (password: admin123)
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash('admin123', 12);
      
      await this.run(
        'INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4)',
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
      const existing = await this.get('SELECT id FROM system_settings WHERE setting_key = $1', [key]);
      if (!existing) {
        await this.run(
          'INSERT INTO system_settings (setting_key, setting_value, description) VALUES ($1, $2, $3)',
          [key, value, description]
        );
      }
    }

    console.log('✅ Default system settings created');
  }
}

// Initialize PostgreSQL Database
export async function initializePostgreSQLDatabase() {
  const database = new PostgreSQLDatabase();
  await database.createDatabase();
  await database.connect();
  await database.createTables();
  await database.seedDefaultData();
  return database;
}

export { PostgreSQLDatabase };
export default PostgreSQLDatabase;
