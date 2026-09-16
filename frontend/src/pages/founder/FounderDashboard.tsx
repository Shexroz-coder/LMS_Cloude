/**
 * Ta'sischi (Founder) dashboardi — faqat asosiy ko'rsatkichlar.
 * Mobil-birinchi, ixcham karta ko'rinishi. Tahrirlash yo'q — faqat kuzatish.
 */
import { useQuery } from 'react-query';
import {
  Users, TrendingUp, TrendingDown, AlertCircle, CreditCard,
  BookOpen, CheckCircle2, Wallet,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v || 0));

export default function FounderDashboard() {
  const { user } = useAuthStore();

  const { data: stats } = useQuery(
    ['founder-stats'],
    () => api.get('/dashboard/stats').then(r => r.data?.data),
    { staleTime: 30_000 }
  );

  const { data: chart = [] } = useQuery(
    ['founder-income-chart'],
    () => api.get('/dashboard/income-chart').then(r => r.data?.data ?? []),
    { staleTime: 60_000 }
  );

  const cards = [
    { label: 'Oylik tushum', value: fmt(stats?.monthlyIncome ?? 0), unit: "so'm", icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Umumiy qarz', value: fmt(stats?.totalDebt ?? 0), unit: "so'm", icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Sof foyda', value: fmt(stats?.netProfit ?? 0), unit: "so'm", icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { label: "O'quvchilar", value: String(stats?.studentsCount ?? 0), unit: 'ta', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Davomat', value: String(stats?.attendanceRate ?? 0), unit: '%', icon: CheckCircle2, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20' },
    { label: 'Faol guruhlar', value: String(stats?.activeGroups ?? 0), unit: 'ta', icon: BookOpen, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Assalomu alaykum, {user?.fullName?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">Biznesning asosiy ko'rsatkichlari</p>
      </div>

      {/* Ko'rsatkich kartalari */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {cards.map(c => (
          <div key={c.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 p-4">
            <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
              <c.icon className={`w-4.5 h-4.5 ${c.color}`} />
            </div>
            <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight">{c.value}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{c.label} <span className="opacity-60">{c.unit}</span></div>
          </div>
        ))}
      </div>

      {/* Tushum grafigi */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-500" /> Oylik tushum dinamikasi
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
              <XAxis dataKey="month" fontSize={11} stroke="#9ca3af" />
              <YAxis fontSize={11} stroke="#9ca3af" tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => fmt(v) + " so'm"} />
              <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="url(#inc)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Qarzdorlar ogohlantirishi */}
      {(stats?.totalDebt ?? 0) > 0 && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">
            Jami qarzdorlik: <b>{fmt(stats.totalDebt)} so'm</b>. Batafsil "Moliya" bo'limida.
          </p>
        </div>
      )}
    </div>
  );
}
