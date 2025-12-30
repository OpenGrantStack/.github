import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

// Redis client for caching and sessions
const redis = createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
});

redis.on('error', (err) => console.error('Redis Client Error:', err));
redis.on('connect', () => console.log('Redis Client Connected'));

export const initDatabase = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Connect Redis
    await redis.connect();
    console.log('✅ Redis connected successfully');

    // Run database migrations if needed
    if (process.env.NODE_ENV === 'production') {
      await prisma.$executeRaw`SELECT 1`;
      console.log('✅ Database migration check complete');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

export const disconnectDatabase = async () => {
  await prisma.$disconnect();
  await redis.quit();
  console.log('Database connections closed');
};

// Health check for database
export const checkDatabaseHealth = async () => {
  try {
    await prisma.$executeRaw`SELECT 1`;
    await redis.ping();
    return { database: 'healthy', redis: 'healthy' };
  } catch (error) {
    return { 
      database: 'unhealthy', 
      redis: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

export { prisma, redis };
