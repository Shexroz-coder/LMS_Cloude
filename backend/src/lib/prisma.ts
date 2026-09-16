import { PrismaClient } from '@prisma/client';

// ═══════════════════════════════════════════════════════════
// Singleton PrismaClient
// MUHIM: Butun loyiha bo'yicha BITTA instansiya ishlatiladi.
// Ko'p instansiya = connection pool exhaustion = server crash!
// ═══════════════════════════════════════════════════════════
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// ═══════════════════════════════════════════════════════════
// ARXIV FILTRI (global middleware)
//
// Moliyaviy modellarda o'qish so'rovlari avtomatik ravishda
// faqat AKTIV (arxivlanmagan) yozuvlarni qaytaradi.
//
// Arxivlangan ma'lumotlarni ko'rish uchun so'rovda archiveId ni
// aniq ko'rsating:  where: { archiveId: 5 }
// Hammasini olish:  where: { archiveId: undefined } ('in' check ham o'tadi)
// ═══════════════════════════════════════════════════════════
const ARCHIVED_MODELS = new Set([
  'Payment', 'Expense', 'MonthlyFee', 'TeacherSalary', 'StaffSalary',
]);
const READ_ACTIONS = new Set([
  'findMany', 'findFirst', 'count', 'aggregate', 'groupBy',
]);

prisma.$use(async (params, next) => {
  if (params.model && ARCHIVED_MODELS.has(params.model) && READ_ACTIONS.has(params.action)) {
    params.args = params.args || {};
    const where = (params.args.where ?? {}) as Record<string, unknown>;
    if (!('archiveId' in where)) {
      where.archiveId = null; // faqat aktiv yozuvlar
      params.args.where = where;
    }
  }
  return next(params);
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
