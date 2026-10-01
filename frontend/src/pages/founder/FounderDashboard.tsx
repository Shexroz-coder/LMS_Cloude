/**
 * Ta'sischi (Founder) dashboardi — filialга bog'liq, mobil-birinchi, sodda.
 * Chap tarafдаги filial selektorига qarab hamma ko'rsatkichlar avtomatik yangilanadi.
 */
import { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, TrendingUp, TrendingDown, AlertCircle, CreditCard,
  BookOpen, CheckCircle2, Wallet, GraduationCap, ChevronDown, Building2,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import { useBranchStore } from '../../store/branch.store';
import { formatMoney as fmt, fmtShort } from '../../utils/format';
import FinanceKpis from '../../components/ui/FinanceKpis';
import MonthTabs, { currentMonth } from '../../components/ui/MonthTabs';

export default function FounderDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const selectedBranchId = useBranchStore(s => s.selectedBranchId);
  const [teachersOpen, setTeachersOpen] = useState(false);
  const [month, setMonth] = useState(currentMonth());

  // Barcha so'rovlar selectedBranchId'ga bog'liq — filial o'zgarганда qayta yuklanadi.
  const bKey = selectedBranchId ?? 'all';

  const { data: stats } = useQuery(['founder-stats', bKey],
    () => api.get('/dashboard/stats').then(r => r.data?.data), { staleTime: 30_000 });

  const { data: chart = [] } = useQuery(['founder-income-chart', bKey],
    () => api.get('/dashboard/income-chart').then(r => r.data?.data ?? []), { staleTime: 60_000 });

  const { data: overview } = useQuery(['founder-overview', bKey],
    () => api.get('/founder/overview', { params: { branchId: selectedBranchId ?? undefined } }).then(r => r.data?.data), { staleTime: 60_000 });

  const { data: comparison } = useQuery(['founder-branches'],
    () => api.get('/dashboard/branches-comparison').then(r => r.data?.data),
    { staleTime: 60_000, enabled: selectedBranchId == null });

  const { data: branches = [] } = useQuery<any[]>(['branches'],
    () => api.get('/branches').then(r => r.data?.data ?? []).catch(() => []));

  const branchName = selectedBranchId == null
    ? 'Barcha filiallar'
    : (branches.find((b: any) => b.id === selectedBranchId)?.name || 'Filial');

  const countCards = [
    { label: 'Faol o\'quvchilar', value: overview?.totals?.studentsCount ?? stats?.studentsCount ?? 0, unit: 'ta', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Guruhlar', value: overview?.totals?.groupsCount ?? stats?.activeGroups ?? 0, unit: 'ta', icon: BookOpen, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    { label: "O'qituvchilar", value: overview?.totals?.teachersCount ?? 0, unit: 'ta', icon: GraduationCap, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20' },
    { label: 'Davomat', value: stats?.attendanceRate ?? 0, unit: '%', icon: CheckCircle2, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20' },
  ];

  const branchRows: any[] = comparison?.branches ?? [];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Assalomu alaykum, {user?.fullName?.split(' ')[0]} 👋
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" /> {branchName}
          </p>
        </div>
      </div>

      {/* Oylar + Moliya KPI (tanlangan oy bo'yicha) */}
      <div className="mb-3 space-y-3">
        <MonthTabs value={month} onChange={setMonth} />
        <FinanceKpis month={month} />
      </div>

      {/* Sanoq ko'rsatkichlari */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        {countCards.map(c => (
          <div key={c.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-none tabular-nums">{c.value}<span className="text-xs font-medium text-zinc-400 ml-1">{c.unit}</span></div>
              <div className="text-[10px] sm:text-xs text-zinc-400 mt-1 truncate">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* O'qituvchilar — dars soatlari (ochib ko'rish) */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 mb-4 overflow-hidden">
        <button onClick={() => setTeachersOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            <GraduationCap className="w-4 h-4 text-fuchsia-500" />
            O'qituvchilar — dars soatlari
            {overview?.hours?.month != null && (
              <span className="text-xs font-normal text-zinc-400">(bu oy: {overview.hours.month} soat)</span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${teachersOpen ? 'rotate-180' : ''}`} />
        </button>
        {teachersOpen && (
          <div className="border-t border-zinc-100 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-zinc-400 bg-zinc-50 dark:bg-gray-900/40">
                  <th className="text-left px-4 py-2 font-medium">O'qituvchi</th>
                  <th className="text-center px-3 py-2 font-medium">Guruh</th>
                  <th className="text-center px-3 py-2 font-medium">Bu oy soat</th>
                  <th className="text-center px-3 py-2 font-medium">Jami soat</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.teachers ?? []).map((t: any) => (
                  <tr key={t.id} className="border-t border-zinc-50 dark:border-gray-700/50">
                    <td className="px-4 py-2 text-zinc-800 dark:text-zinc-100">{t.name}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{t.groupsCount}</td>
                    <td className="px-3 py-2 text-center tabular-nums font-semibold text-fuchsia-600 dark:text-fuchsia-400">{t.monthHours}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-zinc-500">{t.totalHours}</td>
                  </tr>
                ))}
                {(!overview?.teachers || overview.teachers.length === 0) && (
                  <tr><td colSpan={4} className="text-center text-zinc-400 py-4 text-xs">Ma'lumot yo'q</td></tr>
                )}
              </tbody>
            </table>
            <p className="text-[11px] text-zinc-400 px-4 py-2">Soatlar "o'tilgan" (COMPLETED) darslar bo'yicha. Bu oy = joriy oy (masalan 1–30 sentabr).</p>
          </div>
        )}
      </div>

      {/* Filiallar bo'yicha kirim — faqat "Barcha filiallar" tanlanганда */}
      {selectedBranchId == null && branchRows.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 p-4 mb-4">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" /> Filiallar bo'yicha
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {branchRows.map((b: any) => (
              <button key={b.id ?? b.name}
                onClick={() => navigate(`/founder/payments?branchId=${b.id}`)}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-gray-900/40 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{b.name}</div>
                  <div className="text-[11px] text-zinc-400">{b.students ?? 0} o'quvchi · {b.groups ?? 0} guruh</div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="text-sm font-bold text-emerald-600 tabular-nums">{fmtShort(b.monthIncome ?? 0)}</div>
                  <div className="text-[10px] text-zinc-400">so'm →</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tushum grafigi */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-500" /> Oylik tushum dinamikasi
        </h3>
        <div className="h-56 sm:h-64">
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

      {(stats?.totalDebt ?? 0) > 0 && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">
            Jami qarzdorlik: <b>{fmt(stats.totalDebt)} so'm</b>. Batafsil "Moliya" bo'limида.
          </p>
        </div>
      )}
    </div>
  );
}
