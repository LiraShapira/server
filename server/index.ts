import app from './server';
const PORT = process.env.PORT || 3001;
import { PrismaClient } from '@prisma/client'
export const prisma = new PrismaClient()

app.listen(PORT, () => {
  console.log(`server available on http://localhost:${PORT}/`);
});
