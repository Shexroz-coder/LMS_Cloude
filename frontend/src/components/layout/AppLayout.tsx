import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import AIAssistant from '../ui/AIAssistant';
import { usePermissionStore } from '../../store/permission.store';

/**
 * Barcha rollar uchun umumiy layout — mobil drawer bilan.
 * Sidebar mobilda drawer, desktopda doimiy panel.
 */
const AppLayout = ({ showAI = true }: { showAI?: boolean }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const fetchPermissions = usePermissionStore(s => s.fetchPermissions);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden transition-colors duration-300">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-5">
          <Outlet />
        </main>
      </div>
      {showAI && <AIAssistant />}
    </div>
  );
};

export default AppLayout;
