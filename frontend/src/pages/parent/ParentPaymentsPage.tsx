import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  CreditCard, Wallet, TrendingDown, CheckCircle,
  ExternalLink, Users, Info, Clock, Calculator,
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Naqd', CARD: 'Karta', TRANSFER: "O'tkazma", ONLINE: 'Online',
};
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PAID:    { label: "To'langan",  cls: 'bg-emerald-100 text-emerald-700' },
  PARTIAL: { label: 'Qisman',     cls: 'bg-amber-100 text-amber-700' },
  PENDING: { label: 'Kutilmoqda', cls: 'bg-red-100 text-red-700' },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalcData {
  monthlyAmount: number;
  debtAmount: number;
  options: { oneMonth: number; twoMonths: number; threeMonths: number };
  currentDebt: number;
  currentBalance: number;
  completedLessons: number;
  totalPaid: number;
  groupName: string;
  courseName: string;
  message?: string;
}

interface ChildInfo {
  id: number;
  coinBalance: number;
  status: string;
  user: { id: number; fullName: string; phone: string };
}

// ─── Online Pay Modal ─────────────────────────────────────────────────────────
function OnlinePayModal({
  studentId,
  childName,
  calcData,
  onClose,
  onSuccess,
}: {
  studentId: number;
  childName: string;
  calcData: CalcData;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState<string>(
    String(calcData.debtAmount > 0 ? calcData.debtAmount : calcData.monthlyAmount)
  );
  const [provider, setProvider] = useState<'PAYME' | 'UZUM'>('PAYME');
  const [loading, setLoading] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const currentMonth = new Date().toISOString().slice(0, 7);

  const quickAmounts = [
    { label: '1 oy',  value: calcData.options.oneMonth },
    { label: '2 oy',  value: calcData.options.twoMonths },
    { label: '3 oy',  value: calcData.options.threeMonths },
  ];

  const pay = async () => {
    if (numAmount <= 0) { toast.error("Summa 0 dan katta bo'lishi kerak"); return; }
    setLoading(true);
    try {
      const res = await api.post('/payments/online/initiate', {
        studentId, amount: numAmount, month: currentMonth, provider,
      });
      const { paymentUrl } = res.data?.data || {};
      if (paymentUrl) {
        window.open(paymentUrl, '_blank');
        onSuccess();
        onClose();
      } else {
        toast.error("To'lov havolasi yaratilmadi");
      }
    } catch {
      toast.error('Xato yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <CreditCard size={18} /> Online To'lov
          </h3>
          <p className="text-indigo-200 text-xs mt-0.5">
            {childName} · {calcData.groupName}
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Quick amounts */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Tez tanlash:</p>
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setAmount(String(opt.value))}
                  className={clsx(
                    'py-2.5 rounded-xl text-xs font-semibold border transition',
                    numAmount === opt.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                  )}
                >
                  {opt.label}
                  <br />
                  <span className="text-[10px] opacity-80">
                    {new Intl.NumberFormat('uz-UZ').format(opt.value)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Debt quick-fill */}
          {calcData.debtAmount > 0 && (
            <button
              onClick={() => setAmount(String(calcData.debtAmount))}
              className={clsx(
                'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition',
                numAmount === calcData.debtAmount
                  ? 'bg-red-50 border-red-500 text-red-700'
                  : 'border-red-200 text-red-600 hover:bg-red-50'
              )}
            >
              <span className="flex items-center gap-1.5">
                <TrendingDown size={14} /> Qarz miqdori
              </span>
              <span className="font-bold">{fmt(calcData.debtAmount)}</span>
            </button>
          )}

          {/* Custom amount */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Yoki o'zingiz kiriting:
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Summa (so'm)"
                min={1000}
                step={1000}
                className="w-full px-4 py-2.5 pr-14 rounded-xl border border-gray-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">so'm</span>
            </div>
          </div>

          {/* Provider */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">To'lov tizimi:</p>
            <div className="grid grid-cols-2 gap-2">
              {(['PAYME', 'UZUM'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={clsx(
                    'py-3 rounded-xl font-semibold text-sm border transition flex items-center justify-center gap-2',
                    provider === p
                      ? p === 'PAYME'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-orange-500 text-white border-orange-500'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <span>{p === 'PAYME' ? '🔵' : '🟠'}</span>
                  {p === 'PAYME' ? 'Payme' : 'Uzum'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={pay}
            disabled={loading || numAmount <= 0}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600
              text-white font-bold text-sm flex items-center justify-center gap-2
              hover:from-indigo-500 hover:to-violet-500 transition disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Yuklanmoqda...
              </span>
            ) : (
              <>
                <ExternalLink size={14} />
                {fmt(numAmount)} to'lash
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Bekor qilish
          </button>

          <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1">
            <Info size={11} />
            To'lov miqdori istalgancha belgilanishi mumkin
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Pay Modal ───────────────────────────────────────────────────────────
function BulkPayModal({
  children,
  childCalcs,
  onClose,
}: {
  children: ChildInfo[];
  childCalcs: Record<number, CalcData | null>;
  onClose: () => void;
}) {
  const [provider, setProvider] = useState<'PAYME' | 'UZUM'>('PAYME');
  const [payingIds, setPayingIds] = useState<Set<number>>(new Set());

  // Children with debt
  const debtors = children.filter(c => {
    const calc = childCalcs[c.id];
    return calc && calc.debtAmount > 0;
  });

  const totalDebt = debtors.reduce((sum, c) => {
    const calc = childCalcs[c.id];
    return sum + (calc?.debtAmount || 0);
  }, 0);

  const payOne = async (child: ChildInfo) => {
    const calc = childCalcs[child.id];
    if (!calc || calc.debtAmount <= 0) return;
    setPayingIds(prev => new Set(prev).add(child.id));
    try {
      const res = await api.post('/payments/online/initiate', {
        studentId: child.id,
        amount: calc.debtAmount,
        month: new Date().toISOString().slice(0, 7),
        provider,
      });
      const { paymentUrl } = res.data?.data || {};
      if (paymentUrl) {
        window.open(paymentUrl, '_blank');
        toast.success(`${child.user.fullName} uchun to'lov sahifasi ochildi`);
      } else {
        toast.error("To'lov havolasi yaratilmadi");
      }
    } catch {
      toast.error('Xato yuz berdi');
    } finally {
      setPayingIds(prev => { const s = new Set(prev); s.delete(child.id); return s; });
    }
  };

  if (debtors.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h3 className="font-bold text-gray-800 text-lg mb-1">Barcha farzandlar uchun qarz yo'q!</h3>
          <p className="text-sm text-gray-400 mb-4">Hamma to'lovlar bajarilgan.</p>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm">
            Yopish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Users size={18} /> Barcha farzandlar uchun to'lov
          </h3>
          <p className="text-indigo-200 text-xs mt-0.5">
            Jami qarz: {fmt(totalDebt)} · {debtors.length} ta farzand
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Provider */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">To'lov tizimi:</p>
            <div className="grid grid-cols-2 gap-2">
              {(['PAYME', 'UZUM'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={clsx(
                    'py-3 rounded-xl font-semibold text-sm border transition flex items-center justify-center gap-2',
                    provider === p
                      ? p === 'PAYME'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-orange-500 text-white border-orange-500'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <span>{p === 'PAYME' ? '🔵' : '🟠'}</span>
                  {p === 'PAYME' ? 'Payme' : 'Uzum'}
                </button>
              ))}
            </div>
          </div>

          {/* Each debtor */}
          <div className="space-y-3">
            {debtors.map(child => {
              const calc = childCalcs[child.id];
              const isPaying = payingIds.has(child.id);
              return (
                <div key={child.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-base font-bold text-red-600 flex-shrink-0">
                    {child.user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{child.user.fullName}</p>
                    <p className="text-xs text-red-500 font-medium">Qarz: {fmt(calc?.debtAmount || 0)}</p>
                  </div>
                  <button
                    onClick={() => payOne(child)}
                    disabled={isPaying}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold
                      hover:bg-indigo-700 transition disabled:opacity-60 flex-shrink-0"
                  >
                    {isPaying ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ExternalLink size={12} />
                    )}
                    To'lash
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Child Payment Card ───────────────────────────────────────────────────────
function ChildPaymentCard({
  child,
  isSelected,
  onSelect,
}: {
  child: ChildInfo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { data: paymentsData } = useQuery(['parent-pay-balance', child.id], async () => {
    const r = await api.get(`/payments/student/${child.id}`);
    return r.data?.data;
  });

  const balance = paymentsData?.balance;
  const hasDebt = Number(balance?.debt) > 0;

  return (
    <button
      onClick={onSelect}
      className={clsx(
        'w-full text-left p-4 rounded-2xl border-2 transition',
        isSelected
          ? 'border-indigo-500 bg-indigo-50'
          : hasDebt
          ? 'border-red-200 bg-red-50 hover:border-red-300'
          : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50'
      )}
    >
      <div className="flex items-center gap-3">
        <div className={clsx(
          'w-11 h-11 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0',
          isSelected ? 'bg-indigo-600 text-white' :
          hasDebt ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
        )}>
          {child.user.fullName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{child.user.fullName}</p>
          {balance ? (
            <p className={clsx('text-xs font-medium', hasDebt ? 'text-red-500' : 'text-emerald-500')}>
              {hasDebt ? `Qarz: ${fmt(Number(balance.debt))}` : "✅ Qarz yo'q"}
            </p>
          ) : (
            <p className="text-xs text-gray-400">Yuklanmoqda...</p>
          )}
        </div>
        {hasDebt && (
          <span className="flex-shrink-0 text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
            ⚠️
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const ParentPaymentsPage = () => {
  const [selectedChildIdx, setSelectedChildIdx] = useState(0);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const { data: profile } = useQuery('parent-profile-payments', async () => {
    const r = await api.get('/auth/me');
    return r.data?.data;
  });

  const children: ChildInfo[] = profile?.children || [];
  const selectedChild = children[selectedChildIdx] ?? null;
  const studentId = selectedChild?.id ?? null;

  // Payment data for selected child
  const { data: paymentsData, isLoading, refetch } = useQuery(
    ['parent-payments-page', studentId],
    async () => {
      const r = await api.get(`/payments/student/${studentId}`);
      return r.data?.data;
    },
    { enabled: !!studentId }
  );

  // Calc data for selected child
  const { data: calcData } = useQuery<CalcData>(
    ['parent-calc-page', studentId],
    async () => {
      const r = await api.get(`/payments/student/${studentId}/calculate`);
      return r.data?.data;
    },
    { enabled: !!studentId }
  );

  // Calc data for ALL children (for bulk modal)
  const childCalcQueries = useQuery(
    ['parent-all-calcs', children.map(c => c.id).join(',')],
    async () => {
      if (children.length === 0) return {};
      const results = await Promise.all(
        children.map(async c => {
          try {
            const r = await api.get(`/payments/student/${c.id}/calculate`);
            return [c.id, r.data?.data] as [number, CalcData];
          } catch {
            return [c.id, null] as [number, null];
          }
        })
      );
      return Object.fromEntries(results);
    },
    { enabled: children.length > 0 }
  );
  const allChildCalcs: Record<number, CalcData | null> = childCalcQueries.data || {};

  const balance = paymentsData?.balance;
  const payments = paymentsData?.payments || [];
  const fees = paymentsData?.fees || [];

  const totalDebtAll = children.reduce((sum, c) => {
    const calc = allChildCalcs[c.id];
    return sum + (calc?.debtAmount || 0);
  }, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 p-5 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Wallet size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">To'lovlar</h1>
            <p className="text-indigo-200 text-xs">Farzandlaringiz to'lov holati</p>
          </div>
        </div>

        {children.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-indigo-200 text-xs mb-1 flex items-center gap-1">
                <Users size={11} /> Farzandlar
              </p>
              <p className="text-xl font-bold">{children.length} ta</p>
            </div>
            <div className={clsx('rounded-xl p-3', totalDebtAll > 0 ? 'bg-red-500/30' : 'bg-white/10')}>
              <p className="text-indigo-200 text-xs mb-1 flex items-center gap-1">
                <TrendingDown size={11} /> Jami qarz
              </p>
              <p className="text-xl font-bold">{totalDebtAll > 0 ? fmt(totalDebtAll) : "Yo'q ✅"}</p>
            </div>
          </div>
        )}

        {/* Bulk pay button */}
        {children.length > 1 && totalDebtAll > 0 && (
          <button
            onClick={() => setShowBulkModal(true)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl
              bg-white/20 hover:bg-white/30 text-white font-semibold text-sm transition"
          >
            <Users size={16} />
            Barcha farzandlar uchun to'lash ({fmt(totalDebtAll)})
          </button>
        )}
      </div>

      {children.length === 0 ? (
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">👶</div>
          <p className="text-gray-500 font-medium">Farzandlar topilmadi</p>
          <p className="text-sm text-gray-400 mt-1">Admin orqali farzandingizni biriktiring</p>
        </div>
      ) : (
        <>
          {/* Child selector */}
          {children.length > 1 && (
            <div className="card p-3">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <Users size={11} /> Farzandni tanlang
              </p>
              <div className="space-y-2">
                {children.map((child, i) => (
                  <ChildPaymentCard
                    key={child.id}
                    child={child}
                    isSelected={i === selectedChildIdx}
                    onSelect={() => setSelectedChildIdx(i)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Single child (no selector needed) */}
          {children.length === 1 && selectedChild && (
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-base font-bold text-indigo-600">
                  {selectedChild.user.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{selectedChild.user.fullName}</p>
                  <p className="text-xs text-gray-400">{selectedChild.user.phone}</p>
                </div>
                <span className={clsx(
                  'ml-auto text-xs px-2.5 py-1 rounded-full font-medium',
                  Number(balance?.debt) > 0
                    ? 'bg-red-100 text-red-600'
                    : 'bg-emerald-100 text-emerald-600'
                )}>
                  {Number(balance?.debt) > 0 ? `Qarz: ${fmt(Number(balance.debt))}` : "✅ Qarz yo'q"}
                </span>
              </div>
            </div>
          )}

          {/* Balance card for selected child */}
          {selectedChild && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className={clsx(
                  'card p-4',
                  Number(balance?.debt) > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
                )}>
                  <p className={clsx('text-xs mb-1', Number(balance?.debt) > 0 ? 'text-red-400' : 'text-emerald-400')}>
                    <TrendingDown size={11} className="inline mr-1" />
                    Qarz
                  </p>
                  <p className={clsx('font-bold text-lg',
                    Number(balance?.debt) > 0 ? 'text-red-600' : 'text-emerald-600')}>
                    {Number(balance?.debt) > 0 ? fmt(Number(balance.debt)) : "Yo'q ✅"}
                  </p>
                </div>
                <div className="card p-4 bg-blue-50 border-blue-100">
                  <p className="text-xs text-blue-400 mb-1">
                    <Wallet size={11} className="inline mr-1" />
                    Balans
                  </p>
                  <p className="font-bold text-lg text-blue-600">{fmt(Number(balance?.balance || 0))}</p>
                </div>
              </div>

              {/* Pay button for selected child */}
              {calcData && !calcData.message && (
                <div className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <Calculator size={15} className="text-indigo-500" />
                      To'lov hisob-kitobi
                    </h3>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">
                      {calcData.groupName}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                      <p className="text-xs text-indigo-500 mb-1 font-medium">Oylik to'lov</p>
                      <p className="text-base font-bold text-indigo-700">{fmt(calcData.monthlyAmount)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-xs text-gray-500 mb-1 font-medium">Joriy qarz</p>
                      <p className={clsx('text-base font-bold',
                        calcData.debtAmount > 0 ? 'text-red-600' : 'text-emerald-600')}>
                        {calcData.debtAmount > 0 ? fmt(calcData.debtAmount) : "Yo'q ✅"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowPayModal(true)}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600
                      text-white font-bold text-sm flex items-center justify-center gap-2
                      hover:from-indigo-500 hover:to-violet-500 transition"
                  >
                    <CreditCard size={16} />
                    {selectedChild.user.fullName} uchun online to'lov
                  </button>
                </div>
              )}

              {/* Monthly fees */}
              {fees.length > 0 && (
                <div className="card">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Clock size={15} className="text-indigo-500" />
                    Oylik to'lov holati
                  </h3>
                  <div className="space-y-3">
                    {fees.map((fee: {
                      id: number; month: string; baseAmount: number;
                      finalAmount: number; attendedCount: number; lessonsCount: number
                    }) => (
                      <div key={fee.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-gray-700">
                            {new Date(fee.month).toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock size={11} />
                            {fee.attendedCount}/{fee.lessonsCount} dars
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">To'lov summasi</span>
                          <span className="font-bold text-gray-800">
                            {fmt(Number(fee.finalAmount || fee.baseAmount))}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400"
                            style={{
                              width: `${fee.lessonsCount > 0
                                ? (fee.attendedCount / fee.lessonsCount) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment history */}
              <div className="card">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-500" />
                  To'lov tarixi — {selectedChild.user.fullName}
                </h3>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Yuklanmoqda...</p>
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-10 text-gray-300">
                    <div className="text-5xl mb-3">💰</div>
                    <p className="text-sm text-gray-400">To'lovlar topilmadi</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payments.map((p: {
                      id: number; amount: number; paymentMethod: string;
                      paidAt: string; status: string; provider?: string;
                    }) => (
                      <div key={p.id}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition border border-transparent hover:border-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg flex-shrink-0">
                            {p.provider === 'PAYME' ? '🔵' : p.provider === 'UZUM' ? '🟠' : '💳'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-emerald-600">{fmt(Number(p.amount))}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {METHOD_LABELS[p.paymentMethod] || p.paymentMethod}
                              {p.provider ? ` · ${p.provider}` : ''}
                              {p.paidAt
                                ? ` · ${new Date(p.paidAt).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })}`
                                : ''}
                            </p>
                          </div>
                        </div>
                        <span className={clsx(
                          'text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0',
                          STATUS_MAP[p.status]?.cls || STATUS_MAP.PENDING.cls
                        )}>
                          {STATUS_MAP[p.status]?.label || p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Modals */}
      {showPayModal && studentId && calcData && selectedChild && (
        <OnlinePayModal
          studentId={studentId}
          childName={selectedChild.user.fullName}
          calcData={calcData}
          onClose={() => setShowPayModal(false)}
          onSuccess={() => { refetch(); }}
        />
      )}

      {showBulkModal && (
        <BulkPayModal
          children={children}
          childCalcs={allChildCalcs}
          onClose={() => setShowBulkModal(false)}
        />
      )}
    </div>
  );
};

export default ParentPaymentsPage;
