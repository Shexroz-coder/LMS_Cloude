/**
 * AdminDebtorsPage — Qarzdorlar ro'yxati va eslatma yuborish
 *
 * Admin avval ro'yxatni ko'radi → tekshiradi → tanlaydi → Telegram eslatma yuboradi.
 * Eslatmalar avtomatik emas — admin tasdiqlaydi.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'react-query';
import { format } from 'date-fns';
import { uz } from 'date-fns/locale';
import {
  Send, AlertCircle, CheckSquare, Square, Search,
  RefreshCw, Bell, BellOff, Users, X, Edit3, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '../../api/axios';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DebtorEntry {
  studentId:      number;
  fullName:       string;
  phone:          string;
  hasTelegram:    boolean;
  parentName:     string | null;
  parentPhone:    string | null;
  parentTelegram: boolean;
  groupId:        number;
  groupName:      string;
  courseName:     string;
  joinedAt:       string;
  dueDay:         number;
  nextDueDate:    string;
  daysUntilDue:   number;
  monthlyAmount:  number;
  currentDebt:    number;
  currentBalance: number;
  isOverdue:      boolean;
  isDueSoon:      boolean;
}

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v));

// ─── Asosiy komponent ─────────────────────────────────────────────────────────
export default function AdminDebtorsPage() {
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [filter, setFilter]         = useState<'all' | 'debt' | 'soon'>('all');
  const [showConfirm, setShowConfirm] = useState(false);

  // Qarz tuzatish modali
  const [adjustModal, setAdjustModal] = useState<{
    studentId: number; fullName: string;
    currentDebt: number; currentBalance: number;
  } | null>(null);
  const [adjDebt,    setAdjDebt]    = useState('');
  const [adjBalance, setAdjBalance] = useState('');
  const [adjNote,    setAdjNote]    = useState('');

  // ── Ma'lumotlar ──────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery<DebtorEntry[]>(
    'debtors-review',
    () => api.get('/payments/debtors-review').then(r => r.data?.data ?? []),
    { staleTime: 30_000 },
  );
  const all: DebtorEntry[] = data ?? [];

  // ── Filtrlash ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = all;
    if (filter === 'debt') list = list.filter(s => s.currentDebt > 0);
    if (filter === 'soon') list = list.filter(s => s.isDueSoon || s.isOverdue);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.fullName.toLowerCase().includes(q) ||
        s.groupName.toLowerCase().includes(q) ||
        s.phone.includes(q)
      );
    }
    return list;
  }, [all, filter, search]);

  // ── Tanlash ───────────────────────────────────────────────────────────────
  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(s => s.studentId)));
    }
  };
  const selectWithDebt = () => {
    setSelected(new Set(filtered.filter(s => s.currentDebt > 0).map(s => s.studentId)));
  };

  // ── Eslatma yuborish ──────────────────────────────────────────────────────
  // Qarz tuzatish mutation
  const adjustMutation = useMutation(
    async ({ studentId, debt, balance, note }: {
      studentId: number; debt?: number; balance?: number; note?: string;
    }) => {
      const body: Record<string, unknown> = {};
      if (debt    !== undefined) body.debt    = debt;
      if (balance !== undefined) body.balance = balance;
      if (note)                  body.note    = note;
      return api.patch(`/payments/student/${studentId}/adjust-debt`, body);
    },
    {
      onSuccess: (_, vars) => {
        toast.success(`${adjustModal?.fullName} qarz/balansi yangilandi`);
        setAdjustModal(null);
        setAdjDebt(''); setAdjBalance(''); setAdjNote('');
        refetch();
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || 'Tuzatishda xato yuz berdi');
      },
    }
  );

  const openAdjust = (s: DebtorEntry) => {
    setAdjustModal({ studentId: s.studentId, fullName: s.fullName, currentDebt: s.currentDebt, currentBalance: s.currentBalance });
    setAdjDebt(String(s.currentDebt));
    setAdjBalance(String(s.currentBalance));
    setAdjNote('');
  };

  const notifyMutation = useMutation(
    async (ids: number[]) => {
      const r = await api.post('/payments/notify-debtors', { studentIds: ids });
      return r.data?.data as { notified: number; total: number };
    },
    {
      onSuccess: (d) => {
        toast.success(`✅ ${d?.total ?? selected.size} ta o'quvchiga eslatma yuborildi (${d?.notified ?? 0} Telegram)`);
        setShowConfirm(false);
        setSelected(new Set());
        refetch();
      },
      onError: () => { toast.error('Eslatma yuborishda xato'); },
    }
  );

  // ── Statistika ──────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:       all.length,
    withDebt:    all.filter(s => s.currentDebt > 0).length,
    dueSoon:     all.filter(s => s.isDueSoon || s.isOverdue).length,
    totalDebt:   all.reduce((s, x) => s + x.currentDebt, 0),
  }), [all]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* ── Sarlavha ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">To'lov eslatmalari</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            Admin tasdiqlaydi → keyin Telegram orqali yuboriladi
          </p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          <RefreshCw className="w-4 h-4" />
          Yangilash
        </button>
      </div>

      {/* ── Statistika ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Jami o'quvchi",   value: stats.total,          color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-gray-800' },
          { label: 'Qarz bor',        value: stats.withDebt,       color: 'text-red-600 dark:text-red-400',   bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'Yaqin muddat',    value: stats.dueSoon,        color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Umumiy qarz',     value: fmt(stats.totalDebt) + " so'm", color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20' },
        ].map(s => (
          <div key={s.label} className={clsx('rounded-2xl px-4 py-3 text-center', s.bg)}>
            <p className={clsx('text-lg font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter + Qidiruv ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Filter tugmalari */}
        {[
          { key: 'all',  label: 'Barchasi' },
          { key: 'debt', label: 'Qarzdorlar' },
          { key: 'soon', label: 'Yaqin muddat' },
        ].map(f => (
          <button key={f.key} onClick={() => { setFilter(f.key as typeof filter); setSelected(new Set()); }}
            className={clsx(
              'px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all',
              filter === f.key
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-300',
            )}>
            {f.label}
          </button>
        ))}

        {/* Qidiruv */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ism yoki guruh..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700" />
        </div>
      </div>

      {/* ── Tanlash toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={toggleAll}
            className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 transition">
            {selected.size === filtered.length && filtered.length > 0
              ? <CheckSquare className="w-4 h-4 text-indigo-600" />
              : <Square className="w-4 h-4" />}
            Barchani tanlash
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button onClick={selectWithDebt}
            className="text-sm text-red-600 dark:text-red-400 hover:underline">
            Faqat qarzdorlar
          </button>
          {selected.size > 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                {selected.size} ta tanlandi
              </span>
              <button onClick={() => setSelected(new Set())}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Yuborish tugmasi */}
        <button
          onClick={() => setShowConfirm(true)}
          disabled={selected.size === 0 || notifyMutation.isLoading}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
            selected.size > 0
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-[0.99]'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed',
          )}>
          <Send className="w-4 h-4" />
          Eslatma yuborish ({selected.size})
        </button>
      </div>

      {/* ── Ro'yxat ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Users className="w-10 h-10 mx-auto mb-3 text-gray-200 dark:text-gray-700" />
          <p className="text-sm">O'quvchilar topilmadi</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[2rem_1fr_1fr_7rem_7rem_6rem_5rem] gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
            <span />
            <span>O'quvchi</span>
            <span>Guruh</span>
            <span>Oylik summa</span>
            <span>Qarz</span>
            <span>Keyingi to'lov</span>
            <span>Telegram</span>
          </div>

          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {filtered.map(s => {
              const isSelected = selected.has(s.studentId);
              return (
                <div key={s.studentId}
                  onClick={() => toggleOne(s.studentId)}
                  className={clsx(
                    'grid grid-cols-[2rem_1fr] sm:grid-cols-[2rem_1fr_1fr_7rem_7rem_6rem_5rem] gap-3 px-4 py-3 cursor-pointer transition-colors items-center',
                    isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                    s.isOverdue && 'border-l-2 border-red-400',
                    s.isDueSoon && !s.isOverdue && 'border-l-2 border-amber-400',
                  )}>

                  {/* Checkbox */}
                  <div className="flex items-center">
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                      : <Square className="w-4 h-4 text-gray-300 dark:text-gray-600" />}
                  </div>

                  {/* Ism + telefon */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{s.fullName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{s.phone}</p>
                    {s.parentName && (
                      <p className="text-xs text-gray-300 dark:text-gray-600 truncate">
                        👪 {s.parentName} · {s.parentPhone}
                      </p>
                    )}
                  </div>

                  {/* Guruh */}
                  <div className="hidden sm:block min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{s.groupName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{s.courseName}</p>
                  </div>

                  {/* Oylik summa */}
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {fmt(s.monthlyAmount)} so'm
                    </p>
                    <p className="text-xs text-gray-400">har oy · {s.dueDay}-sana</p>
                  </div>

                  {/* Qarz + Tuzatish */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <div>
                      {s.currentDebt > 0 ? (
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-red-600 dark:text-red-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {fmt(s.currentDebt)} so'm
                        </span>
                      ) : s.currentBalance > 0 ? (
                        <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                          +{fmt(s.currentBalance)} so'm
                        </span>
                      ) : (
                        <span className="text-sm text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); openAdjust(s); }}
                      title="Qarzni tuzatish"
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition">
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Keyingi to'lov sanasi */}
                  <div className="hidden sm:block">
                    <p className={clsx(
                      'text-sm font-medium',
                      s.isOverdue ? 'text-red-600 dark:text-red-400' :
                      s.isDueSoon ? 'text-amber-600 dark:text-amber-400' :
                      'text-gray-600 dark:text-gray-300',
                    )}>
                      {format(new Date(s.nextDueDate), 'd MMM', { locale: uz })}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {s.daysUntilDue === 0 ? 'Bugun' :
                       s.daysUntilDue < 0  ? `${Math.abs(s.daysUntilDue)} kun o'tgan` :
                                             `${s.daysUntilDue} kun qoldi`}
                    </p>
                  </div>

                  {/* Telegram holati */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <div className={clsx(
                      'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
                      s.hasTelegram ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400',
                    )}>
                      {s.hasTelegram ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                      {s.hasTelegram ? 'Bor' : 'Yo\'q'}
                    </div>
                    {s.parentTelegram && (
                      <div className="flex items-center gap-1 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                        <Bell className="w-3 h-3" /> OO
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Qarz tuzatish modali ──────────────────────────────────────── */}
      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Qarz / Balans tuzatish
              </h3>
              <button onClick={() => setAdjustModal(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-4">
              {adjustModal.fullName}
            </p>

            <div className="space-y-3">
              {/* Qarz */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  Qarz (so'm)
                  <span className="ml-2 text-gray-300 dark:text-gray-600 font-normal">
                    Hozir: {fmt(adjustModal.currentDebt)} so'm
                  </span>
                </label>
                <input
                  type="number" min="0" step="1000"
                  value={adjDebt}
                  onChange={e => setAdjDebt(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-700"
                  placeholder="0"
                />
              </div>

              {/* Balans */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  Balans / Ortiqcha to'lov (so'm)
                  <span className="ml-2 text-gray-300 dark:text-gray-600 font-normal">
                    Hozir: {fmt(adjustModal.currentBalance)} so'm
                  </span>
                </label>
                <input
                  type="number" min="0" step="1000"
                  value={adjBalance}
                  onChange={e => setAdjBalance(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-700"
                  placeholder="0"
                />
              </div>

              {/* Izoh */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  Izoh (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={adjNote}
                  onChange={e => setAdjNote(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Masalan: Bir hafta kelmadi, chegirma..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setAdjustModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Bekor
              </button>
              <button
                onClick={() => adjustMutation.mutate({
                  studentId: adjustModal.studentId,
                  debt:    adjDebt    !== '' ? parseFloat(adjDebt)    : undefined,
                  balance: adjBalance !== '' ? parseFloat(adjBalance) : undefined,
                  note:    adjNote || undefined,
                })}
                disabled={adjustMutation.isLoading}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition flex items-center justify-center gap-2">
                {adjustMutation.isLoading
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Check className="w-4 h-4" />}
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tasdiqlash modali ──────────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Eslatma yuborilsinmi?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              <b className="text-gray-800 dark:text-gray-200">{selected.size} ta o'quvchi</b> ga
              Telegram orqali to'lov eslatmasi yuboriladi.
              Bu amalni qaytarib bo'lmaydi.
            </p>

            {/* Tanlangan o'quvchilar ro'yxati (max 5) */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-5 space-y-1 max-h-36 overflow-y-auto">
              {all.filter(s => selected.has(s.studentId)).slice(0, 10).map(s => (
                <div key={s.studentId} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{s.fullName}</span>
                  <span className="text-gray-400 dark:text-gray-500">{s.groupName}</span>
                </div>
              ))}
              {selected.size > 10 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">
                  ...va yana {selected.size - 10} ta
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Bekor qilish
              </button>
              <button
                onClick={() => notifyMutation.mutate(Array.from(selected))}
                disabled={notifyMutation.isLoading}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition flex items-center justify-center gap-2">
                {notifyMutation.isLoading
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Yuborilmoqda...</>
                  : <><Send className="w-4 h-4" /> Yuborish</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
