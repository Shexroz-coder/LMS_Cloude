import { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import clsx from 'clsx';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '👑 Admin', TEACHER: '👨‍🏫 Ustoz', STUDENT: '🎓 O\'quvchi', PARENT: '👨‍👩‍👧 Ota-ona',
};

const ProfilePage = () => {
  const { user } = useAuthStore();
  const [editMode, setEditMode] = useState(false);
  const [pwMode, setPwMode] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [msg, setMsg] = useState('');

  const { data: profile, refetch } = useQuery('my-profile-page', async () => {
    const r = await api.get('/auth/me');
    const data = r.data?.data;
    setForm({ fullName: data?.fullName || '', phone: data?.phone || '', email: data?.email || '' });
    return data;
  });

  const updateMutation = useMutation(
    (data: typeof form) => api.put('/auth/profile', data),
    {
      onSuccess: () => {
        setMsg('Profil yangilandi! ✅');
        setEditMode(false);
        refetch();
        setTimeout(() => setMsg(''), 3000);
      },
      onError: () => setMsg('Xato yuz berdi ❌'),
    }
  );

  const pwMutation = useMutation(
    (data: { currentPassword: string; newPassword: string }) => api.put('/auth/change-password', data),
    {
      onSuccess: () => {
        setMsg('Parol o\'zgartirildi! ✅');
        setPwMode(false);
        setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setMsg(''), 3000);
      },
      onError: () => setMsg('Joriy parol noto\'g\'ri ❌'),
    }
  );

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  const handlePwChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) { setMsg('Parollar mos kelmaydi ❌'); return; }
    if (pwForm.newPassword.length < 6) { setMsg('Parol kamida 6 ta belgi ❌'); return; }
    pwMutation.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
  };

  const initial = (profile?.fullName || user?.fullName || '?').charAt(0).toUpperCase();

  return (
    <div className="space-y-5 animate-fade-in max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Profil</h1>

      {msg && (
        <div className={clsx("p-3 rounded-xl text-sm font-medium", msg.includes('✅') ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
          {msg}
        </div>
      )}

      {/* Avatar */}
      <div className="card flex flex-col items-center py-8">
        <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold mb-3 shadow-lg">
          {initial}
        </div>
        <h2 className="text-lg font-bold text-gray-800">{profile?.fullName || user?.fullName}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{profile?.phone || user?.phone}</p>
        <span className="mt-2 text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-medium">
          {ROLE_LABELS[profile?.role || user?.role || ''] || profile?.role}
        </span>
      </div>

      {/* Profile info */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Ma'lumotlar</h3>
          <button onClick={() => setEditMode(p => !p)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            {editMode ? 'Bekor qilish' : '✏️ Tahrirlash'}
          </button>
        </div>

        {!editMode ? (
          <div className="space-y-3">
            {[
              { label: 'To\'liq ism', value: profile?.fullName },
              { label: 'Telefon', value: profile?.phone },
              { label: 'Email', value: profile?.email || '—' },
              { label: 'Rol', value: ROLE_LABELS[profile?.role || ''] || profile?.role },
              { label: 'Ro\'yxatdan o\'tgan', value: profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('uz-UZ') : '—' },
            ].map(item => (
              <div key={item.label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-400">{item.label}</span>
                <span className="text-sm font-medium text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-3">
            <div>
              <label className="label">To'liq ism</label>
              <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} className="input" required />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input" placeholder="ixtiyoriy@email.com" />
            </div>
            <button type="submit" disabled={updateMutation.isLoading} className="w-full btn-primary">
              {updateMutation.isLoading ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </form>
        )}
      </div>

      {/* Change password */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Parolni o'zgartirish</h3>
          <button onClick={() => setPwMode(p => !p)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            {pwMode ? 'Bekor qilish' : '🔑 O\'zgartirish'}
          </button>
        </div>

        {pwMode && (
          <form onSubmit={handlePwChange} className="space-y-3">
            <div>
              <label className="label">Joriy parol</label>
              <input type="password" value={pwForm.currentPassword} onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))} className="input" required />
            </div>
            <div>
              <label className="label">Yangi parol</label>
              <input type="password" value={pwForm.newPassword} onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))} className="input" required minLength={6} />
            </div>
            <div>
              <label className="label">Yangi parolni tasdiqlang</label>
              <input type="password" value={pwForm.confirmPassword} onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))} className="input" required />
            </div>
            <button type="submit" disabled={pwMutation.isLoading} className="w-full btn-primary">
              {pwMutation.isLoading ? 'O\'zgartirilmoqda...' : 'Parolni o\'zgartirish'}
            </button>
          </form>
        )}

        {!pwMode && (
          <p className="text-sm text-gray-400">Xavfsizlik uchun parolni muntazam o'zgartirish tavsiya etiladi.</p>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
