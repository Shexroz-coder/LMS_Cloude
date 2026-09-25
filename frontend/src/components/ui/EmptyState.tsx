import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Ro'yxat bo'sh bo'lganда ko'rsatiladigan yo'naltiruvchi holat.
 * Quruq ekran o'rniga foydalanuvchiga nima qilishни aytadi.
 */
const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center text-center py-14 px-4">
    <div className="w-16 h-16 rounded-2xl bg-neon-cyan/10 ring-1 ring-neon-cyan/25 flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-neon-cyan" />
    </div>
    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
    {description && (
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">{description}</p>
    )}
    {actionLabel && onAction && (
      <button onClick={onAction} className="btn-primary mt-4">{actionLabel}</button>
    )}
  </div>
);

export default EmptyState;
