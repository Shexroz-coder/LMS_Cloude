import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { format } from 'date-fns';
import { Users, GraduationCap, BookOpen, X, Plus, Trash2, ArrowRightLeft, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '../../api/axios';

// ── Types ──────────────────────────────────────────────────
interface Schedule {
  id: number;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  room?: string;
}

interface Course { id: number; name: string; monthlyPrice: number; }
interface Teacher { id: number; user: { id: number; fullName: string; phone: string; }; }
interface StudentUser { id: number; fullName: string; phone: string; }
interface Student { id: number; user: StudentUser; balance?: { debt: number }; coinBalance: number; }
interface GroupStudent { id: number; student: Student; joinedAt: string; status: string; }

interface Group {
  id: number;
  name: string;
  status: string;
  maxStudents: number;
  room?: string;
  startDate: string;
  endDate?: string;
  course: Course;
  teacher: { id: number; user: { id: number; fullName: string; }; };
  schedules: Schedule[];
  groupStudents: GroupStudent[];
  _count: { groupStudents: number; lessons: number; };
}

// ── Constants ──────────────────────────────────────────────
const DAYS = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const DAYS_FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Faol', cls: 'bg-emerald-100 text-emerald-700' },
  PAUSED: { label: "To'xtatilgan", cls: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Tugagan', cls: 'bg-gray-100 text-gray-600' },
};
const formatMoney = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";

// ── ODD/EVEN day presets ───────────────────────────────────
const DAY_PRESETS = [
  { label: 'Toq kunlar (Du/Ch/Ju)', days: [1, 3, 5] },
  { label: 'Juft kunlar (Se/Pa/Sh)', days: [2, 4, 6] },
  { label: 'Har kuni (Du-Ju)', days: [1, 2, 3, 4, 5] },
  { label: 'Dam olish kunlari', days: [0, 6] },
];

// ══════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════
const GroupsPage = () => {
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [viewGroup, setViewGroup] = useState<Group | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Group | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const { data: groups = [], isLoading } = useQuery<Group[]>(
    ['groups', statusFilter],
    async () => {
      const r = await api.get(`/groups?limit=100${statusFilter ? `&status=${statusFilter}` : ''}`);
      const d = r.data?.data;
      return Array.isArray(d) ? d : d?.groups || [];
    }
  );

  const deleteMutation = useMutation(
    (id: number) => api.delete(`/groups/${id}`),
    { onSuccess: (_data: unknown) => { qc.invalidateQueries('groups'); setDeleteConfirm(null); void toast.success('Guruh yopildi.'); } }
  );

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.course?.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.teacher?.user?.fullName?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: groups.length,
    active: groups.filter(g => g.status === 'ACTIVE').length,
    students: groups.reduce((s, g) => s + (g._count?.groupStudents || 0), 0),
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Guruhlar</h1>
          <p className="text-sm text-gray-500 mt-0.5">{stats.total} ta guruh · {stats.students} ta o'quvchi</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> Yangi guruh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Jami guruh', value: stats.total, icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Faol guruh', value: stats.active, icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: "Jami o'quvchi", value: stats.students, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-3">
            <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", s.bg)}>
              <s.icon className={clsx("w-5 h-5", s.color)} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="card flex flex-col sm:flex-row gap-3">
        <input className="input flex-1" placeholder="🔍 Qidirish..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-1">
          {[{ v: '', l: 'Barchasi' }, { v: 'ACTIVE', l: 'Faol' }, { v: 'PAUSED', l: "To'xtatilgan" }, { v: 'COMPLETED', l: 'Tugagan' }].map(f => (
            <button key={f.v} onClick={() => setStatusFilter(f.v)}
              className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium border transition", statusFilter === f.v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200")}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Groups grid */}
      {isLoading ? (
        <div className="card text-center py-12">
          <div className="animate-spin w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Yuklanmoqda...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">👥</div>
          <h2 className="text-lg font-semibold text-gray-700">Guruh topilmadi</h2>
          <button onClick={() => setShowAddModal(true)} className="mt-3 text-sm text-indigo-600 hover:underline">+ Yangi guruh yaratish</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(g => (
            <GroupCard key={g.id} group={g}
              onView={() => setViewGroup(g)}
              onEdit={() => setEditGroup(g)}
              onDelete={() => setDeleteConfirm(g)} />
          ))}
        </div>
      )}

      {/* Modals */}
      {(showAddModal || editGroup) && (
        <GroupFormModal group={editGroup} onClose={() => { setShowAddModal(false); setEditGroup(null); }}
          onSuccess={() => { setShowAddModal(false); setEditGroup(null); qc.invalidateQueries('groups'); }} />
      )}
      {viewGroup && (
        <GroupDetailModal group={viewGroup} onClose={() => setViewGroup(null)}
          onEdit={() => { setEditGroup(viewGroup); setViewGroup(null); }} />
      )}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Guruhni yopish</h3>
            <p className="text-gray-500 text-sm mb-1">
              <span className="font-semibold text-gray-700">{deleteConfirm.name}</span> guruhi yopiladi.
            </p>
            {deleteConfirm._count.groupStudents > 0 && (
              <p className="text-amber-600 text-sm mb-3">⚠️ {deleteConfirm._count.groupStudents} ta o'quvchi bor!</p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 btn-secondary">Bekor</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-xl transition">
                {deleteMutation.isLoading ? 'Yopilmoqda...' : 'Yopish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// Group Card
// ══════════════════════════════════════════════════════════
const GroupCard = ({ group: g, onView, onEdit, onDelete }: {
  group: Group; onView: () => void; onEdit: () => void; onDelete: () => void;
}) => {
  const capacity = g.maxStudents > 0 ? Math.round(((g._count?.groupStudents || 0) / g.maxStudents) * 100) : 0;
  const st = STATUS_MAP[g.status] || { label: g.status, cls: 'bg-gray-100 text-gray-600' };

  return (
    <div className="card hover:shadow-md transition cursor-pointer" onClick={onView}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{g.name}</h3>
          <p className="text-sm text-gray-500 truncate">{g.course?.name}</p>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", st.cls)}>{st.label}</span>
          <button onClick={e => { e.stopPropagation(); onEdit(); }} className="p-1 hover:bg-gray-100 rounded-lg">
            <span className="text-sm">✏️</span>
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 hover:bg-red-50 rounded-lg">
            <span className="text-sm">🗑️</span>
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span>👤</span> <span className="truncate">{g.teacher?.user?.fullName}</span>
        </div>
        {g.room && <div className="flex items-center gap-2"><span>🚪</span> {g.room} xona</div>}
      </div>

      {/* Capacity bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {g._count?.groupStudents}/{g.maxStudents}</span>
          <span>{capacity}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full">
          <div className={clsx("h-1.5 rounded-full", capacity >= 90 ? 'bg-red-400' : capacity >= 70 ? 'bg-amber-400' : 'bg-emerald-400')}
            style={{ width: `${Math.min(capacity, 100)}%` }} />
        </div>
      </div>

      {/* Schedules */}
      {g.schedules?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {g.schedules.map(sc => (
            <span key={sc.id} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
              {sc.daysOfWeek.map(d => DAYS[d]).join('/')} {sc.startTime}–{sc.endTime}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// Group Form Modal (3 tab: Asosiy | Jadval | O'quvchilar)
// ══════════════════════════════════════════════════════════
const GroupFormModal = ({ group, onClose, onSuccess }: {
  group: Group | null; onClose: () => void; onSuccess: () => void;
}) => {
  const isEdit = !!group;
  const qc = useQueryClient();
  const [tab, setTab] = useState<'info' | 'schedule' | 'students'>('info');
  const [form, setForm] = useState({
    name: group?.name || '',
    courseId: group?.course?.id?.toString() || '',
    teacherId: group?.teacher?.id?.toString() || '',
    maxStudents: group?.maxStudents?.toString() || '15',
    startDate: group?.startDate ? format(new Date(group.startDate), 'yyyy-MM-dd') : '',
    endDate: group?.endDate ? format(new Date(group.endDate), 'yyyy-MM-dd') : '',
    room: group?.room || '',
    status: group?.status || 'ACTIVE',
  });
  const [loading, setLoading] = useState(false);

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({ daysOfWeek: [] as number[], startTime: '09:00', duration: '90', room: group?.room || '' });
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // Students state
  const [studentSearch, setStudentSearch] = useState('');
  const [transferTarget, setTransferTarget] = useState<{ student: Student; } | null>(null);
  const [transferGroupId, setTransferGroupId] = useState('');

  const { data: courses } = useQuery('courses-list', () => api.get('/courses').then(r => r.data.data).catch(() => []));
  const { data: teachers } = useQuery('teachers-list', () => api.get('/teachers').then(r => r.data.data).catch(() => []));
  const { data: allStudents = [] } = useQuery<Student[]>('students-all', () =>
    api.get('/students?limit=200').then(r => { const d = r.data?.data; return Array.isArray(d) ? d : d?.students || []; }).catch(() => [])
  );
  const { data: allGroups = [] } = useQuery<Group[]>('groups-all-transfer', () =>
    api.get('/groups?limit=100&status=ACTIVE').then(r => { const d = r.data?.data; return Array.isArray(d) ? d : d?.groups || []; }).catch(() => [])
  );

  // Guruhning to'liq ma'lumotini yuklash (groupStudents va schedules bilan)
  const { data: fullGroup } = useQuery<Group>(
    ['group-full', group?.id],
    () => api.get(`/groups/${group!.id}`).then(r => r.data.data),
    { enabled: !!group?.id }
  );

  const [groupStudents, setGroupStudents] = useState<GroupStudent[]>([]);
  const [schedulesReady, setSchedulesReady] = useState(false);

  // fullGroup yuklanganda state ni yangilash
  if (fullGroup && !schedulesReady) {
    setGroupStudents(fullGroup.groupStudents || []);
    setSchedules(fullGroup.schedules || []);
    setSchedulesReady(true);
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Toggle day selection
  const toggleDay = (d: number) => {
    setScheduleForm(f => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter(x => x !== d) : [...f.daysOfWeek, d].sort()
    }));
  };

  // Calculate endTime from startTime + duration
  const calcEndTime = (start: string, dur: string) => {
    const [h, m] = start.split(':').map(Number);
    const total = h * 60 + m + parseInt(dur || '0');
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.courseId || !form.teacherId) { toast.error('Nom, kurs va ustoz shart'); return; }
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/groups/${group!.id}`, form);
        toast.success('Guruh yangilandi!');
      } else {
        const r = await api.post('/groups', form);
        const newGroup = r.data?.data;
        if (newGroup?.id) {
          // Switch to schedule tab after create
          group = newGroup;
          toast.success('Guruh yaratildi! Endi jadval qo\'shing.');
          setTab('schedule');
          return;
        }
      }
      onSuccess();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xato yuz berdi');
    } finally { setLoading(false); }
  };

  const handleAddSchedule = async () => {
    if (!group?.id) { toast.error("Avval guruhni saqlang"); return; }
    if (scheduleForm.daysOfWeek.length === 0) { toast.error("Kamida 1 kun tanlang"); return; }
    if (!scheduleForm.startTime || !scheduleForm.duration) { toast.error("Vaqt va davomiylik kiriting"); return; }
    try {
      const r = editingSchedule
        ? await api.put(`/groups/${group.id}/schedules/${editingSchedule.id}`, scheduleForm)
        : await api.post(`/groups/${group.id}/schedules`, scheduleForm);
      const sc = r.data?.data;
      if (editingSchedule) {
        setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? sc : s));
        toast.success('Jadval yangilandi!');
      } else {
        setSchedules(prev => [...prev, sc]);
        toast.success('Jadval qo\'shildi!');
      }
      setEditingSchedule(null);
      setScheduleForm({ daysOfWeek: [], startTime: '09:00', duration: '90', room: form.room });
      qc.invalidateQueries('groups');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xato');
    }
  };

  const handleDeleteSchedule = async (sc: Schedule) => {
    if (!group?.id) return;
    try {
      await api.delete(`/groups/${group.id}/schedules/${sc.id}`);
      setSchedules(prev => prev.filter(s => s.id !== sc.id));
      toast.success("Jadval o'chirildi");
      qc.invalidateQueries('groups');
    } catch { toast.error('Xato'); }
  };

  const handleAddStudent = async (studentId: number) => {
    if (!group?.id) return;
    try {
      await api.post(`/groups/${group.id}/students`, { studentId });
      const student = allStudents.find(s => s.id === studentId);
      if (student) setGroupStudents(prev => [...prev, { id: Date.now(), student, joinedAt: new Date().toISOString(), status: 'ACTIVE' }]);
      toast.success("O'quvchi qo'shildi!");
      qc.invalidateQueries('groups');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xato');
    }
  };

  const handleRemoveStudent = async (gs: GroupStudent) => {
    if (!group?.id) return;
    try {
      await api.delete(`/groups/${group.id}/students/${gs.student.id}`);
      setGroupStudents(prev => prev.filter(s => s.id !== gs.id));
      toast.success("O'quvchi chiqarildi");
      qc.invalidateQueries('groups');
    } catch { toast.error('Xato'); }
  };

  const handleTransfer = async () => {
    if (!group?.id || !transferTarget || !transferGroupId) return;
    try {
      await api.post(`/groups/${group.id}/students/${transferTarget.student.id}/transfer`, { toGroupId: parseInt(transferGroupId) });
      setGroupStudents(prev => prev.filter(s => s.student.id !== transferTarget.student.id));
      setTransferTarget(null);
      setTransferGroupId('');
      toast.success("O'quvchi o'tkazildi!");
      qc.invalidateQueries('groups');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xato');
    }
  };

  const activeGroupStudentIds = new Set(groupStudents.map(gs => gs.student.id));
  const availableStudents = allStudents.filter(s =>
    !activeGroupStudentIds.has(s.id) &&
    (s.user.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
     s.user.phone.includes(studentSearch))
  );

  const endTimePreview = calcEndTime(scheduleForm.startTime, scheduleForm.duration);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Guruhni tahrirlash' : 'Yangi guruh yaratish'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {([
            { key: 'info', label: 'Asosiy ma\'lumot', icon: '📋' },
            { key: 'schedule', label: 'Dars jadvali', icon: '📅' },
            { key: 'students', label: `O'quvchilar (${groupStudents.length})`, icon: '👥' },
          ] as { key: 'info' | 'schedule' | 'students'; label: string; icon: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={clsx("px-4 py-3 text-sm font-medium border-b-2 transition -mb-px", tab === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700")}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Tab 1: Asosiy ma'lumot ── */}
          {tab === 'info' && (
            <form onSubmit={handleSaveInfo} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Guruh nomi *</label>
                  <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Robotika-A" className="input" />
                </div>
                <div>
                  <label className="label">Kurs *</label>
                  <select value={form.courseId} onChange={e => set('courseId', e.target.value)} className="input">
                    <option value="">Kurs tanlang</option>
                    {Array.isArray(courses) && (courses as Course[]).map(c => (
                      <option key={c.id} value={c.id}>{c.name} — {formatMoney(c.monthlyPrice)}/oy</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Ustoz *</label>
                  <select value={form.teacherId} onChange={e => set('teacherId', e.target.value)} className="input">
                    <option value="">Ustoz tanlang</option>
                    {Array.isArray(teachers) && (teachers as Teacher[]).map(t => (
                      <option key={t.id} value={t.id}>{t.user.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Max o'quvchi</label>
                  <input type="number" value={form.maxStudents} onChange={e => set('maxStudents', e.target.value)} min="1" max="50" className="input" />
                </div>
                <div>
                  <label className="label">Asosiy xona</label>
                  <input type="text" value={form.room} onChange={e => set('room', e.target.value)} placeholder="101" className="input" />
                </div>
                <div>
                  <label className="label">Boshlanish sanasi</label>
                  <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Tugash sanasi</label>
                  <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className="input" />
                </div>
                {isEdit && (
                  <div>
                    <label className="label">Holat</label>
                    <select value={form.status} onChange={e => set('status', e.target.value)} className="input">
                      <option value="ACTIVE">Faol</option>
                      <option value="PAUSED">To'xtatilgan</option>
                      <option value="COMPLETED">Tugagan</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">Bekor</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Saqlanmoqda...' : isEdit ? 'Saqlash' : 'Guruh yaratish →'}
                </button>
              </div>
            </form>
          )}

          {/* ── Tab 2: Jadval ── */}
          {tab === 'schedule' && (
            <div className="px-6 py-4 space-y-5">
              {!isEdit && (
                <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-sm">
                  ⚠️ Jadval qo'shish uchun avval guruhni saqlang
                </div>
              )}

              {/* Existing schedules */}
              {schedules.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Mavjud jadvallar</h3>
                  {schedules.map(sc => (
                    <div key={sc.id} className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
                      <div>
                        <p className="text-sm font-semibold text-indigo-800">
                          {sc.daysOfWeek.map(d => DAYS[d]).join(', ')}
                        </p>
                        <p className="text-xs text-indigo-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {sc.startTime} – {sc.endTime}
                          {sc.room && <span className="ml-2">🚪 {sc.room}</span>}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingSchedule(sc); setScheduleForm({ daysOfWeek: sc.daysOfWeek, startTime: sc.startTime, duration: String(Math.round((parseInt(sc.endTime.split(':')[0]) * 60 + parseInt(sc.endTime.split(':')[1])) - (parseInt(sc.startTime.split(':')[0]) * 60 + parseInt(sc.startTime.split(':')[1])))), room: sc.room || '' }); }}
                          className="text-xs text-indigo-600 px-2 py-1 hover:bg-indigo-100 rounded-lg">✏️</button>
                        <button onClick={() => handleDeleteSchedule(sc)} className="text-xs text-red-500 px-2 py-1 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add/Edit schedule form */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">
                  {editingSchedule ? 'Jadvalni tahrirlash' : '+ Yangi jadval qo\'shish'}
                </h3>

                {/* Day presets */}
                <div>
                  <label className="label">Tezkor tanlash</label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_PRESETS.map(p => (
                      <button key={p.label} type="button"
                        onClick={() => setScheduleForm(f => ({ ...f, daysOfWeek: p.days }))}
                        className={clsx("text-xs px-3 py-1.5 rounded-lg border transition", JSON.stringify(scheduleForm.daysOfWeek) === JSON.stringify(p.days) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300")}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Individual day selection */}
                <div>
                  <label className="label">Kunlarni tanlash</label>
                  <div className="flex gap-2">
                    {DAYS.map((d, i) => (
                      <button key={i} type="button" onClick={() => toggleDay(i)}
                        className={clsx("w-9 h-9 rounded-full text-xs font-medium border transition", scheduleForm.daysOfWeek.includes(i) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300")}>
                        {d}
                      </button>
                    ))}
                  </div>
                  {scheduleForm.daysOfWeek.length > 0 && (
                    <p className="text-xs text-indigo-600 mt-1">
                      Tanlangan: {scheduleForm.daysOfWeek.map(d => DAYS_FULL[d]).join(', ')}
                    </p>
                  )}
                </div>

                {/* Time + Duration */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Boshlanish vaqti</label>
                    <input type="time" value={scheduleForm.startTime}
                      onChange={e => setScheduleForm(f => ({ ...f, startTime: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Davomiylik (daqiqa)</label>
                    <input type="number" value={scheduleForm.duration} min="30" max="300" step="15"
                      onChange={e => setScheduleForm(f => ({ ...f, duration: e.target.value }))} className="input" placeholder="90" />
                  </div>
                  <div>
                    <label className="label">Tugash vaqti</label>
                    <div className="input bg-gray-50 text-gray-600 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {endTimePreview}
                    </div>
                  </div>
                </div>

                {/* Room */}
                <div>
                  <label className="label">Xona</label>
                  <input type="text" value={scheduleForm.room}
                    onChange={e => setScheduleForm(f => ({ ...f, room: e.target.value }))}
                    placeholder="101, 202, Katta zal..." className="input" />
                  <p className="text-xs text-gray-400 mt-1">Xona ko'rsatilsa, bir vaqtdagi boshqa darslar tekshiriladi</p>
                </div>

                <div className="flex gap-2">
                  {editingSchedule && (
                    <button type="button" onClick={() => { setEditingSchedule(null); setScheduleForm({ daysOfWeek: [], startTime: '09:00', duration: '90', room: form.room }); }}
                      className="btn-secondary flex-1">Bekor</button>
                  )}
                  <button type="button" onClick={handleAddSchedule} disabled={!isEdit}
                    className="btn-primary flex-1">
                    {editingSchedule ? '✓ Saqlash' : '+ Qo\'shish'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab 3: O'quvchilar ── */}
          {tab === 'students' && (
            <div className="px-6 py-4 space-y-4">
              {!isEdit && (
                <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-sm">
                  ⚠️ O'quvchi qo'shish uchun avval guruhni saqlang
                </div>
              )}

              {/* Loading state */}
              {isEdit && !schedulesReady && (
                <div className="text-center py-6">
                  <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Yuklanmoqda...</p>
                </div>
              )}

              {/* Current students */}
              {groupStudents.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Guruh o'quvchilari ({groupStudents.length})</h3>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {groupStudents.map(gs => (
                      <div key={gs.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                            {gs.student.user.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{gs.student.user.fullName}</p>
                            <p className="text-xs text-gray-400">{gs.student.user.phone}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setTransferTarget({ student: gs.student })}
                            className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg" title="O'tkazish">
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleRemoveStudent(gs)}
                            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg" title="Chiqarish">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transfer modal */}
              {transferTarget && (
                <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-blue-800">
                    <ArrowRightLeft className="w-4 h-4 inline mr-1" />
                    {transferTarget.student.user.fullName} → boshqa guruhga o'tkazish
                  </p>
                  <select value={transferGroupId} onChange={e => setTransferGroupId(e.target.value)} className="input">
                    <option value="">Guruh tanlang</option>
                    {(allGroups as Group[]).filter(g => g.id !== group?.id).map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g._count?.groupStudents}/{g.maxStudents})</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => { setTransferTarget(null); setTransferGroupId(''); }} className="btn-secondary flex-1 text-sm">Bekor</button>
                    <button onClick={handleTransfer} disabled={!transferGroupId} className="btn-primary flex-1 text-sm">O'tkazish</button>
                  </div>
                </div>
              )}

              {/* Search + Add students */}
              {isEdit && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">O'quvchi qo'shish</h3>
                  <input className="input mb-2" placeholder="🔍 Ism yoki telefon..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                  {studentSearch.length > 1 && (
                    <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2">
                      {availableStudents.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-2">Topilmadi</p>
                      ) : availableStudents.slice(0, 10).map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{s.user.fullName}</p>
                            <p className="text-xs text-gray-400">{s.user.phone}</p>
                          </div>
                          <button onClick={() => { handleAddStudent(s.id); setStudentSearch(''); }}
                            className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {tab !== 'info' && (
          <div className="px-6 py-4 border-t border-gray-100">
            <button onClick={onSuccess} className="btn-primary w-full">Yopish</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// Group Detail Modal
// ══════════════════════════════════════════════════════════
const GroupDetailModal = ({ group, onClose, onEdit }: {
  group: Group; onClose: () => void; onEdit: () => void;
}) => {
  const { data: g } = useQuery(['group-detail', group.id], () =>
    api.get(`/groups/${group.id}`).then(r => r.data.data),
    { initialData: group }
  );

  if (!g) return null;
  const st = STATUS_MAP[g.status] || { label: g.status, cls: 'bg-gray-100 text-gray-600' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{g.name}</h2>
            <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", st.cls)}>{st.label}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onEdit} className="btn-secondary text-sm">✏️ Tahrirlash</button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Kurs', value: g.course?.name },
              { label: 'Ustoz', value: g.teacher?.user?.fullName },
              { label: "O'quvchilar", value: `${g._count?.groupStudents || 0}/${g.maxStudents}` },
              { label: 'Xona', value: g.room || '—' },
            ].map(i => (
              <div key={i.label} className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-400">{i.label}</p>
                <p className="font-semibold text-gray-800 mt-0.5">{i.value}</p>
              </div>
            ))}
          </div>

          {/* Schedules */}
          {g.schedules?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">📅 Dars jadvali</h3>
              <div className="space-y-2">
                {g.schedules.map((sc: Schedule) => (
                  <div key={sc.id} className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
                    <div className="flex gap-1 flex-wrap">
                      {sc.daysOfWeek.map(d => (
                        <span key={d} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{DAYS_FULL[d]}</span>
                      ))}
                    </div>
                    <span className="text-sm font-mono text-indigo-700 ml-auto">{sc.startTime}–{sc.endTime}</span>
                    {sc.room && <span className="text-xs text-indigo-500">🚪{sc.room}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Students */}
          {g.groupStudents?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">👥 O'quvchilar ({g.groupStudents.length})</h3>
              <div className="space-y-1.5">
                {g.groupStudents.map((gs: GroupStudent, i: number) => (
                  <div key={gs.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{gs.student.user.fullName}</p>
                      <p className="text-xs text-gray-400">{gs.student.user.phone}</p>
                    </div>
                    {Number(gs.student.balance?.debt || 0) > 0 && (
                      <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Qarz</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupsPage;
