#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { initializeDatabase } from './config/database.js';
import { User } from './models/User.js';
import logger from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Setup {
  constructor() {
    this.requiredDirs = [
      'logs',
      'uploads',
      'containers',
      'backups'
    ];
  }

  async run() {
    console.log('🚀 Starting Nexus Crate Flow Backend Setup...\n');

    try {
      await this.checkEnvironment();
      await this.createDirectories();
      await this.setupDatabase();
      await this.createDefaultUser();
      await this.checkDocker();
      await this.finalizeSetup();

      console.log('\n✅ Setup completed successfully!');
      console.log('\n🎯 Next steps:');
      console.log('1. Review your .env file configuration');
      console.log('2. Ensure Docker is running');
      console.log('3. Start the server: npm run dev');
      console.log('4. Access the API at: http://localhost:3001');
      console.log('5. Check health: http://localhost:3001/health\n');

    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    }
  }

  async checkEnvironment() {
    console.log('🔍 Checking environment...');

    // Check if .env exists
    const envPath = path.join(__dirname, '.env');
    const envExamplePath = path.join(__dirname, '.env.example');

    try {
      await fs.access(envPath);
      console.log('✅ .env file found');
    } catch {
      console.log('📝 Creating .env file from template...');
      try {
        const envExample = await fs.readFile(envExamplePath, 'utf8');
        await fs.writeFile(envPath, envExample);
        console.log('✅ .env file created');
        console.log('⚠️  Please review and update the .env file with your configuration');
      } catch (error) {
        throw new Error('Failed to create .env file: ' + error.message);
      }
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      throw new Error(`Node.js version ${nodeVersion} is not supported. Please use Node.js 18 or higher.`);
    }
    
    console.log(`✅ Node.js version ${nodeVersion} is supported`);
  }

  async createDirectories() {
    console.log('\n📁 Creating required directories...');

    for (const dir of this.requiredDirs) {
      const dirPath = path.join(__dirname, dir);
      
      try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dir}/`);
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw new Error(`Failed to create directory ${dir}: ${error.message}`);
        }
        console.log(`✅ Directory already exists: ${dir}/`);
      }
    }

    // Create container subdirectories
    const containerSubDirs = ['data', 'logs', 'configs'];
    for (const subDir of containerSubDirs) {
      const dirPath = path.join(__dirname, 'containers', subDir);
      try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`✅ Created container subdirectory: containers/${subDir}/`);
      } catch (error) {
        if (error.code !== 'EEXIST') {
          console.warn(`⚠️  Warning: Could not create containers/${subDir}/: ${error.message}`);
        }
      }
    }
  }

  async setupDatabase() {
    console.log('\n🗄️  Setting up database...');

    try {
      await initializeDatabase();
      console.log('✅ Database initialized successfully');
    } catch (error) {
      throw new Error('Database setup failed: ' + error.message);
    }
  }

  async createDefaultUser() {
    console.log('\n👤 Setting up default user...');

    try {
      // Check if any users exist
      const existingUsers = await User.findAll();
      
      if (existingUsers.length > 0) {
        console.log('✅ Users already exist in database');
        return;
      }

      // Create default admin user
      const defaultUsername = 'admin';
      const defaultPassword = 'admin123';
      
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);
      
      await User.create({
        username: defaultUsername,
        password: hashedPassword,
        role: 'admin'
      });

      console.log('✅ Default admin user created');
      console.log(`   Username: ${defaultUsername}`);
      console.log(`   Password: ${defaultPassword}`);
      console.log('⚠️  IMPORTANT: Please change the default password after first login!');

    } catch (error) {
      throw new Error('Failed to create default user: ' + error.message);
    }
  }

  async checkDocker() {
    console.log('\n🐳 Checking Docker availability...');

    try {
      const { spawn } = await import('child_process');
      
      const dockerCheck = spawn('docker', ['--version']);
      
      await new Promise((resolve, reject) => {
        dockerCheck.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Docker is available');
            resolve();
          } else {
            console.log('⚠️  Docker is not available or not running');
            console.log('   Please ensure Docker is installed and running');
            console.log('   The application will still start but container management will not work');
            resolve(); // Don't fail setup, just warn
          }
        });

        dockerCheck.on('error', (error) => {
          console.log('⚠️  Docker check failed:', error.message);
          console.log('   Please ensure Docker is installed and running');
          resolve(); // Don't fail setup, just warn
        });
      });

    } catch (error) {
      console.log('⚠️  Could not check Docker:', error.message);
    }
  }

  async finalizeSetup() {
    console.log('\n🔧 Finalizing setup...');

    // Create a setup completion marker
    const setupMarkerPath = path.join(__dirname, '.setup-complete');
    const setupInfo = {
      completed_at: new Date().toISOString(),
      version: '1.0.0',
      node_version: process.version,
      platform: process.platform
    };

    try {
      await fs.writeFile(setupMarkerPath, JSON.stringify(setupInfo, null, 2));
      console.log('✅ Setup completion marker created');
    } catch (error) {
      console.warn('⚠️  Could not create setup marker:', error.message);
    }

    // Log setup completion
    try {
      await logger.info('Backend setup completed successfully', setupInfo);
    } catch (error) {
      console.warn('⚠️  Could not log setup completion:', error.message);
    }
  }

  // Static method to check if setup has been completed
  static async isSetupComplete() {
    try {
      const setupMarkerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.setup-complete');
      await fs.access(setupMarkerPath);
      return true;
    } catch {
      return false;
    }
  }

  // Static method to get setup info
  static async getSetupInfo() {
    try {
      const setupMarkerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.setup-complete');
      const setupData = await fs.readFile(setupMarkerPath, 'utf8');
      return JSON.parse(setupData);
    } catch {
      return null;
    }
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new Setup();
  setup.run().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

export default Setup;
