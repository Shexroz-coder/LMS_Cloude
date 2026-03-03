import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { format } from 'date-fns';
import {
  Plus, Trash2, X, TrendingUp, TrendingDown,
  Wallet, AlertCircle, Edit2, Calendar, Archive, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '../../api/axios';

// ── Types ──────────────────────────────────────────
interface Payment {
  id: number;
  amount: number;
  paidAt: string;
  paymentMethod: string;
  status: string;
  note?: string;
  student: { user: { fullName: string; phone: string } };
}

interface Expense {
  id: number;
  category: string;
  amount: number;
  date: string;
  description?: string;
  user?: { fullName: string };
}

interface Summary {
  income: number;
  expenses: number;
  profit: number;
  totalDebt: number;
}

interface AllTimeBalance {
  income: number;
  expenses: number;
  balance: number;
  totalDebt: number;
  expenseCount: number;
}

interface SalaryRecord {
  id: number;
  month: string;
  paidSalary: number;
  calculatedSalary: number;
  status: string;
  paidAt?: string;
  teacher: { user: { fullName: string } };
}

// ── Constants ──────────────────────────────────────
const EXPENSE_CATEGORIES = [
  { value: 'SALARY',    label: "Ustoz oyliqlari",    icon: '👨‍🏫', color: 'bg-blue-100 text-blue-700' },
  { value: 'RENT',      label: 'Ijara',               icon: '🏢', color: 'bg-purple-100 text-purple-700' },
  { value: 'UTILITIES', label: "Kommunal",            icon: '💡', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'SUPPLIES',  label: 'Konstovarlar',        icon: '📦', color: 'bg-green-100 text-green-700' },
  { value: 'FURNITURE', label: 'Mebel',               icon: '🪑', color: 'bg-amber-100 text-amber-700' },
  { value: 'MARKETING', label: 'Marketing',           icon: '📢', color: 'bg-pink-100 text-pink-700' },
  { value: 'EQUIPMENT', label: 'Jihozlar',            icon: '🖥️', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'OTHER',     label: 'Boshqa',              icon: '📋', color: 'bg-gray-100 text-gray-700' },
];

const PAYMENT_METHODS: Record<string, string> = {
  CASH: 'Naqd', CARD: 'Karta', TRANSFER: "O'tkazma", ONLINE: 'Online'
};

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";
const catInfo = (val: string) => EXPENSE_CATEGORIES.find(c => c.value === val) || EXPENSE_CATEGORIES[7];

function getMonthOptions() {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })
    });
  }
  return months;
}

// ══════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════
export default function FinancePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'income' | 'expenses' | 'salaries' | 'archive'>('overview');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [archiveMonth, setArchiveMonth] = useState('');
  const [archiveCategory, setArchiveCategory] = useState('');

  const months = getMonthOptions();

  // Barcha vaqt balansi
  const { data: allTime } = useQuery<AllTimeBalance>(
    'finance-all-time',
    () => api.get('/expenses/all-time').then(r => r.data?.data).catch(() => null),
    { refetchInterval: 60_000 }
  );

  // Oylik xulosa
  const { data: summary } = useQuery<Summary>(
    ['finance-summary', selectedMonth],
    () => api.get(`/expenses/summary?month=${selectedMonth}`).then(r => r.data?.data).catch(() => null),
    { placeholderData: { income: 0, expenses: 0, profit: 0, totalDebt: 0 } }
  );

  // Oylik to'lovlar
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>(
    ['payments-month', selectedMonth],
    async () => {
      const r = await api.get('/payments', { params: { limit: 200, month: selectedMonth } });
      const d = r.data?.data;
      return Array.isArray(d) ? d : (d?.payments || []);
    }
  );

  // Oylik xarajatlar
  const { data: expensesMonth = { list: [], total: 0 }, isLoading: expensesLoading } = useQuery(
    ['expenses-month', selectedMonth],
    async () => {
      const r = await api.get('/expenses', { params: { limit: 200, month: selectedMonth } });
      const d = r.data?.data;
      return { list: (d?.expenses || []) as Expense[], total: Number(d?.totalAmount || 0) };
    }
  );

  // Oylik maoshlar tarixi
  const { data: salaryData = { salaries: [], totalPaid: 0 }, isLoading: salariesLoading } = useQuery(
    ['salary-history', selectedMonth],
    () => api.get('/salaries/history', { params: { month: selectedMonth } })
      .then(r => r.data?.data || { salaries: [], totalPaid: 0 })
      .catch(() => ({ salaries: [], totalPaid: 0 }))
  );

  // Live salary calculation for overview
  const { data: salaryCalc } = useQuery(
    ['salaries-calc-finance', selectedMonth],
    () => api.get(`/salaries/calculate?month=${selectedMonth}`)
      .then(r => r.data?.data)
      .catch(() => null),
    { refetchInterval: 60_000 }
  );

  // Arxiv — barcha xarajatlar (filter bilan)
  const { data: archiveResult = { list: [], total: 0, count: 0 }, isLoading: archiveLoading } = useQuery(
    ['expenses-archive', archiveMonth, archiveCategory],
    async () => {
      const params: Record<string, string> = { limit: '500' };
      if (archiveMonth) params.month = archiveMonth;
      if (archiveCategory) params.category = archiveCategory;
      const r = await api.get('/expenses', { params });
      const d = r.data?.data;
      return {
        list: (d?.expenses || []) as Expense[],
        total: Number(d?.totalAmount || 0),
        count: r.data?.meta?.total || d?.expenses?.length || 0
      };
    }
  );

  const deleteMutation = useMutation(
    (id: number) => api.delete(`/expenses/${id}`),
    {
      onSuccess: (_data: unknown) => {
        ['expenses-month', 'expenses-archive', 'finance-summary', 'finance-all-time'].forEach(k => qc.invalidateQueries(k));
        void toast.success("Xarajat o'chirildi");
      }
    }
  );

  const expensesList = expensesMonth.list;
  const monthIncome = summary?.income || 0;
  const monthExpenses = summary?.expenses || 0;
  const monthProfit = summary?.profit || 0;
  const totalDebt = allTime?.totalDebt || summary?.totalDebt || 0;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Barcha vaqt balansi ──────────────────── */}
      {allTime && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Jami daromad',   value: allTime.income,   color: 'text-emerald-700', bg: 'from-emerald-50', border: 'border-emerald-100', icon: TrendingUp },
            { label: 'Jami xarajat',   value: allTime.expenses, color: 'text-red-600',     bg: 'from-red-50',     border: 'border-red-100',     icon: TrendingDown },
            { label: 'Hisob balansi',  value: allTime.balance,  color: allTime.balance >= 0 ? 'text-indigo-700' : 'text-red-700', bg: allTime.balance >= 0 ? 'from-indigo-50' : 'from-red-50', border: allTime.balance >= 0 ? 'border-indigo-100' : 'border-red-200', icon: Wallet },
            { label: 'Umumiy qarz',    value: totalDebt,        color: 'text-amber-700',   bg: 'from-amber-50',   border: 'border-amber-100',   icon: AlertCircle },
          ].map(s => (
            <div key={s.label} className={clsx('card border bg-gradient-to-br to-white', s.bg, s.border)}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <s.icon className={clsx('w-3.5 h-3.5', s.color)} />
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
              <p className={clsx('text-base font-extrabold', s.color)}>{fmt(s.value)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Barcha vaqt</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Header ───────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Moliya</h1>
          <p className="text-sm text-gray-500 mt-0.5">Oylik hisobot · Xarajatlar arxivi</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="text-sm bg-transparent focus:outline-none">
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <button onClick={() => { setEditExpense(null); setShowExpenseModal(true); }}
            className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Xarajat
          </button>
        </div>
      </div>

      {/* ── Oylik summary ────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Oylik daromad', value: monthIncome,   color: 'text-emerald-600', bg: 'bg-emerald-50', icon: TrendingUp },
          { label: 'Oylik xarajat', value: monthExpenses, color: 'text-red-500',     bg: 'bg-red-50',     icon: TrendingDown },
          { label: 'Sof foyda',     value: monthProfit,   color: monthProfit >= 0 ? 'text-indigo-700' : 'text-red-600', bg: monthProfit >= 0 ? 'bg-indigo-50' : 'bg-red-50', icon: Wallet },
          { label: 'Qarzdorlik',    value: totalDebt,     color: 'text-amber-600',   bg: 'bg-amber-50',   icon: AlertCircle },
        ].map(s => (
          <div key={s.label} className="card py-3 flex items-center gap-3">
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', s.bg)}>
              <s.icon className={clsx('w-4 h-4', s.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 truncate">{s.label}</p>
              <p className={clsx('text-sm font-bold truncate', s.color)}>{fmt(s.value)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {[
          { key: 'overview',  label: "Ko'rinish",     accent: 'indigo' },
          { key: 'income',    label: `💳 Kirimlar (${payments.length})`, accent: 'emerald' },
          { key: 'expenses',  label: `💸 Xarajatlar (${expensesList.length})`, accent: 'red' },
          { key: 'salaries',  label: `👨‍🏫 Oyliklar (${salaryData.salaries.length})`, accent: 'blue' },
          { key: 'archive',   label: `📦 Arxiv (${allTime?.expenseCount || 0})`, accent: 'amber' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap',
              tab === t.key
                ? `border-${t.accent}-500 text-${t.accent}-700`
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">

        {/* ── Ehtimoliy xarajatlar (bu oy uchun prognoz) ── */}
        {salaryCalc && (
          <div className="card border border-amber-100 bg-amber-50/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center text-base">🔮</div>
              <div>
                <h3 className="font-bold text-gray-800">
                  {months.find(m => m.value === selectedMonth)?.label} — Ehtimoliy xarajatlar
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  O'quvchilar to'lovlari asosida avtomatik hisoblangan prognoz
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {/* Teacher salaries */}
              <div className="bg-white rounded-xl p-3 border border-amber-100 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 text-base">👨‍🏫</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Ustoz oyliqlari</p>
                  <p className="font-bold text-blue-700">{new Intl.NumberFormat('uz-UZ').format(Math.round(salaryCalc.summary?.totalCalculated || 0))} so'm</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {salaryCalc.summary?.totalTeachers || 0} ustoz ·{' '}
                    {new Intl.NumberFormat('uz-UZ').format(Math.round(salaryCalc.summary?.totalRevenue || 0))} so'm daromaddan
                  </p>
                </div>
              </div>

              {/* Existing recurring expenses */}
              {(() => {
                const recurring = expensesList.filter((e: { category: string }) =>
                  ['RENT', 'UTILITIES'].includes(e.category)
                );
                const rentTotal = expensesList
                  .filter((e: { category: string }) => e.category === 'RENT')
                  .reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
                const utilTotal = expensesList
                  .filter((e: { category: string }) => e.category === 'UTILITIES')
                  .reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);

                return (
                  <>
                    {rentTotal > 0 && (
                      <div className="bg-white rounded-xl p-3 border border-amber-100 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0 text-base">🏢</div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Ijara</p>
                          <p className="font-bold text-purple-700">{new Intl.NumberFormat('uz-UZ').format(Math.round(rentTotal))} so'm</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Bu oy kiritilgan</p>
                        </div>
                      </div>
                    )}
                    {utilTotal > 0 && (
                      <div className="bg-white rounded-xl p-3 border border-amber-100 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0 text-base">💡</div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Kommunal</p>
                          <p className="font-bold text-yellow-700">{new Intl.NumberFormat('uz-UZ').format(Math.round(utilTotal))} so'm</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Bu oy kiritilgan</p>
                        </div>
                      </div>
                    )}
                    {recurring.length === 0 && rentTotal === 0 && (
                      <div className="bg-white rounded-xl p-3 border border-dashed border-gray-200 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 text-base">🏢</div>
                        <div>
                          <p className="text-xs text-gray-400">Ijara / kommunal</p>
                          <p className="text-sm text-gray-300 italic">Kiritilmagan</p>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Per-teacher breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ustozlar bo'yicha</p>
              {(salaryCalc.teachers || []).map((t: {
                teacherId: number;
                teacherName: string;
                totalRevenue: number;
                calculatedSalary: number;
                salaryValue: number;
                salaryType: string;
                totalStudents: number;
                isPaid: boolean;
              }) => (
                <div key={t.teacherId} className="flex items-center justify-between py-2 border-b border-amber-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                      t.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {t.teacherName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{t.teacherName}</p>
                      <p className="text-xs text-gray-400">
                        {t.totalStudents} o'quvchi ·{' '}
                        {t.salaryType === 'PERCENTAGE_FROM_PAYMENT'
                          ? `${t.salaryValue}% × ${new Intl.NumberFormat('uz-UZ').format(Math.round(t.totalRevenue))} so'm`
                          : `${t.salaryValue.toLocaleString()} so'm/soat`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    {t.isPaid && (
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">To'langan</span>
                    )}
                    <p className="font-bold text-blue-700">{new Intl.NumberFormat('uz-UZ').format(Math.round(t.calculatedSalary))} so'm</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Total expected expenses */}
            <div className="mt-3 pt-3 border-t border-amber-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Jami ehtimoliy xarajatlar</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Ustoz oyliqlari + bu oy kiritilgan xarajatlar
                </p>
              </div>
              <div className="text-right">
                <p className="font-black text-xl text-red-600">
                  {new Intl.NumberFormat('uz-UZ').format(
                    Math.round((salaryCalc.summary?.totalCalculated || 0) + monthExpenses)
                  )} so'm
                </p>
                {monthIncome > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Prognoz foyda:{' '}
                    <span className={clsx(
                      'font-semibold',
                      monthIncome - (salaryCalc.summary?.totalCalculated || 0) - monthExpenses >= 0
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    )}>
                      {new Intl.NumberFormat('uz-UZ').format(
                        Math.round(monthIncome - (salaryCalc.summary?.totalCalculated || 0) - monthExpenses)
                      )} so'm
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">📊 Xarajatlar taqsimoti</h3>
            {expensesList.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">Bu oyda xarajat kiritilmagan</p>
                <button onClick={() => { setEditExpense(null); setShowExpenseModal(true); }}
                  className="mt-3 text-xs text-indigo-600 hover:underline flex items-center gap-1 mx-auto">
                  <Plus className="w-3 h-3" /> Xarajat qo'shish
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {EXPENSE_CATEGORIES.filter(c => expensesList.some(e => e.category === c.value)).map(cat => {
                  const amt = expensesList.filter(e => e.category === cat.value).reduce((s, e) => s + Number(e.amount), 0);
                  const pct = monthExpenses > 0 ? Math.round((amt / monthExpenses) * 100) : 0;
                  return (
                    <div key={cat.value}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', cat.color)}>{cat.icon} {cat.label}</span>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-800">{fmt(amt)}</span>
                          <span className="text-xs text-gray-400 ml-1.5">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-indigo-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">💳 So'nggi kirimlar</h3>
            {payments.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Bu oyda to'lov qilinmagan</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {payments.slice(0, 10).map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 flex-shrink-0">
                        {p.student?.user?.fullName?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{p.student?.user?.fullName}</p>
                        <p className="text-xs text-gray-400">
                          {PAYMENT_METHODS[p.paymentMethod] || p.paymentMethod}
                          {p.paidAt ? ` · ${format(new Date(p.paidAt), 'dd.MM')}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">+{fmt(Number(p.amount))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* ── INCOME TAB ───────────────────────────── */}
      {tab === 'income' && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">O'quvchi</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Usul</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Sana</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">Summa</th>
                </tr>
              </thead>
              <tbody>
                {paymentsLoading ? (
                  <tr><td colSpan={4} className="text-center py-10 text-gray-400">Yuklanmoqda...</td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-gray-400">Bu oyda to'lovlar yo'q</td></tr>
                ) : payments.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-800">{p.student?.user?.fullName}</p>
                      <p className="text-xs text-gray-400">{p.student?.user?.phone}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{PAYMENT_METHODS[p.paymentMethod] || p.paymentMethod}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{p.paidAt ? format(new Date(p.paidAt), 'dd.MM.yyyy') : '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-emerald-600">+{fmt(Number(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payments.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center bg-emerald-50">
              <span className="text-sm text-gray-500">{payments.length} ta to'lov</span>
              <span className="font-bold text-emerald-700">Jami: +{fmt(monthIncome)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── EXPENSES TAB ─────────────────────────── */}
      {tab === 'expenses' && (
        <ExpenseTable
          expenses={expensesList}
          loading={expensesLoading}
          totalAmount={expensesMonth.total}
          emptyText="Bu oyda xarajat kiritilmagan"
          onEdit={e => { setEditExpense(e); setShowExpenseModal(true); }}
          onDelete={id => deleteMutation.mutate(id)}
          onAdd={() => { setEditExpense(null); setShowExpenseModal(true); }}
        />
      )}

      {/* ── SALARIES TAB ─────────────────────────── */}
      {tab === 'salaries' && (
        <div className="space-y-3">
          {/* Info banner */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
            <Users className="w-4 h-4 flex-shrink-0" />
            <span>Har bir ustoz oylig'i to'langanda <strong>avtomatik</strong> xarajat sifatida yoziladi va umumiy balansdan ayiriladi.</span>
          </div>
          <div className="card overflow-hidden p-0">
            <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">👨‍🏫 Ustoz oyliqlari</h3>
              <span className="text-xs text-gray-400">{selectedMonth} oyi</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Ustoz</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Oy</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">To'langan sana</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Holat</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">To'langan</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">Hisoblangan</th>
                  </tr>
                </thead>
                <tbody>
                  {salariesLoading ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">Yuklanmoqda...</td></tr>
                  ) : salaryData.salaries.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">Bu oyda oylik to'lanmagan</td></tr>
                  ) : (salaryData.salaries as SalaryRecord[]).map(s => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">
                            {s.teacher.user.fullName.charAt(0)}
                          </div>
                          <p className="text-sm font-medium text-gray-800">{s.teacher.user.fullName}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500">
                        {format(new Date(s.month), 'MMM yyyy')}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500">
                        {s.paidAt ? format(new Date(s.paidAt), 'dd.MM.yyyy') : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={clsx('text-xs font-semibold px-2 py-1 rounded-full',
                          s.status === 'PAID' ? 'bg-emerald-100 text-emerald-700'
                          : s.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-500')}>
                          {s.status === 'PAID' ? "To'langan" : s.status === 'PARTIAL' ? "Qisman" : "Kutilmoqda"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-blue-600">
                        −{fmt(Number(s.paidSalary))}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-gray-500">
                        {fmt(Number(s.calculatedSalary))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {salaryData.salaries.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center bg-blue-50">
                <span className="text-sm text-gray-500">{salaryData.salaries.length} ta ustoz</span>
                <span className="font-bold text-blue-700">Jami: −{fmt(Number(salaryData.totalPaid))}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ARCHIVE TAB ──────────────────────────── */}
      {tab === 'archive' && (
        <div className="space-y-3">
          <div className="card py-3 flex flex-wrap items-center gap-3">
            <Archive className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">Filtr:</span>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <select value={archiveMonth} onChange={e => setArchiveMonth(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
                <option value="">Barcha oylar</option>
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <select value={archiveCategory} onChange={e => setArchiveCategory(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
              <option value="">Barcha kategoriyalar</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
            {(archiveMonth || archiveCategory) && (
              <button onClick={() => { setArchiveMonth(''); setArchiveCategory(''); }}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100">✕ Tozalash</button>
            )}
            <span className="ml-auto text-xs text-gray-400">
              {archiveResult.count} yozuv · {fmt(archiveResult.total)}
            </span>
          </div>
          <ExpenseTable
            expenses={archiveResult.list}
            loading={archiveLoading}
            totalAmount={archiveResult.total}
            emptyText="Hali hech qanday xarajat kiritilmagan"
            showMonth
            onEdit={e => { setEditExpense(e); setShowExpenseModal(true); }}
            onDelete={id => deleteMutation.mutate(id)}
            onAdd={() => { setEditExpense(null); setShowExpenseModal(true); }}
          />
        </div>
      )}

      {/* ── Modal ────────────────────────────────── */}
      {showExpenseModal && (
        <ExpenseModal
          expense={editExpense}
          onClose={() => { setShowExpenseModal(false); setEditExpense(null); }}
          onSuccess={() => {
            setShowExpenseModal(false);
            setEditExpense(null);
            ['expenses-month', 'expenses-archive', 'finance-summary', 'finance-all-time'].forEach(k => qc.invalidateQueries(k));
          }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
// EXPENSE TABLE
// ══════════════════════════════════════════════════
function ExpenseTable({ expenses, loading, totalAmount, emptyText, showMonth = false, onEdit, onDelete, onAdd }: {
  expenses: Expense[];
  loading: boolean;
  totalAmount: number;
  emptyText: string;
  showMonth?: boolean;
  onEdit: (e: Expense) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Kategoriya</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Izoh</th>
              {showMonth && <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Oy</th>}
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Sana</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3 hidden md:table-cell">Kiritdi</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">Summa</th>
              <th className="w-16 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={showMonth ? 7 : 6} className="text-center py-10 text-gray-400">Yuklanmoqda...</td></tr>
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={showMonth ? 7 : 6} className="text-center py-12">
                  <p className="text-gray-400 text-sm mb-3">{emptyText}</p>
                  <button onClick={onAdd}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline">
                    <Plus className="w-3 h-3" /> Xarajat qo'shish
                  </button>
                </td>
              </tr>
            ) : (
              expenses.map(e => {
                const cat = catInfo(e.category);
                return (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                    <td className="px-5 py-3">
                      <span className={clsx('text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap', cat.color)}>
                        {cat.icon} {cat.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 max-w-[180px] truncate">
                      {e.description || <span className="text-gray-300">—</span>}
                    </td>
                    {showMonth && (
                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {format(new Date(e.date), 'MMM yyyy')}
                      </td>
                    )}
                    <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {format(new Date(e.date), 'dd.MM.yyyy')}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400 hidden md:table-cell">
                      {e.user?.fullName || '—'}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <span className="font-bold text-red-500">−{fmt(Number(e.amount))}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={() => onEdit(e)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-indigo-600">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDelete(e.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {expenses.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center bg-red-50">
          <span className="text-sm text-gray-500">{expenses.length} ta xarajat</span>
          <span className="font-bold text-red-600">Jami: −{fmt(totalAmount)}</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
// EXPENSE MODAL
// ══════════════════════════════════════════════════
function ExpenseModal({ expense, onClose, onSuccess }: {
  expense: Expense | null; onClose: () => void; onSuccess: () => void;
}) {
  const isEdit = !!expense;
  const [form, setForm] = useState({
    category: expense?.category || 'OTHER',
    amount: expense?.amount?.toString() || '',
    date: expense?.date ? format(new Date(expense.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    description: expense?.description || '',
  });
  const [loading, setLoading] = useState(false);
  const cat = catInfo(form.category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.date) { toast.error('Summa va sana kiritilishi shart'); return; }
    if (parseFloat(form.amount) <= 0) { toast.error("Summa 0 dan katta bo'lishi kerak"); return; }
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/expenses/${expense!.id}`, form);
        toast.success('Xarajat yangilandi!');
      } else {
        await api.post('/expenses', form);
        toast.success('Xarajat arxivga saqlandi! ✅');
      }
      onSuccess();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xato yuz berdi');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-rose-500 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg">{isEdit ? '✏️ Xarajatni tahrirlash' : "➕ Xarajat qo'shish"}</h2>
              <p className="text-xs text-white/80 mt-0.5">Arxivga doimiy saqlanadi</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Category grid */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Kategoriya</label>
            <div className="grid grid-cols-4 gap-1.5">
              {EXPENSE_CATEGORIES.map(c => (
                <button key={c.value} type="button"
                  onClick={() => setForm(f => ({ ...f, category: c.value }))}
                  className={clsx('flex flex-col items-center gap-1 p-2 rounded-xl border-2 text-center transition-all',
                    form.category === c.value
                      ? 'border-red-400 bg-red-50 shadow-sm scale-105'
                      : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                  )}>
                  <span className="text-lg leading-none">{c.icon}</span>
                  <span className="text-[10px] font-medium text-gray-600 leading-tight">{c.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            <div className={clsx('mt-2 text-center text-xs font-semibold px-3 py-1 rounded-full mx-auto w-fit', cat.color)}>
              {cat.icon} {cat.label} tanlandi
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Summa (so'm) *</label>
            <input type="number" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-red-400 text-center"
              placeholder="0" min="1" step="1000" required />
            {form.amount && parseFloat(form.amount) > 0 && (
              <p className="text-center text-xs text-gray-400 mt-1">{fmt(parseFloat(form.amount))}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Sana *</label>
            <input type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400" required />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Izoh</label>
            <input type="text" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="Masalan: Fevral oyi ijarasi..." />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Bekor</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50">
              {loading ? 'Saqlanmoqda...' : isEdit ? '💾 Saqlash' : '📦 Qo\'shish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
