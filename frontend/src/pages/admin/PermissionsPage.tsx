/**
 * Ruxsatlar boshqaruvi
 *
 * Admin har rol (Ustoz, O'quvchi, Ota-ona, Ta'sischi) uchun tizim
 * funksiyalarini yoqib/o'chirib qo'yadi. ADMIN har doim to'liq huquqli.
 * Founder yaratish tugmasi ham shu yerda.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ShieldCheck, UserPlus, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '../../api/axios';

const ROLE_LABELS: Record<string, string> = {
  TEACHER: "👨‍🏫 Ustoz",
  STUDENT: "🎓 O'quvchi",
  PARENT: "👨‍👩‍👧 Ota-ona",
  FOUNDER: "💼 Ta'sischi",
};

interface PermCell { allowed: boolean; isDefault: boolean; configurable: boolean }
interface PermRow { key: string; label: string; group: string; roles: Record<string, PermCell> }

export default function PermissionsPage() {
  const qc = useQueryClient();
  const [founderOpen, setFounderOpen] = useState(false);

  const { data, isLoading } = useQuery(
    ['permissions-matrix'],
    () => api.get('/permissions').then(r => r.data?.data),
  );

  const matrix: PermRow[] = data?.matrix ?? [];
  const roles: string[] = data?.roles ?? ['TEACHER', 'STUDENT', 'PARENT', 'FOUNDER'];

  const setPerm = useMutation(
    (v: { role: string; permKey: string; allowed: boolean }) => api.put('/permissions', v),
    {
      onSuccess: () => { qc.invalidateQueries(['permissions-matrix']); },
      onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); },
    }
  );

  // Guruh bo'yicha jamlash
  const groups = matrix.reduce<Record<string, PermRow[]>>((acc, row) => {
    (acc[row.group] ||= []).push(row);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" /> Ruxsatlar
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">Rollar uchun funksiyalarni yoqing yoki o'chiring</p>
        </div>
        <button
          onClick={() => setFounderOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold"
        >
          <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Ta'sischi qo'shish</span>
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-zinc-400">Yuklanmoqda...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([group, rows]) => (
            <div key={group} className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 bg-zinc-50 dark:bg-gray-700/40 border-b border-zinc-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{group}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-400 border-b border-zinc-100 dark:border-gray-700">
                      <th className="text-left font-medium px-4 py-2 min-w-[200px]">Funksiya</th>
                      {roles.map(r => (
                        <th key={r} className="text-center font-medium px-2 py-2 whitespace-nowrap">{ROLE_LABELS[r] || r}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-gray-700/50">
                    {rows.map(row => (
                      <tr key={row.key}>
                        <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{row.label}</td>
                        {roles.map(role => {
                          const cell = row.roles[role];
                          return (
                            <td key={role} className="text-center px-2 py-2.5">
                              <PermToggle
                                allowed={cell?.allowed ?? false}
                                onToggle={() => setPerm.mutate({ role, permKey: row.key, allowed: !(cell?.allowed) })}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {founderOpen && <FounderModal onClose={() => setFounderOpen(false)} />}
    </div>
  );
}

function PermToggle({ allowed, onToggle }: { allowed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={clsx(
        'w-9 h-5 rounded-full transition-colors relative inline-block',
        allowed ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-gray-600'
      )}
    >
      <span className={clsx('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform', allowed ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  );
}

function FounderModal({ onClose }: { onClose: () => void }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation(
    () => api.post('/permissions/founder', { fullName, phone, password }),
    {
      onSuccess: (r) => { toast.success(r.data?.message || 'Ta\'sischi yaratildi!'); onClose(); },
      onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); },
    }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Ta'sischi (Founder) qo'shish</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-zinc-500" /></button>
        </div>

        <p className="text-xs text-zinc-500 mb-4">
          Ta'sischi faqat asosiy ko'rsatkichlar (moliya, to'lovlar, o'quvchilar soni, davomat) ni ko'radi — tahrirlash huquqisiz.
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">To'liq ism *</span>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Telefon *</span>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998..."
              className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Parol *</span>
            <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="kamida 6 belgi"
              className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-200 dark:border-gray-600 rounded-xl text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-gray-700 font-medium">Bekor</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isLoading || !fullName || !phone || password.length < 6}
            className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> {mutation.isLoading ? 'Yaratilmoqda...' : 'Yaratish'}
          </button>
        </div>
      </div>
    </div>
  );
}
