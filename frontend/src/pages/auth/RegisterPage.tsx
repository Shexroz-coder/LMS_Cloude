import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bot, Phone, User, ArrowRight, Loader2, MapPin, Gift, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import { User as UserType } from '../../types';

declare global {
  interface Window { fbq?: (...args: unknown[]) => void; }
}
const trackLead = () => { try { if (typeof window.fbq === 'function') window.fbq('track', 'Lead'); } catch { /* ignored */ } };

// ── Confetti Canvas ────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; w: number; h: number;
  rotation: number; rotationSpeed: number; opacity: number;
  shape: 'rect' | 'circle';
}

const ConfettiCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
    const particles: Particle[] = [];

    // Two bursts: left & right from center-top
    const burst = (originX: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.random() * Math.PI) - Math.PI / 2 + (originX < 0.5 ? 0.3 : -0.3);
        const speed = Math.random() * 12 + 4;
        particles.push({
          x: canvas.width * originX,
          y: canvas.height * 0.35,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          w: Math.random() * 10 + 5,
          h: Math.random() * 5 + 3,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 14,
          opacity: 1,
          shape: Math.random() > 0.6 ? 'circle' : 'rect',
        });
      }
    };
    burst(0.25, 80); burst(0.75, 80); burst(0.5, 60);

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.25; // gravity
        p.vx *= 0.99;
        p.rotation += p.rotationSpeed;
        if (p.y > canvas.height * 0.6) p.opacity -= 0.025;
        if (p.opacity <= 0) return;
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === 'circle') {
          ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      });
      if (alive) animId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
};

// ── Success Screen ─────────────────────────────────────────────────────────
const SuccessScreen = ({ onContinue }: { onContinue: () => void }) => {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 80); return () => clearTimeout(t); }, []);

  return (
    <>
      <ConfettiCanvas />
      <div className={`min-h-screen bg-gradient-to-br from-indigo-950 via-violet-900 to-purple-900 flex flex-col items-center justify-center p-4 transition-all duration-700 ${show ? 'opacity-100' : 'opacity-0'}`}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Robotic Edu</span>
        </div>

        <div className={`w-full max-w-sm transition-all duration-700 delay-200 ${show ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">

            {/* Top celebration band */}
            <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-6 py-8 text-center relative overflow-hidden">
              {/* Glow circles */}
              <div className="absolute -top-6 -left-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-xl" />

              <div className="relative">
                <div className="text-6xl mb-3 animate-bounce">🎉</div>
                <h1 className="text-2xl font-black text-white leading-tight">
                  Tabriklaymiz!
                </h1>
                <p className="text-white/80 text-sm mt-1">Ro'yxatdan muvaffaqiyatli o'tdingiz</p>
              </div>
            </div>

            {/* Gift card */}
            <div className="mx-5 -mt-4 bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl p-4 shadow-lg shadow-amber-500/30 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-black text-lg leading-tight">2 ta Bepul dars</p>
                <p className="text-white/80 text-xs">qo'lga kiritdingiz! 🎁</p>
              </div>
            </div>

            {/* Steps */}
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Keyingi qadamlar</p>
              {[
                { icon: '📞', text: 'Admin siz bilan tez orada bog\'lanadi' },
                { icon: '📚', text: '2 ta bepul darsga taklif qilinasiz' },
                { icon: '🚀', text: 'Guruhga qo\'shilasiz va o\'qishni boshlaysiz' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  <p className="text-sm text-gray-600 dark:text-gray-300 pt-0.5">{item.text}</p>
                </div>
              ))}
            </div>

            {/* Location */}
            <div className="px-6 pb-2">
              <a
                href="https://yandex.uz/maps/-/CPXBFH0J"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors group"
              >
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Manzilimiz</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Yandex Xaritada ko'rish →</p>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>

            {/* Continue button */}
            <div className="px-6 py-5">
              <button
                onClick={onContinue}
                className="w-full py-3.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/30"
              >
                Shaxsiy kabinetga o'tish <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Register Form ──────────────────────────────────────────────────────────
const RegisterPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string }>({});

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || raw === '+') { setPhone(raw); return; }
    const digits = raw.replace(/\D/g, '');
    let formatted = '';
    if (digits.startsWith('998')) formatted = '+' + digits.slice(0, 12);
    else if (digits.startsWith('8') || digits.startsWith('0')) formatted = '+998' + digits.slice(1, 10);
    else formatted = '+998' + digits.slice(0, 9);
    setPhone(formatted);
    if (errors.phone) setErrors(p => ({ ...p, phone: undefined }));
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (fullName.trim().length < 2) errs.fullName = 'Ism kamida 2 ta harf bo\'lishi kerak';
    if (!/^\+998\d{9}$/.test(phone.replace(/\s/g, ''))) errs.phone = '+998 XX XXX XX XX formatida kiriting';
    return errs;
  };

  const isValid = fullName.trim().length >= 2 && /^\+998\d{9}$/.test(phone.replace(/\s/g, ''));

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
        password: cleanPhone,
      });
      const { user, accessToken, refreshToken } = res.data.data as {
        user: UserType; accessToken: string; refreshToken: string;
      };
      setAuth(user, accessToken, refreshToken);
      trackLead();
      setIsSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Xato yuz berdi, qayta urinib ko\'ring');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = useCallback(() => {
    navigate('/student');
  }, [navigate]);

  if (isSuccess) return <SuccessScreen onContinue={handleContinue} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 flex flex-col items-center justify-center p-4">

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <span className="text-white font-bold text-xl tracking-tight">Robotic Edu</span>
      </div>

      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8">

          {/* Gift teaser */}
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2.5 mb-6">
            <span className="text-xl">🎁</span>
            <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
              Ro'yxatdan o'tsangiz — <strong>2 ta bepul dars</strong> sovg'a!
            </p>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Ro'yxatdan o'tish</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Ism va telefon raqamingizni kiriting</p>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Ism */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Ism Familiya</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-[18px] h-[18px]" />
                <input
                  type="text" value={fullName} autoFocus autoComplete="name"
                  onChange={e => { setFullName(e.target.value); if (errors.fullName) setErrors(p => ({ ...p, fullName: undefined })); }}
                  placeholder="Abdullayev Abdulla"
                  className={`w-full pl-10 pr-4 py-3.5 rounded-xl border text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:border-transparent transition-all text-base ${errors.fullName ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 dark:border-gray-700 focus:ring-indigo-500'}`}
                />
              </div>
              {errors.fullName && <p className="mt-1.5 text-xs text-red-500">{errors.fullName}</p>}
            </div>

            {/* Telefon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Telefon raqam</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-[18px] h-[18px]" />
                <input
                  type="tel" value={phone} autoComplete="tel" inputMode="numeric"
                  onChange={handlePhoneChange}
                  placeholder="+998 90 123 45 67"
                  className={`w-full pl-10 pr-4 py-3.5 rounded-xl border text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:border-transparent transition-all text-base ${errors.phone ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 dark:border-gray-700 focus:ring-indigo-500'}`}
                />
              </div>
              {errors.phone && <p className="mt-1.5 text-xs text-red-500">{errors.phone}</p>}
            </div>

            <button
              type="submit" disabled={isLoading || !isValid}
              className={`w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all mt-2 ${isValid && !isLoading ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-lg shadow-indigo-500/30' : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'}`}
            >
              {isLoading
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Yuborilmoqda...</>
                : <>Ro'yxatdan o'tish <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-white/50 mt-5">
          Hisobingiz bormi?{' '}
          <Link to="/login" className="text-white/80 font-medium hover:text-white transition-colors underline underline-offset-2">Kirish</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
