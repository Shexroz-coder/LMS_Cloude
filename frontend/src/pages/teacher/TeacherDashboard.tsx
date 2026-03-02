import { useQuery } from 'react-query';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TodayLesson {
  id: number;
  date: string;
  topic?: string;
  group: {
    id: number;
    name: string;
    course: { name: string };
    groupStudents: { student: { user: { fullName: string } } }[];
  };
  _count: { attendance: number };
}

const TeacherDashboard = () => {
  const { user } = useAuthStore();

  const { data: todayLessons = [] } = useQuery<TodayLesson[]>(
    ['teacher-today'],
    async () => {
      const r = await api.get('/attendance/today');
      return r.data?.data || [];
    }
  );

  const { data: attendanceStats } = useQuery(
    ['teacher-att-stats'],
    async () => {
      const r = await api.get('/attendance/stats');
      return r.data?.data;
    }
  );

  const { data: recentGrades } = useQuery(
    ['teacher-recent-grades'],
    async () => {
      const r = await api.get('/grades?limit=5');
      return r.data?.data || [];
    }
  );

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Xayrli tong' : now.getHours() < 17 ? 'Xayrli kun' : 'Xayrli kech';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {greeting}, {user?.fullName?.split(' ')[0]}! 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {now.toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Faol
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Bugungi darslar", value: todayLessons.length, icon: "📚", color: "bg-blue-50 text-blue-700" },
          { label: "Davomat foizi", value: (attendanceStats?.rate ?? 0) + '%', icon: "✅", color: "bg-emerald-50 text-emerald-700" },
          { label: "So'nggi baholar", value: recentGrades?.length || 0, icon: "⭐", color: "bg-amber-50 text-amber-700" },
          { label: "Jami darslar", value: attendanceStats?.total ?? '—', icon: "📋", color: "bg-violet-50 text-violet-700" },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="font-bold text-gray-800 text-lg">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Today's lessons */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Bugungi darslar</h3>
          {todayLessons.length === 0 ? (
            <div className="text-center py-8 text-gray-300">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-sm">Bugun dars yo'q</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayLessons.map(lesson => {
                const studentCount = lesson.group.groupStudents?.length || 0;
                const attendedCount = lesson._count?.attendance || 0;
                return (
                  <div key={lesson.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="w-2 h-12 rounded-full bg-emerald-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{lesson.group.name}</p>
                      <p className="text-xs text-gray-400">{lesson.group.course.name}</p>
                      {lesson.topic && <p className="text-xs text-gray-500 mt-0.5">📌 {lesson.topic}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-gray-700">{attendedCount}/{studentCount}</p>
                      <p className="text-xs text-gray-400">davomat</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attendance stats */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Davomat ko'rsatkichlari</h3>
          {attendanceStats ? (
            <div className="space-y-3">
              {[
                { label: "Keldi", value: attendanceStats.present || 0, color: "bg-emerald-500" },
                { label: "Kech keldi", value: attendanceStats.late || 0, color: "bg-amber-500" },
                { label: "Kelmadi", value: attendanceStats.absent || 0, color: "bg-red-400" },
                { label: "Sababli", value: attendanceStats.excused || 0, color: "bg-blue-400" },
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

      {/* Quick actions */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Tezkor amallar</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Davomat belgilash", icon: "📋", href: "/teacher/attendance", color: "bg-blue-50 hover:bg-blue-100 text-blue-700" },
            { label: "Baho qo'yish", icon: "⭐", href: "/teacher/grades", color: "bg-amber-50 hover:bg-amber-100 text-amber-700" },
            { label: "Coin berish", icon: "🪙", href: "/teacher/coins", color: "bg-violet-50 hover:bg-violet-100 text-violet-700" },
            { label: "Guruhlarim", icon: "👥", href: "/teacher/groups", color: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700" },
          ].map(action => (
            <a key={action.label} href={action.href} className={`flex flex-col items-center gap-2 p-4 rounded-xl transition ${action.color}`}>
              <span className="text-2xl">{action.icon}</span>
              <span className="text-xs font-medium text-center">{action.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
