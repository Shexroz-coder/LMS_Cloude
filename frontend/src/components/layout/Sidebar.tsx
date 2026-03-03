import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth.store';
import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Users, UserCheck, BookOpen, Calendar, ClipboardCheck,
  Star, CreditCard, BarChart3, Wallet, Coins, Bell,
  Megaphone, FileText, User, LogOut, Bot, ChevronLeft, ChevronRight,
  ChevronDown, GraduationCap, DollarSign, Settings2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Role } from '../../types';
import clsx from 'clsx';

// ── Types ──────────────────────────────────────────────
interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
}

interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

type NavConfig = (NavItem | NavGroup)[];

function isGroup(item: NavItem | NavGroup): item is NavGroup {
  return 'items' in item;
}

// ── Role colors ────────────────────────────────────────
const ROLE_COLORS: Record<Role, string> = {
  ADMIN: 'from-gray-900 to-black',
  TEACHER: 'from-gray-900 to-black',
  STUDENT: 'from-red-800 to-black',
  PARENT: 'from-gray-900 to-black',
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: '👑 Admin',
  TEACHER: '👨‍🏫 Ustoz',
  STUDENT: '🎓 O\'quvchi',
  PARENT: '👨‍👩‍👧 Ota-ona',
};

// ── Nav config per role ────────────────────────────────
const getNavConfig = (role: Role, t: (k: string) => string): NavConfig => {
  const systemGroup: NavGroup = {
    key: 'system',
    label: 'Tizim',
    icon: Settings2,
    items: [
      { to: `/${role.toLowerCase()}/notifications`, icon: Bell, label: t('nav.notifications') },
      { to: `/${role.toLowerCase()}/profile`, icon: User, label: t('nav.profile') },
    ],
  };

  if (role === 'ADMIN') {
    return [
      // standalone
      { to: '/admin', icon: LayoutDashboard, label: t('nav.dashboard') },

      {
        key: 'education', label: "Ta'lim", icon: GraduationCap, items: [
          { to: '/admin/students', icon: Users, label: t('nav.students') },
          { to: '/admin/teachers', icon: UserCheck, label: t('nav.teachers') },
          { to: '/admin/groups', icon: BookOpen, label: t('nav.groups') },
          { to: '/admin/courses', icon: Star, label: t('nav.courses') },
          { to: '/admin/schedule', icon: Calendar, label: t('nav.schedule') },
        ]
      },

      {
        key: 'finance', label: 'Moliya', icon: DollarSign, items: [
          { to: '/admin/payments', icon: CreditCard, label: t('nav.payments') },
          { to: '/admin/finance', icon: BarChart3, label: t('nav.finance') },
          { to: '/admin/salaries', icon: Wallet, label: t('nav.salaries') },
          { to: '/admin/coins', icon: Coins, label: t('nav.coins') },
        ]
      },

      {
        key: 'management', label: 'Boshqaruv', icon: Megaphone, items: [
          { to: '/admin/announcements', icon: Megaphone, label: t('nav.announcements') },
          { to: '/admin/reports', icon: FileText, label: t('nav.reports') },
        ]
      },

      systemGroup,
    ];
  }

  if (role === 'TEACHER') {
    return [
      { to: '/teacher', icon: LayoutDashboard, label: t('nav.dashboard') },

      {
        key: 'teaching', label: 'Darslar', icon: BookOpen, items: [
          { to: '/teacher/schedule', icon: Calendar, label: t('nav.schedule') },
          { to: '/teacher/groups', icon: BookOpen, label: t('nav.groups') },
          { to: '/teacher/attendance', icon: ClipboardCheck, label: t('nav.attendance') },
          { to: '/teacher/grades', icon: Star, label: t('nav.grades') },
          { to: '/teacher/coins', icon: Coins, label: t('nav.coins') },
        ]
      },

      systemGroup,
    ];
  }

  if (role === 'STUDENT') {
    return [
      { to: '/student', icon: LayoutDashboard, label: t('nav.dashboard') },
      { to: '/student/schedule', icon: Calendar, label: t('nav.schedule') },
      { to: '/student/grades', icon: Star, label: t('nav.grades') },
      { to: '/student/coins', icon: Coins, label: t('nav.coins') },
      { to: '/student/payments', icon: CreditCard, label: t('nav.payments') },
      { to: '/student/notifications', icon: Bell, label: t('nav.notifications') },
      { to: '/student/profile', icon: User, label: t('nav.profile') },
    ];
  }

  // PARENT
  return [
    { to: '/parent', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/parent/payments', icon: CreditCard, label: t('nav.payments') },
    { to: '/parent/notifications', icon: Bell, label: t('nav.notifications') },
    { to: '/parent/profile', icon: User, label: t('nav.profile') },
  ];
};

// ── Collapsible group ──────────────────────────────────
const NavGroupSection = ({
  group,
  collapsed,
  defaultOpen = false,
}: {
  group: NavGroup;
  collapsed: boolean;
  defaultOpen?: boolean;
}) => {
  const location = useLocation();
  const isAnyActive = group.items.some(item => location.pathname.startsWith(item.to));
  const [open, setOpen] = useState(defaultOpen || isAnyActive);

  // Auto-open when navigating to a child route
  useEffect(() => {
    if (isAnyActive) setOpen(true);
  }, [isAnyActive]);

  if (collapsed) {
    // In collapsed mode, show icons without grouping label
    return (
      <div className="space-y-0.5">
        {group.items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              clsx(
                'flex items-center justify-center w-full p-2.5 rounded-lg transition-all duration-200',
                isActive ? 'bg-white/25 text-white' : 'text-white/60 hover:bg-white/15 hover:text-white'
              )
            }
          >
            <item.icon size={18} className="flex-shrink-0" />
          </NavLink>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Group header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200',
          isAnyActive
            ? 'text-white/90 bg-white/10'
            : 'text-white/45 hover:text-white/70 hover:bg-white/5'
        )}
      >
        <group.icon size={14} className="flex-shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          size={13}
          className={clsx('transition-transform duration-200', open ? 'rotate-180' : '')}
        />
      </button>

      {/* Group items */}
      <div
        className={clsx(
          'overflow-hidden transition-all duration-200',
          open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <ul className="mt-0.5 ml-2 pl-2.5 border-l border-white/10 space-y-0.5">
          {group.items.map(item => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/65 hover:bg-white/10 hover:text-white'
                  )
                }
              >
                <item.icon size={16} className="flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-4.5 h-4.5 flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// ── Main Sidebar ───────────────────────────────────────
const Sidebar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const navConfig = getNavConfig(user.role, t);
  const gradient = ROLE_COLORS[user.role];

  const handleLogout = async () => {
    try { await api.post('/auth/logout', {}); } catch { /* silent */ }
    logout();
    navigate('/login');
    toast.success(t('auth.logout'));
  };

  return (
    <div className={clsx(
      'relative flex flex-col h-full transition-all duration-300',
      `bg-gradient-to-b ${gradient}`,
      collapsed ? 'w-16' : 'w-60'
    )}>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-[72px] z-10 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center text-gray-500 hover:text-indigo-600 transition"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo */}
      <div className={clsx(
        'flex items-center gap-3 px-4 py-4 border-b border-white/10',
        collapsed && 'justify-center'
      )}>
        <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Bot size={17} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="font-bold text-white text-sm leading-tight">Robotic Edu</div>
            <div className="text-white/45 text-[10px]">Learning Management</div>
          </div>
        )}
      </div>

      {/* User info */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 bg-white/10 rounded-xl px-3 py-2.5">
            <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user.fullName}</div>
              <div className="text-white/50 text-[10px]">{ROLE_LABELS[user.role]}</div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-hide">
        {navConfig.map((item, i) => {
          if (isGroup(item)) {
            return (
              <NavGroupSection
                key={item.key}
                group={item}
                collapsed={collapsed}
                defaultOpen={i === 1} // first group open by default
              />
            );
          }

          // Standalone nav item
          return collapsed ? (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === `/${user.role.toLowerCase()}`}
              title={item.label}
              className={({ isActive }) =>
                clsx(
                  'flex items-center justify-center w-full p-2.5 rounded-lg transition-all duration-200',
                  isActive ? 'bg-white/25 text-white' : 'text-white/60 hover:bg-white/15 hover:text-white'
                )
              }
            >
              <item.icon size={18} className="flex-shrink-0" />
            </NavLink>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === `/${user.role.toLowerCase()}`}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-white/25 text-white shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )
              }
            >
              <item.icon size={18} className="flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-white/10">
        <button
          onClick={handleLogout}
          className={clsx(
            'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium',
            'text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200',
            collapsed && 'justify-center'
          )}
          title={collapsed ? t('nav.logout') : undefined}
        >
          <LogOut size={17} className="flex-shrink-0" />
          {!collapsed && <span>{t('nav.logout')}</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
