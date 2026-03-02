import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth.store';
import api from '../../api/axios';

interface Props {
  variant?: 'light' | 'dark';
}

const LanguageSwitcher = ({ variant = 'dark' }: Props) => {
  const { i18n } = useTranslation();
  const { user, updateUser } = useAuthStore();

  const changeLanguage = async (lang: 'uz' | 'ru') => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lms_language', lang);

    // Agar login qilingan bo'lsa, serverga ham saqlaymiz
    if (user) {
      try {
        await api.put('/users/language', { language: lang });
        updateUser({ language: lang });
      } catch {
        // Silent fail
      }
    }
  };

  const current = i18n.language as 'uz' | 'ru';

  const baseClass = variant === 'light'
    ? 'text-white/70 hover:text-white hover:bg-white/20'
    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100';

  const activeClass = variant === 'light'
    ? 'text-white bg-white/20 font-semibold'
    : 'text-primary-700 bg-primary-50 font-semibold';

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-black/10">
      {(['uz', 'ru'] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => changeLanguage(lang)}
          className={`px-3 py-1 rounded-md text-sm transition-all duration-200 ${
            current === lang ? activeClass : baseClass
          }`}
        >
          {lang === 'uz' ? "🇺🇿 O'z" : '🇷🇺 Ру'}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
