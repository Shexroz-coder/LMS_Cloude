/**
 * Ta'sischi — So'nggi to'lovlar (faqat ko'rish).
 */
import { useQuery } from 'react-query';
import { CreditCard } from 'lucide-react';
import api from '../../api/axios';

const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v || 0));
const METHODS: Record<string, string> = { CASH: 'Naqd', CARD: 'Karta', TRANSFER: "O'tkazma", ONLINE: 'Online' };

export default function FounderPayments() {
  const { data, isLoading } = useQuery(
    ['founder-payments'],
    () => api.get('/payments?limit=50').then(r => r.data?.data),
    { staleTime: 30_000 }
  );

  const payments = data?.payments ?? [];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-emerald-500" /> So'nggi to'lovlar
      </h1>

      {isLoading ? (
        <div className="text-center py-20 text-zinc-400">Yuklanmoqda...</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">To'lovlar yo'q</div>
      ) : (
        <div className="space-y-2">
          {payments.map((p: any) => (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-zinc-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium text-zinc-800 dark:text-zinc-100 truncate">
                  {p.student?.user?.fullName || p.studentName || '—'}
                </div>
                <div className="text-xs text-zinc-400">
                  {new Date(p.paidAt).toLocaleDateString('uz-UZ')} · {METHODS[p.paymentMethod] || p.paymentMethod}
                </div>
              </div>
              <div className="font-bold text-emerald-600 flex-shrink-0">{fmt(Number(p.amount))} so'm</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
