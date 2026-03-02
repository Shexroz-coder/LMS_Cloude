import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  Bell, ExternalLink, CreditCard, Clock, Calculator,
  TrendingDown, Wallet, ChevronRight, Info
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Naqd', CARD: 'Karta', TRANSFER: "O'tkazma", ONLINE: 'Online',
};
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PAID:    { label: "To'langan",  cls: "bg-emerald-100 text-emerald-700" },
  PARTIAL: { label: "Qisman",     cls: "bg-amber-100 text-amber-700" },
  PENDING: { label: "Kutilmoqda", cls: "bg-red-100 text-red-700" },
};

interface CalcData {
  monthlyAmount: number;
  baseMonthlyPrice: number;
  discountAmount: number;
  discountType: string | null;
  discountValue: number | null;
  pricePerLesson: number;
  lessonsPerMonth: number;
  nextMonthLessons: number;
  nextMonthAmount: number;
  debtAmount: number;
  options: { oneMonth: number; twoMonths: number; threeMonths: number };
  currentDebt: number;
  currentBalance: number;
  completedLessons: number;
  theoreticalAmount: number;
  totalPaid: number;
  joinedAt: string;
  groupName: string;
  courseName: string;
  message?: string;
}

// ─── Online Payment Modal ────────────────────────────────
function OnlinePayModal({
  studentId,
  calcData,
  onClose,
}: {
  studentId: number;
  calcData: CalcData;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState<string>(
    String(calcData.debtAmount > 0 ? calcData.debtAmount : calcData.monthlyAmount)
  );
  const [provider, setProvider] = useState<'PAYME' | 'UZUM'>('PAYME');
  const [loading, setLoading] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const currentMonth = new Date().toISOString().slice(0, 7);

  const quickAmounts = [
    { label: '1 oy', value: calcData.options.oneMonth },
    { label: '2 oy', value: calcData.options.twoMonths },
    { label: '3 oy', value: calcData.options.threeMonths },
  ];

  const pay = async () => {
    if (numAmount <= 0) {
      toast.error("Summa 0 dan katta bo'lishi kerak");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/payments/online/initiate', {
        studentId,
        amount: numAmount,
        month: currentMonth,
        provider,
      });
      const { paymentUrl } = res.data?.data || {};
      if (paymentUrl) {
        window.open(paymentUrl, '_blank');
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-t-2xl px-5 py-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <CreditCard size={18} /> Online To'lov
          </h3>
          <p className="text-indigo-200 text-xs mt-0.5">{calcData.groupName} · {calcData.courseName}</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Quick amounts */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Tez tanlash:</p>
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setAmount(String(opt.value))}
                  className={clsx(
                    'py-2 rounded-xl text-xs font-semibold border transition',
                    numAmount === opt.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                  )}
                >
                  {opt.label}<br />
                  <span className="text-[10px] opacity-80">{new Intl.NumberFormat('uz-UZ').format(opt.value)}</span>
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
                  ? 'bg-red-50 border-red-400 text-red-700'
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
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
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
                  focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">so'm</span>
            </div>
          </div>

          {/* Provider selection */}
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
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <span>{p === 'PAYME' ? '🔵' : '🟠'}</span>
                {p === 'PAYME' ? 'Payme' : 'Uzum'}
              </button>
            ))}
          </div>

          {/* Pay button */}
          <button
            onClick={pay}
            disabled={loading || numAmount <= 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600
              text-white font-semibold text-sm flex items-center justify-center gap-2
              hover:from-indigo-500 hover:to-violet-500 transition disabled:opacity-50"
          >
            {loading ? 'Yuklanmoqda...' : (
              <>
                {fmt(numAmount)} to'lash
                <ExternalLink size={14} />
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────
const StudentPaymentsPage = () => {
  const [showPayModal, setShowPayModal] = useState(false);

  const { data: profile } = useQuery('student-profile-pay', async () => {
    const r = await api.get('/auth/me');
    return r.data?.data;
  });

  const studentId = profile?.student?.id;

  const { data, isLoading } = useQuery(['student-payments', studentId], async () => {
    if (!studentId) return null;
    const r = await api.get(`/payments/student/${studentId}`);
    return r.data?.data;
  }, { enabled: !!studentId });

  const { data: calcData, isLoading: calcLoading } = useQuery<CalcData>(
    ['student-payment-calc', studentId],
    async () => {
      if (!studentId) return null;
      const r = await api.get(`/payments/student/${studentId}/calculate`);
      return r.data?.data;
    },
    { enabled: !!studentId }
  );

  const payments = data?.payments || [];
  const fees = data?.fees || [];
  const balance = data?.balance;
  const nextDueDate = data?.nextDueDate ? new Date(data.nextDueDate) : null;
  const paymentDueDay = data?.paymentDueDay;

  const daysLeft = nextDueDate
    ? Math.ceil((nextDueDate.getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-xl font-bold text-gray-900">To'lovlarim</h1>

      {/* ── To'lov eslatmasi ──────────────────────── */}
      {paymentDueDay && nextDueDate && (
        <div className={clsx(
          'rounded-2xl p-4 border flex items-start gap-3',
          daysLeft !== null && daysLeft <= 3
            ? 'bg-red-50 border-red-200'
            : 'bg-amber-50 border-amber-200'
        )}>
          <div className={clsx(
            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg',
            daysLeft !== null && daysLeft <= 3 ? 'bg-red-100' : 'bg-amber-100'
          )}>
            {daysLeft !== null && daysLeft <= 0 ? '⚠️' : '📅'}
          </div>
          <div className="flex-1">
            <p className={clsx('font-semibold text-sm',
              daysLeft !== null && daysLeft <= 3 ? 'text-red-700' : 'text-amber-800')}>
              {daysLeft !== null && daysLeft <= 0
                ? "To'lov muddati o'tdi!"
                : daysLeft !== null && daysLeft <= 3
                ? `To'lov sanasi yaqinlashdi — ${daysLeft} kun qoldi`
                : `Keyingi to'lov: ${nextDueDate.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long' })}`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Har oyning <strong>{paymentDueDay}-kuni</strong> to'lov qilishingiz kerak.
              {calcData?.monthlyAmount ? ` Oylik to'lov: ${fmt(calcData.monthlyAmount)}` : ''}
            </p>
          </div>
          <Bell size={16} className={daysLeft !== null && daysLeft <= 3 ? 'text-red-400' : 'text-amber-400'} />
        </div>
      )}

      {/* ── Balans ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card bg-gradient-to-br from-emerald-400 to-emerald-600 text-white">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet size={13} className="opacity-80" />
            <p className="text-emerald-100 text-xs">Joriy balans</p>
          </div>
          <p className="text-2xl font-bold">{fmt(Number(balance?.balance || 0))}</p>
        </div>
        <div className={clsx('card', Number(balance?.debt) > 0
          ? 'bg-gradient-to-br from-red-400 to-red-600 text-white'
          : 'bg-gradient-to-br from-gray-100 to-gray-200')}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={13} className={Number(balance?.debt) > 0 ? 'opacity-80' : 'text-gray-400'} />
            <p className={clsx('text-xs', Number(balance?.debt) > 0 ? 'text-red-100' : 'text-gray-500')}>Qarz</p>
          </div>
          <p className={clsx('text-2xl font-bold', Number(balance?.debt) > 0 ? '' : 'text-gray-600')}>
            {fmt(Number(balance?.debt || 0))}
          </p>
        </div>
      </div>

      {/* ── To'lov hisob-kitobi ───────────────────── */}
      {calcLoading ? (
        <div className="card flex items-center justify-center py-8 text-gray-400 text-sm">
          <Calculator size={20} className="mr-2 animate-pulse" /> Hisoblanmoqda...
        </div>
      ) : calcData && !calcData.message ? (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Calculator size={16} className="text-indigo-500" />
              To'lov hisob-kitobi
            </h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{calcData.groupName}</span>
          </div>

          {/* Kurs ma'lumotlari */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-indigo-50 rounded-xl p-3">
              <p className="text-xs text-indigo-500 mb-0.5">Oylik to'lov</p>
              <p className="text-base font-bold text-indigo-700">{fmt(calcData.monthlyAmount)}</p>
              {calcData.discountAmount > 0 && (
                <p className="text-[10px] text-indigo-400 mt-0.5">
                  Chegirma: -{fmt(calcData.discountAmount)}
                  {calcData.discountType === 'PERCENTAGE' && ` (${calcData.discountValue}%)`}
                </p>
              )}
            </div>
            <div className="bg-violet-50 rounded-xl p-3">
              <p className="text-xs text-violet-500 mb-0.5">1 dars narxi</p>
              <p className="text-base font-bold text-violet-700">{fmt(calcData.pricePerLesson)}</p>
              <p className="text-[10px] text-violet-400 mt-0.5">
                {calcData.lessonsPerMonth} dars/oy
              </p>
            </div>
          </div>

          {/* O'tgan darslar / qarz */}
          {calcData.debtAmount > 0 && (
            <div className="bg-red-50 rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-base">💸</div>
              <div>
                <p className="text-sm font-semibold text-red-700">Joriy qarz: {fmt(calcData.debtAmount)}</p>
                <p className="text-xs text-red-500 mt-0.5">
                  {calcData.completedLessons} ta dars o'tildi, {fmt(calcData.totalPaid)} to'langan
                </p>
              </div>
            </div>
          )}

          {/* Keyingi oy */}
          <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Keyingi oy uchun ({calcData.nextMonthLessons} dars)</p>
                <p className="text-sm font-semibold text-gray-700">{fmt(calcData.nextMonthAmount)}</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </div>

          {/* To'lov tugmasi */}
          <button
            onClick={() => setShowPayModal(true)}
            disabled={!studentId}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600
              text-white font-semibold text-sm flex items-center justify-center gap-2
              hover:from-indigo-500 hover:to-violet-500 transition disabled:opacity-50"
          >
            <CreditCard size={16} />
            Online to'lov qilish
          </button>

          <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1">
            <Info size={11} />
            To'lov miqdori istalgancha belgilanishi mumkin
          </p>
        </div>
      ) : calcData?.message ? (
        <div className="card text-center py-6 text-gray-400 text-sm">
          <div className="text-3xl mb-2">📚</div>
          {calcData.message}
        </div>
      ) : null}

      {/* ── Oylik to'lovlar ───────────────────────── */}
      {fees.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Oylik to'lov holati</h3>
          <div className="space-y-3">
            {fees.map((fee: {
              id: number; month: string; baseAmount: number;
              finalAmount: number; attendedCount: number; lessonsCount: number
            }) => {
              const amount = Number(fee.finalAmount || fee.baseAmount);
              return (
                <div key={fee.id} className="p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">
                      {new Date(fee.month).toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} />
                      {fee.attendedCount}/{fee.lessonsCount} dars
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>To'lov summasi</span>
                    <span className="font-bold text-gray-800">{fmt(amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── To'lov tarixi ─────────────────────────── */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">To'lov tarixi</h3>
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Yuklanmoqda...</div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-gray-300">
            <div className="text-4xl mb-2">💰</div>
            <p className="text-sm">To'lovlar topilmadi</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p: {
              id: number; amount: number; paymentMethod: string;
              paidAt: string; status: string; provider?: string
            }) => (
              <div key={p.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">
                    {p.provider === 'PAYME' ? '🔵' : p.provider === 'UZUM' ? '🟠' : '💳'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-600">{fmt(Number(p.amount))}</p>
                    <p className="text-xs text-gray-400">
                      {METHOD_LABELS[p.paymentMethod] || p.paymentMethod}
                      {p.provider ? ` · ${p.provider}` : ''}
                      {p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString('uz-UZ')}` : ''}
                    </p>
                  </div>
                </div>
                <span className={clsx('text-xs px-2 py-1 rounded-full font-medium',
                  STATUS_MAP[p.status]?.cls || STATUS_MAP.PENDING.cls)}>
                  {STATUS_MAP[p.status]?.label || p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Online Payment Modal ───────────────────── */}
      {showPayModal && studentId && calcData && (
        <OnlinePayModal
          studentId={studentId}
          calcData={calcData}
          onClose={() => setShowPayModal(false)}
        />
      )}
    </div>
  );
};

export default StudentPaymentsPage;
