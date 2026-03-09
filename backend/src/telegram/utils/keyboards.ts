import { InlineKeyboard } from 'grammy';

// ══════════════════════════════════════════════════════
//  O'QUVCHI ASOSIY MENYUSI
// ══════════════════════════════════════════════════════
export function studentMainMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📅 Bugungi darslar', 'schedule_today').text('🗓 Haftalik jadval', 'schedule_week').row()
    .text('✅ Davomat', 'attendance').text('📊 Baholar', 'grades').row()
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
    .text('✅ Davomat', `child_attendance_${childId}`)
    .text('📊 Baholar', `child_grades_${childId}`).row()
    .text('💰 To\'lovlar', `child_payments_${childId}`)
    .text('🪙 Tangalar', `child_coins_${childId}`).row()
    .text('🏆 Reyting', `child_leaderboard_${childId}`)
    .text('👤 Profil', `child_profile_${childId}`).row()
    .text('⬅️ Orqaga', 'parent_children').row();
}

// ══════════════════════════════════════════════════════
//  ADMIN MENYUSI
// ══════════════════════════════════════════════════════
export function adminMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📢 Broadcast xabar', 'admin_broadcast').row()
    .text('📊 Bot statistika', 'admin_stats').row();
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
