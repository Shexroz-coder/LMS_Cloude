/**
 * Teacher uchun Telegram bot handlerlari
 * Darslar, guruhlar, davomat, maosh
 */
import { BotContext } from '../bot';
import { getUserByChatId } from '../services/data.service';
import { teacherMainMenu, backToMenu } from '../utils/keyboards';
import { escapeHtml, formatMoney, brandHeader } from '../utils/format';
import prisma from '../../lib/prisma';
import { InlineKeyboard } from 'grammy';

const DAY_NAMES = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];

// ── Teacher tekshirish va topish ──────────────────
async function getTeacher(ctx: BotContext) {
  const chatId = String(ctx.chat?.id);
  const user = await getUserByChatId(chatId);
  if (!user || user.role !== 'TEACHER') {
    await ctx.editMessageText('❌ Faqat o\'qituvchilar uchun.', { reply_markup: backToMenu() });
    return null;
  }

  const teacher = await prisma.teacher.findUnique({
    where: { userId: user.id },
    include: {
      user: { select: { fullName: true, phone: true } },
    },
  });

  if (!teacher) {
    await ctx.editMessageText('❌ O\'qituvchi profili topilmadi.', { reply_markup: backToMenu() });
    return null;
  }

  return teacher;
}

// ── Bugungi darslar ──────────────────────────────────
export async function handleTeacherTodayLessons(ctx: BotContext) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  const today = new Date();
  const todayDay = today.getDay();

  const groups = await prisma.group.findMany({
    where: { teacherId: teacher.id, status: 'ACTIVE' },
    include: {
      course: { select: { name: true } },
      schedules: { where: { daysOfWeek: { has: todayDay } } },
      _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
    },
  });

  let text = brandHeader('📅', `BUGUNGI DARSLAR — ${DAY_NAMES[todayDay]}`);

  const todayGroups = groups.filter(g => g.schedules.length > 0);

  if (todayGroups.length === 0) {
    text += '🎉 Bugun dars yo\'q!';
  } else {
    for (const g of todayGroups) {
      for (const s of g.schedules) {
        text += `📚 <b>${escapeHtml(g.name)}</b> (${g.course.name})\n`;
        text += `   🕐 ${s.startTime} — ${s.endTime}\n`;
        text += `   👥 ${g._count.groupStudents} o'quvchi | 🏠 ${s.room || '-'}\n\n`;
      }
    }
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: teacherMainMenu() });
}

// ── Haftalik jadval ──────────────────────────────────
export async function handleTeacherWeekSchedule(ctx: BotContext) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  const groups = await prisma.group.findMany({
    where: { teacherId: teacher.id, status: 'ACTIVE' },
    include: {
      course: { select: { name: true } },
      schedules: true,
    },
  });

  let text = brandHeader('🗓', 'HAFTALIK JADVAL');

  const weekly: Record<number, string[]> = {};
  for (let d = 0; d <= 6; d++) weekly[d] = [];

  for (const g of groups) {
    for (const s of g.schedules) {
      for (const day of s.daysOfWeek) {
        weekly[day].push(`   📚 ${g.name} (${g.course.name}) — ${s.startTime}-${s.endTime}`);
      }
    }
  }

  for (let d = 1; d <= 6; d++) {
    if (weekly[d].length > 0) {
      text += `\n<b>${DAY_NAMES[d]}</b>\n`;
      text += weekly[d].join('\n') + '\n';
    }
  }
  // Yakshanba
  if (weekly[0].length > 0) {
    text += `\n<b>${DAY_NAMES[0]}</b>\n`;
    text += weekly[0].join('\n') + '\n';
  }

  if (groups.length === 0) {
    text += '\n<i>Guruhlar topilmadi</i>';
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: teacherMainMenu() });
}

// ── Guruhlar ro'yxati ────────────────────────────────
export async function handleTeacherGroups(ctx: BotContext) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  const groups = await prisma.group.findMany({
    where: { teacherId: teacher.id, status: 'ACTIVE' },
    include: {
      course: { select: { name: true, monthlyPrice: true } },
      groupStudents: {
        where: { status: 'ACTIVE' },
        include: { student: { include: { user: { select: { fullName: true } } } } },
      },
      schedules: true,
    },
  });

  let text = brandHeader('👥', 'GURUHLARIM');
  text += `Jami: <b>${groups.length}</b> guruh\n`;

  for (const g of groups) {
    text += `\n📚 <b>${escapeHtml(g.name)}</b> (${g.course.name})\n`;
    text += `   👥 O'quvchilar: ${g.groupStudents.length}/${g.maxStudents}\n`;

    for (const gs of g.groupStudents) {
      text += `      • ${escapeHtml(gs.student.user.fullName)}\n`;
    }
  }

  if (groups.length === 0) {
    text += '\n<i>Faol guruhlar yo\'q</i>';
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: teacherMainMenu() });
}

// ── Davomat belgilash ────────────────────────────────
export async function handleTeacherAttendance(ctx: BotContext) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  // Bugungi darslarni ko'rsatish
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lessons = await prisma.lesson.findMany({
    where: {
      date: today,
      group: { teacherId: teacher.id },
    },
    include: {
      group: {
        include: {
          course: { select: { name: true } },
          groupStudents: {
            where: { status: 'ACTIVE' },
            include: { student: { include: { user: { select: { fullName: true } } } } },
          },
        },
      },
      attendance: true,
    },
    orderBy: { startTime: 'asc' },
  });

  let text = brandHeader('✅', 'DAVOMAT');

  if (lessons.length === 0) {
    text += 'Bugungi darslar topilmadi.\n';
    text += '<i>Davomat LMS tizimida belgilanadi.</i>';
  } else {
    for (const l of lessons) {
      const total = l.group.groupStudents.length;
      const marked = l.attendance.length;
      const present = l.attendance.filter(a => a.status === 'PRESENT').length;
      const statusIcon = l.status === 'COMPLETED' ? '✅' : '🕐';

      text += `${statusIcon} <b>${escapeHtml(l.group.name)}</b> (${l.startTime}-${l.endTime})\n`;
      text += `   Davomat: ${marked}/${total} belgilangan | ${present} kelgan\n\n`;
    }
    text += '<i>To\'liq davomat LMS tizimida belgilanadi.</i>';
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: teacherMainMenu() });
}

// ── Maosh ────────────────────────────────────────────
export async function handleTeacherSalary(ctx: BotContext) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  const salaries = await prisma.teacherSalary.findMany({
    where: { teacherId: teacher.id },
    orderBy: { month: 'desc' },
    take: 6,
  });

  let text = brandHeader('💰', 'MAOSH MA\'LUMOTLARI');

  // Maosh turi
  const salaryTypeText = teacher.salaryType === 'PERCENTAGE_FROM_PAYMENT'
    ? `${Number(teacher.salaryValue)}% to'lovlardan`
    : teacher.salaryType === 'PER_LESSON_HOUR'
      ? `${formatMoney(Number(teacher.salaryValue))}/soat`
      : `${formatMoney(Number(teacher.salaryValue))}/oy`;

  text += `📋 Hisoblash turi: <b>${salaryTypeText}</b>\n\n`;

  if (salaries.length === 0) {
    text += '<i>Maosh tarixi yo\'q</i>';
  } else {
    text += '<b>Oxirgi maoshlar:</b>\n\n';
    for (const s of salaries) {
      const month = new Date(s.month);
      const statusIcon = s.status === 'PAID' ? '✅' : '⏳';
      text += `${statusIcon} <b>${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}</b>\n`;
      text += `   Hisoblangan: ${formatMoney(Number(s.calculatedSalary))}\n`;
      text += `   To'langan: ${formatMoney(Number(s.paidSalary))}\n\n`;
    }
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: teacherMainMenu() });
}
