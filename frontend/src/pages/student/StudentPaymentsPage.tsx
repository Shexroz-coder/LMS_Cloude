import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  Bell, ExternalLink, CreditCard, Clock, Calculator,
  TrendingDown, Wallet, ChevronRight, Info, CheckCircle
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

// ─── Online Payment Modal ─────────────────────────────────────────────────────
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
    { label: '1 oy',  value: calcData.options.oneMonth },
    { label: '2 oy',  value: calcData.options.twoMonths },
    { label: '3 oy',  value: calcData.options.threeMonths },
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-black px-5 py-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <CreditCard size={18} /> Online To'lov
          </h3>
          <p className="text-red-300 text-xs mt-0.5">{calcData.groupName} · {calcData.courseName}</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Quick amount buttons */}
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
                      ? 'bg-red-600 text-white border-red-600'
                      : 'border-gray-200 text-gray-700 hover:border-red-300 hover:bg-red-50'
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

          {/* Custom amount input */}
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
                  focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">so'm</span>
            </div>
          </div>

          {/* Provider selection */}
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

          {/* Pay button */}
          <button
            onClick={pay}
            disabled={loading || numAmount <= 0}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-black
              text-white font-bold text-sm flex items-center justify-center gap-2
              hover:from-red-500 hover:to-gray-900 transition disabled:opacity-50"
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

          {/* Cancel */}
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
const StudentPaymentsPage = () => {
  const [showPayModal, setShowPayModal] = useState(false);

  const { data: profile } = useQuery('student-profile-pay', async () => {
    const r = await api.get('/auth/me');
    return r.data?.data;
  });

  const studentId = profile?.student?.id;

  const { data, isLoading } = useQuery(
    ['student-payments', studentId],
    async () => {
      const r = await api.get(`/payments/student/${studentId}`);
      return r.data?.data;
    },
    { enabled: !!studentId }
  );

  const { data: calcData, isLoading: calcLoading } = useQuery<CalcData>(
    ['student-payment-calc', studentId],
    async () => {
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

  const hasDebt = Number(balance?.debt) > 0;
  const hasBalance = Number(balance?.balance) > 0;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-black p-5 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Wallet size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">To'lovlarim</h1>
            <p className="text-red-200 text-xs">To'lov holati va tarixi</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-red-200 text-xs mb-1 flex items-center gap-1">
              <Wallet size={11} /> Balans
            </p>
            <p className="text-xl font-bold">{fmt(Number(balance?.balance || 0))}</p>
          </div>
          <div className={clsx('rounded-xl p-3', hasDebt ? 'bg-white/10' : 'bg-white/10')}>
            <p className="text-red-200 text-xs mb-1 flex items-center gap-1">
              <TrendingDown size={11} /> Qarz
            </p>
            <p className={clsx('text-xl font-bold', hasDebt ? 'text-red-200' : 'text-white/60')}>
              {fmt(Number(balance?.debt || 0))}
            </p>
          </div>
        </div>
      </div>

      {/* Payment due alert */}
      {paymentDueDay && nextDueDate && (
        <div className={clsx(
          'rounded-2xl p-4 border flex items-start gap-3',
          daysLeft !== null && daysLeft <= 3
            ? 'bg-red-50 border-red-200'
            : 'bg-amber-50 border-amber-200'
        )}>
          <div className={clsx(
            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xl',
            daysLeft !== null && daysLeft <= 3 ? 'bg-red-100' : 'bg-amber-100'
          )}>
            {daysLeft !== null && daysLeft <= 0 ? '⚠️' : '📅'}
          </div>
          <div className="flex-1">
            <p className={clsx('font-bold text-sm',
              daysLeft !== null && daysLeft <= 3 ? 'text-red-700' : 'text-amber-800')}>
              {daysLeft !== null && daysLeft <= 0
                ? "To'lov muddati o'tdi!"
                : daysLeft !== null && daysLeft <= 3
                ? `To'lov sanasi yaqinlashdi — ${daysLeft} kun qoldi`
                : `Keyingi to'lov: ${nextDueDate.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long' })}`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Har oyning <strong>{paymentDueDay}-kuni</strong> to'lov qilishingiz kerak.
              {calcData?.monthlyAmount ? ` · Oylik: ${fmt(calcData.monthlyAmount)}` : ''}
            </p>
          </div>
          <Bell size={16} className={daysLeft !== null && daysLeft <= 3 ? 'text-red-400' : 'text-amber-400'} />
        </div>
      )}

      {/* Payment calculation */}
      {calcLoading ? (
        <div className="card flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
          <Calculator size={18} className="animate-pulse text-red-400" />
          Hisoblanmoqda...
        </div>
      ) : calcData && !calcData.message ? (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Calculator size={15} className="text-red-500" />
              To'lov hisob-kitobi
            </h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">
              {calcData.groupName}
            </span>
          </div>

          {/* Monthly / per lesson */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 rounded-xl p-3 border border-red-100">
              <p className="text-xs text-red-500 mb-1 font-medium">Oylik to'lov</p>
              <p className="text-base font-bold text-red-700">{fmt(calcData.monthlyAmount)}</p>
              {calcData.discountAmount > 0 && (
                <p className="text-[10px] text-red-400 mt-0.5">
                  Chegirma: -{fmt(calcData.discountAmount)}
                  {calcData.discountType === 'PERCENTAGE' && ` (${calcData.discountValue}%)`}
                </p>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-500 mb-1 font-medium">1 dars narxi</p>
              <p className="text-base font-bold text-gray-700">{fmt(calcData.pricePerLesson)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {calcData.lessonsPerMonth} dars/oy
              </p>
            </div>
          </div>

          {/* Debt alert */}
          {calcData.debtAmount > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-lg">💸</div>
              <div>
                <p className="text-sm font-bold text-red-700">Joriy qarz: {fmt(calcData.debtAmount)}</p>
                <p className="text-xs text-red-500 mt-0.5">
                  {calcData.completedLessons} ta dars o'tildi · {fmt(calcData.totalPaid)} to'langan
                </p>
              </div>
            </div>
          )}

          {/* Next month */}
          <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Keyingi oy uchun ({calcData.nextMonthLessons} dars)</p>
                <p className="text-sm font-bold text-gray-700">{fmt(calcData.nextMonthAmount)}</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </div>

          {/* Pay button */}
          <button
            onClick={() => setShowPayModal(true)}
            disabled={!studentId}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-black
              text-white font-bold text-sm flex items-center justify-center gap-2
              hover:from-red-500 hover:to-gray-900 transition disabled:opacity-50"
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
        <div className="card text-center py-8 text-gray-400 text-sm">
          <div className="text-4xl mb-2">📚</div>
          <p>{calcData.message}</p>
        </div>
      ) : null}

      {/* Monthly fees */}
      {fees.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock size={15} className="text-red-500" />
            Oylik to'lov holati
          </h3>
          <div className="space-y-3">
            {fees.map((fee: {
              id: number; month: string; baseAmount: number;
              finalAmount: number; attendedCount: number; lessonsCount: number
            }) => {
              const feeAmount = Number(fee.finalAmount || fee.baseAmount);
              return (
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
                    <span className="font-bold text-gray-800">{fmt(feeAmount)}</span>
                  </div>
                  {/* Attendance bar */}
                  <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400"
                      style={{ width: `${fee.lessonsCount > 0 ? (fee.attendedCount / fee.lessonsCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="card">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <CheckCircle size={15} className="text-emerald-500" />
          To'lov tarixi
        </h3>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-2" />
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
              paidAt: string; status: string; provider?: string
            }) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition border border-transparent hover:border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg flex-shrink-0">
                    {p.provider === 'PAYME' ? '🔵' : p.provider === 'UZUM' ? '🟠' : '💳'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-600">{fmt(Number(p.amount))}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {METHOD_LABELS[p.paymentMethod] || p.paymentMethod}
                      {p.provider ? ` · ${p.provider}` : ''}
                      {p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })}` : ''}
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

      {/* Online pay modal */}
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
