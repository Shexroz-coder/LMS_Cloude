import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  change?: number; // foiz o'zgarish
  changeLabel?: string;
  suffix?: string;
  loading?: boolean;
}

const StatCard = ({
  title, value, icon: Icon, iconColor, iconBg,
  change, changeLabel, suffix, loading
}: StatCardProps) => {
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-200" />
          <div className="flex-1">
            <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
            <div className="h-6 bg-gray-200 rounded w-32" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card hover:shadow-card-hover transition-shadow duration-200">
      <div className="flex items-start gap-4">
        <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
          <Icon className={clsx('w-6 h-6', iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {typeof value === 'number' ? value.toLocaleString('uz-UZ') : value}
            {suffix && <span className="text-base font-medium text-gray-500 ml-1">{suffix}</span>}
          </p>
          {change !== undefined && (
            <div className={clsx('flex items-center gap-1 mt-1.5 text-xs font-medium',
              change >= 0 ? 'text-success-600' : 'text-danger-500')}>
              {change >= 0
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />
              }
              <span>{Math.abs(change)}% {changeLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
