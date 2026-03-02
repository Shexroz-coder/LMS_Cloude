import { useQuery } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';
import { Coins, TrendingUp, TrendingDown, Trophy } from 'lucide-react';

interface CoinTransaction {
  id: number;
  amount: number;
  type: string;
  reason?: string;
  createdAt: string;
  giver?: { fullName: string };
}

const TYPE_ICONS: Record<string, string> = {
  REWARD:   '⭐',
  PENALTY:  '❌',
  BONUS:    '🎁',
  EXCHANGE: '🔄',
};
const TYPE_LABELS: Record<string, string> = {
  REWARD:   'Mukofot',
  PENALTY:  'Jarima',
  BONUS:    'Bonus',
  EXCHANGE: 'Almashtirish',
};

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const StudentCoinsPage = () => {
  const { data: profile } = useQuery('student-profile-coins', async () => {
    const r = await api.get('/auth/me');
    return r.data?.data;
  });

  const studentId = profile?.student?.id;
  const coinBalance: number = profile?.student?.coinBalance || 0;

  const { data, isLoading } = useQuery(
    ['coin-history', studentId],
    async () => {
      const r = await api.get(`/coins/history/${studentId}`);
      return r.data?.data;
    },
    { enabled: !!studentId }
  );

  const { data: leaderboard = [] } = useQuery('leaderboard-student', async () => {
    const r = await api.get('/coins/leaderboard?limit=10');
    return r.data?.data || [];
  });

  const transactions: CoinTransaction[] = data?.transactions || [];
  const myRank = (leaderboard as { id: number }[]).findIndex(s => s.id === studentId) + 1;

  const earned = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spent   = Math.abs(transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Hero balance card */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Coins size={18} className="text-amber-200" />
              <p className="text-amber-100 text-sm font-medium">Coin balansi</p>
            </div>
            <p className="text-5xl font-black mt-1">🪙 {coinBalance.toLocaleString()}</p>
            {myRank > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
                <Trophy size={12} className="text-amber-200" />
                <span className="text-xs font-semibold text-amber-100">
                  Reyting: #{myRank} o'rin
                </span>
              </div>
            )}
          </div>
          <div className="text-7xl opacity-20">🏆</div>
        </div>

        {/* Earned / spent summary */}
        <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-white/20">
          <div className="bg-white/10 rounded-xl p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-400/30 flex items-center justify-center">
              <TrendingUp size={14} className="text-emerald-200" />
            </div>
            <div>
              <p className="text-amber-100 text-xs">Jami olindi</p>
              <p className="font-bold text-lg">+{earned.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-400/30 flex items-center justify-center">
              <TrendingDown size={14} className="text-red-200" />
            </div>
            <div>
              <p className="text-amber-100 text-xs">Sarflandi</p>
              <p className="font-bold text-lg">-{spent.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-amber-500" />
            <h3 className="font-bold text-gray-800">Reyting Jadvali</h3>
          </div>

          {/* Top 3 podium */}
          {(() => {
            const top3 = (leaderboard as { id: number; rank: number; fullName: string; coinBalance: number }[]).slice(0, 3);
            return (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[top3[1], top3[0], top3[2]].filter(Boolean).map((s, visualIdx) => {
                  const heights = ['h-16', 'h-20', 'h-14'];
                  const isMe = s.id === studentId;
                  const actualRank = visualIdx === 0 ? 2 : visualIdx === 1 ? 1 : 3;
                  const colors = [
                    'from-gray-300 to-gray-400',   // 2nd
                    'from-amber-400 to-amber-500',  // 1st
                    'from-orange-300 to-orange-400' // 3rd
                  ];
                  return (
                    <div key={s.id} className="flex flex-col items-center gap-1">
                      <div className={clsx(
                        'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-1',
                        isMe ? 'ring-2 ring-red-500 ring-offset-1' : '',
                        `bg-gradient-to-br ${colors[visualIdx]}`
                      )}>
                        {s.fullName.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-xs font-semibold text-gray-700 text-center truncate max-w-full px-1">
                        {s.fullName.split(' ')[0]}
                        {isMe && <span className="text-red-500"> (Men)</span>}
                      </p>
                      <p className="text-xs text-amber-600 font-bold">🪙 {s.coinBalance}</p>
                      <div className={clsx(
                        `w-full ${heights[visualIdx]} rounded-t-lg flex items-center justify-center text-xl bg-gradient-to-b`,
                        colors[visualIdx]
                      )}>
                        {MEDAL[actualRank]}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Full list */}
          <div className="space-y-1">
            {(leaderboard as { id: number; rank: number; fullName: string; coinBalance: number }[]).map(s => {
              const isMe = s.id === studentId;
              return (
                <div
                  key={s.id}
                  className={clsx(
                    'flex items-center justify-between px-3 py-2.5 rounded-xl transition',
                    isMe
                      ? 'bg-red-50 border border-red-100'
                      : 'hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base w-7 text-center">
                      {MEDAL[s.rank] || `${s.rank}.`}
                    </span>
                    <span className={clsx(
                      'text-sm font-medium',
                      isMe ? 'text-red-700' : 'text-gray-700'
                    )}>
                      {s.fullName}
                      {isMe && <span className="ml-1 text-xs text-red-400">(Men)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-600">🪙 {s.coinBalance.toLocaleString()}</span>
                    {isMe && (
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Coins size={16} className="text-amber-500" />
          <h3 className="font-bold text-gray-800">Tranzaksiyalar tarixi</h3>
          {transactions.length > 0 && (
            <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {transactions.length} ta
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-10">
            <div className="animate-spin w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Yuklanmoqda...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-10 text-gray-300">
            <div className="text-5xl mb-3">🪙</div>
            <p className="text-sm text-gray-400">Hali tranzaksiyalar yo'q</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map(t => (
              <div
                key={t.id}
                className={clsx(
                  'flex items-center justify-between p-3 rounded-xl border transition',
                  t.amount > 0
                    ? 'border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50'
                    : 'border-red-100 bg-red-50/50 hover:bg-red-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0',
                    t.amount > 0 ? 'bg-emerald-100' : 'bg-red-100'
                  )}>
                    {TYPE_ICONS[t.type] || '🪙'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {t.reason || TYPE_LABELS[t.type] || t.type}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.giver ? `${t.giver.fullName} · ` : ''}
                      {new Date(t.createdAt).toLocaleDateString('uz-UZ', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                <span className={clsx(
                  'font-bold text-base flex-shrink-0',
                  t.amount > 0 ? 'text-emerald-600' : 'text-red-500'
                )}>
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
