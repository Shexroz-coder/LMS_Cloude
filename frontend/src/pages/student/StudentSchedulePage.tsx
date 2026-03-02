import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';
import { Calendar, Clock, MapPin, BookOpen } from 'lucide-react';

const DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const DAYS_SHORT = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

interface Schedule {
  id: number;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  room?: string;
}

interface ScheduleEntry {
  id: number;
  entryKey: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  group: {
    id: number;
    name: string;
    course: { name: string };
    teacher?: { fullName: string };
  };
}

const StudentSchedulePage = () => {
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState<number>(today);

  const { data: groups = [], isLoading } = useQuery('student-schedule', async () => {
    const r = await api.get('/groups?limit=50');
    const raw = r.data?.data;
    return Array.isArray(raw) ? raw : raw?.groups || [];
  });

  // Expand each schedule's daysOfWeek array into individual entries
  const scheduleEntries: ScheduleEntry[] = (groups as {
    id: number;
    name: string;
    course: { name: string };
    teacher?: { fullName: string };
    schedules?: Schedule[];
  }[]).flatMap(g =>
    (g.schedules || []).flatMap(sc =>
      (sc.daysOfWeek || []).map(dayNum => ({
        id: sc.id,
        entryKey: `${sc.id}-${dayNum}`,
        dayOfWeek: dayNum,
        startTime: sc.startTime,
        endTime: sc.endTime,
        room: sc.room,
        group: { id: g.id, name: g.name, course: g.course, teacher: g.teacher },
      }))
    )
  );

  // Group entries by day of week
  const byDay: Record<number, ScheduleEntry[]> = {};
  scheduleEntries.forEach(entry => {
    if (!byDay[entry.dayOfWeek]) byDay[entry.dayOfWeek] = [];
    byDay[entry.dayOfWeek].push(entry);
  });

  const daysWithSchedule = Object.keys(byDay).map(Number).sort();
  const selectedEntries = (byDay[selectedDay] || []).sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Total weekly lessons
  const totalWeekly = scheduleEntries.length;
  const todayCount = byDay[today]?.length || 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-red-600 via-red-700 to-black p-5 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Calendar size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Dars Jadvalim</h1>
            <p className="text-red-200 text-xs">Bugun: {DAYS[today]}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{totalWeekly}</p>
            <p className="text-red-200 text-xs mt-0.5">Haftalik dars</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{daysWithSchedule.length}</p>
            <p className="text-red-200 text-xs mt-0.5">Dars kuni</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{todayCount}</p>
            <p className="text-red-200 text-xs mt-0.5">Bugun</p>
          </div>
        </div>
      </div>

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {DAYS_SHORT.map((day, i) => {
          const hasLesson = !!byDay[i];
          const isToday = i === today;
          const isSelected = i === selectedDay;
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={clsx(
                'flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border',
                isSelected
                  ? 'bg-red-600 text-white border-red-600 shadow-md'
                  : isToday
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : hasLesson
                  ? 'bg-white text-gray-700 border-gray-200 hover:border-red-300 hover:bg-red-50'
                  : 'bg-gray-50 text-gray-300 border-gray-100 cursor-default'
              )}
            >
              <span>{day}</span>
              {hasLesson && (
                <span className={clsx(
                  'w-1.5 h-1.5 rounded-full mt-1',
                  isSelected ? 'bg-white/70' : isToday ? 'bg-red-400' : 'bg-gray-300'
                )} />
              )}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="card text-center py-12">
          <div className="animate-spin w-7 h-7 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Yuklanmoqda...</p>
        </div>
      )}

      {/* Selected day content */}
      {!isLoading && (
        <>
          {/* Day header */}
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-2 h-2 rounded-full',
              selectedDay === today ? 'bg-red-500' : 'bg-gray-300'
            )} />
            <h2 className={clsx(
              'font-bold text-base',
              selectedDay === today ? 'text-red-700' : 'text-gray-700'
            )}>
              {DAYS[selectedDay]}
            </h2>
            {selectedDay === today && (
              <span className="text-xs bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full font-medium">
                Bugun
              </span>
            )}
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">
              {selectedEntries.length > 0 ? `${selectedEntries.length} ta dars` : 'Dars yo\'q'}
            </span>
          </div>

          {/* No lessons for selected day */}
          {selectedEntries.length === 0 && (
            <div className="card text-center py-14">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Calendar size={28} className="text-gray-300" />
              </div>
              <h3 className="font-semibold text-gray-600 text-sm">Bu kunda dars yo'q</h3>
              <p className="text-gray-400 text-xs mt-1">
                {daysWithSchedule.length > 0
                  ? `Darslar: ${daysWithSchedule.map(d => DAYS_SHORT[d]).join(', ')}`
                  : 'Jadval hali belgilanmagan'}
              </p>
            </div>
          )}

          {/* Lesson cards */}
          <div className="space-y-3">
            {selectedEntries.map((entry, idx) => (
              <div
                key={entry.entryKey}
                className={clsx(
                  'rounded-2xl border p-4 flex items-start gap-4 transition',
                  selectedDay === today
                    ? 'border-red-100 bg-gradient-to-r from-red-50/60 to-white'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                )}
              >
                {/* Time block */}
                <div className={clsx(
                  'flex-shrink-0 w-16 rounded-xl py-3 flex flex-col items-center text-center',
                  selectedDay === today ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'
                )}>
                  <p className="text-sm font-bold leading-tight">{entry.startTime}</p>
                  <div className={clsx('w-4 h-px my-1', selectedDay === today ? 'bg-red-300' : 'bg-gray-300')} />
                  <p className="text-xs opacity-80">{entry.endTime}</p>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{entry.group.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <BookOpen size={12} className="text-red-400 flex-shrink-0" />
                        <p className="text-sm text-gray-500 truncate">{entry.group.course.name}</p>
                      </div>
                    </div>
                    <div className={clsx(
                      'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                      selectedDay === today ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                    )}>
                      {idx + 1}
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-3 mt-2.5">
                    {entry.group.teacher && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        👨‍🏫 {entry.group.teacher.fullName}
                      </span>
                    )}
                    {entry.room && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin size={11} className="text-gray-400" />
                        {entry.room}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={11} />
                      {entry.startTime} – {entry.endTime}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Full week overview (if has lessons) */}
      {!isLoading && daysWithSchedule.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">Haftalik jadval xulasasi</h3>
          <div className="space-y-2">
            {daysWithSchedule.map(dayNum => (
              <div
                key={dayNum}
                onClick={() => setSelectedDay(dayNum)}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition',
                  selectedDay === dayNum
                    ? 'bg-red-50 border border-red-100'
                    : 'hover:bg-gray-50 border border-transparent'
                )}
              >
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                  dayNum === today
                    ? 'bg-red-600 text-white'
                    : selectedDay === dayNum
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                )}>
                  {DAYS_SHORT[dayNum]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={clsx(
                    'text-sm font-medium',
                    dayNum === today ? 'text-red-700' : 'text-gray-700'
                  )}>
                    {DAYS[dayNum]}
                    {dayNum === today && <span className="ml-1.5 text-xs text-red-400">(Bugun)</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {byDay[dayNum].map(e => `${e.startTime} – ${e.group.name}`).join(' · ')}
                  </p>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {byDay[dayNum].length} dars
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && scheduleEntries.length === 0 && (
        <div className="card text-center py-16">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Calendar size={36} className="text-red-300" />
          </div>
          <h2 className="text-lg font-bold text-gray-700">Jadval topilmadi</h2>
          <p className="text-gray-400 text-sm mt-1">Guruhingiz uchun jadval hali belgilanmagan</p>
        </div>
      )}
    </div>
  );
};

export default StudentSchedulePage;
