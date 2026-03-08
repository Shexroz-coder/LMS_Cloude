/**
 * 🔄 Akkaunt boshqaruvi — Chiqish, almashtirish, tezkor kirish
 */
import { BotContext, LinkedAccount } from '../bot';
import { getUserByChatId, unlinkTelegramAccount, getUserByPhone, linkTelegramAccount } from '../services/data.service';
import { backToMenu, logoutConfirm, savedAccountsList, studentMainMenu, parentMainMenu, adminMenu } from '../utils/keyboards';
import { escapeHtml, brandHeader, brandFooter } from '../utils/format';

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
    text += `<i>Chiqsangiz, qayta telefon va OTP bilan kirishingiz kerak bo'ladi.</i>`;

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

// ── Tezkor login (saqlangan profil bilan) ────────
export async function handleQuickLogin(ctx: BotContext, phone: string) {
  try {
    const chatId = String(ctx.chat?.id);

    // Telefon raqamni DB dan tekshirish
    const user = await getUserByPhone(phone);
    if (!user) {
      // Profil DB dan o'chirilgan
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

    // Xavfsizlik: OTP talab qilish
    // Tezkor login faqat session davomida ishlaydi (session saqlanib qolsa)
    // Agar boshqa qurilmadan kirgan bo'lsa, eski session yo'q
    const { createOtpSession } = await import('../services/data.service');

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await createOtpSession(chatId, user.phone, otp);

    ctx.session.step = 'waiting_otp';
    ctx.session.phone = user.phone;

    let text = brandHeader('🔐', 'XAVFSIZLIK TASDIQLASH');
    text += `📱 <b>${escapeHtml(user.fullName)}</b> profiliga kirish\n\n`;
    text += `Tasdiqlash kodi:\n\n`;
    text += `<code>${otp}</code>\n\n`;
    text += `☝️ Kodni bosing va menga yuboring.`;

    await ctx.editMessageText(text, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('❌ handleQuickLogin xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
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
    text += `<i>Misol: +998901234567</i>`;
    text += brandFooter();

    await ctx.editMessageText(text, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('❌ handleNewLogin xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.').catch(() => {});
  }
}
