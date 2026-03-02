import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Bot } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import { User } from '../../types';
import LanguageSwitcher from '../../components/ui/LanguageSwitcher';

const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      toast.error(t('auth.loginError'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', { phone, password });
      const { user, accessToken, refreshToken } = res.data.data as {
        user: User;
        accessToken: string;
        refreshToken: string;
      };

      setAuth(user, accessToken, refreshToken);

      // Rolga qarab yo'naltirish
      const routes: Record<string, string> = {
        ADMIN: '/admin',
        TEACHER: '/teacher',
        STUDENT: '/student',
        PARENT: '/parent',
      };
      toast.success(t('auth.login') + ' ✅');
      navigate(routes[user.role] || '/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || t('auth.loginError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">

      {/* Language switcher */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher variant="light" />
      </div>

      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur rounded-2xl mb-4">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">{t('app.name')}</h1>
          <p className="text-primary-200 mt-1 text-sm">{t('app.tagline')}</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">
            {t('auth.login')}
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Phone */}
            <div>
              <label className="label">{t('auth.phone')}</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('auth.phonePlaceholder')}
                className="input"
                autoFocus
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="label">{t('auth.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  className="input pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-base"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('auth.logging_in')}
                </>
              ) : (
                t('auth.loginButton')
              )}
            </button>
          </form>

          {/* Roles info */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3">Rollar:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { role: 'Admin', icon: '👑', color: 'bg-primary-50 text-primary-700' },
                { role: 'Ustoz', icon: '👨‍🏫', color: 'bg-success-50 text-success-700' },
                { role: "O'quvchi", icon: '🎓', color: 'bg-purple-50 text-purple-700' },
                { role: 'Ota-ona', icon: '👨‍👩‍👧', color: 'bg-orange-50 text-orange-700' },
              ].map((r) => (
                <div key={r.role} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${r.color}`}>
                  <span>{r.icon}</span>
                  <span>{r.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-primary-300 text-xs mt-6">
          © 2026 Robotic Edu. Barcha huquqlar himoyalangan.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
