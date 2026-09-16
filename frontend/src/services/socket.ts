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
  // Production: shu origin orqali (nginx /socket.io proxy qiladi)
  // Development: localhost:5000
  const socketUrl =
    import.meta.env.VITE_SOCKET_URL ||
    (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000');

  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
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

  let errorLogged = false;
  socket.on('connect_error', (err) => {
    // Bir marta log — konsolni to'ldirmaslik uchun
    if (!errorLogged) {
      console.warn('🔴 Socket ulanish xatosi:', err.message);
      errorLogged = true;
    }
    // Token muammosi bo'lsa, yangi token bilan qayta ulanamiz
    if (err.message === 'Token noto\'g\'ri' || err.message === 'Token kerak') {
      const freshToken = useAuthStore.getState().accessToken;
      if (freshToken && socket) {
        socket.auth = { token: freshToken };
      }
    }
  });

  // Urinishlar tugagach — butunlay to'xtatish (cheksiz loop oldini olish)
  socket.io.on('reconnect_failed', () => {
    console.warn('⚠️ Socket qayta ulanish to\'xtatildi (limit tugadi). Sahifa yangilanganda qayta uriniladi.');
  });

  socket.on('connect', () => { errorLogged = false; });

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
