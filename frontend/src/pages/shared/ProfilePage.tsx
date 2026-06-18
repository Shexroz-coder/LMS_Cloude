import { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import clsx from 'clsx';
import { Wallet, TrendingUp, Banknote, Briefcase } from 'lucide-react';

const formatMoney = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";

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

  // Teacher salary query
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isTeacher = user?.role === 'TEACHER';

  const { data: salaryData } = useQuery(
    ['profile-salary', currentMonth],
    async () => {
      const r = await api.get(`/salaries/teacher/me/calculate?month=${currentMonth}`);
      return r.data?.data;
    },
    { enabled: isTeacher, refetchInterval: 300000, retry: 1 }
  );

  const initial = (profile?.fullName || user?.fullName || '?').charAt(0).toUpperCase();

  return (
    <div className="space-y-5 animate-fade-in max-w-lg mx-auto dark:bg-gray-900 dark:text-gray-100">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Profil</h1>

      {msg && (
        <div className={clsx("p-3 rounded-xl text-sm font-medium", msg.includes('✅') ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400")}>
          {msg}
        </div>
      )}

      {/* Avatar */}
      <div className="card dark:bg-gray-800 dark:border-gray-700 flex flex-col items-center py-8">
        <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold mb-3 shadow-lg">
          {initial}
        </div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{profile?.fullName || user?.fullName}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{profile?.phone || user?.phone}</p>
        <span className="mt-2 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1 rounded-full font-medium">
          {ROLE_LABELS[profile?.role || user?.role || ''] || profile?.role}
        </span>
      </div>

      {/* Teacher salary section */}
      {isTeacher && salaryData && (
        <div className="card dark:bg-gray-800 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Wallet size={18} className="text-indigo-600" />
            Ish haqi ma'lumotlari
            <span className="text-xs text-gray-400 font-normal ml-auto">
              {now.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })}
            </span>
          </h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3 text-center">
              <Briefcase size={16} className="text-blue-500 mx-auto mb-1" />
              <div className="text-xs text-blue-600 dark:text-blue-400 mb-0.5">Ish haqi turi</div>
              <div className="text-sm font-bold text-blue-800 dark:text-blue-300">
                {salaryData.salaryType === 'PERCENTAGE_FROM_PAYMENT'
                  ? 'Foiz'
                  : salaryData.salaryType === 'FIXED_PER_STUDENT'
                  ? "O'quvchidan"
                  : 'Soatlik'}
              </div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-3 text-center">
              <TrendingUp size={16} className="text-emerald-500 mx-auto mb-1" />
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-0.5">Umumiy tushum</div>
              <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                {formatMoney(salaryData.totalRevenue || 0)}
              </div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-xl p-3 text-center col-span-2">
              <Banknote size={16} className="text-indigo-500 mx-auto mb-1" />
              <div className="text-xs text-indigo-600 dark:text-indigo-400 mb-0.5">Hisoblab chiqqan ish haqi</div>
              <div className="text-lg font-bold text-indigo-800 dark:text-indigo-300">
                {formatMoney(salaryData.calculatedSalary || 0)}
              </div>
            </div>
          </div>

          {/* Per-group breakdown */}
          {salaryData.groups?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Guruhlar bo'yicha</div>
              <div className="space-y-2">
                {salaryData.groups.map((g: any) => (
                  <div key={g.groupId} className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{g.groupName}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{g.courseName}</div>
                    </div>
                    <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {formatMoney(g.salary || 0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email ogohlantirish banneri */}
      {profile && !profile.email && !editMode && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3">
          <span className="text-amber-500 text-xl flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Email manzil kiritilmagan</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Xavfsizligingiz uchun email manzilingizni kiriting (parol tiklash uchun kerak)</p>
          </div>
          <button
            onClick={() => setEditMode(true)}
            className="flex-shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-800/40 hover:bg-amber-200 dark:hover:bg-amber-700/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            Kiriting →
          </button>
        </div>
      )}

      {/* Profile info */}
      <div className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Ma'lumotlar</h3>
          <button onClick={() => setEditMode(p => !p)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium">
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
              <div key={item.label} className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                <span className="text-sm text-gray-400 dark:text-gray-500">{item.label}</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-3">
            <div>
              <label className="label dark:text-gray-300">To'liq ism</label>
              <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} className="input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" required />
            </div>
            <div>
              <label className="label dark:text-gray-300">Telefon</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            </div>
            <div>
              <label className="label dark:text-gray-300">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" placeholder="ixtiyoriy@email.com" />
            </div>
            <button type="submit" disabled={updateMutation.isLoading} className="w-full btn-primary">
              {updateMutation.isLoading ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </form>
        )}
      </div>

      {/* Change password */}
      <div className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Parolni o'zgartirish</h3>
          <button onClick={() => setPwMode(p => !p)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium">
            {pwMode ? 'Bekor qilish' : '🔑 O\'zgartirish'}
          </button>
        </div>

        {pwMode && (
          <form onSubmit={handlePwChange} className="space-y-3">
            <div>
              <label className="label dark:text-gray-300">Joriy parol</label>
              <input type="password" value={pwForm.currentPassword} onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))} className="input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" required />
            </div>
            <div>
              <label className="label dark:text-gray-300">Yangi parol</label>
              <input type="password" value={pwForm.newPassword} onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))} className="input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" required minLength={6} />
            </div>
            <div>
              <label className="label dark:text-gray-300">Yangi parolni tasdiqlang</label>
              <input type="password" value={pwForm.confirmPassword} onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))} className="input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" required />
            </div>
            <button type="submit" disabled={pwMutation.isLoading} className="w-full btn-primary">
              {pwMutation.isLoading ? 'O\'zgartirilmoqda...' : 'Parolni o\'zgartirish'}
            </button>
          </form>
        )}

        {!pwMode && (
          <p className="text-sm text-gray-400 dark:text-gray-500">Xavfsizlik uchun parolni muntazam o'zgartirish tavsiya etiladi.</p>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
