import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';
import { Star, TrendingUp, Award, ChevronDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GradeItem {
  id: number;
  score: number;
  type: 'HOMEWORK' | 'CLASSWORK' | 'EXAM' | 'PROJECT';
  comment?: string;
  givenAt: string;
  lesson: {
    id: number;
    topic: string;
    date: string;
    group: { name: string };
  };
}

interface StudentGradeStats {
  avgScore: number;
  bestScore: number;
  worstScore: number;
  total: number;
  byType: {
    HOMEWORK?: { avg: number; count: number };
    CLASSWORK?: { avg: number; count: number };
    EXAM?: { avg: number; count: number };
    PROJECT?: { avg: number; count: number };
  };
}

interface StudentGradesResponse {
  grades: GradeItem[];
  stats: StudentGradeStats;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const GRADE_TYPES = ['HOMEWORK', 'CLASSWORK', 'EXAM', 'PROJECT'] as const;
type GradeType = (typeof GRADE_TYPES)[number];

const TYPE_LABELS: Record<GradeType, string> = {
  HOMEWORK: "Uy vazifasi",
  CLASSWORK: "Dars ishi",
  EXAM: "Imtihon",
  PROJECT: "Loyiha",
};

const TYPE_COLORS: Record<GradeType, string> = {
  HOMEWORK:  "bg-blue-100 text-blue-700",
  CLASSWORK: "bg-violet-100 text-violet-700",
  EXAM:      "bg-rose-100 text-rose-700",
  PROJECT:   "bg-amber-100 text-amber-700",
};

const TYPE_ICONS: Record<GradeType, string> = {
  HOMEWORK:  "📝",
  CLASSWORK: "📖",
  EXAM:      "🎯",
  PROJECT:   "🏗️",
};

const TYPE_BAR_COLORS: Record<GradeType, string> = {
  HOMEWORK:  'bg-blue-400',
  CLASSWORK: 'bg-violet-400',
  EXAM:      'bg-rose-400',
  PROJECT:   'bg-amber-400',
};

// ─── Score helpers ─────────────────────────────────────────────────────────────
function getScoreColor(score: number) {
  if (score >= 91) return { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', bar: 'bg-violet-500', stroke: '#7c3aed' };
  if (score >= 76) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500', stroke: '#059669' };
  if (score >= 61) return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-500', stroke: '#d97706' };
  if (score >= 41) return { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', bar: 'bg-orange-500', stroke: '#ea580c' };
  return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', bar: 'bg-red-500', stroke: '#dc2626' };
}

function getScoreLabel(score: number) {
  if (score >= 91) return "A'lo";
  if (score >= 76) return 'Yaxshi';
  if (score >= 61) return 'Qoniqarli';
  if (score >= 41) return 'Past';
  return 'Qoniqarsiz';
}

function getLetterGrade(score: number) {
  if (score >= 91) return 'A';
  if (score >= 76) return 'B';
  if (score >= 61) return 'C';
  if (score >= 41) return 'D';
  return 'F';
}

// ─── Circular score widget ────────────────────────────────────────────────────
function ScoreCircle({ score, size = 110 }: { score: number; size?: number }) {
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const color = getScoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none"
        stroke={color.stroke}
        strokeWidth={8}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
      />
      <text
        x={size/2} y={size/2}
        textAnchor="middle" dominantBaseline="middle"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px`, fill: color.stroke, fontWeight: 700, fontSize: size * 0.24 }}
      >
        {score.toFixed(0)}
      </text>
      <text
        x={size/2} y={size/2 + size*0.18}
        textAnchor="middle" dominantBaseline="middle"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px`, fill: '#9ca3af', fontSize: size * 0.11 }}
      >
        / 100
      </text>
    </svg>
  );
}

// ─── Month options ─────────────────────────────────────────────────────────────
function getMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })
    });
  }
  return months;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function StudentGradesPage() {
  const [month, setMonth] = useState('');
  const [typeFilter, setTypeFilter] = useState<GradeType | 'ALL'>('ALL');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const months = getMonthOptions();

  const { data: profileData } = useQuery(
    ['my-profile-grades'],
    () => api.get('/auth/me').then(r => r.data?.data)
  );

  const studentId = profileData?.student?.id;

  const { data, isLoading } = useQuery<StudentGradesResponse>(
    ['student-grades', studentId, month, typeFilter],
    async () => {
      const params = new URLSearchParams();
      if (month) params.set('month', month);
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      const r = await api.get(`/grades/student/${studentId}?${params}`);
      return r.data?.data;
    },
    { enabled: !!studentId }
  );

  const grades = data?.grades || [];
  const stats = data?.stats;

  const sorted = [...grades].sort((a, b) => {
    const da = new Date(a.lesson.date).getTime();
    const db = new Date(b.lesson.date).getTime();
    return sortAsc ? da - db : db - da;
  });

  const grouped = sorted.reduce<Record<string, GradeItem[]>>((acc, g) => {
    const date = g.lesson.date.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(g);
    return acc;
  }, {});

  const groupKeys = Object.keys(grouped);

  function fmtDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-black p-5 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Star size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Mening Baholarim</h1>
            <p className="text-red-200 text-xs">Barcha baholaring va statistika</p>
          </div>
        </div>
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{stats.avgScore?.toFixed(1) || '—'}</p>
              <p className="text-red-200 text-xs mt-0.5">O'rtacha</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{stats.bestScore ?? '—'}</p>
              <p className="text-red-200 text-xs mt-0.5">Eng yuqori</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-red-200 text-xs mt-0.5">Jami baho</p>
            </div>
          </div>
        )}
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Average score */}
          <div className="card flex flex-col items-center justify-center py-6">
            <p className="text-xs text-gray-500 mb-3 font-medium">O'rtacha ball</p>
            <ScoreCircle score={stats.avgScore || 0} size={110} />
            <div className="mt-3">
              <span className={clsx(
                "px-3 py-1 rounded-full text-sm font-bold",
                getScoreColor(stats.avgScore || 0).bg,
                getScoreColor(stats.avgScore || 0).text
              )}>
                {getLetterGrade(stats.avgScore || 0)} – {getScoreLabel(stats.avgScore || 0)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2">{stats.total} ta baho asosida</p>
          </div>

          {/* Best / worst */}
          <div className="card flex flex-col gap-4 justify-center">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
              <div>
                <p className="text-xs text-gray-500">Eng yuqori ball</p>
                <p className="text-3xl font-bold text-emerald-600 mt-0.5">{stats.bestScore ?? '—'}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl">🏆</div>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
              <div>
                <p className="text-xs text-gray-500">Eng past ball</p>
                <p className="text-3xl font-bold text-red-600 mt-0.5">{stats.worstScore ?? '—'}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl">📉</div>
            </div>
          </div>

          {/* By type breakdown */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-red-500" />
              <p className="text-sm font-semibold text-gray-700">Tur bo'yicha o'rtacha</p>
            </div>
            <div className="space-y-3">
              {GRADE_TYPES.map(t => {
                const info = stats.byType?.[t];
                if (!info) return (
                  <div key={t} className="flex items-center gap-2">
                    <span className="text-xs w-32 text-gray-300">{TYPE_ICONS[t]} {TYPE_LABELS[t]}</span>
                    <span className="text-xs text-gray-200 italic">yo'q</span>
                  </div>
                );
                return (
                  <div key={t}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">{TYPE_ICONS[t]} {TYPE_LABELS[t]}</span>
                      <span className="text-xs text-gray-400">{info.count} ta · {info.avg.toFixed(0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={clsx("h-full rounded-full", TYPE_BAR_COLORS[t])}
                          style={{ width: `${Math.min(info.avg, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Type filter pills */}
        <div className="flex flex-wrap gap-2 flex-1">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={clsx(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition border",
              typeFilter === 'ALL'
                ? "bg-red-600 text-white border-red-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:bg-red-50"
            )}
          >
            Barchasi {stats && `(${stats.total})`}
          </button>
          {GRADE_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={clsx(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition border",
                typeFilter === t
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:bg-red-50"
              )}
            >
              {TYPE_ICONS[t]} {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-300 text-gray-600"
          >
            <option value="">Barcha oylar</option>
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <button
            onClick={() => setSortAsc(p => !p)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 text-gray-600 transition"
          >
            {sortAsc ? '↑ Eski' : '↓ Yangi'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="card text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Baholar yuklanmoqda...</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && groupKeys.length === 0 && (
        <div className="card text-center py-16">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Award size={36} className="text-red-300" />
          </div>
          <h2 className="text-lg font-bold text-gray-700">Baholar topilmadi</h2>
          <p className="text-gray-400 text-sm mt-1">Hali baho qo'yilmagan yoki filtr bo'yicha natija yo'q</p>
        </div>
      )}

      {/* Grades list grouped by date */}
      {!isLoading && groupKeys.length > 0 && (
        <div className="space-y-6">
          {groupKeys.map(date => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm font-semibold text-gray-600">{fmtDate(date)}</span>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">{grouped[date].length} ta baho</span>
              </div>

              <div className="space-y-3 ml-5">
                {grouped[date].map(grade => {
                  const colors = getScoreColor(grade.score);
                  const isExpanded = expanded === grade.id;
                  return (
                    <div
                      key={grade.id}
                      className={clsx("rounded-2xl border p-4 cursor-pointer transition", colors.border, "bg-white hover:shadow-sm")}
                      onClick={() => setExpanded(isExpanded ? null : grade.id)}
                    >
                      <div className="flex items-center gap-4">
                        {/* Score badge */}
                        <div className={clsx("w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0", colors.bg)}>
                          <span className={clsx("text-xl font-bold", colors.text)}>{grade.score}</span>
                          <span className={clsx("text-[10px] font-semibold", colors.text)}>{getLetterGrade(grade.score)}</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800 text-sm">{grade.lesson.topic}</span>
                            <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", TYPE_COLORS[grade.type])}>
                              {TYPE_ICONS[grade.type]} {TYPE_LABELS[grade.type]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">📚 {grade.lesson.group.name}</p>
                          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[200px]">
                            <div
                              className={clsx("h-full rounded-full", colors.bar)}
                              style={{ width: `${grade.score}%` }}
                            />
                          </div>
                        </div>

                        {/* Expand */}
                        <ChevronDown
                          size={16}
                          className={clsx("text-gray-400 transition-transform flex-shrink-0", isExpanded && "rotate-180")}
                        />
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className={clsx("rounded-xl p-3", colors.bg)}>
                              <p className="text-xs text-gray-400">Ball</p>
                              <p className={clsx("font-bold text-xl mt-0.5", colors.text)}>{grade.score} / 100</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3">
                              <p className="text-xs text-gray-400">Daraja</p>
                              <p className="font-bold text-lg text-gray-700 mt-0.5">{getLetterGrade(grade.score)} – {getScoreLabel(grade.score)}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3">
                              <p className="text-xs text-gray-400">Dars mavzusi</p>
                              <p className="text-sm font-medium text-gray-700 mt-0.5">{grade.lesson.topic}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3">
                              <p className="text-xs text-gray-400">Guruh</p>
                              <p className="text-sm font-medium text-gray-700 mt-0.5">{grade.lesson.group.name}</p>
                            </div>
                          </div>

                          {grade.comment && (
                            <div className={clsx("p-3 rounded-xl text-sm", colors.bg)}>
                              <p className="text-xs text-gray-400 mb-1">📝 O'qituvchi izohi</p>
                              <p className={clsx("font-medium italic", colors.text)}>"{grade.comment}"</p>
                            </div>
                          )}

                          {/* Score bar visualization */}
                          <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
                            </div>
                            <div className="relative h-4 bg-gradient-to-r from-red-200 via-amber-200 via-emerald-200 to-violet-200 rounded-full overflow-hidden">
                              <div
                                className="absolute top-0 h-full w-1 bg-gray-800 rounded-full shadow"
                                style={{ left: `calc(${grade.score}% - 2px)` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs mt-1">
                              <span className="text-red-400">F</span>
                              <span className="text-orange-400">D</span>
                              <span className="text-amber-400">C</span>
                              <span className="text-emerald-400">B</span>
                              <span className="text-violet-400">A</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="card bg-gray-50">
        <p className="text-xs font-semibold text-gray-500 mb-2">Baho shkalasi</p>
        <div className="flex flex-wrap gap-2">
          {[
            { range: '91–100', label: 'A – A\'lo',       color: 'text-violet-700 bg-violet-100' },
            { range: '76–90',  label: 'B – Yaxshi',      color: 'text-emerald-700 bg-emerald-100' },
            { range: '61–75',  label: 'C – Qoniqarli',   color: 'text-amber-700 bg-amber-100' },
            { range: '41–60',  label: 'D – Past',        color: 'text-orange-700 bg-orange-100' },
            { range: '0–40',   label: 'F – Qoniqarsiz',  color: 'text-red-700 bg-red-100' },
          ].map(item => (
            <span key={item.range} className={clsx("px-2.5 py-1 rounded-full text-xs font-semibold", item.color)}>
              {item.range}: {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
