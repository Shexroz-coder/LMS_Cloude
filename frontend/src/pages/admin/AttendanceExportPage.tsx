/**
 * Davomat Export sahifasi
 * Guruh, O'quvchi va Oylik kesimida Excel export
 */
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';

// ── Turlar ──────────────────────────────────────────────────────────────────
type ExportTab = 'group' | 'student' | 'monthly';

interface Group {
  id: number;
  name: string;
  course: { name: string };
}

interface StudentItem {
  id: number;
  fullName: string;
  groupName: string;
}

// ── Oylar ro'yxati ──────────────────────────────────────────────────────────
function getMonthOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });
    opts.push({ value: val, label });
  }
  return opts;
}

function currentMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

// ── Token olish (blob download uchun) ───────────────────────────────────────
function getToken(): string {
  return useAuthStore.getState().accessToken ?? '';
}

async function downloadBlob(url: string, filename: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Xatolik' }));
    throw new Error(err.error ?? "Yuklab bo'lmadi");
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// ── Tab button ───────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: string; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-200
        ${active
          ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:text-blue-600'
        }`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </button>
  );
}

// ── Select komponenti ────────────────────────────────────────────────────────
function Select({ value, onChange, options, placeholder, disabled }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
        bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm
        focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50
        transition-colors"
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Download tugmasi ─────────────────────────────────────────────────────────
function DownloadBtn({ onClick, loading, disabled }: {
  onClick: () => void; loading: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200
        ${disabled || loading
          ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
          : 'bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200 dark:shadow-green-900 active:scale-95'
        }`}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Yuklanmoqda...
        </>
      ) : (
        <>
          <span>⬇️</span>
          Excel yuklab olish
        </>
      )}
    </button>
  );
}

// ── Info karti ───────────────────────────────────────────────────────────────
function InfoCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
      <span className="text-xl mt-0.5">{icon}</span>
      <div>
        <p className="font-semibold text-sm text-blue-800 dark:text-blue-200">{title}</p>
        <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ASOSIY KOMPONENT
// ════════════════════════════════════════════════════════════════════════════
const AttendanceExportPage = () => {
  const [activeTab, setActiveTab] = useState<ExportTab>('group');
  const months = getMonthOptions();

  // ── Tab: Guruh ──
  const [groupMonth, setGroupMonth] = useState(currentMonth());
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState('');

  // ── Tab: O'quvchi ──
  const [studentMonth, setStudentMonth] = useState(currentMonth());
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState('');

  // ── Tab: Oylik ──
  const [monthlyMonth, setMonthlyMonth] = useState(currentMonth());
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState('');

  // ── Ma'lumotlar ──
  const { data: groupsData } = useQuery<Group[]>(
    'export-groups-list',
    async () => {
      const r = await api.get('/attendance/export/groups-list');
      return r.data.data;
    },
    { staleTime: 60000 }
  );

  const { data: studentsData } = useQuery<StudentItem[]>(
    'export-students-list',
    async () => {
      const r = await api.get('/attendance/export/students-list');
      return r.data.data;
    },
    { staleTime: 60000 }
  );

  const groups = groupsData ?? [];
  const students = studentsData ?? [];

  // ── Search filter for students ──
  const [studentSearch, setStudentSearch] = useState('');
  const filteredStudents = students.filter(s =>
    s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.groupName.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // ── Download handlers ──
  const handleGroupExport = async () => {
    if (!selectedGroupId) { setGroupError('Guruh tanlang'); return; }
    setGroupError('');
    setGroupLoading(true);
    try {
      const group = groups.find(g => g.id === Number(selectedGroupId));
      const ml = months.find(m => m.value === groupMonth)?.label ?? groupMonth;
      const filename = `Davomat_${group?.name ?? 'Guruh'}_${ml}.xlsx`;
      await downloadBlob(
        `/api/v1/attendance/export/group?groupId=${selectedGroupId}&month=${groupMonth}`,
        filename
      );
    } catch (e: any) {
      setGroupError(e.message ?? 'Xatolik yuz berdi');
    } finally {
      setGroupLoading(false);
    }
  };

  const handleStudentExport = async () => {
    if (!selectedStudentId) { setStudentError("O'quvchi tanlang"); return; }
    setStudentError('');
    setStudentLoading(true);
    try {
      const student = students.find(s => s.id === Number(selectedStudentId));
      const ml = months.find(m => m.value === studentMonth)?.label ?? studentMonth;
      const filename = `Davomat_${student?.fullName ?? "O'quvchi"}_${ml}.xlsx`;
      await downloadBlob(
        `/api/v1/attendance/export/student?studentId=${selectedStudentId}&month=${studentMonth}`,
        filename
      );
    } catch (e: any) {
      setStudentError(e.message ?? 'Xatolik yuz berdi');
    } finally {
      setStudentLoading(false);
    }
  };

  const handleMonthlyExport = async () => {
    setMonthlyError('');
    setMonthlyLoading(true);
    try {
      const ml = months.find(m => m.value === monthlyMonth)?.label ?? monthlyMonth;
      const filename = `Davomat_Oylik_${ml}.xlsx`;
      await downloadBlob(
        `/api/v1/attendance/export/monthly?month=${monthlyMonth}`,
        filename
      );
    } catch (e: any) {
      setMonthlyError(e.message ?? 'Xatolik yuz berdi');
    } finally {
      setMonthlyLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Sarlavha */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl shadow">
          📊
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Davomat Export</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Excel ko'rinishida davomat jadvalini yuklab oling
          </p>
        </div>
      </div>

      {/* Tab tanlash */}
      <div className="flex flex-wrap gap-3">
        <TabBtn
          active={activeTab === 'group'}
          onClick={() => setActiveTab('group')}
          icon="🏫"
          label="Guruh kesimida"
        />
        <TabBtn
          active={activeTab === 'student'}
          onClick={() => setActiveTab('student')}
          icon="👤"
          label="O'quvchi kesimida"
        />
        <TabBtn
          active={activeTab === 'monthly'}
          onClick={() => setActiveTab('monthly')}
          icon="📅"
          label="Oylik xulosa"
        />
      </div>

      {/* ── Tab: GURUH KESIMIDA ── */}
      {activeTab === 'group' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-5">
          <InfoCard
            icon="🏫"
            title="Guruh bo'yicha davomat jadvali"
            desc="Tanlangan guruhning barcha o'quvchilari, har bir dars kuni uchun davomat holati va umumiy statistika"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Oy tanlang
              </label>
              <Select
                value={groupMonth}
                onChange={setGroupMonth}
                options={months}
                placeholder="Oy..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Guruh tanlang
              </label>
              <Select
                value={selectedGroupId}
                onChange={setSelectedGroupId}
                options={groups.map(g => ({
                  value: String(g.id),
                  label: `${g.name} (${g.course.name})`,
                }))}
                placeholder="Guruh..."
              />
            </div>
          </div>

          {groupError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
              <span>⚠️</span> {groupError}
            </div>
          )}

          <div className="flex items-center gap-4 pt-1">
            <DownloadBtn
              onClick={handleGroupExport}
              loading={groupLoading}
              disabled={!selectedGroupId}
            />
            {selectedGroupId && (
              <p className="text-xs text-gray-400">
                {groups.find(g => g.id === Number(selectedGroupId))?.name} — {months.find(m => m.value === groupMonth)?.label}
              </p>
            )}
          </div>

          {/* Jadval tarkibi haqida */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-2">Excel ichida:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { icon: '✅', label: 'Keldi' },
                { icon: '❌', label: 'Kelmadi' },
                { icon: '⏰', label: 'Kech' },
                { icon: '📝', label: 'Sababli' },
                { icon: '📊', label: '% statistika' },
              ].map(b => (
                <span key={b.label} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: O'QUVCHI KESIMIDA ── */}
      {activeTab === 'student' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-5">
          <InfoCard
            icon="👤"
            title="O'quvchi bo'yicha davomat jadvali"
            desc="Tanlangan o'quvchining oylik davomat tarixi: sana, kun, guruh va status bo'yicha"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Oy tanlang
              </label>
              <Select
                value={studentMonth}
                onChange={setStudentMonth}
                options={months}
                placeholder="Oy..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                O'quvchi qidiring
              </label>
              <input
                type="text"
                value={studentSearch}
                onChange={e => { setStudentSearch(e.target.value); setSelectedStudentId(''); }}
                placeholder="Ism yoki guruh bo'yicha..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                  bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* O'quvchilar ro'yxati */}
          {studentSearch.length >= 1 && (
            <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700">
              {filteredStudents.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">Topilmadi</div>
              ) : (
                filteredStudents.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedStudentId(String(s.id)); setStudentSearch(s.fullName); }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors
                      hover:bg-blue-50 dark:hover:bg-blue-900/20
                      ${selectedStudentId === String(s.id) ? 'bg-blue-50 dark:bg-blue-900/20 font-semibold' : ''}
                      border-b border-gray-100 dark:border-gray-700 last:border-0`}
                  >
                    <span className="text-gray-800 dark:text-gray-100">{s.fullName}</span>
                    <span className="text-xs text-gray-400">{s.groupName}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Tanlangan o'quvchi ko'rinishi */}
          {selectedStudentId && !studentSearch.includes(' ') === false && (
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl">
              <span>✅</span>
              <span className="font-semibold">{students.find(s => s.id === Number(selectedStudentId))?.fullName}</span>
              <span className="text-blue-400 text-xs">— {students.find(s => s.id === Number(selectedStudentId))?.groupName}</span>
              <button onClick={() => { setSelectedStudentId(''); setStudentSearch(''); }} className="ml-auto text-blue-400 hover:text-blue-600">✕</button>
            </div>
          )}

          {studentError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
              <span>⚠️</span> {studentError}
            </div>
          )}

          <DownloadBtn
            onClick={handleStudentExport}
            loading={studentLoading}
            disabled={!selectedStudentId}
          />
        </div>
      )}

      {/* ── Tab: OYLIK XULOSA ── */}
      {activeTab === 'monthly' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-5">
          <InfoCard
            icon="📅"
            title="Oylik umumiy davomat xulosasi"
            desc="Barcha guruhlar bo'yicha oylik davomat xulosasi: jami darslar, davomat %, har guruh uchun batafsil varaqlar"
          />

          <div className="max-w-xs space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Oy tanlang
            </label>
            <Select
              value={monthlyMonth}
              onChange={setMonthlyMonth}
              options={months}
              placeholder="Oy..."
            />
          </div>

          {monthlyError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
              <span>⚠️</span> {monthlyError}
            </div>
          )}

          <DownloadBtn
            onClick={handleMonthlyExport}
            loading={monthlyLoading}
          />

          {/* Excel tarkibi */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Excel ichida bir nechta varaq:</p>
            <div className="space-y-2">
              {[
                { icon: '📊', title: 'Umumiy xulosa', desc: "Barcha guruhlar: o'quvchilar soni, darslar, davomat %" },
                { icon: '🏫', title: 'Har bir guruh', desc: 'Har guruh uchun alohida varaq: o\'quvchilar × kunlar matritsasi' },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Qo'shimcha ma'lumot */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: '🎨', label: 'Rang kodlangan', desc: 'Keldi/kelmadi/kech ranglar bilan ajratilgan' },
          { icon: '📌', label: 'Muzlatilgan sarlavha', desc: "Katta jadvallarda sarlavha doim ko'rinib turadi" },
          { icon: '📈', label: 'Avtomatik statistika', desc: 'Har o\'quvchi va guruh uchun foiz hisoblanadi' },
        ].map(f => (
          <div key={f.label} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-center">
            <div className="text-2xl mb-1">{f.icon}</div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{f.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttendanceExportPage;
