/**
 * 🔄 Akkaunt boshqaruvi — Chiqish, almashtirish, tezkor kirish, parol o'zgartirish
 */
import { BotContext, LinkedAccount } from '../bot';
import { getUserByChatId, unlinkTelegramAccount, getUserByPhone, linkTelegramAccount, changePasswordViaTelegram } from '../services/data.service';
import { backToMenu, logoutConfirm, savedAccountsList, studentMainMenu, parentMainMenu, adminMenu, teacherMainMenu } from '../utils/keyboards';
import { escapeHtml, brandHeader, brandFooter } from '../utils/format';
import { hashPassword } from '../../utils/password.utils';

// ── Chiqish so'rovi (tasdiqlash) ─────────────────
export async function handleLogout(ctx: BotContext) {
  try {
    const chatId = String(ctx.chat?.id);
    const user = await getUserByChatId(chatId);

    if (!user) {
      await ctx.editMessageText('❌ Siz tizimga kirilmagansiz.', { reply_markup: backToMenu() });
      return;
    }

    let text = brandHeader('🚪', 'CHIQISH');
    text += `⚠️ <b>${escapeHtml(user.fullName)}</b>, rostdan ham\n`;
    text += `akkauntdan chiqmoqchimisiz?\n\n`;
    text += `<i>Chiqsangiz, qayta telefon raqam bilan kirishingiz kerak bo'ladi.</i>`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: logoutConfirm(),
    });
  } catch (err) {
    console.error('❌ handleLogout xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}

// ── Chiqishni tasdiqlash ─────────────────────────
export async function handleLogoutConfirm(ctx: BotContext) {
  try {
    const chatId = String(ctx.chat?.id);
    const user = await getUserByChatId(chatId);

    if (!user) {
      await ctx.editMessageText('❌ Siz tizimga kirilmagansiz.');
      return;
    }

    // Profilni eslab qolish (session'da saqlash)
    if (!ctx.session.linkedAccounts) {
      ctx.session.linkedAccounts = [];
    }

    // Agar bu profil allaqachon saqlanmagan bo'lsa
    const exists = ctx.session.linkedAccounts.find(a => a.phone === user.phone);
    if (!exists) {
      ctx.session.linkedAccounts.push({
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        linkedAt: new Date().toISOString(),
      });
    }

    // DB dan telegram ma'lumotlarini tozalash
    await unlinkTelegramAccount(chatId);

    // Session ni tozalash
    ctx.session.step = 'idle';
    ctx.session.phone = undefined;
    ctx.session.selectedChildId = undefined;

    let text = brandHeader('👋', 'XAYR!');
    text += `✅ <b>${escapeHtml(user.fullName)}</b>, akkauntdan chiqdingiz.\n\n`;
    text += `Qayta kirish uchun /start bosing.\n`;
    text += `Yoki eslab qolingan profillardan tanlang:`;
    text += brandFooter();

    // Saqlangan profillar ro'yxati
    const accounts = ctx.session.linkedAccounts || [];
    if (accounts.length > 0) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: savedAccountsList(accounts),
      });
    } else {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: backToMenu() });
    }
  } catch (err) {
    console.error('❌ handleLogoutConfirm xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}

// ── Akkaunt almashtirish (profil tanlash) ────────
export async function handleSwitchAccount(ctx: BotContext) {
  try {
    const chatId = String(ctx.chat?.id);
    const currentUser = await getUserByChatId(chatId);
    const accounts = ctx.session.linkedAccounts || [];

    let text = brandHeader('🔄', 'AKKAUNT ALMASHTIRISH');

    if (currentUser) {
      text += `📌 Hozirgi profil: <b>${escapeHtml(currentUser.fullName)}</b>\n`;
      text += `   (${currentUser.role === 'STUDENT' ? '🎓 O\'quvchi' : currentUser.role === 'PARENT' ? '👨‍👩‍👧 Ota-ona' : currentUser.role})\n\n`;
    }

    if (accounts.length > 0) {
      text += `📋 Eslab qolingan profillar:\n`;
      text += `Quyidagilardan birini tanlang yoki yangi raqam kiriting:`;
    } else {
      text += `📝 Eslab qolingan profillar yo'q.\n`;
      text += `Yangi raqam bilan kirishingiz mumkin:`;
    }
    text += brandFooter();

    // Hozirgi userni saqlash (agar eslab qolinmagan bo'lsa)
    if (currentUser) {
      if (!ctx.session.linkedAccounts) ctx.session.linkedAccounts = [];
      const exists = ctx.session.linkedAccounts.find(a => a.phone === currentUser.phone);
      if (!exists) {
        ctx.session.linkedAccounts.push({
          phone: currentUser.phone,
          fullName: currentUser.fullName,
          role: currentUser.role,
          linkedAt: new Date().toISOString(),
        });
      }
    }

    const allAccounts = ctx.session.linkedAccounts || [];
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: savedAccountsList(allAccounts),
    });
  } catch (err) {
    console.error('❌ handleSwitchAccount xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}

// ── Tezkor login (saqlangan profil bilan — OTP siz) ────────
export async function handleQuickLogin(ctx: BotContext, phone: string) {
  try {
    const chatId = String(ctx.chat?.id);

    // Telefon raqamni DB dan tekshirish
    const user = await getUserByPhone(phone);
    if (!user) {
      if (ctx.session.linkedAccounts) {
        ctx.session.linkedAccounts = ctx.session.linkedAccounts.filter(a => a.phone !== phone);
      }
      await ctx.editMessageText(
        '❌ Bu profil tizimda topilmadi. Ehtimol o\'chirilgan.\n\n/start — qaytadan kirish',
        { parse_mode: 'HTML', reply_markup: backToMenu() }
      );
      return;
    }

    if (!user.isActive) {
      await ctx.editMessageText('❌ Bu hisob faol emas. Admin bilan bog\'laning.', { reply_markup: backToMenu() });
      return;
    }

    // ✅ OTP siz — to'g'ridan-to'g'ri ulash
    const username = ctx.from?.username;
    await linkTelegramAccount(user.phone, chatId, username);

    ctx.session.step = 'idle';

    let menuText = brandHeader('✅', 'MUVAFFAQIYATLI!');
    menuText += `🎉 <b>${escapeHtml(user.fullName)}</b>, xush kelibsiz!`;
    let keyboard;

    if (user.role === 'STUDENT') {
      keyboard = studentMainMenu();
    } else if (user.role === 'PARENT') {
      keyboard = parentMainMenu();
    } else if (user.role === 'TEACHER') {
      keyboard = teacherMainMenu();
    } else if (user.role === 'ADMIN') {
      keyboard = adminMenu();
    } else {
      keyboard = studentMainMenu();
    }

    await ctx.editMessageText(menuText, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    console.error('❌ handleQuickLogin xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}

// ── Parolni o'zgartirish (boshlash) ──────────────
export async function handleChangePassword(ctx: BotContext) {
  try {
    const chatId = String(ctx.chat?.id);
    const user = await getUserByChatId(chatId);

    if (!user) {
      await ctx.editMessageText('❌ Siz tizimga kirilmagansiz.', { reply_markup: backToMenu() });
      return;
    }

    ctx.session.step = 'waiting_new_password';

    let text = brandHeader('🔑', 'PAROLNI O\'ZGARTIRISH');
    text += `<b>${escapeHtml(user.fullName)}</b>, platformaga kirish uchun\n`;
    text += `yangi parolingizni yozing:\n\n`;
    text += `<i>• Kamida 6 ta belgi\n`;
    text += `• Faqat lotin harflari va raqamlar\n`;
    text += `• Misol: MyPass123</i>`;
    text += brandFooter();

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: backToMenu() });
  } catch (err) {
    console.error('❌ handleChangePassword xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}

// ── Yangi parolni qabul qilish (message:text stepdan chaqiriladi) ──
export async function handleNewPassword(ctx: BotContext) {
  try {
    const chatId = String(ctx.chat?.id);
    const text = ctx.message?.text?.trim();

    if (!text || text.length < 6) {
      await ctx.reply(
        '❌ Parol kamida 6 ta belgidan iborat bo\'lishi kerak.\n\nQayta kiriting:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    if (text.length > 64) {
      await ctx.reply('❌ Parol 64 ta belgidan oshmasin.\n\nQayta kiriting:');
      return;
    }

    const passwordHash = await hashPassword(text);
    await changePasswordViaTelegram(chatId, passwordHash);

    ctx.session.step = 'idle';

    const user = await getUserByChatId(chatId);
    const role = user?.role || 'STUDENT';
    let keyboard;
    if (role === 'TEACHER') keyboard = teacherMainMenu();
    else if (role === 'PARENT') keyboard = parentMainMenu();
    else if (role === 'ADMIN') keyboard = adminMenu();
    else keyboard = studentMainMenu();

    let msg = brandHeader('✅', 'PAROL O\'ZGARTIRILDI');
    msg += `🎉 Yangi parolingiz muvaffaqiyatli saqlandi!\n\n`;
    msg += `Endi platforma (roboticedu.uz) ga kirish uchun\n`;
    msg += `telefon raqamingiz va yangi parolingizdan foydalaning.`;

    await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    console.error('❌ handleNewPassword xatosi:', err);
    await ctx.reply('❌ Xatolik yuz berdi. Qayta urinib ko\'ring.').catch(() => {});
    ctx.session.step = 'idle';
  }
}

// ── Yangi raqam bilan kirish ────────────────────
export async function handleNewLogin(ctx: BotContext) {
  try {
    const chatId = String(ctx.chat?.id);

    // Avval eski akkauntdan chiqish
    const currentUser = await getUserByChatId(chatId);
    if (currentUser) {
      // Profilni eslab qolish
      if (!ctx.session.linkedAccounts) ctx.session.linkedAccounts = [];
      const exists = ctx.session.linkedAccounts.find(a => a.phone === currentUser.phone);
      if (!exists) {
        ctx.session.linkedAccounts.push({
          phone: currentUser.phone,
          fullName: currentUser.fullName,
          role: currentUser.role,
          linkedAt: new Date().toISOString(),
        });
      }
      await unlinkTelegramAccount(chatId);
    }

    ctx.session.step = 'waiting_phone';
    ctx.session.phone = undefined;
    ctx.session.selectedChildId = undefined;

    let text = brandHeader('📱', 'YANGI PROFIL');
    text += `Yangi telefon raqamingizni yuboring:\n\n`;
    text += `<i>Misol: +998XXXXXXXXX</i>`;
    text += brandFooter();

    await ctx.editMessageText(text, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('❌ handleNewLogin xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.').catch(() => {});
  }
}
