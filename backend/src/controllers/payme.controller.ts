import { Request, Response } from 'express';
import prismaBase from '../lib/prisma';

// PaymeTransaction modeli uchun "as any" — schema.prisma da mavjud
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = prismaBase as any;

// ══════════════════════════════════════════════════════════════
// PayMe Merchant API — JSON-RPC 2.0
// Rasmiy hujjat: https://developer.help.paycom.uz/metody-merchant-api
//
// Merchant KEY: env.PAYME_KEY
// Auth: Basic base64("Paycom:{KEY}")
// Endpoint: POST /payme/webhook
// ══════════════════════════════════════════════════════════════

// ── PayMe rasmiy xatolik kodlari ─────────────────────────────
const RPC_ERRORS = {
  // JSON-RPC standart xatolar
  PARSE_ERROR: -32700,
  INVALID_RPC: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // PayMe maxsus autentifikatsiya xatosi
  AUTH_ERROR: -32504,
  // PayMe biznes logika xatolari
  TRANSACTION_NOT_FOUND: -31003,
  UNABLE_TO_PERFORM: -31008,
  // Maxsus account xatolari (order_id = -31050, student_id = -31051)
  ORDER_NOT_FOUND: -31050,
  STUDENT_NOT_FOUND: -31051,
  WRONG_AMOUNT: -31001,
  ALREADY_DONE: -31060,
  PENDING_PAYMENT: -31050,
  CANT_PERFORM: -31008,
};

// PayMe tranzaksiya holatlari (states)
// 1  = Tranzaksiya yaratildi (kutilmoqda)
// 2  = Tranzaksiya bajarildi (to'lov muvaffaqiyatli)
// -1 = Tranzaksiya bekor qilindi (bajarilishidan oldin)
// -2 = Tranzaksiya bekor qilindi (bajarilishidan keyin — refund)

// PayMe timeout: 12 soat (43 200 000 ms)
const PAYME_TIMEOUT_MS = 12 * 60 * 60 * 1000;

// ── JSON-RPC javob yordamchi funksiyalari ────────────────────

function rpcSuccess(res: Response, id: string | number | null, result: object) {
  res.status(200).json({
    jsonrpc: '2.0',
    id,
    result,
  });
}

function rpcError(
  res: Response,
  id: string | number | null,
  code: number,
  messageUz: string,
  messageRu: string = messageUz,
  data?: string,
) {
  const errorObj: Record<string, unknown> = {
    code,
    message: {
      ru: messageRu,
      uz: messageUz,
      en: messageRu,
    },
  };
  if (data) errorObj.data = data;

  res.status(200).json({
    jsonrpc: '2.0',
    id,
    error: errorObj,
  });
}

// ── Basic Auth tekshiruv ─────────────────────────────────────
function checkAuth(req: Request): boolean {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Basic ')) return false;

  const paymeKey = process.env.PAYME_KEY;
  if (!paymeKey) {
    console.error('❌ PAYME_KEY env variable o\'rnatilmagan!');
    return false;
  }

  // PayMe formati: Basic base64("Paycom:{KEY}")
  const expected = 'Basic ' + Buffer.from(`Paycom:${paymeKey}`).toString('base64');
  return authHeader === expected;
}

// ── orderId parse ────────────────────────────────────────────
// Format: LMS-{studentId}-{amountTiyin}-{monthYYYYMM}-{timestamp}
// Misol: LMS-42-15000000-202603-1740912345678
interface ParsedOrder {
  studentId: number;
  amountTiyin: number;
  month: Date;
}

function parseOrderId(orderId: string): ParsedOrder | null {
  try {
    const parts = orderId.split('-');
    if (parts.length < 5 || parts[0] !== 'LMS') return null;

    const studentId = parseInt(parts[1]);
    const amountTiyin = parseInt(parts[2]);
    const monthStr = parts[3]; // "202603"
    const year = parseInt(monthStr.substring(0, 4));
    const monthNum = parseInt(monthStr.substring(4, 6)) - 1;
    const monthDate = new Date(Date.UTC(year, monthNum, 1));

    if (isNaN(studentId) || isNaN(amountTiyin) || isNaN(year)) return null;
    return { studentId, amountTiyin, month: monthDate };
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// ASOSIY WEBHOOK HANDLER — POST /payme/webhook
// ══════════════════════════════════════════════════════════════
export const paymeWebhook = async (req: Request, res: Response): Promise<void> => {
  const { id, method, params } = req.body || {};

  // 1. Auth tekshiruv — har bir so'rovda
  if (!checkAuth(req)) {
    console.warn('⚠️ PayMe auth muvaffaqiyatsiz:', req.headers['authorization']?.substring(0, 20));
    rpcError(res, id ?? null, RPC_ERRORS.AUTH_ERROR,
      'Avtorizatsiya muvaffaqiyatsiz',
      'Неверная авторизация');
    return;
  }

  // 2. Method tekshiruv
  if (!method) {
    rpcError(res, id ?? null, RPC_ERRORS.INVALID_RPC,
      'Metod ko\'rsatilmagan',
      'Не указан метод');
    return;
  }

  console.log(`💳 [PayMe] ${method} — params:`, JSON.stringify(params || {}).substring(0, 200));

  try {
    switch (method) {
      case 'CheckPerformTransaction':
        await handleCheckPerformTransaction(res, id, params);
        break;
      case 'CreateTransaction':
        await handleCreateTransaction(res, id, params);
        break;
      case 'PerformTransaction':
        await handlePerformTransaction(res, id, params);
        break;
      case 'CancelTransaction':
        await handleCancelTransaction(res, id, params);
        break;
      case 'CheckTransaction':
        await handleCheckTransaction(res, id, params);
        break;
      case 'GetStatement':
        await handleGetStatement(res, id, params);
        break;
      default:
        rpcError(res, id, RPC_ERRORS.METHOD_NOT_FOUND,
          `Metod topilmadi: ${method}`,
          `Метод не найден: ${method}`);
    }
  } catch (err) {
    console.error(`❌ [PayMe] ${method} xato:`, err);
    rpcError(res, id ?? null, RPC_ERRORS.INTERNAL_ERROR,
      'Ichki tizim xatosi',
      'Внутренняя ошибка системы');
  }
};

// ══════════════════════════════════════════════════════════════
// 1. CheckPerformTransaction
//    To'lovni bajarish mumkinligini tekshirish
//    PayMe bu metodga har safar to'lov qilmoqchi bo'lganda murojaat qiladi
// ══════════════════════════════════════════════════════════════
async function handleCheckPerformTransaction(
  res: Response,
  id: string | number,
  params: { amount: number; account: { order_id?: string; student_id?: string } },
) {
  const orderId = params?.account?.order_id;
  const amount = params?.amount;

  // 1. order_id mavjudligini tekshirish
  if (!orderId) {
    rpcError(res, id, RPC_ERRORS.ORDER_NOT_FOUND,
      'order_id kiritilmagan',
      'Не указан order_id',
      'order_id');
    return;
  }

  // 2. orderId ni parse qilish
  const parsed = parseOrderId(orderId);
  if (!parsed) {
    rpcError(res, id, RPC_ERRORS.ORDER_NOT_FOUND,
      'Buyurtma topilmadi',
      'Заказ не найден',
      'order_id');
    return;
  }

  // 3. O'quvchi mavjudligini va faolligini tekshirish
  const student = await prisma.student.findUnique({
    where: { id: parsed.studentId },
    include: { user: { select: { isActive: true, fullName: true } } },
  });

  if (!student) {
    rpcError(res, id, RPC_ERRORS.STUDENT_NOT_FOUND,
      'O\'quvchi topilmadi',
      'Студент не найден',
      'student_id');
    return;
  }

  if (!student.user.isActive) {
    rpcError(res, id, RPC_ERRORS.STUDENT_NOT_FOUND,
      'O\'quvchi faol emas',
      'Студент не активен',
      'student_id');
    return;
  }

  // 4. Summa tekshiruv — ANIQ MOS KELISHI KERAK (tiyin da)
  if (!amount || amount <= 0) {
    rpcError(res, id, RPC_ERRORS.WRONG_AMOUNT,
      'Noto\'g\'ri summa',
      'Неверная сумма');
    return;
  }

  if (amount !== parsed.amountTiyin) {
    rpcError(res, id, RPC_ERRORS.WRONG_AMOUNT,
      'Summa mos kelmaydi',
      'Сумма не совпадает');
    return;
  }

  // 5. Bu order uchun allaqachon bajarilgan to'lov bormi tekshirish
  const existingDone = await prisma.paymeTransaction.findFirst({
    where: { orderId, state: 2 },
  });

  if (existingDone) {
    rpcError(res, id, RPC_ERRORS.ALREADY_DONE,
      'Bu buyurtma uchun to\'lov allaqachon bajarilgan',
      'Оплата по этому заказу уже выполнена');
    return;
  }

  // Hammasi yaxshi — to'lov qilish mumkin
  rpcSuccess(res, id, { allow: true });
}

// ══════════════════════════════════════════════════════════════
// 2. CreateTransaction
//    PayMe yangi tranzaksiya yaratadi
//    Foydalanuvchi to'lov sahifasiga kirganida chaqiriladi
// ══════════════════════════════════════════════════════════════
async function handleCreateTransaction(
  res: Response,
  id: string | number,
  params: {
    id: string;      // PayMe transaction ID
    time: number;     // PayMe timestamp (ms)
    amount: number;   // summa (tiyin)
    account: { order_id?: string; student_id?: string };
  },
) {
  const paymeId = params?.id;
  const createTime = params?.time;
  const amount = params?.amount;
  const orderId = params?.account?.order_id;

  if (!paymeId || !orderId || !createTime || !amount) {
    rpcError(res, id, RPC_ERRORS.INVALID_PARAMS,
      'Parametrlar to\'liq emas',
      'Неполные параметры');
    return;
  }

  // 1. Mavjud tranzaksiyani tekshirish (idempotency)
  const existing = await prisma.paymeTransaction.findUnique({
    where: { paymeId },
  });

  if (existing) {
    // Agar bekor qilingan bo'lsa — xato
    if (existing.state === -1 || existing.state === -2) {
      rpcError(res, id, RPC_ERRORS.CANT_PERFORM,
        'Tranzaksiya bekor qilingan',
        'Транзакция отменена');
      return;
    }

    // Agar bajarilgan bo'lsa — xato (yangi tranzaksiya yaratib bo'lmaydi)
    if (existing.state === 2) {
      rpcError(res, id, RPC_ERRORS.ALREADY_DONE,
        'Tranzaksiya allaqachon bajarilgan',
        'Транзакция уже выполнена');
      return;
    }

    // state=1 (kutilmoqda) — timeout tekshirish
    const txAge = Date.now() - Number(existing.createTime);
    if (txAge > PAYME_TIMEOUT_MS) {
      // 12 soatdan oshgan — bekor qilamiz va qayta yaratamiz
      await prisma.paymeTransaction.update({
        where: { id: existing.id },
        data: { state: -1, cancelTime: BigInt(Date.now()), reason: 4 },
      });
      // Pastda yangi yaratiladi
    } else {
      // Hali timeout bo'lmagan — mavjud tranzaksiyani qaytarish
      rpcSuccess(res, id, {
        create_time: Number(existing.createTime),
        transaction: existing.id.toString(),
        state: existing.state,
      });
      return;
    }
  }

  // 2. Bu order uchun boshqa kutayotgan tranzaksiya bor bo'lsa — bekor qilish
  const pendingForOrder = await prisma.paymeTransaction.findFirst({
    where: { orderId, state: 1, paymeId: { not: paymeId } },
  });
  if (pendingForOrder) {
    await prisma.paymeTransaction.update({
      where: { id: pendingForOrder.id },
      data: { state: -1, cancelTime: BigInt(Date.now()), reason: 4 },
    });
  }

  // 3. Order validatsiyasi
  const parsed = parseOrderId(orderId);
  if (!parsed) {
    rpcError(res, id, RPC_ERRORS.ORDER_NOT_FOUND,
      'Buyurtma topilmadi',
      'Заказ не найден',
      'order_id');
    return;
  }

  // O'quvchi tekshiruv
  const student = await prisma.student.findUnique({
    where: { id: parsed.studentId },
    include: { user: { select: { isActive: true } } },
  });
  if (!student || !student.user.isActive) {
    rpcError(res, id, RPC_ERRORS.STUDENT_NOT_FOUND,
      'O\'quvchi topilmadi yoki faol emas',
      'Студент не найден или неактивен',
      'student_id');
    return;
  }

  // Summa tekshiruv
  if (amount !== parsed.amountTiyin) {
    rpcError(res, id, RPC_ERRORS.WRONG_AMOUNT,
      'Summa mos kelmaydi',
      'Сумма не совпадает');
    return;
  }

  // 4. Yangi tranzaksiya yaratish
  const tx = await prisma.paymeTransaction.create({
    data: {
      paymeId,
      orderId,
      studentId: parsed.studentId,
      amount,
      state: 1,
      createTime: BigInt(createTime),
    },
  });

  console.log(`✅ [PayMe] CreateTransaction — TX#${tx.id}, student#${parsed.studentId}, ${amount} tiyin`);

  rpcSuccess(res, id, {
    create_time: Number(tx.createTime),
    transaction: tx.id.toString(),
    state: tx.state,
  });
}

// ══════════════════════════════════════════════════════════════
// 3. PerformTransaction
//    To'lov tasdiqlandi — foydalanuvchi to'lovni amalga oshirdi
//    Bu yerda Payment yaratiladi va balans yangilanadi
// ══════════════════════════════════════════════════════════════
async function handlePerformTransaction(
  res: Response,
  id: string | number,
  params: { id: string },
) {
  const paymeId = params?.id;

  if (!paymeId) {
    rpcError(res, id, RPC_ERRORS.TRANSACTION_NOT_FOUND,
      'Tranzaksiya ID kiritilmagan',
      'Не указан ID транзакции');
    return;
  }

  const tx = await prisma.paymeTransaction.findUnique({ where: { paymeId } });

  if (!tx) {
    rpcError(res, id, RPC_ERRORS.TRANSACTION_NOT_FOUND,
      'Tranzaksiya topilmadi',
      'Транзакция не найдена');
    return;
  }

  // Agar allaqachon bajarilgan — idempotent qaytarish
  if (tx.state === 2) {
    rpcSuccess(res, id, {
      perform_time: Number(tx.performTime),
      transaction: tx.id.toString(),
      state: 2,
    });
    return;
  }

  // Agar bekor qilingan bo'lsa
  if (tx.state === -1 || tx.state === -2) {
    rpcError(res, id, RPC_ERRORS.CANT_PERFORM,
      'Tranzaksiya bekor qilingan',
      'Транзакция отменена');
    return;
  }

  // Timeout tekshirish (12 soat)
  const txAge = Date.now() - Number(tx.createTime);
  if (txAge > PAYME_TIMEOUT_MS) {
    // Timeout — bekor qilamiz
    await prisma.paymeTransaction.update({
      where: { id: tx.id },
      data: { state: -1, cancelTime: BigInt(Date.now()), reason: 4 },
    });
    rpcError(res, id, RPC_ERRORS.CANT_PERFORM,
      'Tranzaksiya muddati o\'tdi (12 soat)',
      'Время транзакции истекло (12 часов)');
    return;
  }

  // Order parse
  const parsed = parseOrderId(tx.orderId);
  if (!parsed) {
    rpcError(res, id, RPC_ERRORS.INTERNAL_ERROR,
      'Order ma\'lumotlari xato',
      'Ошибка данных заказа');
    return;
  }

  const performTime = Date.now();
  const amountSom = Math.round(tx.amount / 100); // tiyin → so'm (butun son)

  // Tranzaksiya: Payment yaratish + Balans yangilash + PaymeTransaction yangilash
  const result = await prisma.$transaction(async (trx: any) => {
    // 1. Payment yozuv yaratish
    const payment = await trx.payment.create({
      data: {
        studentId: tx.studentId,
        amount: amountSom,
        month: parsed.month,
        paymentMethod: 'ONLINE',
        status: 'PAID',
        paidAt: new Date(performTime),
        provider: 'PAYME',
        providerOrderId: tx.orderId,
        transactionId: paymeId,
        note: `PayMe orqali to'lov (#${tx.id})`,
      },
    });

    // 2. Balansni yangilash — avval qarzni so'ndirish, keyin balans
    const balRec = await trx.studentBalance.findUnique({ where: { studentId: tx.studentId } });
    let newDebt = Math.round(Number(balRec?.debt ?? 0));
    let newBalance = Math.round(Number(balRec?.balance ?? 0));

    if (newDebt > 0) {
      const debtPaid = Math.min(amountSom, newDebt);
      newDebt = newDebt - debtPaid;
      newBalance = newBalance + (amountSom - debtPaid);
    } else {
      newBalance = newBalance + amountSom;
    }

    // Va'da ma'lumotlarini tozalash agar qarz 0 ga tushgan bo'lsa
    const balanceData: Record<string, unknown> = {
      balance: newBalance,
      debt: newDebt,
      lastUpdated: new Date(),
    };
    if (newDebt <= 0) {
      balanceData.promiseDate = null;
      balanceData.promiseAmount = null;
      balanceData.promiseNote = null;
    }

    await trx.studentBalance.upsert({
      where: { studentId: tx.studentId },
      update: balanceData,
      create: { studentId: tx.studentId, balance: newBalance, debt: 0 },
    });

    // 3. PaymeTransaction yangilash — state=2
    const updated = await trx.paymeTransaction.update({
      where: { id: tx.id },
      data: {
        state: 2,
        performTime: BigInt(performTime),
        paymentId: payment.id,
      },
    });

    return { updated, paymentId: payment.id };
  });

  console.log(`✅ [PayMe] PerformTransaction — TX#${tx.id}, Payment#${result.paymentId}, ${amountSom} so'm`);

  // Telegram orqali xabar yuborish (async — javobni kutmaymiz)
  sendPaymeSuccessNotification(tx.studentId, amountSom).catch(err =>
    console.error('⚠️ PayMe Telegram xabar xatosi:', err)
  );

  rpcSuccess(res, id, {
    perform_time: performTime,
    transaction: result.updated.id.toString(),
    state: 2,
  });
}

// ══════════════════════════════════════════════════════════════
// 4. CancelTransaction
//    Tranzaksiyani bekor qilish
//    state=1 → -1 (yaratilgandan keyin bekor)
//    state=2 → -2 (bajarilgandan keyin bekor — refund)
// ══════════════════════════════════════════════════════════════
async function handleCancelTransaction(
  res: Response,
  id: string | number,
  params: { id: string; reason?: number },
) {
  const paymeId = params?.id;
  const reason = params?.reason ?? 0;

  if (!paymeId) {
    rpcError(res, id, RPC_ERRORS.TRANSACTION_NOT_FOUND,
      'Tranzaksiya ID kiritilmagan',
      'Не указан ID транзакции');
    return;
  }

  const tx = await prisma.paymeTransaction.findUnique({ where: { paymeId } });

  if (!tx) {
    rpcError(res, id, RPC_ERRORS.TRANSACTION_NOT_FOUND,
      'Tranzaksiya topilmadi',
      'Транзакция не найдена');
    return;
  }

  // Agar allaqachon bekor qilingan — idempotent qaytarish
  if (tx.state === -1 || tx.state === -2) {
    rpcSuccess(res, id, {
      cancel_time: Number(tx.cancelTime),
      transaction: tx.id.toString(),
      state: tx.state,
    });
    return;
  }

  const cancelTime = Date.now();

  if (tx.state === 1) {
    // ── Yaratilgan, bajarilmagan — oddiy bekor qilish ──
    await prisma.paymeTransaction.update({
      where: { id: tx.id },
      data: {
        state: -1,
        cancelTime: BigInt(cancelTime),
        reason,
      },
    });

    console.log(`🔄 [PayMe] CancelTransaction (state: 1→-1) — TX#${tx.id}, reason: ${reason}`);

    rpcSuccess(res, id, {
      cancel_time: cancelTime,
      transaction: tx.id.toString(),
      state: -1,
    });
    return;
  }

  if (tx.state === 2) {
    // ── Bajarilgan — refund: to'lovni qaytarish va balansni tiklash ──
    await prisma.$transaction(async (trx: any) => {
      // Payment yozuvini soft-delete qilish (arxivga)
      if (tx.paymentId) {
        const payment = await trx.payment.findUnique({ where: { id: tx.paymentId } });
        if (payment && !payment.isDeleted) {
          await trx.payment.update({
            where: { id: tx.paymentId },
            data: {
              isDeleted: true,
              deletedAt: new Date(),
              deleteReason: `PayMe tomonidan bekor qilindi (reason: ${reason})`,
            },
          });

          // Balansni qaytarish
          const amountSom = Math.round(Number(payment.amount));
          const balRec = await trx.studentBalance.findUnique({ where: { studentId: tx.studentId } });

          if (balRec) {
            let newBalance = Math.round(Number(balRec.balance)) - amountSom;
            let newDebt = Math.round(Number(balRec.debt));

            if (newBalance < 0) {
              // Balans yetmaydi — farqni qarzga qo'shamiz
              newDebt = newDebt + Math.abs(newBalance);
              newBalance = 0;
            }

            await trx.studentBalance.update({
              where: { studentId: tx.studentId },
              data: { balance: newBalance, debt: newDebt, lastUpdated: new Date() },
            });
          }
        }
      }

      // PaymeTransaction yangilash — state=-2
      await trx.paymeTransaction.update({
        where: { id: tx.id },
        data: {
          state: -2,
          cancelTime: BigInt(cancelTime),
          reason,
          paymentId: null,
        },
      });
    });

    console.log(`🔄 [PayMe] CancelTransaction (state: 2→-2, refund) — TX#${tx.id}, reason: ${reason}`);

    rpcSuccess(res, id, {
      cancel_time: cancelTime,
      transaction: tx.id.toString(),
      state: -2,
    });
    return;
  }

  // Boshqa holatlar — kutilmagan
  rpcError(res, id, RPC_ERRORS.CANT_PERFORM,
    'Tranzaksiyani bekor qilib bo\'lmaydi',
    'Невозможно отменить транзакцию');
}

// ══════════════════════════════════════════════════════════════
// 5. CheckTransaction
//    Tranzaksiya holatini so'rash
// ══════════════════════════════════════════════════════════════
async function handleCheckTransaction(
  res: Response,
  id: string | number,
  params: { id: string },
) {
  const paymeId = params?.id;

  const tx = await prisma.paymeTransaction.findUnique({ where: { paymeId } });
  if (!tx) {
    rpcError(res, id, RPC_ERRORS.TRANSACTION_NOT_FOUND,
      'Tranzaksiya topilmadi',
      'Транзакция не найдена');
    return;
  }

  rpcSuccess(res, id, {
    create_time: Number(tx.createTime),
    perform_time: tx.performTime ? Number(tx.performTime) : 0,
    cancel_time: tx.cancelTime ? Number(tx.cancelTime) : 0,
    transaction: tx.id.toString(),
    state: tx.state,
    reason: tx.reason ?? null,
  });
}

// ══════════════════════════════════════════════════════════════
// 6. GetStatement
//    Belgilangan vaqt oralig'idagi tranzaksiyalar ro'yxati
//    from, to — millisekundlarda (Unix timestamp)
// ══════════════════════════════════════════════════════════════
async function handleGetStatement(
  res: Response,
  id: string | number,
  params: { from: number; to: number },
) {
  const from = BigInt(params?.from ?? 0);
  const to = BigInt(params?.to ?? Date.now());

  const txs = await prisma.paymeTransaction.findMany({
    where: {
      createTime: { gte: from, lte: to },
    },
    orderBy: { createTime: 'asc' },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactions = txs.map((tx: any) => ({
    id: tx.paymeId,
    time: Number(tx.createTime),
    amount: tx.amount,
    account: {
      order_id: tx.orderId,
      student_id: tx.studentId.toString(),
    },
    create_time: Number(tx.createTime),
    perform_time: tx.performTime ? Number(tx.performTime) : 0,
    cancel_time: tx.cancelTime ? Number(tx.cancelTime) : 0,
    transaction: tx.id.toString(),
    state: tx.state,
    reason: tx.reason ?? null,
    receivers: null,
  }));

  rpcSuccess(res, id, { transactions });
}

// ══════════════════════════════════════════════════════════════
// Yordamchi: PayMe muvaffaqiyatli to'lov haqida Telegram xabar
// ══════════════════════════════════════════════════════════════
async function sendPaymeSuccessNotification(studentId: number, amountSom: number) {
  try {
    const student = await prismaBase.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { fullName: true, telegramChatId: true } } },
    });

    if (!student?.user.telegramChatId) return;

    const bot = (await import('../telegram/bot')).default;
    const formatMoney = (v: number) => v.toLocaleString('uz-UZ') + ' so\'m';

    const msg = `✅ <b>To'lov qabul qilindi!</b>\n\n` +
      `💳 Usul: PayMe (online)\n` +
      `💰 Summa: <b>${formatMoney(amountSom)}</b>\n\n` +
      `Rahmat, ${student.user.fullName}! 🎉`;

    await bot.api.sendMessage(student.user.telegramChatId, msg, { parse_mode: 'HTML' });
  } catch (e) {
    // Telegram xato bo'lsa ham to'lov to'g'ri hisoblanadi
    console.error('⚠️ PayMe success notification xatosi:', e);
  }
}
