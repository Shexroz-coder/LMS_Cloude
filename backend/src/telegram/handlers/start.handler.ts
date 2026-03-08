/**
 * /start komandasi va registratsiya flow
 * Telefon → OTP → Telegram account link
 */
import { BotContext } from '../bot';
import { getUserByChatId, getUserByPhone, linkTelegramAccount, createOtpSession, verifyOtp } from '../services/data.service';
import { studentMainMenu, parentMainMenu, adminMenu } from '../utils/keyboards';
import { escapeHtml, brandHeader, brandFooter } from '../utils/format';

// ── OTP generatsiya ───────────────────────────────
function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Telefon raqamni normalizatsiya (+998XXXXXXXXX format) ──
// Quyidagi barcha formatlarni qabul qiladi:
//   +998935412930
//   998935412930
//   935412930
//   93 541 29 30
//   +998 93 541 29 30
//   8935412930  (8 bilan boshlansa)
function normalizePhone(phone: string): string {
  // 1. Barcha bo'shliq, tire, qavs, nuqtalarni olib tashlash
  let digits = phone.replace(/[^\d+]/g, '');

  // 2. Boshidagi + ni saqlab, faqat raqamlarni olish
  const hasPlus = digits.startsWith('+');
  digits = digits.replace(/\D/g, '');

  // 3. Turli formatlarni +998XXXXXXXXX ga keltirish
  if (digits.length === 12 && digits.startsWith('998')) {
    // 998935412930 → +998935412930
    return '+' + digits;
  }
  if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('3') || digits.startsWith('7'))) {
    // 935412930 → +998935412930
    return '+998' + digits;
  }
  if (digits.length === 10 && digits.startsWith('8')) {
    // 8935412930 → +998935412930 (8 ni olib tashlab)
    return '+998' + digits.slice(1);
  }
  if (hasPlus && digits.length === 12 && digits.startsWith('998')) {
    return '+' + digits;
  }

  // 4. Agar hech qaysi formatga to'g'ri kelmasa, +998 qo'shib ko'ramiz
  if (digits.length === 9) {
    return '+998' + digits;
  }

  // 5. Default: + qo'shib qaytarish
  return '+' + digits;
}

// ── /start komandasi ──────────────────────────────
export async function handleStart(ctx: BotContext) {
  try {
    const chatId = String(ctx.chat?.id);

    // Avval tekshirish: bu chat ID allaqachon ro'yxatdan o'tganmi?
    const existingUser = await getUserByChatId(chatId);

    if (existingUser) {
      // Avtomatik login — menyu ko'rsatish
      const name = existingUser.fullName;
      const role = existingUser.role;

      let menuText = brandHeader('🎓', 'O\'QUVCHI KABINETI');
      menuText += `👋 Salom, <b>${name}</b>!\n\nQuyidagi menyudan foydalaning:`;
      let keyboard;

      if (role === 'STUDENT') {
        keyboard = studentMainMenu();
      } else if (role === 'PARENT') {
        menuText = brandHeader('👨‍👩‍👧', 'OTA-ONA KABINETI');
        menuText += `👋 Salom, <b>${name}</b>!\n\nQuyidagi menyudan foydalaning:`;
        keyboard = parentMainMenu();
      } else if (role === 'ADMIN') {
        menuText = brandHeader('👑', 'ADMIN PANEL');
        menuText += `Salom, <b>${name}</b>!`;
        keyboard = adminMenu();
      } else {
        menuText = `👋 Salom, <b>${name}</b>!\nSizning rolingiz: ${role}`;
        keyboard = studentMainMenu();
      }

      await ctx.reply(menuText, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      return;
    }

    // Yangi foydalanuvchi — registratsiya boshlash
    ctx.session.step = 'waiting_phone';

    let welcome = brandHeader('📱', 'RO\'YXATDAN O\'TISH');
    welcome += 'Xush kelibsiz! Bot orqali o\'quv jarayoningizni\n';
    welcome += 'kuzatib borishingiz mumkin.\n\n';
    welcome += '📱 Telefon raqamingizni yuboring:\n\n';
    welcome += '<i>Misol: +998901234567</i>';
    welcome += brandFooter();

    await ctx.reply(welcome, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('❌ handleStart xatosi:', err);
    await ctx.reply('❌ Xatolik yuz berdi. Keyinroq qayta urinib ko\'ring.\n/start').catch(() => {});
  }
}

// ── Telefon raqam qabul qilish ────────────────────
export async function handlePhone(ctx: BotContext) {
  try {
    if (ctx.session.step !== 'waiting_phone') return;

    const text = ctx.message?.text?.trim();
    if (!text) return;

    const phone = normalizePhone(text);

    // Telefon formati tekshirish
    if (!/^\+998\d{9}$/.test(phone)) {
      await ctx.reply(
        '❌ Noto\'g\'ri format!\n\n📱 Telefon raqamingizni to\'g\'ri kiriting:\n<i>Misol: +998901234567</i>',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // DB dan tekshirish
    const user = await getUserByPhone(phone);

    if (!user) {
      await ctx.reply(
        '❌ Bu telefon raqam tizimda topilmadi.\n\n' +
        'Iltimos, markaz administratoriga murojaat qiling yoki boshqa raqam kiriting.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    if (!user.isActive) {
      await ctx.reply('❌ Sizning hisobingiz faol emas. Admin bilan bog\'laning.');
      return;
    }

    // Agar allaqachon boshqa chat ID ga bog'langan bo'lsa
    if (user.telegramChatId && user.telegramChatId !== String(ctx.chat?.id)) {
      await ctx.reply(
        '⚠️ Bu telefon raqam allaqachon boshqa Telegram akkauntga bog\'langan.\n' +
        'Yangilash uchun adminga murojaat qiling.'
      );
      return;
    }

    // OTP yaratish va saqlash
    // user.phone — DB dagi haqiqiy format (masalan +998935412930)
    const otp = generateOtp();
    const chatId = String(ctx.chat?.id);
    await createOtpSession(chatId, user.phone, otp);

    ctx.session.step = 'waiting_otp';
    ctx.session.phone = user.phone;

    await ctx.reply(
      `📩 <b>${user.fullName}</b>, tasdiqlash kodi:\n\n` +
      `<code>${otp}</code>\n\n` +
      '☝️ Kodni bosing (nusxa olish) va menga yuboring.\n' +
      '<i>Kod 10 daqiqa amal qiladi.</i>',
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('❌ handlePhone xatosi:', err);
    await ctx.reply('❌ Xatolik yuz berdi. /start — qaytadan boshlang.').catch(() => {});
  }
}

// ── OTP tekshirish ────────────────────────────────
export async function handleOtp(ctx: BotContext) {
  try {
    if (ctx.session.step !== 'waiting_otp') return;

    const text = ctx.message?.text?.trim();
    if (!text || !/^\d{6}$/.test(text)) {
      await ctx.reply('❌ 6 xonali tasdiqlash kodini kiriting.');
      return;
    }

    const chatId = String(ctx.chat?.id);
    const session = await verifyOtp(chatId, text);

    if (!session) {
      await ctx.reply(
        '❌ Kod noto\'g\'ri yoki muddati o\'tgan.\n\n' +
        '/start — qaytadan boshlash'
      );
      ctx.session.step = 'idle';
      return;
    }

    // Telegram akkauntni bog'lash
    const username = ctx.from?.username;
    await linkTelegramAccount(session.phone, chatId, username);

    ctx.session.step = 'idle';

    // Foydalanuvchi ma'lumotlarini olish
    const user = await getUserByChatId(chatId);
    if (!user) {
      await ctx.reply('❌ Xatolik yuz berdi. /start — qaytadan urinib ko\'ring.');
      return;
    }

    let menuText = brandHeader('✅', 'MUVAFFAQIYATLI!');
    menuText += `🎉 <b>${user.fullName}</b>, ro'yxatdan o'tdingiz!\n\nEndi barcha imkoniyatlardan foydalanishingiz mumkin:`;
    let keyboard;

    if (user.role === 'STUDENT') {
      keyboard = studentMainMenu();
    } else if (user.role === 'PARENT') {
      keyboard = parentMainMenu();
    } else if (user.role === 'ADMIN') {
      keyboard = adminMenu();
    } else {
      keyboard = studentMainMenu();
    }

    await ctx.reply(menuText, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error('❌ handleOtp xatosi:', err);
    await ctx.reply('❌ Xatolik yuz berdi. /start — qaytadan boshlang.').catch(() => {});
  }
}
