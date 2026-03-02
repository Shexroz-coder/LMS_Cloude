import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';
import api from '../../api/axios';

interface LeaderboardEntry {
  rank: number; id: number; fullName: string;
  avatarUrl?: string; coinBalance: number; groups: string[];
}

const QUICK_AMOUNTS = [1, 2, 3, 4, 5];
const MAX_COINS = 5;
const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_BG = ['from-amber-400 to-yellow-300', 'from-slate-400 to-gray-300', 'from-orange-400 to-amber-300'];
const RANK_HEIGHT = ['h-32', 'h-24', 'h-16'];

// ── Coin icon SVG ───────────────────────────────
const CoinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" />
    <text x="12" y="16" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">C</text>
  </svg>
);

// ── Search icon SVG ─────────────────────────────
const SearchIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// ── Avatar ──────────────────────────────────────
const Avatar = ({ name, size = 'md', rank }: { name: string; size?: 'sm' | 'md' | 'lg'; rank?: number }) => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const sizeClass = size === 'lg' ? 'w-14 h-14 text-base' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  const gradient = rank === 1 ? 'from-amber-400 to-yellow-500' :
                   rank === 2 ? 'from-slate-400 to-gray-500' :
                   rank === 3 ? 'from-orange-400 to-amber-500' :
                   'from-violet-500 to-purple-600';
  return (
    <div className={clsx('rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold flex-shrink-0', sizeClass, gradient)}>
      {initials}
    </div>
  );
};

// ══════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════
const CoinsPage = () => {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState<'award' | 'deduct' | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const { data: leaderboard = [], isLoading } = useQuery<LeaderboardEntry[]>(
    ['coin-leaderboard', selectedGroupId],
    () => api.get('/coins/leaderboard', {
      params: { groupId: selectedGroupId || undefined, limit: 50 }
    }).then(r => r.data.data).catch(() => [])
  );

  const { data: groups = [] } = useQuery('groups-list-coins',
    () => api.get('/groups', { params: { limit: 100, status: 'ACTIVE' } })
      .then(r => r.data.data).catch(() => [])
  );

  const totalCoins = leaderboard.reduce((s, e) => s + e.coinBalance, 0);
  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header banner ─────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-400 p-6 text-white shadow-lg">
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -right-4 -bottom-10 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute right-20 -top-4 w-20 h-20 rounded-full bg-white/10" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">🪙</span>
              <h1 className="text-2xl font-extrabold tracking-tight">Coin Reytingi</h1>
            </div>
            <p className="text-amber-100 text-sm">
              O'quvchilarni rag'batlantirish tizimi · {leaderboard.length} ta ishtirokchi
            </p>
          </div>

          {/* Stats row */}
          <div className="flex gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center">
              <div className="text-xl font-extrabold">{totalCoins}</div>
              <div className="text-xs text-amber-100">Jami coin</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center">
              <div className="text-xl font-extrabold">{leaderboard.filter(e => e.coinBalance > 0).length}</div>
              <div className="text-xs text-amber-100">Faol o'q.</div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="relative z-10 mt-4 flex gap-2">
          <button
            onClick={() => setShowModal('award')}
            className="flex items-center gap-1.5 bg-white text-amber-600 font-bold px-4 py-2 rounded-xl text-sm shadow hover:shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0">
            ➕ Coin berish
          </button>
          <button
            onClick={() => setShowModal('deduct')}
            className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm border border-white/30 text-white font-semibold px-4 py-2 rounded-xl text-sm hover:bg-white/30 transition-all">
            ➖ Jarima
          </button>
        </div>
      </div>

      {/* ── Filter ────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <select
            value={selectedGroupId}
            onChange={e => setSelectedGroupId(e.target.value)}
            className="pl-3 pr-8 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 appearance-none min-w-[170px]">
            <option value="">🏫 Barcha guruhlar</option>
            {(groups as { id: number; name: string }[]).map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▼</span>
        </div>
        {selectedGroupId && (
          <button onClick={() => setSelectedGroupId('')}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100">
            ✕ Tozalash
          </button>
        )}
      </div>

      {/* ── Podium Top-3 ─────────────────────────── */}
      {!isLoading && topThree.length >= 3 && (
        <div className="card bg-gradient-to-b from-amber-50 to-white border border-amber-100 overflow-hidden">
          <h3 className="text-center text-sm font-bold text-amber-700 uppercase tracking-widest mb-5">
            🏆 Top 3 — Eng ko'p coin yig'ganlar
          </h3>
          <div className="flex items-end justify-center gap-3 px-4">
            {/* 2nd */}
            <div className="flex flex-col items-center gap-2 mb-0">
              <Avatar name={topThree[1].fullName} size="md" rank={2} />
              <div className="text-center">
                <div className="text-xs font-semibold text-gray-700 max-w-[70px] truncate">{topThree[1].fullName.split(' ')[0]}</div>
                <div className="text-sm font-bold text-gray-500">🥈 {topThree[1].coinBalance} 🪙</div>
              </div>
              <div className={clsx('w-20 rounded-t-xl flex items-end justify-center pb-2 bg-gradient-to-t', MEDAL_BG[1], RANK_HEIGHT[1])}>
                <span className="text-2xl">2</span>
              </div>
            </div>
            {/* 1st */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl animate-bounce">👑</div>
              <Avatar name={topThree[0].fullName} size="lg" rank={1} />
              <div className="text-center">
                <div className="text-sm font-bold text-gray-800 max-w-[80px] truncate">{topThree[0].fullName.split(' ')[0]}</div>
                <div className="text-base font-extrabold text-amber-600">🥇 {topThree[0].coinBalance} 🪙</div>
              </div>
              <div className={clsx('w-24 rounded-t-xl flex items-end justify-center pb-2 bg-gradient-to-t shadow-lg', MEDAL_BG[0], RANK_HEIGHT[0])}>
                <span className="text-3xl font-black text-white/80">1</span>
              </div>
            </div>
            {/* 3rd */}
            <div className="flex flex-col items-center gap-2 mb-0">
              <Avatar name={topThree[2].fullName} size="md" rank={3} />
              <div className="text-center">
                <div className="text-xs font-semibold text-gray-700 max-w-[70px] truncate">{topThree[2].fullName.split(' ')[0]}</div>
                <div className="text-sm font-bold text-orange-400">🥉 {topThree[2].coinBalance} 🪙</div>
              </div>
              <div className={clsx('w-20 rounded-t-xl flex items-end justify-center pb-2 bg-gradient-to-t', MEDAL_BG[2], RANK_HEIGHT[2])}>
                <span className="text-xl">3</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Full leaderboard ──────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-amber-100 bg-amber-50 flex items-center justify-between">
          <h3 className="font-bold text-amber-800 text-sm flex items-center gap-1.5">
            🏅 To'liq reyting jadval
          </h3>
          <span className="text-xs text-amber-600 font-medium">{leaderboard.length} ishtirokchi</span>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-amber-100" />
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <div className="flex-1 h-4 bg-gray-100 rounded" />
                <div className="w-20 h-6 bg-amber-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🪙</div>
            <p className="text-gray-400 font-medium">Hali hech kim coin yig'magan</p>
            <p className="text-gray-300 text-sm mt-1">Coin berish tugmasini bosing</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {leaderboard.map((entry, i) => (
              <div key={entry.id} className={clsx(
                'flex items-center gap-3 px-4 py-3 transition-colors group',
                i === 0 ? 'bg-amber-50/80 hover:bg-amber-100/60' :
                i === 1 ? 'bg-gray-50/60 hover:bg-gray-100/60' :
                i === 2 ? 'bg-orange-50/40 hover:bg-orange-50/70' :
                'hover:bg-gray-50/80'
              )}>
                {/* Rank badge */}
                <div className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0',
                  i === 0 ? 'bg-amber-400 text-white shadow-md' :
                  i === 1 ? 'bg-gray-400 text-white' :
                  i === 2 ? 'bg-orange-400 text-white' :
                  'bg-gray-100 text-gray-500'
                )}>
                  {i < 3 ? MEDAL[i] : entry.rank}
                </div>

                {/* Avatar */}
                <Avatar name={entry.fullName} size="sm" rank={i + 1} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 text-sm truncate">{entry.fullName}</div>
                  {entry.groups.length > 0 && (
                    <div className="text-xs text-gray-400 truncate">{entry.groups.slice(0, 2).join(' · ')}</div>
                  )}
                </div>

                {/* Coin badge */}
                <div className={clsx(
                  'flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold flex-shrink-0',
                  i === 0 ? 'bg-amber-400 text-white shadow' :
                  i === 1 ? 'bg-gray-200 text-gray-600' :
                  i === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-gray-100 text-gray-600'
                )}>
                  <span>🪙</span>
                  <span>{entry.coinBalance}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────── */}
      {showModal && (
        <CoinModal
          type={showModal}
          onClose={() => setShowModal(null)}
          onSuccess={() => { setShowModal(null); qc.invalidateQueries('coin-leaderboard'); }}
        />
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════
// COIN MODAL
// ══════════════════════════════════════════════════════
const CoinModal = ({ type, onClose, onSuccess }: {
  type: 'award' | 'deduct'; onClose: () => void; onSuccess: () => void;
}) => {
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<{ id: number; fullName: string; coinBalance: number } | null>(null);
  const [amount, setAmount] = useState(3);
  const [coinType, setCoinType] = useState('REWARD');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: searchResults } = useQuery(
    ['student-search-coin', studentSearch],
    () => api.get('/students', { params: { search: studentSearch, limit: 8 } })
      .then(r => r.data.data).catch(() => []),
    { enabled: studentSearch.length >= 2 }
  );

  const students = Array.isArray(searchResults)
    ? (searchResults as { id: number; user: { fullName: string }; coinBalance: number }[]).map(s => ({
        id: s.id, fullName: s.user.fullName, coinBalance: s.coinBalance
      }))
    : [];

  const handleSubmit = async () => {
    if (!selectedStudent) { toast.error("O'quvchi kiritilishi shart"); return; }
    if (amount <= 0 || amount > MAX_COINS) { toast.error(`1 dan ${MAX_COINS} gacha coin kiriting`); return; }
    setLoading(true);
    try {
      if (type === 'award') {
        await api.post('/coins/award', { studentId: selectedStudent.id, amount, type: coinType, reason });
        toast.success(`🪙 ${selectedStudent.fullName}ga ${amount} coin berildi!`);
      } else {
        await api.post('/coins/deduct', { studentId: selectedStudent.id, amount, reason });
        toast.success(`${selectedStudent.fullName}dan ${amount} coin olindi.`);
      }
      onSuccess();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xato');
    } finally { setLoading(false); }
  };

  const isAward = type === 'award';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className={clsx(
          'px-5 py-4 text-white',
          isAward ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-red-500 to-rose-500'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{isAward ? '🪙' : '⚡'}</span>
              <div>
                <h2 className="font-bold text-lg">{isAward ? 'Coin berish' : 'Jarima berish'}</h2>
                <p className="text-xs text-white/80">Maks. {MAX_COINS} ta coin</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Student search */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">O'quvchi</label>
            {selectedStudent ? (
              <div className={clsx(
                'flex items-center justify-between p-3 rounded-xl border-2',
                isAward ? 'border-amber-300 bg-amber-50' : 'border-red-200 bg-red-50'
              )}>
                <div>
                  <div className={clsx('text-sm font-bold', isAward ? 'text-amber-700' : 'text-red-700')}>
                    {selectedStudent.fullName}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    🪙 Hozir: <span className="font-bold">{selectedStudent.coinBalance}</span> coin
                  </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200">✕</button>
              </div>
            ) : (
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={studentSearch}
                  onChange={e => { setStudentSearch(e.target.value); setShowDropdown(true); }}
                  placeholder="Ism yoki telefon..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                {showDropdown && students.length > 0 && (
                  <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-10 overflow-hidden max-h-48 overflow-y-auto">
                    {students.map(s => (
                      <button key={s.id} type="button"
                        onClick={() => { setSelectedStudent(s); setShowDropdown(false); setStudentSearch(''); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 text-left transition-colors">
                        <span className="text-sm font-medium text-gray-800">{s.fullName}</span>
                        <span className="text-xs text-amber-600 font-bold">🪙 {s.coinBalance}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount selector */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Coin miqdori
            </label>
            <div className="flex gap-2 justify-between">
              {QUICK_AMOUNTS.map(a => (
                <button key={a} onClick={() => setAmount(a)} type="button"
                  className={clsx(
                    'flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all',
                    amount === a
                      ? isAward
                        ? 'border-amber-500 bg-amber-500 text-white shadow-md scale-105'
                        : 'border-red-500 bg-red-500 text-white shadow-md scale-105'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  )}>
                  {a}🪙
                </button>
              ))}
            </div>
            {/* Preview */}
            {selectedStudent && (
              <div className={clsx(
                'mt-2 p-2 rounded-lg text-center text-xs font-medium',
                isAward ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
              )}>
                {isAward
                  ? `${selectedStudent.coinBalance} → ${selectedStudent.coinBalance + amount} 🪙`
                  : selectedStudent.coinBalance >= amount
                    ? `${selectedStudent.coinBalance} → ${selectedStudent.coinBalance - amount} 🪙`
                    : '⚠️ Yetarli coin yo\'q'
                }
              </div>
            )}
          </div>

          {/* Type (award only) */}
          {isAward && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Sabab turi</label>
              <div className="grid grid-cols-3 gap-2">
                {[{ value: 'REWARD', label: '⭐ Mukofot' }, { value: 'BONUS', label: '🎁 Bonus' }, { value: 'EXCHANGE', label: '🔄 Boshqa' }].map(ct => (
                  <button key={ct.value} onClick={() => setCoinType(ct.value)}
                    className={clsx(
                      'py-2 px-1 rounded-xl border-2 text-xs font-semibold transition-colors',
                      coinType === ct.value ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    )}>
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Izoh (ixtiyoriy)</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)}
              placeholder={isAward ? "Masalan: Uy vazifani bajarganlik..." : "Jarima sababi..."}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Bekor
          </button>
          <button onClick={handleSubmit} disabled={loading || !selectedStudent}
            className={clsx(
              'flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed',
              isAward ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600' :
                        'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600'
            )}>
            {loading ? '⏳ ...' : isAward ? `${amount} 🪙 berish` : `${amount} 🪙 olish`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoinsPage;
