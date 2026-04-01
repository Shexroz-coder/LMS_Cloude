import { useState, useMemo } from 'react';
import { useQuery } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Calendar, BookOpen, Umbrella, AlertTriangle } from 'lucide-react';

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];
const DAYS_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";

interface CalendarDay {
  date: string;
  dayOfWeek: number;
  isLessonDay: boolean;
  isHoliday: boolean;
  isHolidayLesson: boolean;
  holidayName?: string;
}

interface MonthData {
  year: number;
  month: number;
  standardLessons: number;
  actualLessons: number;
  holidayLessons: number;
  baseMonthlyPrice: number;
  discountAmount: number;
  monthlyAmount: number;
  pricePerLesson: number;
  holidayCredit: number;
  adjustedAmount: number;
  calendarDays: CalendarDay[];
}

interface GroupCalendar {
  groupId: number;
  groupName: string;
  courseName: string;
  schedule: Array<{ daysOfWeek: number[]; startTime: string; endTime: string; room?: string }>;
  currentMonth: MonthData;
  nextMonth: {
    year: number;
    month: number;
    standardLessons: number;
    actualLessons: number;
    holidayLessons: number;
    pricePerLesson: number;
    holidayCredit: number;
    adjustedAmount: number;
  };
  isProRata?: boolean;
  proRataLessons?: number;
  joinedAt?: string;
}

interface CalendarData {
  studentId: number;
  fullName: string;
  currentDebt: number;
  currentBalance: number;
  summary: {
    totalMonthlyAmount: number;
    totalHolidayCredit: number;
    totalAdjustedAmount: number;
    nextMonthAdjustedAmount: number;
    nextMonthHolidayCredit: number;
  };
  groups: GroupCalendar[];
}

export default function CalendarPage({ studentId }: { studentId?: number }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);

  // Agar studentId berilmagan bo'lsa, o'zimizniki
  const resolvedStudentId = studentId;

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const { data, isLoading, error } = useQuery<CalendarData>(
    ['student-calendar', resolvedStudentId, monthStr],
    async () => {
      if (!resolvedStudentId) return null;
      const res = await api.get(`/payments/student/${resolvedStudentId}/calendar?month=${monthStr}`);
      return res.data.data;
    },
    { enabled: !!resolvedStudentId }
  );

  const goMonth = (dir: -1 | 1) => {
    let m = month + dir;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  };

  const activeGroup = useMemo(() => {
    if (!data?.groups.length) return null;
    if (selectedGroup !== null) return data.groups.find(g => g.groupId === selectedGroup) || data.groups[0];
    return data.groups[0];
  }, [data, selectedGroup]);

  // Kalendar gridi yaratish
  const calendarGrid = useMemo(() => {
    if (!activeGroup) return [];
    const days = activeGroup.currentMonth.calendarDays;
    if (!days.length) return [];

    // Oyning 1-kuni qaysi hafta kuniga to'g'ri keladi
    const firstDayOfWeek = days[0].dayOfWeek;
    // Dushanba = 0 dan boshlaymiz (1=Du ... 0=Ya -> 6 ga aylanadi)
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const grid: (CalendarDay | null)[] = [];
    for (let i = 0; i < startOffset; i++) grid.push(null);
    for (const d of days) grid.push(d);
    // Oxirigacha to'ldirish
    while (grid.length % 7 !== 0) grid.push(null);

    return grid;
  }, [activeGroup]);

  if (!resolvedStudentId) {
    return <div className="p-6 text-center text-gray-500">O'quvchi tanlanmagan</div>;
  }

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-6 text-center text-red-500">Ma'lumot olishda xato</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Calendar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Dars Kalendari</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{data.fullName}</p>
        </div>
      </div>

      {/* Oy navigatsiya */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
        <button onClick={() => goMonth(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button onClick={() => goMonth(1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Guruh tanlash (agar bir nechta guruh bo'lsa) */}
      {data.groups.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {data.groups.map(g => (
            <button
              key={g.groupId}
              onClick={() => setSelectedGroup(g.groupId)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition',
                (selectedGroup === g.groupId || (!selectedGroup && g.groupId === data.groups[0].groupId))
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              )}
            >
              {g.courseName}
            </button>
          ))}
        </div>
      )}

      {activeGroup && (
        <>
          {/* To'lov summasi kartasi */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                {activeGroup.courseName} — {activeGroup.groupName}
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100 dark:bg-gray-700">
              <StatCard
                label={activeGroup.isProRata ? "Pro-rata darslar" : "Standart darslar"}
                value={String(activeGroup.isProRata && activeGroup.proRataLessons ? activeGroup.proRataLessons : activeGroup.currentMonth.standardLessons)}
                sub={activeGroup.isProRata ? "pro-rata" : "bayramlarsiz"}
                color="text-gray-900 dark:text-gray-100"
              />
              <StatCard
                label="Haqiqiy darslar"
                value={String(activeGroup.currentMonth.actualLessons)}
                sub={activeGroup.currentMonth.holidayLessons > 0
                  ? `${activeGroup.currentMonth.holidayLessons} ta dam olishda`
                  : 'dam olish yo\'q'}
                color={activeGroup.currentMonth.holidayLessons > 0 ? 'text-orange-600' : 'text-emerald-600'}
              />
              <StatCard
                label="1 dars narxi"
                value={fmt(activeGroup.currentMonth.pricePerLesson)}
                sub={`${fmt(activeGroup.currentMonth.monthlyAmount)} / ${activeGroup.isProRata && activeGroup.proRataLessons ? activeGroup.proRataLessons : activeGroup.currentMonth.standardLessons}`}
                color="text-indigo-600"
              />
              <StatCard
                label="Dam olish tushimi"
                value={activeGroup.currentMonth.holidayCredit > 0 ? `-${fmt(activeGroup.currentMonth.holidayCredit)}` : '0'}
                sub={activeGroup.currentMonth.holidayLessons > 0
                  ? `${activeGroup.currentMonth.holidayLessons} × ${fmt(activeGroup.currentMonth.pricePerLesson)}`
                  : 'Dam olish yo\'q'}
                color={activeGroup.currentMonth.holidayCredit > 0 ? 'text-green-600' : 'text-gray-400'}
              />
            </div>

            {/* To'lov xulosasi */}
            <div className="p-4 space-y-2">
              {activeGroup.isProRata && (
                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    📐 Pro-rata to'lov
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    O'quvchi {activeGroup.joinedAt ? new Date(activeGroup.joinedAt).toLocaleDateString('uz-UZ') : 'asl vaqtda'} qo'shilgan. {activeGroup.proRataLessons} ta dars to'lanadi.
                  </p>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Oylik narx (chegirmadan keyin)</span>
                <span className="font-medium">{fmt(activeGroup.currentMonth.monthlyAmount)}</span>
              </div>
              {activeGroup.currentMonth.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Chegirma</span>
                  <span className="text-green-600 font-medium">-{fmt(activeGroup.currentMonth.discountAmount)}</span>
                </div>
              )}
              {activeGroup.currentMonth.holidayCredit > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Dam olish kunlari tushimi</span>
                  <span className="text-green-600 font-medium">-{fmt(activeGroup.currentMonth.holidayCredit)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t dark:border-gray-700">
                <span className="text-gray-900 dark:text-gray-100">To'lanishi kerak</span>
                <span className="text-indigo-600">{fmt(activeGroup.currentMonth.adjustedAmount)}</span>
              </div>
            </div>

            {/* Keyingi oy */}
            {activeGroup.nextMonth.holidayLessons > 0 && (
              <div className="px-4 pb-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Keyingi oy ({MONTH_NAMES[activeGroup.nextMonth.month - 1]}): {activeGroup.nextMonth.holidayLessons} ta dam olish kuni,
                      to'lov: <b>{fmt(activeGroup.nextMonth.adjustedAmount)}</b>
                      {' '}(tushim: -{fmt(activeGroup.nextMonth.holidayCredit)})
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Kalendar gridi */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarGrid.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} className="aspect-square"></div>;

                const dateNum = parseInt(day.date.split('-')[2]);
                const isToday = day.date === new Date().toISOString().slice(0, 10);
                const isBeforeJoined = activeGroup.isProRata && activeGroup.joinedAt
                  ? day.date < activeGroup.joinedAt.split('T')[0]
                  : false;

                return (
                  <div
                    key={day.date}
                    className={clsx(
                      'aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative transition',
                      isToday && 'ring-2 ring-indigo-500',
                      isBeforeJoined && 'opacity-40',
                      day.isHolidayLesson && !isBeforeJoined && 'bg-red-100 dark:bg-red-900/30',
                      day.isLessonDay && !day.isHoliday && !isBeforeJoined && 'bg-emerald-100 dark:bg-emerald-900/30',
                      day.isHoliday && !day.isLessonDay && !isBeforeJoined && 'bg-orange-50 dark:bg-orange-900/20',
                      !day.isLessonDay && !day.isHoliday && 'bg-gray-50 dark:bg-gray-700/30',
                      isBeforeJoined && day.isLessonDay && 'bg-gray-100 dark:bg-gray-600/30',
                    )}
                    title={isBeforeJoined ? 'Qo\'shilishdan oldin' : day.holidayName || (day.isLessonDay ? 'Dars kuni' : '')}
                  >
                    <span className={clsx(
                      'font-medium',
                      isBeforeJoined && 'text-gray-300 dark:text-gray-600',
                      !isBeforeJoined && day.isHolidayLesson && 'text-red-700 dark:text-red-300 line-through',
                      !isBeforeJoined && day.isLessonDay && !day.isHoliday && 'text-emerald-700 dark:text-emerald-300',
                      !isBeforeJoined && day.isHoliday && !day.isLessonDay && 'text-orange-600 dark:text-orange-300',
                      !isBeforeJoined && !day.isLessonDay && !day.isHoliday && 'text-gray-400 dark:text-gray-500',
                    )}>
                      {dateNum}
                    </span>
                    {!isBeforeJoined && day.isLessonDay && !day.isHoliday && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">●</span>
                    )}
                    {!isBeforeJoined && day.isHolidayLesson && (
                      <Umbrella className="w-3 h-3 text-red-500 absolute top-0.5 right-0.5" />
                    )}
                    {!isBeforeJoined && day.isHoliday && !day.isLessonDay && (
                      <span className="text-[10px] text-orange-500">🏖</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t dark:border-gray-700">
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <div className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300"></div>
                Dars kuni
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 border border-red-300"></div>
                Dam olish (dars tushdi)
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <div className="w-3 h-3 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200"></div>
                Bayram/dam olish
              </div>
              {activeGroup.isProRata && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-600/30 opacity-40 border border-gray-300"></div>
                  Qo'shilishdan oldin
                </div>
              )}
            </div>
          </div>

          {/* Umumiy balans */}
          <div className="grid grid-cols-2 gap-3">
            <div className={clsx(
              'bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm',
              data.currentDebt > 0 ? 'border-l-4 border-red-500' : 'border-l-4 border-emerald-500'
            )}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Joriy qarz</p>
              <p className={clsx(
                'text-lg font-bold',
                data.currentDebt > 0 ? 'text-red-600' : 'text-emerald-600'
              )}>
                {data.currentDebt > 0 ? fmt(data.currentDebt) : "Qarz yo'q"}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Balans</p>
              <p className="text-lg font-bold text-blue-600">{fmt(data.currentBalance)}</p>
            </div>
          </div>
        </>
      )}

      {!activeGroup && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Faol guruh topilmadi</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-3">
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <p className={clsx('text-base font-bold', color)}>{value}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</p>
    </div>
  );
}
