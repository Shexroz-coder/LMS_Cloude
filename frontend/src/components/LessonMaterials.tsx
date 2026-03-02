import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Plus, Trash2, ExternalLink, FileText, Video, Image, File, Link } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '../api/axios';

interface Material {
  id: number;
  type: 'PDF' | 'VIDEO' | 'IMAGE' | 'FILE' | 'LINK';
  title: string;
  url: string;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  PDF: { icon: FileText, color: 'text-red-500 bg-red-50', label: 'PDF' },
  VIDEO: { icon: Video, color: 'text-purple-500 bg-purple-50', label: 'Video' },
  IMAGE: { icon: Image, color: 'text-green-500 bg-green-50', label: 'Rasm' },
  FILE: { icon: File, color: 'text-blue-500 bg-blue-50', label: 'Fayl' },
  LINK: { icon: Link, color: 'text-indigo-500 bg-indigo-50', label: 'Havola' },
};

const isTeacher = (role?: string) => role === 'TEACHER' || role === 'ADMIN';

export default function LessonMaterials({ lessonId, userRole }: { lessonId: number; userRole?: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'LINK', title: '', url: '' });

  const { data: materials = [] } = useQuery<Material[]>(
    ['lesson-materials', lessonId],
    () => api.get(`/lessons/${lessonId}/materials`).then(r => r.data?.data || [])
  );

  const addMutation = useMutation(
    (data: typeof form) => api.post(`/lessons/${lessonId}/materials`, data),
    {
      onSuccess: () => {
        qc.invalidateQueries(['lesson-materials', lessonId]);
        setForm({ type: 'LINK', title: '', url: '' });
        setShowForm(false);
        toast.success('Material qo\'shildi!');
      },
      onError: () => toast.error('Xato yuz berdi')
    }
  );

  const deleteMutation = useMutation(
    (id: number) => api.delete(`/lessons/${lessonId}/materials/${id}`),
    {
      onSuccess: () => {
        qc.invalidateQueries(['lesson-materials', lessonId]);
        toast.success('Material o\'chirildi');
      }
    }
  );

  const getYoutubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&\n?#]+)/);
    return match?.[1];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.url) { toast.error("Sarlavha va havola kiritilishi shart"); return; }
    addMutation.mutate(form);
  };

  return (
    <div className="space-y-3">
      {/* Materials list */}
      {materials.length === 0 && !showForm ? (
        <p className="text-sm text-gray-400 text-center py-3">Materiallar yo'q</p>
      ) : (
        <div className="space-y-2">
          {materials.map(m => {
            const cfg = TYPE_CONFIG[m.type] || TYPE_CONFIG.LINK;
            const ytId = m.type === 'VIDEO' ? getYoutubeId(m.url) : null;
            return (
              <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition group">
                {ytId ? (
                  <img src={`https://img.youtube.com/vi/${ytId}/default.jpg`} alt={m.title}
                    className="w-10 h-7 object-cover rounded flex-shrink-0" />
                ) : (
                  <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", cfg.color)}>
                    <cfg.icon className="w-4 h-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.title}</p>
                  <p className="text-xs text-gray-400">{cfg.label}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <a href={m.url} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 hover:bg-white rounded-lg text-indigo-500">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {isTeacher(userRole) && (
                    <button onClick={() => deleteMutation.mutate(m.id)}
                      className="p-1.5 hover:bg-white rounded-lg text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {isTeacher(userRole) && (
        <>
          {showForm ? (
            <form onSubmit={handleSubmit} className="border border-dashed border-gray-300 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="input text-sm">
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="input text-sm" placeholder="Sarlavha" required />
              </div>
              <input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                className="input text-sm" placeholder="https://..." required />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 text-sm py-1.5 px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">Bekor</button>
                <button type="submit" disabled={addMutation.isLoading}
                  className="flex-1 text-sm py-1.5 px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                  {addMutation.isLoading ? '...' : "Qo'shish"}
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 text-sm text-indigo-600 py-2 border border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50 transition">
              <Plus className="w-4 h-4" /> Material qo'shish
            </button>
          )}
        </>
      )}
    </div>
  );
}
