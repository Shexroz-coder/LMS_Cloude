/**
 * Founder — barcha filiallar bo'yicha guruhlar va ulardagi o'quvchilar.
 * Filial bo'yicha filtrlash + guruhni ochib o'quvchilarини ko'rish.
 */
import { useState } from 'react';
import { useQuery } from 'react-query';
import { BookOpen, ChevronDown, Users, Building2 } from 'lucide-react';
import api from '../../api/axios';

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v || 0));

export default function FounderGroups() {
  const [branchId, setBranchId] = useState<string>('');
  const [openId, setOpenId] = useState<number | null>(null);

  const { data: branches = [] } = useQuery<any[]>(['branches'],
    () => api.get('/branches').then(r => r.data?.data ?? []).catch(() => []));

  const { data: groups = [], isLoading } = useQuery<any[]>(
    ['founder-groups', branchId],
    () => api.get('/founder/groups', { params: { branchId: branchId || undefined } }).then(r => r.data?.data ?? []),
    { staleTime: 30_000 }
  );

  const totalStudents = groups.reduce((s, g) => s + (g.studentsCount || 0), 0);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-violet-500" /> Guruhlar
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
          {groups.length} guruh · {totalStudents} o'quvchi
        </p>
      </div>

      {/* Filial filtri */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <button onClick={() => setBranchId('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${branchId === '' ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-gray-800 text-zinc-600 dark:text-zinc-300'}`}>
          Barcha filiallar
        </button>
        {branches.map((b: any) => (
          <button key={b.id} onClick={() => setBranchId(String(b.id))}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${branchId === String(b.id) ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-gray-800 text-zinc-600 dark:text-zinc-300'}`}>
            {b.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-zinc-400 text-sm">Yuklanmoqда...</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 text-sm">Guruh topilmadi</div>
      ) : (
        <div className="space-y-2">
          {groups.map((g: any) => (
            <div key={g.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-zinc-200 dark:border-gray-700 overflow-hidden">
              <button onClick={() => setOpenId(openId === g.id ? null : g.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">{g.name}</div>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{g.branch}</span>
                    <span>· {g.course}</span>
                    <span>· 👤 {g.teacher}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="flex items-center gap-1 text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-gray-900/50 px-2 py-1 rounded-full">
                    <Users className="w-3 h-3" />{g.studentsCount}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${openId === g.id ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {openId === g.id && (
                <div className="border-t border-zinc-100 dark:border-gray-700 divide-y divide-zinc-50 dark:divide-gray-700/50">
                  {g.students.length === 0 ? (
                    <p className="text-xs text-zinc-400 px-4 py-3">O'quvchi yo'q</p>
                  ) : g.students.map((s: any, i: number) => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <div className="text-sm text-zinc-800 dark:text-zinc-100 truncate">{s.name}</div>
                          <div className="text-[11px] text-zinc-400">{s.phone}</div>
                        </div>
                      </div>
                      {s.debt > 0 && (
                        <span className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full flex-shrink-0">
                          Qarz: {fmt(s.debt)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
