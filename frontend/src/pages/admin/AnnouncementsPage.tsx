import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';

interface Announcement {
  id: number;
  title: string;
  content: string;
  targetRole: string | null;
  isActive: boolean;
  createdAt: string;
  author: { fullName: string };
}

const ROLE_OPTIONS = [
  { value: '', label: 'Hammaga' },
  { value: 'STUDENT', label: "O'quvchilar" },
  { value: 'TEACHER', label: 'Ustozlar' },
  { value: 'PARENT', label: 'Ota-onalar' },
];

const ROLE_COLORS: Record<string, string> = {
  STUDENT: 'bg-blue-100 text-blue-700',
  TEACHER: 'bg-violet-100 text-violet-700',
  PARENT: 'bg-green-100 text-green-700',
};

const empty = { title: '', content: '', targetRole: '', isActive: true };

const AnnouncementsPage = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>(
    'announcements',
    async () => {
      const r = await api.get('/announcements?limit=100');
      const d = r.data?.data;
      return Array.isArray(d) ? d : d?.announcements || [];
    }
  );

  const saveMutation = useMutation(
    (payload: typeof empty & { id?: number }) => {
      const body = { ...payload, targetRole: payload.targetRole || null };
      return payload.id
        ? api.put(`/announcements/${payload.id}`, body)
        : api.post('/announcements', body);
    },
    {
      onSuccess: () => {
        qc.invalidateQueries('announcements');
        setModal(false);
        setEditing(null);
        setForm(empty);
      },
    }
  );

  const deleteMutation = useMutation(
    (id: number) => api.delete(`/announcements/${id}`),
    { onSuccess: () => { qc.invalidateQueries('announcements'); setDeleteId(null); } }
  );

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({ title: a.title, content: a.content, targetRole: a.targetRole || '', isActive: a.isActive });
    setModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(editing ? { ...form, id: editing.id } : form);
  };

  const filtered = announcements.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.content.toLowerCase().includes(search.toLowerCase())
  );

  const active = announcements.filter(a => a.isActive).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">E'lonlar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Jami {announcements.length} ta, {active} ta faol</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <span className="text-lg">+</span> Yangi e'lon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-gray-800">{announcements.length}</div>
          <p className="text-xs text-gray-400 mt-1">Jami e'lon</p>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-emerald-600">{active}</div>
          <p className="text-xs text-gray-400 mt-1">Faol</p>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-gray-400">{announcements.length - active}</div>
          <p className="text-xs text-gray-400 mt-1">Arxivlangan</p>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <input
          className="input"
          placeholder="🔍 Qidirish..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="card text-center py-12">
          <div className="animate-spin w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Yuklanmoqda...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📢</div>
          <h2 className="text-lg font-semibold text-gray-700">E'lonlar yo'q</h2>
          <p className="text-gray-400 text-sm mt-1">Yangi e'lon qo'shish uchun tugmani bosing</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <div key={a.id} className={clsx(
              "card border-l-4 transition",
              a.isActive ? "border-l-indigo-500" : "border-l-gray-200 opacity-60"
            )}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-800">{a.title}</h3>
                    {a.targetRole ? (
                      <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", ROLE_COLORS[a.targetRole] || 'bg-gray-100 text-gray-600')}>
                        {ROLE_OPTIONS.find(r => r.value === a.targetRole)?.label}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">Hammaga</span>
                    )}
                    {!a.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Arxiv</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{a.content}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {a.author?.fullName} · {new Date(a.createdAt).toLocaleDateString('uz-UZ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(a)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setDeleteId(a.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  {editing ? "E'lonni tahrirlash" : "Yangi e'lon"}
                </h2>
                <button onClick={() => { setModal(false); setEditing(null); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Sarlavha *</label>
                  <input
                    className="input"
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    required
                    placeholder="E'lon sarlavhasi"
                  />
                </div>
                <div>
                  <label className="label">Matn *</label>
                  <textarea
                    className="input min-h-[100px] resize-none"
                    value={form.content}
                    onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                    required
                    placeholder="E'lon matni..."
                    rows={4}
                  />
                </div>
                <div>
                  <label className="label">Kimga</label>
                  <select
                    className="input"
                    value={form.targetRole}
                    onChange={e => setForm(p => ({ ...p, targetRole: e.target.value }))}
                  >
                    {ROLE_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={form.isActive}
                    onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700">Faol holat</label>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setModal(false); setEditing(null); }} className="flex-1 btn-secondary">
                    Bekor qilish
                  </button>
                  <button type="submit" disabled={saveMutation.isLoading} className="flex-1 btn-primary">
                    {saveMutation.isLoading ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">E'lonni o'chirish</h3>
            <p className="text-gray-500 text-sm mb-5">Bu e'lon o'chiriladi. Davom etasizmi?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 btn-secondary">Bekor</button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-xl transition"
              >
                {deleteMutation.isLoading ? 'O\'chirilmoqda...' : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPage;
