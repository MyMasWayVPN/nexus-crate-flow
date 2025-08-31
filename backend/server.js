import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';

// Import configurations
import { initializeDatabase } from './config/database.js';
import { initializeDocker } from './config/docker.js';

// Import middleware
import { authenticateToken } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import containerRoutes from './routes/containers.js';
import fileRoutes from './routes/files.js';
import settingsRoutes from './routes/settings.js';
import logRoutes from './routes/logs.js';

// Import services
import { LogService } from './services/logService.js';
import { WebSocketService } from './services/websocketService.js';
import { DockerService } from './services/dockerService.js';

// Import utilities
import logger from './utils/logger.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/containers', authenticateToken, containerRoutes);
app.use('/api/files', authenticateToken, fileRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/logs', authenticateToken, logRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize WebSocket Server
const wss = new WebSocketServer({ server });
const wsService = new WebSocketService(wss);

// Initialize services
async function initializeServices() {
  try {
    console.log('🔧 Initializing database...');
    await initializeDatabase();
    
    console.log('🐳 Initializing Docker connection...');
    await initializeDocker();
    
    console.log('📝 Initializing log service...');
    const logService = await LogService.initialize();
    
    console.log('🔌 Initializing WebSocket service...');
    wsService.initialize();
    
    // Setup scheduled tasks
    setupScheduledTasks(logService);
    
    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    await logger.error('Failed to initialize services', { error: error.message });
    process.exit(1);
  }
}

// Setup scheduled tasks
function setupScheduledTasks(logService) {
  // Sync containers with Docker every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await DockerService.syncContainers();
    } catch (error) {
      await logger.error('Container sync failed', { error: error.message });
    }
  });

  // Monitor container health every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    try {
      await DockerService.monitorContainerHealth();
    } catch (error) {
      await logger.error('Container health monitoring failed', { error: error.message });
    }
  });

  // Cleanup old logs daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      await logService.cleanupOldLogs();
      await logger.cleanupOldLogs();
    } catch (error) {
      await logger.error('Log cleanup failed', { error: error.message });
    }
  });

  // Rotate logs daily at 1 AM
  cron.schedule('0 1 * * *', async () => {
    try {
      await logger.rotateLogs();
    } catch (error) {
      console.error('Log rotation failed:', error);
    }
  });

  // Cleanup orphaned containers every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await DockerService.cleanupOrphanedContainers();
    } catch (error) {
      await logger.error('Orphaned container cleanup failed', { error: error.message });
    }
  });

  // WebSocket cleanup every 10 minutes
  cron.schedule('*/10 * * * *', () => {
    try {
      wsService.cleanup();
    } catch (error) {
      logger.error('WebSocket cleanup failed', { error: error.message });
    }
  });

  console.log('⏰ Scheduled tasks configured');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start server
async function startServer() {
  await initializeServices();
  
  server.listen(PORT, () => {
    console.log(`
🚀 Nexus Crate Flow Backend Server Started
📍 Environment: ${process.env.NODE_ENV}
🌐 Server running on: http://localhost:${PORT}
🔗 Health check: http://localhost:${PORT}/health
📡 WebSocket server ready for real-time connections
    `);
  });
}

startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

export default app;
