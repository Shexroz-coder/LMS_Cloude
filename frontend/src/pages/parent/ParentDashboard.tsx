import { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import clsx from 'clsx';
import {
  CreditCard, Star, Calendar, Users, TrendingDown, Wallet,
  ChevronRight, BookOpen,
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";
const DAYS = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

// ─── Child data hook ─────────────────────────────────────────────────────────
function useChildData(studentId: number | null) {
  const { data: gradesData } = useQuery(['parent-grades', studentId], async () => {
    const r = await api.get(`/grades/student/${studentId}?limit=10`);
    return r.data?.data;
  }, { enabled: !!studentId });

  const { data: paymentsData } = useQuery(['parent-payments', studentId], async () => {
    const r = await api.get(`/payments/student/${studentId}`);
    return r.data?.data;
  }, { enabled: !!studentId });

  const { data: attendanceData } = useQuery(['parent-attendance', studentId], async () => {
    const r = await api.get(`/attendance/student/${studentId}?limit=20`);
    return r.data?.data;
  }, { enabled: !!studentId });

  const { data: groups = [] } = useQuery(['parent-groups', studentId], async () => {
    const r = await api.get(`/groups?limit=50`);
    const d = r.data?.data;
    return Array.isArray(d) ? d : d?.groups || [];
  }, { enabled: !!studentId });

  return { gradesData, paymentsData, attendanceData, groups };
}

// ─── Child Panel ─────────────────────────────────────────────────────────────
function ChildPanel({ studentId }: { studentId: number }) {
  const now = new Date();
  const todayDay = now.getDay();
  const { gradesData, paymentsData, attendanceData, groups } = useChildData(studentId);

  const avgScore = gradesData?.stats?.avgScore || 0;
  const balance = paymentsData?.balance;

  const recentGrades: { id: number; score: number; type: string; lesson: { topic: string; date: string } }[] =
    gradesData?.grades?.slice(0, 5) || [];

  const recentPayments: { id: number; amount: number; paidAt: string; paymentMethod: string }[] =
    paymentsData?.payments?.slice(0, 3) || [];

  const attendanceRecords: { id: number; status: string; lesson: { date: string; topic: string } }[] =
    Array.isArray(attendanceData) ? attendanceData.slice(0, 10) : attendanceData?.records?.slice(0, 10) || [];

  const presentCount = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
  const attendancePct =
    attendanceRecords.length > 0 ? Math.round((presentCount / attendanceRecords.length) * 100) : 0;

  // Today's schedule
  type ScheduleEntry = {
    entryKey: string; id: number; startTime: string; endTime: string;
    room?: string; groupName: string; courseName: string;
  };
  const todaySchedules: ScheduleEntry[] = (groups as {
    id: number; name: string; course: { name: string };
    schedules?: { id: number; daysOfWeek: number[]; startTime: string; endTime: string; room?: string }[];
  }[]).flatMap((g) =>
    (g.schedules || [])
      .filter((sc) => (sc.daysOfWeek || []).includes(todayDay))
      .map((sc) => ({
        entryKey: `${sc.id}-${todayDay}`,
        id: sc.id,
        startTime: sc.startTime,
        endTime: sc.endTime,
        room: sc.room,
        groupName: g.name,
        courseName: g.course?.name || '',
      }))
  );

  // Weekly schedule
  const allSchedules = (groups as {
    id: number; name: string; course: { name: string };
    schedules?: { id: number; daysOfWeek: number[]; startTime: string; endTime: string; room?: string }[];
  }[]).flatMap((g) =>
    (g.schedules || []).flatMap((sc) =>
      (sc.daysOfWeek || []).map((d) => ({
        entryKey: `${sc.id}-${d}`,
        id: sc.id,
        day: d,
        startTime: sc.startTime,
        endTime: sc.endTime,
        room: sc.room,
        groupName: g.name,
        courseName: g.course?.name || '',
      }))
    )
  );

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center p-4">
          <div className="text-2xl font-bold text-indigo-600">{avgScore.toFixed(0)}</div>
          <p className="text-xs text-gray-400 mt-1">O'rtacha ball</p>
        </div>
        <div className="card text-center p-4">
          <div className={clsx('text-2xl font-bold',
            attendancePct >= 80 ? 'text-emerald-600' :
            attendancePct >= 60 ? 'text-amber-500' : 'text-red-500')}>
            {attendancePct}%
          </div>
          <p className="text-xs text-gray-400 mt-1">Davomat</p>
        </div>
        <div className="card text-center p-4">
          <div className={clsx('text-2xl font-bold',
            Number(balance?.debt) > 0 ? 'text-red-500' : 'text-emerald-600')}>
            {Number(balance?.debt) > 0 ? '⚠️' : '✅'}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {Number(balance?.debt) > 0 ? 'Qarz bor' : "Qarz yo'q"}
          </p>
        </div>
      </div>

      {/* Today's lessons */}
      {todaySchedules.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Calendar size={15} className="text-indigo-500" /> Bugungi darslar
          </h3>
          <div className="space-y-2">
            {todaySchedules.map((sc) => (
              <div key={sc.entryKey} className="flex items-center gap-3 p-2.5 rounded-xl bg-indigo-50">
                <div className="text-center w-16 bg-indigo-100 text-indigo-700 rounded-xl py-1.5 flex-shrink-0">
                  <p className="text-sm font-bold">{sc.startTime}</p>
                  <p className="text-xs opacity-70">{sc.endTime}</p>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{sc.groupName}</p>
                  <p className="text-xs text-gray-500">{sc.courseName}</p>
                </div>
                {sc.room && (
                  <span className="text-xs bg-white text-gray-600 px-2 py-1 rounded-full">
                    🚪 {sc.room}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent grades */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Star size={15} className="text-amber-500" /> So'nggi baholar
          </h3>
          {recentGrades.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Hali baho yo'q</p>
          ) : (
            <div className="space-y-2">
              {recentGrades.map((g) => {
                const score = Number(g.score);
                const color =
                  score >= 91 ? 'text-violet-600' :
                  score >= 76 ? 'text-emerald-600' :
                  score >= 61 ? 'text-amber-600' : 'text-red-500';
                return (
                  <div key={g.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm text-gray-700 font-medium">{g.lesson?.topic}</p>
                      <p className="text-xs text-gray-400">{g.type}</p>
                    </div>
                    <span className={clsx('font-bold text-lg', color)}>{score}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attendance */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <BookOpen size={15} className="text-emerald-500" /> Davomat
          </h3>
          {attendanceRecords.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Ma'lumot yo'q</p>
          ) : (
            <div className="space-y-2">
              {attendanceRecords.slice(0, 6).map((a) => {
                const statusMap: Record<string, { label: string; cls: string; icon: string }> = {
                  PRESENT: { label: 'Keldi',    cls: 'text-emerald-600 bg-emerald-50', icon: '✅' },
                  ABSENT:  { label: 'Kelmadi',  cls: 'text-red-500 bg-red-50',         icon: '❌' },
                  LATE:    { label: 'Kechikdi', cls: 'text-amber-600 bg-amber-50',     icon: '⏰' },
                  EXCUSED: { label: 'Sababli',  cls: 'text-blue-600 bg-blue-50',       icon: '📋' },
                };
                const s = statusMap[a.status] || { label: a.status, cls: 'text-gray-500 bg-gray-50', icon: '?' };
                return (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm text-gray-700">{a.lesson?.topic || 'Dars'}</p>
                      <p className="text-xs text-gray-400">
                        {a.lesson?.date ? new Date(a.lesson.date).toLocaleDateString('uz-UZ') : ''}
                      </p>
                    </div>
                    <span className={clsx('text-xs px-2 py-1 rounded-full font-medium', s.cls)}>
                      {s.icon} {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Payment quick view */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Wallet size={15} className="text-indigo-500" /> To'lov holati
          </h3>
          <Link
            to="/parent/payments"
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 font-medium"
          >
            Barchasi <ChevronRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className={clsx('p-3 rounded-xl', Number(balance?.debt) > 0 ? 'bg-red-50' : 'bg-emerald-50')}>
            <p className={clsx('text-xs', Number(balance?.debt) > 0 ? 'text-red-400' : 'text-emerald-400')}>
              {Number(balance?.debt) > 0 ? 'Qarz' : 'Holat'}
            </p>
            <p className={clsx('font-bold text-base mt-1',
              Number(balance?.debt) > 0 ? 'text-red-600' : 'text-emerald-600')}>
              {Number(balance?.debt) > 0 ? fmt(Number(balance.debt)) : "✅ Qarz yo'q"}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50">
            <p className="text-xs text-blue-400">Balans</p>
            <p className="font-bold text-base mt-1 text-blue-600">{fmt(Number(balance?.balance || 0))}</p>
          </div>
        </div>

        {Number(balance?.debt) > 0 && (
          <Link
            to="/parent/payments"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
              bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm
              hover:from-indigo-500 hover:to-violet-500 transition"
          >
            <CreditCard size={15} />
            To'lov qilish — {fmt(Number(balance.debt))}
          </Link>
        )}

        {recentPayments.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">So'nggi to'lovlar</p>
            {recentPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">💳</div>
                  <p className="text-xs text-gray-400">
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString('uz-UZ') : '—'}
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-600">{fmt(Number(p.amount))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly schedule */}
      {allSchedules.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Calendar size={15} className="text-indigo-500" /> Haftalik jadval
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((d) => {
              const dayEntries = allSchedules.filter((s) => s.day === d);
              return (
                <div key={d} className={clsx(
                  'p-2 rounded-xl text-center',
                  d === todayDay ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50'
                )}>
                  <p className={clsx('text-xs font-semibold mb-1',
                    d === todayDay ? 'text-indigo-700' : 'text-gray-500')}>
                    {DAYS[d]}
                  </p>
                  {dayEntries.length > 0 ? (
                    dayEntries.map((e) => (
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
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const ParentDashboard = () => {
  const { user } = useAuthStore();
  const [selectedChildIdx, setSelectedChildIdx] = useState(0);

  const { data: profile } = useQuery('parent-profile', async () => {
    const r = await api.get('/auth/me');
    return r.data?.data;
  });

  // Children come from getMe which now includes children for PARENT role
  const children: {
    id: number;
    coinBalance: number;
    status: string;
    user: { id: number; fullName: string; phone: string };
  }[] = profile?.children || [];

  const selectedChild = children[selectedChildIdx] ?? null;
  const studentId = selectedChild?.id ?? null;

  const now = new Date();
  const greeting =
    now.getHours() < 5  ? 'Xayrli tun' :
    now.getHours() < 12 ? 'Xayrli tong' :
    now.getHours() < 17 ? 'Xayrli kun' : 'Xayrli kech';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {greeting}! 👋 {user?.fullName}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {now.toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {children.length === 0 ? (
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">👶</div>
          <p className="text-gray-500 font-medium">Farzandlar ro'yxati topilmadi</p>
          <p className="text-sm text-gray-400 mt-1">Admin orqali farzandingizni tizimga biriktiring</p>
        </div>
      ) : (
        <>
          {/* Child tabs (for multiple children) */}
          {children.length > 1 && (
            <div className="card p-3">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <Users size={11} /> Farzandlar — birini tanlang
              </p>
              <div className="flex gap-2 flex-wrap">
                {children.map((child, i) => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChildIdx(i)}
                    className={clsx(
                      'px-4 py-2 rounded-xl text-sm font-semibold border transition',
                      i === selectedChildIdx
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                    )}
                  >
                    {child.user.fullName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected child profile card */}
          {selectedChild && (
            <div className="card bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                  {selectedChild.user.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-lg truncate">{selectedChild.user.fullName}</h2>
                  <p className="text-indigo-200 text-sm">{selectedChild.user.phone}</p>
                  <span className={clsx(
                    'inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium',
                    selectedChild.status === 'ACTIVE'
                      ? 'bg-emerald-400/30 text-emerald-100'
                      : 'bg-gray-400/30 text-gray-200'
                  )}>
                    {selectedChild.status === 'ACTIVE' ? '✅ Faol' : selectedChild.status}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">🪙 {selectedChild.coinBalance}</div>
                  <p className="text-indigo-200 text-xs">Coin balans</p>
                  {children.length > 1 && (
                    <div className="flex gap-1 mt-2 justify-end">
                      {children.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedChildIdx(i)}
                          className={clsx(
                            'w-2 h-2 rounded-full transition',
                            i === selectedChildIdx ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Child data panel */}
          {studentId && <ChildPanel studentId={studentId} />}
        </>
      )}

      {/* Quick nav */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/parent/payments"
          className="card flex items-center gap-3 p-4 hover:border-indigo-200 hover:bg-indigo-50
            transition border border-transparent cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition">
            <CreditCard size={18} className="text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-800">To'lovlar</p>
            <p className="text-xs text-gray-400">To'lov tarixi</p>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </Link>
        <div className="card flex items-center gap-3 p-4 border border-transparent">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <TrendingDown size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-800">Davomat</p>
            <p className="text-xs text-gray-400">Dars qatnashuvi</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;
