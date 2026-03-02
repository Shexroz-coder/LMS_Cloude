import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ExternalLink } from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";
const DAYS = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

// ─── Online to'lov tugmasi ─────────────────────────────────
function OnlinePayBtn({
  label, emoji, color, provider, studentId, amount,
}: {
  label: string; emoji: string; color: string;
  provider: string; studentId: number; amount: number;
}) {
  const [loading, setLoading] = useState(false);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const pay = async () => {
    if (amount <= 0) { toast.error("To'lanadigan summa yo'q"); return; }
    setLoading(true);
    try {
      const res = await api.post('/payments/online/initiate', {
        studentId, amount, month: currentMonth, provider,
      });
      const { paymentUrl } = res.data?.data || {};
      if (paymentUrl) {
        window.open(paymentUrl, '_blank');
      } else {
        toast.error("To'lov havolasi yaratilmadi");
      }
    } catch {
      toast.error('Xato yuz berdi');
    } finally { setLoading(false); }
  };

  return (
    <button onClick={pay} disabled={loading}
      className={clsx(
        'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-semibold text-white text-sm transition disabled:opacity-60',
        color
      )}>
      <span>{emoji}</span>
      {loading ? 'Yuklanmoqda...' : label}
      {!loading && <ExternalLink size={13} />}
    </button>
  );
}

const ParentDashboard = () => {
  const { user } = useAuthStore();

  // Get parent profile with children
  const { data: profile } = useQuery('parent-profile', async () => {
    const r = await api.get('/auth/me');
    return r.data?.data;
  });

  const children: { id: number; fullName: string; coinBalance: number; student: { id: number } }[] =
    profile?.parent?.children || profile?.children || [];

  const firstChild = children[0];
  const studentId = firstChild?.student?.id || firstChild?.id;

  // Grades for first child
  const { data: gradesData } = useQuery(['parent-grades', studentId], async () => {
    if (!studentId) return null;
    const r = await api.get(`/grades/student/${studentId}?limit=10`);
    return r.data?.data;
  }, { enabled: !!studentId });

  // Payments for first child
  const { data: paymentsData } = useQuery(['parent-payments', studentId], async () => {
    if (!studentId) return null;
    const r = await api.get(`/payments/student/${studentId}`);
    return r.data?.data;
  }, { enabled: !!studentId });

  // Attendance for first child
  const { data: attendanceData } = useQuery(['parent-attendance', studentId], async () => {
    if (!studentId) return null;
    const r = await api.get(`/attendance/student/${studentId}?limit=20`);
    return r.data?.data;
  }, { enabled: !!studentId });

  // Groups/schedule for first child
  const { data: groups = [] } = useQuery(['parent-schedule', studentId], async () => {
    if (!studentId) return [];
    const r = await api.get(`/groups?limit=50`);
    const d = r.data?.data;
    return Array.isArray(d) ? d : d?.groups || [];
  }, { enabled: !!studentId });

  const avgScore = gradesData?.stats?.avgScore || 0;
  const balance = paymentsData?.balance;
  const coinBalance = firstChild?.coinBalance || 0;

  const recentGrades: { id: number; score: number; type: string; lesson: { topic: string; date: string } }[] =
    gradesData?.grades || [];

  const recentPayments: { id: number; amount: number; paidAt: string }[] =
    paymentsData?.payments?.slice(0, 5) || [];

  const attendanceRecords: { id: number; status: string; lesson: { date: string; topic: string } }[] =
    Array.isArray(attendanceData) ? attendanceData.slice(0, 10) : attendanceData?.records?.slice(0, 10) || [];

  const presentCount = attendanceRecords.filter(a => a.status === 'PRESENT').length;
  const attendancePct = attendanceRecords.length > 0
    ? Math.round((presentCount / attendanceRecords.length) * 100)
    : 0;

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Xayrli tong' : now.getHours() < 17 ? 'Xayrli kun' : 'Xayrli kech';

  const childName = firstChild?.fullName || user?.fullName;

  // Schedules from groups — expand daysOfWeek array into individual entries
  type ScheduleEntry = { entryKey: string; id: number; startTime: string; endTime: string; room?: string; groupName: string; courseName: string };
  const today = now.getDay();
  const todaySchedules: ScheduleEntry[] = (groups as {
    id: number; name: string; course: { name: string };
    schedules?: { id: number; daysOfWeek: number[]; startTime: string; endTime: string; room?: string }[];
  }[]).flatMap(g =>
    (g.schedules || [])
      .filter(sc => (sc.daysOfWeek || []).includes(today))
      .map(sc => ({
        entryKey: `${sc.id}-${today}`,
        id: sc.id,
        startTime: sc.startTime,
        endTime: sc.endTime,
        room: sc.room,
        groupName: g.name,
        courseName: g.course?.name || '',
      }))
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {greeting}! 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {now.toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Child selector (if multiple children) */}
      {children.length > 1 && (
        <div className="card">
          <p className="text-xs text-gray-400 mb-2">Farzandlar</p>
          <div className="flex gap-2 flex-wrap">
            {children.map((child, i) => (
              <div key={child.id} className={clsx(
                "px-3 py-1.5 rounded-xl text-sm font-medium border",
                i === 0 ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"
              )}>
                {child.fullName}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Child profile card */}
      {childName && (
        <div className="card bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {childName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg">{childName}</h2>
              <p className="text-indigo-200 text-sm">O'quvchi</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">🪙 {coinBalance}</div>
              <p className="text-indigo-200 text-xs">Coin balans</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-indigo-600">{avgScore.toFixed(0)}</div>
          <p className="text-xs text-gray-400 mt-1">O'rtacha ball</p>
        </div>
        <div className="card text-center">
          <div className={clsx("text-2xl font-bold", attendancePct >= 80 ? "text-emerald-600" : attendancePct >= 60 ? "text-amber-500" : "text-red-500")}>
            {attendancePct}%
          </div>
          <p className="text-xs text-gray-400 mt-1">Davomat</p>
        </div>
        <div className="card text-center">
          <div className={clsx("text-2xl font-bold", balance?.debt > 0 ? "text-red-500" : "text-emerald-600")}>
            {balance?.debt > 0 ? '⚠️' : '✅'}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {balance?.debt > 0 ? "Qarz bor" : "To'lov yo'q"}
          </p>
        </div>
      </div>

      {/* Today's schedule */}
      {todaySchedules.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">📅 Bugungi darslar</h3>
          <div className="space-y-2">
            {todaySchedules.map(sc => (
              <div key={sc.entryKey} className="flex items-center gap-3 p-2.5 rounded-xl bg-indigo-50">
                <div className="text-center w-16 bg-indigo-100 text-indigo-700 rounded-xl py-1.5 flex-shrink-0">
                  <p className="text-sm font-bold">{sc.startTime}</p>
                  <p className="text-xs opacity-70">{sc.endTime}</p>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{sc.groupName}</p>
                  <p className="text-xs text-gray-500">{sc.courseName}</p>
                </div>
                {sc.room && <span className="text-xs bg-white text-gray-600 px-2 py-1 rounded-full">🚪 {sc.room}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent grades */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">📊 So'nggi baholar</h3>
          {recentGrades.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Hali baho yo'q</p>
          ) : (
            <div className="space-y-2">
              {recentGrades.slice(0, 5).map(g => {
                const score = Number(g.score);
                const color = score >= 91 ? 'text-violet-600' : score >= 76 ? 'text-emerald-600' : score >= 61 ? 'text-amber-600' : 'text-red-500';
                return (
                  <div key={g.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm text-gray-700 font-medium">{g.lesson?.topic}</p>
                      <p className="text-xs text-gray-400">{g.type}</p>
                    </div>
                    <span className={clsx("font-bold text-lg", color)}>{score}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attendance */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">✅ Davomat</h3>
          {attendanceRecords.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Ma'lumot yo'q</p>
          ) : (
            <div className="space-y-2">
              {attendanceRecords.slice(0, 7).map(a => {
                const statusMap: Record<string, { label: string; cls: string; icon: string }> = {
                  PRESENT: { label: 'Keldi', cls: 'text-emerald-600 bg-emerald-50', icon: '✅' },
                  ABSENT: { label: 'Kelmadi', cls: 'text-red-500 bg-red-50', icon: '❌' },
                  LATE: { label: 'Kechikdi', cls: 'text-amber-600 bg-amber-50', icon: '⏰' },
                  EXCUSED: { label: 'Sababli', cls: 'text-blue-600 bg-blue-50', icon: '📋' },
                };
                const s = statusMap[a.status] || { label: a.status, cls: 'text-gray-500 bg-gray-50', icon: '?' };
                return (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm text-gray-700">{a.lesson?.topic || 'Dars'}</p>
                      <p className="text-xs text-gray-400">{a.lesson?.date ? new Date(a.lesson.date).toLocaleDateString('uz-UZ') : ''}</p>
                    </div>
                    <span className={clsx("text-xs px-2 py-1 rounded-full font-medium", s.cls)}>
                      {s.icon} {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Payment info */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">💰 To'lov holati</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className={clsx("p-3 rounded-xl", balance?.debt > 0 ? "bg-red-50" : "bg-emerald-50")}>
            <p className={clsx("text-xs", balance?.debt > 0 ? "text-red-400" : "text-emerald-400")}>
              {balance?.debt > 0 ? "Qarz miqdori" : "Holat"}
            </p>
            <p className={clsx("font-bold text-lg mt-1", balance?.debt > 0 ? "text-red-600" : "text-emerald-600")}>
              {balance?.debt > 0 ? fmt(Number(balance.debt)) : "✅ Qarz yo'q"}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50">
            <p className="text-xs text-blue-400">Balans</p>
            <p className="font-bold text-lg mt-1 text-blue-600">{fmt(Number(balance?.balance || 0))}</p>
          </div>
        </div>

        {/* Online to'lov */}
        {studentId && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">💳 Online to'lov</p>
            <div className="grid grid-cols-2 gap-2">
              <OnlinePayBtn
                label="Payme" emoji="🔵"
                color="bg-blue-600 hover:bg-blue-700"
                provider="PAYME"
                studentId={studentId}
                amount={Number(balance?.debt) || 0}
              />
              <OnlinePayBtn
                label="Uzum" emoji="🟠"
                color="bg-orange-500 hover:bg-orange-600"
                provider="UZUM"
                studentId={studentId}
                amount={Number(balance?.debt) || 0}
              />
            </div>
          </div>
        )}

        {recentPayments.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">So'nggi to'lovlar</p>
            <div className="space-y-2">
              {recentPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">💳</div>
                    <p className="text-xs text-gray-400">{new Date(p.paidAt).toLocaleDateString('uz-UZ')}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">{fmt(Number(p.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Weekly schedule overview */}
      {todaySchedules.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">📅 Haftalik jadval</h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map(d => {
              const dayEntries = todaySchedules.filter(s => parseInt(s.entryKey.split('-')[1]) === d);
              return (
                <div key={d} className={clsx(
                  "p-2 rounded-xl text-center",
                  d === today ? "bg-indigo-50 border border-indigo-200" : "bg-gray-50"
                )}>
                  <p className={clsx("text-xs font-semibold mb-1", d === today ? "text-indigo-700" : "text-gray-500")}>
                    {DAYS[d]}
                  </p>
                  {dayEntries.length > 0 ? (
                    dayEntries.map(e => (
                      <p key={e.entryKey} className="text-xs text-gray-600">{e.startTime}</p>
                    ))
                  ) : (
                    <p className="text-xs text-gray-300">—</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentDashboard;
