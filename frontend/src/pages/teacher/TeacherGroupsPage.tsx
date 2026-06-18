import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../../api/axios';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

interface Group {
  id: number;
  name: string;
  status: string;
  room?: string;
  course: { name: string; monthlyPrice: number };
  _count: { groupStudents: number; lessons: number };
  schedules?: { id: number; daysOfWeek: number[]; startTime: string; endTime: string }[];
}

interface StudentInGroup {
  id: number;
  student: {
    id: number;
    user: { id: number; fullName: string; phone: string };
    parent?: { id: number; fullName: string; phone: string } | null;
  };
}

const DAYS = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

// O'quvchilar ro'yxati (kengaytirilgan holatda ko'rsatiladi)
const StudentsList = ({ groupId }: { groupId: number }) => {
  const { data: group, isLoading } = useQuery(
    ['teacher-group-students', groupId],
    () => api.get(`/groups/${groupId}`).then(r => r.data?.data),
    { staleTime: 30_000 }
  );

  const students: StudentInGroup[] = group?.groupStudents || [];

  if (isLoading) {
    return (
      <div className="py-4 text-center">
        <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  if (students.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500 py-3 text-center">O'quvchilar yo'q</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {students.map((gs, i) => (
        <div key={gs.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2.5">
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 w-5 pt-0.5 shrink-0">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              {/* O'quvchi */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                  {gs.student.user.fullName}
                </span>
                <a
                  href={`tel:${gs.student.user.phone}`}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-mono hover:underline"
                >
                  📱 {gs.student.user.phone}
                </a>
              </div>
              {/* Ota-ona */}
              {gs.student.parent && (
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    👨‍👩‍👧 {gs.student.parent.fullName}
                  </span>
                  <a
                    href={`tel:${gs.student.parent.phone}`}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-mono hover:underline"
                  >
                    {gs.student.parent.phone}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const TeacherGroupsPage = () => {
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);

  const { data: groups = [], isLoading } = useQuery<Group[]>(
    ['teacher-groups'],
    async () => {
      const r = await api.get('/groups?limit=50');
      const raw = r.data?.data;
      return Array.isArray(raw) ? raw : raw?.groups || [];
    }
  );

  return (
    <div className="space-y-5 animate-fade-in dark:bg-gray-900 dark:text-gray-100">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Mening Guruhlarim</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{groups.length} ta faol guruh</p>
      </div>

      {isLoading && (
        <div className="card dark:bg-gray-800 dark:border-gray-700 text-center py-12">
          <div className="animate-spin w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3"/>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Yuklanmoqda...</p>
        </div>
      )}

      {!isLoading && groups.length === 0 && (
        <div className="card dark:bg-gray-800 dark:border-gray-700 text-center py-16">
          <div className="text-5xl mb-4">👥</div>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Guruhlar topilmadi</h2>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Sizga hali guruh biriktirilmagan</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map(group => (
          <div key={group.id} className="card dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-800 dark:text-gray-100">{group.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{group.course.name}</p>
              </div>
              <span className={clsx("px-2 py-1 rounded-full text-xs font-medium",
                group.status === 'ACTIVE' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              )}>
                {group.status === 'ACTIVE' ? 'Faol' : group.status}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 py-3 border-y border-gray-100 dark:border-gray-700 mb-3">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{group._count.groupStudents}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">O'quvchi</p>
              </div>
              <div className="text-center border-x border-gray-100 dark:border-gray-700">
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{group._count.lessons}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Dars</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{group.room || '—'}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Xona</p>
              </div>
            </div>

            {/* Schedules */}
            {group.schedules && group.schedules.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {group.schedules.map((sc) => (
                  <span key={sc.id} className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                    {(sc.daysOfWeek || []).map(d => DAYS[d]).join('/')} {sc.startTime}-{sc.endTime}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Link
                to={`/teacher/attendance?groupId=${group.id}`}
                className="flex-1 text-center text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 py-2 rounded-xl transition"
              >
                📋 Davomat
              </Link>
              <button
                onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                className="flex-1 text-center text-xs font-medium bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 py-2 rounded-xl transition"
              >
                {expandedGroupId === group.id ? '🔼 Yopish' : '👤 O\'quvchilar'}
              </button>
            </div>

            {/* Expandable students list */}
            {expandedGroupId === group.id && (
              <StudentsList groupId={group.id} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeacherGroupsPage;
