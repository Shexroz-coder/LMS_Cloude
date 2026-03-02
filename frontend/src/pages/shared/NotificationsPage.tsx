import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../../api/axios';
import clsx from 'clsx';

interface Notification {
  id: number;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  PAYMENT: '💰', ATTENDANCE: '📋', GRADE: '📊', ANNOUNCEMENT: '📢',
  SYSTEM: '⚙️', REMINDER: '⏰',
};
const TYPE_LABELS: Record<string, string> = {
  PAYMENT: "To'lov", ATTENDANCE: 'Davomat', GRADE: 'Baho', ANNOUNCEMENT: "E'lon",
  SYSTEM: 'Tizim', REMINDER: 'Eslatma',
};

const NotificationsPage = () => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data, isLoading } = useQuery<{ notifications: Notification[]; unreadCount: number }>(
    ['notifications', filter],
    async () => {
      const params = filter === 'unread' ? '?isRead=false' : '';
      const r = await api.get(`/notifications${params}`);
      return r.data?.data;
    }
  );

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const markReadMutation = useMutation(
    (id: number) => api.put(`/notifications/${id}/read`),
    { onSuccess: () => qc.invalidateQueries(['notifications']) }
  );

  const markAllReadMutation = useMutation(
    () => api.put('/notifications/read-all'),
    { onSuccess: () => qc.invalidateQueries(['notifications']) }
  );

  function fmtTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Hozirgina';
    if (minutes < 60) return `${minutes} daqiqa oldin`;
    if (hours < 24) return `${hours} soat oldin`;
    if (days < 7) return `${days} kun oldin`;
    return d.toLocaleDateString('uz-UZ');
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bildirishnomalar</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-indigo-600 mt-0.5 font-medium">{unreadCount} ta o'qilmagan</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 rounded-xl overflow-hidden">
            {(['all', 'unread'] as const).map(f => (
              <button key={f} onClick={()=>setFilter(f)} className={clsx("px-3 py-1.5 text-sm font-medium transition", filter===f?"bg-indigo-600 text-white":"text-gray-600 hover:bg-gray-50")}>
                {f==='all'?'Barchasi':"O'qilmagan"}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button onClick={()=>markAllReadMutation.mutate()} disabled={markAllReadMutation.isLoading} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition">
              Barchasini o'qilgan deb belgilash
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="card text-center py-12">
          <div className="animate-spin w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"/>
          <p className="text-gray-400 text-sm">Yuklanmoqda...</p>
        </div>
      )}

      {!isLoading && notifications.length === 0 && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🔔</div>
          <h2 className="text-lg font-semibold text-gray-700">
            {filter==='unread' ? "O'qilmagan bildirishnomalar yo'q" : 'Bildirishnomalar yo\'q'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">Bildirishnomalar bu yerda ko'rsatiladi</p>
        </div>
      )}

      {!isLoading && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => !n.isRead && markReadMutation.mutate(n.id)}
              className={clsx(
                "card flex items-start gap-4 cursor-pointer transition",
                !n.isRead ? "border-l-4 border-indigo-500 bg-indigo-50/30" : "hover:bg-gray-50"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
                {TYPE_ICONS[n.type] || '🔔'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={clsx("text-sm font-semibold", !n.isRead ? "text-gray-900" : "text-gray-700")}>
                      {n.title}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{fmtTime(n.createdAt)}</span>
                    {n.type && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {TYPE_LABELS[n.type] || n.type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {!n.isRead && (
                <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-2"/>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
