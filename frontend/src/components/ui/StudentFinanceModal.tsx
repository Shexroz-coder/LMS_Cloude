import { useState } from 'react';
import { Wallet, HandCoins, Pencil, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Modal from './Modal';

interface Props {
  studentId: number;
  studentName?: string;
  debt?: number;
  balance?: number;
  onClose: () => void;
  onSaved?: () => void;
}

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v || 0));
const METHODS = [
  { v: 'CASH', l: 'Naqd' },
  { v: 'CARD', l: 'Karta' },
  { v: 'TRANSFER', l: "O'tkazma" },
];

/**
 * Sodda moliya paneli — bir o'quvchi uchun:
 *  1) To'lov qabul qilish
 *  2) Qarzni qo'lda o'rnatish (tuzatish)
 *  3) Individual oylik narx (birinchi oy avtomatik pro-rata hisoblanadi)
 * Barchasi mavjud endpointlar ustida — sodda va nazorat qo'lда.
 */
const StudentFinanceModal = ({ studentId, studentName, debt = 0, balance = 0, onClose, onSaved }: Props) => {
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [manualDebt, setManualDebt] = useState(String(Math.round(debt || 0)));
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const done = (msg: string) => { toast.success(msg); onSaved?.(); };

  const addPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast.error('Summani kiriting'); return; }
    setLoading('pay');
    try {
      await api.post('/payments', { studentId, amount: amt, paymentMethod: payMethod });
      setPayAmount('');
      done("To'lov qabul qilindi");
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Xato'); }
    finally { setLoading(null); }
  };

  const saveDebt = async () => {
    const d = parseFloat(manualDebt);
    if (isNaN(d) || d < 0) { toast.error("Qarz 0 yoki katta bo'lsin"); return; }
    setLoading('debt');
    try {
      await api.patch(`/payments/student/${studentId}/adjust-debt`, { debt: Math.round(d), note: "Qo'lda tuzatildi" });
      done('Qarz yangilandi');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Xato'); }
    finally { setLoading(null); }
  };

  const savePrice = async () => {
    const p = parseFloat(monthlyPrice);
    if (!p || p <= 0) { toast.error('Narxni kiriting'); return; }
    setLoading('price');
    try {
      await api.patch(`/payments/student/${studentId}/billing-config`, { monthlyAmount: Math.round(p) });
      setMonthlyPrice('');
      done("Oylik narx o'rnatildi");
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Xato'); }
    finally { setLoading(null); }
  };

  return (
    <Modal title={<span className="flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /> Moliya</span>} onClose={onClose} maxWidth="max-w-md">
      <div className="px-6 py-4 space-y-5">
        {studentName && <p className="text-sm text-gray-500 dark:text-gray-400 -mt-1"><b className="text-gray-800 dark:text-gray-100">{studentName}</b></p>}

        {/* Joriy holat */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3">
            <div className="text-xs text-red-500">Joriy qarz</div>
            <div className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">{fmt(debt)} <span className="text-xs font-normal">so'm</span></div>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3">
            <div className="text-xs text-emerald-600">Balans (avans)</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(balance)} <span className="text-xs font-normal">so'm</span></div>
          </div>
        </div>

        {/* 1) To'lov qabul qilish */}
        <div className="space-y-2">
          <label className="label flex items-center gap-1.5"><HandCoins className="w-4 h-4 text-emerald-500" /> To'lov qabul qilish</label>
          <div className="flex gap-2">
            <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Summa (so'm)" className="input flex-1" />
            <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="input w-28">
              {METHODS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
          <button onClick={addPayment} disabled={loading === 'pay'} className="btn-primary w-full">
            {loading === 'pay' ? '...' : "To'lovni saqlash"}
          </button>
        </div>

        <hr className="border-gray-100 dark:border-gray-700" />

        {/* 2) Qarzni qo'lda o'rnatish */}
        <div className="space-y-2">
          <label className="label flex items-center gap-1.5"><Pencil className="w-4 h-4 text-amber-500" /> Qarzni qo'lda o'rnatish</label>
          <div className="flex gap-2">
            <input type="number" value={manualDebt} onChange={e => setManualDebt(e.target.value)} placeholder="Qarz summasi" className="input flex-1" />
            <button onClick={saveDebt} disabled={loading === 'debt'} className="btn-secondary whitespace-nowrap">
              {loading === 'debt' ? '...' : 'Saqlash'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">Tizim hisobини qo'lда to'g'rilash uchun (aniq summani yozing).</p>
        </div>

        <hr className="border-gray-100 dark:border-gray-700" />

        {/* 3) Individual oylik narx */}
        <div className="space-y-2">
          <label className="label flex items-center gap-1.5"><Settings2 className="w-4 h-4 text-indigo-500" /> Individual oylik narx</label>
          <div className="flex gap-2">
            <input type="number" value={monthlyPrice} onChange={e => setMonthlyPrice(e.target.value)} placeholder="Kelishilgan oylik summa" className="input flex-1" />
            <button onClick={savePrice} disabled={loading === 'price'} className="btn-secondary whitespace-nowrap">
              {loading === 'price' ? '...' : "O'rnatish"}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">Birinchi oy kelgan kunдан oy oxиригача avtomatik hisoblanadi (pro-rata).</p>
        </div>
      </div>
    </Modal>
  );
};

export default StudentFinanceModal;
