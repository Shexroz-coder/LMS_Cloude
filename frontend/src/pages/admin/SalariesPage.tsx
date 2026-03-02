import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TeacherSalary {
  id: number;
  user: { fullName: string; phone: string; avatarUrl?: string };
  salaryType: 'PERCENTAGE_FROM_PAYMENT' | 'PER_LESSON_HOUR';
  salaryValue: number;
  _count: { groups: number };
  salaries: SalaryRecord[];
}

interface SalaryRecord {
  id: number;
  month: string;
  amount: number;
  isPaid: boolean;
  paidAt?: string;
  note?: string;
}

const formatMoney = (v: number) =>
  new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";

function getMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })
    });
  }
  return months;
}

// ─── Pay Modal ────────────────────────────────────────────────────────────────
function PayModal({
  teacher,
  month,
  onClose,
  onPay,
  loading,
}: {
  teacher: TeacherSalary;
  month: string;
  onClose: () => void;
  onPay: (data: { teacherId: number; month: string; amount: number; note: string }) => void;
  loading: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    onPay({ teacherId: teacher.id, month, amount: parseFloat(amount), note });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Oylik to'lash</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center font-bold text-indigo-700">
              {teacher.user.fullName.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{teacher.user.fullName}</p>
              <p className="text-xs text-gray-500">
                {teacher.salaryType === 'PERCENTAGE_FROM_PAYMENT' ? `${teacher.salaryValue}% to'lovlardan` : `${formatMoney(teacher.salaryValue)}/soat`}
              </p>
            </div>
          </div>

          <div>
            <label className="label">Oylik summasi (so'm) *</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="input"
              placeholder="1500000"
              min="0"
              required
            />
          </div>

          <div>
            <label className="label">Izoh</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              className="input"
              placeholder="Ixtiyoriy izoh..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost">
              Bekor qilish
            </button>
            <button type="submit" disabled={loading} className="flex-1 btn-primary">
              {loading ? 'Saqlanmoqda...' : "To'lash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SalariesPage() {
  const qc = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payTarget, setPayTarget] = useState<TeacherSalary | null>(null);
  const months = getMonthOptions();

  // Fetch all teachers with salary info
  const { data: teachers = [], isLoading } = useQuery<TeacherSalary[]>(
    ['teachers-salaries', selectedMonth],
    async () => {
      const r = await api.get(`/teachers?limit=100`);
      const list = r.data?.data?.teachers || r.data?.data || [];
      // For each teacher fetch salary for selected month
      return Promise.all(
        list.map(async (t: TeacherSalary) => {
          try {
            const sr = await api.get(`/teachers/${t.id}?month=${selectedMonth}`);
            const detail = sr.data?.data || t;
            return detail;
          } catch {
            return t;
          }
        })
      );
    }
  );

  // Pay salary mutation
  const payMutation = useMutation(
    (data: { teacherId: number; month: string; amount: number; note: string }) =>
      api.post('/salaries/pay', data),
    {
      onSuccess: () => {
        qc.invalidateQueries(['teachers-salaries']);
        setPayTarget(null);
      }
    }
  );

  const totalPaid = teachers.reduce((s, t) => {
    const monthSalary = t.salaries?.find(sal => sal.month.startsWith(selectedMonth));
    return s + (monthSalary?.isPaid ? Number(monthSalary.amount) : 0);
  }, 0);

  const totalPending = teachers.reduce((s, t) => {
    const monthSalary = t.salaries?.find(sal => sal.month.startsWith(selectedMonth));
    return s + (!monthSalary?.isPaid && monthSalary ? Number(monthSalary.amount) : 0);
  }, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ustoz Oyliqlari</h1>
          <p className="text-sm text-gray-500 mt-0.5">Oylik hisob-kitob va to'lovlar</p>
        </div>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {months.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-xl">✅</div>
          <div>
            <p className="text-xs text-gray-400">To'langan</p>
            <p className="text-lg font-bold text-emerald-600">{formatMoney(totalPaid)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-xl">⏳</div>
          <div>
            <p className="text-xs text-gray-400">Kutilmoqda</p>
            <p className="text-lg font-bold text-amber-600">{formatMoney(totalPending)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-xl">👨‍🏫</div>
          <div>
            <p className="text-xs text-gray-400">Ustozlar soni</p>
            <p className="text-lg font-bold text-indigo-600">{teachers.length} ta</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Ustoz</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Ish haqi turi</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Oylik</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Holat</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Amal</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    Ustozlar topilmadi
                  </td>
                </tr>
              ) : (
                teachers.map(teacher => {
                  const monthSalary = teacher.salaries?.find(
                    sal => sal.month && sal.month.startsWith(selectedMonth)
                  );
                  const isPaid = monthSalary?.isPaid ?? false;
                  const salaryAmount = monthSalary?.amount;

                  return (
                    <tr key={teacher.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      {/* Teacher */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {teacher.user.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{teacher.user.fullName}</p>
                            <p className="text-xs text-gray-400">{teacher.user.phone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Salary Type */}
                      <td className="px-5 py-4">
                        <div className="text-sm">
                          {teacher.salaryType === 'PERCENTAGE_FROM_PAYMENT' ? (
                            <span className="text-indigo-600 font-medium">{teacher.salaryValue}% </span>
                          ) : (
                            <span className="text-violet-600 font-medium">{formatMoney(teacher.salaryValue)}/soat </span>
                          )}
                          <span className="text-gray-400 text-xs">
                            {teacher.salaryType === 'PERCENTAGE_FROM_PAYMENT' ? "to'lovlardan" : "soatbay"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{teacher._count?.groups ?? 0} ta guruh</p>
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-4 text-right">
                        {salaryAmount !== undefined ? (
                          <span className="font-semibold text-gray-800">{formatMoney(Number(salaryAmount))}</span>
                        ) : (
                          <span className="text-gray-300 text-sm italic">hisoblanmagan</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 text-center">
                        <span className={clsx(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {isPaid ? "✅ To'langan" : "⏳ Kutilmoqda"}
                        </span>
                        {monthSalary?.paidAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(monthSalary.paidAt).toLocaleDateString('uz-UZ')}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-center">
                        {!isPaid ? (
                          <button
                            onClick={() => setPayTarget(teacher)}
                            className="btn-primary text-xs py-1.5 px-3"
                          >
                            To'lash
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info note */}
      <div className="card bg-blue-50 border border-blue-100">
        <p className="text-sm text-blue-700">
          💡 <strong>Foiz tizimi:</strong> PERCENTAGE_FROM_PAYMENT — ustozning guruhlaridagi o'quvchilar to'laganidan foiz oladi.
          PER_LESSON_HOUR — soatiga belgilangan narx orqali hisob-kitob qilinadi.
        </p>
      </div>

      {/* Pay Modal */}
      {payTarget && (
        <PayModal
          teacher={payTarget}
          month={selectedMonth}
          onClose={() => setPayTarget(null)}
          onPay={(data) => payMutation.mutate(data)}
          loading={payMutation.isLoading}
        />
      )}
    </div>
  );
}
