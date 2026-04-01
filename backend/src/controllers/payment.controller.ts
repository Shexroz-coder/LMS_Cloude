import prisma from '../lib/prisma';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError, paginate } from '../utils/response.utils';
import { countLessonsInMonth, countStandardLessonsInMonth, getMonthCalendarData, countLessonsInMonthFromDate, countStandardLessonsFromDate } from '../utils/schedule.utils';
import { sendPaymentNotification } from '../telegram/services/notify.service';


// ══════════════════════════════════════════════
// GET /payments — Barcha to'lovlar
// ══════════════════════════════════════════════
export const getPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1', limit = '20',
      studentId, method, month, hasDebt
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { isDeleted: false };
    if (studentId) where.studentId = parseInt(studentId);
    if (method) where.paymentMethod = method;
    if (month) {
      const start = new Date(month + '-01T00:00:00.000Z');
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1); // keyingi oyning 1-kuni
      where.paidAt = { gte: start, lt: end }; // lt = keyingi oydan kichik
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          student: {
            include: { user: { select: { fullName: true, phone: true } } }
          },
          group: { include: { course: { select: { name: true } } } }
        },
        skip, take: limitNum,
        orderBy: { paidAt: 'desc' }
      }),
      prisma.payment.count({ where })
    ]);

    // Oylik umumiy summa
    const totalAmount = await prisma.payment.aggregate({
      where, _sum: { amount: true }
    });

    sendSuccess(res, {
      payments,
      totalAmount: Number(totalAmount._sum.amount || 0)
    }, undefined, 200, paginate(pageNum, limitNum, total));
  } catch (err) {
    console.error('getPayments error:', err);
    sendError(res, "To'lovlarni olishda xato.", 500);
  }
};

// ══════════════════════════════════════════════
// POST /payments — To'lov qabul qilish
// ══════════════════════════════════════════════
export const createPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      studentId, amount, paymentMethod = 'CASH',
      month, note, isDebtPayment = false,
      groupId
    } = req.body;

    if (!studentId || !amount) {
      sendError(res, "O'quvchi va summa kiritilishi shart.", 400);
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      sendError(res, "Summa 0 dan katta son bo'lishi kerak.", 400);
      return;
    }
    if (paymentAmount > 100_000_000) {
      sendError(res, "Summa juda katta. Maksimum 100 000 000 so'm.", 400);
      return;
    }
    // Ikki xonagacha yaxlitlash (tiyin aniqligida)
    const roundedAmount = Math.round(paymentAmount * 100) / 100;

    // O'quvchi va balansini tekshirish
    const student = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
      include: { balance: true, groupStudents: { where: { status: 'ACTIVE' }, include: { group: { include: { course: true } } } } }
    });

    if (!student) {
      sendError(res, "O'quvchi topilmadi.", 404);
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // To'lovni saqlash
      const payment = await tx.payment.create({
        data: {
          studentId: parseInt(studentId),
          amount: roundedAmount,
          paymentMethod: paymentMethod as 'CASH' | 'CARD' | 'TRANSFER' | 'ONLINE',
          month: month ? new Date(month + '-01') : new Date(),
          note,
          receivedBy: req.user!.id,
          groupId: groupId ? parseInt(groupId) : null,
        },
        include: {
          student: { include: { user: { select: { fullName: true, phone: true } } } },
          group: { include: { course: { select: { name: true } } } }
        }
      });

      // Balansni yangilash
      const currentBalance = student.balance;
      if (currentBalance) {
        let newDebt = Number(currentBalance.debt);
        let newBalance = Number(currentBalance.balance);

        if (isDebtPayment || newDebt > 0) {
          // Avval qarzni to'lash
          const debtPaid = Math.min(roundedAmount, newDebt);
          newDebt = Math.max(0, newDebt - debtPaid);
          const remaining = roundedAmount - debtPaid;
          newBalance = newBalance + remaining;
        } else {
          newBalance = newBalance + roundedAmount;
        }

        // To'lov qilingandan keyin va'da ma'lumotlarini tozalash
        const updateData: Record<string, unknown> = { balance: newBalance, debt: newDebt, lastUpdated: new Date() };
        if (newDebt <= 0) {
          updateData.promiseDate = null;
          updateData.promiseAmount = null;
          updateData.promiseNote = null;
        }

        await (tx.studentBalance as any).update({
          where: { studentId: parseInt(studentId) },
          data: updateData
        });
      } else {
        // Balans hali yaratilmagan — yaratib qo'yamiz
        await tx.studentBalance.create({
          data: { studentId: parseInt(studentId), balance: roundedAmount, debt: 0 }
        });
      }

      return payment;
    });

    sendSuccess(res, result, "To'lov muvaffaqiyatli qabul qilindi!", 201);

    // Telegram ga to'lov xabari yuborish
    sendPaymentNotification(parseInt(studentId), roundedAmount, paymentMethod)
      .catch(err => console.error('Telegram payment notification error:', err));

  } catch (err) {
    console.error('createPayment error:', err);
    sendError(res, "To'lovni qayd etishda xato.", 500);
  }
};

// ══════════════════════════════════════════════
// GET /payments/summary — Oylik moliyaviy xulosa
// ══════════════════════════════════════════════
export const getFinanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month } = req.query as { month?: string };

    // Oy filtri — agar month berilmasa, barcha vaqt
    const dateFilter = month
      ? (() => {
          const start = new Date(month + '-01T00:00:00.000Z');
          const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
          return { gte: start, lt: end };
        })()
      : undefined;

    const [incomeResult, expenseResult, debtResult, studentCount] = await Promise.all([
      prisma.payment.aggregate({
        where: dateFilter ? { paidAt: dateFilter, isDeleted: false } : { isDeleted: false },
        _sum: { amount: true }
      }),
      prisma.expense.aggregate({
        where: dateFilter ? { date: dateFilter } : {},
        _sum: { amount: true }
      }),
      prisma.studentBalance.aggregate({
        _sum: { debt: true }
      }),
      prisma.student.count({ where: { user: { isActive: true } } })
    ]);

    const income = Number(incomeResult._sum.amount || 0);
    const expenses = Number(expenseResult._sum.amount || 0);
    const totalDebt = Number(debtResult._sum.debt || 0);
    const netProfit = income - expenses;

    // Breakdown by paymentMethod
    const byMethod = await prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: dateFilter ? { paidAt: dateFilter, isDeleted: false } : { isDeleted: false },
      _sum: { amount: true },
      _count: true
    });

    sendSuccess(res, {
      income, expenses, netProfit, totalDebt, studentCount,
      byMethod: byMethod.map(m => ({
        method: m.paymentMethod,
        total: Number(m._sum.amount || 0),
        count: m._count
      }))
    });
  } catch (err) {
    console.error('getFinanceSummary error:', err);
    sendError(res, 'Xulosa olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /payments/monthly-fees — Barcha oylik to'lovlar
// ══════════════════════════════════════════════
export const getMonthlyFees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, groupId } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};

    if (month) {
      const start = new Date(month + '-01');
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      where.month = { gte: start, lte: end };
    }

    if (groupId) where.groupId = parseInt(groupId);

    const fees = await prisma.monthlyFee.findMany({
      where,
      include: {
        student: { include: { user: { select: { fullName: true, phone: true } } } },
        group: { select: { name: true } }
      },
      orderBy: [{ month: 'desc' }, { student: { user: { fullName: 'asc' } } }]
    });

    sendSuccess(res, fees);
  } catch (err) {
    console.error('getMonthlyFees error:', err);
    sendError(res, 'Oylik to\'lovlarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /payments/generate-monthly-fees
// ══════════════════════════════════════════════
export const generateMonthlyFees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month } = req.body;
    const monthDate = month ? new Date(month + '-01') : new Date();
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);

    // Barcha faol guruh o'quvchilari
    const activeStudents = await prisma.groupStudent.findMany({
      where: { status: 'ACTIVE' },
      include: {
        student: { include: { balance: true } },
        group: { include: { course: true } }
      }
    });

    let created = 0;
    let updated = 0;

    for (const gs of activeStudents) {
      const student = gs.student;
      const course = gs.group.course;
      let baseAmount = Number(course.monthlyPrice);
      let discountAmount = 0;

      // Chegirma hisoblash
      if (student.discountType && student.discountValue) {
        if (student.discountType === 'PERCENTAGE') {
          discountAmount = baseAmount * (Number(student.discountValue) / 100);
        } else {
          // FIXED_AMOUNT
          discountAmount = Math.min(Number(student.discountValue), baseAmount);
        }
      }

      const finalAmount = Math.max(0, baseAmount - discountAmount);

      // Mavjud fee borligini tekshirish (studentId + groupId + month bo'yicha)
      const existingFee = await prisma.monthlyFee.findFirst({
        where: {
          studentId: student.id,
          groupId: gs.groupId,
          month: { gte: monthStart, lt: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1) }
        }
      });

      if (!existingFee) {
        await prisma.monthlyFee.create({
          data: {
            studentId: student.id,
            groupId: gs.groupId,
            month: monthStart,
            baseAmount,
            discountAmount,
            finalAmount,
          }
        });

        // Balansga qarz qo'shish
        if (student.balance) {
          await prisma.studentBalance.update({
            where: { studentId: student.id },
            data: { debt: { increment: finalAmount } }
          });
        }
        created++;
      } else {
        updated++;
      }
    }

    sendSuccess(res, { created, updated, total: activeStudents.length },
      `${created} ta yangi oylik to'lov yaratildi.`);
  } catch (err) {
    console.error('generateMonthlyFees error:', err);
    sendError(res, 'Oylik to\'lovlarni hisoblashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /payments/student/:studentId — O'quvchi to'lovlari
// ══════════════════════════════════════════════
export const getStudentPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.studentId);

    // Ownership tekshirish
    if (req.user?.role === 'STUDENT') {
      const myStudent = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (!myStudent || myStudent.id !== studentId) {
        sendError(res, 'Siz faqat o\'z to\'lovlaringizni ko\'ra olasiz.', 403);
        return;
      }
    }
    if (req.user?.role === 'PARENT') {
      const myChildren = await prisma.student.findMany({ where: { parentId: req.user.id } });
      if (!myChildren.some(c => c.id === studentId)) {
        sendError(res, 'Siz faqat o\'z farzandingiz to\'lovlarini ko\'ra olasiz.', 403);
        return;
      }
    }

    const [payments, fees, balance] = await Promise.all([
      prisma.payment.findMany({
        where: { studentId, isDeleted: false },
        orderBy: { paidAt: 'desc' },
        take: 24
      }),
      prisma.monthlyFee.findMany({
        where: { studentId },
        orderBy: { month: 'desc' },
        take: 12
      }),
      prisma.studentBalance.findUnique({ where: { studentId } })
    ]);

    // O'quvchi profili (to'lov sanasi)
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { paymentDueDay: true, paymentRemindDaysBefore: true },
    });

    // Keyingi to'lov sanasi hisoblash
    const today = new Date();
    let nextDueDate: Date | null = null;
    if (student?.paymentDueDay) {
      const d = student.paymentDueDay;
      nextDueDate = new Date(today.getFullYear(), today.getMonth(), d);
      if (nextDueDate < today) {
        nextDueDate = new Date(today.getFullYear(), today.getMonth() + 1, d);
      }
    }

    sendSuccess(res, { payments, fees, balance, paymentDueDay: student?.paymentDueDay, nextDueDate });
  } catch (err) {
    console.error('getStudentPayments error:', err);
    sendError(res, "To'lovlarni olishda xato.", 500);
  }
};

// ══════════════════════════════════════════════
// PATCH /payments/student/:studentId/due-day — To'lov kunini belgilash
// ══════════════════════════════════════════════
export const setPaymentDueDay = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.studentId);
    const { dueDay, remindDaysBefore = 3 } = req.body;

    if (!dueDay || dueDay < 1 || dueDay > 28) {
      sendError(res, 'dueDay 1 dan 28 gacha bo\'lishi kerak.', 400);
      return;
    }

    const student = await prisma.student.update({
      where: { id: studentId },
      data: {
        paymentDueDay: parseInt(dueDay),
        paymentRemindDaysBefore: parseInt(remindDaysBefore),
      },
      select: { id: true, paymentDueDay: true, paymentRemindDaysBefore: true },
    });

    sendSuccess(res, student, 'To\'lov kuni belgilandi!');
  } catch (err) {
    sendError(res, 'Xato', 500);
  }
};

// ══════════════════════════════════════════════
// PATCH /payments/student/:studentId/promise — To'lov va'dasi belgilash
// ══════════════════════════════════════════════
export const setPaymentPromise = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.studentId);
    const { promiseDate, promiseAmount, promiseNote } = req.body;

    if (!promiseDate) {
      sendError(res, 'Va\'da sanasi kiritilishi shart.', 400);
      return;
    }

    const parsedDate = new Date(promiseDate);
    if (isNaN(parsedDate.getTime())) {
      sendError(res, 'Noto\'g\'ri sana formati.', 400);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsedDate < today) {
      sendError(res, 'Va\'da sanasi bugundan oldin bo\'lishi mumkin emas.', 400);
      return;
    }

    const parsedAmount = promiseAmount ? parseFloat(promiseAmount) : null;
    if (parsedAmount !== null && (isNaN(parsedAmount) || parsedAmount <= 0)) {
      sendError(res, 'Va\'da summasi 0 dan katta bo\'lishi kerak.', 400);
      return;
    }

    const balance = await (prisma.studentBalance as any).upsert({
      where: { studentId },
      update: {
        promiseDate: parsedDate,
        promiseAmount: parsedAmount,
        promiseNote: promiseNote || null,
        lastUpdated: new Date(),
      },
      create: {
        studentId,
        balance: 0,
        debt: 0,
        promiseDate: parsedDate,
        promiseAmount: parsedAmount,
        promiseNote: promiseNote || null,
      },
    });

    // O'quvchiga Telegram xabar
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { fullName: true, telegramChatId: true } } },
    });

    if (student?.user.telegramChatId) {
      try {
        const dateStr = parsedDate.toLocaleDateString('uz-UZ');
        const amountStr = parsedAmount
          ? parsedAmount.toLocaleString('uz-UZ') + ' so\'m'
          : 'belgilanmagan';
        let msg = `📝 <b>To'lov va'dasi belgilandi</b>\n\n`;
        msg += `📅 Sana: <b>${dateStr}</b>\n`;
        msg += `💰 Summa: <b>${amountStr}</b>\n`;
        if (promiseNote) msg += `📌 Izoh: ${promiseNote}\n`;
        msg += `\n⚠️ Iltimos, belgilangan sanada to'lovni amalga oshiring.`;

        const bot = (await import('../telegram/bot')).default;
        await bot.api.sendMessage(student.user.telegramChatId, msg, { parse_mode: 'HTML' });
      } catch (e) {
        // Telegram xato bo'lsa ham davom etamiz
      }
    }

    sendSuccess(res, {
      studentId,
      promiseDate: parsedDate,
      promiseAmount: parsedAmount,
      promiseNote: promiseNote || null,
    }, 'To\'lov va\'dasi belgilandi!');
  } catch (err) {
    console.error('setPaymentPromise error:', err);
    sendError(res, 'Va\'da belgilashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// DELETE /payments/student/:studentId/promise — Va'dani o'chirish
// ══════════════════════════════════════════════
export const clearPaymentPromise = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.studentId);

    await (prisma.studentBalance as any).update({
      where: { studentId },
      data: {
        promiseDate: null,
        promiseAmount: null,
        promiseNote: null,
        lastUpdated: new Date(),
      },
    });

    sendSuccess(res, null, 'To\'lov va\'dasi o\'chirildi.');
  } catch (err) {
    sendError(res, 'Va\'da o\'chirishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /payments/upcoming-dues — Yaqinlashgan to'lovlar (admin)
// ══════════════════════════════════════════════
export const getUpcomingDues = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    const dayOfMonth = today.getDate();

    // paymentDueDay belgilangan o'quvchilar
    const students = await prisma.student.findMany({
      where: {
        paymentDueDay: { not: null },
        status: 'ACTIVE',
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        balance: true,
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: { group: { select: { name: true } } },
          take: 1,
        },
        parent: { select: { id: true, fullName: true, phone: true } },
      },
    });

    const result = students
      .map((s) => {
        const due = s.paymentDueDay!;
        const remind = s.paymentRemindDaysBefore || 3;
        // Keyingi to'lov sanasi
        let nextDue = new Date(today.getFullYear(), today.getMonth(), due);
        if (nextDue < today) nextDue = new Date(today.getFullYear(), today.getMonth() + 1, due);
        const daysLeft = Math.ceil((nextDue.getTime() - today.getTime()) / 86400000);
        const isNear = daysLeft <= remind;
        const isOverdue = Number(s.balance?.debt || 0) > 0;

        return {
          studentId: s.id,
          fullName: s.user.fullName,
          phone: s.user.phone,
          parentName: s.parent?.fullName,
          parentPhone: s.parent?.phone,
          groupName: s.groupStudents[0]?.group.name,
          dueDay: due,
          nextDueDate: nextDue,
          daysLeft,
          isNear,
          isOverdue,
          debt: Number(s.balance?.debt || 0),
          balance: Number(s.balance?.balance || 0),
          promiseDate: (s.balance as any)?.promiseDate || null,
          promiseAmount: (s.balance as any)?.promiseAmount ? Number((s.balance as any).promiseAmount) : null,
          promiseNote: (s.balance as any)?.promiseNote || null,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);

    sendSuccess(res, result);
  } catch (err) {
    sendError(res, 'Yaqin to\'lovlarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /payments/online/initiate — Payme/Uzum to'lov boshlash
// MUHIM: Bu yerda Payment yozilmaydi!
// Payment faqat PayMe tomonidan PerformTransaction chaqirilganda yoziladi.
// ══════════════════════════════════════════════
export const initiateOnlinePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, amount, month, provider } = req.body;
    // provider: 'PAYME' | 'UZUM'

    if (!studentId || !amount || !provider) {
      sendError(res, 'studentId, amount, provider kiritilishi shart.', 400);
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 1000) {
      sendError(res, 'Minimal to\'lov summasi 1 000 so\'m.', 400);
      return;
    }
    if (parsedAmount > 100_000_000) {
      sendError(res, 'Maksimal to\'lov summasi 100 000 000 so\'m.', 400);
      return;
    }

    if (!['PAYME', 'UZUM'].includes(provider)) {
      sendError(res, 'Noto\'g\'ri provider. PAYME yoki UZUM tanlang.', 400);
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
      include: { user: { select: { fullName: true, phone: true } } },
    });
    if (!student) { sendError(res, 'O\'quvchi topilmadi.', 404); return; }

    const amountTiyin = Math.round(parsedAmount * 100); // tiyin

    // orderId formatida barcha kerakli ma'lumotlar kodlangan:
    // LMS-{studentId}-{amountTiyin}-{monthYYYYMM}-{timestamp}
    const now = new Date();
    const monthDate = month
      ? new Date(month + '-01T00:00:00.000Z')
      : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const monthStr = `${monthDate.getUTCFullYear()}${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const orderId = `LMS-${studentId}-${amountTiyin}-${monthStr}-${Date.now()}`;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    let paymentUrl = '';

    if (provider === 'PAYME') {
      const merchantId = process.env.PAYME_MERCHANT_ID || '';
      // PayMe checkout URL formati
      paymentUrl = `https://checkout.paycom.uz/${Buffer.from(
        `m=${merchantId};ac.order_id=${orderId};ac.student_id=${studentId};a=${amountTiyin};c=${frontendUrl}/payment/success`
      ).toString('base64')}`;

    } else if (provider === 'UZUM') {
      const merchantId = process.env.UZUM_MERCHANT_ID || '';
      paymentUrl = `https://uzum.uz/payment?merchant_id=${merchantId}&order_id=${orderId}&amount=${amountTiyin}&return_url=${encodeURIComponent(frontendUrl + '/payment/success')}`;
    }

    // Payment yozuv bu yerda YARATILMAYDI.
    // PayMe webhook (PerformTransaction) chaqirilganda avtomatik yaratiladi.
    sendSuccess(res, { paymentUrl, orderId });
  } catch (err) {
    console.error('initiateOnlinePayment error:', err);
    sendError(res, 'To\'lov boshlashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /payments/student-obligations — Barcha o'quvchilar qarzi (admin)
// ══════════════════════════════════════════════
export const getStudentObligations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search } = req.query as { search?: string };

    const activeStudents = await prisma.groupStudent.findMany({
      where: { status: 'ACTIVE' },
      include: {
        student: {
          include: {
            user: { select: { fullName: true, phone: true } },
            balance: true,
          }
        },
        group: {
          include: {
            course: true,
            schedules: true,
          }
        }
      }
    });

    const today = new Date();

    const filteredStudents = activeStudents
      .filter(gs => {
        if (!search) return true;
        return gs.student.user.fullName.toLowerCase().includes(search.toLowerCase()) ||
          gs.student.user.phone.includes(search);
      });

    const obligations = await Promise.all(filteredStudents.map(async (gs) => {
        const student = gs.student;
        const group = gs.group;
        const course = group.course;

        const baseMonthlyPrice = Number(course.monthlyPrice);
        let discountAmount = 0;
        if (student.discountType && student.discountValue) {
          if (student.discountType === 'PERCENTAGE') {
            discountAmount = Math.round(baseMonthlyPrice * Number(student.discountValue) / 100);
          } else {
            discountAmount = Math.min(Number(student.discountValue), baseMonthlyPrice);
          }
        }
        discountAmount = Math.round(discountAmount);
        const monthlyAmount = Math.max(0, baseMonthlyPrice - discountAmount);

        // Scheduledan dars kunlarini hisoblash
        const uniqueDays = [...new Set(group.schedules.flatMap(s => s.daysOfWeek))];
        const lessonsPerMonth = await countLessonsInMonth(today.getFullYear(), today.getMonth(), uniqueDays);
        const standardLessons = await countStandardLessonsInMonth(today.getFullYear(), today.getMonth(), uniqueDays);
        const holidayLessons = standardLessons - lessonsPerMonth;

        // 1 dars narxi = oylik / standart darslar
        const pricePerLesson = standardLessons > 0 ? monthlyAmount / standardLessons : 0;
        const holidayCredit = Math.round(holidayLessons * pricePerLesson);
        let adjustedAmount = Math.round(monthlyAmount - holidayCredit);

        // Pro-rata: o'quvchi shu oyda qo'shilgan bo'lsa
        const joinedAt = new Date(gs.joinedAt);
        let isProRata = false;
        let proRataLessons = 0;
        if (joinedAt.getFullYear() === today.getFullYear() && joinedAt.getMonth() === today.getMonth() && joinedAt.getDate() > 1) {
          isProRata = true;
          proRataLessons = await countLessonsInMonthFromDate(today.getFullYear(), today.getMonth(), uniqueDays, joinedAt);
          adjustedAmount = Math.round(proRataLessons * pricePerLesson);
        }

        const currentDebt = Number(student.balance?.debt || 0);
        const currentBalance = Number(student.balance?.balance || 0);

        return {
          studentId: student.id,
          fullName: student.user.fullName,
          phone: student.user.phone,
          groupId: group.id,
          groupName: group.name,
          courseName: course.name,
          joinedAt: gs.joinedAt,
          baseMonthlyPrice: Math.round(baseMonthlyPrice),
          discountAmount: Math.round(discountAmount),
          discountType: student.discountType,
          monthlyAmount: Math.round(monthlyAmount),
          standardLessons,
          lessonsPerMonth,
          holidayLessons,
          pricePerLesson: Math.round(pricePerLesson),
          holidayCredit: isProRata ? 0 : holidayCredit,
          adjustedAmount,
          isProRata,
          proRataLessons,
          currentDebt,
          currentBalance,
          netObligation: Math.max(0, currentDebt - currentBalance),
          hasDebt: currentDebt > 0,
          hasSurplus: currentBalance > 0,
          promiseDate: (student.balance as any)?.promiseDate || null,
          promiseAmount: (student.balance as any)?.promiseAmount ? Number((student.balance as any).promiseAmount) : null,
          promiseNote: (student.balance as any)?.promiseNote || null,
        };
      }));

    obligations.sort((a, b) => b.currentDebt - a.currentDebt);

    sendSuccess(res, obligations);
  } catch (err) {
    console.error('getStudentObligations error:', err);
    sendError(res, "O'quvchilar qarzini olishda xato.", 500);
  }
};

// ══════════════════════════════════════════════
// GET /payments/calculate/:studentId — To'lov summasi hisoblash
// ══════════════════════════════════════════════
export const calculateStudentPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.studentId);

    // Ownership tekshirish
    if (req.user?.role === 'STUDENT') {
      const myStudent = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (!myStudent || myStudent.id !== studentId) {
        sendError(res, 'Siz faqat o\'z hisobingizni ko\'ra olasiz.', 403);
        return;
      }
    }
    if (req.user?.role === 'PARENT') {
      const myChildren = await prisma.student.findMany({ where: { parentId: req.user.id } });
      if (!myChildren.some(c => c.id === studentId)) {
        sendError(res, 'Siz faqat o\'z farzandingiz hisobini ko\'ra olasiz.', 403);
        return;
      }
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        balance: true,
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: {
            group: {
              include: {
                course: true,
                schedules: true,
              }
            }
          }
        }
      }
    });

    if (!student) {
      sendError(res, "O'quvchi topilmadi.", 404);
      return;
    }

    if (student.groupStudents.length === 0) {
      sendSuccess(res, {
        monthlyAmount: 0,
        pricePerLesson: 0,
        lessonsPerMonth: 0,
        nextMonthLessons: 0,
        nextMonthAmount: 0,
        debtAmount: 0,
        options: { oneMonth: 0, twoMonths: 0, threeMonths: 0 },
        currentDebt: Number(student.balance?.debt || 0),
        currentBalance: Number(student.balance?.balance || 0),
        message: "Faol guruh topilmadi"
      });
      return;
    }

    // Birinchi faol guruhni olish
    const gs = student.groupStudents[0];
    const group = gs.group;
    const course = group.course;
    const joinedAt = new Date(gs.joinedAt);

    // Chegirmani hisoblash
    const baseMonthlyPrice = Number(course.monthlyPrice);
    let discountAmount = 0;
    if (student.discountType && student.discountValue) {
      if (student.discountType === 'PERCENTAGE') {
        discountAmount = baseMonthlyPrice * (Number(student.discountValue) / 100);
      } else {
        discountAmount = Math.min(Number(student.discountValue), baseMonthlyPrice);
      }
    }
    const monthlyAmount = Math.max(0, baseMonthlyPrice - discountAmount);

    // Dars jadvalidan haftalik kunlarni olish
    const scheduledDays = group.schedules.flatMap(s => s.daysOfWeek);
    const uniqueDays = [...new Set(scheduledDays)];

    // Joriy oy uchun darslar soni
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const lessonsPerMonth = await countLessonsInMonth(currentYear, currentMonth, uniqueDays);

    // Standart darslar (bayramlar hisobsiz)
    const standardLessons = await countStandardLessonsInMonth(currentYear, currentMonth, uniqueDays);

    // 1 dars narxi = oylik / standart darslar
    const pricePerLesson = standardLessons > 0 ? monthlyAmount / standardLessons : 0;

    // Dam olish tufayli tushirilgan darslar
    const holidayLessons = standardLessons - lessonsPerMonth;
    const holidayCredit = Math.round(holidayLessons * pricePerLesson);
    let adjustedAmount = Math.round(monthlyAmount - holidayCredit);

    // Pro-rata: o'quvchi shu oyda qo'shilgan bo'lsa
    let isProRata = false;
    let proRataLessons = 0;
    if (joinedAt.getFullYear() === currentYear && joinedAt.getMonth() === currentMonth && joinedAt.getDate() > 1) {
      isProRata = true;
      proRataLessons = await countLessonsInMonthFromDate(currentYear, currentMonth, uniqueDays, joinedAt);
      adjustedAmount = Math.round(proRataLessons * pricePerLesson);
    }

    // Keyingi oy uchun
    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
    const nextMonthLessons = await countLessonsInMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), uniqueDays);
    const nextStandardLessons = await countStandardLessonsInMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), uniqueDays);
    const nextHolidayLessons = nextStandardLessons - nextMonthLessons;
    const nextPricePerLesson = nextStandardLessons > 0 ? monthlyAmount / nextStandardLessons : 0;
    const nextHolidayCredit = Math.round(nextHolidayLessons * nextPricePerLesson);
    const nextMonthAmount = Math.round(monthlyAmount - nextHolidayCredit);

    // ── Jadval bo'yicha darslar soni (qo'shilgan kundan bugungi kungacha)
    // MUHIM: davomat (completed lessons) emas, balki JADVAL asosida!
    // Keldi-kelmagan muhim emas — jadvalda dars bor = to'lov bor.
    let scheduledLessonsSinceJoin = 0;
    {
      let y = joinedAt.getFullYear();
      let m = joinedAt.getMonth();
      const endY = today.getFullYear();
      const endM = today.getMonth();

      while (y < endY || (y === endY && m <= endM)) {
        if (y === joinedAt.getFullYear() && m === joinedAt.getMonth()) {
          // Birinchi oy — qo'shilgan kundan hisoblash (pro-rata)
          scheduledLessonsSinceJoin += await countLessonsInMonthFromDate(y, m, uniqueDays, joinedAt);
        } else {
          // To'liq oylar — bayramlarsiz barcha dars kunlari
          scheduledLessonsSinceJoin += await countLessonsInMonth(y, m, uniqueDays);
        }
        m++;
        if (m > 11) { m = 0; y++; }
      }
    }

    // Jadval bo'yicha to'lanishi kerak bo'lgan nazariy summa
    const theoreticalAmount = Math.round(scheduledLessonsSinceJoin * pricePerLesson);

    // Haqiqatda to'langan summa
    const totalPaidResult = await prisma.payment.aggregate({
      where: { studentId, status: 'PAID', isDeleted: false },
      _sum: { amount: true }
    });
    const totalPaid = Number(totalPaidResult._sum.amount || 0);

    // DB da saqlangan qarz (cron tomonidan oylik hisoblangan)
    const currentDebt = Number(student.balance?.debt || 0);
    const currentBalance = Number(student.balance?.balance || 0);

    // Qarz: cron hisoblagan qiymat asosiy manba.
    // Agar cron hali ishlamagan bo'lsa (yangi o'quvchi), jadval asosida hisoblash.
    const scheduledDebt = Math.max(0, theoreticalAmount - totalPaid - currentBalance);
    const debtAmount = currentDebt > 0 ? currentDebt : scheduledDebt;

    // Davomat (ma'lumot uchun, qarz hisoblashda ishlatilmaydi)
    const completedLessonsCount = await prisma.lesson.count({
      where: {
        groupId: group.id,
        date: { gte: joinedAt, lte: today },
        status: 'COMPLETED',
      }
    });

    sendSuccess(res, {
      monthlyAmount: Math.round(monthlyAmount),
      baseMonthlyPrice: Math.round(baseMonthlyPrice),
      discountAmount: Math.round(discountAmount),
      discountType: student.discountType,
      discountValue: student.discountValue ? Number(student.discountValue) : null,
      pricePerLesson: Math.round(pricePerLesson),
      lessonsPerMonth,
      standardLessons,
      holidayLessons,
      holidayCredit: isProRata ? 0 : holidayCredit,
      adjustedAmount,
      isProRata,
      proRataLessons,
      nextMonthLessons,
      nextMonthAmount,
      nextHolidayLessons,
      nextHolidayCredit,
      debtAmount,
      options: {
        oneMonth: adjustedAmount,
        twoMonths: adjustedAmount + nextMonthAmount,
        threeMonths: Math.round(monthlyAmount * 3),
      },
      currentDebt,
      currentBalance: Number(student.balance?.balance || 0),
      // Jadval bo'yicha ma'lumotlar (asosiy hisob-kitob)
      scheduledLessonsSinceJoin,
      theoreticalAmount,
      totalPaid: Math.round(totalPaid),
      // Davomat (faqat ma'lumot uchun, qarz hisoblashda ishlatilmaydi)
      completedLessons: completedLessonsCount,
      joinedAt,
      groupName: group.name,
      courseName: course.name,
    });
  } catch (err) {
    console.error('calculateStudentPayment error:', err);
    sendError(res, 'Hisoblashda xato yuz berdi.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /payments/calendar/:studentId — Dars kalendari + to'lov hisob-kitobi
// ══════════════════════════════════════════════
export const getStudentCalendar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.studentId);
    const { month: monthParam } = req.query as { month?: string };

    // Ownership tekshirish
    if (req.user?.role === 'STUDENT') {
      const myStudent = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (!myStudent || myStudent.id !== studentId) {
        sendError(res, 'Siz faqat o\'z kalendaringizni ko\'ra olasiz.', 403);
        return;
      }
    }
    if (req.user?.role === 'PARENT') {
      const myChildren = await prisma.student.findMany({ where: { parentId: req.user.id } });
      if (!myChildren.some(c => c.id === studentId)) {
        sendError(res, 'Siz faqat farzandingiz kalendarini ko\'ra olasiz.', 403);
        return;
      }
    }

    // Oy parametrini aniqlash
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    if (monthParam) {
      const parts = monthParam.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]) - 1;
    }

    // O'quvchini guruhlar bilan olish
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { fullName: true } },
        balance: true,
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: {
            group: {
              include: {
                course: { select: { name: true, monthlyPrice: true } },
                schedules: true,
              }
            }
          }
        }
      }
    });

    if (!student) {
      sendError(res, 'O\'quvchi topilmadi.', 404);
      return;
    }

    // Har bir guruh uchun kalendar hisoblash
    const groups = await Promise.all(student.groupStudents.map(async (gs) => {
      const group = gs.group;
      const course = group.course;
      const uniqueDays = [...new Set(group.schedules.flatMap(s => s.daysOfWeek))];

      // Kalendar ma'lumotlari
      const calendar = await getMonthCalendarData(year, month, uniqueDays);

      // To'lov hisob-kitobi
      const baseMonthlyPrice = Number(course.monthlyPrice);
      let discountAmount = 0;
      if (student.discountType && student.discountValue) {
        if (student.discountType === 'PERCENTAGE') {
          discountAmount = Math.round(baseMonthlyPrice * Number(student.discountValue) / 100);
        } else {
          discountAmount = Math.min(Number(student.discountValue), baseMonthlyPrice);
        }
      }
      const monthlyAmount = Math.max(0, baseMonthlyPrice - discountAmount);

      // 1 dars narxi = oylik / standart darslar (bayramlar hisobsiz)
      const pricePerLesson = calendar.standardLessons > 0
        ? Math.round(monthlyAmount / calendar.standardLessons)
        : 0;

      // Dam olish tufayli tejam
      const holidayCredit = calendar.holidayLessons * pricePerLesson;

      // Pro-rata: o'quvchi shu oyda qo'shilgan bo'lsa
      const joinedAt = new Date(gs.joinedAt);
      let isProRata = false;
      let proRataLessons = 0;
      let adjustedAmount = Math.round(monthlyAmount - holidayCredit);
      if (joinedAt.getFullYear() === year && joinedAt.getMonth() === month && joinedAt.getDate() > 1) {
        isProRata = true;
        proRataLessons = await countLessonsInMonthFromDate(year, month, uniqueDays, joinedAt);
        adjustedAmount = Math.round(proRataLessons * pricePerLesson);
      }

      // Keyingi oy uchun ham hisoblash
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const nextCalendar = await getMonthCalendarData(nextYear, nextMonth, uniqueDays);
      const nextPricePerLesson = nextCalendar.standardLessons > 0
        ? Math.round(monthlyAmount / nextCalendar.standardLessons)
        : 0;
      const nextHolidayCredit = nextCalendar.holidayLessons * nextPricePerLesson;
      const nextAdjustedAmount = Math.round(monthlyAmount - nextHolidayCredit);

      return {
        groupId: group.id,
        groupName: group.name,
        courseName: course.name,
        schedule: group.schedules.map(s => ({
          daysOfWeek: s.daysOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room,
        })),
        joinedAt: gs.joinedAt,
        isProRata,
        proRataLessons,
        currentMonth: {
          year,
          month: month + 1,
          standardLessons: calendar.standardLessons,
          actualLessons: calendar.actualLessons,
          holidayLessons: calendar.holidayLessons,
          baseMonthlyPrice: Math.round(baseMonthlyPrice),
          discountAmount: Math.round(discountAmount),
          monthlyAmount: Math.round(monthlyAmount),
          pricePerLesson,
          holidayCredit: isProRata ? 0 : Math.round(holidayCredit),
          adjustedAmount,
          isProRata,
          proRataLessons,
          calendarDays: calendar.calendarDays,
        },
        nextMonth: {
          year: nextYear,
          month: nextMonth + 1,
          standardLessons: nextCalendar.standardLessons,
          actualLessons: nextCalendar.actualLessons,
          holidayLessons: nextCalendar.holidayLessons,
          pricePerLesson: nextPricePerLesson,
          holidayCredit: Math.round(nextHolidayCredit),
          adjustedAmount: nextAdjustedAmount,
        },
      };
    }));

    // Umumiy (barcha guruhlar uchun)
    const totalMonthly = groups.reduce((s, g) => s + g.currentMonth.monthlyAmount, 0);
    const totalAdjusted = groups.reduce((s, g) => s + g.currentMonth.adjustedAmount, 0);
    const totalHolidayCredit = groups.reduce((s, g) => s + g.currentMonth.holidayCredit, 0);
    const totalNextAdjusted = groups.reduce((s, g) => s + g.nextMonth.adjustedAmount, 0);
    const totalNextHolidayCredit = groups.reduce((s, g) => s + g.nextMonth.holidayCredit, 0);

    sendSuccess(res, {
      studentId,
      fullName: student.user.fullName,
      currentDebt: Number(student.balance?.debt || 0),
      currentBalance: Number(student.balance?.balance || 0),
      summary: {
        totalMonthlyAmount: totalMonthly,
        totalHolidayCredit,
        totalAdjustedAmount: totalAdjusted,
        nextMonthAdjustedAmount: totalNextAdjusted,
        nextMonthHolidayCredit: totalNextHolidayCredit,
      },
      groups,
    });
  } catch (err) {
    console.error('getStudentCalendar error:', err);
    sendError(res, 'Kalendar olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /payments/online/callback — Eski webhook (deprecated)
// PayMe uchun /payme/webhook ishlatiladi (payme.controller.ts)
// ══════════════════════════════════════════════
export const onlinePaymentCallback = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({ success: true, message: 'Use /payme/webhook for PayMe callbacks.' });
};

// ══════════════════════════════════════════════
// PUT /payments/:id — To'lovni tahrirlash
// ══════════════════════════════════════════════
export const updatePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const paymentId = parseInt(req.params.id);
    const { amount, paymentMethod, month, note } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { student: { include: { balance: true } } },
    });

    if (!payment || payment.isDeleted) {
      sendError(res, "To'lov topilmadi.", 404);
      return;
    }

    const oldAmount = Number(payment.amount);
    const newAmount = amount !== undefined ? parseFloat(amount) : oldAmount;
    const diff = newAmount - oldAmount;

    const result = await prisma.$transaction(async (tx) => {
      // To'lovni yangilash
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          ...(amount !== undefined && { amount: newAmount }),
          ...(paymentMethod && { paymentMethod: paymentMethod as 'CASH' | 'CARD' | 'TRANSFER' | 'ONLINE' }),
          ...(month && { month: new Date(month + '-01') }),
          ...(note !== undefined && { note }),
        },
        include: {
          student: { include: { user: { select: { fullName: true, phone: true } } } },
        },
      });

      // Summada farq bo'lsa, balansni yangilash
      if (diff !== 0 && payment.student.balance) {
        const currentBalance = Number(payment.student.balance.balance);
        const currentDebt = Number(payment.student.balance.debt);

        let newBalance = currentBalance;
        let newDebt = currentDebt;

        if (diff > 0) {
          // Summa oshgan — balansga qo'shish (avval qarzni kamaytirib)
          if (newDebt > 0) {
            const debtPaid = Math.min(diff, newDebt);
            newDebt -= debtPaid;
            newBalance += (diff - debtPaid);
          } else {
            newBalance += diff;
          }
        } else {
          // Summa kamaygan — balansdan yechish yoki qarz qo'shish
          const deduct = Math.abs(diff);
          if (newBalance >= deduct) {
            newBalance -= deduct;
          } else {
            const shortfall = deduct - newBalance;
            newBalance = 0;
            newDebt += shortfall;
          }
        }

        await tx.studentBalance.update({
          where: { studentId: payment.studentId },
          data: { balance: newBalance, debt: newDebt },
        });
      }

      return updated;
    });

    sendSuccess(res, result, "To'lov yangilandi!");
  } catch (err) {
    console.error('updatePayment error:', err);
    sendError(res, "To'lovni yangilashda xato.", 500);
  }
};

// ══════════════════════════════════════════════
// DELETE /payments/:id — To'lovni o'chirish (soft delete + balans qaytarish)
// ══════════════════════════════════════════════
export const deletePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const paymentId = parseInt(req.params.id);
    const { reason } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { student: { include: { balance: true } } },
    });

    if (!payment || payment.isDeleted) {
      sendError(res, "To'lov topilmadi.", 404);
      return;
    }

    const paymentAmount = Number(payment.amount);

    await prisma.$transaction(async (tx) => {
      // Soft delete
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: req.user!.id,
          deleteReason: reason || null,
        },
      });

      // Balansni qaytarish — to'lov summasi balansdan yechiladi
      if (payment.student.balance) {
        const currentBalance = Number(payment.student.balance.balance);
        const currentDebt = Number(payment.student.balance.debt);

        let newBalance = currentBalance;
        let newDebt = currentDebt;

        if (newBalance >= paymentAmount) {
          newBalance -= paymentAmount;
        } else {
          const shortfall = paymentAmount - newBalance;
          newBalance = 0;
          newDebt += shortfall;
        }

        await tx.studentBalance.update({
          where: { studentId: payment.studentId },
          data: { balance: newBalance, debt: newDebt },
        });
      }
    });

    sendSuccess(res, { id: paymentId }, "To'lov o'chirildi va arxivlandi!");
  } catch (err) {
    console.error('deletePayment error:', err);
    sendError(res, "To'lovni o'chirishda xato.", 500);
  }
};

// ══════════════════════════════════════════════
// GET /payments/archive — Arxivlangan (o'chirilgan) to'lovlar
// ══════════════════════════════════════════════
export const getArchivedPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const where = { isDeleted: true };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          student: { include: { user: { select: { fullName: true, phone: true } } } },
          receiver: { select: { fullName: true } },
        },
        skip,
        take: limitNum,
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    // deletedBy foydalanuvchi nomini topish
    const enriched = await Promise.all(
      payments.map(async (p) => {
        let deletedByName: string | null = null;
        if (p.deletedBy) {
          const deleter = await prisma.user.findUnique({
            where: { id: p.deletedBy },
            select: { fullName: true },
          });
          deletedByName = deleter?.fullName || null;
        }
        return { ...p, deletedByName };
      })
    );

    sendSuccess(res, { payments: enriched }, undefined, 200, paginate(pageNum, limitNum, total));
  } catch (err) {
    console.error('getArchivedPayments error:', err);
    sendError(res, 'Arxivni olishda xato.', 500);
  }
};
