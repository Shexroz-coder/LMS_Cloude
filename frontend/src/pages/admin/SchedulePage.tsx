import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';

const DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const DAYS_SHORT = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const WORK_DAYS = [1, 2, 3, 4, 5, 6]; // Mon - Sat

const COLORS = [
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-orange-100 text-orange-700 border-orange-200',
];

interface Schedule {
  id: number;
  daysOfWeek: number[];  // array of day numbers
  startTime: string;
  endTime: string;
  room?: string;
}

interface Group {
  id: number;
  name: string;
  course: { name: string };
  teacher?: { user: { fullName: string } };
  schedules: Schedule[];  // backend relation name is 'schedules'
}

const SchedulePage = () => {
  const [view, setView] = useState<'week' | 'list'>('week');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const { data: groups = [], isLoading } = useQuery<Group[]>('schedule-groups', async () => {
    const r = await api.get('/groups?limit=100&status=ACTIVE');
    const d = r.data?.data;
    return Array.isArray(d) ? d : d?.groups || [];
  });

  // Build schedule map: day -> schedule entries with group info
  // Each schedule has daysOfWeek: number[] so one schedule can appear on multiple days
  type Entry = { schedule: Schedule; group: Group; colorIdx: number };
  const byDay: Record<number, Entry[]> = {};
  WORK_DAYS.forEach(d => { byDay[d] = []; });

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.course?.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.teacher?.user?.fullName?.toLowerCase().includes(search.toLowerCase())
  );

  filteredGroups.forEach((group, idx) => {
    (group.schedules || []).forEach(sc => {
      (sc.daysOfWeek || []).forEach(day => {
        if (byDay[day]) {
          byDay[day].push({ schedule: sc, group, colorIdx: idx % COLORS.length });
        }
      });
    });
  });

  // Sort each day's entries by startTime
  WORK_DAYS.forEach(d => {
    byDay[d].sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime));
  });

  const today = new Date().getDay();
  const totalSchedules = filteredGroups.reduce((s, g) => s + (g.schedules?.length || 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dars Jadvali</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filteredGroups.length} ta guruh · {totalSchedules} ta jadval
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('week')}
            className={clsx("px-3 py-1.5 rounded-xl text-sm font-medium border transition", view === 'week' ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}
          >
            📅 Hafta
          </button>
          <button
            onClick={() => setView('list')}
            className={clsx("px-3 py-1.5 rounded-xl text-sm font-medium border transition", view === 'list' ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}
          >
            📋 Ro'yxat
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <input
          className="input"
          placeholder="🔍 Guruh yoki ustoz nomi..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Day filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedDay(null)}
          className={clsx("px-3 py-1.5 rounded-xl text-xs font-medium border transition", selectedDay === null ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200")}
        >
          Hammasi
        </button>
        {WORK_DAYS.map(d => (
          <button
            key={d}
            onClick={() => setSelectedDay(selectedDay === d ? null : d)}
            className={clsx(
              "px-3 py-1.5 rounded-xl text-xs font-medium border transition",
              selectedDay === d ? "bg-indigo-600 text-white border-indigo-600" :
              d === today ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
              "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            {DAYS_SHORT[d]}
            {byDay[d].length > 0 && <span className="ml-1 opacity-70">({byDay[d].length})</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card text-center py-12">
          <div className="animate-spin w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Yuklanmoqda...</p>
        </div>
      ) : totalSchedules === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📅</div>
          <h2 className="text-lg font-semibold text-gray-700">Jadval topilmadi</h2>
          <p className="text-gray-400 text-sm mt-1">Guruhlarga jadval belgilanmagan</p>
        </div>
      ) : view === 'week' ? (
        /* Week grid view */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(selectedDay !== null ? [selectedDay] : WORK_DAYS).map(dayNum => (
            <div key={dayNum} className="card">
              <div className="flex items-center gap-2 mb-3">
                <div className={clsx("w-2 h-2 rounded-full", dayNum === today ? "bg-indigo-500" : "bg-gray-300")} />
                <h3 className={clsx("font-semibold text-sm", dayNum === today ? "text-indigo-700" : "text-gray-700")}>
                  {DAYS[dayNum]}
                  {dayNum === today && (
                    <span className="text-xs ml-2 bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">Bugun</span>
                  )}
                </h3>
                <span className="ml-auto text-xs text-gray-400">{byDay[dayNum].length} ta</span>
              </div>
              {byDay[dayNum].length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-4">Dars yo'q</p>
              ) : (
                <div className="space-y-2">
                  {byDay[dayNum].map((entry, ei) => (
                    <div key={`${entry.schedule.id}-${ei}`} className={clsx("p-2.5 rounded-xl border text-xs", COLORS[entry.colorIdx])}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold">{entry.schedule.startTime} - {entry.schedule.endTime}</span>
                        {entry.schedule.room && <span className="opacity-70">🚪 {entry.schedule.room}</span>}
                      </div>
                      <p className="font-semibold">{entry.group.name}</p>
                      <p className="opacity-70">{entry.group.course?.name}</p>
                      {entry.group.teacher && (
                        <p className="opacity-60 mt-0.5">👤 {entry.group.teacher.user?.fullName}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* List view — by group */
        <div className="space-y-4">
          {filteredGroups.filter(g => g.schedules && g.schedules.length > 0).map((group, idx) => (
            <div key={group.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{group.name}</h3>
                  <p className="text-sm text-gray-500">{group.course?.name}</p>
                  {group.teacher && <p className="text-xs text-gray-400 mt-0.5">👤 {group.teacher.user?.fullName}</p>}
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {group.schedules.length} ta jadval
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(group.schedules || []).map(sc => (
                  <div
                    key={sc.id}
                    className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border", COLORS[idx % COLORS.length])}
                  >
                    <span className="font-bold">
                      {(sc.daysOfWeek || []).map(d => DAYS_SHORT[d]).join('/')}
                    </span>
                    <span>{sc.startTime}–{sc.endTime}</span>
                    {sc.room && <span className="opacity-70">· {sc.room}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filteredGroups.filter(g => !g.schedules || g.schedules.length === 0).length > 0 && (
            <div className="card border-dashed">
              <p className="text-sm text-gray-400 text-center py-2">
                {filteredGroups.filter(g => !g.schedules || g.schedules.length === 0).length} ta guruhda jadval belgilanmagan
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SchedulePage;
