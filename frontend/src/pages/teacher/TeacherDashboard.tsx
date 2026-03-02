import { useQuery } from 'react-query';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import { Link } from 'react-router-dom';

const DAYS_FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

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

  const { data: recentGrades = [] } = useQuery(
    ['teacher-recent-grades'],
    async () => {
      const r = await api.get('/grades?limit=5');
      return r.data?.data || [];
    }
  );

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Hero ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-800 to-black text-white px-6 py-5">
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
        <div className="relative grid grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/20">
          {[
            { label: 'Bugungi darslar', value: todayLessons.length, icon: '📚' },
            { label: 'Davomat foizi', value: (attendanceStats?.rate ?? 0) + '%', icon: '✅' },
            { label: "So'nggi baholar", value: recentGrades.length || 0, icon: '⭐' },
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
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-sm">📅</span>
              Bugungi jadval — {DAYS_FULL[todayDay]}
            </h3>
            <Link to="/teacher/schedule" className="text-xs text-blue-600 hover:underline">
              To'liq jadval →
            </Link>
          </div>

          {schedLoading ? (
            <div className="text-center py-8 text-gray-400">
              <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm">Yuklanmoqda...</p>
            </div>
          ) : todayLessons.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">☕</div>
              <p className="text-sm">Bugun dars yo'q</p>
              <p className="text-xs mt-1 text-gray-300">Dam oling!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayLessons.map((entry) => (
                <div key={entry.scheduleId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="w-16 text-center bg-blue-600 text-white rounded-xl py-2 flex-shrink-0">
                    <p className="text-xs font-bold">{entry.startTime}</p>
                    <p className="text-[10px] opacity-80">{entry.endTime}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{entry.groupName}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {entry.courseName} · 👥 {entry.studentCount} o'quvchi
                    </p>
                  </div>
                  {entry.room && (
                    <span className="text-[11px] bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
                      🚪 {entry.room}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Davomat ko'rsatkichlari ───────────────── */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-sm">📊</span>
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
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{item.label}</span>
                      <span>{item.value} ta ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-700">
                  Umumiy davomat: <span className="text-emerald-600">{attendanceStats.rate}%</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-300">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-sm">Ma'lumot yuklanmoqda...</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Tezkor amallar ───────────────────────────── */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Tezkor amallar</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Jadval & Davomat', icon: '📋', href: '/teacher/schedule', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700' },
            { label: 'Baho qo\'yish', icon: '⭐', href: '/teacher/grades', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700' },
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
