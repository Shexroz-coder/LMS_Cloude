import { Bell, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import api from '../../api/axios';
import { connectSocket, getSocket } from '../../services/socket';

interface HeaderProps {
  title?: string;
}

const Header = ({ title }: HeaderProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();
  const qc = useQueryClient();
  const basePath = `/${user?.role?.toLowerCase() || ''}`;

  // Bildirishnomalar soni (API dan)
  const { data: notifData } = useQuery(
    ['notifications-count'],
    () => api.get('/notifications?unreadOnly=true&limit=1').then((r) => r.data?.data?.unreadCount || 0),
    { refetchInterval: 30000, staleTime: 10000 }
  );
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // API dan kelgan sonni state'ga yuklash
  useEffect(() => {
    if (typeof notifData === 'number') {
      setUnreadCount(notifData);
    }
  }, [notifData]);

  // Socket orqali real-time yangilash
  useEffect(() => {
    if (!accessToken) return;
    const socket = connectSocket();

    const onNotification = () => {
      setUnreadCount((c) => c + 1);
      qc.invalidateQueries(['notifications']);
      qc.invalidateQueries(['notifications-count']);
    };

    socket.on('new_notification', onNotification);
    return () => { socket.off('new_notification', onNotification); };
  }, [accessToken, qc]);

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-5 gap-4 flex-shrink-0">
      {/* Title */}
      {title && (
        <h1 className="text-base font-semibold text-gray-800 mr-auto">{title}</h1>
      )}

      {/* Search */}
      <div className="relative flex-1 max-w-xs ml-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('common.search') + '...'}
          className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
        />
      </div>

      {/* Language */}
      <LanguageSwitcher />

      {/* Notifications */}
      <button
        onClick={() => {
          navigate(`${basePath}/notifications`);
          setUnreadCount(0);
          qc.invalidateQueries(['notifications-count']);
        }}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* User avatar */}
      <button
        onClick={() => navigate(`${basePath}/profile`)}
        className="flex items-center gap-2 pl-2"
      >
        <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm">
          {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-sm font-medium text-gray-800 leading-tight">{user?.fullName}</div>
          <div className="text-xs text-gray-400 leading-tight">{user?.phone}</div>
        </div>
      </button>
    </header>
  );
};

export default Header;
