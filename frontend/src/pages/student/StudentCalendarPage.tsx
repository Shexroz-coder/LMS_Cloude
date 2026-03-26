import { useQuery } from 'react-query';
import api from '../../api/axios';
import CalendarPage from '../shared/CalendarPage';

export default function StudentCalendarPage() {
  const { data: me } = useQuery('my-student-id', async () => {
    const res = await api.get('/students/me');
    return res.data.data;
  });

  if (!me?.id) return <div className="p-6 text-center text-gray-400">Yuklanmoqda...</div>;

  return <CalendarPage studentId={me.id} />;
}
