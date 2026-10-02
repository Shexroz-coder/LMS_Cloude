/**
 * Landing page — roboticedu.uz bosh sahifasi (ro'yxatdan o'tmagan mehmonlar uchun).
 * Kurslar, yutuqlar, o'quvchilar haqida ma'lumot + yuqori o'ngда Kirish / Ro'yxatdan o'tish.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot, Cpu, Code2, Rocket, Trophy, Users, GraduationCap, Star,
  CheckCircle2, Menu, X, ArrowRight, Sparkles, Phone, MapPin, Send,
} from 'lucide-react';

const COURSES = [
  { icon: Bot, title: 'Robototexnika', desc: 'LEGO va Arduino asosida robotlar yasash, dasturlash va musobaqalarga tayyorlash.', color: 'from-cyan-500 to-blue-500' },
  { icon: Code2, title: 'Dasturlash', desc: 'Scratch, Python va veb-dasturlash — bolalar va o\'smirlar uchun bosqichma-bosqich.', color: 'from-violet-500 to-fuchsia-500' },
  { icon: Cpu, title: 'Sun\'iy intellekt (AI)', desc: 'AI asoslari, mashinali o\'qitish va amaliy loyihalar bilan tanishish.', color: 'from-emerald-500 to-teal-500' },
  { icon: Rocket, title: 'STEM & Ijodkorlik', desc: 'Muhandislik, matematika va ijodiy fikrlashни rivojlantiruvchi mashg\'ulotlar.', color: 'from-amber-500 to-orange-500' },
];

const STATS = [
  { icon: Users, value: '500+', label: 'O\'quvchilar' },
  { icon: GraduationCap, value: '20+', label: 'Tajribali ustozlar' },
  { icon: Trophy, value: '50+', label: 'Musobaqa g\'oliblari' },
  { icon: Star, value: '4.9', label: 'O\'rtacha baho' },
];

const WHY = [
  'Zamonaviy jihozlangan laboratoriyalar',
  'Kichik guruhlar — har bir o\'quvchiga e\'tibor',
  'Xalqaro standartdagi o\'quv dasturi',
  'Musobaqa va loyihalarда qatnashish',
  'Har oy ochiq dars va ota-onalar bilan uchrashuv',
  'Bitiruvchilarga sertifikat va portfolio',
];

const TESTIMONIALS = [
  { name: 'Diyor, 12 yosh', text: 'Robot yasashни o\'rgandim va shahar musobaqasида 1-o\'rinni egalladim!', course: 'Robototexnika' },
  { name: 'Madina, 14 yosh', text: 'Python o\'rganib, birinchi o\'yinimni yozdim. Ustozlar juda yaxshi tushuntiradi.', course: 'Dasturlash' },
  { name: 'Ota-ona — Jasur aka', text: 'Farzandim bu yerda o\'zgardi — mantiqiy fikrlashi va ishonchi oshdi.', course: 'STEM' },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/70 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2">
            <span className="relative">
              <span className="absolute -inset-1 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 opacity-60 blur" />
              <span className="relative w-9 h-9 rounded-xl bg-slate-900 ring-1 ring-cyan-400/40 flex items-center justify-center">
                <Bot className="w-5 h-5 text-cyan-300" />
              </span>
            </span>
            <span className="font-bold text-lg">Robotic <span className="text-cyan-400">Edu</span></span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
            <a href="#courses" className="hover:text-white">Kurslar</a>
            <a href="#why" className="hover:text-white">Nega biz?</a>
            <a href="#results" className="hover:text-white">Yutuqlar</a>
            <a href="#contact" className="hover:text-white">Aloqa</a>
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Link to="/login" className="px-4 py-2 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/10 transition">Kirish</Link>
            <Link to="/register" className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:opacity-90 transition">Ro'yxatdan o'tish</Link>
          </div>

          <button className="md:hidden p-2 text-slate-200" onClick={() => setMenuOpen(o => !o)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 bg-slate-950/95 px-4 py-3 space-y-2">
            {['courses:Kurslar', 'why:Nega biz?', 'results:Yutuqlar', 'contact:Aloqa'].map(x => {
              const [id, label] = x.split(':');
              return <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)} className="block py-1.5 text-slate-300">{label}</a>;
            })}
            <div className="flex gap-2 pt-2">
              <Link to="/login" className="flex-1 text-center px-4 py-2 rounded-xl text-sm font-medium bg-white/10">Kirish</Link>
              <Link to="/register" className="flex-1 text-center px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-violet-500">Ro'yxatdan o'tish</Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section id="top" className="relative">
        <div className="absolute inset-0 opacity-50" style={{
          backgroundImage: 'linear-gradient(to right, rgba(34,211,238,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(139,92,246,0.07) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, #000 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, #000 40%, transparent 100%)',
        }} />
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 py-20 sm:py-28 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 ring-1 ring-cyan-400/30 text-xs text-cyan-300 mb-6">
            <Sparkles className="w-3.5 h-3.5" /> Kelajak kasblari — bugundan boshlab
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight">
            Bolangizni <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">robototexnika</span> va <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">AI</span> olamiga olib kiring
          </h1>
          <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
            Robotic Edu — bolalar va o'smirlar uchun zamonaviy ta'lim markazi. Robototexnika, dasturlash va sun'iy intellekt bo'yicha amaliy mashg'ulotlar.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/register" className="group inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:opacity-90 transition">
              Ro'yxatdan o'tish <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
            </Link>
            <a href="#courses" className="px-6 py-3 rounded-2xl font-medium bg-white/5 ring-1 ring-white/15 hover:bg-white/10 transition">Kurslar bilan tanishish</a>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section id="results" className="max-w-6xl mx-auto px-4 -mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STATS.map(s => (
            <div key={s.label} className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 text-center">
              <s.icon className="w-6 h-6 mx-auto text-cyan-400 mb-2" />
              <div className="text-2xl sm:text-3xl font-extrabold">{s.value}</div>
              <div className="text-xs text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Courses ── */}
      <section id="courses" className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center">Kurslarimiz</h2>
        <p className="text-center text-slate-400 mt-2">Har bir yosh va daraja uchun yo'nalish</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
          {COURSES.map(c => (
            <div key={c.title} className="group rounded-2xl bg-white/5 ring-1 ring-white/10 p-6 hover:ring-cyan-400/40 hover:-translate-y-1 transition">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-4`}>
                <c.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-lg">{c.title}</h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why us ── */}
      <section id="why" className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-gradient-to-br from-white/5 to-transparent ring-1 ring-white/10 p-8 sm:p-10">
          <h2 className="text-3xl font-bold">Nega Robotic Edu?</h2>
          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            {WHY.map(w => (
              <div key={w} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span className="text-slate-300">{w}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center">O'quvchilarimiz</h2>
        <div className="grid sm:grid-cols-3 gap-4 mt-10">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
              <div className="flex gap-0.5 text-amber-400 mb-3">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}</div>
              <p className="text-slate-200">"{t.text}"</p>
              <div className="mt-4 text-sm"><span className="font-semibold">{t.name}</span> <span className="text-slate-500">· {t.course}</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-gradient-to-r from-cyan-600/30 to-violet-600/30 ring-1 ring-cyan-400/30 p-10 text-center">
          <h2 className="text-3xl font-bold">Bugun boshlang!</h2>
          <p className="text-slate-300 mt-2">Bepul sinov darsiga yoziling — bolangizning qiziqishини kashf eting.</p>
          <Link to="/register" className="inline-flex items-center gap-2 mt-6 px-7 py-3 rounded-2xl font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:opacity-90 transition">
            Ro'yxatdan o'tish <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="contact" className="border-t border-white/10 mt-10">
        <div className="max-w-6xl mx-auto px-4 py-10 grid sm:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="flex items-center gap-2 font-bold text-lg"><Bot className="w-5 h-5 text-cyan-400" /> Robotic Edu</div>
            <p className="text-slate-400 mt-2">Bolalar va o'smirlar uchun robototexnika, dasturlash va AI ta'lim markazi.</p>
          </div>
          <div className="space-y-2 text-slate-300">
            <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-cyan-400" /> +998 90 000 00 00</div>
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-cyan-400" /> Toshkent sh.</div>
            <div className="flex items-center gap-2"><Send className="w-4 h-4 text-cyan-400" /> @roboticedu</div>
          </div>
          <div className="flex sm:justify-end items-start gap-2">
            <Link to="/login" className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 transition">Kirish</Link>
            <Link to="/register" className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 font-semibold">Ro'yxatdan o'tish</Link>
          </div>
        </div>
        <div className="text-center text-xs text-slate-500 pb-6">© {new Date().getFullYear()} Robotic Edu. Barcha huquqlar himoyalangan.</div>
      </footer>
    </div>
  );
}
