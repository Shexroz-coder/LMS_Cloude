import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';

let socket: Socket | null = null;

export const getSocket = (): Socket | null => socket;

export const connectSocket = (): Socket => {
  const token = useAuthStore.getState().accessToken;

  if (socket && socket.connected) {
    // Mavjud ulanish ishlamoqda
    return socket;
  }

  if (socket) {
    // Mavjud socket bor lekin ulanmagan — tokenni yangilab qayta ulanamiz
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  // Yangi socket yaratish
  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('✅ Socket ulandi:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket uzildi:', reason);
    // Agar server intentionally disconnect qilsa — qayta ulanmaymiz
    if (reason === 'io server disconnect') {
      socket?.connect();
    }
  });

  socket.on('connect_error', (err) => {
    console.error('🔴 Socket ulanish xatosi:', err.message);
    // Token muammosi bo'lsa, yangi token bilan qayta ulanamiz
    if (err.message === 'Token noto\'g\'ri' || err.message === 'Token kerak') {
      const freshToken = useAuthStore.getState().accessToken;
      if (freshToken && socket) {
        socket.auth = { token: freshToken };
      }
    }
  });

  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Token yangilanganda socket auth ni ham yangilash
export const refreshSocketToken = (): void => {
  const token = useAuthStore.getState().accessToken;
  if (socket && token) {
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
  }
};
