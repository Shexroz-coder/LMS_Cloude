/**
 * finance.service.ts — YAGONA MOLIYA HISOBLASH MARKAZI
 *
 * Barcha sahifalar (Dashboard, Moliya, To'lovlar, Eslatmalar, Billing)
 * qarz/tushum/xarajatni FAQAT SHU YERDAN oladi.
 *
 * TA'RIFLAR (single source of truth):
 *  - Umumiy qarz   = FAOL (ACTIVE) o'quvchilarning StudentBalance.debt yig'indisi
 *  - Umumiy balans = FAOL o'quvchilarning StudentBalance.balance yig'indisi
 *  - Tushum        = o'chirilmagan (isDeleted=false) to'lovlar yig'indisi
 *  - Xarajat       = Expense jadvali yig'indisi
 */
import prisma from '../lib/prisma';

export interface FinanceTotals {
  /** Faol o'quvchilar umumiy qarzi */
  totalDebt: number;
  /** Faol o'quvchilar umumiy balansi (oldindan to'lovlar) */
  totalBalance: number;
  /** Faol bo'lmagan (ketgan) o'quvchilarda qolgan qarz — ma'lumot uchun */
  inactiveDebt: number;
  /** Qarzdor faol o'quvchilar soni */
  debtorCount: number;
}

/**
 * Umumiy qarz/balans — hamma sahifa uchun BIR XIL qiymat.
 * @param branchId ixtiyoriy — faqat shu filial o'quvchilari (undefined = barcha filiallar)
 */
export async function getFinanceTotals(branchId?: number): Promise<FinanceTotals> {
  const branchFilter = branchId ? { branchId } : {};
  const [activeAgg, allAgg, debtorCount] = await Promise.all([
    // Faol o'quvchilar (status ACTIVE + user faol)
    prisma.studentBalance.aggregate({
      where: {
        student: { status: 'ACTIVE', user: { isActive: true }, ...branchFilter },
      } as any,
      _sum: { debt: true, balance: true },
    }),
    // Barcha o'quvchilar (ketganlar bilan) — filial bo'yicha
    prisma.studentBalance.aggregate({
      where: (branchId ? { student: { branchId } } : {}) as any,
      _sum: { debt: true },
    }),
    prisma.studentBalance.count({
      where: {
        debt: { gt: 0 },
        student: { status: 'ACTIVE', user: { isActive: true }, ...branchFilter },
      } as any,
    }),
  ]);

  const totalDebt = Math.round(Number(activeAgg._sum?.debt || 0));
  const allDebt = Math.round(Number(allAgg._sum?.debt || 0));

  return {
    totalDebt,
    totalBalance: Math.round(Number(activeAgg._sum?.balance || 0)),
    inactiveDebt: Math.max(0, allDebt - totalDebt),
    debtorCount,
  };
}

/**
 * Tushum (income) — o'chirilmagan to'lovlar.
 * @param from ixtiyoriy davr boshi
 * @param to   ixtiyoriy davr oxiri
 */
export async function getTotalIncome(from?: Date, to?: Date, branchId?: number): Promise<number> {
  const agg = await prisma.payment.aggregate({
    where: {
      isDeleted: false,
      ...(branchId ? { student: { branchId } } : {}),
      ...(from || to
        ? { paidAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }
        : {}),
    } as any,
    _sum: { amount: true },
  });
  return Math.round(Number(agg._sum?.amount || 0));
}

/**
 * Xarajat (expenses).
 */
export async function getTotalExpenses(from?: Date, to?: Date, branchId?: number): Promise<number> {
  const agg = await prisma.expense.aggregate({
    where: {
      ...(branchId ? { branchId } : {}),
      ...(from || to
        ? { date: { ...(from && { gte: from }), ...(to && { lte: to }) } }
        : {}),
    } as any,
    _sum: { amount: true },
  });
  return Math.round(Number(agg._sum?.amount || 0));
}
