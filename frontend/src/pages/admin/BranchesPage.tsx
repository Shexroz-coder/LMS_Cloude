/**
 * Filiallar boshqaruvi — CRUD + statistika.
 * Mobil-moslashuvchan karta ko'rinishida.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Building2, Plus, Edit3, X, MapPin, Phone, Users, BookOpen, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '../../api/axios';
import { Branch } from '../../types';

export default function BranchesPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; branch?: Branch } | null>(null);

  const { data: branches = [], isLoading } = useQuery<Branch[]>(
    ['branches'],
    () => api.get('/branches').then(r => r.data?.data ?? []),
  );

  const onSaved = () => {
    qc.invalidateQueries(['branches']);
    setModal(null);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" /> Filiallar
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">O'quv markazi filiallari va ularning statistikasi</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Yangi filial</span>
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-zinc-400">Yuklanmoqda...</div>
      ) : branches.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">Filiallar yo'q. Birinchisini qo'shing.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(b => (
            <div key={b.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  b.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-zinc-100 text-zinc-400'
                )}>
                  <Building2 className="w-5 h-5" />
                </div>
                <button
                  onClick={() => setModal({ mode: 'edit', branch: b })}
                  className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{b.name}</h3>
              {!b.isActive && <span className="text-xs text-red-500">Nofaol</span>}
              {b.address && (
                <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {b.address}
                </p>
              )}
              {b.phone && (
                <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {b.phone}
                </p>
              )}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-100 dark:border-gray-700">
                <span className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                  <Users className="w-4 h-4 text-emerald-500" /> {b.studentsCount ?? 0}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                  <BookOpen className="w-4 h-4 text-blue-500" /> {b.groupsCount ?? 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <BranchModal mode={modal.mode} branch={modal.branch} onClose={() => setModal(null)} onSaved={onSaved} />}
    </div>
  );
}

function BranchModal({ mode, branch, onClose, onSaved }: {
  mode: 'create' | 'edit'; branch?: Branch; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(branch?.name ?? '');
  const [address, setAddress] = useState(branch?.address ?? '');
  const [phone, setPhone] = useState(branch?.phone ?? '');
  const [isActive, setIsActive] = useState(branch?.isActive ?? true);

  const mutation = useMutation(
    () => mode === 'create'
      ? api.post('/branches', { name, address, phone })
      : api.put(`/branches/${branch!.id}`, { name, address, phone, isActive }),
    {
      onSuccess: () => { toast.success('Saqlandi!'); onSaved(); },
      onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); },
    }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
            {mode === 'create' ? 'Yangi filial' : 'Filialni tahrirlash'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Filial nomi *</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Masalan: Chilonzor filiali"
              className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Manzil</span>
            <input value={address ?? ''} onChange={e => setAddress(e.target.value)}
              className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Telefon</span>
            <input value={phone ?? ''} onChange={e => setPhone(e.target.value)}
              className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </label>
          {mode === 'edit' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() => setIsActive(v => !v)}
                className={clsx('w-10 h-6 rounded-full transition-colors relative', isActive ? 'bg-emerald-500' : 'bg-zinc-300')}
              >
                <span className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform', isActive ? 'translate-x-4' : 'translate-x-0.5')} />
              </button>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Faol filial</span>
            </label>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-200 dark:border-gray-600 rounded-xl text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-gray-700 font-medium">
            Bekor
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isLoading || !name.trim()}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> {mutation.isLoading ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}
