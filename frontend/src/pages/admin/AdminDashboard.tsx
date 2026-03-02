import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
import {
  Users, UserCheck, TrendingUp, AlertCircle,
  CreditCard, BookOpen, CheckCircle, Clock, Loader2, Bell
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import api from '../../api/axios';
import StatCard from '../../components/ui/StatCard';
import { useAuthStore } from '../../store/auth.store';
import { format } from 'date-fns';

const formatMoney = (v: number) =>
  new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";

const PAYMENT_METHODS: Record<string, string> = {
  CASH: 'Naqd', CARD: 'Karta', TRANSFER: "O'tkazma", ONLINE: 'Online'
};

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  // ── Real stats ────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery(
    'admin-dashboard-stats',
    () => api.get('/dashboard/stats').then(r => r.data?.data).catch(() => null),
    { refetchInterval: 60_000 }
  );

  // ── Income chart (real 6 months) ──────────────
  const { data: incomeChart = [] } = useQuery(
    'admin-income-chart',
    () => api.get('/dashboard/income-chart').then(r => r.data?.data || []).catch(() => []),
    { refetchInterval: 300_000 }
  );

  // ── Today's lessons (real) ───────────────────
  const { data: todayLessons = [] } = useQuery(
    'admin-today-lessons',
    () => api.get('/dashboard/today-lessons').then(r => r.data?.data || []).catch(() => []),
    { refetchInterval: 120_000 }
  );

  // ── Recent payments (real) ───────────────────
  const { data: recentPayments = [] } = useQuery(
    'admin-recent-payments',
    () => api.get('/dashboard/recent-payments').then(r => r.data?.data || []).catch(() => []),
    { refetchInterval: 60_000 }
  );

  // ── Weekly attendance (real) ─────────────────
  const { data: attendanceChart = [] } = useQuery(
    'admin-attendance-chart',
    () => api.get('/dashboard/weekly-attendance').then(r => r.data?.data || []).catch(() => []),
    { refetchInterval: 300_000 }
  );

  // ── Upcoming payment dues ─────────────────────
  const { data: upcomingDues = [] } = useQuery(
    'admin-upcoming-dues',
    () => api.get('/payments/upcoming-dues').then(r => r.data?.data || []).catch(() => []),
    { refetchInterval: 3600_000 }
  );
  const nearDues = (upcomingDues as { daysLeft: number; isOverdue: boolean }[]).filter(d => d.daysLeft <= 5 || d.isOverdue);

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-3 text-gray-500">Ma'lumotlar yuklanmoqda...</span>
      </div>
    );
  }

  const s = {
    studentsCount: stats?.studentsCount ?? 0,
    teachersCount: stats?.teachersCount ?? 0,
    monthlyIncome: stats?.monthlyIncome ?? 0,
    totalDebt: stats?.totalDebt ?? 0,
    netProfit: stats?.netProfit ?? 0,
    attendanceRate: stats?.attendanceRate ?? 0,
    todayLessonsCount: stats?.todayLessons ?? 0,
    coinTotal: stats?.coinTotal ?? 0,
    activeGroups: stats?.activeGroups ?? 0,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Welcome ──────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {t('dashboard.welcome')}, {user?.fullName?.split(' ')[0]}! 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(), 'd-MMMM, yyyy')} — Bugun {s.todayLessonsCount} ta dars
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-success-50 text-success-700 px-3 py-2 rounded-lg text-sm font-medium">
          <CheckCircle className="w-4 h-4" />
          Tizim ishlayapti
        </div>
      </div>

      {/* ── To'lov eslatmalari ───────────────────── */}
      {nearDues.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-amber-800 text-sm">
              To'lov eslatmalari ({nearDues.length} ta)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {(nearDues as {
              studentId: number; fullName: string; daysLeft: number;
              nextDueDate: string; isOverdue: boolean; debt: number; groupName?: string;
            }[]).slice(0, 6).map(d => (
              <div key={d.studentId}
                className={`flex items-center gap-3 p-2.5 rounded-xl border text-sm ${
                  d.isOverdue || d.daysLeft <= 0
                    ? 'bg-red-50 border-red-200'
                    : d.daysLeft <= 2
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-white border-amber-100'
                }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  d.isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {d.isOverdue ? '!' : d.daysLeft}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{d.fullName}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {d.isOverdue
                      ? `Qarz: ${formatMoney(d.debt)}`
                      : `${d.daysLeft} kundan so'ng · ${new Date(d.nextDueDate).toLocaleDateString('uz-UZ', {day: '2-digit', month: '2-digit'})}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {nearDues.length > 6 && (
            <p className="text-xs text-amber-600 mt-2 text-right">+{nearDues.length - 6} ta ko'proq</p>
          )}
        </div>
      )}

      {/* ── Stat Cards ───────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.totalStudents')}
          value={s.studentsCount}
          icon={Users}
          iconColor="text-primary-600"
          iconBg="bg-primary-50"
        />
        <StatCard
          title={t('dashboard.totalTeachers')}
          value={s.teachersCount}
          icon={UserCheck}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Faol guruhlar"
          value={s.activeGroups}
          icon={BookOpen}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        />
        <StatCard
          title={t('dashboard.monthlyIncome')}
          value={formatMoney(s.monthlyIncome)}
          icon={CreditCard}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
        />
        <StatCard
          title={t('dashboard.totalDebt')}
          value={formatMoney(s.totalDebt)}
          icon={AlertCircle}
          iconColor="text-red-500"
          iconBg="bg-red-50"
        />
        <StatCard
          title={t('dashboard.netProfit')}
          value={formatMoney(s.netProfit)}
          icon={TrendingUp}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
        />
        <StatCard
          title={t('dashboard.attendanceRate')}
          value={s.attendanceRate}
          icon={CheckCircle}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          suffix="%"
        />
        <StatCard
          title="Bugungi darslar"
          value={s.todayLessonsCount}
          icon={BookOpen}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
      </div>

      {/* ── Charts Row ───────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Income Chart */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Moliyaviy ko'rsatkichlar</h3>
            <span className="badge badge-blue">So'nggi 6 oy</span>
          </div>
          {incomeChart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[220px] text-gray-300">
              <TrendingUp className="w-10 h-10 mb-2" />
              <p className="text-sm">Hali ma'lumotlar yo'q</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={incomeChart} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Area type="monotone" dataKey="income" name="Tushum" stroke="#2563EB" fill="url(#colorIncome)" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" name="Xarajat" stroke="#EF4444" fill="url(#colorExpenses)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Payments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">{t('dashboard.recentPayments')}</h3>
            <span className="text-xs text-gray-400">{recentPayments.length} ta</span>
          </div>
          {recentPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-300">
              <CreditCard className="w-8 h-8 mb-2" />
              <p className="text-sm">Hali to'lov yo'q</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {(recentPayments as {
                id: number;
                amount: number;
                paymentMethod: string;
                paidAt: string;
                student: { user: { fullName: string } };
              }[]).slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {p.student?.user?.fullName?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">{p.student?.user?.fullName}</div>
                      <div className="text-xs text-gray-400">
                        {PAYMENT_METHODS[p.paymentMethod] || p.paymentMethod} · {p.paidAt ? format(new Date(p.paidAt), 'd-MMM') : '—'}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-emerald-600 flex-shrink-0">
                    {formatMoney(Number(p.amount))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row ───────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Attendance Chart */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Haftalik davomat</h3>
          {attendanceChart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[180px] text-gray-300">
              <CheckCircle className="w-8 h-8 mb-2" />
              <p className="text-sm">Davomat ma'lumotlari yo'q</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={attendanceChart} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip />
                <Bar dataKey="present" name="Keldi" fill="#22C55E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" name="Kelmadi" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Today's Lessons */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Bugungi darslar</h3>
            <span className="badge badge-blue">{s.todayLessonsCount} ta</span>
          </div>
          {todayLessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-300">
              <BookOpen className="w-8 h-8 mb-2" />
              <p className="text-sm">Bugun dars yo'q</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {(todayLessons as {
                id: number;
                startTime: string;
                endTime: string;
                group: {
                  name: string;
                  course: { name: string };
                  teacher: { user: { fullName: string } };
                };
              }[]).map((lesson) => (
                <div key={lesson.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <div className="flex-shrink-0 w-1.5 h-10 rounded-full bg-primary-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-800 truncate">
                      {lesson.group?.name} — {lesson.group?.course?.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {lesson.group?.teacher?.user?.fullName}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {lesson.startTime}–{lesson.endTime}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
