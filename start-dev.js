#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting Nexus Crate Flow Development Environment...\n');

// Check if backend dependencies are installed
const backendNodeModules = join(__dirname, 'backend', 'node_modules');
if (!fs.existsSync(backendNodeModules)) {
  console.log('📦 Installing backend dependencies...');
  const backendInstall = spawn('npm', ['install'], {
    cwd: join(__dirname, 'backend'),
    stdio: 'inherit',
    shell: true
  });
  
  backendInstall.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Backend dependencies installed\n');
      startServices();
    } else {
      console.error('❌ Failed to install backend dependencies');
      process.exit(1);
    }
  });
} else {
  startServices();
}

function startServices() {
  // Check if .env files exist
  const frontendEnv = join(__dirname, '.env');
  const backendEnv = join(__dirname, 'backend', '.env');
  
  if (!fs.existsSync(frontendEnv)) {
    console.log('📝 Creating frontend .env file...');
    fs.copyFileSync(join(__dirname, '.env.example'), frontendEnv);
  }
  
  if (!fs.existsSync(backendEnv)) {
    console.log('📝 Creating backend .env file...');
    fs.copyFileSync(join(__dirname, 'backend', '.env.example'), backendEnv);
  }

  // Start backend server
  console.log('🔧 Starting backend server...');
  const backend = spawn('npm', ['run', 'dev'], {
    cwd: join(__dirname, 'backend'),
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });

  backend.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[Backend] ${output.trim()}`);
  });

  backend.stderr.on('data', (data) => {
    const output = data.toString();
    console.error(`[Backend Error] ${output.trim()}`);
  });

  // Wait a bit for backend to start, then start frontend
  setTimeout(() => {
    console.log('🎨 Starting frontend development server...');
    const frontend = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true
    });

    frontend.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Frontend] ${output.trim()}`);
    });

    frontend.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`[Frontend Error] ${output.trim()}`);
    });

    frontend.on('close', (code) => {
      console.log(`Frontend process exited with code ${code}`);
      backend.kill();
      process.exit(code);
    });

  }, 3000);

  backend.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
    process.exit(code);
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down development servers...');
    backend.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down development servers...');
    backend.kill();
    process.exit(0);
  });
}
