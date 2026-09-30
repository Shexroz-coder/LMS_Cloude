/**
 * MOLIYA MARKAZI — barcha moliya bo'limlari bitta joyда, toza tab'lar bilan.
 * Avval 5 ta alohida menyu (Moliya, To'lovlar, Qarzdorlar, To'lov boshqaruvi, Oyliklar)
 * edi — endi bitta "Moliya" ostida. Hech qanday imkoniyat yo'qolmadi:
 * har tab mavjud sahifани qayta ishlatadi.
 */
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, CreditCard, AlertCircle, Receipt, Wallet } from 'lucide-react';
import { useBranchManager } from '../../hooks/useBranchManager';

const FinancePage = lazy(() => import('./FinancePage'));
const PaymentsPage = lazy(() => import('./PaymentsPage'));
const AdminDebtorsPage = lazy(() => import('./AdminDebtorsPage'));
const AdminBillingPage = lazy(() => import('./AdminBillingPage'));
const SalariesPage = lazy(() => import('./SalariesPage'));

type TabKey = 'report' | 'payments' | 'debtors' | 'billing' | 'salaries';

const TABS: { key: TabKey; label: string; icon: any; adminOnly?: boolean }[] = [
  { key: 'report',   label: 'Hisobot',          icon: BarChart3 },
  { key: 'payments', label: "To'lovlar",        icon: CreditCard },
  { key: 'debtors',  label: 'Qarzdorlar',       icon: AlertCircle },
  { key: 'billing',  label: "To'lov boshqaruvi", icon: Receipt },
  { key: 'salaries', label: 'Oyliklar',         icon: Wallet, adminOnly: true },
];

const Loader = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-7 h-7 rounded-full border-2 border-neon-cyan/40 border-t-neon-cyan animate-spin" />
  </div>
);

export default function FinanceHub() {
  const [params, setParams] = useSearchParams();
  const { isManager } = useBranchManager();
  const tabs = TABS.filter(t => !t.adminOnly || !isManager);

  const raw = (params.get('tab') || 'report') as TabKey;
  const tab = tabs.some(t => t.key === raw) ? raw : 'report';

  const setTab = (k: TabKey) => setParams(prev => { prev.set('tab', k); return prev; }, { replace: true });

  return (
    <div className="space-y-4">
      {/* Segmented tab bar */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-gray-100 dark:bg-gray-800/60 p-1 rounded-2xl">
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                active
                  ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <Suspense fallback={<Loader />}>
        {tab === 'report' && <FinancePage />}
        {tab === 'payments' && <PaymentsPage />}
        {tab === 'debtors' && <AdminDebtorsPage />}
        {tab === 'billing' && <AdminBillingPage />}
        {tab === 'salaries' && <SalariesPage />}
      </Suspense>
    </div>
  );
}
