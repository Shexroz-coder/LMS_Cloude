/**
 * Arxivlash sahifasi
 *
 * Admin davrni tanlab butun moliyaviy ma'lumotni arxivlaydi.
 * Arxivlangandan keyin barcha balans/qarzlar 0 dan boshlanadi.
 * Eski davrlar ro'yxatdan ko'riladi.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Archive, Plus, X, Eye, AlertTriangle, TrendingUp, TrendingDown, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v || 0));
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('uz-UZ');

interface ArchiveRow {
  id: number;
  name: string;
  periodStart: string;
  periodEnd: string;
  summary: {
    totalIncome: number; totalExpenses: number; totalFees: number;
    teacherSalaries: number; staffSalaries: number;
    paymentsCount: number; expensesCount: number;
    balancesAtClose: number; debtsAtClose: number;
  } | null;
  createdAt: string;
}

export default function ArchivesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data: archives = [], isLoading } = useQuery<ArchiveRow[]>(
    ['archives'],
    () => api.get('/archives').then(r => r.data?.data ?? []),
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Archive className="w-5 h-5 text-amber-500" /> Arxiv
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">Davrlarni arxivlash va eski hisobotlarni ko'rish</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Davrni arxivlash</span>
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-zinc-400">Yuklanmoqda...</div>
      ) : archives.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Hali arxiv yo'q.</p>
          <p className="text-sm mt-1">Davrni arxivlab, yangi hisobni 0 dan boshlang.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {archives.map(a => (
            <div key={a.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{a.name}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {fmtDate(a.periodStart)} — {fmtDate(a.periodEnd)}
                  </p>
                </div>
                <button
                  onClick={() => setDetailId(a.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-gray-700 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-medium flex-shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" /> Ko'rish
                </button>
              </div>
              {a.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-emerald-600 text-xs"><TrendingUp className="w-3 h-3" /> Tushum</div>
                    <div className="font-bold text-emerald-700 dark:text-emerald-400 text-sm mt-1">{fmt(a.summary.totalIncome)}</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-red-600 text-xs"><TrendingDown className="w-3 h-3" /> Xarajat</div>
                    <div className="font-bold text-red-700 dark:text-red-400 text-sm mt-1">{fmt(a.summary.totalExpenses)}</div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-gray-700/40 rounded-lg p-3">
                    <div className="text-zinc-500 text-xs">To'lovlar</div>
                    <div className="font-bold text-zinc-700 dark:text-zinc-200 text-sm mt-1">{a.summary.paymentsCount} ta</div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-gray-700/40 rounded-lg p-3">
                    <div className="text-zinc-500 text-xs">Yopilishdagi qarz</div>
                    <div className="font-bold text-zinc-700 dark:text-zinc-200 text-sm mt-1">{fmt(a.summary.debtsAtClose)}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {createOpen && <CreateArchiveModal onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); qc.invalidateQueries(['archives']); }} />}
      {detailId && <ArchiveDetailModal id={detailId} onClose={() => setDetailId(null)} onRestored={() => { setDetailId(null); qc.invalidateQueries(['archives']); }} />}
    </div>
  );
}

function CreateArchiveModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [confirm, setConfirm] = useState(false);

  const mutation = useMutation(
    () => api.post('/archives', { name, periodStart, periodEnd }),
    {
      onSuccess: (r) => { toast.success(r.data?.message || 'Arxivlandi!'); onDone(); },
      onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); },
    }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Davrni arxivlash</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-zinc-500" /></button>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4 flex gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Arxivlangandan so'ng bu davrdagi to'lov va xarajatlar aktiv hisobdan chiqadi va
            <b> barcha o'quvchi balans/qarzlari 0 ga tushadi</b>. Yangi hisob 0 dan boshlanadi.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Arxiv nomi</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Masalan: 2025 o'quv yili"
              className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Boshlanish</span>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Tugash</span>
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                className="w-full border border-zinc-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </label>
          </div>
          <label className="flex items-start gap-2 cursor-pointer mt-2">
            <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="mt-0.5" />
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              Tushunaman — balanslar 0 ga tushishini va bu amalni ehtiyotkorlik bilan qilayotganimni tasdiqlayman.
            </span>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-200 dark:border-gray-600 rounded-xl text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-gray-700 font-medium">Bekor</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isLoading || !periodStart || !periodEnd || !confirm}
            className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
            {mutation.isLoading ? 'Arxivlanmoqda...' : 'Arxivlash'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ArchiveDetailModal({ id, onClose, onRestored }: { id: number; onClose: () => void; onRestored: () => void }) {
  const { data, isLoading } = useQuery(
    ['archive', id],
    () => api.get(`/archives/${id}`).then(r => r.data?.data),
  );

  const restore = useMutation(
    () => api.delete(`/archives/${id}`),
    {
      onSuccess: (r) => { toast.success(r.data?.message || 'Bekor qilindi'); onRestored(); },
      onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); },
    }
  );

  const archive = data?.archive;
  const payments = data?.payments ?? [];
  const expenses = data?.expenses ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 truncate">{archive?.name || 'Arxiv'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-zinc-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="text-center py-10 text-zinc-400">Yuklanmoqda...</div>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">To'lovlar ({payments.length})</h3>
              <div className="space-y-1.5 mb-5">
                {payments.slice(0, 100).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-sm bg-zinc-50 dark:bg-gray-700/40 rounded-lg px-3 py-2">
                    <span className="text-zinc-700 dark:text-zinc-300 truncate">{p.studentName}</span>
                    <span className="font-medium text-emerald-600">{fmt(p.amount)} so'm</span>
                  </div>
                ))}
                {payments.length === 0 && <p className="text-sm text-zinc-400">To'lovlar yo'q</p>}
              </div>

              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Xarajatlar ({expenses.length})</h3>
              <div className="space-y-1.5">
                {expenses.slice(0, 100).map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between text-sm bg-zinc-50 dark:bg-gray-700/40 rounded-lg px-3 py-2">
                    <span className="text-zinc-700 dark:text-zinc-300 truncate">{e.description || e.category}</span>
                    <span className="font-medium text-red-600">{fmt(e.amount)} so'm</span>
                  </div>
                ))}
                {expenses.length === 0 && <p className="text-sm text-zinc-400">Xarajatlar yo'q</p>}
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-zinc-100 dark:border-gray-700">
          <button
            onClick={() => { if (confirm('Arxivni bekor qilib, yozuvlarni aktiv hisobga qaytarasizmi?')) restore.mutate(); }}
            disabled={restore.isLoading}
            className="flex items-center justify-center gap-2 w-full py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" /> {restore.isLoading ? 'Bekor qilinmoqda...' : 'Arxivni bekor qilish'}
          </button>
        </div>
      </div>
    </div>
  );
}
