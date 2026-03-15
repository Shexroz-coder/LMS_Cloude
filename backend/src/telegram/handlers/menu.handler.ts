/**
 * Asosiy menyu va callback routing
 * O'quvchi, ota-ona va admin uchun
 */
import { BotContext } from '../bot';
import { getUserByChatId, getParentChildren, getBotStats, getUnreadNotificationCount } from '../services/data.service';
import { studentMainMenu, parentMainMenu, adminMenu, teacherMainMenu, childrenList, parentChildMenu, backToMenu } from '../utils/keyboards';
import { escapeHtml, formatMoney, brandHeader, brandFooter } from '../utils/format';
import { handleScheduleToday, handleScheduleWeek } from './schedule';
import { handleAttendance } from './attendance';
import { handleGrades } from './grades';
import { handlePayments, handlePaymentsArchive } from './payments';
import { handleCoins } from './coins';
import { handleProfile } from './profile';
import { handleLeaderboard } from './leaderboard';
import { handleNotifications } from './notifications';
import { handleLogout, handleLogoutConfirm, handleSwitchAccount, handleQuickLogin, handleNewLogin } from './account.handler';
import { handleParentRegister } from './start.handler';
import { handleTeacherTodayLessons, handleTeacherWeekSchedule, handleTeacherGroups, handleTeacherAttendance, handleTeacherSalary, handleTeacherSalaryArchive, handleAttGroupSelect, handleAttDay, handleAttLateDay, handleAttMark, handleAttAllPresent, handleAttComplete } from './teacher.handler';
import { handleAdminDashboard, handleAdminStudents, handleAdminTeachers, handleAdminGroups, handleAdminCourses, handleAdminPayments, handleAdminExpenses, handleAdminSalaries, handleAdminReports } from './admin.handler';

// ── Asosiy menyu ko'rsatish ───────────────────────
export async function handleMainMenu(ctx: BotContext) {
  const chatId = String(ctx.chat?.id);
  const user = await getUserByChatId(chatId);

  if (!user) {
    await ctx.editMessageText(
      '❌ Siz ro\'yxatdan o\'tmagansiz.\n/start — boshlash',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const name = escapeHtml(user.fullName);
  const role = user.role;

  // Bildirishnomalar sonini olish
  const unread = await getUnreadNotificationCount(user.id);
  const notifBadge = unread > 0 ? `\n🔔 <b>${unread} ta</b> yangi bildirishnoma` : '';

  let menuText: string;
  let keyboard;

  if (role === 'STUDENT') {
    menuText = brandHeader('🎓', 'O\'QUVCHI KABINETI');
    menuText += `👋 Salom, <b>${name}</b>!${notifBadge}\n\n`;
    menuText += `Quyidagi menyudan foydalaning:`;
    keyboard = studentMainMenu();
  } else if (role === 'PARENT') {
    menuText = brandHeader('👨‍👩‍👧', 'OTA-ONA KABINETI');
    menuText += `👋 Salom, <b>${name}</b>!${notifBadge}\n\n`;
    menuText += `Quyidagi menyudan foydalaning:`;
    keyboard = parentMainMenu();
  } else if (role === 'TEACHER') {
    menuText = brandHeader('👨‍🏫', 'O\'QITUVCHI KABINETI');
    menuText += `👋 Salom, <b>${name}</b>!${notifBadge}\n\n`;
    menuText += `Quyidagi menyudan foydalaning:`;
    keyboard = teacherMainMenu();
  } else if (role === 'ADMIN') {
    menuText = brandHeader('👑', 'ADMIN PANEL');
    menuText += `Salom, <b>${name}</b>!${notifBadge}`;
    keyboard = adminMenu();
  } else {
    menuText = `👋 Salom, <b>${name}</b>!\nRol: ${role}`;
    keyboard = studentMainMenu();
  }

  await ctx.editMessageText(menuText, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

// ── Ota-ona: bolalar ro'yxati ─────────────────────
export async function handleParentChildren(ctx: BotContext) {
  const chatId = String(ctx.chat?.id);
  const user = await getUserByChatId(chatId);

  if (!user) {
    await ctx.editMessageText('❌ Foydalanuvchi topilmadi.', { reply_markup: backToMenu() });
    return;
  }

  const children = await getParentChildren(user.id);

  if (children.length === 0) {
    await ctx.editMessageText(
      brandHeader('👶', 'BOLALARIM') +
      '❌ Farzandlar topilmadi.\nAdmin bilan bog\'laning.',
      { parse_mode: 'HTML', reply_markup: backToMenu() }
    );
    return;
  }

  let text = brandHeader('👶', 'BOLALARIM');

  for (const child of children) {
    const debt = Number(child.balance?.debt || 0);
    const groupNames = child.groupStudents.map((g: any) => g.group.course.name).join(', ');

    text += `👦 <b>${escapeHtml(child.user.fullName)}</b>\n`;
    text += `   📚 ${groupNames || 'Guruh yo\'q'}\n`;
    if (debt > 0) text += `   🔴 Qarz: ${formatMoney(debt)}\n`;
    text += '\n';
  }
  text += '👇 Bola tanlang:';

  const childList = children.map(c => ({
    id: c.id,
    name: c.user.fullName,
  }));

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: childrenList(childList),
  });
}

// ── Ota-ona: bolani tanlash ───────────────────────
export async function handleSelectChild(ctx: BotContext, childId: number) {
  ctx.session.selectedChildId = childId;

  const chatId = String(ctx.chat?.id);
  const user = await getUserByChatId(chatId);
  if (!user) return;

  const children = await getParentChildren(user.id);
  const child = children.find(c => c.id === childId);

  if (!child) {
    await ctx.editMessageText('❌ Farzand topilmadi.', { reply_markup: backToMenu() });
    return;
  }

  const groupNames = child.groupStudents.map((g: any) => g.group.course.name).join(', ');
  const debt = Number(child.balance?.debt || 0);

  let text = brandHeader('👦', escapeHtml(child.user.fullName));
  text += `📚 Kurslar: ${groupNames || 'yo\'q'}\n`;
  if (debt > 0) text += `🔴 Qarz: ${formatMoney(debt)}\n`;
  text += `\n👇 Nimani ko'rmoqchisiz?`;

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: parentChildMenu(childId),
  });
}

// ── Admin: bot statistikasi ───────────────────────
export async function handleAdminStats(ctx: BotContext) {
  const stats = await getBotStats();

  const linkedPercent = stats.totalStudents > 0
    ? Math.round((stats.students / stats.totalStudents) * 100)
    : 0;
  const parentPercent = stats.totalParents > 0
    ? Math.round((stats.parents / stats.totalParents) * 100)
    : 0;

  let text = brandHeader('📊', 'BOT STATISTIKASI');
  text += `👥 Jami ulangan: <b>${stats.totalLinked}</b>\n\n`;
  text += `🎓 O'quvchilar: <b>${stats.students}</b> / ${stats.totalStudents}\n`;
  text += `   (${linkedPercent}% botga ulangan)\n\n`;
  text += `👨‍👩‍👧 Ota-onalar: <b>${stats.parents}</b> / ${stats.totalParents}\n`;
  text += `   (${parentPercent}% botga ulangan)\n`;

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: adminMenu(),
  });
}

// ── Admin: broadcast (placeholder) ─────────────────
export async function handleAdminBroadcast(ctx: BotContext) {
  await ctx.editMessageText(
    brandHeader('📢', 'BROADCAST XABAR') +
    'Xabar yuboring va men uni barcha foydalanuvchilarga yuboraman.\n\n' +
    '<i>Xabaringizni yozing:</i>',
    { parse_mode: 'HTML', reply_markup: backToMenu() }
  );
}

// ══════════════════════════════════════════════════════
//  CALLBACK QUERY ROUTER
// ══════════════════════════════════════════════════════
export async function routeCallback(ctx: BotContext) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  await ctx.answerCallbackQuery();

  try {
    // ── Asosiy menyu ──
    if (data === 'main_menu') { await handleMainMenu(ctx); return; }

    // ── O'quvchi: Jadval ──
    if (data === 'schedule_today') { await handleScheduleToday(ctx); return; }
    if (data === 'schedule_week') { await handleScheduleWeek(ctx); return; }

    // ── O'quvchi: Ma'lumotlar ──
    if (data === 'attendance') { await handleAttendance(ctx); return; }
    if (data === 'grades') { await handleGrades(ctx); return; }
    if (data === 'payments') { await handlePayments(ctx); return; }
    if (data === 'coins') { await handleCoins(ctx); return; }
    if (data === 'leaderboard') { await handleLeaderboard(ctx); return; }
    if (data === 'notifications') { await handleNotifications(ctx); return; }
    if (data === 'profile') { await handleProfile(ctx); return; }

    // ── Ota-ona registratsiya (yangi foydalanuvchi) ──
    if (data === 'parent_register') { await handleParentRegister(ctx); return; }

    // ── Ota-ona ──
    if (data === 'parent_children') { await handleParentChildren(ctx); return; }

    if (data.startsWith('select_child_')) {
      const childId = parseInt(data.replace('select_child_', ''));
      await handleSelectChild(ctx, childId);
      return;
    }

    // ── Ota-ona: bola ma'lumotlari ──
    if (data.startsWith('child_schedule_today_')) {
      const childId = parseInt(data.replace('child_schedule_today_', ''));
      await handleScheduleToday(ctx, childId, childId);
      return;
    }
    if (data.startsWith('child_schedule_week_')) {
      const childId = parseInt(data.replace('child_schedule_week_', ''));
      await handleScheduleWeek(ctx, childId, childId);
      return;
    }
    if (data.startsWith('child_attendance_')) {
      const childId = parseInt(data.replace('child_attendance_', ''));
      await handleAttendance(ctx, childId);
      return;
    }
    if (data.startsWith('child_grades_')) {
      const childId = parseInt(data.replace('child_grades_', ''));
      await handleGrades(ctx, childId);
      return;
    }
    if (data.startsWith('child_payments_')) {
      const childId = parseInt(data.replace('child_payments_', ''));
      await handlePayments(ctx, childId);
      return;
    }
    if (data.startsWith('child_coins_')) {
      const childId = parseInt(data.replace('child_coins_', ''));
      await handleCoins(ctx, childId);
      return;
    }
    if (data.startsWith('child_leaderboard_')) {
      const childId = parseInt(data.replace('child_leaderboard_', ''));
      await handleLeaderboard(ctx, childId);
      return;
    }
    if (data.startsWith('child_profile_')) {
      const childId = parseInt(data.replace('child_profile_', ''));
      await handleProfile(ctx, childId);
      return;
    }

    // ── Akkaunt boshqaruvi ──
    if (data === 'logout') { await handleLogout(ctx); return; }
    if (data === 'logout_confirm') { await handleLogoutConfirm(ctx); return; }
    if (data === 'switch_account') { await handleSwitchAccount(ctx); return; }
    if (data === 'new_login') { await handleNewLogin(ctx); return; }
    if (data.startsWith('quick_login_')) {
      const phone = data.replace('quick_login_', '');
      await handleQuickLogin(ctx, phone);
      return;
    }

    // ── Teacher ──
    if (data === 'teacher_today_lessons') { await handleTeacherTodayLessons(ctx); return; }
    if (data === 'teacher_week_schedule') { await handleTeacherWeekSchedule(ctx); return; }
    if (data === 'teacher_groups') { await handleTeacherGroups(ctx); return; }
    if (data === 'teacher_attendance') { await handleTeacherAttendance(ctx); return; }
    if (data === 'teacher_salary') { await handleTeacherSalary(ctx); return; }

    // ── Teacher: Davomat belgilash ──
    if (data.startsWith('att_group_')) {
      const groupId = parseInt(data.replace('att_group_', ''));
      await handleAttGroupSelect(ctx, groupId);
      return;
    }
    if (data.startsWith('att_mark_')) {
      const parts = data.replace('att_mark_', '').split('_');
      const lessonId = parseInt(parts[0]);
      const studentId = parseInt(parts[1]);
      const status = parts[2];
      await handleAttMark(ctx, lessonId, studentId, status);
      return;
    }
    if (data.startsWith('att_all_present_')) {
      const parts = data.replace('att_all_present_', '').split('_');
      const lessonId = parseInt(parts[0]);
      const groupId = parseInt(parts[1]);
      await handleAttAllPresent(ctx, lessonId, groupId);
      return;
    }
    if (data.startsWith('att_complete_')) {
      const parts = data.replace('att_complete_', '').split('_');
      const lessonId = parseInt(parts[0]);
      const groupId = parseInt(parts[1]);
      await handleAttComplete(ctx, lessonId, groupId);
      return;
    }
    if (data.startsWith('att_day_')) {
      const parts = data.replace('att_day_', '').split('_');
      const groupId = parseInt(parts[0]);
      const dateStr = parts.slice(1).join('-'); // 2026-03-15
      await handleAttDay(ctx, groupId, dateStr);
      return;
    }
    if (data.startsWith('att_late_day_')) {
      const parts = data.replace('att_late_day_', '').split('_');
      const groupId = parseInt(parts[0]);
      const dateStr = parts.slice(1).join('-');
      await handleAttLateDay(ctx, groupId, dateStr);
      return;
    }
    if (data === 'att_noop') { return; }

    // ── To'lovlar arxiv ──
    if (data.startsWith('payments_archive_')) {
      const studentId = parseInt(data.replace('payments_archive_', ''));
      await handlePaymentsArchive(ctx, studentId);
      return;
    }
    if (data.startsWith('payments_current_')) {
      const studentId = parseInt(data.replace('payments_current_', ''));
      await handlePayments(ctx, studentId);
      return;
    }

    // ── Teacher maosh arxiv ──
    if (data.startsWith('salary_archive_')) {
      const teacherId = parseInt(data.replace('salary_archive_', ''));
      await handleTeacherSalaryArchive(ctx, teacherId);
      return;
    }

    // ── Admin ──
    if (data === 'admin_dashboard') { await handleAdminDashboard(ctx); return; }
    if (data === 'admin_students') { await handleAdminStudents(ctx); return; }
    if (data === 'admin_teachers') { await handleAdminTeachers(ctx); return; }
    if (data === 'admin_groups') { await handleAdminGroups(ctx); return; }
    if (data === 'admin_courses') { await handleAdminCourses(ctx); return; }
    if (data === 'admin_payments') { await handleAdminPayments(ctx); return; }
    if (data === 'admin_expenses') { await handleAdminExpenses(ctx); return; }
    if (data === 'admin_salaries') { await handleAdminSalaries(ctx); return; }
    if (data === 'admin_reports') { await handleAdminReports(ctx); return; }
    if (data === 'admin_stats') { await handleAdminStats(ctx); return; }
    if (data === 'admin_broadcast') { await handleAdminBroadcast(ctx); return; }

  } catch (err) {
    console.error('Telegram callback error:', err);
    try {
      await ctx.editMessageText('❌ Xatolik yuz berdi. /start — qaytadan urinib ko\'ring.');
    } catch { /* ignore edit errors */ }
  }
}
