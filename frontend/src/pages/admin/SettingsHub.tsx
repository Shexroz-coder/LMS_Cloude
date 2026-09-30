/**
 * SOZLAMALAR MARKAZI — Filiallar, Inventar, Arxiv, Ruxsatlar bitta joyда.
 * Avval 4 ta alohida menyu edi. Moliya markazи kabi segment-tab.
 */
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Package, Archive, ShieldCheck } from 'lucide-react';

const BranchesPage = lazy(() => import('./BranchesPage'));
const InventoryPage = lazy(() => import('./InventoryPage'));
const ArchivesPage = lazy(() => import('./ArchivesPage'));
const PermissionsPage = lazy(() => import('./PermissionsPage'));

type TabKey = 'branches' | 'inventory' | 'archives' | 'permissions';
const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'branches',    label: 'Filiallar',  icon: Building2 },
  { key: 'inventory',   label: 'Inventar',   icon: Package },
  { key: 'archives',    label: 'Arxiv',      icon: Archive },
  { key: 'permissions', label: 'Ruxsatlar',  icon: ShieldCheck },
];

const Loader = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-7 h-7 rounded-full border-2 border-neon-cyan/40 border-t-neon-cyan animate-spin" />
  </div>
);

export default function SettingsHub() {
  const [params, setParams] = useSearchParams();
  const raw = (params.get('tab') || 'branches') as TabKey;
  const tab = TABS.some(t => t.key === raw) ? raw : 'branches';
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
        {tab === 'branches' && <BranchesPage />}
        {tab === 'inventory' && <InventoryPage />}
        {tab === 'archives' && <ArchivesPage />}
        {tab === 'permissions' && <PermissionsPage />}
      </Suspense>
    </div>
  );
}
