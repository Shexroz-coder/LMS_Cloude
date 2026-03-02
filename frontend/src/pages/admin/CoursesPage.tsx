import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Course {
  id: number;
  name: string;
  description?: string;
  monthlyPrice: number;
  durationMonths?: number;
  isActive: boolean;
  createdAt: string;
  _count?: { groups: number };
}

interface CourseForm {
  name: string;
  description: string;
  monthlyPrice: string;
  durationMonths: string;
  isActive: boolean;
}

const defaultForm: CourseForm = {
  name: '',
  description: '',
  monthlyPrice: '',
  durationMonths: '3',
  isActive: true,
};

const formatMoney = (v: number) =>
  new Intl.NumberFormat('uz-UZ').format(v) + " so'm";

// ─── Course Card ──────────────────────────────────────────────────────────────
function CourseCard({
  course,
  onEdit,
  onDelete,
}: {
  course: Course;
  onEdit: (c: Course) => void;
  onDelete: (c: Course) => void;
}) {
  return (
    <div className={clsx(
      "card border transition hover:shadow-md",
      course.isActive ? "border-transparent" : "border-gray-200 opacity-75"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-lg">
            🎓
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{course.name}</h3>
            <span className={clsx(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              course.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
            )}>
              {course.isActive ? "Faol" : "Nofaol"}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(course)}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
            title="Tahrirlash"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6.364-6.364a2 2 0 012.828 2.828L11.828 13.828A2 2 0 0110 14.414V17h2.586a2 2 0 001.414-.586l.828-.828" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(course)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            title="O'chirish"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Description */}
      {course.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{course.description}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
        <div className="text-center">
          <p className="text-xs text-gray-400">Oylik narx</p>
          <p className="text-sm font-bold text-indigo-600 mt-0.5">{formatMoney(course.monthlyPrice)}</p>
        </div>
        <div className="text-center border-x border-gray-100">
          <p className="text-xs text-gray-400">Davomiylik</p>
          <p className="text-sm font-bold text-gray-700 mt-0.5">
            {course.durationMonths ? `${course.durationMonths} oy` : '—'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400">Guruhlar</p>
          <p className="text-sm font-bold text-gray-700 mt-0.5">{course._count?.groups ?? 0}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Course Form Modal ────────────────────────────────────────────────────────
function CourseModal({
  course,
  onClose,
  onSave,
  loading,
}: {
  course: Course | null;
  onClose: () => void;
  onSave: (data: CourseForm) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<CourseForm>(
    course
      ? {
          name: course.name,
          description: course.description || '',
          monthlyPrice: String(course.monthlyPrice),
          durationMonths: String(course.durationMonths || 3),
          isActive: course.isActive,
        }
      : defaultForm
  );

  const set = (k: keyof CourseForm, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.monthlyPrice) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {course ? 'Kursni tahrirlash' : 'Yangi kurs'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Kurs nomi *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="input"
              placeholder="Masalan: Robotika, Arduino..."
              required
            />
          </div>

          <div>
            <label className="label">Tavsif</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="input resize-none"
              rows={3}
              placeholder="Kurs haqida qisqacha ma'lumot..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Oylik to'lov (so'm) *</label>
              <input
                type="number"
                value={form.monthlyPrice}
                onChange={e => set('monthlyPrice', e.target.value)}
                className="input"
                placeholder="500000"
                min="0"
                required
              />
            </div>
            <div>
              <label className="label">Davomiylik (oy)</label>
              <input
                type="number"
                value={form.durationMonths}
                onChange={e => set('durationMonths', e.target.value)}
                className="input"
                placeholder="3"
                min="1"
                max="36"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('isActive', !form.isActive)}
              className={clsx(
                "relative w-11 h-6 rounded-full transition",
                form.isActive ? "bg-indigo-600" : "bg-gray-300"
              )}
            >
              <div className={clsx(
                "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                form.isActive ? "left-6" : "left-1"
              )} />
            </button>
            <span className="text-sm text-gray-700">Kurs faol</span>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost">
              Bekor qilish
            </button>
            <button type="submit" disabled={loading} className="flex-1 btn-primary">
              {loading ? 'Saqlanmoqda...' : course ? 'Saqlash' : "Qo'shish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CoursesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Fetch courses
  const { data, isLoading } = useQuery<{ courses: Course[]; total: number }>(
    ['courses', search, showInactive],
    async () => {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (showInactive) params.set('includeInactive', 'true');
      const r = await api.get(`/courses?${params}`);
      return r.data?.data;
    }
  );

  const courses = data?.courses || (Array.isArray(data) ? data as unknown as Course[] : []);

  // Create mutation
  const createMutation = useMutation(
    (form: CourseForm) =>
      api.post('/courses', {
        name: form.name,
        description: form.description || undefined,
        monthlyPrice: parseFloat(form.monthlyPrice),
        durationMonths: parseInt(form.durationMonths) || undefined,
        isActive: form.isActive,
      }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['courses']);
        setShowModal(false);
      }
    }
  );

  // Update mutation
  const updateMutation = useMutation(
    (payload: { id: number; form: CourseForm }) =>
      api.put(`/courses/${payload.id}`, {
        name: payload.form.name,
        description: payload.form.description || undefined,
        monthlyPrice: parseFloat(payload.form.monthlyPrice),
        durationMonths: parseInt(payload.form.durationMonths) || undefined,
        isActive: payload.form.isActive,
      }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['courses']);
        setEditCourse(null);
      }
    }
  );

  // Delete mutation
  const deleteMutation = useMutation(
    (id: number) => api.delete(`/courses/${id}`),
    {
      onSuccess: () => {
        qc.invalidateQueries(['courses']);
        setDeleteTarget(null);
      }
    }
  );

  const handleSave = (form: CourseForm) => {
    if (editCourse) {
      updateMutation.mutate({ id: editCourse.id, form });
    } else {
      createMutation.mutate(form);
    }
  };

  const activeCourses = courses.filter(c => c.isActive);
  const totalGroups = courses.reduce((s, c) => s + (c._count?.groups ?? 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kurslar</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCourses.length} ta faol kurs · {totalGroups} ta guruh
          </p>
        </div>
        <button
          onClick={() => { setEditCourse(null); setShowModal(true); }}
          className="btn-primary"
        >
          + Yangi kurs
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Jami kurslar", value: courses.length, icon: "🎓", color: "bg-indigo-50 text-indigo-700" },
          { label: "Faol kurslar", value: activeCourses.length, icon: "✅", color: "bg-emerald-50 text-emerald-700" },
          { label: "Jami guruhlar", value: totalGroups, icon: "👥", color: "bg-violet-50 text-violet-700" },
          { label: "O'rtacha narx", value: activeCourses.length ? formatMoney(Math.round(activeCourses.reduce((s, c) => s + c.monthlyPrice, 0) / activeCourses.length)) : '—', icon: "💰", color: "bg-amber-50 text-amber-700" },
        ].map(item => (
          <div key={item.label} className="card flex items-center gap-3">
            <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center text-xl", item.color)}>
              {item.icon}
            </div>
            <div>
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className="font-bold text-gray-800">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9"
            placeholder="Kurs nomi bo'yicha qidirish..."
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Nofaollarni ham ko'rsatish
        </label>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="card text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Yuklanmoqda...</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && courses.length === 0 && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🎓</div>
          <h2 className="text-lg font-semibold text-gray-700">Kurslar topilmadi</h2>
          <p className="text-gray-400 text-sm mt-1 mb-4">Birinchi kursni qo'shing</p>
          <button
            onClick={() => { setEditCourse(null); setShowModal(true); }}
            className="btn-primary mx-auto"
          >
            + Yangi kurs
          </button>
        </div>
      )}

      {/* Course Cards Grid */}
      {!isLoading && courses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              onEdit={c => { setEditCourse(c); setShowModal(true); }}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Course Modal */}
      {showModal && (
        <CourseModal
          course={editCourse}
          onClose={() => { setShowModal(false); setEditCourse(null); }}
          onSave={handleSave}
          loading={createMutation.isLoading || updateMutation.isLoading}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center mb-4">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-gray-900">Kursni o'chirish</h3>
              <p className="text-gray-500 text-sm mt-2">
                <strong>{deleteTarget.name}</strong> kursini o'chirmoqchimisiz?
                {(deleteTarget._count?.groups ?? 0) > 0 && (
                  <span className="text-red-500 block mt-1">
                    ⚠️ Bu kursda {deleteTarget._count?.groups} ta guruh mavjud!
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 btn-ghost">
                Bekor qilish
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-xl transition"
              >
                {deleteMutation.isLoading ? 'O\'chirilmoqda...' : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
