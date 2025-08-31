# Nexus Crate Flow - Container Management System

A modern, full-stack container management system built with React, TypeScript, Node.js, and Docker. This application provides a web-based interface for managing Docker containers on a VPS with real-time monitoring, file management, and console access.

## 🚀 Features

### Container Management
- **Create, Start, Stop, Restart, Delete** containers
- **Real-time status monitoring** with auto-refresh
- **Per-container isolated logging** system
- **Health monitoring** with automatic restart capabilities
- **Resource monitoring** (CPU, Memory, Network)

### Real-time Console
- **Live log streaming** via WebSocket connections
- **Per-container log isolation** - each container has separate logs
- **Interactive console** with command execution
- **Log download and management** features
- **Auto-scrolling terminal** with connection status

### File Management
- **Browse container file systems** with intuitive interface
- **Upload/Download files** to/from containers
- **Edit text files** directly in the browser
- **Create directories** and manage folder structures
- **File search functionality** across container files

### Authentication & Security
- **JWT-based authentication** with secure token management
- **Role-based access control** for different user levels
- **Password hashing** with bcrypt
- **Rate limiting** and input validation
- **Secure API endpoints** with proper error handling

### Settings & Configuration
- **Startup script configuration** per container
- **Cloudflare tunnel integration** for secure access
- **Environment variables management**
- **Container resource limits** configuration
- **Backup and restore** functionality

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Modern React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** with shadcn/ui components
- **React Query** for state management
- **Context API** for authentication and container state
- **WebSocket integration** for real-time features

### Backend (Node.js + Express)
- **Express.js** REST API server
- **SQLite** database for lightweight deployment
- **Docker API integration** for container management
- **WebSocket server** for real-time communication
- **JWT authentication** with middleware
- **Comprehensive logging** and error handling

### Container Integration
- **Docker Engine API** for direct container control
- **Per-container log isolation** with separate log files
- **Real-time log streaming** with WebSocket connections
- **Container health monitoring** and auto-restart
- **File system access** for each container

## 📦 Installation

### Prerequisites
- **Node.js** (v18 or higher)
- **Docker** (running and accessible)
- **npm** or **yarn** package manager

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nexus-crate-flow
   ```

2. **Install dependencies**
   ```bash
   npm run setup
   ```

3. **Start development environment**
   ```bash
   npm run start:dev
   ```

This will start both the frontend (http://localhost:5173) and backend (http://localhost:3001) servers.

### Manual Setup

1. **Install frontend dependencies**
   ```bash
   npm install
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Frontend (.env)
   cp .env.example .env
   
   # Backend (backend/.env)
   cp backend/.env.example backend/.env
   ```

4. **Start services separately**
   ```bash
   # Terminal 1 - Backend
   npm run backend
   
   # Terminal 2 - Frontend
   npm run frontend
   ```

## 🔧 Configuration

### Frontend Environment Variables (.env)
```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
VITE_APP_NAME=Container Manager
VITE_APP_VERSION=1.0.0
```

### Backend Environment Variables (backend/.env)
```env
# Server Configuration
PORT=3001
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Database
DATABASE_PATH=./database.sqlite

# Docker Configuration
DOCKER_SOCKET_PATH=/var/run/docker.sock
CONTAINER_DATA_PATH=/var/lib/docker/containers

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=100MB
UPLOAD_PATH=./uploads
```

## 🎯 Usage

### Default Credentials
- **Username**: `admin`
- **Password**: `admin123`

### Container Management
1. **Login** with your credentials
2. **View containers** on the dashboard
3. **Create new containers** using the "+" button
4. **Click on containers** to access console, files, or settings
5. **Monitor status** in real-time with automatic updates

### Console Access
- **Real-time logs** stream automatically via WebSocket
- **Start/Stop/Restart** containers with control buttons
- **Download logs** for offline analysis
- **Clear logs** when needed
- **Connection status** indicator shows WebSocket health

### File Management
- **Browse files** in container file systems
- **Upload files** by dragging and dropping
- **Download files** by clicking on them
- **Edit text files** directly in the browser
- **Create folders** and organize files

### Settings Configuration
- **Configure startup scripts** for automatic container initialization
- **Setup Cloudflare tunnels** for secure external access
- **Manage environment variables** per container
- **Set resource limits** (CPU, Memory)
- **Configure backup schedules**

## 🚀 Deployment

### VPS Deployment

1. **Prepare VPS**
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd nexus-crate-flow
   npm run setup
   ```

3. **Configure for production**
   ```bash
   # Update backend/.env
   NODE_ENV=production
   JWT_SECRET=your-production-secret
   
   # Build frontend
   npm run build
   ```

4. **Start with PM2**
   ```bash
   npm install -g pm2
   cd backend
   pm2 start server.js --name "container-manager"
   pm2 startup
   pm2 save
   ```

### Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY . .
   RUN npm run setup
   RUN npm run build
   EXPOSE 3001
   CMD ["npm", "start"]
   ```

2. **Build and run**
   ```bash
   docker build -t container-manager .
   docker run -d -p 3001:3001 -v /var/run/docker.sock:/var/run/docker.sock container-manager
   ```

## 🔍 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/change-password` - Change password

### Container Endpoints
- `GET /api/containers` - List all containers
- `POST /api/containers` - Create new container
- `GET /api/containers/:id` - Get container details
- `PUT /api/containers/:id` - Update container
- `DELETE /api/containers/:id` - Delete container
- `POST /api/containers/:id/start` - Start container
- `POST /api/containers/:id/stop` - Stop container
- `POST /api/containers/:id/restart` - Restart container

### Log Endpoints
- `GET /api/logs/:containerId` - Get container logs
- `GET /api/logs/:containerId/download` - Download logs
- `DELETE /api/logs/:containerId` - Clear logs
- `WebSocket /logs/:containerId` - Real-time log streaming

### File Endpoints
- `GET /api/files/:containerId` - List container files
- `POST /api/files/:containerId/upload` - Upload file
- `GET /api/files/:containerId/download` - Download file
- `PUT /api/files/:containerId` - Update file content
- `DELETE /api/files/:containerId` - Delete file

### Settings Endpoints
- `GET /api/settings/:containerId` - Get container settings
- `PUT /api/settings/:containerId` - Update container settings
- `POST /api/settings/:containerId/tunnel` - Configure tunnel

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run start:dev          # Start both frontend and backend
npm run frontend           # Start frontend only
npm run backend           # Start backend only

# Building
npm run build             # Build frontend for production
npm run build:dev         # Build frontend for development

# Setup
npm run setup            # Install all dependencies
```

### Project Structure

```
nexus-crate-flow/
├── src/                     # Frontend source code
│   ├── components/          # React components
│   ├── contexts/           # React contexts
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utilities
│   ├── pages/              # Page components
│   └── services/           # API services
├── backend/                # Backend source code
│   ├── config/             # Configuration files
│   ├── middleware/         # Express middleware
│   ├── models/             # Database models
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   └── utils/              # Utilities
├── public/                 # Static assets
└── docs/                   # Documentation
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, please open an issue on GitHub or contact the development team.

## 🔄 Changelog

### v1.0.0 (Current)
- Initial release with full container management
- Real-time console with per-container log isolation
- File management system
- Authentication and security features
- WebSocket integration for real-time updates
- Cloudflare tunnel integration
- Comprehensive API documentation

---

**Built with ❤️ for modern container management**
