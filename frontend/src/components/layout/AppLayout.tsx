import { Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from 'react-query';
import Sidebar from './Sidebar';
import Header from './Header';
import AIAssistant from '../ui/AIAssistant';
import { usePermissionStore } from '../../store/permission.store';
import { useBranchStore } from '../../store/branch.store';

/**
 * Barcha rollar uchun umumiy layout — mobil drawer bilan.
 * Sidebar mobilda drawer, desktopda doimiy panel.
 */
const AppLayout = ({ showAI = true }: { showAI?: boolean }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const fetchPermissions = usePermissionStore(s => s.fetchPermissions);
  const selectedBranchId = useBranchStore(s => s.selectedBranchId);
  const qc = useQueryClient();
  const prevBranch = useRef(selectedBranchId);
  const location = useLocation();

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  // Filial o'zgarganda — BARCHA so'rovlarni qayta yuklash (ekrandagi hamma ma'lumot yangilanadi)
  useEffect(() => {
    if (prevBranch.current !== selectedBranchId) {
      prevBranch.current = selectedBranchId;
      qc.invalidateQueries(); // hamma query qayta so'raladi (yangi branchId bilan)
    }
  }, [selectedBranchId, qc]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden transition-colors duration-300">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 relative">
          {/* ── Futuristic ambient fon (dekorativ, yengil) ── */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
            <div className="cyber-grid absolute inset-0" />
            <div className="glow-orb animate-float-soft" style={{ width: 320, height: 320, top: -80, right: -60, background: '#22D3EE' }} />
            <div className="glow-orb animate-float-soft" style={{ width: 260, height: 260, bottom: -60, left: -40, background: '#8B5CF6', animationDelay: '1.5s' }} />
          </div>
          {/* ── Sahifa kontenti — har almashinuvda qisqa transition ── */}
          <div key={location.pathname} className="page-enter relative z-10">
            <Outlet />
          </div>
        </main>
      </div>
      {showAI && <AIAssistant />}
    </div>
  );
};

export default AppLayout;
