/**
 * AttendancePage — Kalendar asosida davomat tizimi
 * Ustoz va Admin uchun umumiy sahifa
 *
 * Qoidalar:
 * - Saqlanmagan kun → EDIT MODE (yangi davomat)
 * - Saqlangan kun   → VIEW MODE (ko'rish) + "Tahrirlash" tugma
 * - Saqlagandan so'ng panel yopiladi; yana bossangiz VIEW MODE da ochiladi
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSearchParams } from 'react-router-dom';
import {
  format, addMonths, subMonths, startOfMonth,
  getDaysInMonth, getDay, isToday, isBefore, startOfDay,
} from 'date-fns';
import { uz } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import {
  ChevronLeft, ChevronRight, Check, X, Clock, BookOpen,
  Save, Users, Coins, AlertCircle, Edit3, Eye,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../api/axios';

// ─── Turlar ──────────────────────────────────────────────────────────────────
type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

interface GroupTab {
  id: number;
  name: string;
  course: { name: string };
}

interface AttRecord {
  studentId: number;
  status: AttStatus;
}

interface LessonSummary {
  id: number;
  date: string;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  totalStudents: number;
  attendance: AttRecord[];
}

interface CalendarData {
  group: {
    id: number;
    name: string;
    course: { name: string };
    schedules: { daysOfWeek: number[]; startTime: string; endTime: string }[];
    groupStudents: {
      student: {
        id: number;
        coinBalance: number;
        user: { id: number; fullName: string; avatarUrl?: string };
      };
    }[];
  };
  lessons: LessonSummary[];
}

// ─── Status config ─────────────────────────────────────────────────────────
const STATUS_CFG: Record<AttStatus, {
  label: string;
  icon: React.ElementType;
  activeClass: string;
  textClass: string;
  dotClass: string;
  bgClass: string;
}> = {
  PRESENT: {
    label: 'Keldi', icon: Check,
    activeClass: 'bg-emerald-500 text-white border-emerald-500',
    textClass:   'text-emerald-700 dark:text-emerald-400',
    dotClass:    'bg-emerald-500',
    bgClass:     'bg-emerald-50 dark:bg-emerald-900/20',
  },
  ABSENT: {
    label: 'Kelmadi', icon: X,
    activeClass: 'bg-red-500 text-white border-red-500',
    textClass:   'text-red-600 dark:text-red-400',
    dotClass:    'bg-red-500',
    bgClass:     'bg-red-50 dark:bg-red-900/20',
  },
  LATE: {
    label: 'Kech', icon: Clock,
    activeClass: 'bg-amber-400 text-white border-amber-400',
    textClass:   'text-amber-700 dark:text-amber-400',
    dotClass:    'bg-amber-400',
    bgClass:     'bg-amber-50 dark:bg-amber-900/20',
  },
  EXCUSED: {
    label: 'Sababli', icon: BookOpen,
    activeClass: 'bg-blue-500 text-white border-blue-500',
    textClass:   'text-blue-700 dark:text-blue-400',
    dotClass:    'bg-blue-500',
    bgClass:     'bg-blue-50 dark:bg-blue-900/20',
  },
};

const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sha', 'Yak'];

function dowToIdx(d: number) { return d === 0 ? 6 : d - 1; }
function initials(name: string) {
  return name.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2);
}

// ─── Asosiy komponent ─────────────────────────────────────────────────────
export default function AttendancePage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const initGroup = searchParams.get('groupId') ? parseInt(searchParams.get('groupId')!) : null;

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(initGroup);
  const [currentMonth, setCurrentMonth]       = useState(new Date());
  const [selectedDate, setSelectedDate]       = useState<string | null>(null);
  const [editMode, setEditMode]               = useState(false);
  const [attState, setAttState]               = useState<Record<number, AttStatus>>({});
  const [coinState, setCoinState]             = useState<Record<number, string>>({});

  const monthStr = format(currentMonth, 'yyyy-MM');

  // ── 1. Guruhlar ─────────────────────────────────────────────────────────
  const { data: groupsRaw } = useQuery<GroupTab[]>(
    'att-groups',
    () => api.get('/groups', { params: { limit: 100, status: 'ACTIVE' } })
      .then(r => {
        const d = r.data?.data;
        return Array.isArray(d) ? d : (d?.groups ?? []);
      }),
    { staleTime: 60_000 },
  );
  const groups: GroupTab[] = groupsRaw ?? [];
  const effectiveGroupId = selectedGroupId ?? (groups[0]?.id ?? null);

  // ── 2. Kalendar ─────────────────────────────────────────────────────────
  const { data: calData, isLoading: calLoading } = useQuery<CalendarData>(
    ['att-calendar', effectiveGroupId, monthStr],
    () => api.get(`/attendance/calendar/${effectiveGroupId}`, { params: { month: monthStr } })
      .then(r => r.data?.data),
    { enabled: !!effectiveGroupId, staleTime: 30_000 },
  );

  // Jadval kunlari
  const scheduledSet = useMemo(() => {
    const s = new Set<number>();
    calData?.group.schedules.forEach(sch => sch.daysOfWeek.forEach(d => s.add(dowToIdx(d))));
    return s;
  }, [calData]);

  // Saqlangan darslar xaritasi: date → LessonSummary
  const lessonMap = useMemo(() => {
    const m = new Map<string, LessonSummary>();
    calData?.lessons.forEach(l => m.set(l.date, l));
    return m;
  }, [calData]);

  // ── 3. Kalendar kunlari ───────────────────────────────────────────────
  const calCells = useMemo(() => {
    const first    = startOfMonth(currentMonth);
    const total    = getDaysInMonth(currentMonth);
    const startIdx = dowToIdx(getDay(first));
    const cells: { day: number | null; dateStr: string | null; wdIdx: number }[] = [];

    for (let i = 0; i < startIdx; i++) cells.push({ day: null, dateStr: null, wdIdx: i });
    for (let d = 1; d <= total; d++) {
      const dt  = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
      const str = format(dt, 'yyyy-MM-dd');
      cells.push({ day: d, dateStr: str, wdIdx: dowToIdx(getDay(dt)) });
    }
    return cells;
  }, [currentMonth]);

  // ── 4. Kun tanlash ───────────────────────────────────────────────────
  const initAttFromLesson = useCallback((dateStr: string, lesson: LessonSummary | undefined) => {
    const students = calData?.group.groupStudents ?? [];
    const init: Record<number, AttStatus> = {};
    // Barcha o'quvchilar uchun standart: PRESENT
    students.forEach(gs => { init[gs.student.id] = 'PRESENT'; });
    // Saqlangan davomatni ustiga yozish
    if (lesson?.attendance?.length) {
      lesson.attendance.forEach(a => { init[a.studentId] = a.status; });
    }
    return init;
  }, [calData]);

  const handleSelectDay = useCallback((dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
      return;
    }
    const lesson = lessonMap.get(dateStr);
    setSelectedDate(dateStr);
    setAttState(initAttFromLesson(dateStr, lesson));
    setCoinState({});
    // Saqlangan dars → Ko'rish rejimi; yangi dars → Tahrirlash rejimi
    setEditMode(!lesson);
  }, [selectedDate, lessonMap, initAttFromLesson]);

  // calData yangilanganda (saqlagandan keyin), agar panel ochiq bo'lsa — ko'rish rejimini yangilash
  useEffect(() => {
    if (!selectedDate || editMode || !calData) return;
    const lesson = lessonMap.get(selectedDate);
    if (!lesson) return;
    setAttState(initAttFromLesson(selectedDate, lesson));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calData]);

  // ── 5. Barchani belgilash ────────────────────────────────────────────
  const markAll = (status: AttStatus) => {
    const all: Record<number, AttStatus> = {};
    (calData?.group.groupStudents ?? []).forEach(gs => { all[gs.student.id] = status; });
    setAttState(all);
  };

  // Tahrirlash rejimini yoqish
  const enterEditMode = () => {
    // attState allaqachon to'g'ri yuklangan (view modedagi holat)
    setEditMode(true);
  };

  // Tahrirlashni bekor qilish
  const cancelEdit = () => {
    const lesson = selectedDate ? lessonMap.get(selectedDate) : undefined;
    if (lesson) {
      // Saqlangan holatga qaytish
      setAttState(initAttFromLesson(selectedDate!, lesson));
      setEditMode(false);
    } else {
      // Yangi dars edi — panelni yopish
      setSelectedDate(null);
    }
    setCoinState({});
  };

  // ── 6. Saqlash ───────────────────────────────────────────────────────
  const saveMutation = useMutation(
    async () => {
      if (!selectedDate || !effectiveGroupId) return;
      const attendanceList = Object.entries(attState).map(([id, status]) => ({
        studentId: parseInt(id), status,
      }));
      await api.post('/attendance/lesson', {
        groupId: effectiveGroupId,
        date: selectedDate,
        topic: format(new Date(selectedDate + 'T12:00:00'), "d-MMMM yyyy 'darsi'", { locale: uz }),
        attendanceList,
      });
      // Coin mukofotlari
      const awards = Object.entries(coinState)
        .filter(([, v]) => v && parseInt(v) > 0)
        .map(([id, amount]) => ({
          studentId: parseInt(id),
          amount: parseInt(amount),
          reason: format(new Date(selectedDate + 'T12:00:00'), "d-MMMM 'darsi'", { locale: uz }) + ' uchun',
        }));
      if (awards.length > 0) {
        await api.post('/coins/award-bulk', { awards });
      }
    },
    {
      onSuccess: () => {
        toast.success('✅ Davomat muvaffaqiyatli saqlandi!');
        qc.invalidateQueries(['att-calendar', effectiveGroupId, monthStr]);
        setCoinState({});
        // Panel yopiladi — o'qituvchi yana bossang VIEW MODE da ko'radi
        setSelectedDate(null);
        setEditMode(false);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message;
        toast.error(msg ?? 'Xato yuz berdi');
      },
    },
  );

  // ── Helpers ──────────────────────────────────────────────────────────
  type DayState = 'none' | 'done' | 'partial' | 'missed' | 'future' | 'today';

  function getDayState(dateStr: string, wdIdx: number): DayState {
    if (!scheduledSet.has(wdIdx)) return 'none';
    const lesson = lessonMap.get(dateStr);
    const dt   = new Date(dateStr);
    const past = isBefore(startOfDay(dt), startOfDay(new Date()));
    if (lesson) {
      return lesson.totalStudents > 0 && lesson.presentCount / lesson.totalStudents >= 0.8
        ? 'done' : 'partial';
    }
    if (isToday(dt)) return 'today';
    if (past)        return 'missed';
    return 'future';
  }

  const students     = calData?.group.groupStudents ?? [];
  const savedLesson  = selectedDate ? lessonMap.get(selectedDate) : undefined;

  // Hozirgi (view yoki edit) holatdagi hisob-kitoblar
  const presentCount = Object.values(attState).filter(s => s === 'PRESENT' || s === 'LATE').length;
  const absentCount  = Object.values(attState).filter(s => s === 'ABSENT').length;
  const lateCount    = Object.values(attState).filter(s => s === 'LATE').length;
  const excusedCount = Object.values(attState).filter(s => s === 'EXCUSED').length;
  const totalCount   = students.length;

  // Oy statistikasi
  const monthStats = useMemo(() => {
    if (!calData) return null;
    const scheduled = calCells.filter(c => c.dateStr && scheduledSet.has(c.wdIdx) && c.day !== null);
    const done      = scheduled.filter(c => c.dateStr && lessonMap.has(c.dateStr)).length;
    const past      = scheduled.filter(c => c.dateStr && isBefore(startOfDay(new Date(c.dateStr)), startOfDay(new Date()))).length;
    return { total: scheduled.length, done, missed: Math.max(0, past - done) };
  }, [calData, calCells, scheduledSet, lessonMap]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      {/* ── SARLAVHA ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Davomat</h1>
          {calData && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {calData.group.name} · {calData.group.course.name}
            </p>
          )}
        </div>
        {/* Oy navigatsiyasi */}
        <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5">
          <button onClick={() => { setCurrentMonth(m => subMonths(m, 1)); setSelectedDate(null); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[108px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: uz })}
          </span>
          <button onClick={() => { setCurrentMonth(m => addMonths(m, 1)); setSelectedDate(null); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── GURUH TABLAR ──────────────────────────────────────────────── */}
      {groups.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {groups.map(g => (
            <button key={g.id}
              onClick={() => { setSelectedGroupId(g.id); setSelectedDate(null); }}
              className={clsx(
                'flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                g.id === effectiveGroupId
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-300',
              )}>
              {g.name}
              <span className={clsx('ml-1.5 text-xs', g.id === effectiveGroupId ? 'text-indigo-200' : 'text-gray-400')}>
                {g.course.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {!effectiveGroupId ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-16 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-gray-200 dark:text-gray-700" />
          <p className="text-sm text-gray-400 dark:text-gray-500">Guruh topilmadi</p>
        </div>
      ) : (
        <>
          {/* ── KALENDAR KARTI ─────────────────────────────────────────── */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">

            {/* Hafta kunlari */}
            <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
              {WEEKDAYS.map(d => (
                <div key={d} className="py-2.5 text-center text-xs font-semibold text-gray-400 dark:text-gray-500">
                  {d}
                </div>
              ))}
            </div>

            {/* Kunlar */}
            {calLoading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calCells.map((cell, i) => {
                  if (!cell.day || !cell.dateStr) {
                    return <div key={`e-${i}`} className="aspect-square" />;
                  }
                  const state      = getDayState(cell.dateStr, cell.wdIdx);
                  const isSelected = selectedDate === cell.dateStr;
                  const todayFlag  = isToday(new Date(cell.dateStr));
                  const clickable  = state !== 'none';
                  const isSaved    = state === 'done' || state === 'partial';

                  return (
                    <button key={cell.dateStr}
                      onClick={() => clickable && handleSelectDay(cell.dateStr!)}
                      disabled={!clickable}
                      className={clsx(
                        'aspect-square flex flex-col items-center justify-center gap-0.5 transition-all',
                        clickable ? 'cursor-pointer' : 'cursor-default',
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/40'
                          : clickable && 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                      )}>

                      <span className={clsx(
                        'w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-medium transition-all',
                        isSelected
                          ? 'bg-indigo-600 text-white font-bold'
                          : todayFlag && !isSaved
                            ? 'ring-2 ring-indigo-400 text-indigo-600 dark:text-indigo-400 font-semibold'
                            : state === 'none'
                              ? 'text-gray-300 dark:text-gray-700'
                              : 'text-gray-800 dark:text-gray-200',
                      )}>
                        {cell.day}
                      </span>

                      {/* Holat niqtasi */}
                      <span className={clsx(
                        'w-1.5 h-1.5 rounded-full transition-all',
                        state === 'none'    ? 'opacity-0' : 'opacity-100',
                        state === 'done'    && 'bg-emerald-500',
                        state === 'partial' && 'bg-amber-400',
                        state === 'missed'  && 'bg-red-400',
                        state === 'future'  && 'bg-gray-300 dark:bg-gray-600',
                        state === 'today'   && 'bg-indigo-500 animate-pulse',
                      )} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend + statistika */}
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4 flex-wrap">
                {[
                  { color: 'bg-emerald-500', label: 'Belgilangan' },
                  { color: 'bg-amber-400',   label: 'Qisman' },
                  { color: 'bg-red-400',     label: 'Belgilanmagan' },
                  { color: 'bg-gray-300 dark:bg-gray-600', label: 'Rejalashtirilgan' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', color)} />
                    <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
              {monthStats && (
                <div className="flex items-center gap-3 text-xs font-medium">
                  <span className="text-gray-400 dark:text-gray-500">{monthStats.done}/{monthStats.total} dars</span>
                  {monthStats.missed > 0 && (
                    <span className="text-red-500">{monthStats.missed} belgilanmagan</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── KUN DETAIL PANEL ───────────────────────────────────────── */}
          {selectedDate && calData && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">

              {/* Panel header */}
              <div className={clsx(
                'flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800',
                savedLesson && !editMode && 'bg-emerald-50/60 dark:bg-emerald-950/20',
              )}>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">
                    {format(new Date(selectedDate + 'T12:00:00'), "d MMMM, EEEE", { locale: uz })}
                  </p>
                  <p className="text-xs mt-0.5 flex items-center gap-1.5">
                    {savedLesson && !editMode ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <Check className="w-3 h-3" /> Saqlangan
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-gray-400 dark:text-gray-500">
                          {presentCount} keldi · {absentCount} kelmadi · {lateCount} kech · {excusedCount} sababli
                        </span>
                      </>
                    ) : savedLesson && editMode ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        ✏️ Tahrirlash rejimi
                      </span>
                    ) : (
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                        Yangi davomat
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {/* Ko'rish rejimida → Tahrirlash tugmasi */}
                  {savedLesson && !editMode && (
                    <button
                      onClick={enterEditMode}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 transition">
                      <Edit3 className="w-3 h-3" />
                      Tahrirlash
                    </button>
                  )}
                  <button onClick={() => { setSelectedDate(null); setEditMode(false); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition ml-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {students.length === 0 ? (
                <div className="py-12 text-center">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-200 dark:text-gray-700" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">Bu guruhda o'quvchilar yo'q</p>
                </div>
              ) : (
                <>
                  {/* ══ KO'RISH REJIMI (saqlangan davomat) ══ */}
                  {savedLesson && !editMode ? (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800/80">
                      {students.map(({ student }, idx) => {
                        const saved   = savedLesson.attendance.find(a => a.studentId === student.id);
                        const status  = saved?.status ?? null; // null = belgilanmagan
                        const cfg     = status ? STATUS_CFG[status] : null;

                        return (
                          <div key={student.id} className={clsx(
                            'flex items-center gap-3 px-4 py-3 transition-colors',
                            !saved && 'bg-gray-50/60 dark:bg-gray-800/20',
                          )}>
                            {/* Tartib raqami */}
                            <span className="text-xs text-gray-300 dark:text-gray-700 w-5 text-right flex-shrink-0">
                              {idx + 1}
                            </span>

                            {/* Avatar */}
                            <div className={clsx(
                              'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors',
                              cfg ? cfg.activeClass : 'bg-gray-200 dark:bg-gray-700 text-gray-400',
                            )}>
                              {initials(student.user.fullName)}
                            </div>

                            {/* Ism */}
                            <div className="flex-1 min-w-0">
                              <p className={clsx(
                                'text-sm font-medium truncate',
                                status === 'ABSENT'
                                  ? 'text-gray-400 dark:text-gray-500 line-through'
                                  : 'text-gray-800 dark:text-gray-200',
                              )}>
                                {student.user.fullName}
                              </p>
                              {!saved && (
                                <p className="text-xs text-gray-400 dark:text-gray-500">Belgilanmagan</p>
                              )}
                            </div>

                            {/* Status badge */}
                            {cfg ? (
                              <span className={clsx(
                                'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
                                cfg.bgClass, cfg.textClass,
                              )}>
                                <cfg.icon className="w-3 h-3" />
                                {cfg.label}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300 dark:text-gray-600 px-2">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* ══ TAHRIRLASH / YANGI DAVOMAT REJIMI ══ */
                    <>
                      {/* Tez belgilash toolbar */}
                      <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 flex items-center justify-between gap-2 flex-wrap border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-gray-500 dark:text-gray-400 mr-0.5">Barchasi:</span>
                          {(Object.keys(STATUS_CFG) as AttStatus[]).map(s => {
                            const cfg  = STATUS_CFG[s];
                            const Icon = cfg.icon;
                            return (
                              <button key={s} onClick={() => markAll(s)}
                                className={clsx(
                                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                                  cfg.bgClass, cfg.textClass,
                                  'border-current/20',
                                )}>
                                <Icon className="w-3 h-3" />
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <span className="text-emerald-600 dark:text-emerald-400">{presentCount} keldi</span>
                          <span className="text-red-500">{absentCount} kelmadi</span>
                          <span className="text-gray-300 dark:text-gray-600">/ {totalCount}</span>
                        </div>
                      </div>

                      {/* O'quvchilar ro'yxati — tahrirlash */}
                      <div className="divide-y divide-gray-50 dark:divide-gray-800/80">
                        {students.map(({ student }, idx) => {
                          const status = attState[student.id] ?? 'PRESENT';
                          const cfg    = STATUS_CFG[status];
                          return (
                            <div key={student.id} className={clsx(
                              'flex items-center gap-3 px-4 py-2.5 transition-colors',
                              status === 'ABSENT' ? 'bg-red-50/30 dark:bg-red-950/10' : '',
                            )}>
                              {/* Tartib raqami */}
                              <span className="text-xs text-gray-300 dark:text-gray-700 w-5 text-right flex-shrink-0">
                                {idx + 1}
                              </span>

                              {/* Avatar */}
                              <div className={clsx(
                                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 transition-colors',
                                cfg.activeClass.split(' ')[0], // faqat bg rang
                              )}>
                                {initials(student.user.fullName)}
                              </div>

                              {/* Ism */}
                              <span className={clsx(
                                'flex-1 text-sm font-medium truncate transition-colors',
                                status === 'ABSENT'
                                  ? 'text-gray-400 dark:text-gray-500 line-through'
                                  : 'text-gray-800 dark:text-gray-200',
                              )}>
                                {student.user.fullName}
                              </span>

                              {/* Status tugmalari */}
                              <div className="flex gap-1 flex-shrink-0">
                                {(Object.keys(STATUS_CFG) as AttStatus[]).map(s => {
                                  const Icon   = STATUS_CFG[s].icon;
                                  const active = status === s;
                                  return (
                                    <button key={s}
                                      onClick={() => setAttState(p => ({ ...p, [student.id]: s }))}
                                      title={STATUS_CFG[s].label}
                                      className={clsx(
                                        'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                                        active
                                          ? clsx(STATUS_CFG[s].activeClass, 'scale-110 shadow-sm')
                                          : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                                      )}>
                                      <Icon className="w-3.5 h-3.5" />
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Coin input */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Coins className="w-3.5 h-3.5 text-amber-400" />
                                <input
                                  type="number" min="0" max="999" step="1"
                                  placeholder="0"
                                  disabled={status === 'ABSENT'}
                                  value={coinState[student.id] ?? ''}
                                  onChange={e => setCoinState(p => ({ ...p, [student.id]: e.target.value }))}
                                  className={clsx(
                                    'w-14 text-center text-xs border rounded-lg py-1.5 px-1 outline-none transition-all',
                                    'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
                                    'text-gray-700 dark:text-gray-300',
                                    'focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-600 focus:border-transparent',
                                    status === 'ABSENT' && 'opacity-30 cursor-not-allowed',
                                  )}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Saqlash / Bekor qilish */}
                      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                        {savedLesson && (
                          <button
                            onClick={cancelEdit}
                            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                            Bekor
                          </button>
                        )}
                        <button
                          onClick={() => saveMutation.mutate()}
                          disabled={saveMutation.isLoading}
                          className={clsx(
                            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all',
                            saveMutation.isLoading
                              ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-[0.99]',
                          )}>
                          <Save className="w-4 h-4" />
                          {saveMutation.isLoading
                            ? 'Saqlanmoqda...'
                            : savedLesson
                              ? `Yangilash · ${presentCount}/${totalCount}`
                              : `Saqlash · ${presentCount}/${totalCount} keldi`}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Kun tanlanmagan hint */}
          {!selectedDate && !calLoading && calData && (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              <Eye className="w-8 h-8 text-gray-200 dark:text-gray-700" />
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Davomatni ko'rish yoki belgilash uchun<br />
                kalendardagi dars kuniga bosing
              </p>
              <div className="flex flex-wrap justify-center gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Saqlangan</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Belgilanmagan</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block animate-pulse" /> Bugun</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
