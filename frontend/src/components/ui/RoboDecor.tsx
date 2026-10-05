/**
 * RoboDecor — dekorativ SVG fon (robot, FPV dron, circuit chiziqlar).
 * O'zi chizilgan (original), tashqi rasm emas. Past opacity, bosilmaydi.
 * Landing, Login, Register fonlarида ishlatiladi.
 */
export default function RoboDecor({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {/* Circuit traces */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.12]" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 600" fill="none">
        <g stroke="#22D3EE" strokeWidth="1.5">
          <path d="M0 120 H180 V60 H340" />
          <path d="M800 200 H620 V300 H460" />
          <path d="M60 600 V440 H200 V520 H360" />
          <path d="M740 600 V480 H560" />
          <circle cx="340" cy="60" r="4" fill="#22D3EE" />
          <circle cx="460" cy="300" r="4" fill="#8B5CF6" />
          <circle cx="360" cy="520" r="4" fill="#22D3EE" />
          <circle cx="560" cy="480" r="4" fill="#8B5CF6" />
        </g>
      </svg>

      {/* Robot (chapда pastда) */}
      <svg className="absolute -left-6 bottom-2 w-40 h-40 opacity-20" viewBox="0 0 120 120" fill="none" stroke="#38BDF8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <line x1="60" y1="20" x2="60" y2="34" />
        <circle cx="60" cy="16" r="4" fill="#38BDF8" />
        <rect x="34" y="34" width="52" height="40" rx="10" />
        <circle cx="50" cy="52" r="5" fill="#38BDF8" />
        <circle cx="70" cy="52" r="5" fill="#38BDF8" />
        <path d="M50 64 q10 8 20 0" />
        <rect x="44" y="78" width="32" height="26" rx="6" />
        <line x1="34" y1="84" x2="22" y2="94" />
        <line x1="86" y1="84" x2="98" y2="94" />
      </svg>

      {/* FPV Dron (o'ngда yuqorида) */}
      <svg className="absolute right-4 top-6 w-44 h-28 opacity-20" viewBox="0 0 160 100" fill="none" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="64" y="42" width="32" height="18" rx="5" />
        <line x1="64" y1="46" x2="34" y2="26" />
        <line x1="96" y1="46" x2="126" y2="26" />
        <line x1="64" y1="56" x2="34" y2="76" />
        <line x1="96" y1="56" x2="126" y2="76" />
        <ellipse cx="30" cy="24" rx="16" ry="5" />
        <ellipse cx="130" cy="24" rx="16" ry="5" />
        <ellipse cx="30" cy="78" rx="16" ry="5" />
        <ellipse cx="130" cy="78" rx="16" ry="5" />
      </svg>
    </div>
  );
}
