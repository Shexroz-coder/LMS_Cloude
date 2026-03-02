import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  UserCheck, Plus, Search, Edit2, Trash2, X,
  Phone, BookOpen, Percent, DollarSign, Eye
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../api/axios';
import { clsx } from 'clsx';

interface Teacher {
  id: number; userId: number;
  salaryType: string; salaryValue: number; notes?: string;
  user: { id: number; fullName: string; phone: string; email?: string; isActive: boolean; createdAt: string; };
  _count: { groups: number };
}

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
const formatMoney = (v: number) => new Intl.NumberFormat('uz-UZ').format(v) + " so'm";

const TeachersPage = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Teacher | null>(null);

  const { data, isLoading } = useQuery(
    ['teachers', search],
    () => api.get('/teachers', { params: { search: search || undefined, limit: 100 } })
      .then(r => r.data.data).catch(() => [])
  );

  const teachers: Teacher[] = data || [];

  const deleteMutation = useMutation(
    (id: number) => api.delete(`/teachers/${id}`),
    {
      onSuccess: () => { toast.success("Ustoz o'chirildi"); qc.invalidateQueries('teachers'); setDeleteConfirm(null); },
      onError: () => toast.error('Xato yuz berdi')
    }
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-emerald-600" /> Ustozlar
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Jami {teachers.length} ta ustoz</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1.5 text-sm self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Yangi ustoz
        </button>
      </div>

      {/* Search */}
      <div className="card py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Ism yoki telefon bo'yicha qidirish..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-9 py-2 text-sm w-full" />
        </div>
      </div>

      {/* Teachers Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse space-y-3">
              <div className="flex gap-3"><div className="w-12 h-12 rounded-xl bg-gray-200" /><div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded w-3/4" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div></div>
            </div>
          ))}
        </div>
      ) : teachers.length === 0 ? (
        <div className="card text-center py-16">
          <UserCheck className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400">Ustozlar topilmadi</p>
          <button onClick={() => setShowAddModal(true)} className="mt-3 text-sm text-primary-600 hover:underline">+ Birinchi ustozni qo'shish</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teachers.map(teacher => (
            <div key={teacher.id} className="card hover:shadow-card-hover transition-shadow group/card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg">
                    {getInitials(teacher.user.fullName)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{teacher.user.fullName}</h3>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {teacher.user.phone}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <button onClick={() => setEditTeacher(teacher)} className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteConfirm(teacher)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <BookOpen className="w-3.5 h-3.5" /> Guruhlar
                  </span>
                  <span className="font-semibold text-gray-800">{teacher._count.groups} ta</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    {teacher.salaryType === 'PERCENTAGE_FROM_PAYMENT' ? <Percent className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                    Ish haqi
                  </span>
                  <span className="font-semibold text-emerald-600">
                    {teacher.salaryType === 'PERCENTAGE_FROM_PAYMENT'
                      ? `${teacher.salaryValue}% (tushum)`
                      : formatMoney(teacher.salaryValue)
                    }
                  </span>
                </div>
                {teacher.user.email && (
                  <p className="text-xs text-gray-400 truncate">{teacher.user.email}</p>
                )}
              </div>

              {teacher.notes && (
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <p className="text-xs text-gray-400 line-clamp-2">{teacher.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {(showAddModal || editTeacher) && (
        <TeacherFormModal
          teacher={editTeacher}
          onClose={() => { setShowAddModal(false); setEditTeacher(null); }}
          onSuccess={() => { setShowAddModal(false); setEditTeacher(null); qc.invalidateQueries('teachers'); }}
        />
      )}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold mb-1">Ustozni o'chirish</h3>
            <p className="text-sm text-gray-500 mb-5"><strong>{deleteConfirm.user.fullName}</strong>ni o'chirmoqchimisiz?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Bekor</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-60">
                {deleteMutation.isLoading ? '...' : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Teacher Form Modal ─────────────────────────────
const TeacherFormModal = ({ teacher, onClose, onSuccess }: {
  teacher: Teacher | null; onClose: () => void; onSuccess: () => void;
}) => {
  const isEdit = !!teacher;
  const [form, setForm] = useState({
    fullName: teacher?.user.fullName || '',
    phone: teacher?.user.phone || '',
    email: teacher?.user.email || '',
    password: '',
    salaryType: teacher?.salaryType || 'PERCENTAGE_FROM_PAYMENT',
    salaryValue: teacher?.salaryValue?.toString() || '20',
    notes: teacher?.notes || '',
    language: 'uz',
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.phone) { toast.error('Ism va telefon kiritilishi shart'); return; }
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete (payload as Record<string, unknown>).password;
      if (isEdit) {
        await api.put(`/teachers/${teacher!.id}`, payload);
        toast.success('Ustoz yangilandi!');
      } else {
        await api.post('/teachers', payload);
        toast.success('Ustoz qo\'shildi!');
      }
      onSuccess();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xato');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold">{isEdit ? 'Ustozni tahrirlash' : "Yangi ustoz qo'shish"}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="label">To'liq ism *</label>
            <input type="text" value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Familiya Ismi" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Telefon *</label>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+998901234567" className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@gmail.com" className="input" />
            </div>
          </div>
          {!isEdit && (
            <div>
              <label className="label">Parol</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="teacher123" className="input" />
            </div>
          )}
          <div>
            <label className="label">Ish haqi turi</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'PERCENTAGE_FROM_PAYMENT', label: 'Foiz (%)', desc: 'Tushum foizidan' },
                { value: 'PER_LESSON_HOUR', label: 'Soatbay', desc: 'Har soat uchun' },
              ].map(opt => (
                <label key={opt.value} className={clsx(
                  'flex items-start gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors',
                  form.salaryType === opt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                )}>
                  <input type="radio" name="salaryType" value={opt.value} checked={form.salaryType === opt.value}
                    onChange={() => set('salaryType', opt.value)} className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">
              {form.salaryType === 'PERCENTAGE_FROM_PAYMENT' ? 'Foiz miqdori (%)' : "Oylik ish haqi (so'm)"}
            </label>
            <input type="number" value={form.salaryValue} onChange={e => set('salaryValue', e.target.value)}
              placeholder={form.salaryType === 'PERCENTAGE_FROM_PAYMENT' ? '20' : '3000000'} className="input" />
          </div>
          <div>
            <label className="label">Izoh</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} placeholder="Qo'shimcha ma'lumotlar..." className="input resize-none" />
          </div>
        </form>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1">Bekor</button>
          <button onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Saqlanmoqda...' : isEdit ? 'Saqlash' : "Qo'shish"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeachersPage;
