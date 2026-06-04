import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bot, Phone, User, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import { User as UserType } from '../../types';

// Meta Pixel type declaration
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const trackLead = () => {
  try {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead');
    }
  } catch { /* ignored */ }
};

const RegisterPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string }>({});

  const formatPhone = (val: string) => {
    // Faqat raqamlar qoldirish
    const digits = val.replace(/\D/g, '');
    // +998 bilan boshlash
    if (digits.startsWith('998')) return '+' + digits.slice(0, 12);
    if (digits.startsWith('8') || digits.startsWith('0')) return '+998' + digits.slice(1, 10);
    return '+998' + digits.slice(0, 9);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || raw === '+') { setPhone(raw); return; }
    setPhone(formatPhone(raw));
    if (errors.phone) setErrors(p => ({ ...p, phone: undefined }));
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (fullName.trim().length < 2) errs.fullName = 'Ism kamida 2 ta harf';
    const cleanPhone = phone.replace(/\s/g, '');
    if (!/^\+998\d{9}$/.test(cleanPhone)) errs.phone = '+998 XX XXX XX XX formatida kiriting';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsLoading(true);
    try {
      const cleanPhone = phone.replace(/\s/g, '');
      const res = await api.post('/auth/register', {
        fullName: fullName.trim(),
        phone: cleanPhone,
        // Parol = telefon raqam (admin keyinchalik o'zgartiradi)
        password: cleanPhone,
      });

      const { user, accessToken, refreshToken } = res.data.data as {
        user: UserType; accessToken: string; refreshToken: string;
      };

      setAuth(user, accessToken, refreshToken);
      trackLead();
      toast.success('Muvaffaqiyatli ro\'yxatdan o\'tdingiz! 🎉');
      navigate('/student');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Xato yuz berdi, qayta urinib ko\'ring');
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = fullName.trim().length >= 2 && /^\+998\d{9}$/.test(phone.replace(/\s/g, ''));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 flex flex-col items-center justify-center p-4">

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <span className="text-white font-bold text-xl tracking-tight">Robotic Edu</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8">

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Ro'yxatdan o'tish
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-7">
            Ism va telefon raqamingizni kiriting
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Ism */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Ism Familiya
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 w-[18px] h-[18px]" />
                <input
                  type="text"
                  value={fullName}
                  onChange={e => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors(p => ({ ...p, fullName: undefined }));
                  }}
                  placeholder="Abdullayev Abdulla"
                  autoComplete="name"
                  autoFocus
                  className={`w-full pl-10 pr-4 py-3.5 rounded-xl border text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:border-transparent transition-all text-base ${
                    errors.fullName
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-200 dark:border-gray-700 focus:ring-indigo-500'
                  }`}
                />
              </div>
              {errors.fullName && (
                <p className="mt-1.5 text-xs text-red-500">{errors.fullName}</p>
              )}
            </div>

            {/* Telefon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Telefon raqam
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-[18px] h-[18px]" />
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="+998 90 123 45 67"
                  autoComplete="tel"
                  inputMode="numeric"
                  className={`w-full pl-10 pr-4 py-3.5 rounded-xl border text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:border-transparent transition-all text-base ${
                    errors.phone
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-200 dark:border-gray-700 focus:ring-indigo-500'
                  }`}
                />
              </div>
              {errors.phone && (
                <p className="mt-1.5 text-xs text-red-500">{errors.phone}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !isValid}
              className={`w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all mt-2 ${
                isValid && !isLoading
                  ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-lg shadow-indigo-500/30'
                  : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Yuborilmoqda...</>
              ) : (
                <>Ro'yxatdan o'tish <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

        {/* Login link */}
        <p className="text-center text-sm text-white/50 mt-5">
          Hisobingiz bormi?{' '}
          <Link to="/login" className="text-white/80 font-medium hover:text-white transition-colors underline underline-offset-2">
            Kirish
          </Link>
        </p>

        {/* Note */}
        <p className="text-center text-xs text-white/30 mt-3">
          Ro'yxatdan o'tgach admin siz bilan bog'lanadi
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
