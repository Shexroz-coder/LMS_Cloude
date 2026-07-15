/**
 * AdminBillingPage — Sodda to'lov boshqaruvi
 *
 * Har o'quvchi uchun bir qator:
 *  - Oylik summa va to'lov kuni (inline tahrirlash)
 *  - Oxirgi to'lov / keyingi to'lov
 *  - So'nggi 4 oy: ✅ To'langan / 🔴 Qarz / ⏳ Kutilmoqda
 *  - Qarz voz kechish va tez to'lov qabul qilish
 */
import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Search, RefreshCw, Check, X, DollarSign, AlertTriangle,
  Users, TrendingDown, Calendar, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '../../api/axios';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MonthStatus {
  month:  string;
  label:  string;
  paid:   number;
  due:    number;
  status: 'PAID' | 'PARTIAL' | 'DEBT' | 'UPCOMING';
}

interface BillingEntry {
  studentId:      number;
  fullName:       string;
  phone:          string;
  groups:         { id: number; name: string; courseName: string }[];
  monthlyAmount:  number;
  totalPrice:     number;
  discount:       number;
  paymentDay:     number;
  joinedAt:       string;
  lastPayment:    { date: string; amount: number } | null;
  nextDueDate:    string;
  daysUntilDue:   number;
  currentDebt:    number;
  currentBalance: number;
  monthlyStatus:  MonthStatus[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('uz-UZ').format(Math.round(v));

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}-${['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'][d.getMonth()]}`;
};

function StatusPill({ s }: { s: MonthStatus }) {
  if (s.status === 'PAID') {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] text-zinc-400">{s.label}</span>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
          ✓ To'landi
        </span>
      </div>
    );
  }
  if (s.status === 'PARTIAL') {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] text-zinc-400">{s.label}</span>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
          ~ {fmt(s.paid)}
        </span>
      </div>
    );
  }
  if (s.status === 'DEBT') {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] text-zinc-400">{s.label}</span>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
          Qarz
        </span>
      </div>
    );
  }
  // UPCOMING
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-zinc-400">{s.label}</span>
      <span className="px-2 py-0.5 rounded-full text-[11px] text-zinc-400 border border-dashed border-zinc-300">
        Kutilmoqda
      </span>
    </div>
  );
}

// ─── Inline editable cell ───────────────────────────────────────────────────────

function EditableAmount({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const start = () => {
    setDraft(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };
  const commit = () => {
    const n = parseFloat(draft.replace(/\s/g, ''));
    if (!isNaN(n) && n > 0 && n !== value) onSave(n);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="w-28 text-sm border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
          autoFocus
        />
      </div>
    );
  }

  return (
    <button
      onClick={start}
      className="group flex items-center gap-1 text-sm font-semibold text-zinc-800 hover:text-blue-600 transition-colors"
      title="Tahrirlash uchun bosing"
    >
      {fmt(value)} so'm
      <span className="text-[10px] text-zinc-400 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">✏</span>
    </button>
  );
}

function EditableDay({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="group flex items-center gap-1 text-sm font-semibold text-zinc-700 hover:text-blue-600"
        title="To'lov kunini o'zgartirish"
      >
        Har oyning <span className="text-blue-600">{value}</span>-si
        <ChevronDown className="w-3 h-3 text-zinc-400 group-hover:text-blue-400" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg p-2 grid grid-cols-7 gap-1 w-56">
          {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
            <button
              key={d}
              onClick={() => { onSave(d); setOpen(false); }}
              className={clsx(
                'w-7 h-7 rounded text-xs font-medium transition-colors',
                d === value
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-zinc-100 text-zinc-700'
              )}
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Waive Modal ────────────────────────────────────────────────────────────────

function WaiveModal({
  entry,
  onClose,
  onDone,
}: {
  entry: BillingEntry;
  onClose: () => void;
  onDone:  () => void;
}) {
  const [amount, setAmount] = useState(String(entry.currentDebt));
  const [reason, setReason] = useState('');

  const mutation = useMutation(
    () => api.post(`/payments/student/${entry.studentId}/waive-debt`, {
      amount: parseFloat(amount),
      reason,
    }),
    {
      onSuccess: (r) => {
        toast.success(r.data?.message || 'Qarz voz kechildi!');
        onDone();
      },
      onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); },
    }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-800">Qarz voz kechish</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-lg">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-1 mb-4 p-3 bg-zinc-50 rounded-lg text-sm">
          <p className="font-semibold text-zinc-800">{entry.fullName}</p>
          <p className="text-zinc-500">{entry.groups.map(g => g.name).join(', ')}</p>
          <p className="text-red-600 font-medium">
            Joriy qarz: {fmt(entry.currentDebt)} so'm
          </p>
        </div>

        <label className="block mb-3">
          <span className="text-sm font-medium text-zinc-700 mb-1 block">
            Voz kechiladigan summa (so'm)
          </span>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          <button
            onClick={() => setAmount(String(entry.currentDebt))}
            className="text-xs text-blue-500 mt-1 hover:underline"
          >
            Hammasi ({fmt(entry.currentDebt)} so'm)
          </button>
        </label>

        <label className="block mb-5">
          <span className="text-sm font-medium text-zinc-700 mb-1 block">Sabab (ixtiyoriy)</span>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Masalan: O'quvchi kasal bo'ldi..."
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
        </label>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-600 hover:bg-zinc-50 font-medium"
          >
            Bekor
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isLoading || !amount || parseFloat(amount) <= 0}
            className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {mutation.isLoading ? 'Saqlanmoqda...' : 'Voz kechish'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Pay Modal ────────────────────────────────────────────────────────────

function QuickPayModal({
  entry,
  onClose,
  onDone,
}: {
  entry: BillingEntry;
  onClose: () => void;
  onDone:  () => void;
}) {
  const [amount, setAmount] = useState(String(entry.monthlyAmount));
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [note, setNote]     = useState('');

  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const mutation = useMutation(
    () => api.post('/payments', {
      studentId:     entry.studentId,
      amount:        parseFloat(amount),
      paymentMethod: method,
      month:         monthStr,
      note:          note || undefined,
    }),
    {
      onSuccess: () => {
        toast.success("To'lov qabul qilindi!");
        onDone();
      },
      onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); },
    }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-800">To'lov qabul qilish</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-lg">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-1 mb-4 p-3 bg-zinc-50 rounded-lg text-sm">
          <p className="font-semibold text-zinc-800">{entry.fullName}</p>
          <p className="text-zinc-500">{entry.groups.map(g => g.name).join(' · ')}</p>
          {entry.currentDebt > 0 && (
            <p className="text-red-600 font-medium">Qarz: {fmt(entry.currentDebt)} so'm</p>
          )}
        </div>

        <label className="block mb-3">
          <span className="text-sm font-medium text-zinc-700 mb-1 block">Summa (so'm)</span>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>

        <label className="block mb-3">
          <span className="text-sm font-medium text-zinc-700 mb-1 block">To'lov turi</span>
          <div className="grid grid-cols-3 gap-2">
            {(['CASH', 'CARD', 'TRANSFER'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={clsx(
                  'py-2 rounded-lg text-sm font-medium border transition-colors',
                  method === m
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                )}
              >
                {m === 'CASH' ? 'Naqd' : m === 'CARD' ? 'Karta' : "O'tkazma"}
              </button>
            ))}
          </div>
        </label>

        <label className="block mb-5">
          <span className="text-sm font-medium text-zinc-700 mb-1 block">Izoh (ixtiyoriy)</span>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Masalan: Iyul oyi to'lovi"
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
        </label>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-600 hover:bg-zinc-50 font-medium"
          >
            Bekor
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isLoading || !amount || parseFloat(amount) <= 0}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {mutation.isLoading ? 'Saqlanmoqda...' : "Qabul qilish"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminBillingPage() {
  const qc = useQueryClient();

  const [search,     setSearch]     = useState('');
  const [filterType, setFilterType] = useState<'all' | 'debt' | 'paid' | 'upcoming'>('all');
  const [waiveEntry, setWaiveEntry] = useState<BillingEntry | null>(null);
  const [payEntry,   setPayEntry]   = useState<BillingEntry | null>(null);

  // ── Data fetch ──
  const { data: rows = [], isLoading, isFetching, refetch } = useQuery<BillingEntry[]>(
    ['billing-overview'],
    () => api.get('/payments/billing').then(r => r.data?.data ?? []),
    { staleTime: 30_000 }
  );

  // ── Config update mutation ──
  const configMutation = useMutation(
    ({ studentId, body }: { studentId: number; body: Record<string, unknown> }) =>
      api.patch(`/payments/student/${studentId}/billing-config`, body),
    {
      onSuccess: (_, vars) => {
        toast.success('Saqlandi!');
        qc.invalidateQueries(['billing-overview']);
      },
      onError: (e: any) => { toast.error(e.response?.data?.message || 'Xato!'); },
    }
  );

  // ── Stats ──
  const stats = useMemo(() => {
    const totalStudents   = rows.length;
    const totalMonthly    = rows.reduce((s, r) => s + r.monthlyAmount, 0);
    const totalDebt       = rows.reduce((s, r) => s + r.currentDebt, 0);
    const studentsWithDebt = rows.filter(r => r.currentDebt > 0).length;
    return { totalStudents, totalMonthly, totalDebt, studentsWithDebt };
  }, [rows]);

  // ── Filter ──
  const filtered = useMemo(() => {
    let list = rows;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.fullName.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.groups.some(g => g.name.toLowerCase().includes(q))
      );
    }
    if (filterType === 'debt')     list = list.filter(r => r.currentDebt > 0);
    if (filterType === 'paid')     list = list.filter(r => r.currentDebt === 0);
    if (filterType === 'upcoming') list = list.filter(r => r.daysUntilDue <= 3);
    return list;
  }, [rows, search, filterType]);

  const onModalDone = () => {
    setWaiveEntry(null);
    setPayEntry(null);
    qc.invalidateQueries(['billing-overview']);
  };

  return (
    <div className="p-4 sm:p-6 max-w-full">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">To'lov boshqaruvi</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Har o'quvchining oylik to'lov holati
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors',
            isFetching && 'opacity-50 cursor-not-allowed'
          )}
        >
          <RefreshCw className={clsx('w-4 h-4', isFetching && 'animate-spin')} />
          Yangilash
        </button>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-zinc-500 font-medium">O'quvchilar</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900">{stats.totalStudents}</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-zinc-500 font-medium">Oylik kutilgan</span>
          </div>
          <p className="text-xl font-bold text-zinc-900">{fmt(stats.totalMonthly)}</p>
          <p className="text-xs text-zinc-400">so'm / oy</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-xs text-zinc-500 font-medium">Jami qarz</span>
          </div>
          <p className="text-xl font-bold text-red-600">{fmt(stats.totalDebt)}</p>
          <p className="text-xs text-zinc-400">so'm</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-zinc-500 font-medium">Qarzdor</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.studentsWithDebt}</p>
          <p className="text-xs text-zinc-400">o'quvchi</p>
        </div>
      </div>

      {/* ── Search + Filter ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Ism, telefon yoki guruh bo'yicha qidirish..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="flex gap-2">
          {([
            { key: 'all',      label: 'Hammasi' },
            { key: 'debt',     label: '🔴 Qarzdorlar' },
            { key: 'paid',     label: "✅ To'langanlar" },
            { key: 'upcoming', label: '⏰ 3 kunga qadar' },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              className={clsx(
                'px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors',
                filterType === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="text-center py-20 text-zinc-400">Yuklanmoqda...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">O'quvchilar topilmadi</div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-xs text-zinc-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-zinc-50 z-10 min-w-[180px]">
                    O'quvchi
                  </th>
                  <th className="px-4 py-3 text-left font-semibold min-w-[140px]">Guruh / Fan</th>
                  <th className="px-4 py-3 text-left font-semibold min-w-[160px]">Oylik summa</th>
                  <th className="px-4 py-3 text-left font-semibold min-w-[160px]">To'lov kuni</th>
                  <th className="px-4 py-3 text-left font-semibold min-w-[130px]">Oxirgi to'lov</th>
                  <th className="px-4 py-3 text-left font-semibold min-w-[120px]">Keyingi to'lov</th>
                  <th className="px-4 py-3 text-left font-semibold min-w-[120px]">Qarz / Balans</th>
                  {/* Dynamic month columns */}
                  {filtered[0]?.monthlyStatus.map(m => (
                    <th key={m.month} className="px-3 py-3 text-center font-semibold min-w-[90px]">
                      {m.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-semibold min-w-[120px]">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(row => (
                  <tr key={row.studentId} className="hover:bg-zinc-50/60 transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3 sticky left-0 bg-white hover:bg-zinc-50/60 z-10">
                      <p className="font-semibold text-zinc-900">{row.fullName}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{row.phone}</p>
                    </td>

                    {/* Groups */}
                    <td className="px-4 py-3">
                      {row.groups.map(g => (
                        <div key={g.id} className="leading-tight">
                          <span className="font-medium text-zinc-700">{g.name}</span>
                          <span className="text-zinc-400 text-xs"> · {g.courseName}</span>
                        </div>
                      ))}
                    </td>

                    {/* Monthly Amount — inline edit */}
                    <td className="px-4 py-3">
                      <EditableAmount
                        value={row.monthlyAmount}
                        onSave={v => configMutation.mutate({ studentId: row.studentId, body: { monthlyAmount: v } })}
                      />
                      {row.discount > 0 && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Chegirma: -{fmt(row.discount)} so'm
                        </p>
                      )}
                    </td>

                    {/* Payment Day — inline edit */}
                    <td className="px-4 py-3">
                      <EditableDay
                        value={row.paymentDay}
                        onSave={v => configMutation.mutate({ studentId: row.studentId, body: { paymentDay: v } })}
                      />
                    </td>

                    {/* Last payment */}
                    <td className="px-4 py-3">
                      {row.lastPayment ? (
                        <>
                          <p className="font-medium text-emerald-700">{fmt(row.lastPayment.amount)} so'm</p>
                          <p className="text-xs text-zinc-400">{fmtDate(row.lastPayment.date)}</p>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>

                    {/* Next due */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-700">{fmtDate(row.nextDueDate)}</p>
                      <p className={clsx(
                        'text-xs mt-0.5',
                        row.daysUntilDue <= 0 ? 'text-red-500 font-semibold'
                          : row.daysUntilDue <= 3 ? 'text-amber-500'
                          : 'text-zinc-400'
                      )}>
                        {row.daysUntilDue <= 0
                          ? 'Bugun!'
                          : `${row.daysUntilDue} kun qoldi`}
                      </p>
                    </td>

                    {/* Debt / Balance */}
                    <td className="px-4 py-3">
                      {row.currentDebt > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
                          -{fmt(row.currentDebt)} so'm
                        </span>
                      ) : row.currentBalance > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold">
                          +{fmt(row.currentBalance)} so'm
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>

                    {/* Month status pills */}
                    {row.monthlyStatus.map(ms => (
                      <td key={ms.month} className="px-3 py-3 text-center">
                        <StatusPill s={ms} />
                      </td>
                    ))}

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => setPayEntry(row)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          To'lov
                        </button>
                        {row.currentDebt > 0 && (
                          <button
                            onClick={() => setWaiveEntry(row)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg border border-red-200 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Voz kechish
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-200 text-xs text-zinc-500">
            {filtered.length} ta o'quvchi ko'rsatilmoqda · Summa va to'lov kunini bosish orqali tahrirlang
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {waiveEntry && (
        <WaiveModal entry={waiveEntry} onClose={() => setWaiveEntry(null)} onDone={onModalDone} />
      )}
      {payEntry && (
        <QuickPayModal entry={payEntry} onClose={() => setPayEntry(null)} onDone={onModalDone} />
      )}
    </div>
  );
}
