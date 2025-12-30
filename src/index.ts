import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { config } from './config/middleware';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';

// Controllers
import { userController } from './users/controller';
import { roleController } from './roles/controller';
import { approvalController } from './approvals/controller';
import { activityController } from './activity/controller';

// Database
import { initDatabase } from './config/database';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.cors.origin,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.window,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use('/api/v1/users', apiLimiter, userController);
app.use('/api/v1/roles', apiLimiter, authMiddleware, roleController);
app.use('/api/v1/approvals', apiLimiter, authMiddleware, approvalController);
app.use('/api/v1/activity', apiLimiter, authMiddleware, activityController);

// WebSocket for real-time updates
io.use((socket, next) => {
  // Authentication middleware for WebSocket
  const token = socket.handshake.auth.token;
  // Add authentication logic here
  next();
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe', (room: string) => {
    socket.join(room);
  });

  socket.on('unsubscribe', (room: string) => {
    socket.leave(room);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Database initialization and server start
const startServer = async () => {
  try {
    await initDatabase();
    
    const PORT = config.port;
    httpServer.listen(PORT, () => {
      console.log(`
      🚀 GrantReady Hub Server Started
      📍 Port: ${PORT}
      🌍 Environment: ${process.env.NODE_ENV}
      📅 ${new Date().toISOString()}
      
      API Documentation: http://localhost:${PORT}/api-docs
      Health Check: http://localhost:${PORT}/health
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = () => {
  console.log('Received shutdown signal, closing server gracefully...');
  
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
if (require.main === module) {
  startServer();
}

export { app, io };
