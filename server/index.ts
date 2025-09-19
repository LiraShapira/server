import app from './server';
import { PrismaClient } from '@prisma/client'

const PORT = Number(process.env.PORT) || 3001;
export const prisma = new PrismaClient()

app.listen(PORT, '0.0.0.0', () => {
  console.log(`server available on http://0.0.0.0:${PORT}/`);
});
