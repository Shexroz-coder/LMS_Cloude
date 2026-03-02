import { Request, Response } from 'express';
import prismaBase from '../lib/prisma';

// NOTE: PaymeTransaction modeli schema.prisma ga qo'shilgan.
// Prisma clientni yangilash uchun: npx prisma migrate dev && npx prisma generate
// Agar TypeScript xatolik berse, avval yuqoridagi buyruqni ishga tushiring.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = prismaBase as any;

// ══════════════════════════════════════════════════════════════
// PayMe Subscribe API — JSON-RPC 2.0 Webhook Controller
// Doc: https://developer.help.paycom.uz/ru/metody-subscribe-api
// ══════════════════════════════════════════════════════════════

// PayMe xatolik kodlari
const ERRORS = {
  PARSE_ERROR:       { code: -32700, message: { ru: 'Could not parse JSON', uz: 'JSON tahlil qilib bo\'lmadi', en: 'Could not parse JSON' } },
  INVALID_REQUEST:   { code: -32600, message: { ru: 'Invalid request', uz: 'Noto\'g\'ri so\'rov', en: 'Invalid request' } },
  METHOD_NOT_FOUND:  { code: -32601, message: { ru: 'Method not found', uz: 'Metod topilmadi', en: 'Method not found' } },
  AUTH_FAILURE:      { code: -32504, message: { ru: 'Authorization failure', uz: 'Avtorizatsiya muvaffaqiyatsiz', en: 'Authorization failure' } },
  ORDER_NOT_FOUND:   { code: -31050, message: { ru: 'Order not found', uz: 'Buyurtma topilmadi', en: 'Order not found' } },
  WRONG_AMOUNT:      { code: -31001, message: { ru: 'Wrong amount', uz: 'Noto\'g\'ri summa', en: 'Wrong amount' } },
  TX_NOT_FOUND:      { code: -31003, message: { ru: 'Transaction not found', uz: 'Tranzaksiya topilmadi', en: 'Transaction not found' } },
  TX_CANCELLED:      { code: -31007, message: { ru: 'Transaction cancelled', uz: 'Tranzaksiya bekor qilingan', en: 'Transaction cancelled' } },
  TX_ALREADY_DONE:   { code: -31060, message: { ru: 'Transaction already performed', uz: 'Tranzaksiya allaqachon bajarilgan', en: 'Transaction already performed' } },
  CANT_CANCEL:       { code: -31007, message: { ru: 'Cannot cancel performed transaction', uz: 'Bajarilgan tranzaksiyani bekor qilib bo\'lmaydi', en: 'Cannot cancel performed transaction' } },
  SYSTEM_ERROR:      { code: -31008, message: { ru: 'System error', uz: 'Tizim xatosi', en: 'System error' } },
};

// PayMe holatlar: state
// 1  = Yaratildi (created)
// 2  = Bajarildi (performed)
// -1 = Bekor qilindi (yaratilgandan keyin)
// -2 = Bekor qilindi (bajarilgandan keyin)

// ── Auth tekshiruvi ────────────────────────────────────────────
function checkAuth(req: Request): boolean {
  const key = process.env.PAYME_KEY || '';
  const expected = 'Basic ' + Buffer.from(`Paycom:${key}`).toString('base64');
  return req.headers['authorization'] === expected;
}

// ── orderId formatini parse qilish ─────────────────────────────
// Format: LMS-{studentId}-{amountTiyin}-{monthYYYYMM}-{timestamp}
// Misol: LMS-42-150000-202603-1740912345678
function parseOrderId(orderId: string): { studentId: number; amountTiyin: number; month: Date } | null {
  try {
    const parts = orderId.split('-');
    if (parts.length < 5 || parts[0] !== 'LMS') return null;
    const studentId  = parseInt(parts[1]);
    const amountTiyin = parseInt(parts[2]);
    const monthStr   = parts[3]; // "202603"
    const year  = parseInt(monthStr.substring(0, 4));
    const month = parseInt(monthStr.substring(4, 6)) - 1; // 0-indexed
    const monthDate = new Date(Date.UTC(year, month, 1));
    if (isNaN(studentId) || isNaN(amountTiyin) || isNaN(year)) return null;
    return { studentId, amountTiyin, month: monthDate };
  } catch {
    return null;
  }
}

// ── JSON-RPC javob yuborish ────────────────────────────────────
function rpcResult(res: Response, id: string | number | null, result: object) {
  res.json({ jsonrpc: '2.0', id, result });
}

function rpcError(res: Response, id: string | number | null, error: typeof ERRORS[keyof typeof ERRORS]) {
  res.json({ jsonrpc: '2.0', id, error });
}

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER — POST /payme/webhook
// ══════════════════════════════════════════════════════════════
export const paymeWebhook = async (req: Request, res: Response): Promise<void> => {
  // 1. Auth tekshiruv
  if (!checkAuth(req)) {
    rpcError(res, null, ERRORS.AUTH_FAILURE);
    return;
  }

  const { id, method, params } = req.body;

  if (!method) {
    rpcError(res, id ?? null, ERRORS.INVALID_REQUEST);
    return;
  }

  try {
    switch (method) {
      case 'CheckPerformTransaction':
        await checkPerformTransaction(res, id, params);
        break;
      case 'CreateTransaction':
        await createTransaction(res, id, params);
        break;
      case 'PerformTransaction':
        await performTransaction(res, id, params);
        break;
      case 'CancelTransaction':
        await cancelTransaction(res, id, params);
        break;
      case 'CheckTransaction':
        await checkTransaction(res, id, params);
        break;
      case 'GetStatement':
        await getStatement(res, id, params);
        break;
      default:
        rpcError(res, id, ERRORS.METHOD_NOT_FOUND);
    }
  } catch (err) {
    console.error(`PayMe [${method}] error:`, err);
    rpcError(res, id ?? null, ERRORS.SYSTEM_ERROR);
  }
};

// ══════════════════════════════════════════════════════════════
// 1. CheckPerformTransaction
//    To'lovni bajarish mumkinligini tekshirish
// ══════════════════════════════════════════════════════════════
async function checkPerformTransaction(
  res: Response,
  id: string | number,
  params: { amount: number; account: { order_id: string } }
) {
  const orderId  = params?.account?.order_id;
  const amount   = params?.amount; // tiyin

  if (!orderId) {
    rpcError(res, id, ERRORS.ORDER_NOT_FOUND);
    return;
  }

  const parsed = parseOrderId(orderId);
  if (!parsed) {
    rpcError(res, id, ERRORS.ORDER_NOT_FOUND);
    return;
  }

  // O'quvchi mavjudligini tekshirish
  const student = await prisma.student.findUnique({
    where: { id: parsed.studentId },
    include: { user: { select: { isActive: true } } },
  });
  if (!student || !student.user.isActive) {
    rpcError(res, id, ERRORS.ORDER_NOT_FOUND);
    return;
  }

  // Summa mos kelishini tekshirish (±1 tiyin farq ruxsat)
  if (Math.abs(amount - parsed.amountTiyin) > 1) {
    rpcError(res, id, ERRORS.WRONG_AMOUNT);
    return;
  }

  rpcResult(res, id, { allow: true });
}

// ══════════════════════════════════════════════════════════════
// 2. CreateTransaction
//    PayMe tranzaksiya yaratildi (foydalanuvchi to'lov sahifasida)
// ══════════════════════════════════════════════════════════════
async function createTransaction(
  res: Response,
  id: string | number,
  params: {
    id: string;
    time: number;
    amount: number;
    account: { order_id: string };
  }
) {
  const paymeId  = params?.id;
  const orderId  = params?.account?.order_id;
  const amount   = params?.amount;
  const createTime = params?.time;

  if (!orderId || !paymeId) {
    rpcError(res, id, ERRORS.ORDER_NOT_FOUND);
    return;
  }

  // Mavjud tranzaksiyani tekshirish
  const existing = await prisma.paymeTransaction.findUnique({
    where: { paymeId },
  });

  if (existing) {
    // Agar allaqachon mavjud bo'lsa — state qaytarish
    if (existing.state === -1 || existing.state === -2) {
      rpcError(res, id, ERRORS.TX_CANCELLED);
      return;
    }
    // Mavjud tranzaksiya qaytarish
    rpcResult(res, id, {
      create_time: Number(existing.createTime),
      transaction:  existing.id.toString(),
      state:        existing.state,
    });
    return;
  }

  // orderId ni parse qilish
  const parsed = parseOrderId(orderId);
  if (!parsed) {
    rpcError(res, id, ERRORS.ORDER_NOT_FOUND);
    return;
  }

  // O'quvchi mavjudligini tekshirish
  const student = await prisma.student.findUnique({
    where: { id: parsed.studentId },
    include: { user: { select: { isActive: true } } },
  });
  if (!student || !student.user.isActive) {
    rpcError(res, id, ERRORS.ORDER_NOT_FOUND);
    return;
  }

  // Summa tekshiruv
  if (Math.abs(amount - parsed.amountTiyin) > 1) {
    rpcError(res, id, ERRORS.WRONG_AMOUNT);
    return;
  }

  // PaymeTransaction yaratish (state=1)
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

  rpcResult(res, id, {
    create_time: Number(tx.createTime),
    transaction:  tx.id.toString(),
    state:        tx.state,
  });
}

// ══════════════════════════════════════════════════════════════
// 3. PerformTransaction
//    Foydalanuvchi to'lovni amalga oshirdi → Payment yozuv yaratish
// ══════════════════════════════════════════════════════════════
async function performTransaction(
  res: Response,
  id: string | number,
  params: { id: string; time?: number }
) {
  const paymeId     = params?.id;
  const performTime = params?.time ?? Date.now();

  const tx = await prisma.paymeTransaction.findUnique({ where: { paymeId } });
  if (!tx) {
    rpcError(res, id, ERRORS.TX_NOT_FOUND);
    return;
  }

  // Agar allaqachon bajarilgan bo'lsa
  if (tx.state === 2) {
    rpcResult(res, id, {
      perform_time: Number(tx.performTime),
      transaction:  tx.id.toString(),
      state:        tx.state,
    });
    return;
  }

  // Agar bekor qilingan bo'lsa
  if (tx.state === -1 || tx.state === -2) {
    rpcError(res, id, ERRORS.TX_CANCELLED);
    return;
  }

  // orderId ni parse qilish
  const parsed = parseOrderId(tx.orderId);
  if (!parsed) {
    rpcError(res, id, ERRORS.SYSTEM_ERROR);
    return;
  }

  const amountSom = tx.amount / 100; // tiyin → so'm

  // Tranzaksiya va Payment birgalikda
  const result = await prisma.$transaction(async (trx: any) => {
    // Payment yozuv yaratish
    const payment = await trx.payment.create({
      data: {
        studentId:    tx.studentId,
        amount:       amountSom,
        month:        parsed.month,
        paymentMethod: 'ONLINE',
        status:       'PAID',
        paidAt:       new Date(performTime),
        provider:     'PAYME',
        providerOrderId: tx.orderId,
        transactionId:  paymeId,
        note:          'PayMe orqali to\'lov',
      },
    });

    // Studentni balansini yangilash — avval qarzni to'lash, keyin balans
    const balRec = await trx.studentBalance.findUnique({ where: { studentId: tx.studentId } });
    let newDebt    = Number(balRec?.debt    ?? 0);
    let newBalance = Number(balRec?.balance ?? 0);

    if (newDebt > 0) {
      const debtPaid = Math.min(amountSom, newDebt);
      newDebt        = newDebt - debtPaid;
      newBalance     = newBalance + (amountSom - debtPaid);
    } else {
      newBalance = newBalance + amountSom;
    }

    await trx.studentBalance.upsert({
      where:  { studentId: tx.studentId },
      update: { balance: newBalance, debt: newDebt, lastUpdated: new Date() },
      create: { studentId: tx.studentId, balance: newBalance, debt: 0 },
    });

    // PaymeTransaction yangilash
    const updated = await trx.paymeTransaction.update({
      where: { id: tx.id },
      data: {
        state:       2,
        performTime: BigInt(performTime),
        paymentId:   payment.id,
      },
    });

    return updated;
  });

  rpcResult(res, id, {
    perform_time: Number(result.performTime),
    transaction:  result.id.toString(),
    state:        result.state,
  });
}

// ══════════════════════════════════════════════════════════════
// 4. CancelTransaction
//    To'lovni bekor qilish
// ══════════════════════════════════════════════════════════════
async function cancelTransaction(
  res: Response,
  id: string | number,
  params: { id: string; time?: number; reason?: number }
) {
  const paymeId    = params?.id;
  const cancelTime = params?.time ?? Date.now();
  const reason     = params?.reason ?? 0;

  const tx = await prisma.paymeTransaction.findUnique({ where: { paymeId } });
  if (!tx) {
    rpcError(res, id, ERRORS.TX_NOT_FOUND);
    return;
  }

  // Agar allaqachon bekor qilingan bo'lsa
  if (tx.state === -1 || tx.state === -2) {
    rpcResult(res, id, {
      cancel_time: Number(tx.cancelTime),
      transaction:  tx.id.toString(),
      state:        tx.state,
    });
    return;
  }

  let newState: number;

  if (tx.state === 2) {
    // Bajarilgan tranzaksiyani bekor qilish (state=-2)
    // Shuningdek Payment yozuvini ham bekor qilish va balansi qaytarish
    newState = -2;

    await prisma.$transaction(async (trx: any) => {
      // Payment ni PENDING ga o'tkazish (bekor qilingan deb belgilash)
      if (tx.paymentId) {
        const payment = await trx.payment.findUnique({ where: { id: tx.paymentId } });
        if (payment) {
          await trx.payment.delete({ where: { id: tx.paymentId } });

          // Balansni qaytarish
          const amountSom = Number(payment.amount);
          const balRec = await trx.studentBalance.findUnique({ where: { studentId: tx.studentId } });
          if (balRec) {
            let newBalance = Number(balRec.balance) - amountSom;
            let newDebt = Number(balRec.debt);
            if (newBalance < 0) {
              newDebt = newDebt - newBalance; // qarzga qo'shiladi
              newBalance = 0;
            }
            await trx.studentBalance.update({
              where: { studentId: tx.studentId },
              data: { balance: newBalance, debt: newDebt, lastUpdated: new Date() },
            });
          }
        }
      }

      // PaymeTransaction yangilash
      await trx.paymeTransaction.update({
        where: { id: tx.id },
        data: {
          state:      newState,
          cancelTime: BigInt(cancelTime),
          reason,
          paymentId:  null,
        },
      });
    });
  } else {
    // Bajarilmagan tranzaksiyani bekor qilish (state=-1)
    newState = -1;
    await prisma.paymeTransaction.update({
      where: { id: tx.id },
      data: {
        state:      newState,
        cancelTime: BigInt(cancelTime),
        reason,
      },
    });
  }

  const updated = await prisma.paymeTransaction.findUnique({ where: { id: tx.id } });
  rpcResult(res, id, {
    cancel_time: Number(updated!.cancelTime),
    transaction:  updated!.id.toString(),
    state:        updated!.state,
  });
}

// ══════════════════════════════════════════════════════════════
// 5. CheckTransaction
//    Tranzaksiya holatini tekshirish
// ══════════════════════════════════════════════════════════════
async function checkTransaction(
  res: Response,
  id: string | number,
  params: { id: string }
) {
  const paymeId = params?.id;
  const tx = await prisma.paymeTransaction.findUnique({ where: { paymeId } });

  if (!tx) {
    rpcError(res, id, ERRORS.TX_NOT_FOUND);
    return;
  }

  rpcResult(res, id, {
    create_time:  Number(tx.createTime),
    perform_time: tx.performTime ? Number(tx.performTime) : 0,
    cancel_time:  tx.cancelTime  ? Number(tx.cancelTime)  : 0,
    transaction:  tx.id.toString(),
    state:        tx.state,
    reason:       tx.reason ?? null,
  });
}

// ══════════════════════════════════════════════════════════════
// 6. GetStatement
//    Davr ichidagi tranzaksiyalar ro'yxati
// ══════════════════════════════════════════════════════════════
async function getStatement(
  res: Response,
  id: string | number,
  params: { from: number; to: number }
) {
  const from = BigInt(params?.from ?? 0);
  const to   = BigInt(params?.to ?? Date.now());

  const txs = await prisma.paymeTransaction.findMany({
    where: {
      createTime: { gte: from, lte: to },
    },
    orderBy: { createTime: 'asc' },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactions = txs.map((tx: any) => ({
    id:           tx.paymeId,
    time:         Number(tx.createTime),
    amount:       tx.amount,
    account:      { order_id: tx.orderId },
    create_time:  Number(tx.createTime),
    perform_time: tx.performTime ? Number(tx.performTime) : 0,
    cancel_time:  tx.cancelTime  ? Number(tx.cancelTime)  : 0,
    transaction:  tx.id.toString(),
    state:        tx.state,
    reason:       tx.reason ?? null,
    receivers:    null,
  }));

  rpcResult(res, id, { transactions });
}
