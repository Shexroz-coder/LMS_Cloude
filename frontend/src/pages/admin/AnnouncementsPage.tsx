import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';

// ─── Backend API bilan mos interface ─────────────────────
interface Announcement {
  id: number;
  title: string;
  body: string;            // backend "body" yuboradi, "content" emas
  targetRoles: string[];   // array, "targetRole" emas
  createdAt: string;
  creator: { fullName: string };  // "author" emas, "creator"
}

const ROLE_OPTIONS = [
  { value: 'STUDENT', label: "O'quvchilar" },
  { value: 'TEACHER', label: 'Ustozlar' },
  { value: 'PARENT', label: 'Ota-onalar' },
  { value: 'ADMIN', label: 'Adminlar' },
];

const ROLE_COLORS: Record<string, string> = {
  STUDENT: 'bg-blue-100 text-blue-700',
  TEACHER: 'bg-violet-100 text-violet-700',
  PARENT: 'bg-green-100 text-green-700',
  ADMIN: 'bg-red-100 text-red-700',
};

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "O'quvchilar",
  TEACHER: 'Ustozlar',
  PARENT: 'Ota-onalar',
  ADMIN: 'Adminlar',
};

// form state uchun tip
interface FormState {
  title: string;
  body: string;
  targetRoles: string[];  // multi-select checkbox
}

const emptyForm: FormState = { title: '', body: '', targetRoles: [] };

const AnnouncementsPage = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // ── Fetch e'lonlar ────────────────────────────────────
  const { data: announcements = [], isLoading } = useQuery<Announcement[]>(
    'announcements',
    async () => {
      const r = await api.get('/announcements?limit=100');
      const d = r.data?.data;
      return Array.isArray(d) ? d : [];
    }
  );

  // ── Saqlash (create / update) ─────────────────────────
  const saveMutation = useMutation(
    (payload: FormState & { id?: number }) => {
      const body = {
        title: payload.title,
        body: payload.body,
        targetRoles: payload.targetRoles,
      };
      return payload.id
        ? api.put(`/announcements/${payload.id}`, body)
        : api.post('/announcements', body);
    },
    {
      onSuccess: () => {
        qc.invalidateQueries('announcements');
        setModal(false);
        setEditing(null);
        setForm(emptyForm);
        setError('');
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          || "Saqlashda xatolik yuz berdi";
        setError(msg);
      },
    }
  );

  const deleteMutation = useMutation(
    (id: number) => api.delete(`/announcements/${id}`),
    { onSuccess: () => { qc.invalidateQueries('announcements'); setDeleteId(null); } }
  );

  // ── Modal ochish / yopish ─────────────────────────────
  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModal(true);
  };
  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({ title: a.title, body: a.body, targetRoles: a.targetRoles || [] });
    setError('');
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); setError(''); };

  // ── Form submit ───────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.body.trim()) {
      setError('Sarlavha va matn kiritilishi shart.');
      return;
    }
    saveMutation.mutate(editing ? { ...form, id: editing.id } : form);
  };

  // ── Role checkbox toggle ──────────────────────────────
  const toggleRole = (role: string) => {
    setForm(p => ({
      ...p,
      targetRoles: p.targetRoles.includes(role)
        ? p.targetRoles.filter(r => r !== role)
        : [...p.targetRoles, role],
    }));
  };

  // ── Filter ────────────────────────────────────────────
  const filtered = announcements.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.body.toLowerCase().includes(search.toLowerCase())
  );

  // ─────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">📢 E'lonlar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Jami {announcements.length} ta e'lon</p>
        </div>
        <button
          onClick={openNew}
          className="btn-primary flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span> Yangi e'lon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-gray-800">{announcements.length}</div>
          <p className="text-xs text-gray-400 mt-1">Jami e'lon</p>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600">
            {announcements.filter(a => a.targetRoles?.length === 0).length}
          </div>
          <p className="text-xs text-gray-400 mt-1">Hammaga</p>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-violet-600">
            {announcements.filter(a => (a.targetRoles?.length || 0) > 0).length}
          </div>
          <p className="text-xs text-gray-400 mt-1">Maqsadli</p>
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
          <div className="animate-spin w-7 h-7 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-3" />
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
            <div
              key={a.id}
              className="card border-l-4 border-l-red-500 transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Title + badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-800">{a.title}</h3>
                    {(a.targetRoles?.length || 0) === 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                        Hammaga
                      </span>
                    ) : (
                      a.targetRoles.map(r => (
                        <span
                          key={r}
                          className={clsx(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            ROLE_COLORS[r] || 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {ROLE_LABEL[r] || r}
                        </span>
                      ))
                    )}
                  </div>

                  {/* Body */}
                  <p className="text-sm text-gray-600 line-clamp-2">{a.body}</p>

                  {/* Meta */}
                  <p className="text-xs text-gray-400 mt-2">
                    {a.creator?.fullName} · {new Date(a.createdAt).toLocaleDateString('uz-UZ')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(a)}
                    className="text-xs text-gray-500 hover:text-blue-600 font-medium px-2 py-1 rounded hover:bg-blue-50 transition"
                    title="Tahrirlash"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setDeleteId(a.id)}
                    className="text-xs text-gray-500 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                    title="O'chirish"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ──────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Modal header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  {editing ? "E'lonni tahrirlash" : "Yangi e'lon"}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>

              {/* Error */}
              {(error || saveMutation.isError) && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  {error || 'Saqlashda xato yuz berdi. Qayta urinib ko\'ring.'}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Title */}
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

                {/* Body */}
                <div>
                  <label className="label">Matn *</label>
                  <textarea
                    className="input min-h-[100px] resize-none"
                    value={form.body}
                    onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                    required
                    placeholder="E'lon matni..."
                    rows={4}
                  />
                </div>

                {/* Target roles — multi checkbox */}
                <div>
                  <label className="label">Kimga yuborilsin</label>
                  <p className="text-xs text-gray-400 mb-2">
                    Hech birini tanlamasangiz — barcha foydalanuvchilarga yuboriladi
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLE_OPTIONS.map(r => (
                      <label
                        key={r.value}
                        className={clsx(
                          "flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition text-sm",
                          form.targetRoles.includes(r.value)
                            ? "border-red-400 bg-red-50 text-red-700 font-medium"
                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-red-600"
                          checked={form.targetRoles.includes(r.value)}
                          onChange={() => toggleRole(r.value)}
                        />
                        {r.label}
                      </label>
                    ))}
                  </div>
                  {form.targetRoles.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      ℹ️ Hammaga yuboriladi
                    </p>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 btn-secondary"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={saveMutation.isLoading}
                    className="flex-1 btn-primary"
                  >
                    {saveMutation.isLoading ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ───────────────────────────── */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">E'lonni o'chirish</h3>
            <p className="text-gray-500 text-sm mb-5">
              Bu e'lon o'chirilib, tegishli bildirishnomalar ham o'chirilmaydi. Davom etasizmi?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 btn-secondary">
                Bekor
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-xl transition"
              >
                {deleteMutation.isLoading ? "O'chirilmoqda..." : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPage;
