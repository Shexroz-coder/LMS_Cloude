import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand: Qizil — asosiy brend rangi
        primary: {
          50:  '#FFF1F2',
          100: '#FFE4E6',
          200: '#FECDD3',
          300: '#FDA4AF',
          400: '#FB7185',
          500: '#F43F5E',
          600: '#E11D48',
          700: '#BE123C',
          800: '#9F1239',
          900: '#881337',
          950: '#4C0519',
        },
        success: {
          50:  '#F0FDF4',
          100: '#DCFCE7',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        warning: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
        },
        danger: {
          50:  '#FFF1F2',
          100: '#FFE4E6',
          500: '#EF4444',
          600: '#DC2626',
        },
        coin: {
          DEFAULT: '#F59E0B',
          light: '#FEF3C7',
          dark: '#D97706',
        },
        // Futuristic AI/Robotics akssent — neon cyan + violet
        neon: {
          cyan:   '#22D3EE',
          blue:   '#38BDF8',
          violet: '#8B5CF6',
          indigo: '#6366F1',
          pink:   '#F472B6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'neon': '0 0 0 1px rgba(34,211,238,0.25), 0 0 18px -2px rgba(34,211,238,0.45)',
        'neon-violet': '0 0 0 1px rgba(139,92,246,0.25), 0 0 18px -2px rgba(139,92,246,0.45)',
      },
      animation: {
        'coin-bounce': 'bounce 0.5s ease-in-out 3',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'page-in': 'pageIn 0.34s cubic-bezier(0.22, 1, 0.36, 1)',
        'glow-pulse': 'glowPulse 2.6s ease-in-out infinite',
        'float-soft': 'floatSoft 5s ease-in-out infinite',
        'scan': 'scan 3.5s linear infinite',
        'spin-slow': 'spin 9s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pageIn: {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.995)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.55', filter: 'drop-shadow(0 0 2px rgba(34,211,238,0.5))' },
          '50%': { opacity: '1', filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.9))' },
        },
        floatSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
