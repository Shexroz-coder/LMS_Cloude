import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  TrendingUp, ChevronDown, Save, BarChart2,
  CheckCircle, XCircle, Clock, BookOpen,
  Award, FileText, Layers, Edit3
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import api from '../../api/axios';
import { clsx } from 'clsx';

// ── Types ──────────────────────────────────────────
interface Lesson { id: number; date: string; topic?: string; }
interface GradebookRow {
  studentId: number; fullName: string; avatarUrl?: string;
  avgScore: number | null; attendanceRate: number;
  lessons: Array<{
    lessonId: number;
    grade: { id: number; score: number; type: string; comment?: string } | null;
    attendance: string | null;
  }>;
}
interface GradebookData {
  gradebook: GradebookRow[];
  lessons: Lesson[];
  period: { month: string };
}
interface GroupItem { id: number; name: string; course: { name: string }; }

const GRADE_TYPES = [
  { value: 'CLASSWORK', label: 'Sinf', emoji: '📝', color: 'text-primary-600 bg-primary-50' },
  { value: 'HOMEWORK', label: 'Uy', emoji: '📚', color: 'text-emerald-600 bg-emerald-50' },
  { value: 'EXAM', label: 'Imtihon', emoji: '📋', color: 'text-red-600 bg-red-50' },
  { value: 'PROJECT', label: 'Loyiha', emoji: '🏆', color: 'text-violet-600 bg-violet-50' },
];

const ATTENDANCE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  PRESENT: { icon: CheckCircle, color: 'text-emerald-500' },
  ABSENT: { icon: XCircle, color: 'text-red-400' },
  LATE: { icon: Clock, color: 'text-amber-500' },
  EXCUSED: { icon: BookOpen, color: 'text-blue-400' },
};

const getScoreColor = (score: number | null) => {
  if (score === null) return 'text-gray-300';
  if (score >= 91) return 'text-violet-600 font-bold';
  if (score >= 76) return 'text-emerald-600 font-semibold';
  if (score >= 61) return 'text-amber-600 font-medium';
  if (score >= 41) return 'text-orange-500';
  return 'text-red-500';
};

const getScoreBg = (score: number | null) => {
  if (score === null) return '';
  if (score >= 91) return 'bg-violet-50';
  if (score >= 76) return 'bg-emerald-50';
  if (score >= 61) return 'bg-amber-50';
  if (score >= 41) return 'bg-orange-50';
  return 'bg-red-50';
};

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// ══════════════════════════════════════════════════
// Main GradesPage Component
// ══════════════════════════════════════════════════
const GradesPage = () => {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    return searchParams.get('groupId') || '';
  });
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [gradeType, setGradeType] = useState<string>('CLASSWORK');
  // editingCell now tracks gradeId too (null = creating new grade)
  const [editingCell, setEditingCell] = useState<{
    studentId: number; lessonId: number; gradeId: number | null;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [bulkGrades, setBulkGrades] = useState<Record<number, string>>({});
  const [showStats, setShowStats] = useState(false);

  // My groups
  const { data: groupsRaw } = useQuery(
    'my-groups-grades',
    () => api.get('/groups', { params: { limit: 50, status: 'ACTIVE' } })
      .then(r => r.data).catch(() => ({ data: [] }))
  );
  const groups: GroupItem[] = Array.isArray(groupsRaw?.data)
    ? groupsRaw.data
    : [];

  // Gradebook data
  const { data: gradebook, isLoading } = useQuery<GradebookData>(
    ['gradebook', selectedGroupId, currentMonth],
    () => api.get(`/grades/gradebook/${selectedGroupId}`, { params: { month: currentMonth } })
      .then(r => r.data?.data),
    { enabled: !!selectedGroupId }
  );

  // Grade stats
  const { data: stats } = useQuery(
    ['grade-stats', selectedGroupId, currentMonth],
    () => api.get('/grades/stats', { params: { groupId: selectedGroupId, month: currentMonth } })
      .then(r => r.data?.data),
    { enabled: !!selectedGroupId && showStats }
  );

  // ── Single grade upsert (create or update) ────────────────────────────────
  const gradeMutation = useMutation(
    ({ studentId, lessonId, score, gradeId }: {
      studentId: number; lessonId: number; score: number; gradeId: number | null;
    }) => {
      if (gradeId) {
        // Update existing
        return api.put(`/grades/${gradeId}`, { score, type: gradeType });
      } else {
        // Create new
        return api.post('/grades', { studentId, lessonId, score, type: gradeType });
      }
    },
    {
      onSuccess: (_data: unknown) => {
        void toast.success('Baho saqlandi!');
        qc.invalidateQueries(['gradebook', selectedGroupId, currentMonth]);
        qc.invalidateQueries(['grade-stats', selectedGroupId, currentMonth]);
        setEditingCell(null);
        setEditValue('');
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || 'Bahoni saqlashda xato');
      }
    }
  );

  // ── Bulk grades save ───────────────────────────────────────────────────────
  const bulkMutation = useMutation(
    (data: { lessonId: number; grades: Array<{ studentId: number; score: number }>; type: string }) =>
      api.post('/grades/bulk', data),
    {
      onSuccess: (_data: unknown) => {
        void toast.success('Baholar saqlandi!');
        qc.invalidateQueries(['gradebook', selectedGroupId, currentMonth]);
        qc.invalidateQueries(['grade-stats', selectedGroupId, currentMonth]);
        setBulkMode(false);
        setBulkGrades({});
        setSelectedLessonId(null);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || 'Saqlashda xato');
      }
    }
  );

  // Cell click → edit mode (tracks existing gradeId)
  const handleCellClick = useCallback((
    studentId: number, lessonId: number,
    currentScore: number | null, gradeId: number | null
  ) => {
    if (bulkMode) return;
    setEditingCell({ studentId, lessonId, gradeId });
    setEditValue(currentScore !== null ? String(currentScore) : '');
  }, [bulkMode]);

  // Save single cell
  const handleCellSave = useCallback((studentId: number, lessonId: number, gradeId: number | null) => {
    if (!editValue.trim()) {
      setEditingCell(null);
      return;
    }
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0 || val > 100) {
      toast.error('Baho 0–100 oralig\'ida bo\'lishi kerak');
      return;
    }
    gradeMutation.mutate({ studentId, lessonId, score: val, gradeId });
  }, [editValue, gradeMutation]);

  // Start bulk for lesson
  const startBulkLesson = (lessonId: number) => {
    setSelectedLessonId(lessonId);
    setBulkMode(true);
    setEditingCell(null);
    // Pre-fill with existing grades
    const existing: Record<number, string> = {};
    gradebook?.gradebook.forEach(row => {
      const entry = row.lessons.find(l => l.lessonId === lessonId);
      if (entry?.grade) existing[row.studentId] = String(entry.grade.score);
    });
    setBulkGrades(existing);
  };

  const saveBulk = () => {
    if (!selectedLessonId) return;
    const grades = Object.entries(bulkGrades)
      .map(([sid, s]) => ({ studentId: parseInt(sid), score: parseFloat(s) }))
      .filter(g => !isNaN(g.score) && g.score >= 0 && g.score <= 100);

    if (grades.length === 0) { toast.error('Hech qanday baho kiritilmagan'); return; }
    bulkMutation.mutate({ lessonId: selectedLessonId, grades, type: gradeType });
  };

  const cancelBulk = () => {
    setBulkMode(false);
    setBulkGrades({});
    setSelectedLessonId(null);
  };

  const lessons = gradebook?.lessons || [];
  const rows = gradebook?.gradebook || [];
  const groupAvg = rows.length > 0
    ? Math.round((rows.filter(r => r.avgScore !== null).reduce((s, r) => s + (r.avgScore || 0), 0) /
        rows.filter(r => r.avgScore !== null).length) * 10) / 10
    : null;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-violet-600" /> Baholar Jurnali
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {gradebook ? `${rows.length} ta o'quvchi · ${lessons.length} ta dars` : 'Guruh tanlang'}
          </p>
        </div>
        {selectedGroupId && (
          <button onClick={() => setShowStats(!showStats)}
            className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
              showStats ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
            <BarChart2 className="w-4 h-4" /> Statistika
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="card py-3 flex flex-wrap gap-3 items-center">
        {/* Group */}
        <div className="relative">
          <select value={selectedGroupId}
            onChange={e => {
              setSelectedGroupId(e.target.value);
              setEditingCell(null);
              setBulkMode(false);
            }}
            className="input py-2 text-sm pr-8 appearance-none min-w-[180px]">
            <option value="">Guruh tanlang...</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name} — {g.course?.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Month */}
        <input type="month" value={currentMonth}
          onChange={e => { setCurrentMonth(e.target.value); setEditingCell(null); }}
          className="input py-2 text-sm" />

        {/* Grade type filter */}
        <div className="flex gap-1.5 flex-wrap">
          {GRADE_TYPES.map(gt => (
            <button key={gt.value} onClick={() => setGradeType(gt.value)}
              className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors',
                gradeType === gt.value ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:border-gray-300')}>
              <span>{gt.emoji}</span> {gt.label}
            </button>
          ))}
        </div>

        {/* Bulk mode info */}
        {bulkMode && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
              ✏️ Ommaviy kiritish rejimi
            </span>
            <button onClick={saveBulk} disabled={bulkMutation.isLoading}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60">
              <Save className="w-3.5 h-3.5" /> Saqlash
            </button>
            <button onClick={cancelBulk}
              className="text-xs text-gray-500 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              Bekor
            </button>
          </div>
        )}
      </div>

      {/* Stats panel */}
      {showStats && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "O'rtacha baho", value: stats.avgScore, suffix: '', color: 'text-violet-600', bg: 'bg-violet-50' },
            { label: 'Jami baholar', value: stats.total, suffix: ' ta', color: 'text-primary-600', bg: 'bg-primary-50' },
            { label: 'Eng yuqori', value: stats.maxScore, suffix: '', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Eng past', value: stats.minScore, suffix: '', color: 'text-red-500', bg: 'bg-red-50' },
          ].map((s, i) => (
            <div key={i} className={clsx('card py-3 flex items-center gap-3', s.bg)}>
              <div>
                <div className={clsx('text-xl font-bold', s.color)}>{s.value}{s.suffix}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
          {/* Distribution */}
          {stats.distribution && stats.distribution.length > 0 && (
            <div className="col-span-2 md:col-span-4 card py-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">Baholar taqsimoti</p>
              <div className="flex gap-2">
                {stats.distribution.map((d: { range: string; label: string; count: number; color: string }) => (
                  <div key={d.range} className="flex-1 text-center">
                    <div className="h-8 rounded-lg mb-1 flex items-end overflow-hidden" style={{ backgroundColor: d.color + '22' }}>
                      <div className="w-full rounded-lg transition-all" style={{
                        backgroundColor: d.color,
                        height: `${stats.total > 0 ? Math.max(d.count > 0 ? 15 : 0, (d.count / stats.total) * 100) : 0}%`,
                      }} />
                    </div>
                    <div className="text-xs font-bold" style={{ color: d.color }}>{d.count}</div>
                    <div className="text-xs text-gray-400">{d.range}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No group */}
      {!selectedGroupId && (
        <div className="card text-center py-16">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 font-medium">Guruh tanlang</p>
          <p className="text-sm text-gray-300 mt-1">Baholar jurnalini ko'rish uchun guruh tanlang</p>
        </div>
      )}

      {/* Loading */}
      {selectedGroupId && isLoading && (
        <div className="card animate-pulse">
          <div className="h-8 bg-gray-100 rounded w-full mb-2" />
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded w-full mb-1" />)}
        </div>
      )}

      {/* No lessons hint */}
      {selectedGroupId && !isLoading && gradebook && lessons.length === 0 && (
        <div className="card text-center py-12 bg-amber-50 border border-amber-100">
          <FileText className="w-10 h-10 mx-auto mb-2 text-amber-300" />
          <p className="text-amber-700 font-medium">Bu oyda darslar yo'q</p>
          <p className="text-sm text-amber-500 mt-1">Avval <strong>Davomat</strong> sahifasida dars va davomat belgilang</p>
        </div>
      )}

      {/* Gradebook table */}
      {selectedGroupId && !isLoading && gradebook && lessons.length > 0 && (
        <div className="card p-0 overflow-hidden">
          {/* Group stats header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100">
            <div className="flex items-center gap-3">
              <Award className="w-4 h-4 text-violet-600" />
              <span className="text-sm font-semibold text-violet-800">
                {currentMonth} · {GRADE_TYPES.find(g => g.value === gradeType)?.emoji} {GRADE_TYPES.find(g => g.value === gradeType)?.label} baholari
              </span>
            </div>
            {groupAvg !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-violet-500">Guruh o'rtachasi:</span>
                <span className={clsx('text-base font-bold', getScoreColor(groupAvg))}>{groupAvg}</span>
              </div>
            )}
          </div>

          <div className="overflow-auto max-h-[65vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-white shadow-sm">
                <tr>
                  <th className="sticky left-0 z-20 bg-white border-b border-r border-gray-100 px-3 py-2.5 text-left font-semibold text-gray-600 text-xs w-8">#</th>
                  <th className="sticky left-8 z-20 bg-white border-b border-r border-gray-100 px-3 py-2.5 text-left font-semibold text-gray-600 text-xs min-w-[160px]">O'quvchi</th>
                  <th className="sticky left-[168px] z-20 bg-white border-b border-r border-gray-200 px-3 py-2.5 text-center font-semibold text-violet-600 text-xs w-16">O'rtacha</th>
                  <th className="border-b border-r border-gray-100 px-2 py-2.5 text-center font-semibold text-emerald-600 text-xs w-14">Davomat</th>

                  {/* Lesson columns */}
                  {lessons.map(lesson => (
                    <th key={lesson.id}
                      className={clsx(
                        'border-b border-r border-gray-100 px-1 py-1.5 text-center text-xs font-medium min-w-[52px] cursor-pointer transition-colors',
                        selectedLessonId === lesson.id
                          ? 'bg-amber-50 text-amber-700 border-b-amber-300'
                          : 'text-gray-500 hover:bg-gray-50'
                      )}
                      onClick={() => !bulkMode ? startBulkLesson(lesson.id) : undefined}
                      title={`${lesson.topic || 'Dars'} — Ommaviy baho kiritish uchun bosing`}
                    >
                      <div className="font-semibold">{format(new Date(lesson.date), 'd')}</div>
                      <div className="text-gray-400 text-[10px]">{format(new Date(lesson.date), 'MMM')}</div>
                      {lesson.topic && <div className="text-gray-300 text-[9px] truncate max-w-[48px] mx-auto" title={lesson.topic}>{lesson.topic.slice(0, 8)}</div>}
                      {selectedLessonId === lesson.id && bulkMode && (
                        <div className="text-[10px] text-amber-600 font-bold">✏️</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4 + lessons.length} className="text-center py-12 text-gray-400">
                      <Layers className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      O'quvchilar yo'q
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr key={row.studentId} className={clsx(
                      'transition-colors',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                      'hover:bg-violet-50/20'
                    )}>
                      {/* # */}
                      <td className="sticky left-0 z-10 border-b border-r border-gray-100 px-3 py-2 text-xs text-gray-400 bg-inherit">{idx + 1}</td>

                      {/* Student name */}
                      <td className="sticky left-8 z-10 border-b border-r border-gray-100 px-3 py-2 bg-inherit">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {getInitials(row.fullName)}
                          </div>
                          <span className="text-gray-800 font-medium text-xs truncate max-w-[120px]">{row.fullName}</span>
                        </div>
                      </td>

                      {/* Avg score */}
                      <td className="sticky left-[168px] z-10 border-b border-r border-gray-200 px-2 py-2 text-center bg-inherit">
                        {row.avgScore !== null ? (
                          <span className={clsx('text-sm', getScoreColor(row.avgScore))}>
                            {row.avgScore}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>

                      {/* Attendance rate */}
                      <td className="border-b border-r border-gray-100 px-2 py-2 text-center">
                        <span className={clsx('text-xs font-medium',
                          row.attendanceRate >= 80 ? 'text-emerald-600' :
                          row.attendanceRate >= 60 ? 'text-amber-500' : 'text-red-400')}>
                          {row.attendanceRate}%
                        </span>
                      </td>

                      {/* Lesson cells */}
                      {row.lessons.map(cell => {
                        const isEditing = editingCell?.studentId === row.studentId && editingCell?.lessonId === cell.lessonId;
                        const isBulkLesson = selectedLessonId === cell.lessonId && bulkMode;
                        const AttIcon = cell.attendance ? ATTENDANCE_ICONS[cell.attendance]?.icon : null;

                        return (
                          <td key={cell.lessonId}
                            className={clsx(
                              'border-b border-r border-gray-100 text-center p-0 relative',
                              isBulkLesson ? 'bg-amber-50' : '',
                              !isBulkLesson && !isEditing ? 'cursor-pointer hover:bg-violet-50' : ''
                            )}
                            onClick={() => {
                              if (!isBulkLesson && !isEditing) {
                                handleCellClick(
                                  row.studentId, cell.lessonId,
                                  cell.grade?.score ?? null,
                                  cell.grade?.id ?? null
                                );
                              }
                            }}
                          >
                            {/* Bulk input */}
                            {isBulkLesson ? (
                              <input
                                type="number"
                                value={bulkGrades[row.studentId] || ''}
                                onChange={e => setBulkGrades(prev => ({ ...prev, [row.studentId]: e.target.value }))}
                                placeholder="—"
                                min="0" max="100" step="1"
                                className="w-full h-9 text-center text-sm font-medium bg-transparent border-none outline-none focus:ring-1 focus:ring-amber-400 px-1"
                              />
                            ) : isEditing ? (
                              <input
                                type="number"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={() => handleCellSave(row.studentId, cell.lessonId, editingCell?.gradeId ?? null)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleCellSave(row.studentId, cell.lessonId, editingCell?.gradeId ?? null);
                                  if (e.key === 'Escape') { setEditingCell(null); setEditValue(''); }
                                }}
                                autoFocus
                                min="0" max="100"
                                className="w-full h-9 text-center text-sm font-bold border-2 border-violet-400 rounded outline-none bg-white px-1"
                              />
                            ) : (
                              <div className="h-9 flex items-center justify-center gap-0.5">
                                {/* Attendance icon */}
                                {AttIcon && (
                                  <AttIcon className={clsx('w-2.5 h-2.5 flex-shrink-0', ATTENDANCE_ICONS[cell.attendance!].color)} />
                                )}
                                {/* Score */}
                                {cell.grade ? (
                                  <span className={clsx('text-xs font-bold px-1 rounded', getScoreColor(cell.grade.score), getScoreBg(cell.grade.score))}>
                                    {cell.grade.score}
                                  </span>
                                ) : cell.attendance === 'ABSENT' ? (
                                  <span className="text-xs text-red-300">—</span>
                                ) : (
                                  <span className="text-gray-200 text-xs">+</span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-400">Legenda:</span>
            {Object.entries(ATTENDANCE_ICONS).map(([status, { icon: Icon, color }]) => (
              <div key={status} className="flex items-center gap-1">
                <Icon className={clsx('w-3 h-3', color)} />
                <span className="text-[11px] text-gray-500">{
                  status === 'PRESENT' ? 'Keldi' : status === 'ABSENT' ? 'Kelmadi' :
                  status === 'LATE' ? 'Kechikdi' : 'Sababli'
                }</span>
              </div>
            ))}
            <span className="text-[11px] text-gray-400 ml-auto">
              Katakchani bosing — baho kiriting · Sana sarlavhasini bosing — ommaviy kiritish
            </span>
          </div>
        </div>
      )}

      {/* Quick Grade Entry Panel (bulk mode floating panel) */}
      {bulkMode && selectedLessonId && gradebook && (
        <div className="fixed bottom-4 right-4 z-30 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-amber-500" /> Ommaviy baho
            </h4>
            <span className="text-xs text-gray-400">
              {lessons.find(l => l.id === selectedLessonId)
                ? format(new Date(lessons.find(l => l.id === selectedLessonId)!.date), 'd-MMMM')
                : ''}
            </span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {rows.map(row => (
              <div key={row.studentId} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 flex-1 truncate">{row.fullName.split(' ')[0]}</span>
                <input
                  type="number" min="0" max="100"
                  value={bulkGrades[row.studentId] || ''}
                  onChange={e => setBulkGrades(prev => ({ ...prev, [row.studentId]: e.target.value }))}
                  placeholder="0–100"
                  className="w-16 input py-1 text-sm text-center"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={cancelBulk} className="flex-1 border border-gray-200 text-gray-600 text-xs py-2 rounded-lg hover:bg-gray-50 transition-colors">Bekor</button>
            <button onClick={saveBulk} disabled={bulkMutation.isLoading}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-60">
              {bulkMutation.isLoading ? '...' : 'Saqlash'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradesPage;
