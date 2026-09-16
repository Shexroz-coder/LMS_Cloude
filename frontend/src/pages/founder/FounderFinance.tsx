/**
 * Ta'sischi — Moliya (faqat ko'rish).
 * Yagona moliya manbai (/payments/summary) dan.
 */
import { useQuery } from 'react-query';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, Users } from 'lucide-react';
import api from '../../api/axios';

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v || 0));

export default function FounderFinance() {
  const { data: summary, isLoading } = useQuery(
    ['founder-finance'],
    () => api.get('/payments/summary').then(r => r.data?.data),
    { staleTime: 30_000 }
  );

  if (isLoading) return <div className="text-center py-20 text-zinc-400">Yuklanmoqda...</div>;

  const s = summary ?? {};
  const income = s.totalIncome ?? s.monthlyIncome ?? 0;
  const expenses = s.totalExpenses ?? 0;
  const debt = s.totalDebt ?? 0;
  const balance = s.totalBalance ?? 0;
  const net = income - expenses;

  const cards = [
    { label: 'Umumiy tushum', value: income, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Umumiy xarajat', value: expenses, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Sof foyda', value: net, icon: Wallet, color: net >= 0 ? 'text-indigo-600' : 'text-red-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { label: 'Qarzdorlik', value: debt, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Oldindan to\'lovlar', value: balance, icon: Users, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20' },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Moliya</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 p-4">
            <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
              <c.icon className={`w-4.5 h-4.5 ${c.color}`} />
            </div>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">{fmt(c.value)}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{c.label} · so'm</div>
          </div>
        ))}
      </div>
    </div>
  );
}
