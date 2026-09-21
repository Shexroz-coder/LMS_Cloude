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
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '../../api/axios';

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
      <button onClick={() => navigate('/admin/branches')} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 mb-3">
        <ArrowLeft className="w-4 h-4" /> Filiallar
      </button>
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
        <button onClick={() => setRoomModal({ mode: 'create' })}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Xona qo'shish</span>
        </button>
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
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setAssignRoom(room)} title="Guruh biriktirish"
                    className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg"><Link2 className="w-4 h-4" /></button>
                  <button onClick={() => setRoomModal({ mode: 'edit', room })} title="Tahrirlash"
                    className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm(`"${room.name}" xonasini o'chirasizmi? Guruhlar bo'shatiladi.`)) deleteRoom.mutate(room.id); }} title="O'chirish"
                    className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
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
