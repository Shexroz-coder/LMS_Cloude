import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  variant?: 'default' | 'light';
}

const ThemeToggle = ({ variant = 'default' }: ThemeToggleProps) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative w-9 h-9 rounded-lg flex items-center justify-center
        transition-all duration-300 ease-in-out
        ${variant === 'light'
          ? 'text-white/80 hover:text-white hover:bg-white/20'
          : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
        }
      `}
      title={isDark ? 'Kun rejimi' : 'Tun rejimi'}
      aria-label={isDark ? 'Kun rejimiga o\'tish' : 'Tun rejimiga o\'tish'}
    >
      <div className="relative w-5 h-5">
        {/* Sun icon */}
        <Sun
          className={`
            w-5 h-5 absolute inset-0 transition-all duration-300
            ${isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}
          `}
        />
        {/* Moon icon */}
        <Moon
          className={`
            w-5 h-5 absolute inset-0 transition-all duration-300
            ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}
          `}
        />
      </div>
    </button>
  );
};

export default ThemeToggle;
