/**
 * HISOBOTLAR MARKAZI — Hisobotlar + Davomat export bitta joyда.
 */
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, ClipboardCheck } from 'lucide-react';

const ReportsPage = lazy(() => import('./ReportsPage'));
const AttendanceExportPage = lazy(() => import('./AttendanceExportPage'));

type TabKey = 'reports' | 'attendance';
const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'reports',    label: 'Hisobotlar',      icon: FileText },
  { key: 'attendance', label: 'Davomat export',  icon: ClipboardCheck },
];

const Loader = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-7 h-7 rounded-full border-2 border-neon-cyan/40 border-t-neon-cyan animate-spin" />
  </div>
);

export default function ReportsHub() {
  const [params, setParams] = useSearchParams();
  const raw = (params.get('tab') || 'reports') as TabKey;
  const tab = TABS.some(t => t.key === raw) ? raw : 'reports';
  const setTab = (k: TabKey) => setParams(prev => { prev.set('tab', k); return prev; }, { replace: true });

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-gray-100 dark:bg-gray-800/60 p-1 rounded-2xl">
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                active ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                       : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>
      <Suspense fallback={<Loader />}>
        {tab === 'reports' && <ReportsPage />}
        {tab === 'attendance' && <AttendanceExportPage />}
      </Suspense>
    </div>
  );
}
