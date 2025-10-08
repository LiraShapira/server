import app from './server';
import { PrismaClient } from '@prisma/client';

const PORT = Number(process.env.PORT) || 3001;

// Temporary Prisma client for backward compatibility during migration
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
});

console.log('Server starting with Supabase client...');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server available on http://0.0.0.0:${PORT}/`);
});
