import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  ArrowLeft, Phone, Edit2, CheckCircle, CreditCard, UserCheck,
  Calendar, MapPin, Coins, BookOpen, TrendingUp, Clock,
  CalendarDays, Pencil, Loader2, AlertCircle, X
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import api from '../../api/axios';
import { clsx } from 'clsx';
import StudentsPage from './StudentsPage';

// ── Types ──────────────────────────────────────────
interface StudentUser {
  id: number; fullName: string; phone: string;
  email?: string; avatarUrl?: string; isActive: boolean; createdAt: string;
}
interface GroupInfo {
  group: {
    id: number; name: string;
    course: { name: string; monthlyPrice: number };
    teacher: { user: { fullName: string } };
  };
  joinedAt: string;
}
interface Balance { balance: number; debt: number; }
interface Student {
  id: number; userId: number; coinBalance: number;
  birthDate?: string; address?: string; notes?: string;
  discountType?: string; discountValue?: number;
  status?: string; demoDate?: string; leftAt?: string; leftReason?: string;
  user: StudentUser; parent?: StudentUser;
  balance?: Balance;
  groupStudents: GroupInfo[];
  _count: { attendance: number; grades: number; payments: number; coinTransactions: number };
}

const formatMoney = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";
const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-4">
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
    {children}
  </div>
);

const InfoRow = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="flex items-center gap-2 text-sm text-gray-700">
    <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
    <span>{label}</span>
  </div>
);

// ══════════════════════════════════════════════════
// Student Detail Page
// ══════════════════════════════════════════════════
const StudentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const studentId = parseInt(id || '0');

  const [activeTab, setActiveTab] = useState<'info' | 'attendance' | 'payments'>('info');
  const [editingJoinedAt, setEditingJoinedAt] = useState<{ groupId: number; groupName: string; current: string } | null>(null);
  const [joinedAtValue, setJoinedAtValue] = useState('');
  const [savingJoinedAt, setSavingJoinedAt] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: s, isLoading, isError } = useQuery<Student>(
    ['student-detail', studentId],
    () => api.get(`/students/${studentId}`).then(r => r.data.data),
    { enabled: !!studentId }
  );

  const { data: attendanceData, isLoading: attendanceLoading } = useQuery(
    ['student-attendance', studentId],
    () => api.get(`/attendance/student/${studentId}`).then(r => r.data.data),
    { enabled: activeTab === 'attendance', staleTime: 30000 }
  );

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery(
    ['student-payments', studentId],
    () => api.get(`/payments/student/${studentId}`).then(r => r.data.data),
    { enabled: activeTab === 'payments' }
  );

  const saveJoinedAt = async () => {
    if (!editingJoinedAt || !joinedAtValue) return;
    setSavingJoinedAt(true);
    try {
      await api.patch(`/students/${studentId}/groups/${editingJoinedAt.groupId}/joined-at`, {
        joinedAt: joinedAtValue,
      });
      toast.success("O'qishni boshlagan sana yangilandi!");
      qc.invalidateQueries(['student-detail', studentId]);
      setEditingJoinedAt(null);
    } catch {
      toast.error('Xato yuz berdi');
    } finally {
      setSavingJoinedAt(false);
    }
  };

  const tabs = [
    { key: 'info' as const, label: "Ma'lumot", icon: UserCheck },
    { key: 'attendance' as const, label: 'Davomat', icon: CheckCircle },
    { key: 'payments' as const, label: "To'lovlar", icon: CreditCard },
  ];

  if (!studentId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <AlertCircle className="w-12 h-12 mb-3 text-red-400" />
        <p>Noto'g'ri o'quvchi ID</p>
        <button onClick={() => navigate('/admin/students')} className="mt-3 btn-primary text-sm">
          O'quvchilar ro'yxatiga qaytish
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (isError || !s) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <AlertCircle className="w-12 h-12 mb-3 text-red-400" />
        <p>O'quvchi topilmadi</p>
        <button onClick={() => navigate('/admin/students')} className="mt-3 btn-primary text-sm">
          Orqaga qaytish
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/students')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          O'quvchilar ro'yxati
        </button>
      </div>

      {/* Hero card */}
      <div className="bg-gradient-to-r from-primary-600 to-violet-600 rounded-2xl px-6 pt-6 pb-5 text-white shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {getInitials(s.user.fullName)}
            </div>
            <div>
              <h1 className="text-xl font-bold">{s.user.fullName}</h1>
              <p className="text-white/80 text-sm flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5" /> {s.user.phone}
              </p>
              {s.user.email && <p className="text-white/60 text-xs mt-0.5">{s.user.email}</p>}
            </div>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" /> Tahrirlash
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          {[
            { label: 'Balans', value: formatMoney(Number(s.balance?.balance || 0)), color: 'text-emerald-300' },
            {
              label: 'Qarz',
              value: Number(s.balance?.debt || 0) > 0 ? formatMoney(Number(s.balance?.debt || 0)) : "0 so'm",
              color: Number(s.balance?.debt || 0) > 0 ? 'text-red-300' : 'text-white/60'
            },
            { label: 'Coin', value: String(s.coinBalance) + ' 🪙', color: 'text-amber-300' },
          ].map((stat, i) => (
            <div key={i} className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <p className={clsx('text-base font-bold', stat.color)}>{stat.value}</p>
              <p className="text-white/70 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl border border-gray-100 overflow-hidden">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2',
              activeTab === tab.key
                ? 'border-primary-600 text-primary-600 bg-primary-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Groups */}
          <div className="md:col-span-2">
            <Section title="Guruhlar">
              {s.groupStudents?.length > 0 ? (
                <div className="space-y-2">
                  {s.groupStudents.map((gs: GroupInfo, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-gray-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm text-gray-800">{gs.group.name}</div>
                          <div className="text-xs text-gray-500">{gs.group.course.name} · {gs.group.teacher.user.fullName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-primary-600">{formatMoney(gs.group.course.monthlyPrice)}</div>
                          <div className="text-xs text-gray-400">/oy</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
                          <span>O'qishni boshlagan:</span>
                          <span className="font-medium text-gray-700">
                            {gs.joinedAt ? format(new Date(gs.joinedAt), 'd-MMM yyyy') : '—'}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setEditingJoinedAt({
                              groupId: gs.group.id,
                              groupName: gs.group.name,
                              current: gs.joinedAt ? format(new Date(gs.joinedAt), 'yyyy-MM-dd') : ''
                            });
                            setJoinedAtValue(gs.joinedAt ? format(new Date(gs.joinedAt), 'yyyy-MM-dd') : '');
                          }}
                          className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-700"
                        >
                          <Pencil className="w-3 h-3" /> O'zgartirish
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Hech qaysi guruhda yo'q</p>
              )}
            </Section>
          </div>

          {/* Status */}
          <Section title="Holat va Sanalar">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                {s.status === 'LEAD' && <span className="badge bg-blue-100 text-blue-700">Lid</span>}
                {s.status === 'DEMO' && <span className="badge bg-amber-100 text-amber-700">Demo</span>}
                {s.status === 'ACTIVE' && <span className="badge badge-green">Faol</span>}
                {s.status === 'INACTIVE' && <span className="badge bg-gray-100 text-gray-700">Ketgan</span>}
              </div>
              {s.demoDate && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-amber-500">🎯</span>
                  <span className="text-gray-500 text-xs w-28">Demo dars:</span>
                  <span className="font-medium text-amber-700">{format(new Date(s.demoDate), 'd-MMMM yyyy')}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-blue-500">📅</span>
                <span className="text-gray-500 text-xs w-28">Qo'shilgan:</span>
                <span className="font-medium text-gray-700">{format(new Date(s.user.createdAt), 'd-MMMM yyyy')}</span>
              </div>
              {s.status === 'INACTIVE' && s.leftAt && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-400">🚪</span>
                  <span className="text-gray-500 text-xs w-28">Ketgan:</span>
                  <span className="font-medium text-red-600">{format(new Date(s.leftAt), 'd-MMMM yyyy')}</span>
                </div>
              )}
              {s.leftReason && (
                <div className="p-2 bg-red-50 rounded-lg mt-2">
                  <p className="text-xs text-red-600">Sabab: {s.leftReason}</p>
                </div>
              )}
            </div>
          </Section>

          {/* Personal info */}
          <Section title="Shaxsiy ma'lumotlar">
            <div className="space-y-2">
              {s.birthDate && <InfoRow icon={Calendar} label={format(new Date(s.birthDate), 'd-MMMM yyyy')} />}
              {s.address && <InfoRow icon={MapPin} label={s.address} />}
              {s.parent && <InfoRow icon={Phone} label={`${s.parent.fullName} (${s.parent.phone})`} />}
              {s.discountType && s.discountValue ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 text-xs w-20">Chegirma:</span>
                  <span className="badge badge-yellow text-xs">
                    {s.discountType === 'PERCENTAGE' ? `${s.discountValue}%` : formatMoney(Number(s.discountValue || 0))}
                  </span>
                </div>
              ) : null}
              {s.notes && (
                <div className="p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">{s.notes}</p>
                </div>
              )}
              {!s.birthDate && !s.address && !s.parent && !s.discountType && !s.notes && (
                <p className="text-sm text-gray-400">Ma'lumot kiritilmagan</p>
              )}
            </div>
          </Section>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          {attendanceLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
            </div>
          ) : attendanceData ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Jami', value: attendanceData.total, color: 'text-gray-700' },
                  { label: 'Keldi', value: attendanceData.present, color: 'text-emerald-600' },
                  { label: 'Kelmadi', value: attendanceData.absent, color: 'text-red-500' },
                  { label: 'Foiz', value: `${attendanceData.rate}%`, color: 'text-primary-600' },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className={clsx('text-xl font-bold', item.color)}>{item.value}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
              {/* Records */}
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {(attendanceData.records || []).map((r: {
                  id: number; date: string; status: string;
                  lesson?: { topic?: string; group?: { name: string } }
                }, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {format(new Date(r.date), 'd-MMM yyyy')}
                      </p>
                      {r.lesson?.topic && (
                        <p className="text-xs text-gray-400 truncate max-w-[200px]">{r.lesson.topic}</p>
                      )}
                    </div>
                    <span className={clsx('badge text-xs', {
                      'badge-green': r.status === 'PRESENT',
                      'badge-red': r.status === 'ABSENT',
                      'bg-amber-100 text-amber-700': r.status === 'LATE',
                      'bg-blue-100 text-blue-700': r.status === 'EXCUSED',
                    })}>
                      {r.status === 'PRESENT' ? 'Keldi' : r.status === 'ABSENT' ? 'Kelmadi' : r.status === 'LATE' ? 'Kech' : 'Sababli'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-12">Davomat ma'lumoti yo'q</p>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          {paymentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
            </div>
          ) : paymentsData?.payments?.length > 0 ? (
            <div className="space-y-2">
              {(paymentsData.payments as {
                id: number; amount: number; method: string; date: string;
                description?: string; group?: { name: string };
              }[]).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{formatMoney(p.amount)}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(p.date), 'd-MMM yyyy')}
                      {p.group?.name && ` · ${p.group.name}`}
                    </p>
                    {p.description && <p className="text-xs text-gray-400 truncate">{p.description}</p>}
                  </div>
                  <span className="badge badge-green text-xs">
                    {p.method === 'CASH' ? 'Naqd' : p.method === 'CARD' ? 'Karta' : p.method === 'TRANSFER' ? "O'tkazma" : p.method}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-12">To'lovlar yo'q</p>
          )}
        </div>
      )}

      {/* JoinedAt edit modal */}
      {editingJoinedAt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">O'qishni boshlagan sana</h3>
              <button onClick={() => setEditingJoinedAt(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-3">{editingJoinedAt.groupName}</p>
            <input
              type="date"
              value={joinedAtValue}
              onChange={e => setJoinedAtValue(e.target.value)}
              className="input w-full mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditingJoinedAt(null)} className="btn-secondary flex-1">Bekor</button>
              <button
                onClick={saveJoinedAt}
                disabled={savingJoinedAt || !joinedAtValue}
                className="btn-primary flex-1 disabled:opacity-60"
              >
                {savingJoinedAt ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDetailPage;
