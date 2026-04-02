/**
 * Teacher uchun Telegram bot handlerlari
 * Darslar, guruhlar, davomat belgilash, maosh
 */
import { BotContext } from '../bot';
import { getUserByChatId, getTeacherGroupsWithStudents, giveCoinToStudent } from '../services/data.service';
import { teacherMainMenu, backToMenu, coinGroupSelect, coinStudentSelect } from '../utils/keyboards';
import { escapeHtml, formatMoney, brandHeader } from '../utils/format';
import prisma from '../../lib/prisma';
import { InlineKeyboard } from 'grammy';

const DAY_NAMES = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];

/**
 * Mahalliy vaqt (Toshkent UTC+5) bo'yicha YYYY-MM-DD formatida sana.
 * MUHIM: toISOString() UTC ga o'giradi — buning natijasida tun yarimida
 * sanalar 1 kun orqaga siljiydi. Bu funksiya local vaqtni to'g'ri qaytaradi.
 */
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

// Yordamchi: ikkita sanani solishtirish (faqat kun)
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  const d1 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const d2 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((d2.getTime() - d1.getTime()) / msPerDay);
}

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

// ── 2-qadam: Guruh tanlanganda — shu oyning dars kunlarini ko'rsatish ──
export async function handleAttGroupSelect(ctx: BotContext, groupId: number) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  const group = await prisma.group.findFirst({
    where: { id: groupId, teacherId: teacher.id },
    include: {
      course: { select: { name: true } },
      schedules: true,
    },
  });

  if (!group) {
    await ctx.editMessageText('❌ Guruh topilmadi.', { reply_markup: teacherMainMenu() });
    return;
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthName = MONTH_NAMES[m];

  // MUHIM: Date.UTC ishlatiladi — TZ=Tashkent bo'lganda new Date(y,m,1)
  // local midnight = UTC-da kechqurun (oldingisi), bu PostgreSQL DATE ni
  // 1 kun orqaga siljitadi. Date.UTC bilan UTC yarim tunidan boshlaymiz.
  const monthStart = new Date(Date.UTC(y, m, 1));
  const monthEnd   = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));

  // Shu oyning darslarini topish
  const lessons = await prisma.lesson.findMany({
    where: { groupId, date: { gte: monthStart, lte: monthEnd } },
    include: { attendance: true },
    orderBy: { date: 'asc' },
  });

  // Schedule dan dars kunlarini hisoblash (lessonlar yo'q bo'lgan kunlar uchun)
  const scheduledDays: Date[] = [];
  const current = new Date(monthStart);
  while (current <= monthEnd) {
    const dayOfWeek = current.getDay();
    const hasSchedule = group.schedules.some(s => s.daysOfWeek.includes(dayOfWeek));
    if (hasSchedule) {
      scheduledDays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  // today — Toshkent sanasidan UTC midnight: scheduledDate (Date.UTC) bilan mos
  const today = new Date(formatLocalDate(new Date()) + 'T00:00:00.000Z');

  let text = brandHeader('✅', `DAVOMAT — ${escapeHtml(group.name)}`);
  text += `📚 ${group.course.name} | 📅 ${monthName}\n\n`;

  const kb = new InlineKeyboard();
  let unmarkedCount = 0;

  for (const scheduledDate of scheduledDays) {
    const lesson = lessons.find(l => isSameDay(new Date(l.date), scheduledDate));
    const dateStr = `${scheduledDate.getDate()}-${monthName.slice(0, 3)}`;
    const dayName = DAY_NAMES[scheduledDate.getDay()].slice(0, 3);
    const isFuture = scheduledDate > today;
    const isToday = isSameDay(scheduledDate, today);
    const daysAgo = daysBetween(scheduledDate, today);

    if (isFuture) {
      // Kelajak kun — disable
      text += `🔒 <code>${dateStr}</code> (${dayName}) — <i>hali kelmagan</i>\n`;
      kb.text(`🔒 ${dateStr} ${dayName}`, 'att_noop').row();
    } else if (lesson) {
      // Dars mavjud — davomat holatini ko'rsatish
      const totalStudents = lesson.attendance.length;
      const present = lesson.attendance.filter(a => a.status === 'PRESENT').length;
      const absent = lesson.attendance.filter(a => a.status === 'ABSENT').length;
      const late = lesson.attendance.filter(a => a.status === 'LATE').length;

      if (lesson.status === 'COMPLETED') {
        text += `✅ <code>${dateStr}</code> (${dayName}) — ✅${present} ❌${absent} ⏰${late}\n`;
      } else {
        text += `📝 <code>${dateStr}</code> (${dayName}) — belgilanmoqda (${totalStudents} ta)\n`;
      }

      if (isToday) {
        kb.text(`📝 ${dateStr} ${dayName} — Bugun`, `att_day_${groupId}_${formatLocalDate(scheduledDate)}`).row();
      } else if (daysAgo === 1) {
        // Kecha — sababsiz tahrirlash mumkin
        kb.text(`📝 ${dateStr} ${dayName} — Kecha`, `att_day_${groupId}_${formatLocalDate(scheduledDate)}`).row();
      } else {
        // Eski kun — sabab kerak
        kb.text(`⚠️ ${dateStr} ${dayName} — Kechikkan`, `att_late_day_${groupId}_${formatLocalDate(scheduledDate)}`).row();
      }
    } else {
      // Dars yaratilmagan (o'tib ketgan kun)
      unmarkedCount++;
      if (isToday) {
        text += `⬜ <code>${dateStr}</code> (${dayName}) — <b>belgilanmagan</b>\n`;
        kb.text(`📝 ${dateStr} ${dayName} — Bugun`, `att_day_${groupId}_${formatLocalDate(scheduledDate)}`).row();
      } else if (daysAgo === 1) {
        text += `⬜ <code>${dateStr}</code> (${dayName}) — <b>belgilanmagan</b>\n`;
        kb.text(`📝 ${dateStr} ${dayName} — Kecha`, `att_day_${groupId}_${formatLocalDate(scheduledDate)}`).row();
      } else {
        text += `🔴 <code>${dateStr}</code> (${dayName}) — <b>belgilanmagan!</b>\n`;
        kb.text(`⚠️ ${dateStr} ${dayName} — Kechikkan`, `att_late_day_${groupId}_${formatLocalDate(scheduledDate)}`).row();
      }
    }
  }

  if (unmarkedCount > 0) {
    text += `\n⚠️ <b>${unmarkedCount}</b> ta dars belgilanmagan!`;
  }

  text += '\n\n<i>📝 — tahrirlash | 🔒 — hali kelmagan | ⚠️ — kechikkan (sabab kerak)</i>';

  kb.text('⬅️ Guruhlar', 'teacher_attendance').text('🏠 Menyu', 'main_menu').row();

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ── 3-qadam: Kunni tanlash — o'quvchilar davomat sahifasi ──
export async function handleAttDay(ctx: BotContext, groupId: number, dateStr: string) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

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

  // MUHIM: 'Z' suffiksi — UTC yarim tuni. TZ=Tashkent bo'lganda
  // 'T00:00:00' local tun = UTC da kechqurun → PostgreSQL DATE 1 kun orqaga siljiydi.
  const lessonDate = new Date(dateStr + 'T00:00:00.000Z');
  const todayStr = formatLocalDate(new Date());
  const today = new Date(todayStr + 'T00:00:00.000Z');

  // Kelajak kunni blok qilish
  if (lessonDate > today) {
    await ctx.editMessageText('🔒 Hali kelmagan kunga davomat qilib bo\'lmaydi.', { reply_markup: teacherMainMenu() });
    return;
  }

  // Darsni topish yoki yaratish
  let lesson = await prisma.lesson.findFirst({
    where: { groupId, date: lessonDate },
    include: { attendance: true },
  });

  if (!lesson) {
    const dayOfWeek = lessonDate.getDay();
    const schedule = group.schedules.find(s => s.daysOfWeek.includes(dayOfWeek));
    const startTime = schedule?.startTime || '09:00';
    const endTime = schedule?.endTime || '10:00';

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const duration = ((eh * 60 + em) - (sh * 60 + sm)) / 60;

    lesson = await prisma.lesson.create({
      data: {
        groupId,
        date: lessonDate,
        startTime,
        endTime,
        status: 'SCHEDULED',
        durationHours: duration > 0 ? duration : 1,
      },
      include: { attendance: true },
    });
  }

  // UTC getterlar — kunning o'rtasi orqali timezone xavfsiz display
  const dispDate = new Date(dateStr + 'T12:00:00.000Z');
  const dayName = DAY_NAMES[dispDate.getUTCDay()];
  const dateDisplay = `${dispDate.getUTCDate()}-${MONTH_NAMES[dispDate.getUTCMonth()]}`;

  let text = brandHeader('✅', `DAVOMAT — ${escapeHtml(group.name)}`);
  text += `📅 ${dateDisplay} (${dayName}) | 🕐 ${lesson.startTime}-${lesson.endTime}\n`;
  text += `📚 ${group.course.name}\n\n`;

  const kb = new InlineKeyboard();

  for (const gs of group.groupStudents) {
    const att = lesson.attendance.find(a => a.studentId === gs.studentId);
    const statusIcon = att
      ? att.status === 'PRESENT' ? '✅' : att.status === 'ABSENT' ? '❌' : att.status === 'LATE' ? '⏰' : '📋'
      : '⬜';

    // O'quvchi ismi — faqat ism (15 belgigacha qisqartiramiz)
    const shortName = gs.student.user.fullName.split(' ').slice(0, 2).join(' ').slice(0, 18);

    text += `${statusIcon} ${escapeHtml(gs.student.user.fullName)}\n`;

    // Birinchi qator: Ism + 3 ta status tugmasi
    kb.text(`${att?.status === 'PRESENT' ? '✅' : '◻'}Keldi`,   `att_mark_${lesson.id}_${gs.studentId}_PRESENT`)
      .text(`${att?.status === 'ABSENT'  ? '❌' : '◻'}Kelmadi`, `att_mark_${lesson.id}_${gs.studentId}_ABSENT`)
      .text(`${att?.status === 'LATE'    ? '⏰' : '◻'}Kech`,    `att_mark_${lesson.id}_${gs.studentId}_LATE`)
      .row();
    // Ikkinchi qator: O'quvchi nomi (noop)
    kb.text(`👤 ${shortName}`, 'att_noop').row();
  }

  text += '\n<i>◻Keldi = Keldi | ◻Kelmadi = Kelmadi | ◻Kech = Kechikdi</i>';

  kb.text('✅ Barchasi keldi', `att_all_present_${lesson.id}_${groupId}`).row();
  kb.text('📝 Darsni yakunlash', `att_complete_${lesson.id}_${groupId}`).row();
  kb.text('⬅️ Kunlar', `att_group_${groupId}`).text('🏠 Menyu', 'main_menu').row();

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ── Kechikkan davomat (sabab kiritish kerak) ──────────
export async function handleAttLateDay(ctx: BotContext, groupId: number, dateStr: string) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  // Sessionga saqlash — sabab kutish
  ctx.session.step = 'waiting_late_att_reason';
  ctx.session.lateAttGroupId = groupId;
  ctx.session.lateAttDate = dateStr;

  const lessonDate = new Date(dateStr + 'T00:00:00.000Z');
  // Display uchun local getterlar (Tashkent vaqti)
  const tmpDate = new Date(dateStr + 'T12:00:00.000Z'); // kunning o'rtasi — timezone xavfsiz
  const dateDisplay = `${tmpDate.getUTCDate()}-${MONTH_NAMES[tmpDate.getUTCMonth()]}`;
  const dayName = DAY_NAMES[tmpDate.getUTCDay()];

  let text = brandHeader('⚠️', 'KECHIKKAN DAVOMAT');
  text += `📅 <b>${dateDisplay} (${dayName})</b>\n\n`;
  text += `Bu dars 1 kundan ko'proq oldin o'tgan.\n`;
  text += `Kechiktirishning sababini yozing:\n\n`;
  text += `<i>Masalan: "Kasal edim", "Ishda edim" va h.k.</i>`;

  const kb = new InlineKeyboard();
  kb.text('❌ Bekor qilish', `att_group_${groupId}`).row();

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ── Kechikkan davomat sababini qabul qilish (text handler'da chaqiriladi) ──
export async function handleLateAttReason(ctx: BotContext) {
  const reason = ctx.message?.text;
  const groupId = ctx.session.lateAttGroupId;
  const dateStr = ctx.session.lateAttDate;

  // Sessiyani tozalash
  ctx.session.step = 'idle';
  ctx.session.lateAttGroupId = undefined;
  ctx.session.lateAttDate = undefined;

  if (!reason || !groupId || !dateStr) {
    await ctx.reply('❌ Xatolik. /start — qaytadan boshlang.');
    return;
  }

  // Sabab bilan darsga o'tish
  // MUHIM: bu yerda ctx.editMessageText yo'q (text message context) — to'g'ridan DB dan olamiz
  const chatId = String(ctx.chat?.id);
  const user = await (await import('../services/data.service')).getUserByChatId(chatId);
  if (!user || user.role !== 'TEACHER') {
    await ctx.reply('❌ Faqat o\'qituvchilar uchun.');
    return;
  }
  const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
  if (!teacher) {
    await ctx.reply('❌ O\'qituvchi profili topilmadi.');
    return;
  }

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
    await ctx.reply('❌ Guruh topilmadi.');
    return;
  }

  const lessonDate = new Date(dateStr + 'T00:00:00.000Z');

  // Darsni topish yoki yaratish
  let lesson = await prisma.lesson.findFirst({
    where: { groupId, date: lessonDate },
    include: { attendance: true },
  });

  if (!lesson) {
    const dayOfWeek = lessonDate.getDay();
    const schedule = group.schedules.find(s => s.daysOfWeek.includes(dayOfWeek));
    const startTime = schedule?.startTime || '09:00';
    const endTime = schedule?.endTime || '10:00';

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const duration = ((eh * 60 + em) - (sh * 60 + sm)) / 60;

    lesson = await prisma.lesson.create({
      data: {
        groupId,
        date: lessonDate,
        startTime,
        endTime,
        status: 'SCHEDULED',
        durationHours: duration > 0 ? duration : 1,
      },
      include: { attendance: true },
    });
  }

  // UTC getterlar — kunning o'rtasi orqali timezone xavfsiz display
  const dispDate = new Date(dateStr + 'T12:00:00.000Z');
  const dayName = DAY_NAMES[dispDate.getUTCDay()];
  const dateDisplay = `${dispDate.getUTCDate()}-${MONTH_NAMES[dispDate.getUTCMonth()]}`;

  let text = brandHeader('⚠️', `KECHIKKAN DAVOMAT — ${escapeHtml(group.name)}`);
  text += `📅 ${dateDisplay} (${dayName}) | 🕐 ${lesson.startTime}-${lesson.endTime}\n`;
  text += `📚 ${group.course.name}\n`;
  text += `📝 Sabab: <i>${escapeHtml(reason)}</i>\n\n`;

  const kb = new InlineKeyboard();

  for (const gs of group.groupStudents) {
    const att = lesson.attendance.find(a => a.studentId === gs.studentId);
    const statusIcon = att
      ? att.status === 'PRESENT' ? '✅' : att.status === 'ABSENT' ? '❌' : att.status === 'LATE' ? '⏰' : '📋'
      : '⬜';

    text += `${statusIcon} ${escapeHtml(gs.student.user.fullName)}\n`;

    const shortName = gs.student.user.fullName.split(' ').slice(0, 2).join(' ').slice(0, 18);
    kb.text(`${att?.status === 'PRESENT' ? '✅' : '◻'}Keldi`,   `att_mark_${lesson.id}_${gs.studentId}_PRESENT`)
      .text(`${att?.status === 'ABSENT'  ? '❌' : '◻'}Kelmadi`, `att_mark_${lesson.id}_${gs.studentId}_ABSENT`)
      .text(`${att?.status === 'LATE'    ? '⏰' : '◻'}Kech`,    `att_mark_${lesson.id}_${gs.studentId}_LATE`)
      .row();
    kb.text(`👤 ${shortName}`, 'att_noop').row();
  }

  text += '\n<i>◻Keldi = Keldi | ◻Kelmadi = Kelmadi | ◻Kech = Kechikdi</i>';

  kb.text('✅ Barchasi keldi', `att_all_present_${lesson.id}_${groupId}`).row();
  kb.text('📝 Darsni tugatish', `att_complete_${lesson.id}_${groupId}`).row();
  kb.text('⬅️ Kunlar', `att_group_${groupId}`).text('🏠 Menyu', 'main_menu').row();

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ── 4-qadam: Individual davomat belgilash ────────────
export async function handleAttMark(ctx: BotContext, lessonId: number, studentId: number, status: string) {
  if (!['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(status)) return;

  const attStatus = status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

  try {
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

    // Darsning groupId va sanasini topish
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { groupId: true, date: true },
    });

    if (lesson) {
      // Sahifani yangilash — handleAttDay chaqirish
      const dateStr = formatLocalDate(new Date(lesson.date));
      await handleAttDay(ctx, lesson.groupId, dateStr);
    }
  } catch (err) {
    console.error('❌ Davomat belgilashda xatolik:', err);
  }
}

// ── Barchani PRESENT qilish ──────────────────────────
export async function handleAttAllPresent(ctx: BotContext, lessonId: number, groupId: number) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  const groupStudents = await prisma.groupStudent.findMany({
    where: { groupId, status: 'ACTIVE' },
    select: { studentId: true },
  });

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

  // Darsning sanasini topib sahifani yangilash
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { date: true },
  });

  if (lesson) {
    const dateStr = formatLocalDate(new Date(lesson.date));
    await handleAttDay(ctx, groupId, dateStr);
  }
}

// ── Darsni tugatish (COMPLETED) ──────────────────────
export async function handleAttComplete(ctx: BotContext, lessonId: number, groupId: number) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

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

  const kb = new InlineKeyboard();
  kb.text('⬅️ Kunlar', `att_group_${groupId}`).text('🏠 Menyu', 'main_menu').row();

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ── Maosh (hozirgi oy) ─────────────────────────────────
export async function handleTeacherSalary(ctx: BotContext) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const monthName = MONTH_NAMES[now.getMonth()];

  const salaryTypeText = teacher.salaryType === 'PERCENTAGE_FROM_PAYMENT'
    ? `${Number(teacher.salaryValue)}% to'lovlardan`
    : teacher.salaryType === 'PER_LESSON_HOUR'
      ? `${formatMoney(Number(teacher.salaryValue))}/soat`
      : `${formatMoney(Number(teacher.salaryValue))}/oy`;

  // Hozirgi oy maoshi
  const currentSalary = await prisma.teacherSalary.findFirst({
    where: { teacherId: teacher.id, month: { gte: monthStart, lte: monthEnd } },
  });

  // Hozirgi oyda nechta dars o'tdi
  const lessonCount = await prisma.lesson.count({
    where: {
      group: { teacherId: teacher.id },
      date: { gte: monthStart, lte: monthEnd },
      status: 'COMPLETED',
    },
  });

  let text = brandHeader('💰', `MAOSHIM — ${monthName} ${now.getFullYear()}`);
  text += `📋 Hisoblash turi: <b>${salaryTypeText}</b>\n\n`;

  text += `<b>📅 ${monthName} oyi:</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📚 O'tilgan darslar: <b>${lessonCount}</b>\n`;

  if (currentSalary) {
    const statusIcon = currentSalary.status === 'PAID' ? '✅' : '⏳';
    text += `${statusIcon} Hisoblangan: <b>${formatMoney(Number(currentSalary.calculatedSalary))}</b>\n`;
    text += `💵 To'langan: <b>${formatMoney(Number(currentSalary.paidSalary))}</b>\n`;
    const diff = Number(currentSalary.calculatedSalary) - Number(currentSalary.paidSalary);
    if (diff > 0) {
      text += `🔴 Qoldiq: <b>${formatMoney(diff)}</b>\n`;
    }
  } else {
    text += `⏳ Hali hisoblanmagan\n`;
  }

  const kb = new InlineKeyboard();
  kb.text('📂 Arxiv (barcha oylar)', `salary_archive_${teacher.id}`).row();
  kb.text('⬅️ Asosiy menyu', 'main_menu');

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ── Maosh arxivi ─────────────────────────────────────
export async function handleTeacherSalaryArchive(ctx: BotContext, teacherId: number) {
  const teacher = await getTeacher(ctx);
  if (!teacher || teacher.id !== teacherId) return;

  const salaries = await prisma.teacherSalary.findMany({
    where: { teacherId: teacher.id },
    orderBy: { month: 'desc' },
  });

  const salaryTypeText = teacher.salaryType === 'PERCENTAGE_FROM_PAYMENT'
    ? `${Number(teacher.salaryValue)}% to'lovlardan`
    : teacher.salaryType === 'PER_LESSON_HOUR'
      ? `${formatMoney(Number(teacher.salaryValue))}/soat`
      : `${formatMoney(Number(teacher.salaryValue))}/oy`;

  let text = brandHeader('📂', 'MAOSH ARXIVI');
  text += `📋 Hisoblash turi: <b>${salaryTypeText}</b>\n\n`;

  if (salaries.length === 0) {
    text += '<i>Maosh tarixi yo\'q</i>';
  } else {
    let totalPaid = 0;
    let totalOwed = 0;

    for (const s of salaries) {
      const month = new Date(s.month);
      const statusIcon = s.status === 'PAID' ? '✅' : '⏳';
      text += `${statusIcon} <b>${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}</b>\n`;
      text += `   Hisoblangan: ${formatMoney(Number(s.calculatedSalary))}\n`;
      text += `   To'langan: ${formatMoney(Number(s.paidSalary))}\n\n`;

      totalPaid += Number(s.paidSalary);
      totalOwed += Number(s.calculatedSalary) - Number(s.paidSalary);
    }

    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💵 Jami to'langan: <b>${formatMoney(totalPaid)}</b>\n`;
    if (totalOwed > 0) {
      text += `🔴 Jami qoldiq: <b>${formatMoney(totalOwed)}</b>\n`;
    }
  }

  const kb = new InlineKeyboard();
  kb.text('⬅️ Hozirgi oy', 'teacher_salary').row();
  kb.text('⬅️ Asosiy menyu', 'main_menu');

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
}

// ══════════════════════════════════════════════════════
//  COIN BERISH
// ══════════════════════════════════════════════════════

// ── 1. Guruh tanlash ──────────────────────────────────
export async function handleTeacherGiveCoin(ctx: BotContext) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  const groups = await getTeacherGroupsWithStudents(teacher.id);

  if (groups.length === 0) {
    await ctx.editMessageText(
      brandHeader('🪙', 'COIN BERISH') + '❌ Sizda faol guruhlar yo\'q.',
      { parse_mode: 'HTML', reply_markup: backToMenu() }
    );
    return;
  }

  let text = brandHeader('🪙', 'COIN BERISH');
  text += 'Qaysi guruh o\'quvchisiga coin bermoqchisiz?\n\n';
  for (const g of groups) {
    text += `📚 <b>${escapeHtml(g.name)}</b> — ${g.groupStudents.length} o\'quvchi\n`;
  }

  const groupList = groups.map(g => ({ id: g.id, name: g.name }));
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: coinGroupSelect(groupList) });
}

// ── 2. O'quvchi tanlash ───────────────────────────────
export async function handleTeacherCoinGroupSelect(ctx: BotContext, groupId: number) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  ctx.session.coinGroupId = groupId;

  const groups = await getTeacherGroupsWithStudents(teacher.id);
  const group = groups.find(g => g.id === groupId);

  if (!group) {
    await ctx.editMessageText('❌ Guruh topilmadi.', { reply_markup: backToMenu() });
    return;
  }

  if (group.groupStudents.length === 0) {
    await ctx.editMessageText(
      '❌ Bu guruhda faol o\'quvchilar yo\'q.',
      { reply_markup: backToMenu() }
    );
    return;
  }

  let text = brandHeader('🪙', 'COIN BERISH');
  text += `📚 Guruh: <b>${escapeHtml(group.name)}</b>\n\n`;
  text += 'Kimga coin bermoqchisiz?';

  const studentList = group.groupStudents.map(gs => ({
    id: gs.student.id,
    name: gs.student.user.fullName,
    coins: gs.student.coinBalance || 0,
  }));

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: coinStudentSelect(studentList) });
}

// ── 3. Miqdor kiritish ────────────────────────────────
export async function handleTeacherCoinStudentSelect(ctx: BotContext, studentId: number) {
  const teacher = await getTeacher(ctx);
  if (!teacher) return;

  ctx.session.coinStudentId = studentId;
  ctx.session.step = 'waiting_coin_amount';

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { fullName: true } } },
  });

  let text = brandHeader('🪙', 'COIN MIQDORI');
  text += `O\'quvchi: <b>${escapeHtml(student?.user.fullName || '')}</b>\n`;
  text += `Hozirgi balansi: <b>${student?.coinBalance || 0} 🪙</b>\n\n`;
  text += '📝 Nechta coin bermoqchisiz? (Raqam kiriting)\n';
  text += '<i>Misol: 5 yoki 10</i>';

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: backToMenu() });
}

// ── 4. Coin berish (matn xabar orqali) ───────────────
export async function handleTeacherCoinAmount(ctx: BotContext) {
  try {
    if (ctx.session.step !== 'waiting_coin_amount') return;

    const text = ctx.message?.text?.trim();
    if (!text) return;

    const amount = parseInt(text);
    if (isNaN(amount) || amount <= 0 || amount > 100) {
      await ctx.reply(
        '❌ Noto\'g\'ri miqdor!\n1 dan 100 gacha raqam kiriting.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    const studentId = ctx.session.coinStudentId;
    if (!studentId) {
      await ctx.reply('❌ O\'quvchi tanlanmagan. Qaytadan boshlang: /start');
      ctx.session.step = 'idle';
      return;
    }

    const chatId = String(ctx.chat?.id);
    const user = await getUserByChatId(chatId);
    if (!user) return;

    const result = await giveCoinToStudent(user.id, studentId, amount, `O'qituvchi tomonidan berildi`);

    ctx.session.step = 'idle';
    ctx.session.coinStudentId = undefined;
    ctx.session.coinGroupId = undefined;

    let msg = brandHeader('✅', 'COIN BERILDI!');
    msg += `🎓 O\'quvchi: <b>${escapeHtml(result?.user.fullName || '')}</b>\n`;
    msg += `🪙 Berildi: <b>+${amount} coin</b>\n`;
    msg += `💰 Yangi balans: <b>${result?.coinBalance || 0} 🪙</b>`;

    await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: teacherMainMenu() });
  } catch (err) {
    console.error('❌ handleTeacherCoinAmount xatosi:', err);
    await ctx.reply('❌ Xatolik yuz berdi. /start — qaytadan boshlang.').catch(() => {});
    ctx.session.step = 'idle';
  }
}
