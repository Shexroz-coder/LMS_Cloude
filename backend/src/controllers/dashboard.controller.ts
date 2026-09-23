import prisma from '../lib/prisma';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';
import { getFinanceTotals } from '../services/finance.service';
import { getBranchId } from '../utils/branch.utils';


// ══════════════════════════════════════════════
// GET /dashboard/stats — Admin dashboard
// ══════════════════════════════════════════════
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    // /attendance/stats bilan BIR XIL chegara (UTC) — sahifalar orasida farq bo'lmasligi uchun
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Filial filtri (?branchId=N)
    const bRaw = (req.query as Record<string, string>).branchId;
    const bId = bRaw && bRaw !== 'all' ? parseInt(bRaw) : NaN;
    const branchId = Number.isFinite(bId) && bId > 0 ? bId : undefined;
    const studentBranch = branchId ? { branchId } : {};
    const groupBranch = branchId ? { branchId } : {};

    const [
      studentsCount, teachersCount,
      monthlyIncome, financeTotals,
      totalExpenses, todayLessons,
      attendanceData, coinTotal, activeGroups
    ] = await Promise.all([
      prisma.student.count({ where: { user: { isActive: true }, ...(studentBranch as any) } }),
      prisma.teacher.count({ where: { user: { isActive: true, ...(branchId ? { branchId } : {}) } } as any }),
      prisma.payment.aggregate({
        where: {
          paidAt: { gte: monthStart, lte: monthEnd }, isDeleted: false,
          ...(branchId ? { student: { branchId } } : {}),
        } as any,
        _sum: { amount: true }
      }),
      getFinanceTotals(branchId), // ← YAGONA qarz manbai (filial bo'yicha)
      prisma.expense.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd }, ...(branchId ? { branchId } : {}) } as any,
        _sum: { amount: true }
      }),
      prisma.lesson.count({ where: { date: { gte: todayStart, lte: todayEnd }, ...(branchId ? { group: { branchId } } : {}) } as any }),
      prisma.attendance.groupBy({
        by: ['status'],
        where: { lesson: { date: { gte: monthStart, lte: monthEnd }, ...(branchId ? { group: { branchId } } : {}) } } as any,
        _count: true
      }),
      prisma.student.aggregate({ where: studentBranch as any, _sum: { coinBalance: true } }),
      prisma.group.count({ where: { status: 'ACTIVE', ...(groupBranch as any) } })
    ]);

    const income = Number(monthlyIncome._sum.amount || 0);
    const expenses = Number(totalExpenses._sum.amount || 0);
    const debt = financeTotals.totalDebt;
    const netProfit = income - expenses;

    const totalAttendance = attendanceData.reduce((sum, a) => sum + a._count, 0);
    const presentAttendance = attendanceData
      .filter(a => a.status === 'PRESENT' || a.status === 'LATE')
      .reduce((sum, a) => sum + a._count, 0);
    const attendanceRate = totalAttendance > 0
      ? Math.round((presentAttendance / totalAttendance) * 100)
      : 0;

    sendSuccess(res, {
      studentsCount,
      teachersCount,
      monthlyIncome: income,
      totalDebt: debt,
      netProfit,
      attendanceRate,
      todayLessons,
      coinTotal: Number(coinTotal._sum.coinBalance || 0),
      activeGroups,
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    sendError(res, 'Dashboard ma\'lumotlarini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /dashboard/income-chart — So'nggi 6 oy
// ══════════════════════════════════════════════
export const getIncomeChart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = getBranchId(req);
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(new Date(d.getFullYear(), d.getMonth(), 1));
    }

    const chartData = await Promise.all(
      months.map(async (start) => {
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        const [income, expenses] = await Promise.all([
          prisma.payment.aggregate({
            where: { paidAt: { gte: start, lte: end }, isDeleted: false, ...(branchId ? { student: { branchId } } : {}) } as any,
            _sum: { amount: true }
          }),
          prisma.expense.aggregate({
            where: { date: { gte: start, lte: end }, ...(branchId ? { branchId } : {}) } as any,
            _sum: { amount: true }
          })
        ]);
        const monthNames = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
        return {
          month: monthNames[start.getMonth()],
          income: Number(income._sum.amount || 0),
          expenses: Number(expenses._sum.amount || 0),
        };
      })
    );

    sendSuccess(res, chartData);
  } catch (err) {
    console.error('getIncomeChart error:', err);
    sendError(res, 'Grafik ma\'lumotlarini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /dashboard/recent-payments
// ══════════════════════════════════════════════
export const getRecentPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = getBranchId(req);
    const payments = await prisma.payment.findMany({
      where: { isDeleted: false, ...(branchId ? { student: { branchId } } : {}) } as any,
      take: 10,
      orderBy: { paidAt: 'desc' },
      include: {
        student: {
          include: { user: { select: { fullName: true, phone: true } } }
        }
      }
    });

    sendSuccess(res, payments);
  } catch (err) {
    console.error('getRecentPayments error:', err);
    sendError(res, 'So\'nggi to\'lovlarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /dashboard/weekly-attendance — Haftalik davomat
// ══════════════════════════════════════════════
export const getWeeklyAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = getBranchId(req);
    const now = new Date();
    const dayNames = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

      const grouped = await prisma.attendance.groupBy({
        by: ['status'],
        where: { lesson: { date: { gte: start, lte: end }, ...(branchId ? { group: { branchId } } : {}) } } as any,
        _count: true,
      });

      const present = grouped.filter(g => g.status === 'PRESENT' || g.status === 'LATE').reduce((s, g) => s + g._count, 0);
      const absent = grouped.filter(g => g.status === 'ABSENT').reduce((s, g) => s + g._count, 0);

      result.push({
        day: dayNames[date.getDay()],
        present,
        absent,
      });
    }

    sendSuccess(res, result);
  } catch (err) {
    console.error('getWeeklyAttendance error:', err);
    sendError(res, 'Haftalik davomat ma\'lumotlarini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /dashboard/today-lessons — Bugungi darslar
// ══════════════════════════════════════════════
export const getTodayLessons = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = getBranchId(req);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const lessons = await prisma.lesson.findMany({
      where: { date: { gte: todayStart, lte: todayEnd }, ...(branchId ? { group: { branchId } } : {}) } as any,
      include: {
        group: {
          include: {
            teacher: { include: { user: { select: { fullName: true } } } },
            course: { select: { name: true } },
            _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } }
          }
        },
        _count: { select: { attendance: true } }
      },
      orderBy: { startTime: 'asc' }
    });

    sendSuccess(res, lessons);
  } catch (err) {
    console.error('getTodayLessons error:', err);
    sendError(res, 'Bugungi darslarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /dashboard/teacher-debtors — Ustozning guruhlaridagi qarzdor o'quvchilar
// ══════════════════════════════════════════════
export const getTeacherDebtors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Ustozni topish
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) {
      sendError(res, 'Ustoz topilmadi.', 404);
      return;
    }

    // Ustozning faol guruhlaridagi ACTIVE o'quvchilar
    const groupStudents = await prisma.groupStudent.findMany({
      where: {
        status: 'ACTIVE',
        group: { teacherId: teacher.id, status: 'ACTIVE' },
      },
      include: {
        student: {
          include: {
            user: { select: { fullName: true, phone: true, avatarUrl: true } },
            balance: { select: { balance: true, debt: true } },
          },
        },
        group: {
          select: { id: true, name: true, course: { select: { name: true } } },
        },
      },
    });

    // Faqat qarzdor o'quvchilarni filtrlash
    const debtors = groupStudents
      .filter(gs => {
        const debt = Number(gs.student.balance?.debt || 0);
        return debt > 0;
      })
      .map(gs => ({
        studentId: gs.student.id,
        fullName: gs.student.user.fullName,
        phone: gs.student.user.phone,
        avatarUrl: gs.student.user.avatarUrl,
        groupId: gs.group.id,
        groupName: gs.group.name,
        courseName: gs.group.course.name,
        debt: Number(gs.student.balance?.debt || 0),
        balance: Number(gs.student.balance?.balance || 0),
      }))
      .sort((a, b) => b.debt - a.debt);

    sendSuccess(res, {
      debtors,
      totalDebt: debtors.reduce((sum, d) => sum + d.debt, 0),
      count: debtors.length,
    });
  } catch (err) {
    console.error('getTeacherDebtors error:', err);
    sendError(res, 'Qarzdor o\'quvchilarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /dashboard/today-schedule — Bugungi dars jadvali (Schedule asosida)
// Admin, Teacher, Student uchun
// ══════════════════════════════════════════════
export const getTodaySchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const todayDay = new Date().getDay(); // 0=Yakshanba, 1=Dushanba, ...

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { status: 'ACTIVE' };

    if (role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId } });
      if (!student) { sendSuccess(res, []); return; }
      where.groupStudents = { some: { studentId: student.id, status: 'ACTIVE' } };
    } else if (role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } });
      if (!teacher) { sendSuccess(res, []); return; }
      where.teacherId = teacher.id;
    } else if (role === 'PARENT') {
      // Ota-ona faqat farzandlarining guruhlarini ko'radi
      const children = await prisma.student.findMany({
        where: { parentId: userId },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      if (childIds.length === 0) { sendSuccess(res, []); return; }
      where.groupStudents = { some: { studentId: { in: childIds }, status: 'ACTIVE' } };
    }
    // ADMIN → barcha aktiv guruhlar

    const groups = await prisma.group.findMany({
      where,
      include: {
        course: { select: { name: true } },
        teacher: { include: { user: { select: { fullName: true } } } },
        schedules: true,
        _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
      },
    });

    const todaySchedules = groups
      .flatMap((g) =>
        (g.schedules || [])
          .filter((sc) => sc.daysOfWeek.includes(todayDay))
          .map((sc) => ({
            scheduleId: sc.id,
            groupId: g.id,
            groupName: g.name,
            courseName: g.course.name,
            teacherName: g.teacher.user.fullName,
            startTime: sc.startTime,
            endTime: sc.endTime,
            room: sc.room ?? null,
            studentCount: g._count.groupStudents,
          }))
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    sendSuccess(res, todaySchedules);
  } catch (err) {
    console.error('getTodaySchedule error:', err);
    sendError(res, 'Bugungi jadvalda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /dashboard/new-leads — Yangi ro'yxatdan o'tganlar (LEAD)
// ══════════════════════════════════════════════
const DAY_NAMES_LEAD = ['Yak', 'Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha'];
const TIME_LABELS_LEAD: Record<string, string> = {
  morning:   'Ertalab (9–12)',
  afternoon: 'Kunduz (12–17)',
  evening:   'Kechqurun (17–21)',
};

export const getNewLeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = getBranchId(req);
    const leads = await prisma.student.findMany({
      where: {
        status: 'LEAD',
        // Faol guruhda yo'q bo'lgan LEAD larni ko'rsatish
        groupStudents: { none: { status: 'ACTIVE' } },
        ...(branchId ? { branchId } : {}),
      } as any,
      include: {
        user: {
          select: { id: true, fullName: true, phone: true, createdAt: true },
        },
        groupStudents: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
      },
      orderBy: { user: { createdAt: 'desc' } },
      take: 50,
    });

    // Course names for leads with interestedCourseId
    const courseIds = [...new Set(leads.map(l => (l as any).interestedCourseId).filter(Boolean))];
    const courses = courseIds.length > 0
      ? await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, name: true } })
      : [];
    const courseMap = new Map(courses.map(c => [c.id, c.name]));

    const result = leads.map(l => {
      const la = l as any;
      return {
        studentId:      l.id,
        userId:         l.user.id,
        fullName:       l.user.fullName,
        phone:          l.user.phone,
        registeredAt:   l.user.createdAt,
        preferredDays:  (la.preferredDays || []).map((d: number) => DAY_NAMES_LEAD[d] || d),
        preferredTime:  la.preferredTime ? TIME_LABELS_LEAD[la.preferredTime] || la.preferredTime : null,
        interestedCourse: la.interestedCourseId ? courseMap.get(la.interestedCourseId) || null : null,
        hasGroup:       l.groupStudents.length > 0,
      };
    });

    sendSuccess(res, { count: result.length, leads: result });
  } catch (err) {
    console.error('getNewLeads error:', err);
    sendError(res, 'Yangi arizalarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /dashboard/branches-comparison — Filiallar taqqoslamasi
// "Barcha filiallar" tanlanганда har filial ko'rsatkichlari yonma-yon
// ══════════════════════════════════════════════
export const getBranchesComparison = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const p = prisma as any;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const branches = await p.branch.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });

    const rows = await Promise.all(branches.map(async (b: any) => {
      const [students, groups, teachers, income, expenses, finance, assetAgg] = await Promise.all([
        p.student.count({ where: { branchId: b.id, status: 'ACTIVE' } }),
        p.group.count({ where: { branchId: b.id, status: 'ACTIVE' } }),
        p.user.count({ where: { branchId: b.id, role: 'TEACHER', isActive: true } }),
        p.payment.aggregate({ where: { isDeleted: false, paidAt: { gte: monthStart, lte: monthEnd }, student: { branchId: b.id } }, _sum: { amount: true } }),
        p.expense.aggregate({ where: { branchId: b.id, date: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
        getFinanceTotals(b.id),
        p.asset.aggregate({ where: { branchId: b.id }, _sum: { quantity: true } }),
      ]);
      const inc = Math.round(Number(income._sum?.amount || 0));
      const exp = Math.round(Number(expenses._sum?.amount || 0));
      return {
        id: b.id, name: b.name,
        students, groups, teachers,
        monthIncome: inc, monthExpenses: exp, netProfit: inc - exp,
        totalDebt: finance.totalDebt,
        assets: Number(assetAgg._sum?.quantity || 0),
      };
    }));

    // Umumiy yig'indi
    const totals = rows.reduce((acc: any, r: any) => ({
      students: acc.students + r.students,
      groups: acc.groups + r.groups,
      teachers: acc.teachers + r.teachers,
      monthIncome: acc.monthIncome + r.monthIncome,
      monthExpenses: acc.monthExpenses + r.monthExpenses,
      netProfit: acc.netProfit + r.netProfit,
      totalDebt: acc.totalDebt + r.totalDebt,
      assets: acc.assets + r.assets,
    }), { students: 0, groups: 0, teachers: 0, monthIncome: 0, monthExpenses: 0, netProfit: 0, totalDebt: 0, assets: 0 });

    sendSuccess(res, { branches: rows, totals });
  } catch (err) {
    console.error('getBranchesComparison error:', err);
    sendError(res, 'Filiallar taqqoslamasini olishda xato.', 500);
  }
};
