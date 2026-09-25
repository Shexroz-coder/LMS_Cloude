import { useNavigate } from 'react-router-dom';
import { UserPlus, BookOpen, CreditCard, ClipboardCheck, LucideIcon } from 'lucide-react';
import { usePermissionStore } from '../../store/permission.store';

interface QuickAction {
  label: string;
  icon: LucideIcon;
  to: string;
  perm?: string;
  color: string; // ikon foni
}

/**
 * Bosh sahifada eng ko'p ishlatiladigan amallar — bir bosishда.
 * Ruxsat bo'yicha avtomatik filtrlanadi (mas'ul faqat o'ziga tegishlisini ko'radi).
 */
const ACTIONS: QuickAction[] = [
  { label: "O'quvchi qo'shish", icon: UserPlus,       to: '/admin/students?new=1', perm: 'students.create', color: 'bg-neon-cyan/15 text-neon-cyan ring-neon-cyan/30' },
  { label: 'Guruh yaratish',    icon: BookOpen,       to: '/admin/groups?new=1',   perm: 'groups.manage',   color: 'bg-neon-violet/15 text-neon-violet ring-neon-violet/30' },
  { label: "To'lov qabul qilish", icon: CreditCard,   to: '/admin/billing',        perm: 'payments.create', color: 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30' },
  { label: 'Davomat',           icon: ClipboardCheck, to: '/admin/attendance',     perm: 'attendance.view', color: 'bg-amber-500/15 text-amber-500 ring-amber-500/30' },
];

const QuickActions = () => {
  const navigate = useNavigate();
  const can = usePermissionStore(s => s.can);
  const actions = ACTIONS.filter(a => !a.perm || can(a.perm));
  if (!actions.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map(a => (
        <button
          key={a.to}
          onClick={() => navigate(a.to)}
          className="card-cyber flex flex-col items-center justify-center gap-2 py-4 text-center"
        >
          <span className={`w-11 h-11 rounded-xl flex items-center justify-center ring-1 ${a.color}`}>
            <a.icon className="w-5 h-5" />
          </span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{a.label}</span>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
