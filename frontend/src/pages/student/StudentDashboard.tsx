import { useQuery } from 'react-query';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import { Link } from 'react-router-dom';
import {
  Calendar, Star, Coins, CreditCard, BookOpen, Clock,
  TrendingUp, AlertCircle, CheckCircle, ChevronRight,
  User, Award, Zap
} from 'lucide-react';
import clsx from 'clsx';

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v));
const DAYS = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const DAYS_FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

function ScoreBadge({ score }: { score: number }) {
  const c =
    score >= 91 ? 'bg-emerald-100 text-emerald-700' :
    score >= 76 ? 'bg-blue-100 text-blue-700' :
    score >= 61 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700';
  return (
    <span className={clsx('font-bold text-sm px-2 py-0.5 rounded-lg', c)}>
      {score.toFixed(0)}
    </span>
  );
}

function AttendanceDot({ present }: { present: boolean }) {
  return (
    <span className={clsx('inline-block w-2.5 h-2.5 rounded-full', present ? 'bg-emerald-500' : 'bg-red-300')} />
  );
}

const StudentDashboard = () => {
  const { user } = useAuthStore();
  const now = new Date();
  const todayDay = now.getDay();
  const greeting =
    now.getHours() < 5 ? 'Xayrli tun' :
    now.getHours() < 12 ? 'Xayrli tong' :
    now.getHours() < 17 ? 'Xayrli kun' : 'Xayrli kech';

  // Profile & student ID
  const { data: profile } = useQuery('student-profile-dash', async () => {
    const r = await api.get('/auth/me');
    return r.data?.data;
  });
  const studentId = profile?.student?.id;
  const coinBalance = profile?.student?.coinBalance || 0;

  // Groups + schedule
  const { data: groupsRaw = [] } = useQuery(['student-groups-dash', studentId], async () => {
    const r = await api.get('/groups?limit=50');
    const raw = r.data?.data;
    return Array.isArray(raw) ? raw : raw?.groups || [];
  }, { enabled: !!studentId });

  // Grades
  const { data: gradesData } = useQuery(['student-grades-dash', studentId], async () => {
    if (!studentId) return null;
    const r = await api.get(`/grades/student/${studentId}?limit=6`);
    return r.data?.data;
  }, { enabled: !!studentId });

  // Payments + balance
  const { data: paymentsData } = useQuery(['student-payments-dash', studentId], async () => {
    if (!studentId) return null;
    const r = await api.get(`/payments/student/${studentId}`);
    return r.data?.data;
  }, { enabled: !!studentId });

  // Payment calc
  const { data: calcData } = useQuery(['student-pay-calc-dash', studentId], async () => {
    if (!studentId) return null;
    const r = await api.get(`/payments/student/${studentId}/calculate`);
    return r.data?.data;
  }, { enabled: !!studentId });

  // Attendance stats
  const { data: attStats } = useQuery(['student-att-dash', studentId], async () => {
    if (!studentId) return null;
    const r = await api.get(`/students/${studentId}/attendance-stats`);
    return r.data?.data;
  }, { enabled: !!studentId });

  // Leaderboard
  const { data: leaderboard = [] } = useQuery('leaderboard-dash', async () => {
    const r = await api.get('/coins/leaderboard?limit=5');
    return r.data?.data || [];
  });

  const avgScore = gradesData?.stats?.avgScore || 0;
  const balance = paymentsData?.balance;
  const debt = Number(balance?.debt || 0);
  const bal = Number(balance?.balance || 0);
  const recentGrades: {
    id: number; score: number; type: string;
    lesson: { topic: string; date: string; group: { name: string } }
  }[] = gradesData?.grades || [];

  const attendancePct = attStats
    ? Math.round((attStats.presentCount / Math.max(attStats.totalLessons, 1)) * 100)
    : null;

  // Today's schedule
  const groups = groupsRaw as {
    id: number; name: string;
    course: { name: string };
    teacher: { user: { fullName: string } };
    schedules?: { id: number; daysOfWeek: number[]; startTime: string; endTime: string; room?: string }[];
  }[];

  const todayLessons = groups.flatMap(g =>
    (g.schedules || [])
      .filter(sc => sc.daysOfWeek.includes(todayDay))
      .map(sc => ({ ...sc, groupName: g.name, courseName: g.course?.name, teacherName: g.teacher?.user?.fullName }))
  ).sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Tomorrow
  const tomorrowDay = (todayDay + 1) % 7;
  const tomorrowLessons = groups.flatMap(g =>
    (g.schedules || [])
      .filter(sc => sc.daysOfWeek.includes(tomorrowDay))
      .map(sc => ({ ...sc, groupName: g.name }))
  ).sort((a, b) => a.startTime.localeCompare(b.startTime));

  const myRank = (leaderboard as { id: number }[]).findIndex(s => s.id === studentId) + 1;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Hero Header ──────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-red-700 to-black text-white px-6 py-5">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 60%)' }} />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-red-200 text-sm font-medium">{greeting} 👋</p>
            <h1 className="text-2xl font-bold mt-0.5">{user?.fullName?.split(' ')[0]}</h1>
            <p className="text-red-200 text-xs mt-1">
              {DAYS_FULL[todayDay]}, {now.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <span className="text-3xl">🎓</span>
          </div>
        </div>

        {/* Quick stats inside hero */}
        <div className="relative grid grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/20">
          {[
            { label: 'O\'rtacha ball', value: avgScore > 0 ? avgScore.toFixed(0) : '—', icon: '📊' },
            { label: 'Davomat', value: attendancePct !== null ? `${attendancePct}%` : '—', icon: '✅' },
            { label: 'Coin', value: fmt(coinBalance), icon: '🪙' },
            { label: debt > 0 ? 'Qarz' : 'Balans', value: debt > 0 ? `${fmt(debt)} s` : `${fmt(bal)} s`, icon: debt > 0 ? '⚠️' : '💚' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-lg">{s.icon}</div>
              <div className="text-base font-bold leading-tight mt-0.5">{s.value}</div>
              <div className="text-red-200 text-[10px] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bugungi darslar ──────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary-600" />
            </div>
            Bugun — {DAYS_FULL[todayDay]}
          </h2>
          <Link to="/student/schedule" className="text-xs text-primary-600 flex items-center gap-0.5 hover:underline">
            Jadval <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {todayLessons.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <div className="text-3xl mb-2">☕</div>
            <p className="text-sm">Bugun dars yo'q</p>
            {tomorrowLessons.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Ertaga {tomorrowLessons.length} ta dars bor
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {todayLessons.map((sc, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-primary-50 border border-primary-100">
                <div className="w-14 text-center bg-primary-600 text-white rounded-xl py-2 flex-shrink-0">
                  <p className="text-xs font-bold">{sc.startTime}</p>
                  <p className="text-[10px] opacity-80">{sc.endTime}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{sc.groupName}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {sc.courseName} · {sc.teacherName}
                  </p>
                </div>
                {sc.room && (
                  <span className="text-[11px] bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
                    🚪 {sc.room}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Guruhlarim ──────────────────────────── */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-gray-600" />
              </div>
              Guruhlarim
            </h2>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Guruh topilmadi</p>
          ) : (
            <div className="space-y-2">
              {groups.map(g => {
                const days = [...new Set((g.schedules || []).flatMap(sc => sc.daysOfWeek))].sort();
                const times = (g.schedules || []).map(sc => `${sc.startTime}–${sc.endTime}`).join(', ');
                return (
                  <div key={g.id} className="p-3 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{g.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{g.course?.name}</p>
                      </div>
                      <span className="text-[11px] bg-black text-white px-2 py-0.5 rounded-full flex-shrink-0">
                        {g.teacher?.user?.fullName?.split(' ')[0]}
                      </span>
                    </div>
                    {days.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex gap-1">
                          {DAYS.map((d, i) => (
                            <span key={i} className={clsx(
                              'text-[10px] w-6 h-6 rounded-full flex items-center justify-center font-medium',
                              days.includes(i)
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-300'
                            )}>
                              {d[0]}
                            </span>
                          ))}
                        </div>
                        {times && <span className="text-[11px] text-gray-400">{times}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── So'nggi baholar ─────────────────────── */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-600" />
              </div>
              So'nggi baholar
            </h2>
            <Link to="/student/grades" className="text-xs text-primary-600 flex items-center gap-0.5 hover:underline">
              Barchasi <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {avgScore > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-800 to-black flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {avgScore.toFixed(0)}
              </div>
              <div>
                <p className="text-xs text-gray-500">O'rtacha ball</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5 w-28">
                  <div className="h-1.5 rounded-full bg-primary-600 transition-all" style={{ width: `${avgScore}%` }} />
                </div>
              </div>
              {attStats && (
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-500">Davomat</p>
                  <p className="font-bold text-sm text-gray-800">{attendancePct}%</p>
                </div>
              )}
            </div>
          )}

          {recentGrades.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Hali baho yo'q</p>
          ) : (
            <div className="space-y-2">
              {recentGrades.map(g => (
                <div key={g.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 font-medium truncate">{g.lesson.topic || '—'}</p>
                    <p className="text-xs text-gray-400">
                      {g.lesson.group?.name} ·{' '}
                      {new Date(g.lesson.date).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <ScoreBadge score={Number(g.score)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── To'lov holati ───────────────────────── */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-primary-600" />
              </div>
              To'lov holati
            </h2>
            <Link to="/student/payments" className="text-xs text-primary-600 flex items-center gap-0.5 hover:underline">
              Batafsil <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="p-3 rounded-xl bg-gray-50 text-center">
              <p className="text-xs text-gray-500 mb-1">Balans</p>
              <p className="font-bold text-emerald-600">{fmt(bal)} so'm</p>
            </div>
            <div className={clsx('p-3 rounded-xl text-center', debt > 0 ? 'bg-red-50' : 'bg-gray-50')}>
              <p className="text-xs text-gray-500 mb-1">Qarz</p>
              <p className={clsx('font-bold', debt > 0 ? 'text-red-600' : 'text-gray-400')}>
                {debt > 0 ? `${fmt(debt)} so'm` : '—'}
              </p>
            </div>
          </div>

          {debt > 0 && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-700 mb-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{fmt(debt)} so'm qarz mavjud</span>
            </div>
          )}

          {calcData && !calcData.message && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Oylik to'lov:</span>
                <span className="font-semibold text-gray-800">{fmt(calcData.monthlyAmount)} so'm</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Dars narxi:</span>
                <span className="text-gray-600">{fmt(calcData.pricePerLesson)} so'm</span>
              </div>
            </div>
          )}

          <Link
            to="/student/payments"
            className="mt-3 w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium text-center flex items-center justify-center gap-2 hover:bg-primary-700 transition"
          >
            <CreditCard className="w-4 h-4" />
            To'lov qilish
          </Link>
        </div>

        {/* ── Coin & Reyting ──────────────────────── */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Coins className="w-4 h-4 text-amber-600" />
              </div>
              Coinlar va Reyting
            </h2>
            <Link to="/student/coins" className="text-xs text-primary-600 flex items-center gap-0.5 hover:underline">
              Batafsil <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Coin balance */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-2xl">🪙</span>
            </div>
            <div>
              <p className="text-xs text-amber-600 font-medium">Joriy coin</p>
              <p className="text-2xl font-black text-amber-700">{fmt(coinBalance)}</p>
            </div>
            {myRank > 0 && (
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-500">Reytingim</p>
                <p className="font-black text-xl text-gray-800">#{myRank}</p>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="space-y-1.5">
            {(leaderboard as { id: number; rank: number; fullName: string; coinBalance: number }[]).slice(0, 5).map((s, i) => {
              const isMe = s.id === studentId;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
              return (
                <div key={s.id} className={clsx(
                  'flex items-center gap-3 py-2 px-3 rounded-xl transition',
                  isMe ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'
                )}>
                  <span className="w-6 text-center text-sm">
                    {medal || <span className="text-xs text-gray-400">{i + 1}</span>}
                  </span>
                  <span className={clsx('text-sm flex-1 truncate', isMe ? 'font-bold text-primary-700' : 'text-gray-700')}>
                    {isMe ? 'Men' : s.fullName}
                  </span>
                  <span className="text-xs font-semibold text-amber-600">🪙 {s.coinBalance}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tezkor havolalar ────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Jadval', icon: Calendar, href: '/student/schedule', bg: 'bg-black text-white', sub: `${todayLessons.length} ta bugun` },
          { label: 'Baholar', icon: TrendingUp, href: '/student/grades', bg: 'bg-primary-600 text-white', sub: avgScore > 0 ? `${avgScore.toFixed(0)} o'rtacha` : 'Hali yo\'q' },
          { label: 'Coinlar', icon: Zap, href: '/student/coins', bg: 'bg-amber-500 text-white', sub: `${fmt(coinBalance)} coin` },
          { label: 'Profil', icon: User, href: '/student/profile', bg: 'bg-gray-700 text-white', sub: 'Sozlamalar' },
        ].map(a => (
          <Link key={a.label} to={a.href}
            className={clsx('rounded-2xl p-4 flex flex-col gap-3 hover:opacity-90 transition', a.bg)}>
            <a.icon className="w-6 h-6 opacity-90" />
            <div>
              <p className="font-bold text-sm">{a.label}</p>
              <p className="text-xs opacity-70 mt-0.5">{a.sub}</p>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
};

export default StudentDashboard;
