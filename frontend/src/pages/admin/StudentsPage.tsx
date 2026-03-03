import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Search, Plus, Filter, Download, Users, AlertCircle,
  ChevronLeft, ChevronRight, Eye, Edit2, Trash2, X,
  Phone, Calendar, MapPin, BookOpen, Coins, CreditCard,
  CheckCircle, Clock, TrendingUp, UserCheck, Pencil, CalendarDays
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import api from '../../api/axios';
import { clsx } from 'clsx';

// ── Types ──────────────────────────────────────────
interface StudentUser {
  id: number; fullName: string; phone: string;
  email?: string; avatarUrl?: string; isActive: boolean; createdAt: string;
}
interface GroupInfo {
  group: { id: number; name: string; course: { name: string; monthlyPrice: number }; teacher: { user: { fullName: string } } };
  joinedAt: string;
}
interface Balance { balance: number; debt: number; }
interface Student {
  id: number; userId: number; coinBalance: number;
  birthDate?: string; address?: string; notes?: string;
  discountType?: string; discountValue?: number;
  status?: string; demoDate?: string; leftAt?: string; leftReason?: string;
  user: StudentUser; parent?: StudentUser;
  balance?: Balance;
  groupStudents: GroupInfo[];
  _count: { attendance: number; grades: number; payments: number; coinTransactions: number };
  stats?: Record<string, number>;
}
interface Pagination { total: number; page: number; limit: number; totalPages: number; }

// ── Helpers ────────────────────────────────────────
const formatMoney = (v: number) => new Intl.NumberFormat('uz-UZ').format(v) + " so'm";
const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// ══════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════
const StudentsPage = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterDebt, setFilterDebt] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Student | null>(null);
  const [dueDayStudent, setDueDayStudent] = useState<Student | null>(null);

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    clearTimeout((window as Record<string, unknown>)._searchTimer as ReturnType<typeof setTimeout>);
(window as Record<string, unknown>)._searchTimer = setTimeout(() => { ... });
      setDebouncedSearch(v);
      setPage(1);
    }, 400);
  }, []);

  const { data, isLoading } = useQuery(
    ['students', page, debouncedSearch, filterDebt, selectedGroupId, selectedStatus],
    () => api.get('/students', {
      params: {
        page, limit: 15, search: debouncedSearch || undefined,
        hasDebt: filterDebt ? 'true' : undefined,
        groupId: selectedGroupId || undefined,
        status: selectedStatus || undefined,
      }
    }).then(r => r.data),
    { keepPreviousData: true }
  );

  const { data: groupsData } = useQuery('groups-list', () =>
    api.get('/groups', { params: { limit: 100, status: 'ACTIVE' } })
      .then(r => r.data.data).catch(() => [])
  );

  const students: Student[] = data?.data || [];
  const pagination: Pagination = data?.meta || { total: 0, page: 1, limit: 15, totalPages: 1 };

  const deleteMutation = useMutation(
    (id: number) => api.delete(`/students/${id}`),
    {
      onSuccess: (_data: unknown) => {
        void toast.success("O'quvchi o'chirildi");
        qc.invalidateQueries('students');
        setDeleteConfirm(null);
      },
      onError: (_err: unknown) => { void toast.error("Xato yuz berdi"); }
    }
  );

  const exportCSV = () => {
    const headers = ["Ism", "Telefon", "Guruh", "Balans", "Qarz", "Coin"];
    const rows = students.map(s => [
      s.user.fullName, s.user.phone,
      s.groupStudents.map(g => g.group.name).join('; ') || '—',
      s.balance?.balance || 0, s.balance?.debt || 0, s.coinBalance
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'talabalar.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary-600" />
            {t('nav.students')}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Jami <span className="font-semibold text-gray-700">{pagination.total}</span> ta o'quvchi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Yangi o'quvchi
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="card py-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Ism yoki telefon bo'yicha qidirish..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="input pl-9 py-2 text-sm w-full"
            />
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
              showFilter || filterDebt || selectedGroupId || selectedStatus
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-600'
            )}
          >
            <Filter className="w-4 h-4" />
            Filtr
            {(filterDebt || selectedGroupId || selectedStatus) && (
              <span className="w-2 h-2 rounded-full bg-primary-500 ml-0.5" />
            )}
          </button>
        </div>

        {showFilter && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterDebt}
                onChange={e => { setFilterDebt(e.target.checked); setPage(1); }}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" /> Faqat qarzdorlar
              </span>
            </label>
            {Array.isArray(groupsData) && groupsData.length > 0 && (
              <select
                value={selectedGroupId}
                onChange={e => { setSelectedGroupId(e.target.value); setPage(1); }}
                className="input py-1.5 text-sm max-w-[200px]"
              >
                <option value="">Barcha guruhlar</option>
                {(groupsData as { id: number; name: string }[]).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
            <select
              value={selectedStatus}
              onChange={e => { setSelectedStatus(e.target.value); setPage(1); }}
              className="input py-1.5 text-sm max-w-[200px]"
            >
              <option value="">Barcha statuslar</option>
              <option value="LEAD">Lid</option>
              <option value="DEMO">Demo</option>
              <option value="ACTIVE">Faol</option>
              <option value="INACTIVE">Ketgan</option>
            </select>
            {(filterDebt || selectedGroupId || selectedStatus) && (
              <button
                onClick={() => { setFilterDebt(false); setSelectedGroupId(''); setSelectedStatus(''); setPage(1); }}
                className="text-xs text-red-500 hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Tozalash
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>O'quvchi</th>
                <th className="hidden md:table-cell">Guruh</th>
                <th className="hidden lg:table-cell">Balans</th>
                <th className="hidden lg:table-cell">Qarz</th>
                <th className="hidden sm:table-cell">Coin</th>
                <th>Holat</th>
                <th className="w-28 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-400">O'quvchilar topilmadi</p>
                    <button onClick={() => setShowAddModal(true)} className="mt-3 text-sm text-primary-600 hover:underline">
                      + Birinchi o'quvchini qo'shish
                    </button>
                  </td>
                </tr>
              ) : (
                students.map((s, i) => {
                  const debt = Number(s.balance?.debt || 0);
                  const bal = Number(s.balance?.balance || 0);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="text-gray-400 text-xs">{(page - 1) * 15 + i + 1}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {getInitials(s.user.fullName)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800 text-sm leading-tight">{s.user.fullName}</div>
                            <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />{s.user.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell">
                        {s.groupStudents.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {s.groupStudents.slice(0, 2).map((gs, gi) => (
                              <span key={gi} className="badge badge-blue text-xs">{gs.group.name}</span>
                            ))}
                            {s.groupStudents.length > 2 && (
                              <span className="text-xs text-gray-400">+{s.groupStudents.length - 2}</span>
                            )}
                          </div>
                        ) : <span className="text-gray-300 text-sm">—</span>}
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-sm font-medium text-emerald-600">{formatMoney(bal)}</span>
                      </td>
                      <td className="hidden lg:table-cell">
                        {debt > 0
                          ? <span className="text-sm font-semibold text-red-500">{formatMoney(debt)}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="flex items-center gap-1 text-sm text-amber-600 font-medium">
                          <Coins className="w-3.5 h-3.5" />{s.coinBalance}
                        </span>
                      </td>
                      <td>
                        {s.status === 'LEAD' ? (
                          <span className="badge bg-blue-100 text-blue-700 text-xs">Lid</span>
                        ) : s.status === 'DEMO' ? (
                          <span className="badge bg-amber-100 text-amber-700 text-xs">Demo</span>
                        ) : s.status === 'ACTIVE' ? (
                          <span className="badge badge-green text-xs">Faol</span>
                        ) : s.status === 'INACTIVE' ? (
                          <span className="badge bg-gray-100 text-gray-700 text-xs">Ketgan</span>
                        ) : debt > 0 ? (
                          <span className="badge badge-red text-xs">Qarzdor</span>
                        ) : (
                          <span className="badge badge-green text-xs">Faol</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => setViewStudent(s)} title="Ko'rish"
                            className="p-1.5 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditStudent(s)} title="Tahrirlash"
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDueDayStudent(s)} title="To'lov kuni"
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors">
                            <Calendar className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteConfirm(s)} title="O'chirish"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {(page - 1) * 15 + 1}–{Math.min(page * 15, pagination.total)} / {pagination.total} ta
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {[...Array(Math.min(5, pagination.totalPages))].map((_, idx) => {
                const pg = idx + 1;
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={clsx('w-8 h-8 text-sm rounded-lg transition-colors',
                      page === pg ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 text-gray-600')}>
                    {pg}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────── */}
      {(showAddModal || editStudent) && (
        <StudentFormModal
          student={editStudent}
          onClose={() => { setShowAddModal(false); setEditStudent(null); }}
          onSuccess={() => { setShowAddModal(false); setEditStudent(null); qc.invalidateQueries('students'); }}
        />
      )}
      {viewStudent && (
        <StudentProfileDrawer
          studentId={viewStudent.id}
          onClose={() => setViewStudent(null)}
          onEdit={() => { setEditStudent(viewStudent); setViewStudent(null); }}
        />
      )}
      {dueDayStudent && (
        <PaymentDueDayModal
          student={dueDayStudent}
          onClose={() => setDueDayStudent(null)}
          onSuccess={() => { setDueDayStudent(null); qc.invalidateQueries('students'); }}
        />
      )}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">O'chirishni tasdiqlang</h3>
            <p className="text-sm text-gray-500 mb-5">
              <strong>{deleteConfirm.user.fullName}</strong> o'quvchini o'chirmoqchimisiz?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Bekor</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-60">
                {deleteMutation.isLoading ? 'Jarayonda...' : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════
// Student Form Modal
// ══════════════════════════════════════════════════
interface FormState {
  fullName: string; phone: string; email: string; password: string;
  parentPhone: string; birthDate: string; address: string; notes: string;
  discountType: string; discountValue: string; language: string;
  status: string; demoDate: string; startDate: string; leftReason: string;
}

const StudentFormModal = ({ student, onClose, onSuccess }: {
  student: Student | null; onClose: () => void; onSuccess: () => void;
}) => {
  const isEdit = !!student;
  const [form, setForm] = useState<FormState>({
    fullName: student?.user.fullName || '',
    phone: student?.user.phone || '',
    email: student?.user.email || '',
    password: '',
    parentPhone: student?.parent?.phone || '',
    birthDate: student?.birthDate ? format(new Date(student.birthDate), 'yyyy-MM-dd') : '',
    address: student?.address || '',
    notes: student?.notes || '',
    discountType: student?.discountType || '',
    discountValue: student?.discountValue?.toString() || '',
    language: 'uz',
    status: student?.status || 'LEAD',
    demoDate: student?.demoDate ? format(new Date(student.demoDate), 'yyyy-MM-dd') : '',
    startDate: student?.groupStudents?.[0]?.joinedAt
      ? format(new Date(student.groupStudents[0].joinedAt), 'yyyy-MM-dd') : '',
    leftReason: student?.leftReason || '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  const set = (k: keyof FormState, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Partial<FormState> = {};
    if (!form.fullName.trim()) errs.fullName = 'Ism kiritilishi shart';
    if (!form.phone.trim()) errs.phone = 'Telefon kiritilishi shart';
    if (!isEdit && !form.password) errs.password = 'Parol kiritilishi shart';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!payload.password) delete payload.password;
      if (!payload.email) delete payload.email;
      if (!payload.parentPhone) delete payload.parentPhone;
      if (!payload.demoDate) delete payload.demoDate;
      if (!payload.leftReason) delete payload.leftReason;
      if (!payload.language) delete payload.language;
      // startDate → joinedAt nomiga o'tkazamiz
      if (payload.startDate) {
        payload.joinedAt = payload.startDate;
      }
      delete payload.startDate;
      if (isEdit) {
        await api.put(`/students/${student!.id}`, payload);
        toast.success("O'quvchi yangilandi!");
      } else {
        await api.post('/students', payload);
        toast.success("Yangi o'quvchi qo'shildi!");
      }
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xato yuz berdi';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? "O'quvchini tahrirlash" : "Yangi o'quvchi qo'shish"}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">To'liq ism *</label>
              <input type="text" value={form.fullName} onChange={e => set('fullName', e.target.value)}
                placeholder="Familiya Ismi Sharifi"
                className={clsx('input', errors.fullName && 'border-red-300')} />
              {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
            </div>
            <div>
              <label className="label">Telefon *</label>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+998901234567"
                className={clsx('input', errors.phone && 'border-red-300')} />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="email@gmail.com" className="input" />
            </div>
            {!isEdit && (
              <div>
                <label className="label">Parol *</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  placeholder="Kamida 8 belgi"
                  className={clsx('input', errors.password && 'border-red-300')} />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>
            )}
            <div>
              <label className="label">Ota-ona telefoni</label>
              <input type="tel" value={form.parentPhone} onChange={e => set('parentPhone', e.target.value)}
                placeholder="+998901234568" className="input" />
            </div>
            <div>
              <label className="label">Tug'ilgan sana</label>
              <input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Manzil</label>
              <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
                placeholder="Shahar, ko'cha, uy" className="input" />
            </div>
            <div>
              <label className="label">Chegirma turi</label>
              <select value={form.discountType} onChange={e => set('discountType', e.target.value)} className="input">
                <option value="">Chegirma yo'q</option>
                <option value="PERCENTAGE">Foiz (%)</option>
                <option value="FIXED_AMOUNT">Aniq summa (so'm)</option>
              </select>
            </div>
            <div>
              <label className="label">Chegirma miqdori</label>
              <input type="number" value={form.discountValue} onChange={e => set('discountValue', e.target.value)}
                placeholder={form.discountType === 'PERCENTAGE' ? '10' : '50000'}
                disabled={!form.discountType} className="input disabled:opacity-50" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Izoh</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                rows={2} placeholder="Qo'shimcha ma'lumotlar..." className="input resize-none" />
            </div>
            <div>
              <label className="label">Holat</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="input">
                <option value="LEAD">Lid</option>
                <option value="DEMO">Demo</option>
                <option value="ACTIVE">Faol</option>
                <option value="INACTIVE">Ketgan</option>
              </select>
            </div>

            {/* Demo dars sanasi — DEMO yoki LEAD statusda ko'rsatiladi */}
            <div>
              <label className="label flex items-center gap-1.5">
                <span className="text-amber-500">🎯</span> Demo dars sanasi
              </label>
              <input
                type="date"
                value={form.demoDate}
                onChange={e => set('demoDate', e.target.value)}
                className="input"
                max={new Date().toISOString().slice(0, 10)}
              />
              <p className="text-xs text-gray-400 mt-1">O'quvchi demo darsga kelgan sana</p>
            </div>

            {/* O'qishni boshlagan sana */}
            <div>
              <label className="label flex items-center gap-1.5">
                <span className="text-emerald-500">🎓</span> O'qishni boshlagan sana
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => set('startDate', e.target.value)}
                className="input"
                max={new Date().toISOString().slice(0, 10)}
              />
              <p className="text-xs text-gray-400 mt-1">Guruhga qo'shilgan sana (to'lov uchun muhim)</p>
            </div>

            {form.status === 'INACTIVE' && (
              <div className="sm:col-span-2">
                <label className="label">Ketish sababi</label>
                <textarea value={form.leftReason} onChange={e => set('leftReason', e.target.value)}
                  rows={2} placeholder="Nima sababdan ketdi..." className="input resize-none" />
              </div>
            )}
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

// ══════════════════════════════════════════════════
// Student Profile Drawer
// ══════════════════════════════════════════════════
const StudentProfileDrawer = ({ studentId, onClose, onEdit }: {
  studentId: number; onClose: () => void; onEdit: () => void;
}) => {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'info' | 'attendance' | 'grades' | 'payments'>('info');
  const [editingJoinedAt, setEditingJoinedAt] = useState<{ groupId: number; groupName: string; current: string } | null>(null);
  const [joinedAtValue, setJoinedAtValue] = useState('');
  const [savingJoinedAt, setSavingJoinedAt] = useState(false);

  const { data: s, isLoading } = useQuery(
    ['student-detail', studentId],
    () => api.get(`/students/${studentId}`).then(r => r.data.data)
  );

  const saveJoinedAt = async () => {
    if (!editingJoinedAt || !joinedAtValue) return;
    setSavingJoinedAt(true);
    try {
      await api.patch(`/students/${studentId}/groups/${editingJoinedAt.groupId}/joined-at`, {
        joinedAt: joinedAtValue,
      });
      toast.success("O'qishni boshlagan sana yangilandi!");
      qc.invalidateQueries(['student-detail', studentId]);
      setEditingJoinedAt(null);
    } catch {
      toast.error('Xato yuz berdi');
    } finally {
      setSavingJoinedAt(false);
    }
  };

  const tabs = [
    { key: 'info' as const, label: "Ma'lumot", icon: UserCheck },
    { key: 'attendance' as const, label: 'Davomat', icon: CheckCircle },
    { key: 'grades' as const, label: 'Baholar', icon: TrendingUp },
    { key: 'payments' as const, label: "To'lovlar", icon: CreditCard },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full sm:w-[480px] bg-white flex flex-col shadow-2xl">
        {isLoading || !s ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-600 to-violet-600 px-6 pt-5 pb-8 text-white">
              <div className="flex items-start justify-between mb-4">
                <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
                <button onClick={onEdit}
                  className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  <Edit2 className="w-3.5 h-3.5" /> Tahrirlash
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">
                  {getInitials(s.user.fullName)}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{s.user.fullName}</h2>
                  <p className="text-white/80 text-sm flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5" /> {s.user.phone}
                  </p>
                  {s.user.email && <p className="text-white/60 text-xs mt-0.5">{s.user.email}</p>}
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 border-b border-gray-100">
              {[
                { label: 'Balans', value: formatMoney(Number(s.balance?.balance || 0)), color: 'text-emerald-600' },
                { label: 'Qarz', value: Number(s.balance?.debt || 0) > 0 ? formatMoney(Number(s.balance?.debt)) : '0', color: Number(s.balance?.debt || 0) > 0 ? 'text-red-500' : 'text-gray-400' },
                { label: 'Coin', value: String(s.coinBalance), color: 'text-amber-500', icon: Coins },
              ].map((stat, i) => (
                <div key={i} className={clsx('text-center py-3', i < 2 && 'border-r border-gray-100')}>
                  <p className={clsx('text-lg font-bold flex items-center justify-center gap-1', stat.color)}>
                    {stat.icon && <stat.icon className="w-4 h-4" />}
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={clsx(
                    'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors border-b-2',
                    activeTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}>
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'info' && (
                <div className="space-y-4">
                  {/* Groups */}
                  <Section title="Guruhlar">
                    {s.groupStudents?.length > 0 ? (
                      s.groupStudents.map((gs: GroupInfo, i: number) => (
                        <div key={i} className="p-3 rounded-xl bg-gray-50 mb-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-sm text-gray-800">{gs.group.name}</div>
                              <div className="text-xs text-gray-500">{gs.group.course.name} · {gs.group.teacher.user.fullName}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-primary-600">{formatMoney(gs.group.course.monthlyPrice)}</div>
                              <div className="text-xs text-gray-400">/oy</div>
                            </div>
                          </div>
                          {/* Sana qatori */}
                          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
                              <span>O'qishni boshlagan:</span>
                              <span className="font-medium text-gray-700">
                                {gs.joinedAt
                                  ? format(new Date(gs.joinedAt), 'd-MMM yyyy')
                                  : '—'}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                setEditingJoinedAt({
                                  groupId: gs.group.id,
                                  groupName: gs.group.name,
                                  current: gs.joinedAt ? format(new Date(gs.joinedAt), 'yyyy-MM-dd') : ''
                                });
                                setJoinedAtValue(gs.joinedAt ? format(new Date(gs.joinedAt), 'yyyy-MM-dd') : '');
                              }}
                              className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-700 transition-colors"
                            >
                              <Pencil className="w-3 h-3" /> O'zgartirish
                            </button>
                          </div>
                        </div>
                      ))
                    ) : <p className="text-sm text-gray-400">Hech qaysi guruhda yo'q</p>}
                  </Section>

                  {/* Status */}
                  <Section title="Holat va Sanalar">
                    <div className="flex items-center gap-2 mb-3">
                      {s.status === 'LEAD' ? (
                        <span className="badge bg-blue-100 text-blue-700">Lid</span>
                      ) : s.status === 'DEMO' ? (
                        <span className="badge bg-amber-100 text-amber-700">Demo</span>
                      ) : s.status === 'ACTIVE' ? (
                        <span className="badge badge-green">Faol</span>
                      ) : s.status === 'INACTIVE' ? (
                        <span className="badge bg-gray-100 text-gray-700">Ketgan</span>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      {/* Demo dars sanasi — doim ko'rsatiladi */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-amber-500 text-base">🎯</span>
                        <span className="text-gray-500 text-xs w-32 flex-shrink-0">Demo dars sanasi:</span>
                        <span className={s.demoDate ? 'font-medium text-amber-700' : 'text-gray-300 text-xs'}>
                          {s.demoDate ? format(new Date(s.demoDate), 'd-MMMM yyyy') : 'Kiritilmagan'}
                        </span>
                      </div>

                      {/* Tizimdagi sana */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-blue-500 text-base">📅</span>
                        <span className="text-gray-500 text-xs w-32 flex-shrink-0">Tizimga qo'shilgan:</span>
                        <span className="font-medium text-gray-700">
                          {format(new Date(s.user.createdAt), 'd-MMMM yyyy')}
                        </span>
                      </div>

                      {s.status === 'INACTIVE' && s.leftAt && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-red-400 text-base">🚪</span>
                          <span className="text-gray-500 text-xs w-32 flex-shrink-0">Ketgan sana:</span>
                          <span className="font-medium text-red-600">{format(new Date(s.leftAt), 'd-MMMM yyyy')}</span>
                        </div>
                      )}
                      {s.status === 'INACTIVE' && s.leftReason && (
                        <div className="p-2 bg-red-50 rounded-lg">
                          <p className="text-xs text-red-600">Sabab: {s.leftReason}</p>
                        </div>
                      )}
                    </div>
                  </Section>

                  {/* Personal */}
                  <Section title="Shaxsiy ma'lumotlar">
                    <div className="space-y-2">
                      {s.birthDate && (
                        <InfoRow icon={Calendar} label={format(new Date(s.birthDate), 'd-MMMM yyyy')} />
                      )}
                      {s.address && <InfoRow icon={MapPin} label={s.address} />}
                      {s.parent && (
                        <InfoRow icon={Phone} label={`${s.parent.fullName} (${s.parent.phone})`} />
                      )}
                      {s.discountType && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-400 text-xs w-20 flex-shrink-0">Chegirma:</span>
                          <span className="badge badge-yellow text-xs">
                            {s.discountType === 'PERCENTAGE' ? `${s.discountValue}%` : formatMoney(Number(s.discountValue))}
                          </span>
                        </div>
                      )}
                    </div>
                  </Section>

                  {/* Stats */}
                  {s.stats && (
                    <Section title="Statistika">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Jami darslar', value: s.stats.totalLessons || 0, icon: BookOpen, color: 'text-blue-500' },
                          { label: 'Keldi/Kelmadi', value: `${s.stats.presentCount || 0}/${s.stats.totalLessons || 0}`, icon: CheckCircle, color: 'text-green-500' },
                          { label: "O'rtacha baho", value: (s.stats.avgScore || 0).toFixed(1), icon: TrendingUp, color: 'text-purple-500' },
                          { label: "Jami to'lov", value: formatMoney(s.stats.totalPayments || 0), icon: CreditCard, color: 'text-emerald-500' },
                        ].map((stat, i) => (
                          <div key={i} className="p-3 rounded-xl bg-gray-50">
                            <stat.icon className={clsx('w-4 h-4 mb-1', stat.color)} />
                            <div className="text-sm font-bold text-gray-800">{stat.value}</div>
                            <div className="text-xs text-gray-500">{stat.label}</div>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {s.notes && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Izoh</p>
                      <p className="text-sm text-amber-600">{s.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'attendance' && (
                <EmptyTab icon={Clock} text="Davomat tarixi" sub="Darslar qo'shilganidan keyin ko'rinadi" />
              )}
              {activeTab === 'grades' && (
                <EmptyTab icon={TrendingUp} text="Baholar tarixi" sub="Baholar qo'yilganidan keyin ko'rinadi" />
              )}
              {activeTab === 'payments' && (
                <EmptyTab icon={CreditCard} text="To'lovlar tarixi" sub="To'lovlar amalga oshirilganidan keyin ko'rinadi" />
              )}
            </div>
          </>
        )}
      </div>
      {/* ── JoinedAt Edit Modal ─────────────────── */}
      {editingJoinedAt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">O'qishni boshlagan sana</h3>
                <p className="text-xs text-gray-500 mt-0.5">{editingJoinedAt.groupName}</p>
              </div>
              <button onClick={() => setEditingJoinedAt(null)}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  🎓 Guruhga qo'shilgan (o'qish boshlanган) sana:
                </label>
                <input
                  type="date"
                  value={joinedAtValue}
                  onChange={e => setJoinedAtValue(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Bu sana to'lov hisob-kitobida ishlatiladi
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditingJoinedAt(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  Bekor
                </button>
                <button
                  onClick={saveJoinedAt}
                  disabled={!joinedAtValue || savingJoinedAt}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium
                    hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {savingJoinedAt ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ─────────────────────────────────
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h4>
    {children}
  </div>
);

const InfoRow = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="flex items-start gap-3 text-sm">
    <Icon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
    <span className="text-gray-600">{label}</span>
  </div>
);

const EmptyTab = ({ icon: Icon, text, sub }: { icon: React.ElementType; text: string; sub: string }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Icon className="w-10 h-10 text-gray-200 mb-3" />
    <p className="text-sm font-medium text-gray-500">{text}</p>
    <p className="text-xs text-gray-400 mt-1">{sub}</p>
  </div>
);

// ══════════════════════════════════════════════════
// To'lov kuni Modal
// ══════════════════════════════════════════════════
const PaymentDueDayModal = ({ student, onClose, onSuccess }: {
  student: Student; onClose: () => void; onSuccess: () => void;
}) => {
  const [dueDay, setDueDay] = useState('');
  const [remindDays, setRemindDays] = useState('3');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!dueDay) { toast.error('Kun kiritilishi shart'); return; }
    const d = parseInt(dueDay);
    if (d < 1 || d > 28) { toast.error("Kun 1 dan 28 gacha bo'lishi kerak"); return; }
    setLoading(true);
    try {
      await api.patch(`/payments/student/${student.id}/due-day`, {
        dueDay: d,
        remindDaysBefore: parseInt(remindDays),
      });
      toast.success("To'lov kuni belgilandi!");
      onSuccess();
    } catch {
      toast.error('Xato yuz berdi');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900">To'lov kuni belgilash</h3>
            <p className="text-xs text-gray-500 mt-0.5">{student.user.fullName}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Har oyning necha-sida to'laydi?
            </label>
            <div className="grid grid-cols-7 gap-1.5">
              {[1,5,10,15,20,25,28].map(d => (
                <button key={d} onClick={() => setDueDay(String(d))}
                  className={clsx('py-2 text-sm font-semibold rounded-xl border-2 transition',
                    dueDay === String(d)
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-emerald-300')}>
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Boshqa kun:</span>
              <input type="number" min="1" max="28" value={dueDay}
                onChange={e => setDueDay(e.target.value)}
                className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:border-emerald-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Eslatma necha kun oldin?
            </label>
            <div className="flex gap-2">
              {['1','2','3','5','7'].map(d => (
                <button key={d} onClick={() => setRemindDays(d)}
                  className={clsx('flex-1 py-2 text-sm font-semibold rounded-xl border-2 transition',
                    remindDays === d
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300')}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {dueDay && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
              📅 Har oyning <strong>{dueDay}-kuni</strong> to'lov eslatmasi yuboriladi.
              To'lov sanasidan <strong>{remindDays} kun</strong> oldin ogohlantirish kelib turadi.
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 btn-secondary">Bekor</button>
          <button onClick={handleSave} disabled={loading || !dueDay}
            className="flex-1 btn-primary disabled:opacity-60">
            {loading ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentsPage;
