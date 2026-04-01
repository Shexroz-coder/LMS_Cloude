import { useQuery } from 'react-query';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import { Link } from 'react-router-dom';

const DAYS_FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const formatMoney = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";

interface TodayEntry {
  scheduleId: number;
  groupId: number;
  groupName: string;
  courseName: string;
  teacherName: string;
  startTime: string;
  endTime: string;
  room: string | null;
  studentCount: number;
}

interface DebtorStudent {
  studentId: number;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  groupId: number;
  groupName: string;
  courseName: string;
  debt: number;
  balance: number;
}

const TeacherDashboard = () => {
  const { user } = useAuthStore();
  const now = new Date();
  const todayDay = now.getDay();
  const greeting = now.getHours() < 5 ? 'Xayrli tun' : now.getHours() < 12 ? 'Xayrli tong' : now.getHours() < 17 ? 'Xayrli kun' : 'Xayrli kech';

  // Bugungi jadval — Schedule asosida (haqiqiy dars jadvali)
  const { data: todayLessons = [], isLoading: schedLoading } = useQuery<TodayEntry[]>(
    ['teacher-today-schedule'],
    async () => {
      const r = await api.get('/dashboard/today-schedule');
      return r.data?.data || [];
    },
    { refetchInterval: 60000 }
  );

  const { data: attendanceStats } = useQuery(
    ['teacher-att-stats'],
    async () => {
      const r = await api.get('/attendance/stats');
      return r.data?.data;
    }
  );

  const { data: debtorsData } = useQuery(
    ['teacher-debtors'],
    async () => {
      const r = await api.get('/dashboard/teacher-debtors');
      return r.data?.data;
    },
    { refetchInterval: 120000 }
  );

  // Oylik ma'lumotlari
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { data: salaryData } = useQuery(
    ['teacher-salary', currentMonth],
    async () => {
      const r = await api.get(`/salaries/teacher/me/calculate?month=${currentMonth}`);
      return r.data?.data;
    },
    { refetchInterval: 300000, retry: 1 }
  );

  const debtors: DebtorStudent[] = debtorsData?.debtors || [];
  const totalDebt: number = debtorsData?.totalDebt || 0;

  return (
    <div className="space-y-5 animate-fade-in dark:bg-gray-900 dark:text-gray-100">

      {/* ── Hero ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-800 to-black dark:from-blue-800 dark:via-blue-900 dark:to-gray-900 text-white px-6 py-5">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 60%)' }} />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium">{greeting} 👋</p>
            <h1 className="text-2xl font-bold mt-0.5">{user?.fullName?.split(' ')[0]}</h1>
            <p className="text-blue-200 text-xs mt-1">
              {DAYS_FULL[todayDay]}, {now.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <span className="text-3xl">👨‍🏫</span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="relative grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/20">
          {[
            { label: 'Bugungi darslar', value: todayLessons.length, icon: '📚' },
            { label: 'Davomat foizi', value: (attendanceStats?.rate ?? 0) + '%', icon: '✅' },
            { label: 'Jami darslar', value: attendanceStats?.total ?? '—', icon: '📋' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-lg">{s.icon}</div>
              <div className="text-base font-bold leading-tight mt-0.5">{s.value}</div>
              <div className="text-blue-200 text-[10px] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* ── Bugungi darslar ───────────────────────── */}
        <div className="card dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-sm">📅</span>
              Bugungi jadval — {DAYS_FULL[todayDay]}
            </h3>
            <Link to="/teacher/schedule" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              To'liq jadval →
            </Link>
          </div>

          {schedLoading ? (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">
              <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm">Yuklanmoqda...</p>
            </div>
          ) : todayLessons.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">
              <div className="text-4xl mb-2">☕</div>
              <p className="text-sm">Bugun dars yo'q</p>
              <p className="text-xs mt-1 text-gray-300 dark:text-gray-600">Dam oling!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayLessons.map((entry) => (
                <div key={entry.scheduleId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900">
                  <div className="w-16 text-center bg-blue-600 text-white rounded-xl py-2 flex-shrink-0">
                    <p className="text-xs font-bold">{entry.startTime}</p>
                    <p className="text-[10px] opacity-80">{entry.endTime}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{entry.groupName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {entry.courseName} · 👥 {entry.studentCount} o'quvchi
                    </p>
                  </div>
                  {entry.room && (
                    <span className="text-[11px] bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full flex-shrink-0">
                      🚪 {entry.room}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Davomat ko'rsatkichlari ───────────────── */}
        <div className="card dark:bg-gray-800 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-sm">📊</span>
            Davomat ko'rsatkichlari
          </h3>
          {attendanceStats ? (
            <div className="space-y-3">
              {[
                { label: 'Keldi', value: attendanceStats.present || 0, color: 'bg-emerald-500' },
                { label: 'Kech keldi', value: attendanceStats.late || 0, color: 'bg-amber-500' },
                { label: 'Kelmadi', value: attendanceStats.absent || 0, color: 'bg-red-400' },
                { label: 'Sababli', value: attendanceStats.excused || 0, color: 'bg-blue-400' },
              ].map(item => {
                const total = attendanceStats.total || 1;
                const pct = Math.round((item.value / total) * 100);
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>{item.label}</span>
                      <span>{item.value} ta ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Umumiy davomat: <span className="text-emerald-600 dark:text-emerald-400">{attendanceStats.rate}%</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-300 dark:text-gray-600">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-sm">Ma'lumot yuklanmoqda...</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Oylik ma'lumotlari ──────────────────────────── */}
      {salaryData && (
        <div className="card dark:bg-gray-800 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-sm">💰</span>
            Oylik ma'lumotlari — {now.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-3 text-center">
              <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium uppercase">Oylik turi</p>
              <p className="text-sm font-bold text-violet-800 dark:text-violet-300 mt-1">
                {salaryData.salaryType === 'PERCENTAGE_FROM_PAYMENT'
                  ? `${salaryData.salaryValue}% to'lovdan`
                  : `${formatMoney(salaryData.salaryValue)} soatbay`}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium uppercase">Umumiy tushum</p>
              <p className="text-sm font-bold text-blue-800 dark:text-blue-300 mt-1">{formatMoney(salaryData.totalRevenue || 0)}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium uppercase">Hisoblangan</p>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mt-1">{formatMoney(salaryData.calculatedSalary || 0)}</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${salaryData.isPaid ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
              <p className={`text-[10px] font-medium uppercase ${salaryData.isPaid ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>Holat</p>
              <p className={`text-sm font-bold mt-1 ${salaryData.isPaid ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
                {salaryData.isPaid ? '✅ To\'langan' : '⏳ Kutilmoqda'}
              </p>
            </div>
          </div>

          {/* Guruhlar bo'yicha tafsilot */}
          {salaryData.groups && salaryData.groups.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Guruhlar bo'yicha</p>
              {salaryData.groups.map((g: { groupId: number; groupName: string; courseName: string; studentCount: number; revenue: number }) => (
                <div key={g.groupId} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{g.groupName}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">{g.courseName} · 👥 {g.studentCount} o'quvchi</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300 flex-shrink-0 ml-2">
                    {formatMoney(g.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {salaryData.isPaid && salaryData.paidAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-right">
              To'langan: {new Date(salaryData.paidAt).toLocaleDateString('uz-UZ')} · {formatMoney(salaryData.paidSalary || 0)}
            </p>
          )}
        </div>
      )}

      {/* ── Qarzdor o'quvchilar ────────────────────────── */}
      {debtors.length > 0 && (
        <div className="card dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-sm">💰</span>
              Qarzdor o'quvchilar
            </h3>
            <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-full">
              {debtors.length} ta · {formatMoney(totalDebt)}
            </span>
          </div>
          <div className="space-y-2">
            {debtors.slice(0, 8).map(d => (
              <div key={`${d.studentId}-${d.groupId}`}
                className="flex items-center justify-between p-3 rounded-xl bg-red-50/50 dark:bg-red-900/20 border border-red-100 dark:border-red-900">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
                    {d.avatarUrl ? (
                      <img src={d.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-red-600">
                        {d.fullName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{d.fullName}</p>
                    <p className="text-[11px] text-gray-400 truncate">{d.groupName} · {d.courseName}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-red-600 flex-shrink-0 ml-2">
                  {formatMoney(d.debt)}
                </span>
              </div>
            ))}
            {debtors.length > 8 && (
              <p className="text-center text-xs text-gray-400 pt-1">
                ... va yana {debtors.length - 8} ta
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Tezkor amallar ───────────────────────────── */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Tezkor amallar</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Jadval & Davomat', icon: '📋', href: '/teacher/schedule', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700' },
            { label: 'Coin berish', icon: '🪙', href: '/teacher/coins', color: 'bg-violet-50 hover:bg-violet-100 text-violet-700' },
            { label: 'Guruhlarim', icon: '👥', href: '/teacher/groups', color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700' },
          ].map(action => (
            <Link key={action.label} to={action.href}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl transition ${action.color}`}>
              <span className="text-2xl">{action.icon}</span>
              <span className="text-xs font-medium text-center">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
