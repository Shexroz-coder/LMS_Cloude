/**
 * Filial batafsil — Xonalar → Guruhlar → O'quvchilar + alohida moliya.
 * Har filialni alohida kuzatish. Mobil-moslashuvchan.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Building2, DoorOpen, Plus, Edit3, Trash2, X, Check, ArrowLeft,
  Users, BookOpen, TrendingUp, TrendingDown, GraduationCap, UserCheck, Link2,
  ShieldCheck, UserCog, UserMinus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v || 0));

interface GroupRow { id: number; name: string; courseName: string; teacherName: string; studentsCount: number; roomId: number | null }
interface RoomRow { id: number; name: string; capacity: number | null; isActive: boolean; groups: GroupRow[]; studentsCount: number }
interface BranchDetail {
  branch: { id: number; name: string; address: string | null; phone: string | null };
  rooms: RoomRow[];
  looseGroups: GroupRow[];
  finance: { monthIncome: number; totalDebt: number; totalBalance: number; debtorCount: number; studentsCount: number; groupsCount: number };
}

export default function BranchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const branchId = Number(id);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';   // Menejer (ustoz) uchun boshqaruv tugmalari yashiriladi

  const [roomModal, setRoomModal] = useState<{ mode: 'create' | 'edit'; room?: RoomRow } | null>(null);
  const [assignRoom, setAssignRoom] = useState<RoomRow | null>(null);

  const { data, isLoading } = useQuery<BranchDetail>(
    ['branch-detail', branchId],
    () => api.get(`/branches/${branchId}/detail`).then(r => r.data?.data),
    { enabled: !!branchId }
  );

  const refresh = () => qc.invalidateQueries(['branch-detail', branchId]);

  const deleteRoom = useMutation(
    (roomId: number) => api.delete(`/branches/rooms/${roomId}`),
    { onSuccess: () => { toast.success("Xona o'chirildi"); refresh(); },
      onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); } }
  );

  if (isLoading) return <div className="text-center py-20 text-zinc-400">Yuklanmoqda...</div>;
  if (!data) return <div className="text-center py-20 text-zinc-400">Filial topilmadi</div>;

  const { branch, rooms, looseGroups, finance } = data;

  const financeCards = [
    { label: 'Oylik tushum', value: fmt(finance.monthIncome), unit: "so'm", icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Qarzdorlik', value: fmt(finance.totalDebt), unit: "so'm", icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: "O'quvchilar", value: String(finance.studentsCount), unit: 'ta', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Guruhlar', value: String(finance.groupsCount), unit: 'ta', icon: BookOpen, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      {isAdmin && (
        <button onClick={() => navigate('/admin/branches')} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Filiallar
        </button>
      )}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{branch.name}</h1>
            {branch.address && <p className="text-sm text-zinc-500">{branch.address}</p>}
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setRoomModal({ mode: 'create' })}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Xona qo'shish</span>
          </button>
        )}
      </div>

      {/* Filial moliyasi (alohida) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {financeCards.map(c => (
          <div key={c.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 p-4">
            <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
              <c.icon className={`w-4.5 h-4.5 ${c.color}`} />
            </div>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">{c.value}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{c.label} · {c.unit}</div>
          </div>
        ))}
      </div>

      {/* Filial mas'uli — faqat admin boshqaradi */}
      {isAdmin && <ManagerSection branchId={branchId} />}

      {/* Xonalar */}
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
        <DoorOpen className="w-4 h-4 text-indigo-500" /> Xonalar ({rooms.length})
      </h2>

      {rooms.length === 0 ? (
        <div className="text-center py-10 text-zinc-400 bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 mb-6">
          <DoorOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Xona yo'q. Birinchi xonani qo'shing.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {rooms.map(room => (
            <div key={room.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-3 bg-zinc-50 dark:bg-gray-700/40 border-b border-zinc-100 dark:border-gray-700">
                <div className="flex items-center gap-2 min-w-0">
                  <DoorOpen className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="font-semibold text-zinc-800 dark:text-zinc-100 truncate">{room.name}</span>
                  {room.capacity != null && <span className="text-xs text-zinc-400">· {room.capacity} joy</span>}
                  <span className="text-xs text-zinc-400">· {room.groups.length} guruh · {room.studentsCount} o'quvchi</span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setAssignRoom(room)} title="Guruh biriktirish"
                      className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg"><Link2 className="w-4 h-4" /></button>
                    <button onClick={() => setRoomModal({ mode: 'edit', room })} title="Tahrirlash"
                      className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => { if (confirm(`"${room.name}" xonasini o'chirasizmi? Guruhlar bo'shatiladi.`)) deleteRoom.mutate(room.id); }} title="O'chirish"
                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              {room.groups.length === 0 ? (
                <p className="text-sm text-zinc-400 px-4 py-4">Bu xonada guruh yo'q</p>
              ) : (
                <div className="divide-y divide-zinc-50 dark:divide-gray-700/50">
                  {room.groups.map(g => <GroupLine key={g.id} g={g} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Xonaga biriktirilmagan guruhlar */}
      {looseGroups.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
            Xonasiz guruhlar ({looseGroups.length})
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-zinc-300 dark:border-gray-600 overflow-hidden divide-y divide-zinc-50 dark:divide-gray-700/50">
            {looseGroups.map(g => <GroupLine key={g.id} g={g} />)}
          </div>
        </>
      )}

      {roomModal && (
        <RoomModal branchId={branchId} mode={roomModal.mode} room={roomModal.room}
          onClose={() => setRoomModal(null)} onSaved={() => { setRoomModal(null); refresh(); }} />
      )}
      {assignRoom && (
        <AssignGroupsModal room={assignRoom} looseGroups={looseGroups}
          onClose={() => setAssignRoom(null)} onSaved={() => { setAssignRoom(null); refresh(); }} />
      )}
    </div>
  );
}

function GroupLine({ g }: { g: GroupRow }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <BookOpen className="w-4 h-4 text-zinc-300 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{g.name}</div>
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> {g.courseName}</span>
            <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" /> {g.teacherName}</span>
          </div>
        </div>
      </div>
      <span className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-300 flex-shrink-0">
        <Users className="w-3.5 h-3.5 text-emerald-500" /> {g.studentsCount}
      </span>
    </div>
  );
}

function RoomModal({ branchId, mode, room, onClose, onSaved }: {
  branchId: number; mode: 'create' | 'edit'; room?: RoomRow; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(room?.name ?? '');
  const [capacity, setCapacity] = useState(room?.capacity != null ? String(room.capacity) : '');

  const mutation = useMutation(
    () => mode === 'create'
      ? api.post(`/branches/${branchId}/rooms`, { name, capacity: capacity || undefined })
      : api.put(`/branches/rooms/${room!.id}`, { name, capacity: capacity || null }),
    { onSuccess: () => { toast.success('Saqlandi!'); onSaved(); },
      onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); } }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{mode === 'create' ? 'Yangi xona' : 'Xonani tahrirlash'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-zinc-500" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Xona nomi *</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Masalan: 1-xona / Lego zali"
              className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Sig'imi (ixtiyoriy)</span>
            <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="12"
              className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-200 dark:border-gray-600 rounded-xl text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-gray-700 font-medium">Bekor</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isLoading || !name.trim()}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> {mutation.isLoading ? '...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignGroupsModal({ room, looseGroups, onClose, onSaved }: {
  room: RoomRow; looseGroups: GroupRow[]; onClose: () => void; onSaved: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const toggle = (id: number) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const mutation = useMutation(
    () => api.post(`/branches/rooms/${room.id}/assign-groups`, { groupIds: selected }),
    { onSuccess: (r) => { toast.success(r.data?.message || 'Biriktirildi'); onSaved(); },
      onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); } }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 truncate">"{room.name}" ga guruh biriktirish</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-zinc-500" /></button>
        </div>
        {looseGroups.length === 0 ? (
          <p className="text-sm text-zinc-400 py-6 text-center">Xonasiz guruh yo'q. Boshqa xonadagi guruhlarni ko'chirish uchun avval ularni bo'shating.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {looseGroups.map(g => (
              <button key={g.id} onClick={() => toggle(g.id)}
                className={clsx('flex items-center justify-between w-full px-3 py-2.5 rounded-lg border text-left transition-colors',
                  selected.includes(g.id) ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-zinc-200 dark:border-gray-600 hover:bg-zinc-50 dark:hover:bg-gray-700')}>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{g.name}</div>
                  <div className="text-xs text-zinc-400">{g.courseName} · {g.studentsCount} o'quvchi</div>
                </div>
                {selected.includes(g.id) && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-200 dark:border-gray-600 rounded-xl text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-gray-700 font-medium">Bekor</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isLoading || selected.length === 0}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
            {mutation.isLoading ? '...' : `Biriktirish (${selected.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Filial mas'uli (ustoz-menejer) bo'limi ───
const MANAGER_PERMS: { key: string; label: string }[] = [
  { key: 'students.view',   label: "O'quvchilarni ko'rish" },
  { key: 'payments.view',   label: "To'lovlarni ko'rish" },
  { key: 'payments.create', label: "To'lov qabul qilish" },
  { key: 'finance.view',    label: 'Moliyani ko\'rish' },
  { key: 'debtors.view',    label: 'Qarzdorlarni ko\'rish' },
  { key: 'attendance.view', label: "Davomatni ko'rish" },
];

interface ManagerRow { id: number; fullName: string; phone: string; permissions: { permKey: string; allowed: boolean }[] }

function ManagerSection({ branchId }: { branchId: number }) {
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);

  const { data: managers = [] } = useQuery<ManagerRow[]>(
    ['branch-managers', branchId],
    () => api.get(`/branches/${branchId}/manager`).then(r => r.data?.data ?? []),
  );

  const refresh = () => qc.invalidateQueries(['branch-managers', branchId]);

  const remove = useMutation(
    (userId: number) => api.delete(`/branches/${branchId}/manager/${userId}`),
    { onSuccess: () => { toast.success('Mas\'ullik olib tashlandi'); refresh(); },
      onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); } }
  );

  const togglePerm = useMutation(
    ({ userId, permKey, allowed }: { userId: number; permKey: string; allowed: boolean }) =>
      api.put(`/branches/manager/${userId}/permission`, { permKey, allowed }),
    { onSuccess: () => refresh(), onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); } }
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 p-5 mb-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" /> Filial mas'uli (ustoz)
        </h2>
        <button onClick={() => setPicking(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Mas'ul tayinlash
        </button>
      </div>

      {managers.length === 0 ? (
        <p className="text-sm text-zinc-400">Bu filialga mas'ul tayinlanmagan. Ustozni tayinlab, unga admin ruxsatlar bering.</p>
      ) : (
        <div className="space-y-4">
          {managers.map(m => (
            <div key={m.id} className="border border-zinc-100 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <UserCog className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-100">{m.fullName}</p>
                    <p className="text-xs text-zinc-400">{m.phone}</p>
                  </div>
                </div>
                <button onClick={() => { if (confirm(`${m.fullName} ni mas'ullikdan olib tashlaysizmi?`)) remove.mutate(m.id); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium border border-red-200">
                  <UserMinus className="w-3.5 h-3.5" /> Olib tashlash
                </button>
              </div>
              {/* Ruxsatlar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MANAGER_PERMS.map(perm => {
                  const cur = m.permissions.find(x => x.permKey === perm.key);
                  const allowed = cur ? cur.allowed : false;
                  return (
                    <button key={perm.key}
                      onClick={() => togglePerm.mutate({ userId: m.id, permKey: perm.key, allowed: !allowed })}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-zinc-100 dark:border-gray-700 hover:bg-zinc-50 dark:hover:bg-gray-700/40 text-left">
                      <span className="text-xs text-zinc-600 dark:text-zinc-300">{perm.label}</span>
                      <span className={clsx('w-8 h-4.5 rounded-full relative transition-colors flex-shrink-0',
                        allowed ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-gray-600')}>
                        <span className={clsx('absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform',
                          allowed ? 'translate-x-4' : 'translate-x-0.5')} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {picking && <PickTeacherModal branchId={branchId} onClose={() => setPicking(false)} onDone={() => { setPicking(false); refresh(); }} />}
    </div>
  );
}

function PickTeacherModal({ branchId, onClose, onDone }: { branchId: number; onClose: () => void; onDone: () => void }) {
  const [search, setSearch] = useState('');
  const { data: teachers = [] } = useQuery<any[]>(
    ['teachers-pick'],
    () => api.get('/teachers', { params: { limit: 100 } }).then(r => r.data?.data ?? []),
  );
  const assign = useMutation(
    (userId: number) => api.post(`/branches/${branchId}/manager`, { userId }),
    { onSuccess: (r) => { toast.success(r.data?.message || 'Tayinlandi'); onDone(); },
      onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); } }
  );
  const filtered = teachers.filter(t => (t.user?.fullName || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Ustozni mas'ul qilish</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-zinc-500" /></button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ustoz qidirish..."
          className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {filtered.length === 0 ? <p className="text-sm text-zinc-400 text-center py-6">Ustoz topilmadi</p> :
            filtered.map(t => (
              <button key={t.id} onClick={() => assign.mutate(t.user.id)} disabled={assign.isLoading}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-gray-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-left">
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{t.user?.fullName}</p>
                  <p className="text-xs text-zinc-400">{t.user?.phone}</p>
                </div>
                <Check className="w-4 h-4 text-emerald-500" />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
