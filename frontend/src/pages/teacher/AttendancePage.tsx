import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle, XCircle, Clock, BookOpen, Users,
  ChevronDown, Save, Calendar, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import api from '../../api/axios';
import { clsx } from 'clsx';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

interface Student {
  id: number;
  user: { id: number; fullName: string; avatarUrl?: string };
}
interface GroupStudent { student: Student; }
interface Group {
  id: number; name: string;
  course: { name: string };
  groupStudents: GroupStudent[];
}
interface GroupListItem {
  id: number; name: string;
  course: { name: string };
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; icon: React.ElementType; short: string }> = {
  PRESENT: { label: 'Keldi', color: 'bg-emerald-500 text-white border-emerald-500', icon: CheckCircle, short: '✓' },
  ABSENT: { label: 'Kelmadi', color: 'bg-red-500 text-white border-red-500', icon: XCircle, short: '✗' },
  LATE: { label: 'Kechikdi', color: 'bg-amber-500 text-white border-amber-500', icon: Clock, short: '⏰' },
  EXCUSED: { label: 'Sababli', color: 'bg-blue-500 text-white border-blue-500', icon: BookOpen, short: 'S' },
};

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const AttendancePage = () => {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(() => {
    const gid = searchParams.get('groupId');
    return gid ? parseInt(gid) : null;
  });
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [topic, setTopic] = useState('');
  const [attendance, setAttendance] = useState<Record<number, AttendanceStatus>>({});
  const [scores, setScores] = useState<Record<number, string>>({});

  // 1. Guruhlar ro'yxati (faqat nom uchun)
  const { data: groupsRaw } = useQuery<{ data: GroupListItem[] }>(
    'my-groups-list',
    () => api.get('/groups', { params: { limit: 50, status: 'ACTIVE' } }).then(r => r.data),
    { retry: 2 }
  );
  const groups: GroupListItem[] = Array.isArray(groupsRaw?.data)
    ? groupsRaw!.data
    : (groupsRaw?.data as unknown as { groups?: GroupListItem[] })?.groups || [];

  // 2. Tanlangan guruhni to'liq ma'lumotlar bilan olish (o'quvchilar bilan)
  const { data: groupDetail, isLoading: groupLoading } = useQuery<Group>(
    ['group-detail', selectedGroupId],
    () => api.get(`/groups/${selectedGroupId}`).then(r => r.data?.data),
    {
      enabled: !!selectedGroupId,
      retry: 2,
      staleTime: 30_000,
    }
  );

  // Guruh tanlanganda davomatni PRESENT ga boshlash
  useEffect(() => {
    if (groupDetail?.groupStudents) {
      const initial: Record<number, AttendanceStatus> = {};
      groupDetail.groupStudents.forEach(gs => {
        initial[gs.student.id] = 'PRESENT';
      });
      setAttendance(initial);
      setScores({});
    }
  }, [groupDetail?.id]);

  const markMutation = useMutation(
    () => api.post('/attendance/lesson', {
      groupId: selectedGroupId,
      date,
      topic: topic || undefined,
      attendanceList: Object.entries(attendance).map(([studentId, status]) => ({
        studentId: parseInt(studentId),
        status,
        score: scores[parseInt(studentId)] ? parseFloat(scores[parseInt(studentId)]) : undefined,
      }))
    }),
    {
      onSuccess: () => {
        toast.success('Davomat muvaffaqiyatli belgilandi!');
        qc.invalidateQueries(['group-detail', selectedGroupId]);
        qc.invalidateQueries('attendance-stats');
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || 'Xato yuz berdi');
      }
    }
  );

  const setStatus = (studentId: number, status: AttendanceStatus) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const markAll = (status: AttendanceStatus) => {
    if (!groupDetail) return;
    const all: Record<number, AttendanceStatus> = {};
    groupDetail.groupStudents.forEach(gs => { all[gs.student.id] = status; });
    setAttendance(all);
  };

  const students = groupDetail?.groupStudents || [];
  const presentCount = Object.values(attendance).filter(s => s === 'PRESENT' || s === 'LATE').length;
  const absentCount = Object.values(attendance).filter(s => s === 'ABSENT').length;
  const totalCount = Object.keys(attendance).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-emerald-600" /> Davomat Belgilash
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'd-MMMM, yyyy')}</p>
      </div>

      {/* Settings */}
      <div className="card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Group selector */}
          <div>
            <label className="label">Guruh *</label>
            <div className="relative">
              <select
                value={selectedGroupId || ''}
                onChange={e => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  setSelectedGroupId(val);
                  setAttendance({});
                  setScores({});
                }}
                className="input appearance-none pr-8"
              >
                <option value="">Guruh tanlang...</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name} — {g.course?.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="label">Sana *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input pl-9" />
            </div>
          </div>

          {/* Topic */}
          <div>
            <label className="label">Dars mavzusi</label>
            <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="Bugungi mavzu..." className="input" />
          </div>
        </div>

        {/* Quick mark all */}
        {groupDetail && students.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">Hammani belgilash:</span>
            {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map(status => (
              <button key={status} onClick={() => markAll(status)}
                className={clsx(
                  'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                  'hover:opacity-90',
                  STATUS_CONFIG[status].color
                )}>
                {STATUS_CONFIG[status].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* No group selected */}
      {!selectedGroupId && (
        <div className="card text-center py-16">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400">Guruh tanlang</p>
          <p className="text-xs text-gray-300 mt-1">Davomat belgilash uchun yuqoridan guruh tanlang</p>
        </div>
      )}

      {/* Loading group detail */}
      {selectedGroupId && groupLoading && (
        <div className="card text-center py-12">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 text-indigo-400 animate-spin" />
          <p className="text-sm text-gray-400">O'quvchilar yuklanmoqda...</p>
        </div>
      )}

      {/* No students in group */}
      {selectedGroupId && !groupLoading && groupDetail && students.length === 0 && (
        <div className="card text-center py-12">
          <Users className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="text-gray-400">Bu guruhda faol o'quvchilar yo'q</p>
        </div>
      )}

      {/* Attendance list */}
      {selectedGroupId && !groupLoading && students.length > 0 && (
        <>
          {/* Stats bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              {totalCount > 0 && (
                <div className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${(presentCount / totalCount) * 100}%` }} />
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
              <span className="text-emerald-600 font-semibold">{presentCount} keldi</span>
              <span className="text-red-500 font-semibold">{absentCount} kelmadi</span>
              <span>/ {totalCount} ta</span>
            </div>
          </div>

          {/* Student cards */}
          <div className="space-y-2">
            {students.map(({ student }, index) => {
              const status = attendance[student.id] || 'PRESENT';
              const config = STATUS_CONFIG[status];

              return (
                <div key={student.id}
                  className={clsx(
                    'card py-3 transition-all border-l-4',
                    status === 'PRESENT' ? 'border-l-emerald-400' :
                    status === 'ABSENT' ? 'border-l-red-400' :
                    status === 'LATE' ? 'border-l-amber-400' : 'border-l-blue-400'
                  )}>
                  <div className="flex items-center gap-3">
                    {/* Number */}
                    <span className="text-xs text-gray-400 w-5 flex-shrink-0 text-center">{index + 1}</span>

                    {/* Avatar */}
                    <div className={clsx(
                      'w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0',
                      status === 'PRESENT' ? 'bg-emerald-500' :
                      status === 'ABSENT' ? 'bg-red-400' :
                      status === 'LATE' ? 'bg-amber-500' : 'bg-blue-500'
                    )}>
                      {getInitials(student.user.fullName)}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm">{student.user.fullName}</div>
                    </div>

                    {/* Score input */}
                    <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                      <input
                        type="number"
                        value={scores[student.id] || ''}
                        onChange={e => setScores(prev => ({ ...prev, [student.id]: e.target.value }))}
                        placeholder="Baho"
                        min="0" max="100" step="1"
                        className="w-16 input py-1 text-sm text-center"
                        disabled={status === 'ABSENT'}
                      />
                    </div>

                    {/* Status buttons */}
                    <div className="flex gap-1 flex-shrink-0">
                      {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map(s => {
                        const sc = STATUS_CONFIG[s];
                        const Icon = sc.icon;
                        return (
                          <button
                            key={s}
                            onClick={() => setStatus(student.id, s)}
                            title={sc.label}
                            className={clsx(
                              'w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all text-xs font-bold',
                              status === s
                                ? sc.color + ' scale-110'
                                : 'border-gray-200 text-gray-400 hover:border-gray-300'
                            )}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save button */}
          <div className="sticky bottom-4 pt-2">
            <button
              onClick={() => markMutation.mutate()}
              disabled={markMutation.isLoading || !selectedGroupId || totalCount === 0}
              className={clsx(
                'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white shadow-lg transition-all',
                markMutation.isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]'
              )}
            >
              <Save className="w-5 h-5" />
              {markMutation.isLoading
                ? 'Saqlanmoqda...'
                : `Davomatni saqlash (${presentCount}/${totalCount} keldi)`
              }
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AttendancePage;
