import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Users, TrendingUp, Wallet, ChevronDown, ChevronRight, CheckCircle, Clock } from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";

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

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentCalc {
  id: number;
  fullName: string;
  monthlyPrice: number;
  discountType: string | null;
  discountValue: number | null;
  expectedPayment: number;
}

interface GroupCalc {
  id: number;
  name: string;
  courseName: string;
  lessonsPerMonth: number;
  studentCount: number;
  groupRevenue: number;
  students: StudentCalc[];
}

interface TeacherCalc {
  teacherId: number;
  teacherName: string;
  teacherPhone: string;
  salaryType: string;
  salaryValue: number;
  month: string;
  groups: GroupCalc[];
  totalStudents: number;
  totalRevenue: number;
  calculatedSalary: number;
  totalHours: number;
  paidSalary: number;
  isPaid: boolean;
  paidAt: string | null;
  salaryRecordId: number | null;
}

interface CalcSummary {
  totalTeachers: number;
  totalCalculated: number;
  totalRevenue: number;
  totalPaid: number;
  totalPending: number;
}

// ─── Pay Modal ────────────────────────────────────────────────────────────────
function PayModal({
  teacher,
  month,
  onClose,
  onPay,
  loading,
}: {
  teacher: TeacherCalc;
  month: string;
  onClose: () => void;
  onPay: (data: { teacherId: number; month: string; amount: number; note: string }) => void;
  loading: boolean;
}) {
  const [amount, setAmount] = useState(String(teacher.calculatedSalary));
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-black px-5 py-4 text-white">
          <h2 className="font-bold text-base">💳 Oylik to'lash</h2>
          <p className="text-red-200 text-xs mt-0.5">{teacher.teacherName}</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Teacher info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {teacher.teacherName.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{teacher.teacherName}</p>
              <p className="text-xs text-gray-500">
                {teacher.salaryType === 'PERCENTAGE_FROM_PAYMENT'
                  ? `${teacher.salaryValue}% — to'lovlardan`
                  : `${fmt(teacher.salaryValue)}/soat`}
              </p>
            </div>
          </div>

          {/* Calculated amount */}
          <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl p-3">
            <div>
              <p className="text-xs text-gray-500">Hisoblangan oylik</p>
              <p className="font-bold text-red-700">{fmt(teacher.calculatedSalary)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Daromad asosi</p>
              <p className="text-sm font-semibold text-gray-700">{fmt(teacher.totalRevenue)}</p>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              To'lov summasi (so'm) *
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="0"
              min="0"
            />
            {amount && parseFloat(amount) > 0 && (
              <p className="text-center text-xs text-gray-400 mt-1">{fmt(parseFloat(amount))}</p>
            )}
          </div>

          {/* Quick presets */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAmount(String(teacher.calculatedSalary))}
              className="py-2 rounded-xl text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50 transition"
            >
              100%: {fmt(teacher.calculatedSalary)}
            </button>
            <button
              onClick={() => setAmount(String(Math.round(teacher.calculatedSalary * 0.5)))}
              className="py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
            >
              50%: {fmt(Math.round(teacher.calculatedSalary * 0.5))}
            </button>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Izoh</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              placeholder="Ixtiyoriy izoh..."
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium"
            >
              Bekor
            </button>
            <button
              onClick={() => {
                const num = parseFloat(amount);
                if (!num || num <= 0) { toast.error('Summa kiriting'); return; }
                onPay({ teacherId: teacher.teacherId, month, amount: num, note });
              }}
              disabled={loading}
              className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-black text-white font-bold rounded-xl text-sm transition disabled:opacity-50"
            >
              {loading ? 'Saqlanmoqda...' : "✅ To'lash"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Teacher Detail Row (expandable) ─────────────────────────────────────────
function TeacherRow({ teacher, onPay }: { teacher: TeacherCalc; onPay: (t: TeacherCalc) => void }) {
  const [expanded, setExpanded] = useState(false);
  const unpaidAmount = teacher.calculatedSalary - teacher.paidSalary;

  return (
    <>
      <tr
        className={clsx(
          'border-b border-gray-50 transition cursor-pointer',
          teacher.isPaid ? 'bg-emerald-50/30' : 'hover:bg-gray-50'
        )}
        onClick={() => setExpanded(p => !p)}
      >
        {/* Teacher */}
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0',
              teacher.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            )}>
              {teacher.teacherName.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{teacher.teacherName}</p>
              <p className="text-xs text-gray-400">{teacher.teacherPhone}</p>
            </div>
          </div>
        </td>

        {/* Salary type */}
        <td className="px-5 py-4">
          <div className="text-sm">
            {teacher.salaryType === 'PERCENTAGE_FROM_PAYMENT' ? (
              <span className="text-red-600 font-semibold">{teacher.salaryValue}%</span>
            ) : (
              <span className="text-gray-700 font-semibold">{fmt(teacher.salaryValue)}/soat</span>
            )}
            <span className="text-gray-400 text-xs ml-1">
              {teacher.salaryType === 'PERCENTAGE_FROM_PAYMENT' ? "to'lovlardan" : 'soatbay'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {teacher.groups.length} guruh · {teacher.totalStudents} o'quvchi
          </p>
        </td>

        {/* Revenue */}
        <td className="px-5 py-4 text-right">
          <p className="text-sm font-semibold text-gray-700">{fmt(teacher.totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-0.5">kutilayotgan</p>
        </td>

        {/* Calculated */}
        <td className="px-5 py-4 text-right">
          <p className="text-base font-bold text-red-600">{fmt(teacher.calculatedSalary)}</p>
          {teacher.paidSalary > 0 && teacher.paidSalary < teacher.calculatedSalary && (
            <p className="text-xs text-amber-600 mt-0.5">Qoldi: {fmt(unpaidAmount)}</p>
          )}
        </td>

        {/* Status */}
        <td className="px-5 py-4 text-center">
          <span className={clsx(
            'px-2.5 py-1 rounded-full text-xs font-semibold',
            teacher.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          )}>
            {teacher.isPaid ? "✅ To'langan" : "⏳ Kutilmoqda"}
          </span>
          {teacher.paidAt && (
            <p className="text-xs text-gray-400 mt-1">
              {new Date(teacher.paidAt).toLocaleDateString('uz-UZ')}
            </p>
          )}
        </td>

        {/* Actions */}
        <td className="px-5 py-4">
          <div className="flex items-center justify-center gap-2">
            {!teacher.isPaid && (
              <button
                onClick={e => { e.stopPropagation(); onPay(teacher); }}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition"
              >
                To'lash
              </button>
            )}
            {expanded
              ? <ChevronDown size={14} className="text-gray-400" />
              : <ChevronRight size={14} className="text-gray-400" />}
          </div>
        </td>
      </tr>

      {/* Expanded: per-group breakdown */}
      {expanded && (
        <tr className="bg-gray-50/80 border-b border-gray-100">
          <td colSpan={6} className="px-6 py-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Guruhlar bo'yicha tafsilot — {teacher.teacherName}
              </p>
              {teacher.groups.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Faol guruh yo'q</p>
              ) : (
                teacher.groups.map(g => (
                  <div key={g.id} className="bg-white rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-semibold text-gray-800 text-sm">{g.name}</span>
                        <span className="text-gray-400 text-xs ml-2">{g.courseName}</span>
                        <span className="text-gray-300 text-xs ml-2">·</span>
                        <span className="text-gray-400 text-xs ml-2">{g.lessonsPerMonth} dars/oy</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">{fmt(g.groupRevenue)}</p>
                        <p className="text-xs text-gray-400">{g.studentCount} o'quvchi</p>
                      </div>
                    </div>
                    {g.students.length > 0 && (
                      <div className="space-y-1 border-t border-gray-50 pt-2">
                        {g.students.map(s => (
                          <div key={s.id} className="flex items-center justify-between text-xs py-1">
                            <span className="text-gray-600">{s.fullName}</span>
                            <div className="flex items-center gap-3">
                              {s.discountType && (
                                <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                  {s.discountType === 'PERCENTAGE'
                                    ? `-${s.discountValue}%`
                                    : `-${fmt(s.discountValue || 0)}`}
                                </span>
                              )}
                              <span className="font-semibold text-gray-700">{fmt(s.expectedPayment)}</span>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-xs py-1 border-t border-gray-100 mt-1">
                          <span className="font-semibold text-gray-600">Guruh jami</span>
                          <span className="font-bold text-gray-800">{fmt(g.groupRevenue)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Summary for teacher */}
              <div className="bg-red-50 rounded-xl p-3 flex items-center justify-between border border-red-100">
                <div>
                  <p className="text-xs text-gray-500">Jami kutilayotgan daromad</p>
                  <p className="font-bold text-gray-800">{fmt(teacher.totalRevenue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {teacher.salaryType === 'PERCENTAGE_FROM_PAYMENT'
                      ? `${teacher.salaryValue}% foiz`
                      : `${teacher.totalHours.toFixed(1)} soat × ${fmt(teacher.salaryValue)}`}
                  </p>
                  <p className="font-bold text-red-700 text-lg">{fmt(teacher.calculatedSalary)}</p>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SalariesPage() {
  const qc = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payTarget, setPayTarget] = useState<TeacherCalc | null>(null);
  const months = getMonthOptions();

  const { data: calcData, isLoading } = useQuery<{ teachers: TeacherCalc[]; summary: CalcSummary }>(
    ['salaries-calculate', selectedMonth],
    () => api.get(`/salaries/calculate?month=${selectedMonth}`).then(r => r.data?.data),
    { refetchInterval: 30_000 }
  );

  const payMutation = useMutation(
    (data: { teacherId: number; month: string; amount: number; note: string }) =>
      api.post('/salaries/pay', data),
    {
      onSuccess: () => {
        qc.invalidateQueries(['salaries-calculate']);
        setPayTarget(null);
        toast.success("Oylik to'landi! ✅");
      },
      onError: () => toast.error('Xato yuz berdi'),
    }
  );

  const teachers = calcData?.teachers || [];
  const summary = calcData?.summary;
  const monthLabel = months.find(m => m.value === selectedMonth)?.label || selectedMonth;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-black p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Ustoz Oyliqlari</h1>
            <p className="text-red-200 text-sm mt-0.5">Live hisob-kitob · {monthLabel}</p>
          </div>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="text-sm bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/50 flex-shrink-0"
          >
            {months.map(m => (
              <option key={m.value} value={m.value} className="text-gray-800">{m.label}</option>
            ))}
          </select>
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Kutilayotgan daromad', value: summary.totalRevenue,    icon: TrendingUp,  color: 'text-emerald-200' },
              { label: 'Hisoblangan oylik',    value: summary.totalCalculated, icon: Wallet,      color: 'text-amber-200'   },
              { label: "To'langan",            value: summary.totalPaid,       icon: CheckCircle, color: 'text-emerald-300' },
              { label: 'Kutilmoqda',           value: summary.totalPending,    icon: Clock,       color: 'text-red-300'     },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon size={12} className={s.color} />
                  <p className="text-white/70 text-xs">{s.label}</p>
                </div>
                <p className="text-white font-bold text-sm">{fmt(s.value)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-sm text-blue-700">
        <Users size={16} className="flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-0.5">Live hisob-kitob qanday ishlaydi?</p>
          <p className="text-xs text-blue-600">
            Har bir ustoz uchun uning guruhlaridagi <strong>faol o'quvchilar</strong> kutilayotgan oylik
            to'lovlari hisoblanadi (chegirmalar inobatga olinadi), keyin ustoz foizi yoki soatbay narxiga ko'paytiriladi.
            Qatorni bosib guruhlar bo'yicha tafsilotni ko'ring.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Ustozlar oyliqlari — {monthLabel}</h3>
          <span className="text-xs text-gray-400">{teachers.length} ta ustoz</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Ustoz</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Ish haqi turi</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Daromad asosi</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Hisoblangan</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Holat</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Amal</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <div className="animate-spin w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-2" />
                    Hisoblanmoqda...
                  </td>
                </tr>
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">Ustozlar topilmadi</td>
                </tr>
              ) : (
                teachers.map(teacher => (
                  <TeacherRow key={teacher.teacherId} teacher={teacher} onPay={setPayTarget} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {summary && teachers.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-red-50 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-gray-600">
              Jami <strong>{summary.totalTeachers}</strong> ta ustoz
            </span>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-gray-400">Daromad asosi</p>
                <p className="font-bold text-gray-700">{fmt(summary.totalRevenue)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Jami oylik</p>
                <p className="font-bold text-red-700">{fmt(summary.totalCalculated)}</p>
              </div>
              {summary.totalPaid > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">To'langan</p>
                  <p className="font-bold text-emerald-600">{fmt(summary.totalPaid)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pay Modal */}
      {payTarget && (
        <PayModal
          teacher={payTarget}
          month={selectedMonth}
          onClose={() => setPayTarget(null)}
          onPay={data => payMutation.mutate(data)}
          loading={payMutation.isLoading}
        />
      )}
    </div>
  );
}
