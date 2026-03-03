import prisma from '../lib/prisma';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';


// ══════════════════════════════════════════════════════════════════
// System knowledge base (Uzbek + Russian LMS context)
// ══════════════════════════════════════════════════════════════════

interface SystemContext {
  stats?: Record<string, number>;
  userName?: string;
  role?: string;
}

async function getSystemStats(userId: number, role: string): Promise<SystemContext['stats']> {
  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    if (role === 'ADMIN') {
      const [students, teachers, groups, paymentsMonth] = await Promise.all([
        prisma.student.count({ where: { user: { isActive: true } } }),
        prisma.teacher.count({ where: { user: { isActive: true } } }),
        prisma.group.count({ where: { status: 'ACTIVE' } }),
        prisma.payment.aggregate({
          where: { paidAt: { gte: monthStart } },
          _sum: { amount: true },
        }),
      ]);
      return {
        students,
        teachers,
        activeGroups: groups,
        monthIncome: Number(paymentsMonth._sum.amount || 0),
      };
    }

    if (role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } });
      if (!teacher) return {};
      const [groups, todayLessons] = await Promise.all([
        prisma.group.count({ where: { teacherId: teacher.id, status: 'ACTIVE' } }),
        prisma.lesson.count({
          where: {
            group: { teacherId: teacher.id },
            date: {
              gte: new Date(today.setHours(0, 0, 0, 0)),
              lt: new Date(today.setHours(23, 59, 59, 999)),
            },
          },
        }),
      ]);
      return { myGroups: groups, todayLessons };
    }

    if (role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId } });
      if (!student) return {};
      const [groupCount, coinBalance] = await Promise.all([
        prisma.groupStudent.count({ where: { studentId: student.id, status: 'ACTIVE' } }),
        prisma.student.findUnique({ where: { id: student.id }, select: { coinBalance: true } }),
      ]);
      return { myGroups: groupCount, coins: coinBalance?.coinBalance || 0 };
    }

    return {};
  } catch {
    return {};
  }
}

// ── Smart response engine ──────────────────────────────────────────

function detectIntent(message: string): string {
  const m = message.toLowerCase();

  // Greetings
  if (/^(salom|assalom|hello|hi|привет|xayr|hayr)\b/.test(m)) return 'GREETING';

  // Navigation / how to use
  if (/qanday\s*(kirish|bor|o['']t|ishlat)|how\s*to|nima qilaman|nima qil/.test(m)) return 'HOWTO';

  // Attendance
  if (/davomat|attendance|keldi|kelmadi|present|absent/.test(m)) return 'ATTENDANCE';

  // Grades/scores
  if (/baho|bahola|grade|score|ball|natija/.test(m)) return 'GRADES';

  // Payments
  if (/to['']lov|to'lov|payment|pul|summa|qarzdor|debt/.test(m)) return 'PAYMENT';

  // Students
  if (/o['']quvchi|student|talaba/.test(m)) return 'STUDENTS';

  // Teachers
  if (/ustoz|o['']qituvchi|teacher/.test(m)) return 'TEACHERS';

  // Groups / classes
  if (/guruh|class|group/.test(m)) return 'GROUPS';

  // Schedule
  if (/jadval|schedule|dars vaqt|soat/.test(m)) return 'SCHEDULE';

  // Coins / points
  if (/coin|ball|reward|mukofot/.test(m)) return 'COINS';

  // Reports
  if (/hisobot|report|statistika|statistic/.test(m)) return 'REPORTS';

  // Profile
  if (/profil|profile|ma['']lumot|ma'lumot|account/.test(m)) return 'PROFILE';

  // System health / check
  if (/tekshir|health|status|ishlayapti|muammo|xato|error/.test(m)) return 'HEALTH';

  // Help
  if (/yordam|help|nima\s*qil|nima\s*qilaman|ko['']rsat/.test(m)) return 'HELP';

  // Stats
  if (/statistika|statis|nechta|nechan|umumiy|jami/.test(m)) return 'STATS';

  return 'GENERAL';
}

function generateResponse(
  intent: string,
  role: string,
  stats: SystemContext['stats'],
  message: string,
  userName: string
): { text: string; quickReplies?: string[] } {
  const m = message.toLowerCase();

  switch (intent) {
    case 'GREETING':
      return {
        text: `Salom, ${userName}! 👋 Men **RoboticEdu AI yordamchisi**man. Sizga ${role === 'ADMIN' ? 'tizimni boshqarishda' :
          role === 'TEACHER' ? 'darslaringizni boshqarishda' :
            role === 'STUDENT' ? "ta'lim jarayoningizda" :
              "farzandingiz ta'limini kuzatishda"
          } yordam beraman! 🤖\n\nNima haqida bilishni xohlaysiz?`,
        quickReplies: role === 'ADMIN'
          ? ['📊 Statistika', '👥 O\'quvchilar', '💰 To\'lovlar', '⚙️ Tizim holati']
          : role === 'TEACHER'
            ? ['📋 Davomat qilish', '⭐ Baho qo\'yish', '👥 Guruhlarim', '📅 Jadvalim']
            : role === 'STUDENT'
              ? ['📚 Baholarim', '📋 Davomatim', '💎 Coinlarim', '📅 Jadvalim']
              : ['📊 Farzandim bahosi', '📋 Davomat', '💰 To\'lov holati'],
      };

    case 'STATS':
      if (role === 'ADMIN' && stats) {
        return {
          text: `📊 **Tizim statistikasi:**\n\n` +
            `👥 **O'quvchilar:** ${stats.students || 0} ta\n` +
            `👨‍🏫 **O'qituvchilar:** ${stats.teachers || 0} ta\n` +
            `📚 **Faol guruhlar:** ${stats.activeGroups || 0} ta\n` +
            `💰 **Bu oy tushumlari:** ${Number(stats.monthIncome || 0).toLocaleString('uz-UZ')} so'm\n\n` +
            `Batafsil ma'lumot uchun **Dashboard** sahifasini ko'ring.`,
          quickReplies: ['💰 To\'lovlar', '👥 O\'quvchilar', '📊 Hisobotlar'],
        };
      }
      if (role === 'TEACHER' && stats) {
        return {
          text: `📊 **Sizning statistikangiz:**\n\n` +
            `📚 **Faol guruhlaringiz:** ${stats.myGroups || 0} ta\n` +
            `📅 **Bugungi darslar:** ${stats.todayLessons || 0} ta\n\n` +
            `Guruhlaringizni ko'rish uchun **Guruhlarim** bo'limiga boring.`,
          quickReplies: ['👥 Guruhlarim', '📋 Davomat', '⭐ Baholar'],
        };
      }
      if (role === 'STUDENT' && stats) {
        return {
          text: `📊 **Sizning statistikangiz:**\n\n` +
            `📚 **Guruhlarim:** ${stats.myGroups || 0} ta\n` +
            `💎 **Coin balansi:** ${stats.coins || 0} ta\n\n` +
            `Batafsil ma'lumot uchun Dashboard sahifangizga boring.`,
          quickReplies: ['📚 Baholarim', '💎 Coinlarim', '📋 Davomatim'],
        };
      }
      return { text: "Statistika ma'lumotlarini yuklashda xato yuz berdi.", quickReplies: ['🏠 Dashboard'] };

    case 'ATTENDANCE':
      if (role === 'TEACHER') {
        return {
          text: `📋 **Davomat belgilash:**\n\n` +
            `1️⃣ **Davomat** bo'limiga kiring\n` +
            `2️⃣ Guruh va sanani tanlang\n` +
            `3️⃣ Dars mavzusini kiriting (ixtiyoriy)\n` +
            `4️⃣ Har bir o'quvchi uchun holat tanlang:\n` +
            `   ✅ Keldi | ❌ Kelmadi | ⏰ Kechikdi | 📖 Sababli\n` +
            `5️⃣ **"Davomatni saqlash"** tugmasini bosing\n\n` +
            `💡 *Guruhlarim sahifasidagi **📋 Davomat** tugmasi orqali ham kirish mumkin*`,
          quickReplies: ['⭐ Baho qo\'yish', '👥 Guruhlarim', '📅 Jadvalim'],
        };
      }
      if (role === 'STUDENT' || role === 'PARENT') {
        return {
          text: `📋 **Davomat ma'lumotlari:**\n\n` +
            `${role === 'STUDENT' ? 'Dashboard sahifangizda' : "Bosh sahifada"} davomat foizingizni ko'rishingiz mumkin.\n\n` +
            `• ✅ Keldi\n• ❌ Kelmadi\n• ⏰ Kechikdi\n• 📖 Sababli\n\n` +
            `Batafsil ma'lumot uchun Dashboard sahifasiga boring.`,
          quickReplies: ['📊 Statistika', '📚 Baholarim'],
        };
      }
      if (role === 'ADMIN') {
        return {
          text: `📋 **Davomat (Admin):**\n\n` +
            `• **Dashboard → Bugungi darslar** — real-time davomat\n` +
            `• **Guruhlar → Guruh tanlash** — guruh davomati\n` +
            `• **Hisobotlar** → davomat CSV eksport\n\n` +
            `Davomat statistikasi Dashboard sahifasida ko'rsatiladi.`,
          quickReplies: ['📊 Dashboard', '👥 Guruhlar', '📈 Hisobotlar'],
        };
      }
      return { text: 'Davomat haqida qo\'shimcha savollaringiz bormi?' };

    case 'GRADES':
      if (role === 'TEACHER') {
        return {
          text: `⭐ **Baho qo'yish:**\n\n` +
            `**Yakka baho:**\n` +
            `1️⃣ **Baholar** bo'limiga kiring\n` +
            `2️⃣ Guruh va oyni tanlang\n` +
            `3️⃣ Baho turini tanlang (Sinf/Uy/Imtihon/Loyiha)\n` +
            `4️⃣ Jadvaldagi katakchani bosing → ball kiriting → Enter\n\n` +
            `**Ommaviy baho (bir dars uchun barcha o'quvchilarga):**\n` +
            `Dars sanasini bosing → Barcha o'quvchilarga ball → Saqlash\n\n` +
            `📝 Ball: **0 dan 100 gacha**`,
          quickReplies: ['📋 Davomat', '👥 Guruhlarim'],
        };
      }
      if (role === 'STUDENT' || role === 'PARENT') {
        return {
          text: `⭐ **Baholar:**\n\n` +
            `${role === 'STUDENT' ? '**Baholar** bo\'limida' : 'Bosh sahifada'} o\'quvchining baholarini ko\'rish mumkin.\n\n` +
            `**Baho turlari:**\n` +
            `📝 Sinf ishi | 📚 Uy ishi | 📋 Imtihon | 🏆 Loyiha\n\n` +
            `O'rtacha ball va statistika ham ko'rsatiladi.`,
          quickReplies: ['📋 Davomat', '💎 Coinlar'],
        };
      }
      return { text: 'Baholar bo\'limiga kirish uchun tegishli menu\'dan foydalaning.' };

    case 'PAYMENT':
      if (role === 'ADMIN') {
        return {
          text: `💰 **To'lovlar (Admin):**\n\n` +
            `**To'lov qabul qilish:**\n` +
            `1️⃣ **To'lovlar** bo'limiga kiring\n` +
            `2️⃣ **"+ To'lov qo'shish"** tugmasini bosing\n` +
            `3️⃣ O'quvchi tanlang, summa va oy kiriting\n` +
            `4️⃣ To'lov usulini belgilang\n\n` +
            `**Oylik to'lov yaratish:**\n` +
            `To'lovlar sahifasida **"Oylik to'lovlar"** tugmasi orqali barcha o'quvchilar uchun avtomatik to'lov yarating.\n\n` +
            `**Online to'lov (Payme/Uzum):**\n` +
            `.env faylida PAYME va UZUM kalitlarini sozlang.`,
          quickReplies: ['📊 Moliya', '👥 O\'quvchilar', '💳 Qarzdorlar'],
        };
      }
      if (role === 'STUDENT') {
        return {
          text: `💰 **To'lovlar:**\n\n` +
            `**To'lov** bo'limida quyidagilarni ko'rishingiz mumkin:\n` +
            `• To'lov tarixi\n` +
            `• Joriy oy to'lovi\n` +
            `• Balans holati\n\n` +
            `**Online to'lov:** Payme yoki Uzum orqali to'lash mumkin.`,
          quickReplies: ['📊 Baholarim', '📋 Davomatim'],
        };
      }
      if (role === 'PARENT') {
        return {
          text: `💰 **To'lov ma'lumotlari:**\n\n` +
            `Bosh sahifada farzandingizning:\n` +
            `• To'lov tarixi\n` +
            `• Joriy balans\n` +
            `• Keyingi to'lov sanasi\n\n` +
            `**Online to'lov:** Payme yoki Uzum orqali to'lash mumkin (tugma bosh sahifada).`,
          quickReplies: ['📊 Baholar', '📋 Davomat'],
        };
      }
      return { text: 'To\'lovlar bo\'limiga kirish uchun menu\'dan foydalaning.' };

    case 'STUDENTS':
      if (role === 'ADMIN') {
        return {
          text: `👥 **O'quvchilarni boshqarish:**\n\n` +
            `**O'quvchi qo'shish:**\n` +
            `1️⃣ O'quvchilar → **"+ O'quvchi qo'shish"**\n` +
            `2️⃣ Ismi, telefon, guruh → Saqlash\n\n` +
            `**O'quvchini guruhga qo'shish:**\n` +
            `Guruhlar → Guruh → **"+ O'quvchi qo'shish"**\n\n` +
            `**Filtrlar:** Qidiruv, guruh, status, qarzdor\n\n` +
            `Jami: **${stats?.students || '—'} ta** o'quvchi`,
          quickReplies: ['➕ O\'quvchi qo\'shish', '👥 Guruhlar', '💰 To\'lovlar'],
        };
      }
      return { text: 'O\'quvchilar haqida ma\'lumot olish uchun tegishli bo\'limga kiring.' };

    case 'GROUPS':
      if (role === 'ADMIN') {
        return {
          text: `📚 **Guruhlarni boshqarish:**\n\n` +
            `**Guruh yaratish:**\n` +
            `1️⃣ Guruhlar → **"+ Guruh yaratish"**\n` +
            `2️⃣ Nom, kurs, ustoz, jadval → Saqlash\n\n` +
            `**Guruh tarixi:**\n` +
            `Guruh sahifasida o'quvchilar, to'lovlar, davomat, baholar\n\n` +
            `**Faol guruhlar:** ${stats?.activeGroups || '—'} ta`,
          quickReplies: ['👥 O\'quvchilar', '👨‍🏫 O\'qituvchilar', '📅 Jadval'],
        };
      }
      if (role === 'TEACHER') {
        return {
          text: `👥 **Guruhlarim:**\n\n` +
            `**Guruhlarim** bo'limida barcha guruhlaringiz ko'rsatiladi.\n\n` +
            `Har bir guruhdan:\n` +
            `• **📋 Davomat** — davomat belgilash\n` +
            `• **⭐ Baholar** — baholar jadvali\n\n` +
            `Sizda **${stats?.myGroups || '—'} ta** faol guruh bor.`,
          quickReplies: ['📋 Davomat', '⭐ Baholar', '📅 Jadvalim'],
        };
      }
      return { text: 'Guruhlar haqida ma\'lumot olish uchun tegishli bo\'limga kiring.' };

    case 'SCHEDULE':
      if (role === 'TEACHER') {
        return {
          text: `📅 **Jadvalim:**\n\n` +
            `**Dars Jadvalim** sahifasida:\n` +
            `• Hafta kunlarini ko'rish\n` +
            `• Guruh tanlash → dars boshlash\n` +
            `• O'quvchilar davomati va coinlarini belgilash\n` +
            `• Dars saqlash\n\n` +
            `Bugun **${stats?.todayLessons || 0} ta** dars rejalashtirilgan.`,
          quickReplies: ['📋 Davomat', '👥 Guruhlarim'],
        };
      }
      if (role === 'STUDENT') {
        return {
          text: `📅 **Jadvalim:**\n\n` +
            `**Jadvalim** bo'limida haftalik dars jadvalingizni ko'rishingiz mumkin:\n` +
            `• Kunlar va vaqtlar\n` +
            `• Kurs va guruh nomi\n` +
            `• O'qituvchi\n\n` +
            `Jadvalni tekshirib, o'z guruhingizni toping!`,
          quickReplies: ['📚 Baholarim', '📋 Davomatim'],
        };
      }
      return {
        text: `📅 **Jadval:**\n\nJadval bo'limida barcha guruhlarning dars vaqtlarini ko'rishingiz mumkin.`,
        quickReplies: ['👥 Guruhlar', '📋 Davomat'],
      };

    case 'COINS':
      return {
        text: `💎 **Coin tizimi:**\n\n` +
          `Coinlar — o'quvchilarni rag'batlantirish tizimi!\n\n` +
          `**Coin olish usullari:**\n` +
          `• ✅ Darsga kelish\n• ⭐ Yaxshi baho\n• 🏆 Maxsus topshiriqlar\n\n` +
          (role === 'TEACHER'
            ? `**Coin berish:**\n1️⃣ Coinlar → O'quvchi tanlang\n2️⃣ Miqdor kiriting\n3️⃣ Sabab yozing → Yuborish\n\n*Dars jadvalida ham dars paytida coin berishingiz mumkin.*`
            : role === 'STUDENT'
              ? `**Sizning coinlaringiz:** ${stats?.coins || 0} ta 💎\n\nReyting jadvalida boshqa o'quvchilar bilan raqobatlashing!`
              : `**Coinlar** bo'limida barcha o'quvchilarning coin tarixi va reytingi ko'rsatiladi.`),
        quickReplies: role === 'TEACHER'
          ? ['👥 Guruhlarim', '📋 Davomat']
          : ['📊 Reyting', '📚 Baholarim'],
      };

    case 'COINS':
      return {
        text: `🔧 **Tizim holati:**\n\n` +
          `Tizim to'g'ri ishlayapti ✅\n\n` +
          `**Asosiy komponentlar:**\n` +
          `• 🗄️ Ma'lumotlar bazasi — ishlayapti\n` +
          `• 🔐 Autentifikatsiya — ishlayapti\n` +
          `• 📡 API — ishlayapti\n\n` +
          `**Muammo uchquda nima qilish kerak:**\n` +
          `1. Sahifani yangilang (F5)\n` +
          `2. Qayta kiring (chiqish → kirish)\n` +
          `3. Admin bilan bog'laning`,
        quickReplies: ['📊 Statistika', '❓ Yordam'],
      };

    case 'REPORTS':
      if (role === 'ADMIN') {
        return {
          text: `📈 **Hisobotlar:**\n\n` +
            `**Hisobotlar** bo'limida quyidagilarni CSV formatida yuklab oling:\n\n` +
            `• 👥 O'quvchilar ro'yxati\n` +
            `• 💰 To'lovlar hisoboti\n` +
            `• 📋 Davomat hisoboti\n` +
            `• ⭐ Baholar hisoboti\n\n` +
            `Oy bo'yicha filtrlash mumkin.`,
          quickReplies: ['💰 Moliya', '📊 Dashboard'],
        };
      }
      return { text: 'Hisobotlar faqat adminlar uchun mavjud.' };

    case 'PROFILE':
      return {
        text: `👤 **Profil:**\n\n` +
          `**Profil** bo'limida:\n` +
          `• Ismingizni o'zgartirish\n` +
          `• Email qo'shish\n` +
          `• Parolni o'zgartirish\n` +
          `• Avatar yuklash\n\n` +
          `Profil → tahrirlash tugmasini bosing.`,
        quickReplies: ['🏠 Bosh sahifa', '❓ Yordam'],
      };

    case 'HELP':
      return {
        text: `❓ **Yordam — ${role === 'ADMIN' ? 'Admin' :
          role === 'TEACHER' ? 'Ustoz' :
            role === 'STUDENT' ? 'O\'quvchi' : 'Ota-ona'
          } uchun qo'llanma:**\n\n` +
          (role === 'ADMIN'
            ? `🏠 **Dashboard** — umumiy statistika\n👥 **O'quvchilar** — ro'yxat va boshqaruv\n👨‍🏫 **O'qituvchilar** — kadrlar boshqaruvi\n📚 **Guruhlar** — guruhlar va jadval\n💰 **To'lovlar** — to'lov qabul qilish\n💼 **Moliya** — daromad va xarajatlar\n💵 **Maoshlar** — ustoz maoshlari\n💎 **Coinlar** — rag'batlantirish tizimi\n📈 **Hisobotlar** — CSV eksport\n📢 **E'lonlar** — barcha foydalanuvchilarga xabar`
            : role === 'TEACHER'
              ? `🏠 **Dashboard** — bugungi darslar\n📅 **Dars Jadvalim** — haftalik jadval\n👥 **Guruhlarim** — guruhlar ro'yxati\n📋 **Davomat** — davomat belgilash\n⭐ **Baholar** — baholar jadvali\n💎 **Coinlar** — o'quvchilarga coin berish`
              : role === 'STUDENT'
                ? `🏠 **Dashboard** — umumiy ko'rinish\n📅 **Jadvalim** — dars jadvali\n⭐ **Baholarim** — baho tarixi\n💎 **Coinlarim** — coin balansi\n💰 **To'lovlarim** — to'lov holati`
                : `🏠 **Bosh sahifa** — farzandingiz haqida umumiy ma'lumot\n💰 **To'lov** — online to'lov imkoniyati`),
        quickReplies: ['📊 Statistika', '🔧 Tizim holati'],
      };

    case 'HOWTO':
      // Try to detect what they want to know HOW TO do
      if (m.includes('davomat')) return generateResponse('ATTENDANCE', role, stats, message, userName);
      if (m.includes('baho') || m.includes('bahola')) return generateResponse('GRADES', role, stats, message, userName);
      if (m.includes('to\'lov') || m.includes("to'lov")) return generateResponse('PAYMENT', role, stats, message, userName);
      if (m.includes('guruh')) return generateResponse('GROUPS', role, stats, message, userName);
      if (m.includes('o\'quvchi') || m.includes("o'quvchi")) return generateResponse('STUDENTS', role, stats, message, userName);
      return generateResponse('HELP', role, stats, message, userName);

    default:
      return {
        text: `Savolingizni tushundim, lekin aniqroq javob bera olmayman.\n\n` +
          `Quyidagilar haqida so'rashingiz mumkin:`,
        quickReplies: role === 'ADMIN'
          ? ['📊 Statistika', '👥 O\'quvchilar', '💰 To\'lovlar', '❓ Yordam']
          : role === 'TEACHER'
            ? ['📋 Davomat', '⭐ Baholar', '👥 Guruhlarim', '❓ Yordam']
            : ['📚 Baholarim', '📋 Davomat', '💎 Coinlarim', '❓ Yordam'],
      };
  }
}

// ══════════════════════════════════════════════════════════════════
// POST /ai-assistant/chat
// ══════════════════════════════════════════════════════════════════
export const aiChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      sendError(res, 'Xabar kiritilishi shart.', 400);
      return;
    }

    const userId = req.user!.id;
    const role = req.user!.role;

    // Get user name
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    const userName = userRecord?.fullName?.split(' ')[0] || 'Foydalanuvchi';

    // Get real-time stats
    const stats = await getSystemStats(userId, role);

    // Detect intent & generate response
    const intent = detectIntent(message.trim());
    const response = generateResponse(intent, role, stats, message.trim(), userName);

    sendSuccess(res, {
      text: response.text,
      quickReplies: response.quickReplies || [],
      intent,
      role,
    });
  } catch (err) {
    console.error('aiChat error:', err);
    sendError(res, 'Yordamchi javob berishda xato.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════
// GET /ai-assistant/context — Initial context for the assistant
// ══════════════════════════════════════════════════════════════════
export const getAiContext = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const stats = await getSystemStats(userId, role);
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    sendSuccess(res, {
      role,
      userName: userRecord?.fullName || '',
      stats,
      greeting: `Salom! Men RoboticEdu AI yordamchisiman 🤖 Sizga qanday yordam bera olaman?`,
    });
  } catch (err) {
    console.error('getAiContext error:', err);
    sendError(res, 'Kontekst olishda xato.', 500);
  }
};
