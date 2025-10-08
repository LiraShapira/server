import app from './server';
import { PrismaClient } from '@prisma/client';

const PORT = Number(process.env.PORT) || 3001;

// Create Prisma client with connection pooling and retry configuration
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
});

// Connection retry logic
let isConnected = false;
const maxRetries = 5;
let retryCount = 0;

async function connectWithRetry() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
    isConnected = true;
    retryCount = 0;
  } catch (error) {
    console.error(`Database connection failed (attempt ${retryCount + 1}/${maxRetries}):`, error);
    retryCount++;
    
    if (retryCount < maxRetries) {
      console.log(`Retrying connection in ${retryCount * 2} seconds...`);
      setTimeout(connectWithRetry, retryCount * 2000);
    } else {
      console.error('Max retry attempts reached. Exiting...');
      process.exit(1);
    }
  }
}

// Initial connection
connectWithRetry();

// Health check function moved to utils/healthCheck.ts to avoid circular imports

// Periodic health check and reconnection
setInterval(async () => {
  if (!isConnected) {
    console.log('Attempting to reconnect to database...');
    await connectWithRetry();
  } else {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      console.log('Database health check failed, marking as disconnected');
      isConnected = false;
    }
  }
}, 30000); // Check every 30 seconds

// Add graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server available on http://0.0.0.0:${PORT}/`);
});
