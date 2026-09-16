import { useQuery } from 'react-query';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import api from '../../api/axios';
import { useBranchStore } from '../../store/branch.store';
import { Branch } from '../../types';

/**
 * Filial tanlagich — header/sidebar'da. Tanlangan filial barcha
 * so'rovlarga (axios interceptor) avtomatik qo'shiladi.
 * Faqat 1 ta filial bo'lsa — ko'rsatilmaydi.
 */
export default function BranchSelector({ compact = false }: { compact?: boolean }) {
  const { selectedBranchId, setBranch } = useBranchStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: branches = [] } = useQuery<Branch[]>(
    ['branches'],
    () => api.get('/branches').then(r => r.data?.data ?? []),
    { staleTime: 60_000 }
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 1 tadan kam filial — tanlagichni ko'rsatmaymiz
  if (branches.length <= 1) return null;

  const current = branches.find(b => b.id === selectedBranchId);
  const label = current ? current.name : 'Barcha filiallar';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-2 rounded-xl border transition-colors',
          compact
            ? 'w-full px-3 py-2 bg-white/10 border-white/15 text-white hover:bg-white/15'
            : 'px-3 py-2 bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
        )}
      >
        <Building2 size={16} className="flex-shrink-0 opacity-70" />
        <span className="flex-1 text-left text-sm font-medium truncate">{label}</span>
        <ChevronDown size={14} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className={clsx(
          'absolute z-50 mt-1 w-full min-w-[200px] rounded-xl border shadow-lg overflow-hidden',
          compact ? 'bg-zinc-900 border-white/15' : 'bg-white border-zinc-200'
        )}>
          <button
            onClick={() => { setBranch(null); setOpen(false); }}
            className={clsx(
              'flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left transition-colors',
              compact ? 'text-white/80 hover:bg-white/10' : 'text-zinc-700 hover:bg-zinc-50'
            )}
          >
            <span className="flex-1">Barcha filiallar</span>
            {selectedBranchId == null && <Check size={15} className="text-emerald-500" />}
          </button>
          {branches.map(b => (
            <button
              key={b.id}
              onClick={() => { setBranch(b.id); setOpen(false); }}
              className={clsx(
                'flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left transition-colors',
                compact ? 'text-white/80 hover:bg-white/10' : 'text-zinc-700 hover:bg-zinc-50'
              )}
            >
              <span className="flex-1 truncate">{b.name}</span>
              {b.studentsCount != null && (
                <span className={clsx('text-xs', compact ? 'text-white/40' : 'text-zinc-400')}>
                  {b.studentsCount}
                </span>
              )}
              {selectedBranchId === b.id && <Check size={15} className="text-emerald-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
