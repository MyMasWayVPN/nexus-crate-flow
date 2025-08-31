# Nexus Crate Flow Backend

Backend API server untuk Container Management System yang memungkinkan pengelolaan container Docker melalui web interface.

## 🚀 Fitur Utama

- **Manajemen Container**: Buat, jalankan, hentikan, restart, dan hapus container Docker
- **Real-time Logs**: Streaming log per-container dengan WebSocket
- **File Management**: Browse, edit, upload, dan download file dalam container
- **Authentication**: JWT-based authentication dengan role-based access
- **Settings Management**: Konfigurasi startup script dan Cloudflare tunnel
- **Monitoring**: Health check dan statistik container
- **Auto-sync**: Sinkronisasi otomatis dengan Docker daemon

## 📋 Persyaratan Sistem

- Node.js >= 18.0.0
- Docker Engine
- SQLite3
- Linux/macOS/Windows dengan WSL2

## 🛠️ Instalasi

1. **Clone repository dan masuk ke direktori backend**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit file `.env` sesuai konfigurasi Anda:
   ```env
   PORT=3001
   NODE_ENV=development
   JWT_SECRET=your-super-secret-jwt-key
   DB_PATH=./database.sqlite
   DOCKER_SOCKET_PATH=/var/run/docker.sock
   ```

4. **Jalankan server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 🔧 Konfigurasi

### Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `PORT` | 3001 | Port server |
| `NODE_ENV` | development | Environment mode |
| `JWT_SECRET` | - | Secret key untuk JWT |
| `JWT_EXPIRES_IN` | 24h | Durasi token JWT |
| `DB_PATH` | ./database.sqlite | Path database SQLite |
| `DOCKER_SOCKET_PATH` | /var/run/docker.sock | Path Docker socket |
| `CONTAINER_BASE_PATH` | /home/containers | Base path untuk container |
| `LOG_LEVEL` | info | Level logging |

### Docker Configuration

Server akan otomatis mendeteksi Docker berdasarkan platform:
- **Linux/macOS**: Unix socket (`/var/run/docker.sock`)
- **Windows**: TCP connection (`127.0.0.1:2375`)

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/password` - Change password

### Container Management
- `GET /api/containers` - List containers
- `POST /api/containers` - Create container
- `GET /api/containers/:id` - Get container details
- `PUT /api/containers/:id` - Update container
- `DELETE /api/containers/:id` - Delete container
- `POST /api/containers/:id/start` - Start container
- `POST /api/containers/:id/stop` - Stop container
- `POST /api/containers/:id/restart` - Restart container

### Log Management
- `GET /api/logs/:id` - Get container logs
- `GET /api/logs/:id/stream` - WebSocket log streaming info
- `POST /api/logs/:id` - Add custom log entry
- `DELETE /api/logs/:id` - Clear logs
- `GET /api/logs/:id/download` - Download logs

### File Management
- `GET /api/files/:id` - List container files
- `GET /api/files/:id/download` - Download file
- `POST /api/files/:id/upload` - Upload files
- `DELETE /api/files/:id` - Delete file
- `POST /api/files/:id/create` - Create file/directory
- `PUT /api/files/:id/edit` - Edit file content

### Settings
- `GET /api/settings/:id` - Get container settings
- `PUT /api/settings/:id` - Update settings
- `POST /api/settings/:id/startup-script` - Update startup script
- `POST /api/settings/:id/execute-script` - Execute script
- `POST /api/settings/:id/tunnel/start` - Start Cloudflare tunnel
- `POST /api/settings/:id/tunnel/stop` - Stop tunnel

## 🔌 WebSocket API

Connect ke `ws://localhost:3001` untuk real-time features:

### Message Types

**Authentication**
```json
{
  "type": "authenticate",
  "token": "your-jwt-token"
}
```

**Subscribe to Container Logs**
```json
{
  "type": "subscribe_logs",
  "container_id": "container-id"
}
```

**Execute Command**
```json
{
  "type": "execute_command",
  "container_id": "container-id",
  "command": "ls -la",
  "working_dir": "/app"
}
```

## 🗄️ Database Schema

### Tables

- **users**: User accounts dan authentication
- **containers**: Container metadata dan konfigurasi
- **container_logs**: Application logs per container
- **container_settings**: Settings per container (Cloudflare, dll)
- **sessions**: JWT token blacklist untuk logout

## 📝 Logging

### Log Levels
- `error`: Error messages
- `warn`: Warning messages  
- `info`: Informational messages
- `debug`: Debug messages

### Log Files
- `logs/system.log`: System logs
- `logs/container-{id}/application.log`: Container application logs
- `logs/container-{id}/startup.log`: Container startup logs
- `logs/container-{id}/error.log`: Container error logs

## ⏰ Scheduled Tasks

- **Container Sync**: Setiap 5 menit - sync dengan Docker
- **Health Monitor**: Setiap 2 menit - monitor kesehatan container
- **Log Cleanup**: Harian jam 2 pagi - hapus log lama
- **Log Rotation**: Harian jam 1 pagi - rotasi log files
- **Orphan Cleanup**: Setiap jam - cleanup container orphan

## 🔒 Security

- JWT authentication dengan expiration
- Rate limiting per IP
- Input validation dan sanitization
- CORS protection
- Helmet security headers
- Password hashing dengan bcrypt

## 🚀 Deployment

### Production Setup

1. **Set environment ke production**
   ```env
   NODE_ENV=production
   ```

2. **Configure reverse proxy (Nginx)**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **Setup systemd service**
   ```ini
   [Unit]
   Description=Nexus Crate Flow Backend
   After=network.target
   
   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/path/to/backend
   ExecStart=/usr/bin/node server.js
   Restart=always
   
   [Install]
   WantedBy=multi-user.target
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3001

CMD ["npm", "start"]
```

## 🐛 Troubleshooting

### Common Issues

**Docker Connection Failed**
- Pastikan Docker daemon berjalan
- Check Docker socket permissions
- Untuk Windows, pastikan Docker Desktop running

**Database Locked**
- Restart server
- Check file permissions pada database.sqlite

**WebSocket Connection Failed**
- Check firewall settings
- Verify CORS configuration

### Debug Mode

```bash
LOG_LEVEL=debug npm run dev
```

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push ke branch
5. Create Pull Request

## 📄 License

MIT License - lihat file LICENSE untuk detail.

## 📞 Support

Untuk bantuan dan pertanyaan:
- Create issue di GitHub
- Email: support@nexus-crate-flow.com

---

**Nexus Crate Flow** - Container Management Made Simple 🐳
