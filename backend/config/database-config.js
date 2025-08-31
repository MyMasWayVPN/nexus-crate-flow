// Database configuration selector
import { initializeDatabase as initializeSQLite } from './database.js';
import { initializeMySQLDatabase } from './database-mysql.js';
import { initializePostgreSQLDatabase } from './database-postgresql.js';

const DATABASE_TYPE = process.env.DATABASE_TYPE || 'sqlite';

export async function initializeDatabaseByType() {
  console.log(`🔧 Initializing ${DATABASE_TYPE.toUpperCase()} database...`);
  
  switch (DATABASE_TYPE.toLowerCase()) {
    case 'mysql':
      return await initializeMySQLDatabase();
    
    case 'postgresql':
    case 'postgres':
      return await initializePostgreSQLDatabase();
    
    case 'sqlite':
    default:
      return await initializeSQLite();
  }
}

export function getDatabaseConfig() {
  const config = {
    type: DATABASE_TYPE,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    path: process.env.DB_PATH
  };

  // Remove undefined values
  Object.keys(config).forEach(key => {
    if (config[key] === undefined) {
      delete config[key];
    }
  });

  return config;
}

export function validateDatabaseConfig() {
  const type = DATABASE_TYPE.toLowerCase();
  
  if (type === 'mysql' || type === 'postgresql' || type === 'postgres') {
    const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const missing = required.filter(env => !process.env[env]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables for ${type}: ${missing.join(', ')}`);
    }
  }
  
  console.log(`✅ Database configuration validated for ${type}`);
  return true;
}

export default initializeDatabaseByType;
