/**
 * YAGONA DAVOMAT OQIMI (Admin, Ustoz, Filial mas'uli uchun bitta joyda):
 *   1) Kunni tanlash  →  2) o'sha kuni darsи bor guruhlar  →  3) guruhга bosib davomat.
 * Sodda, filialга bog'liq, mobil-do'st.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Calendar, Clock, Users, ChevronRight, Check, X, ArrowLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

type Status = 'PRESENT' | 'ABSENT' | 'LATE';
const STATUS_UI: Record<Status, { label: string; cls: string; active: string }> = {
  PRESENT: { label: 'Keldi',    cls: 'text-emerald-600', active: 'bg-emerald-500 text-white border-emerald-500' },
  LATE:    { label: 'Kechikdi', cls: 'text-amber-600',   active: 'bg-amber-500 text-white border-amber-500' },
  ABSENT:  { label: 'Kelmadi',  cls: 'text-red-600',     active: 'bg-red-500 text-white border-red-500' },
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AttendanceManager() {
  const [date, setDate] = useState(todayStr());
  const [group, setGroup] = useState<{ id: number; name: string } | null>(null);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Davomat
        </h1>
        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input type="date" value={date} max={todayStr()}
            onChange={e => { setDate(e.target.value); setGroup(null); }}
            className="text-sm bg-transparent dark:text-gray-100 focus:outline-none" />
        </div>
      </div>

      {group
        ? <GroupMarking date={date} group={group} onBack={() => setGroup(null)} />
        : <DayGroups date={date} onPick={g => setGroup(g)} />}
    </div>
  );
}

// ── Kun bo'yicha guruhlar ────────────────────────────
function DayGroups({ date, onPick }: { date: string; onPick: (g: { id: number; name: string }) => void }) {
  const { data, isLoading } = useQuery(['att-day', date],
    () => api.get('/attendance/day', { params: { date } }).then(r => r.data?.data), { staleTime: 15_000 });
  const groups: any[] = data?.groups ?? [];

  if (isLoading) return <div className="text-center py-12 text-gray-400 text-sm">Yuklanmoqda...</div>;
  if (groups.length === 0) return (
    <div className="text-center py-14 text-gray-400">
      <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">Bu kuni dars bor guruh yo'q.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">{groups.length} ta guruh · darsи bor</p>
      {groups.map(g => (
        <button key={g.groupId} onClick={() => onPick({ id: g.groupId, name: g.name })}
          className="w-full flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-4 py-3 hover:shadow-md transition text-left">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{g.name}</div>
            <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{g.startTime}–{g.endTime}</span>
              <span>· {g.courseName}</span>
              {g.branchName && <span>· {g.branchName}</span>}
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{g.studentsCount}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {g.marked
              ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">✓ Belgilangan</span>
              : <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700">Belgilanmagan</span>}
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Guruh davomati ───────────────────────────────────
function GroupMarking({ date, group, onBack }: { date: string; group: { id: number; name: string }; onBack: () => void }) {
  const qc = useQueryClient();
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [ready, setReady] = useState(false);

  const { data } = useQuery(['att-group-day', group.id, date],
    () => api.get(`/attendance/group/${group.id}/day`, { params: { date } }).then(r => r.data?.data),
    {
      staleTime: 0,
      onSuccess: (d: any) => {
        const init: Record<number, Status> = {};
        (d?.students ?? []).forEach((s: any) => { init[s.studentId] = (s.status as Status) || 'PRESENT'; });
        setStatuses(init);
        setReady(true);
      },
    });
  const students: any[] = data?.students ?? [];

  const setAll = (st: Status) => {
    const next: Record<number, Status> = {};
    students.forEach(s => { next[s.studentId] = st; });
    setStatuses(next);
  };

  const save = useMutation(
    (forced?: boolean) => api.post('/attendance/lesson', {
      groupId: group.id, date,
      attendanceList: students.map(s => ({ studentId: s.studentId, status: statuses[s.studentId] || 'PRESENT' })),
      ...(forced ? { forcedLesson: true } : {}),
    }),
    {
      onSuccess: () => {
        toast.success('Davomat saqlandi');
        qc.invalidateQueries(['att-day', date]);
        qc.invalidateQueries(['att-group-day', group.id, date]);
        onBack();
      },
      onError: (e: any) => {
        const msg = e?.response?.data?.message || 'Xato';
        if (/dam olish|bayram/i.test(msg)) {
          if (window.confirm(msg + '\n\nShunда ham dars o\'tkazasizmi?')) save.mutate(true);
        } else toast.error(msg);
      },
    }
  );

  const counts = students.reduce((a, s) => { const st = statuses[s.studentId] || 'PRESENT'; a[st] = (a[st] || 0) + 1; return a; }, {} as Record<string, number>);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft className="w-4 h-4" /> Orqaga
        </button>
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{group.name}</div>
      </div>

      {/* Tezkor: barchasи */}
      <div className="flex gap-2">
        <button onClick={() => setAll('PRESENT')} className="flex-1 text-xs font-medium py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100">Barchasи keldi</button>
        <button onClick={() => setAll('ABSENT')} className="flex-1 text-xs font-medium py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100">Barchasи kelmadi</button>
      </div>

      {!ready ? (
        <div className="text-center py-10 text-gray-400 text-sm">Yuklanmoqda...</div>
      ) : students.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Guruhда o'quvchi yo'q</div>
      ) : (
        <div className="space-y-1.5">
          {students.map((s, i) => {
            const cur = statuses[s.studentId] || 'PRESENT';
            return (
              <div key={s.studentId} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0 text-gray-500">{i + 1}</span>
                  <span className="text-sm text-gray-800 dark:text-gray-100 truncate">{s.fullName}</span>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {(['PRESENT', 'LATE', 'ABSENT'] as Status[]).map(st => (
                    <button key={st} onClick={() => setStatuses(p => ({ ...p, [s.studentId]: st }))}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition ${cur === st ? STATUS_UI[st].active : `border-gray-200 dark:border-gray-600 ${STATUS_UI[st].cls} hover:bg-gray-50 dark:hover:bg-gray-700`}`}>
                      {STATUS_UI[st].label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Saqlash */}
      {students.length > 0 && (
        <div className="sticky bottom-0 bg-gradient-to-t from-gray-50 dark:from-gray-900 pt-2">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5 px-1">
            <span className="flex items-center gap-1 text-emerald-600"><Check className="w-3 h-3" />{counts.PRESENT || 0} keldi</span>
            <span className="text-amber-600">{counts.LATE || 0} kechikdi</span>
            <span className="flex items-center gap-1 text-red-600"><X className="w-3 h-3" />{counts.ABSENT || 0} kelmadi</span>
          </div>
          <button onClick={() => save.mutate(false)} disabled={save.isLoading} className="btn-primary w-full">
            {save.isLoading ? 'Saqlanmoqda...' : 'Davomatни saqlash'}
          </button>
        </div>
      )}
    </div>
  );
}
