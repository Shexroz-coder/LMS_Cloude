import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { sendSuccess, sendError, paginate } from '../utils/response.utils';

const prisma = new PrismaClient();

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

    const where: Record<string, unknown> = {};
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
          }
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
      month, note, isDebtPayment = false
    } = req.body;

    if (!studentId || !amount) {
      sendError(res, "O'quvchi va summa kiritilishi shart.", 400);
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) {
      sendError(res, "Summa 0 dan katta bo'lishi kerak.", 400);
      return;
    }

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
          amount: paymentAmount,
          paymentMethod: paymentMethod as 'CASH' | 'CARD' | 'TRANSFER' | 'ONLINE',
          month: month ? new Date(month + '-01') : new Date(),
          note,
          receivedBy: req.user!.id,
        },
        include: {
          student: { include: { user: { select: { fullName: true, phone: true } } } }
        }
      });

      // Balansni yangilash
      const currentBalance = student.balance;
      if (currentBalance) {
        let newDebt = Number(currentBalance.debt);
        let newBalance = Number(currentBalance.balance);

        if (isDebtPayment || newDebt > 0) {
          // Avval qarzni to'lash
          const debtPaid = Math.min(paymentAmount, newDebt);
          newDebt = Math.max(0, newDebt - debtPaid);
          const remaining = paymentAmount - debtPaid;
          newBalance = newBalance + remaining;
        } else {
          newBalance = newBalance + paymentAmount;
        }

        await tx.studentBalance.update({
          where: { studentId: parseInt(studentId) },
          data: { balance: newBalance, debt: newDebt }
        });
      }

      return payment;
    });

    sendSuccess(res, result, "To'lov muvaffaqiyatli qabul qilindi!", 201);
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
        where: dateFilter ? { paidAt: dateFilter } : {},
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
      where: dateFilter ? { paidAt: dateFilter } : {},
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

      // Mavjud fee borligini tekshirish
      const existingFee = await prisma.monthlyFee.findFirst({
        where: {
          studentId: student.id,
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

    const [payments, fees, balance] = await Promise.all([
      prisma.payment.findMany({
        where: { studentId },
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
        balance: { select: { balance: true, debt: true } },
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
// ══════════════════════════════════════════════
export const initiateOnlinePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, amount, month, provider } = req.body;
    // provider: 'PAYME' | 'UZUM'

    if (!studentId || !amount || !provider) {
      sendError(res, 'studentId, amount, provider kiritilishi shart.', 400);
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
      include: { user: { select: { fullName: true, phone: true } } },
    });
    if (!student) { sendError(res, 'O\'quvchi topilmadi.', 404); return; }

    const amountTiyin = Math.round(parseFloat(amount) * 100); // tiyin
    const orderId = `LMS-${Date.now()}-${studentId}`;
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    let paymentUrl = '';

    if (provider === 'PAYME') {
      // Payme Merchant ID
      const merchantId = process.env.PAYME_MERCHANT_ID || '';
      // Base64 encode: account object
      const account = Buffer.from(
        JSON.stringify({ order_id: orderId, student_id: studentId })
      ).toString('base64');
      paymentUrl = `https://checkout.paycom.uz/${Buffer.from(
        `m=${merchantId};ac.order_id=${orderId};ac.student_id=${studentId};a=${amountTiyin};c=${frontendUrl}/payment/success`
      ).toString('base64')}`;

    } else if (provider === 'UZUM') {
      // Uzum (Apelsin) merchant
      const merchantId = process.env.UZUM_MERCHANT_ID || '';
      paymentUrl = `https://uzum.uz/payment?merchant_id=${merchantId}&order_id=${orderId}&amount=${amountTiyin}&return_url=${encodeURIComponent(frontendUrl + '/payment/success')}`;
    }

    // Pending payment record yaratish
    const monthDate = month
      ? new Date(month + '-01T00:00:00.000Z')
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const payment = await prisma.payment.create({
      data: {
        studentId: parseInt(studentId),
        amount: parseFloat(amount),
        month: monthDate,
        paymentMethod: 'ONLINE',
        status: 'PENDING',
        provider: provider.toUpperCase(),
        providerOrderId: orderId,
        note: `${provider} orqali to'lov`,
      },
    });

    sendSuccess(res, { paymentUrl, orderId, paymentId: payment.id });
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

    const obligations = activeStudents
      .filter(gs => {
        if (!search) return true;
        return gs.student.user.fullName.toLowerCase().includes(search.toLowerCase()) ||
          gs.student.user.phone.includes(search);
      })
      .map(gs => {
        const student = gs.student;
        const group = gs.group;
        const course = group.course;

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

        // Scheduledan dars kunlarini hisoblash
        const uniqueDays = [...new Set(group.schedules.flatMap(s => s.daysOfWeek))];
        const lessonsPerMonth = countLessonsInMonth(today.getFullYear(), today.getMonth(), uniqueDays);
        const pricePerLesson = lessonsPerMonth > 0 ? monthlyAmount / lessonsPerMonth : 0;

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
          lessonsPerMonth,
          pricePerLesson: Math.round(pricePerLesson),
          currentDebt,
          currentBalance,
          netObligation: Math.max(0, currentDebt - currentBalance),
          hasDebt: currentDebt > 0,
          hasSurplus: currentBalance > 0,
        };
      })
      .sort((a, b) => b.currentDebt - a.currentDebt);

    sendSuccess(res, obligations);
  } catch (err) {
    console.error('getStudentObligations error:', err);
    sendError(res, "O'quvchilar qarzini olishda xato.", 500);
  }
};

// ══════════════════════════════════════════════
// Helper: oyda necha marta dars bor (schedule days bo'yicha)
// ══════════════════════════════════════════════
function countLessonsInMonth(year: number, month: number, days: number[]): number {
  if (days.length === 0) return 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const weekday = new Date(year, month, d).getDay(); // 0=Yak, 1=Du...
    if (days.includes(weekday)) count++;
  }
  return count;
}

// ══════════════════════════════════════════════
// GET /payments/calculate/:studentId — To'lov summasi hisoblash
// ══════════════════════════════════════════════
export const calculateStudentPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.studentId);

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
    const lessonsPerMonth = countLessonsInMonth(currentYear, currentMonth, uniqueDays);

    // Narxni dars soniga bo'lib hisoblash
    const pricePerLesson = lessonsPerMonth > 0 ? monthlyAmount / lessonsPerMonth : 0;

    // Keyingi oy uchun darslar soni va summasi
    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
    const nextMonthLessons = countLessonsInMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), uniqueDays);
    const nextMonthAmount = Math.round(nextMonthLessons * pricePerLesson);

    // O'tilgan darslar soni (o'quvchi qo'shilgan kundan)
    const completedLessonsCount = await prisma.lesson.count({
      where: {
        groupId: group.id,
        date: { gte: joinedAt, lte: today },
        status: 'COMPLETED',
      }
    });

    // Umumiy to'lanishi kerak bo'lgan summa (o'tilgan darslar × dars narxi)
    const theoreticalAmount = Math.round(completedLessonsCount * pricePerLesson);

    // Haqiqatda to'langan summa
    const totalPaidResult = await prisma.payment.aggregate({
      where: { studentId, status: 'PAID' },
      _sum: { amount: true }
    });
    const totalPaid = Number(totalPaidResult._sum.amount || 0);

    // Hisoblangan qarz
    const calculatedDebt = Math.max(0, theoreticalAmount - totalPaid);
    const currentDebt = Number(student.balance?.debt || 0);

    // DB da saqlangan qarzni ustunlik berish
    const debtAmount = currentDebt > 0 ? currentDebt : calculatedDebt;

    sendSuccess(res, {
      monthlyAmount: Math.round(monthlyAmount),
      baseMonthlyPrice: Math.round(baseMonthlyPrice),
      discountAmount: Math.round(discountAmount),
      discountType: student.discountType,
      discountValue: student.discountValue ? Number(student.discountValue) : null,
      pricePerLesson: Math.round(pricePerLesson),
      lessonsPerMonth,
      nextMonthLessons,
      nextMonthAmount,
      debtAmount,
      options: {
        oneMonth: Math.round(monthlyAmount),
        twoMonths: Math.round(monthlyAmount * 2),
        threeMonths: Math.round(monthlyAmount * 3),
      },
      currentDebt,
      currentBalance: Number(student.balance?.balance || 0),
      completedLessons: completedLessonsCount,
      theoreticalAmount,
      totalPaid: Math.round(totalPaid),
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
// POST /payments/online/callback — Payme/Uzum callback (webhook)
// ══════════════════════════════════════════════
export const onlinePaymentCallback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId, transactionId, provider, status } = req.body;

    const payment = await prisma.payment.findFirst({
      where: { providerOrderId: orderId },
    });
    if (!payment) { sendError(res, 'Payment topilmadi', 404); return; }

    if (status === 'SUCCESS' || status === 'PAID') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          transactionId,
        },
      });

      // Student balance yangilash
      await prisma.studentBalance.upsert({
        where: { studentId: payment.studentId },
        update: {
          balance: { increment: Number(payment.amount) },
          lastUpdated: new Date(),
        },
        create: {
          studentId: payment.studentId,
          balance: Number(payment.amount),
          debt: 0,
        },
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
};
