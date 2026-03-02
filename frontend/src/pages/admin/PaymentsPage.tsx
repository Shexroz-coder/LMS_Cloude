import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  CreditCard, Plus, Search, TrendingUp, AlertCircle, X,
  ChevronLeft, ChevronRight, DollarSign, Banknote, Smartphone, Building2,
  Users, TrendingDown, Calculator, Percent
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import api from '../../api/axios';
import { clsx } from 'clsx';

interface Payment {
  id: number;
  amount: number;
  paymentMethod: string;
  month: string;
  paidAt: string;
  note?: string;
  student: { user: { fullName: string; phone: string } };
}
interface Summary {
  income: number; expenses: number; netProfit: number; totalDebt: number;
  byMethod: { method: string; total: number; count: number }[];
}

const formatMoney = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";
const methodLabel: Record<string, string> = { CASH: 'Naqd', CARD: 'Karta', TRANSFER: "O'tkazma", ONLINE: 'Online' };
const methodIcon: Record<string, React.ElementType> = { CASH: Banknote, CARD: CreditCard, TRANSFER: Building2, ONLINE: Smartphone };
const methodColor: Record<string, string> = { CASH: 'text-emerald-600 bg-emerald-50', CARD: 'text-blue-600 bg-blue-50', TRANSFER: 'text-violet-600 bg-violet-50', ONLINE: 'text-orange-600 bg-orange-50' };

interface StudentObligation {
  studentId: number;
  fullName: string;
  phone: string;
  groupId: number;
  groupName: string;
  courseName: string;
  joinedAt: string;
  baseMonthlyPrice: number;
  discountAmount: number;
  discountType: string | null;
  monthlyAmount: number;
  lessonsPerMonth: number;
  pricePerLesson: number;
  currentDebt: number;
  currentBalance: number;
  netObligation: number;
  hasDebt: boolean;
  hasSurplus: boolean;
}

const PaymentsPage = () => {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [currentMonth, setCurrentMonth] = useState(''); // Bo'sh = barcha to'lovlar
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'payments' | 'obligations'>('payments');
  const [obligSearch, setObligSearch] = useState('');

  const { data, isLoading } = useQuery(
    ['payments', page, currentMonth],
    () => api.get('/payments', {
      params: { page, limit: 20, ...(currentMonth ? { month: currentMonth } : {}) }
    }).then(r => r.data),
    { keepPreviousData: true }
  );

  const { data: summary } = useQuery<Summary>(
    ['payment-summary', currentMonth],
    () => api.get('/payments/summary', {
      params: currentMonth ? { month: currentMonth } : {}
    }).then(r => r.data.data).catch(() => null)
  );

  const { data: obligations, isLoading: obligLoading } = useQuery<StudentObligation[]>(
    ['student-obligations'],
    () => api.get('/payments/student-obligations').then(r => r.data?.data || []).catch(() => []),
    { enabled: activeTab === 'obligations' }
  );

  const filteredObligations = (obligations || []).filter(o =>
    !obligSearch ||
    o.fullName.toLowerCase().includes(obligSearch.toLowerCase()) ||
    o.phone.includes(obligSearch) ||
    o.groupName.toLowerCase().includes(obligSearch.toLowerCase())
  );

  const totalDebtAmount = filteredObligations.reduce((sum, o) => sum + o.currentDebt, 0);
  const studentsWithDebt = filteredObligations.filter(o => o.hasDebt).length;

  const rawData = data?.data;
  const payments: Payment[] = Array.isArray(rawData) ? rawData : (rawData?.payments || []);
  const pagination = data?.meta || { total: 0, totalPages: 1 };
  const totalAmount: number = rawData?.totalAmount || 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-violet-600" /> To'lovlar
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Jami {pagination.total} ta to'lov{currentMonth ? ` · ${currentMonth}` : ' · barcha vaqt'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'payments' && (
            <div className="flex items-center gap-1.5">
              <input
                type="month"
                value={currentMonth}
                onChange={e => { setCurrentMonth(e.target.value); setPage(1); }}
                className="input py-2 text-sm"
                placeholder="Oy tanlang"
              />
              {currentMonth && (
                <button
                  onClick={() => { setCurrentMonth(''); setPage(1); }}
                  className="px-2 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 whitespace-nowrap"
                  title="Filtrni tozalash — barcha to'lovlar"
                >
                  ✕ Barchasi
                </button>
              )}
            </div>
          )}
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1.5 text-sm whitespace-nowrap">
            <Plus className="w-4 h-4" /> To'lov qabul
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {[
          { key: 'payments', label: "To'lovlar tarixi", icon: CreditCard },
          { key: 'obligations', label: "O'quvchilar qarzi", icon: Users },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'payments' | 'obligations')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition',
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Payments Tab Content */}
      {activeTab === 'payments' && <>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: 'Oylik tushum', value: summary.income, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Xarajatlar', value: summary.expenses, icon: DollarSign, color: 'text-red-500', bg: 'bg-red-50' },
            { label: 'Sof foyda', value: summary.netProfit, icon: CreditCard, color: 'text-primary-600', bg: 'bg-primary-50' },
            { label: 'Umumiy qarz', value: summary.totalDebt, icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50' },
          ].map((s, i) => (
            <div key={i} className="card py-3 flex items-center gap-3">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', s.bg)}>
                <s.icon className={clsx('w-5 h-5', s.color)} />
              </div>
              <div className="min-w-0">
                <div className={clsx('text-base font-bold truncate', s.color)}>{formatMoney(s.value)}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* By method */}
      {summary?.byMethod && summary.byMethod.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summary.byMethod.map(m => {
            const Icon = methodIcon[m.method] || CreditCard;
            return (
              <div key={m.method} className={clsx('flex items-center gap-2.5 p-3 rounded-xl', methodColor[m.method] || 'text-gray-600 bg-gray-50')}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-bold">{formatMoney(m.total)}</div>
                  <div className="text-xs opacity-70">{methodLabel[m.method]} · {m.count} ta</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">To'lovlar ro'yxati</h3>
          <span className="text-xs text-gray-500">
            {currentMonth ? `Oy: ${currentMonth} · ` : ''}Jami: {formatMoney(totalAmount)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>O'quvchi</th>
                <th>Summa</th>
                <th className="hidden md:table-cell">Usul</th>
                <th className="hidden lg:table-cell">Oy</th>
                <th className="hidden sm:table-cell">Sana</th>
                <th className="hidden lg:table-cell">Izoh</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>{[...Array(7)].map((_, j) => <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <CreditCard className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-400">
                      {currentMonth ? "Bu oyda to'lovlar yo'q" : "Hali hech qanday to'lov qilinmagan"}
                    </p>
                  </td>
                </tr>
              ) : (
                payments.map((p, i) => {
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="text-gray-400 text-xs">{(page - 1) * 20 + i + 1}</td>
                      <td>
                        <div className="font-medium text-gray-800 text-sm">{p.student.user.fullName}</div>
                        <div className="text-xs text-gray-400">{p.student.user.phone}</div>
                      </td>
                      <td>
                        <span className="font-bold text-emerald-600 text-sm">{formatMoney(Number(p.amount))}</span>
                      </td>
                      <td className="hidden md:table-cell">
                        {(() => { const MethodIcon = methodIcon[p.paymentMethod] || CreditCard; return (
                          <span className={clsx('flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg w-fit', methodColor[p.paymentMethod] || 'text-gray-500 bg-gray-50')}>
                            <MethodIcon className="w-3 h-3" />{methodLabel[p.paymentMethod] || p.paymentMethod}
                          </span>
                        ); })()}
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-sm text-gray-600">
                          {p.month ? format(new Date(p.month), 'MMMM yyyy') : '—'}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="text-xs text-gray-400">
                          {p.paidAt ? format(new Date(p.paidAt), 'd-MMM HH:mm') : '—'}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-xs text-gray-400 max-w-[120px] truncate block">{p.note || '—'}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} / {pagination.total} ta</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      </>}

      {/* Student Obligations Tab */}
      {activeTab === 'obligations' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <div className="text-base font-bold text-red-600">{formatMoney(totalDebtAmount)}</div>
                <div className="text-xs text-gray-500">Umumiy qarz</div>
              </div>
            </div>
            <div className="card py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <div className="text-base font-bold text-orange-600">{studentsWithDebt}</div>
                <div className="text-xs text-gray-500">Qarzdor o'quvchilar</div>
              </div>
            </div>
            <div className="card py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Calculator className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <div className="text-base font-bold text-indigo-600">{filteredObligations.length}</div>
                <div className="text-xs text-gray-500">Faol o'quvchilar</div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={obligSearch}
              onChange={e => setObligSearch(e.target.value)}
              placeholder="Ism, telefon yoki guruh bo'yicha izlash..."
              className="input pl-9"
            />
          </div>

          {/* Table */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>O'quvchi</th>
                    <th>Guruh / Kurs</th>
                    <th>Oylik to'lov</th>
                    <th>Chegirma</th>
                    <th>Joriy balans</th>
                    <th>Qarz</th>
                  </tr>
                </thead>
                <tbody>
                  {obligLoading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i}>{[...Array(7)].map((_, j) => (
                        <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}</tr>
                    ))
                  ) : filteredObligations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12">
                        <Users className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                        <p className="text-gray-400">O'quvchilar topilmadi</p>
                      </td>
                    </tr>
                  ) : filteredObligations.map((o, i) => (
                    <tr key={o.studentId} className={clsx(
                      'hover:bg-gray-50/70 transition-colors',
                      o.hasDebt && 'bg-red-50/30'
                    )}>
                      <td className="text-gray-400 text-xs">{i + 1}</td>
                      <td>
                        <div className="font-medium text-gray-800 text-sm">{o.fullName}</div>
                        <div className="text-xs text-gray-400">{o.phone}</div>
                      </td>
                      <td>
                        <div className="text-sm text-gray-700">{o.groupName}</div>
                        <div className="text-xs text-gray-400">{o.courseName}</div>
                      </td>
                      <td>
                        <div className="font-semibold text-gray-800 text-sm">{formatMoney(o.monthlyAmount)}</div>
                        <div className="text-[11px] text-gray-400">{o.lessonsPerMonth} dars/oy · {formatMoney(o.pricePerLesson)}/dars</div>
                      </td>
                      <td>
                        {o.discountAmount > 0 ? (
                          <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium">
                            <Percent className="w-3 h-3" />
                            -{formatMoney(o.discountAmount)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td>
                        <span className={clsx('text-sm font-semibold', o.currentBalance > 0 ? 'text-emerald-600' : 'text-gray-400')}>
                          {formatMoney(o.currentBalance)}
                        </span>
                      </td>
                      <td>
                        {o.hasDebt ? (
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">
                            <TrendingDown className="w-3 h-3" />
                            {formatMoney(o.currentDebt)}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-500 font-medium">✓ Qarz yo'q</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddModal && (
        <AddPaymentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); qc.invalidateQueries('payments'); qc.invalidateQueries('payment-summary'); }}
        />
      )}
    </div>
  );
};

// ── Add Payment Modal ──────────────────────────────
const AddPaymentModal = ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => {
  const [form, setForm] = useState({
    studentSearch: '', studentId: '', studentName: '',
    amount: '', method: 'CASH',
    month: format(new Date(), 'yyyy-MM'),
    description: '', isDebtPayment: false,
  });
  const [loading, setLoading] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);

  const { data: searchResults } = useQuery(
    ['student-search', form.studentSearch],
    () => api.get('/students', { params: { search: form.studentSearch, limit: 8 } })
      .then(r => r.data.data).catch(() => []),
    { enabled: form.studentSearch.length >= 2 }
  );

  const students = Array.isArray(searchResults) ? searchResults : [];

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.amount) { toast.error("O'quvchi va summa kiritilishi shart"); return; }
    setLoading(true);
    try {
      await api.post('/payments', {
        studentId: form.studentId,
        amount: parseFloat(form.amount),
        paymentMethod: form.method,   // backend 'paymentMethod' kutadi
        month: form.month,
        note: form.description,       // backend 'note' kutadi
        isDebtPayment: form.isDebtPayment,
      });
      toast.success("To'lov muvaffaqiyatli qayd etildi!");
      onSuccess();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xato');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-violet-600" /> To'lov qabul qilish
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Student search */}
          <div className="relative">
            <label className="label">O'quvchi *</label>
            {form.studentId ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary-50 border border-primary-200">
                <span className="text-sm font-medium text-primary-700">{form.studentName}</span>
                <button type="button" onClick={() => set('studentId', '')} className="text-primary-400 hover:text-primary-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={form.studentSearch}
                  onChange={e => { set('studentSearch', e.target.value); setShowStudentList(true); }}
                  placeholder="O'quvchi ismini kiriting..." className="input pl-9" />
                {showStudentList && students.length > 0 && (
                  <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                    {students.map((s: { id: number; user: { fullName: string; phone: string }; balance?: { debt: number } }) => (
                      <button key={s.id} type="button"
                        onClick={() => { set('studentId', s.id.toString()); set('studentName', s.user.fullName); setShowStudentList(false); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-left">
                        <div>
                          <div className="text-sm font-medium text-gray-800">{s.user.fullName}</div>
                          <div className="text-xs text-gray-400">{s.user.phone}</div>
                        </div>
                        {Number(s.balance?.debt || 0) > 0 && (
                          <span className="text-xs text-red-500 font-medium">
                            Qarz: {new Intl.NumberFormat('uz-UZ').format(Number(s.balance?.debt))}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="label">Summa (so'm) *</label>
            <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="500000" min="1000" step="1000" className="input text-lg font-semibold" />
          </div>

          {/* Method */}
          <div>
            <label className="label">To'lov usuli</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'CASH', label: 'Naqd pul', icon: Banknote },
                { value: 'CARD', label: 'Bank kartasi', icon: CreditCard },
                { value: 'TRANSFER', label: "Bank o'tkazma", icon: Building2 },
                { value: 'ONLINE', label: 'Online to\'lov', icon: Smartphone },
              ].map(m => (
                <label key={m.value} className={clsx(
                  'flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-colors',
                  form.method === m.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                )}>
                  <input type="radio" name="method" value={m.value} checked={form.method === m.value}
                    onChange={() => set('method', m.value)} className="sr-only" />
                  <m.icon className={clsx('w-4 h-4', form.method === m.value ? 'text-primary-600' : 'text-gray-400')} />
                  <span className={clsx('text-xs font-medium', form.method === m.value ? 'text-primary-700' : 'text-gray-600')}>{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Month */}
          <div>
            <label className="label">Qaysi oyga</label>
            <input type="month" value={form.month} onChange={e => set('month', e.target.value)} className="input" />
          </div>

          {/* Debt payment toggle */}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-gray-50">
            <input type="checkbox" checked={form.isDebtPayment} onChange={e => set('isDebtPayment', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600" />
            <div>
              <div className="text-sm font-medium text-gray-700">Qarz to'lovi</div>
              <div className="text-xs text-gray-500">Belgilansa, to'lov avval qarzni qoplaydi</div>
            </div>
          </label>

          {/* Description */}
          <div>
            <label className="label">Izoh</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Ixtiyoriy izoh..." className="input" />
          </div>
        </form>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1">Bekor</button>
          <button onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Saqlanmoqda...' : "To'lovni qayd etish"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentsPage;
