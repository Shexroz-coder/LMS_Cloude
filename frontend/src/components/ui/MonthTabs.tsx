/**
 * Oylar tugmalari — yonma-yon. Bosilган oy tanlanadi (YYYY-MM).
 * Dashboardда tepада turadi; raqamlar shu oy bo'yicha ko'rsatiladi.
 */
const UZ_MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

function lastMonths(count: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ value, label: UZ_MONTHS[d.getMonth()] });
  }
  return out;
}

export default function MonthTabs({ value, onChange, count = 6 }: {
  value: string;
  onChange: (v: string) => void;
  count?: number;
}) {
  const months = lastMonths(count);
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-gray-100 dark:bg-gray-800/60 p-1 rounded-2xl">
      {months.map(m => {
        const active = m.value === value;
        return (
          <button key={m.value} onClick={() => onChange(m.value)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${
              active ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                     : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
