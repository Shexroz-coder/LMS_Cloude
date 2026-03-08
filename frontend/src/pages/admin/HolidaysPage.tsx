import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import {
  Calendar, Plus, Edit3, Trash2, X, CalendarOff, RefreshCw, Repeat, Sun, Umbrella
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import api from '../../api/axios';
import { clsx } from 'clsx';

interface Holiday {
  id: number;
  name: string;
  date: string;
  endDate?: string | null;
  isRecurring: boolean;
  type: string;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  HOLIDAY: 'Bayram',
  VACATION: 'Dam olish',
  CUSTOM: 'Boshqa',
};

const typeColors: Record<string, string> = {
  HOLIDAY: 'text-red-600 bg-red-50 border-red-200',
  VACATION: 'text-blue-600 bg-blue-50 border-blue-200',
  CUSTOM: 'text-gray-600 bg-gray-50 border-gray-200',
};

const typeIcons: Record<string, React.ElementType> = {
  HOLIDAY: Sun,
  VACATION: Umbrella,
  CUSTOM: Calendar,
};

const HolidaysPage = () => {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Holiday | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formType, setFormType] = useState('HOLIDAY');
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: holidays = [], isLoading } = useQuery<Holiday[]>(
    ['holidays', year],
    async () => {
      const res = await api.get(`/holidays?year=${year}`);
      return res.data.data;
    }
  );

  const openAdd = () => {
    setEditingHoliday(null);
    setFormName('');
    setFormDate('');
    setFormEndDate('');
    setFormType('HOLIDAY');
    setFormIsRecurring(false);
    setShowModal(true);
  };

  const openEdit = (h: Holiday) => {
    setEditingHoliday(h);
    setFormName(h.name);
    setFormDate(h.date.slice(0, 10));
    setFormEndDate(h.endDate ? h.endDate.slice(0, 10) : '');
    setFormType(h.type);
    setFormIsRecurring(h.isRecurring);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formDate) {
      toast.error('Nom va sana kiritilishi shart');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        date: formDate,
        endDate: formEndDate || null,
        type: formType,
        isRecurring: formIsRecurring,
      };

      if (editingHoliday) {
        await api.put(`/holidays/${editingHoliday.id}`, payload);
        toast.success('Bayram yangilandi!');
      } else {
        await api.post('/holidays', payload);
        toast.success('Bayram qo\'shildi!');
      }
      qc.invalidateQueries(['holidays']);
      setShowModal(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xatolik yuz berdi';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/holidays/${deleteConfirm.id}`);
      toast.success('Bayram o\'chirildi!');
      qc.invalidateQueries(['holidays']);
      setDeleteConfirm(null);
    } catch {
      toast.error('O\'chirishda xato');
    }
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d), 'dd.MM.yyyy'); } catch { return d; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarOff className="text-red-500" size={28} />
            Bayramlar va dam olish kunlari
          </h1>
          <p className="text-gray-500 text-sm mt-1">Dam olish kunlarida darslar avtomatik disable bo'ladi</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-1 bg-white rounded-lg border px-2 py-1.5">
            <button onClick={() => setYear(y => y - 1)} className="p-1 hover:bg-gray-100 rounded">
              <Calendar size={14} />
            </button>
            <span className="text-sm font-semibold px-2">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1 hover:bg-gray-100 rounded">
              <Calendar size={14} />
            </button>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm"
          >
            <Plus size={16} />
            Bayram qo'shish
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <Sun size={20} className="text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{holidays.filter(h => h.type === 'HOLIDAY').length}</div>
              <div className="text-gray-500 text-xs">Bayramlar</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Umbrella size={20} className="text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{holidays.filter(h => h.type === 'VACATION').length}</div>
              <div className="text-gray-500 text-xs">Dam olish kunlari</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Repeat size={20} className="text-purple-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{holidays.filter(h => h.isRecurring).length}</div>
              <div className="text-gray-500 text-xs">Har yili takrorlanuvchi</div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Yuklanmoqda...
          </div>
        ) : holidays.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CalendarOff size={48} className="mx-auto mb-3 opacity-50" />
            <p className="font-medium">Bayramlar topilmadi</p>
            <p className="text-sm">Yangi bayram yoki dam olish kuni qo'shing</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3">Nomi</th>
                <th className="px-5 py-3">Turi</th>
                <th className="px-5 py-3">Boshlanishi</th>
                <th className="px-5 py-3">Tugashi</th>
                <th className="px-5 py-3">Takrorlanuvchi</th>
                <th className="px-5 py-3 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {holidays.map(h => {
                const TypeIcon = typeIcons[h.type] || Calendar;
                return (
                  <tr key={h.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <TypeIcon size={16} className={clsx(h.type === 'HOLIDAY' ? 'text-red-500' : h.type === 'VACATION' ? 'text-blue-500' : 'text-gray-500')} />
                        <span className="font-medium text-gray-900">{h.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={clsx('text-xs font-medium px-2 py-1 rounded-full border', typeColors[h.type] || typeColors.CUSTOM)}>
                        {typeLabels[h.type] || h.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{formatDate(h.date)}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{h.endDate ? formatDate(h.endDate) : '—'}</td>
                    <td className="px-5 py-3.5">
                      {h.isRecurring ? (
                        <span className="flex items-center gap-1 text-purple-600 text-xs font-medium">
                          <Repeat size={13} /> Har yili
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Yo'q</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(h)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"
                          title="Tahrirlash"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(h)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                          title="O'chirish"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {editingHoliday ? 'Bayramni tahrirlash' : 'Yangi bayram qo\'shish'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomi</label>
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Masalan: Navro'z bayrami"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Turi</label>
                <div className="flex gap-2">
                  {(['HOLIDAY', 'VACATION', 'CUSTOM'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setFormType(t)}
                      className={clsx(
                        'flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition',
                        formType === t
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      {typeLabels[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Boshlanish sanasi</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tugash sanasi <span className="text-gray-400">(ixtiyoriy)</span></label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={e => setFormEndDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  />
                </div>
              </div>

              {/* isRecurring */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formIsRecurring}
                    onChange={e => setFormIsRecurring(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={clsx(
                    'w-10 h-5 rounded-full transition',
                    formIsRecurring ? 'bg-purple-600' : 'bg-gray-200'
                  )} />
                  <div className={clsx(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    formIsRecurring ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Har yili takrorlansin</span>
                  <p className="text-xs text-gray-400">Bayram har yil avtomatik takrorlanadi</p>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
              >
                {saving ? 'Saqlanmoqda...' : editingHoliday ? 'Yangilash' : 'Qo\'shish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Bayramni o'chirish</h3>
            <p className="text-sm text-gray-500 mb-5">
              <strong>"{deleteConfirm.name}"</strong> ni o'chirishni tasdiqlaysizmi?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
              >
                O'chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HolidaysPage;
