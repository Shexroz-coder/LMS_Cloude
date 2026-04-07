import { useState } from 'react';
import { useQuery } from 'react-query';
import { Calendar, CheckCircle2, XCircle, AlertCircle, BarChart3 } from 'lucide-react';
import api from '../api/axios';
import { clsx } from 'clsx';

interface Lesson {
  lessonId: number | null; // null = dars hatto ochilmagan
  date: Date;
  groupName: string;
  courseName: string;
  totalStudents: number;
  markedCount: number;
  isMarked: boolean;
}

interface Teacher {
  teacherId: number;
  teacherName: string;
  lessons: Lesson[];
}

interface ReportResponse {
  summary: {
    totalLessons: number;
    markedLessons: number;
    unmarkedLessons: number;
    dateRange: { from: string; to: string };
  };
  teachers: Teacher[];
}

const TeacherAttendanceReport = () => {
  const today = new Date().toISOString().split('T')[0];
  const [viewMode, setViewMode] = useState<'today' | 'month'>('today');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));

  const queryKey = viewMode === 'today'
    ? ['teacher-attendance-report', selectedDate]
    : ['teacher-attendance-report', selectedMonth];

  const queryParam = viewMode === 'today'
    ? `date=${selectedDate}`
    : `month=${selectedMonth}`;

  const { data, isLoading } = useQuery<ReportResponse>(
    queryKey,
    () => api.get(`/attendance/teacher-report?${queryParam}`).then(r => r.data.data),
    { keepPreviousData: true }
  );

  const report = data || { summary: { totalLessons: 0, markedLessons: 0, unmarkedLessons: 0, dateRange: { from: '', to: '' } }, teachers: [] };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('uz-UZ', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" /> Davomat nazorati
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Ustozlar davomatini kuzatib boring</p>
        </div>
      </div>

      {/* View Mode Toggle & Filters */}
      <div className="card dark:bg-gray-800 space-y-4 p-4">
        <div className="flex gap-2">
          {[
            { id: 'today', label: 'Bugun', icon: '📅' },
            { id: 'month', label: "Bu oy", icon: '📊' }
          ].map(mode => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id as 'today' | 'month')}
              className={clsx(
                'px-4 py-2 rounded-lg font-medium transition-colors text-sm flex items-center gap-1.5',
                viewMode === mode.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              {mode.icon} {mode.label}
            </button>
          ))}
        </div>

        {/* Date/Month Picker */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
              {viewMode === 'today' ? 'Sana' : 'Oy'}
            </label>
            {viewMode === 'today' ? (
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            ) : (
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {!isLoading && report.summary.totalLessons > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card dark:bg-gray-800 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Jami darslar</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{report.summary.totalLessons}</p>
          </div>
          <div className="card dark:bg-gray-800 p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Davomati belgilangan</p>
            <p className="text-2xl font-bold text-green-600">{report.summary.markedLessons}</p>
          </div>
          <div className="card dark:bg-gray-800 p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Belgilanmagan</p>
            <p className="text-2xl font-bold text-red-600">{report.summary.unmarkedLessons}</p>
          </div>
        </div>
      )}

      {/* Teachers List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card dark:bg-gray-800 p-4 animate-pulse">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : report.teachers.length === 0 ? (
        <div className="card dark:bg-gray-800 text-center py-12">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-gray-600" />
          <p className="text-gray-400 dark:text-gray-500">Darslar topilmadi</p>
        </div>
      ) : (
        <div className="space-y-4">
          {report.teachers.map(teacher => (
            <div key={teacher.teacherId} className="card dark:bg-gray-800 overflow-hidden">
              {/* Teacher Header */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-gray-700 dark:to-gray-600 px-4 py-3 border-b border-blue-200 dark:border-gray-600">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">{teacher.teacherName}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {teacher.lessons.length} ta dars
                </p>
              </div>

              {/* Lessons Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Sana</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Guruh</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Kurs</th>
                      <th className="px-4 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">O'quvchilar</th>
                      <th className="px-4 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">Davomat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacher.lessons.map((lesson, idx) => (
                      <tr
                        key={lesson.lessonId}
                        className={clsx(
                          'border-t border-gray-100 dark:border-gray-700',
                          idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'
                        )}
                      >
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {formatDate(lesson.date.toString())}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">
                          {lesson.groupName}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                          {lesson.courseName}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium">
                          {lesson.markedCount}/{lesson.totalStudents}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {lesson.isMarked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Belgilandi
                            </span>
                          ) : lesson.lessonId !== null ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-medium">
                              <AlertCircle className="w-3.5 h-3.5" /> Yarim belgilandi
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs font-medium">
                              <XCircle className="w-3.5 h-3.5" /> Belgilanmadi
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherAttendanceReport;
