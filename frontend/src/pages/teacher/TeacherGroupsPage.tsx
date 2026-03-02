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

const DAYS = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

const TeacherGroupsPage = () => {
  const { data: groups = [], isLoading } = useQuery<Group[]>(
    ['teacher-groups'],
    async () => {
      // Teacher o'zining profilini oladi, so'ng unga tegishli guruhlarni
      const r = await api.get('/groups?limit=50');
      const raw = r.data?.data;
      return Array.isArray(raw) ? raw : raw?.groups || [];
    }
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mening Guruhlarim</h1>
        <p className="text-sm text-gray-500 mt-0.5">{groups.length} ta faol guruh</p>
      </div>

      {isLoading && (
        <div className="card text-center py-12">
          <div className="animate-spin w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3"/>
          <p className="text-gray-400 text-sm">Yuklanmoqda...</p>
        </div>
      )}

      {!isLoading && groups.length === 0 && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">👥</div>
          <h2 className="text-lg font-semibold text-gray-700">Guruhlar topilmadi</h2>
          <p className="text-gray-400 text-sm mt-1">Sizga hali guruh biriktirilmagan</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map(group => (
          <div key={group.id} className="card hover:shadow-md transition">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-800">{group.name}</h3>
                <p className="text-sm text-gray-500">{group.course.name}</p>
              </div>
              <span className={clsx("px-2 py-1 rounded-full text-xs font-medium",
                group.status === 'ACTIVE' ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
              )}>
                {group.status === 'ACTIVE' ? 'Faol' : group.status}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 py-3 border-y border-gray-100 mb-3">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-800">{group._count.groupStudents}</p>
                <p className="text-xs text-gray-400">O'quvchi</p>
              </div>
              <div className="text-center border-x border-gray-100">
                <p className="text-lg font-bold text-gray-800">{group._count.lessons}</p>
                <p className="text-xs text-gray-400">Dars</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-gray-700">{group.room || '—'}</p>
                <p className="text-xs text-gray-400">Xona</p>
              </div>
            </div>

            {/* Schedules */}
            {group.schedules && group.schedules.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {group.schedules.map((sc) => (
                  <span key={sc.id} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                    {(sc.daysOfWeek || []).map(d => DAYS[d]).join('/')} {sc.startTime}-{sc.endTime}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Link
                to={`/teacher/attendance?groupId=${group.id}`}
                className="flex-1 text-center text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 rounded-xl transition"
              >
                📋 Davomat
              </Link>
              <Link
                to={`/teacher/grades?groupId=${group.id}`}
                className="flex-1 text-center text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 py-2 rounded-xl transition"
              >
                ⭐ Baholar
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeacherGroupsPage;
