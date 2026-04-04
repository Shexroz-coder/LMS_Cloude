import { InlineKeyboard } from 'grammy';

// ══════════════════════════════════════════════════════
//  O'QUVCHI ASOSIY MENYUSI
// ══════════════════════════════════════════════════════
export function studentMainMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📅 Bugungi darslar', 'schedule_today').text('🗓 Haftalik jadval', 'schedule_week').row()
    .text('✅ Davomat', 'attendance').row()
    .text('💰 To\'lovlar', 'payments').text('🪙 Tangalar', 'coins').row()
    .text('🏆 Reyting', 'leaderboard').text('🔔 Bildirishnomalar', 'notifications').row()
    .text('👤 Profil', 'profile').row()
    .text('🔄 Akkaunt almashtirish', 'switch_account').text('🚪 Chiqish', 'logout').row();
}

// ══════════════════════════════════════════════════════
//  OTA-ONA ASOSIY MENYUSI
// ══════════════════════════════════════════════════════
export function parentMainMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('👶 Bolalarim', 'parent_children').row()
    .text('🔔 Bildirishnomalar', 'notifications').text('👤 Profil', 'profile').row()
    .text('🔄 Akkaunt almashtirish', 'switch_account').text('🚪 Chiqish', 'logout').row();
}

// ══════════════════════════════════════════════════════
//  OTA-ONA — BOLA TANLANGANDAN KEYIN
// ══════════════════════════════════════════════════════
export function parentChildMenu(childId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('📅 Bugungi darslar', `child_schedule_today_${childId}`)
    .text('🗓 Haftalik jadval', `child_schedule_week_${childId}`).row()
    .text('✅ Davomat', `child_attendance_${childId}`).row()
    .text('💰 To\'lovlar', `child_payments_${childId}`)
    .text('🪙 Tangalar', `child_coins_${childId}`).row()
    .text('🏆 Reyting', `child_leaderboard_${childId}`)
    .text('👤 Profil', `child_profile_${childId}`).row()
    .text('⬅️ Orqaga', 'parent_children').row();
}

// ══════════════════════════════════════════════════════
//  O'QITUVCHI ASOSIY MENYUSI
// ══════════════════════════════════════════════════════
export function teacherMainMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📅 Bugungi darslar', 'teacher_today_lessons').text('🗓 Haftalik jadval', 'teacher_week_schedule').row()
    .text('👥 Guruhlarim', 'teacher_groups').row()
    .text('✅ Davomat belgilash', 'teacher_attendance').row()
    .text('🪙 Coin berish', 'teacher_give_coin').row()
    .text('💰 Maoshim', 'teacher_salary').text('👤 Profil', 'profile').row()
    .text('🔔 Bildirishnomalar', 'notifications').row()
    .text('🔄 Akkaunt almashtirish', 'switch_account').text('🚪 Chiqish', 'logout').row();
}

// ══════════════════════════════════════════════════════
//  COIN BERISH — GURUH TANLASH
// ══════════════════════════════════════════════════════
export function coinGroupSelect(groups: { id: number; name: string }[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const g of groups) {
    kb.text(`📚 ${g.name}`, `teacher_coin_group_${g.id}`).row();
  }
  kb.text('⬅️ Asosiy menyu', 'main_menu');
  return kb;
}

// ══════════════════════════════════════════════════════
//  COIN BERISH — O'QUVCHI TANLASH
// ══════════════════════════════════════════════════════
export function coinStudentSelect(students: { id: number; name: string; coins: number }[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const s of students) {
    kb.text(`🎓 ${s.name} (${s.coins}🪙)`, `teacher_coin_student_${s.id}`).row();
  }
  kb.text('⬅️ Guruhga qaytish', 'teacher_give_coin').text('🏠 Menyu', 'main_menu');
  return kb;
}

// ══════════════════════════════════════════════════════
//  ADMIN MENYUSI (to'liq)
// ══════════════════════════════════════════════════════
export function adminMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📊 Dashboard', 'admin_dashboard').row()
    .text('👥 O\'quvchilar', 'admin_students').text('👨‍🏫 O\'qituvchilar', 'admin_teachers').row()
    .text('📚 Guruhlar', 'admin_groups').text('📖 Kurslar', 'admin_courses').row()
    .text('💰 To\'lovlar', 'admin_payments').text('💸 Xarajatlar', 'admin_expenses').row()
    .text('💼 Maoshlar', 'admin_salaries').text('🔴 Qarzdorlar', 'admin_debtors').row()
    .text('📈 Oylik hisobotlar', 'admin_reports').row()
    .text('📋 Davomat nazorati', 'admin_att_monitor').row()
    .text('📢 Broadcast', 'admin_broadcast').text('📊 Statistika', 'admin_stats').row()
    .text('🔄 Akkaunt almashtirish', 'switch_account').text('🚪 Chiqish', 'logout').row();
}

// ══════════════════════════════════════════════════════
//  ORQAGA TUGMALARI
// ══════════════════════════════════════════════════════
export function backToMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⬅️ Asosiy menyu', 'main_menu');
}

export function backToMenuWithChild(childId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('⬅️ Bola menyusi', `select_child_${childId}`)
    .text('🏠 Asosiy menyu', 'main_menu');
}

// ══════════════════════════════════════════════════════
//  BOLALAR RO'YXATI
// ══════════════════════════════════════════════════════
export function childrenList(children: { id: number; name: string }[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const child of children) {
    kb.text(`👦 ${child.name}`, `select_child_${child.id}`).row();
  }
  kb.text('⬅️ Asosiy menyu', 'main_menu');
  return kb;
}

// ══════════════════════════════════════════════════════
//  LOGOUT TASDIQLASH
// ══════════════════════════════════════════════════════
export function logoutConfirm(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Ha, chiqish', 'logout_confirm').text('❌ Yo\'q', 'main_menu').row();
}

// ══════════════════════════════════════════════════════
//  SAQLANGAN PROFILLAR RO'YXATI
// ══════════════════════════════════════════════════════
export function savedAccountsList(accounts: { phone: string; fullName: string; role: string }[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const acc of accounts) {
    const roleEmoji = acc.role === 'STUDENT' ? '🎓' : acc.role === 'PARENT' ? '👨‍👩‍👧' : '👤';
    kb.text(`${roleEmoji} ${acc.fullName}`, `quick_login_${acc.phone}`).row();
  }
  kb.text('📱 Yangi raqam bilan kirish', 'new_login').row();
  kb.text('⬅️ Orqaga', 'main_menu');
  return kb;
}

// ══════════════════════════════════════════════════════
//  WELCOME (Yangi foydalanuvchi) — Ota-ona uchun
// ══════════════════════════════════════════════════════
export function welcomeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('👨‍👩‍👧 Men ota-onaman', 'parent_register').row();
}

// ══════════════════════════════════════════════════════
//  JADVAL TUGMALARI (bugungi / haftalik almashtirish)
// ══════════════════════════════════════════════════════
export function scheduleToggle(active: 'today' | 'week'): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (active === 'today') {
    kb.text('📅 Bugungi ✓', 'schedule_today').text('🗓 Haftalik', 'schedule_week').row();
  } else {
    kb.text('📅 Bugungi', 'schedule_today').text('🗓 Haftalik ✓', 'schedule_week').row();
  }
  kb.text('⬅️ Asosiy menyu', 'main_menu');
  return kb;
}

export function scheduleToggleChild(childId: number, active: 'today' | 'week'): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (active === 'today') {
    kb.text('📅 Bugungi ✓', `child_schedule_today_${childId}`)
      .text('🗓 Haftalik', `child_schedule_week_${childId}`).row();
  } else {
    kb.text('📅 Bugungi', `child_schedule_today_${childId}`)
      .text('🗓 Haftalik ✓', `child_schedule_week_${childId}`).row();
  }
  kb.text('⬅️ Bola menyusi', `select_child_${childId}`)
    .text('🏠 Asosiy menyu', 'main_menu');
  return kb;
}
