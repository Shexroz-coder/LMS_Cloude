import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, ChevronRight, Bot } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import { User } from '../../types';
import { clsx } from 'clsx';

// Meta Pixel type declaration
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Meta Pixel Lead hodisasini xavfsiz yuborish */
const trackLead = () => {
  try {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead');
    }
  } catch {
    // Pixel yuklanmagan yoki bloklangan — e'tibor berilmaydi
  }
};

const DAY_OPTIONS = [
  { value: 1, label: 'Du' },
  { value: 2, label: 'Se' },
  { value: 3, label: 'Cho' },
  { value: 4, label: 'Pay' },
  { value: 5, label: 'Ju' },
  { value: 6, label: 'Sha' },
  { value: 0, label: 'Yak' },
];

const TIME_OPTIONS = [
  { value: 'morning',   label: '🌅 Ertalab', sublabel: '9:00 – 12:00' },
  { value: 'afternoon', label: '☀️ Kunduz',  sublabel: '12:00 – 17:00' },
  { value: 'evening',   label: '🌆 Kechqurun', sublabel: '17:00 – 21:00' },
];

interface Course { id: number; name: string; description?: string; }

const STEPS = ['Ma\'lumotlar', 'O\'qish', 'Vaqt'];

const RegisterPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedTime, setSelectedTime] = useState('');

  useEffect(() => {
    api.get('/public/courses').then(r => setCourses(r.data?.data || [])).catch(() => {});
  }, []);

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const canNext = () => {
    if (step === 0) return fullName.trim().length >= 2 && phone.trim().length >= 9 && password.length >= 6;
    if (step === 1) return true; // kurs ixtiyoriy
    if (step === 2) return true; // vaqt ixtiyoriy
    return true;
  };

  const handleSubmit = async () => {
    if (!canNext()) return;
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', {
        fullName: fullName.trim(),
        phone: phone.trim(),
        password,
        interestedCourseId: selectedCourse || undefined,
        preferredDays: selectedDays,
        preferredTime: selectedTime || undefined,
      });

      const { user, accessToken, refreshToken } = res.data.data as {
        user: User; accessToken: string; refreshToken: string;
      };

      setAuth(user, accessToken, refreshToken);

      // ── Meta Pixel: ro'yxatdan o'tish muvaffaqiyatli → Lead hodisasi ──
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 flex items-center justify-center p-4">

      {/* Logo */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">Robotic Edu</span>
      </div>

      <div className="w-full max-w-md mt-14">

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                i < step  ? 'bg-emerald-500 text-white' :
                i === step ? 'bg-white text-indigo-900 ring-4 ring-white/30' :
                             'bg-white/20 text-white/60'
              )}>
                {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={clsx(
                'text-sm font-medium',
                i === step ? 'text-white' : 'text-white/50'
              )}>{label}</span>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-white/20 mx-1" />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">

          {/* ── Step 0: Asosiy ma'lumotlar ── */}
          {step === 0 && (
            <div className="p-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Ro'yxatdan o'tish</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">O'quvchi sifatida hisob oching</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    To'liq ism *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Ism Familiya"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Telefon raqam *
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Parol * <span className="text-xs text-gray-400">(kamida 6 belgi)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {/* Password strength */}
                  {password.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className={clsx(
                          'h-1 flex-1 rounded-full transition-all',
                          i < Math.min(4, Math.floor(password.length / 2))
                            ? password.length >= 8 ? 'bg-emerald-500' : 'bg-amber-400'
                            : 'bg-gray-200 dark:bg-gray-700'
                        )} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1: Kurs tanlash ── */}
          {step === 1 && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Qaysi kursga qiziqasiz?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Ixtiyoriy — admin guruhga taklif qiladi</p>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                <button
                  onClick={() => setSelectedCourse(null)}
                  className={clsx(
                    'w-full p-4 rounded-xl border-2 text-left transition-all',
                    selectedCourse === null
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  )}
                >
                  <div className="font-medium text-gray-700 dark:text-gray-300 text-sm">Hali aniq emas</div>
                </button>
                {courses.map(course => (
                  <button
                    key={course.id}
                    onClick={() => setSelectedCourse(course.id)}
                    className={clsx(
                      'w-full p-4 rounded-xl border-2 text-left transition-all',
                      selectedCourse === course.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    )}
                  >
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{course.name}</div>
                    {course.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{course.description}</div>
                    )}
                    {selectedCourse === course.id && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-500 absolute right-4 top-1/2 -translate-y-1/2" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Qulay kun va vaqt ── */}
          {step === 2 && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Qulay kun va vaqt</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Ixtiyoriy — admin optimal guruh taklif qiladi</p>

              {/* Kunlar */}
              <div className="mb-5">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">📅 Qulay kunlar</p>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_OPTIONS.map(day => (
                    <button
                      key={day.value}
                      onClick={() => toggleDay(day.value)}
                      className={clsx(
                        'py-2 rounded-xl text-xs font-bold transition-all',
                        selectedDays.includes(day.value)
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vaqt */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">🕐 Qulay vaqt</p>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setSelectedTime(prev => prev === t.value ? '' : t.value)}
                      className={clsx(
                        'p-3 rounded-xl border-2 text-center transition-all',
                        selectedTime === t.value
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      )}
                    >
                      <div className="text-base">{t.label.split(' ')[0]}</div>
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-0.5">
                        {t.label.split(' ').slice(1).join(' ')}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{t.sublabel}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="px-8 pb-8 space-y-3">
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext()}
                className={clsx(
                  'w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all',
                  canNext()
                    ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99]'
                    : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                )}
              >
                Davom etish <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    Yuborilmoqda...
                  </span>
                ) : (
                  <>✅ Ro'yxatdan o'tish</>
                )}
              </button>
            )}

            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="w-full py-2.5 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                ← Orqaga
              </button>
            )}

            {step === 0 && (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Hisobingiz bormi?{' '}
                <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                  Kirish
                </Link>
              </p>
            )}
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center text-xs text-white/40 mt-5">
          Ro'yxatdan o'tgach admin siz bilan bog'lanadi va guruhga qo'shadi
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
