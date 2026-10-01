/**
 * Soddalashtirilgan moliya KPI paneli — Admin va Founder dashboardи uchun.
 * 5 karta: Reja · Kirim · Qarzdorlik(+soni) · Xarajatlar · Qoldiq.
 * Har karta bosilса — tegishli ro'yxat (drill-down) chiqadi.
 * Filialга bog'liq (chap selektor / branch store orqali).
 */
import { useState } from 'react';
import { useQuery } from 'react-query';
import { CalendarClock, TrendingUp, AlertCircle, Receipt, Wallet, X, Hourglass } from 'lucide-react';
import api from '../../api/axios';
import { formatMoney as fmt } from '../../utils/format';
import { PAYMENT_METHODS } from '../../utils/constants';
import { useBranchStore } from '../../store/branch.store';

type Drill = 'plan' | 'income' | 'debt' | 'expenses' | null;

export default function FinanceKpis({ month }: { month?: string }) {
  const branchId = useBranchStore(s => s.selectedBranchId);
  const [drill, setDrill] = useState<Drill>(null);

  const { data: o } = useQuery(['finance-overview', branchId ?? 'all', month ?? 'current'],
    () => api.get('/dashboard/finance-overview', { params: { month } }).then(r => r.data?.data), { staleTime: 30_000 });

  const cards = [
    { key: 'plan',     label: 'Reja',        hint: 'Bu oy kutilayotgan', value: o?.plan,    icon: CalendarClock, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', drill: 'plan' as Drill },
    { key: 'income',   label: 'Kirim',       hint: "Hisobga tushgan",    value: o?.income,  icon: TrendingUp,    color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', drill: 'income' as Drill },
    { key: 'monthRem', label: 'Bu oy qoldi', hint: 'Reja − Kirim',       value: o?.monthRemaining, icon: Hourglass, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', drill: null as Drill },
    { key: 'debt',     label: 'Umumiy qarz', hint: `${o?.debtorsCount ?? 0} kishidan (jami)`, value: o?.debt, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', drill: 'debt' as Drill, badge: o?.debtorsCount },
    { key: 'expenses', label: 'Xarajatlar',  hint: 'Bu oy sarflangan',   value: o?.expenses, icon: Receipt,      color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', drill: 'expenses' as Drill },
    { key: 'balance',  label: 'Qoldiq',      hint: 'Kirim − Xarajat',    value: o?.balance, icon: Wallet,       color: (o?.balance ?? 0) >= 0 ? 'text-teal-600' : 'text-red-600', bg: 'bg-teal-50 dark:bg-teal-900/20', drill: null as Drill },
  ];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
        {cards.map(c => {
          const clickable = !!c.drill;
          return (
            <button key={c.key} disabled={!clickable} onClick={() => c.drill && setDrill(c.drill)}
              className={`text-left bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 transition ${clickable ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                  <c.icon className={`w-4 h-4 ${c.color}`} />
                </div>
                {c.badge ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">{c.badge}</span> : null}
              </div>
              <div className={`text-base sm:text-lg font-bold tabular-nums leading-tight truncate ${c.color}`}>{fmt(c.value ?? 0)}</div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate">{c.label} <span className="opacity-60">· {c.hint}</span></div>
            </button>
          );
        })}
      </div>

      {drill && <DrillModal type={drill} month={month} onClose={() => setDrill(null)} />}
    </>
  );
}

// ── Drill-down ro'yxati ──────────────────────────────
function DrillModal({ type, month: monthProp, onClose }: { type: Exclude<Drill, null>; month?: string; onClose: () => void }) {
  const month = monthProp || new Date().toISOString().slice(0, 7);

  const cfg = {
    plan:     { title: 'Reja — kim qancha to\'lashi kerak', fetch: () => api.get('/payments/student-obligations').then(r => r.data?.data ?? []) },
    income:   { title: 'Kirim — bu oygi to\'lovlar',        fetch: () => api.get('/payments', { params: { limit: 200, month } }).then(r => { const d = r.data?.data; return Array.isArray(d) ? d : d?.payments ?? []; }) },
    debt:     { title: 'Qarzdorlar — kim, qaysi filial/guruh', fetch: () => api.get('/payments/debtors-review').then(r => (r.data?.data ?? []).filter((x: any) => Number(x.currentDebt) > 0)) },
    expenses: { title: 'Xarajatlar — nimaga qancha',         fetch: () => api.get('/expenses', { params: { limit: 200, month } }).then(r => { const d = r.data?.data; return Array.isArray(d) ? d : d?.expenses ?? []; }) },
  }[type];

  const { data: rows = [], isLoading } = useQuery(['drill', type, month], cfg.fetch, { staleTime: 20_000 });

  const total = (rows as any[]).reduce((s, r) => s + Number(
    type === 'plan' ? r.monthlyAmount : type === 'debt' ? r.currentDebt : r.amount
  ) || 0, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{cfg.title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="px-5 py-2 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-50 dark:border-gray-700/50 flex justify-between">
          <span>{(rows as any[]).length} ta</span>
          <span className="font-bold text-gray-800 dark:text-gray-100 tabular-nums">Jami: {fmt(total)} so'm</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
          {isLoading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Yuklanmoqda...</div>
          ) : (rows as any[]).length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Ma'lumot yo'q</div>
          ) : (rows as any[]).map((r, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                  {type === 'expenses' ? (r.description || r.category || 'Xarajat') : (r.fullName || r.student?.user?.fullName || r.studentName || '—')}
                </div>
                <div className="text-[11px] text-gray-400 truncate">
                  {type === 'debt' && <>{r.branchName ? `${r.branchName} · ` : ''}{r.groupName || '—'}</>}
                  {type === 'income' && <>{new Date(r.paidAt).toLocaleDateString('uz-UZ')} · {PAYMENT_METHODS[r.paymentMethod] || r.paymentMethod}</>}
                  {type === 'expenses' && <>{r.category || ''}{r.date ? ` · ${new Date(r.date).toLocaleDateString('uz-UZ')}` : ''}</>}
                  {type === 'plan' && <>{r.groupName || r.courseName || ''}</>}
                </div>
              </div>
              <div className={`text-sm font-bold tabular-nums flex-shrink-0 ml-2 ${type === 'debt' ? 'text-red-600' : type === 'expenses' ? 'text-amber-600' : 'text-emerald-600'}`}>
                {fmt(type === 'plan' ? r.monthlyAmount : type === 'debt' ? r.currentDebt : r.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
