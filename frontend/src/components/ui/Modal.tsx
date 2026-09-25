import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface ModalProps {
  /** Sarlavha (bo'lsa header ko'rsatiladi) */
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Pastki footer (tugmalar) */
  footer?: ReactNode;
  /** Kenglik klassi (default: max-w-lg) */
  maxWidth?: string;
  /** Fon (backdrop) bosilganда yopilsinmi (default: true) */
  closeOnBackdrop?: boolean;
}

/**
 * Umumiy modal — backdrop + markazlashgan karta + Esc/backdrop yopish.
 * Butun ilova bo'ylab bir xil (futuristic) ko'rinish uchun.
 * MUHIM: `fixed` ishlatiladi — transformli ota-elementlar ichida ham
 * viewport'ga nisbatan to'g'ri joylashadi (page-transition bilan mos).
 */
const Modal = ({ title, onClose, children, footer, maxWidth = 'max-w-lg', closeOnBackdrop = true }: ModalProps) => {
  // Esc bilan yopish
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div className={clsx('bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-h-[92vh] flex flex-col', maxWidth)}>
        {title !== undefined && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700">{footer}</div>
        )}
      </div>
    </div>
  );
};

export default Modal;
