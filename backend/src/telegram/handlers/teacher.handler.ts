/**
 * Teacher uchun Telegram bot handlerlari
 * Darslar, guruhlar, davomat belgilash, maosh
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

// ══════════════════════════════════════════════════════
//  DAVOMAT BELGILASH TIZIMI
// ══════════════════════════════════════════════════════

// ── 1-qadam: Guruh tanlash ───────────────────────────
export async function handleTeacherAttendance(ctx: BotContext) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  const groups = await prisma.group.findMany({
    where: { teacherId: teacher.id, status: 'ACTIVE' },
    include: {
      course: { select: { name: true } },
      _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
    },
    orderBy: { name: 'asc' },
  });

  let text = brandHeader('✅', 'DAVOMAT BELGILASH');
  text += 'Guruhni tanlang:\n';

  const kb = new InlineKeyboard();

  for (const g of groups) {
    text += `\n📚 ${escapeHtml(g.name)} — ${g._count.groupStudents} o'quvchi`;
    kb.text(`📚 ${g.name}`, `att_group_${g.id}`).row();
  }

  if (groups.length === 0) {
    text += '\n<i>Faol guruhlar topilmadi</i>';
  }

  kb.text('⬅️ Asosiy menyu', 'main_menu');

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ── 2-qadam: Darsni topish yoki yaratish + o'quvchilar ko'rsatish ──
export async function handleAttGroupSelect(ctx: BotContext, groupId: number) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  // Guruhni tekshirish (bu teacher'ga tegishlimi)
  const group = await prisma.group.findFirst({
    where: { id: groupId, teacherId: teacher.id },
    include: {
      course: { select: { name: true } },
      schedules: true,
      groupStudents: {
        where: { status: 'ACTIVE' },
        include: { student: { include: { user: { select: { fullName: true } } } } },
      },
    },
  });

  if (!group) {
    await ctx.editMessageText('❌ Guruh topilmadi.', { reply_markup: teacherMainMenu() });
    return;
  }

  // Bugungi darsni topish yoki yaratish
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let lesson = await prisma.lesson.findFirst({
    where: { groupId, date: today },
    include: { attendance: true },
  });

  // Agar bugun dars yo'q bo'lsa — yaratish
  if (!lesson) {
    // Schedule dan vaqtni olish
    const todayDay = new Date().getDay();
    const schedule = group.schedules.find(s => s.daysOfWeek.includes(todayDay));
    const startTime = schedule?.startTime || '09:00';
    const endTime = schedule?.endTime || '10:00';

    // Soatlar farqi
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const duration = ((eh * 60 + em) - (sh * 60 + sm)) / 60;

    lesson = await prisma.lesson.create({
      data: {
        groupId,
        date: today,
        startTime,
        endTime,
        status: 'SCHEDULED',
        durationHours: duration > 0 ? duration : 1,
      },
      include: { attendance: true },
    });
  }

  // O'quvchilar ro'yxatini ko'rsatish davomat holati bilan
  let text = brandHeader('✅', `DAVOMAT — ${escapeHtml(group.name)}`);
  text += `📅 ${today.toLocaleDateString('uz')} | 🕐 ${lesson.startTime}-${lesson.endTime}\n`;
  text += `📚 ${group.course.name}\n\n`;

  const kb = new InlineKeyboard();

  for (const gs of group.groupStudents) {
    const att = lesson.attendance.find(a => a.studentId === gs.studentId);
    const statusIcon = att
      ? att.status === 'PRESENT' ? '✅' : att.status === 'ABSENT' ? '❌' : att.status === 'LATE' ? '⏰' : '📋'
      : '⬜';

    text += `${statusIcon} ${escapeHtml(gs.student.user.fullName)}\n`;

    // Har bir o'quvchi uchun 3 ta tugma: Keldi / Kelmadi / Kechikdi
    kb.text(att?.status === 'PRESENT' ? '✅' : '◻️', `att_mark_${lesson.id}_${gs.studentId}_PRESENT`)
      .text(att?.status === 'ABSENT' ? '❌' : '◻️', `att_mark_${lesson.id}_${gs.studentId}_ABSENT`)
      .text(att?.status === 'LATE' ? '⏰' : '◻️', `att_mark_${lesson.id}_${gs.studentId}_LATE`)
      .text(`${gs.student.user.fullName.split(' ')[0]}`, `att_noop`)
      .row();
  }

  text += '\n<i>✅ Keldi | ❌ Kelmadi | ⏰ Kechikdi</i>';

  // Barchani PRESENT qilish va darsni tugatish tugmalari
  kb.text('✅ Barchasi keldi', `att_all_present_${lesson.id}_${groupId}`).row();
  kb.text('📝 Darsni tugatish', `att_complete_${lesson.id}_${groupId}`).row();
  kb.text('⬅️ Guruhlar', 'teacher_attendance').text('🏠 Menyu', 'main_menu').row();

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ── 3-qadam: Individual davomat belgilash ────────────
export async function handleAttMark(ctx: BotContext, lessonId: number, studentId: number, status: string) {
  // Validatsiya
  if (!['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(status)) return;

  const attStatus = status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

  try {
    // Upsert — mavjud bo'lsa yangilash, yo'q bo'lsa yaratish
    await prisma.attendance.upsert({
      where: {
        lessonId_studentId: { lessonId, studentId },
      },
      update: {
        status: attStatus,
        markedAt: new Date(),
      },
      create: {
        lessonId,
        studentId,
        status: attStatus,
        markedAt: new Date(),
      },
    });

    // Darsning groupId sini topish va sahifani yangilash
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { groupId: true },
    });

    if (lesson) {
      await handleAttGroupSelect(ctx, lesson.groupId);
    }
  } catch (err) {
    console.error('❌ Davomat belgilashda xatolik:', err);
    // Xatolik bo'lsa ham sahifani yangilamaslik
  }
}

// ── Barchani PRESENT qilish ──────────────────────────
export async function handleAttAllPresent(ctx: BotContext, lessonId: number, groupId: number) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  // Guruhning barcha faol o'quvchilarini olish
  const groupStudents = await prisma.groupStudent.findMany({
    where: { groupId, status: 'ACTIVE' },
    select: { studentId: true },
  });

  // Barchaga PRESENT belgilash
  for (const gs of groupStudents) {
    await prisma.attendance.upsert({
      where: {
        lessonId_studentId: { lessonId, studentId: gs.studentId },
      },
      update: {
        status: 'PRESENT',
        markedAt: new Date(),
      },
      create: {
        lessonId,
        studentId: gs.studentId,
        status: 'PRESENT',
        markedAt: new Date(),
      },
    });
  }

  // Sahifani yangilash
  await handleAttGroupSelect(ctx, groupId);
}

// ── Darsni tugatish (COMPLETED) ──────────────────────
export async function handleAttComplete(ctx: BotContext, lessonId: number, groupId: number) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  // Darsni COMPLETED qilish
  await prisma.lesson.update({
    where: { id: lessonId },
    data: { status: 'COMPLETED' },
  });

  // Belgilanmagan o'quvchilarni ABSENT qilish
  const groupStudents = await prisma.groupStudent.findMany({
    where: { groupId, status: 'ACTIVE' },
    select: { studentId: true },
  });

  const existingAttendance = await prisma.attendance.findMany({
    where: { lessonId },
    select: { studentId: true },
  });

  const markedIds = new Set(existingAttendance.map(a => a.studentId));

  for (const gs of groupStudents) {
    if (!markedIds.has(gs.studentId)) {
      await prisma.attendance.create({
        data: {
          lessonId,
          studentId: gs.studentId,
          status: 'ABSENT',
          markedAt: new Date(),
        },
      });
    }
  }

  // Statistika ko'rsatish
  const attendance = await prisma.attendance.findMany({
    where: { lessonId },
    include: { student: { include: { user: { select: { fullName: true } } } } },
  });

  const present = attendance.filter(a => a.status === 'PRESENT').length;
  const absent = attendance.filter(a => a.status === 'ABSENT').length;
  const late = attendance.filter(a => a.status === 'LATE').length;

  let text = brandHeader('📝', 'DARS YAKUNLANDI');
  text += `\n✅ Keldi: <b>${present}</b>\n`;
  text += `❌ Kelmadi: <b>${absent}</b>\n`;
  text += `⏰ Kechikdi: <b>${late}</b>\n\n`;

  text += '<b>Tafsilotlar:</b>\n';
  for (const a of attendance) {
    const icon = a.status === 'PRESENT' ? '✅' : a.status === 'ABSENT' ? '❌' : '⏰';
    text += `${icon} ${escapeHtml(a.student.user.fullName)}\n`;
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
