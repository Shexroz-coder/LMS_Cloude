/**
 * Inventar / Jihozlar — har filial bo'yicha.
 * Filial selektori (chapdan) tanlangan filial jihozlarini ko'rsatadi.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Package, Plus, Edit3, Trash2, X, Check, Boxes, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '../../api/axios';
import { useBranchStore } from '../../store/branch.store';

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v || 0));

const CATEGORIES: { value: string; label: string; icon: string }[] = [
  { value: 'ROBOTICS', label: 'Robototexnika', icon: '🤖' },
  { value: 'ELECTRONICS', label: 'Elektronika', icon: '🔌' },
  { value: 'COMPUTER', label: 'Kompyuter', icon: '💻' },
  { value: 'FURNITURE', label: 'Mebel', icon: '🪑' },
  { value: 'TOOL', label: 'Asbob', icon: '🛠️' },
  { value: 'OTHER', label: 'Boshqa', icon: '📦' },
];
const CONDITIONS: Record<string, { label: string; color: string }> = {
  NEW:    { label: 'Yangi', color: 'bg-emerald-100 text-emerald-700' },
  GOOD:   { label: 'Yaxshi', color: 'bg-blue-100 text-blue-700' },
  USED:   { label: 'Ishlatilgan', color: 'bg-amber-100 text-amber-700' },
  BROKEN: { label: 'Buzuq', color: 'bg-red-100 text-red-700' },
};
const catInfo = (v: string) => CATEGORIES.find(c => c.value === v) || CATEGORIES[5];

interface Asset {
  id: number; name: string; category: string; quantity: number;
  condition: string; unitValue: number; totalValue: number;
  note?: string; branchId: number; branchName?: string;
}

export default function InventoryPage() {
  const qc = useQueryClient();
  const selectedBranchId = useBranchStore(s => s.selectedBranchId);
  const [modal, setModal] = useState<{ asset?: Asset } | null>(null);
  const [catFilter, setCatFilter] = useState('');

  const { data, isLoading } = useQuery<{ assets: Asset[]; summary: any }>(
    ['assets', selectedBranchId, catFilter],
    () => api.get('/assets', { params: catFilter ? { category: catFilter } : {} }).then(r => r.data?.data ?? { assets: [], summary: {} }),
  );

  const assets = data?.assets ?? [];
  const summary = data?.summary ?? { totalItems: 0, totalValue: 0 };

  const del = useMutation((id: number) => api.delete(`/assets/${id}`), {
    onSuccess: () => { toast.success("Jihoz o'chirildi"); qc.invalidateQueries(['assets']); },
    onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); },
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500" /> Inventar / Jihozlar
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">Robototexnika, kompyuter, jihozlar — filial bo'yicha</p>
        </div>
        <button onClick={() => setModal({})}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Jihoz qo'shish</span>
        </button>
      </div>

      {/* Xulosa */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1"><Boxes className="w-4 h-4 text-indigo-500" /><span className="text-xs text-zinc-500">Jami dona</span></div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{summary.totalItems}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-emerald-500" /><span className="text-xs text-zinc-500">Umumiy qiymati</span></div>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{fmt(summary.totalValue)}</p>
          <p className="text-xs text-zinc-400">so'm</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1"><Package className="w-4 h-4 text-violet-500" /><span className="text-xs text-zinc-500">Turlari</span></div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{assets.length}</p>
        </div>
      </div>

      {/* Kategoriya filtri */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button onClick={() => setCatFilter('')}
          className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap', !catFilter ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border border-zinc-200 dark:border-gray-700 text-zinc-600')}>
          Hammasi
        </button>
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setCatFilter(c.value)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap', catFilter === c.value ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border border-zinc-200 dark:border-gray-700 text-zinc-600')}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Ro'yxat */}
      {isLoading ? (
        <div className="text-center py-20 text-zinc-400">Yuklanmoqda...</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Jihoz yo'q. Birinchisini qo'shing.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 divide-y divide-zinc-50 dark:divide-gray-700/50">
          {assets.map(a => {
            const cat = catInfo(a.category);
            const cond = CONDITIONS[a.condition] || CONDITIONS.GOOD;
            return (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl">{cat.icon}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-800 dark:text-zinc-100 truncate">{a.name}</div>
                    <div className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
                      <span>{cat.label}</span>
                      <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-semibold', cond.color)}>{cond.label}</span>
                      {a.branchName && <span className="text-zinc-300">· {a.branchName}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{a.quantity} dona</div>
                    {a.unitValue > 0 && <div className="text-xs text-zinc-400">{fmt(a.totalValue)} so'm</div>}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setModal({ asset: a })} className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => { if (confirm(`"${a.name}" ni o'chirasizmi?`)) del.mutate(a.id); }} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && <AssetModal asset={modal.asset} defaultBranchId={selectedBranchId} onClose={() => setModal(null)} onSaved={() => { setModal(null); qc.invalidateQueries(['assets']); }} />}
    </div>
  );
}

function AssetModal({ asset, defaultBranchId, onClose, onSaved }: {
  asset?: Asset; defaultBranchId: number | null; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!asset;
  const [form, setForm] = useState({
    name: asset?.name || '',
    category: asset?.category || 'ROBOTICS',
    quantity: asset?.quantity?.toString() || '1',
    condition: asset?.condition || 'GOOD',
    unitValue: asset?.unitValue?.toString() || '',
    note: asset?.note || '',
    branchId: (asset?.branchId ?? defaultBranchId ?? '').toString(),
  });
  const { data: branches = [] } = useQuery<any[]>(['branches'], () => api.get('/branches').then(r => r.data?.data ?? []));

  const mutation = useMutation(
    () => {
      const payload = { ...form, quantity: parseInt(form.quantity) || 1, unitValue: form.unitValue || undefined, branchId: form.branchId ? parseInt(form.branchId) : undefined };
      return isEdit ? api.put(`/assets/${asset!.id}`, payload) : api.post('/assets', payload);
    },
    { onSuccess: () => { toast.success('Saqlandi!'); onSaved(); }, onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); } }
  );

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{isEdit ? 'Jihozni tahrirlash' : 'Yangi jihoz'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-zinc-500" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Nomi *</span>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Masalan: Lego Mindstorms EV3"
              className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Filial *</span>
            <select value={form.branchId} onChange={e => set('branchId', e.target.value)}
              className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm">
              <option value="">— Filialni tanlang —</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Kategoriya</span>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Holati</span>
              <select value={form.condition} onChange={e => set('condition', e.target.value)}
                className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm">
                {Object.entries(CONDITIONS).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Soni</span>
              <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} min="1"
                className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Birlik narxi (so'm)</span>
              <input type="number" value={form.unitValue} onChange={e => set('unitValue', e.target.value)} placeholder="ixtiyoriy"
                className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Izoh</span>
            <input value={form.note} onChange={e => set('note', e.target.value)}
              className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-200 dark:border-gray-600 rounded-xl text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-gray-700 font-medium">Bekor</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isLoading || !form.name.trim() || !form.branchId}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> {mutation.isLoading ? '...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}
