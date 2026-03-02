import { useQuery } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';

interface CoinTransaction {
  id: number;
  amount: number;
  type: string;
  reason?: string;
  createdAt: string;
  giver?: { fullName: string };
}

const TYPE_ICONS: Record<string, string> = { REWARD: '⭐', PENALTY: '❌', BONUS: '🎁', EXCHANGE: '🔄' };
const TYPE_LABELS: Record<string, string> = { REWARD: 'Mukofot', PENALTY: 'Jarima', BONUS: 'Bonus', EXCHANGE: 'Almashtirish' };

const StudentCoinsPage = () => {
  const { data: profile } = useQuery('student-profile-coins', async () => {
    const r = await api.get('/auth/me');
    return r.data?.data;
  });

  const studentId = profile?.student?.id;
  const coinBalance = profile?.student?.coinBalance || 0;

  const { data, isLoading } = useQuery(['coin-history', studentId], async () => {
    if (!studentId) return null;
    const r = await api.get(`/coins/history/${studentId}`);
    return r.data?.data;
  }, { enabled: !!studentId });

  const { data: leaderboard = [] } = useQuery('leaderboard-student', async () => {
    const r = await api.get('/coins/leaderboard?limit=10');
    return r.data?.data || [];
  });

  const transactions: CoinTransaction[] = data?.transactions || [];
  const myRank = leaderboard.findIndex((s: { id: number }) => s.id === studentId) + 1;

  const earned = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spent = Math.abs(transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-xl font-bold text-gray-900">Mening Coinlarim</h1>

      {/* Balance card */}
      <div className="card bg-gradient-to-br from-amber-400 to-orange-500 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-amber-100 text-sm">Joriy balans</p>
            <p className="text-4xl font-bold mt-1">🪙 {coinBalance}</p>
            <p className="text-amber-100 text-sm mt-2">
              {myRank > 0 ? `Reyting: #${myRank}` : ''}
            </p>
          </div>
          <div className="text-6xl opacity-20">🏆</div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/20">
          <div>
            <p className="text-amber-100 text-xs">Jami olindi</p>
            <p className="font-bold text-lg">+{earned}</p>
          </div>
          <div>
            <p className="text-amber-100 text-xs">Sarflandi</p>
            <p className="font-bold text-lg">-{spent}</p>
          </div>
        </div>
      </div>

      {/* Top 3 reyting */}
      {leaderboard.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">🏆 Reyting</h3>
          <div className="space-y-2">
            {leaderboard.slice(0, 10).map((s: { id: number; rank: number; fullName: string; coinBalance: number }) => {
              const isMe = s.id === studentId;
              return (
                <div key={s.id} className={clsx(
                  "flex items-center justify-between py-2 px-3 rounded-xl",
                  isMe ? "bg-amber-50 border border-amber-200" : "hover:bg-gray-50"
                )}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg w-6">{s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `${s.rank}.`}</span>
                    <span className={clsx("text-sm font-medium", isMe ? "text-amber-700" : "text-gray-700")}>
                      {s.fullName} {isMe && <span className="text-xs">(Men)</span>}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-amber-600">🪙 {s.coinBalance}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Tranzaksiyalar tarixi</h3>
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Yuklanmoqda...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-300">
            <div className="text-4xl mb-2">🪙</div>
            <p className="text-sm">Hali tranzaksiyalar yo'q</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{TYPE_ICONS[t.type] || '🪙'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {t.reason || TYPE_LABELS[t.type] || t.type}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t.giver ? `${t.giver.fullName} · ` : ''}
                      {new Date(t.createdAt).toLocaleDateString('uz-UZ')}
                    </p>
                  </div>
                </div>
                <span className={clsx("font-bold text-base", t.amount > 0 ? "text-emerald-600" : "text-red-500")}>
                  {t.amount > 0 ? '+' : ''}{t.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentCoinsPage;
