/**
 * Oylik qarzdorlik hisoblash cron job
 * Har oy 1-sanasi soat 00:01 da ishga tushadi
 *
 * Mantiq:
 * - Har bir ACTIVE o'quvchining guruhlaridagi kurs narxini tekshirish
 * - Chegirmalarni hisoblash
 * - StudentBalance.debt ga shu oy uchun qarz qo'shish
 * - Agar to'lov qilingan bo'lsa (balance > 0), balansdan ayirish
 */
import cron from 'node-cron';
import prisma from '../lib/prisma';

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];

export async function calculateMonthlyDebts() {
  const now = new Date();
  console.log(`\n📊 [CRON] Oylik qarzdorlik hisoblash boshlandi — ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`);

  try {
    // Barcha ACTIVE o'quvchilarni olish
    const activeStudents = await prisma.student.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { fullName: true, id: true } },
        balance: true,
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: {
            group: {
              include: {
                course: { select: { monthlyPrice: true, name: true } },
              },
            },
          },
        },
      },
    });

    let processed = 0;
    let totalDebtAdded = 0;

    for (const student of activeStudents) {
      // Guruhlaridagi jami oylik narx
      let totalMonthly = 0;
      for (const gs of student.groupStudents) {
        totalMonthly += Number(gs.group.course.monthlyPrice);
      }

      if (totalMonthly === 0) continue; // Guruhsiz o'quvchilar

      // Chegirma hisoblash
      let discount = 0;
      if (student.discountType && student.discountValue) {
        const discountVal = Number(student.discountValue);
        if (student.discountType === 'PERCENTAGE') {
          discount = Math.round(totalMonthly * discountVal / 100);
        } else if (student.discountType === 'FIXED_AMOUNT') {
          discount = discountVal;
        }
      }

      const monthlyFee = totalMonthly - discount;
      if (monthlyFee <= 0) continue;

      // Hozirgi balans va qarzni olish
      const currentBalance = Number(student.balance?.balance || 0);
      const currentDebt = Number(student.balance?.debt || 0);

      // Agar balansda pul bo'lsa — avval balansdan ayirish
      let newBalance = currentBalance;
      let newDebt = currentDebt;

      if (currentBalance >= monthlyFee) {
        // To'liq balansdan to'lash mumkin
        newBalance = currentBalance - monthlyFee;
      } else {
        // Balans yetmaydi — qoldiqni qarzga qo'shish
        const remaining = monthlyFee - currentBalance;
        newBalance = 0;
        newDebt = currentDebt + remaining;
      }

      // StudentBalance ni yangilash (upsert)
      await prisma.studentBalance.upsert({
        where: { studentId: student.id },
        update: {
          balance: newBalance,
          debt: newDebt,
          lastUpdated: new Date(),
        },
        create: {
          studentId: student.id,
          balance: 0,
          debt: monthlyFee,
          lastUpdated: new Date(),
        },
      });

      processed++;
      totalDebtAdded += (newDebt - currentDebt);
    }

    console.log(`✅ [CRON] Oylik qarz hisoblash tugadi:`);
    console.log(`   📋 ${processed} ta o'quvchi qayta ishlandi`);
    console.log(`   💰 Jami yangi qarz: ${totalDebtAdded.toLocaleString()} so'm`);

    return { processed, totalDebtAdded };
  } catch (error) {
    console.error('❌ [CRON] Oylik qarz hisoblashda xatolik:', error);
    throw error;
  }
}

// Har oy 1-sanasi soat 00:01 da ishga tushadi
export function startMonthlyDebtCron() {
  cron.schedule('1 0 1 * *', async () => {
    console.log('🔄 [CRON] Oylik qarz hisoblash cron ishi boshlandi...');
    try {
      await calculateMonthlyDebts();
    } catch (err) {
      console.error('❌ [CRON] Xatolik:', err);
    }
  }, {
    timezone: 'Asia/Tashkent',
  });

  console.log('📅 [CRON] Oylik qarz hisoblash cron ishi ro\'yxatdan o\'tdi (har oy 1-sanasi 00:01)');
}
