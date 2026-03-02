import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../../api/axios';

function getMonthOptions() {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: d.toLocaleDateString('uz-UZ',{month:'long',year:'numeric'}) });
  }
  return months;
}

type ReportType = 'students' | 'payments' | 'attendance' | 'grades';

const REPORTS: { type: ReportType; icon: string; title: string; desc: string; endpoint: string }[] = [
  { type: 'students', icon: '👥', title: "O'quvchilar ro'yxati", desc: "Barcha o'quvchilar, guruhlar, balans", endpoint: '/students?limit=1000' },
  { type: 'payments', icon: '💰', title: "To'lovlar hisoboti", desc: "Oylik to'lovlar, qarzlar", endpoint: '/payments?limit=1000' },
  { type: 'attendance', icon: '📋', title: "Davomat hisoboti", desc: "O'quvchilar davomati statistikasi", endpoint: '/attendance/stats' },
  { type: 'grades', icon: '📊', title: "Baholar hisoboti", desc: "O'quvchilar baholari", endpoint: '/grades?limit=1000' },
];

function downloadCSV(data: unknown[], filename: string) {
  if (!data.length) { alert("Ma'lumot topilmadi"); return; }
  const flatten = (obj: unknown, prefix = ''): Record<string, string> => {
    const flat: Record<string, string> = {};
    if (typeof obj !== 'object' || obj === null) return flat;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) Object.assign(flat, flatten(v, key));
      else if (!Array.isArray(v)) flat[key] = String(v ?? '');
    }
    return flat;
  };
  const rows = data.map(row => flatten(row));
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h]||'').replace(/"/g,'""')}"`).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const ReportsPage = () => {
  const [selectedMonth, setSelectedMonth] = useState(() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; });
  const [downloading, setDownloading] = useState<ReportType|null>(null);
  const months = getMonthOptions();

  const { data: stats } = useQuery(['report-stats', selectedMonth], async () => {
    const [s, p, a] = await Promise.allSettled([
      api.get('/students?limit=1').then(r => r.data?.meta?.total||0),
      api.get(`/payments/summary?month=${selectedMonth}`).then(r => r.data?.data?.income||0),
      api.get(`/attendance/stats?month=${selectedMonth}`).then(r => r.data?.data?.rate||0),
    ]);
    return {
      students: s.status==='fulfilled'?s.value:0,
      income: p.status==='fulfilled'?p.value:0,
      attendance: a.status==='fulfilled'?a.value:0,
    };
  });

  const handleDownload = async (report: typeof REPORTS[number]) => {
    setDownloading(report.type);
    try {
      const sep = report.endpoint.includes('?') ? '&' : '?';
      const r = await api.get(`${report.endpoint}${sep}month=${selectedMonth}`);
      const raw = r.data?.data;
      let items: unknown[] = [];
      if (Array.isArray(raw)) items = raw;
      else if (raw?.payments) items = raw.payments;
      else if (raw?.students) items = raw.students;
      else if (raw?.grades) items = raw.grades;
      else if (typeof raw==='object' && raw!==null) items = [raw];
      downloadCSV(items, `${report.type}-${selectedMonth}.csv`);
    } catch { alert("Yuklashda xato yuz berdi."); }
    setDownloading(null);
  };

  const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hisobotlar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ma'lumotlarni CSV formatida yuklab oling</p>
        </div>
        <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {months.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label:"O'quvchilar", value: stats.students, icon:"👥" },
            { label:"Daromad", value: fmt(stats.income)+" so'm", icon:"💰" },
            { label:"Davomat", value: stats.attendance+"%", icon:"✅" },
          ].map(s=>(
            <div key={s.label} className="card flex items-center gap-3">
              <span className="text-2xl">{s.icon}</span>
              <div><p className="text-xs text-gray-400">{s.label}</p><p className="font-bold text-gray-800">{s.value}</p></div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map(report=>(
          <div key={report.type} className="card hover:shadow-md transition">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl flex-shrink-0">{report.icon}</div>
              <div><h3 className="font-semibold text-gray-800">{report.title}</h3><p className="text-sm text-gray-500 mt-0.5">{report.desc}</p></div>
            </div>
            <button
              onClick={()=>handleDownload(report)}
              disabled={downloading===report.type}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-xl transition text-sm"
            >
              {downloading===report.type ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Yuklanmoqda...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>CSV yuklab olish ({selectedMonth})</>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="card bg-blue-50 border border-blue-100">
        <p className="text-sm font-semibold text-blue-800 mb-2">💡 Foydalanish bo'yicha</p>
        <p className="text-sm text-blue-700">Hisobotni yuklab olish uchun oy tanlang va "CSV yuklab olish" tugmasini bosing. CSV faylni Microsoft Excel yoki Google Sheets da ochish mumkin.</p>
      </div>
    </div>
  );
};

export default ReportsPage;
