import { PrismaClient } from '@prisma/client';

// ═══════════════════════════════════════════════════════════
// Singleton PrismaClient
// MUHIM: Butun loyiha bo'yicha BITTA instansiya ishlatiladi.
// Ko'p instansiya = connection pool exhaustion = server crash!
// ═══════════════════════════════════════════════════════════
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
