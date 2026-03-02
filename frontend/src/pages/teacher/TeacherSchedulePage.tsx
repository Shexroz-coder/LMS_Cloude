import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { format } from 'date-fns';
import { Users, ChevronRight, X, Star, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '../../api/axios';

const DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const DAYS_SHORT = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
const ATT_CONFIG: Record<AttStatus, { label: string; color: string; short: string }> = {
  PRESENT: { label: 'Keldi', color: 'bg-emerald-500 text-white', short: '✓' },
  ABSENT: { label: 'Kelmadi', color: 'bg-red-500 text-white', short: '✗' },
  LATE: { label: 'Kechikdi', color: 'bg-amber-500 text-white', short: '⏰' },
  EXCUSED: { label: 'Sababli', color: 'bg-blue-500 text-white', short: 'S' },
};

interface Schedule { id: number; daysOfWeek: number[]; startTime: string; endTime: string; room?: string; }
interface GroupStudent { student: { id: number; user: { fullName: string; avatarUrl?: string }; coinBalance: number; }; }
interface Group { id: number; name: string; course: { name: string }; room?: string; schedules: Schedule[]; groupStudents: GroupStudent[]; _count: { groupStudents: number }; }

// Which groups have a schedule today or this week?
const todayNum = new Date().getDay();

const TeacherSchedulePage = () => {
  const qc = useQueryClient();
  const [selectedDay, setSelectedDay] = useState<number>(todayNum);
  const [activeSession, setActiveSession] = useState<{ group: Group; schedule: Schedule } | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [topic, setTopic] = useState('');
  const [attendance, setAttendance] = useState<Record<number, AttStatus>>({});
  const [coins, setCoins] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);

  const { data: groups = [] } = useQuery<Group[]>('teacher-schedule-groups', async () => {
    const r = await api.get('/groups?limit=100&status=ACTIVE');
    const d = r.data?.data;
    return Array.isArray(d) ? d : d?.groups || [];
  });

  // Build day → sessions map
  const dayMap: Record<number, { group: Group; schedule: Schedule }[]> = {};
  for (let i = 0; i < 7; i++) dayMap[i] = [];

  groups.forEach(group => {
    (group.schedules || []).forEach(sc => {
      (sc.daysOfWeek || []).forEach(day => {
        if (dayMap[day]) dayMap[day].push({ group, schedule: sc });
      });
    });
  });
  // Sort by startTime
  Object.keys(dayMap).forEach(d => {
    dayMap[Number(d)].sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime));
  });

  // Fetch full group detail (with groupStudents) when session is opened
  const openSession = async (group: Group, schedule: Schedule) => {
    setLoadingSession(true);
    try {
      // Fetch full group with students
      const r = await api.get(`/groups/${group.id}`);
      const fullGroup: Group = r.data?.data || group;
      setActiveSession({ group: fullGroup, schedule });
      // Initialize all students as PRESENT by default
      const initAtt: Record<number, AttStatus> = {};
      const initCoins: Record<number, number> = {};
      (fullGroup.groupStudents || []).forEach(gs => {
        initAtt[gs.student.id] = 'PRESENT';
        initCoins[gs.student.id] = 0;
      });
      setAttendance(initAtt);
      setCoins(initCoins);
      setTopic('');
    } catch {
      toast.error("O'quvchilar ma'lumotini olishda xato");
    } finally {
      setLoadingSession(false);
    }
  };

  const handleSaveLesson = async () => {
    if (!activeSession) return;
    setSaving(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      // 1. Create/find lesson
      const lessonRes = await api.post('/lessons', {
        groupId: activeSession.group.id,
        date: today,
        startTime: activeSession.schedule.startTime,
        endTime: activeSession.schedule.endTime,
        topic: topic || undefined,
      });
      const lessonId = lessonRes.data?.data?.id;
      if (!lessonId) throw new Error('Dars yaratilmadi');

      // 2. Mark attendance (use correct field names for the endpoint)
      const attRecords = Object.entries(attendance).map(([studentId, status]) => ({
        studentId: parseInt(studentId), status
      }));
      await api.post('/attendance/lesson', {
        groupId: activeSession.group.id,
        date: today,
        topic: topic || undefined,
        attendanceList: attRecords,
      });

      // 3. Give coins (only if > 0)
      const coinEntries = Object.entries(coins).filter(([_, v]) => v > 0);
      await Promise.all(coinEntries.map(([studentId, amount]) =>
        api.post('/coins/award', { studentId: parseInt(studentId), amount, reason: `Dars: ${topic || activeSession.group.name}` })
          .catch(() => {}) // Don't fail if coin fails
      ));

      toast.success('Davomat saqlandi!');
      setActiveSession(null);
      qc.invalidateQueries('teacher-schedule-groups');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xato yuz berdi');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dars Jadvalim</h1>
        <p className="text-sm text-gray-500 mt-0.5">Dars o'tkazish va davomat belgilash</p>
      </div>

      {/* Day selector */}
      <div className="flex gap-2 flex-wrap">
        {DAYS_SHORT.map((day, i) => (
          <button key={i}
            onClick={() => setSelectedDay(i)}
            className={clsx(
              "px-3 py-2 rounded-xl text-sm font-medium border transition flex flex-col items-center gap-0.5",
              selectedDay === i ? "bg-indigo-600 text-white border-indigo-600" :
              i === todayNum ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
              "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            <span>{day}</span>
            {dayMap[i].length > 0 && (
              <span className={clsx("text-xs", selectedDay === i ? "opacity-70" : "text-indigo-400")}>{dayMap[i].length} dars</span>
            )}
          </button>
        ))}
      </div>

      {/* Sessions for selected day */}
      <div className="space-y-3">
        {selectedDay === todayNum && (
          <div className="flex items-center gap-2 text-sm text-indigo-600">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Bugungi darslar
          </div>
        )}
        {dayMap[selectedDay].length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-4xl mb-3">😴</div>
            <h3 className="font-semibold text-gray-700">{DAYS[selectedDay]} kuni dars yo'q</h3>
            <p className="text-sm text-gray-400 mt-1">Dam olish kuni yoki jadval belgilanmagan</p>
          </div>
        ) : (
          dayMap[selectedDay].map(({ group, schedule }, idx) => (
            <div key={`${group.id}-${schedule.id}-${idx}`}
              className={clsx("card flex items-center gap-4 hover:shadow-md transition cursor-pointer border",
                selectedDay === todayNum ? "border-indigo-100" : "border-transparent"
              )}
              onClick={() => openSession(group, schedule)}
            >
              <div className={clsx(
                "text-center w-16 flex-shrink-0 py-3 rounded-xl",
                selectedDay === todayNum ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
              )}>
                <p className="text-sm font-bold">{schedule.startTime}</p>
                <p className="text-xs opacity-70">{schedule.endTime}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800">{group.name}</p>
                <p className="text-sm text-gray-500">{group.course.name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {group._count?.groupStudents || 0} o'quvchi</span>
                  {schedule.room && <span>🚪 {schedule.room}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {loadingSession ? (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                ) : (
                  <>
                    <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full font-medium">Dars o'tkazish</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Attendance Session Modal */}
      {activeSession && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">{activeSession.group.name}</h2>
                <p className="text-sm text-gray-500">
                  {DAYS[selectedDay]} · {activeSession.schedule.startTime}–{activeSession.schedule.endTime}
                </p>
              </div>
              <button onClick={() => setActiveSession(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Topic */}
              <div>
                <label className="label">Dars mavzusi (ixtiyoriy)</label>
                <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                  className="input" placeholder="Bugungi dars mavzusi..." />
              </div>

              {/* Quick attendance actions */}
              <div className="flex gap-2">
                <button onClick={() => {
                  const all: Record<number, AttStatus> = {};
                  activeSession.group.groupStudents.forEach(gs => all[gs.student.id] = 'PRESENT');
                  setAttendance(all);
                }} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200">
                  ✓ Hammasi keldi
                </button>
                <button onClick={() => {
                  const all: Record<number, AttStatus> = {};
                  activeSession.group.groupStudents.forEach(gs => all[gs.student.id] = 'ABSENT');
                  setAttendance(all);
                }} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 border border-red-200">
                  ✗ Hammasi kelmadi
                </button>
              </div>

              {/* Student list */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {activeSession.group.groupStudents.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-6">Bu guruhda o'quvchilar yo'q</p>
                ) : activeSession.group.groupStudents.map(gs => {
                  const sid = gs.student.id;
                  const status = attendance[sid] || 'ABSENT';
                  const coinVal = coins[sid] || 0;
                  return (
                    <div key={sid} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
                        {gs.student.user.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{gs.student.user.fullName}</p>
                        <p className="text-xs text-gray-400">🪙 {gs.student.coinBalance} coin</p>
                      </div>
                      {/* Attendance buttons */}
                      <div className="flex gap-1 flex-shrink-0">
                        {(Object.keys(ATT_CONFIG) as AttStatus[]).map(s => (
                          <button key={s}
                            onClick={() => setAttendance(prev => ({ ...prev, [sid]: s }))}
                            title={ATT_CONFIG[s].label}
                            className={clsx("w-8 h-8 rounded-lg text-xs font-medium border transition",
                              status === s ? ATT_CONFIG[s].color + ' border-transparent' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                            )}>
                            {ATT_CONFIG[s].short}
                          </button>
                        ))}
                      </div>
                      {/* Coin input (0-5) */}
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        <div className="flex gap-0.5">
                          {[0, 1, 2, 3, 4, 5].map(n => (
                            <button key={n}
                              onClick={() => setCoins(prev => ({ ...prev, [sid]: n }))}
                              className={clsx(
                                "w-5 h-5 rounded text-xs font-bold transition",
                                coinVal === n ? "bg-amber-400 text-white" : "bg-gray-100 text-gray-400 hover:bg-amber-100"
                              )}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl text-sm">
                <span className="text-indigo-700">
                  ✓ {Object.values(attendance).filter(s => s === 'PRESENT').length} ta keldi ·
                  ✗ {Object.values(attendance).filter(s => s === 'ABSENT').length} ta kelmadi ·
                  🪙 {Object.values(coins).reduce((s, v) => s + v, 0)} coin beriladigan
                </span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setActiveSession(null)} className="flex-1 btn-secondary">Bekor</button>
              <button onClick={handleSaveLesson} disabled={saving} className="flex-2 btn-primary px-8">
                {saving ? 'Saqlanmoqda...' : '✓ Davomat saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherSchedulePage;
