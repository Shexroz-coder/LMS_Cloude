import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useBranchStore } from '../store/branch.store';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Request interceptor — token + tanlangan filial qo'shish
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Tanlangan filialni har GET so'roviga qo'shish (agar tanlangan bo'lsa)
  const branchId = useBranchStore.getState().selectedBranchId;
  if (branchId != null) {
    const method = (config.method || 'get').toLowerCase();
    if (method === 'get') {
      config.params = { ...(config.params || {}), branchId };
    }
  }
  return config;
});

// Response interceptor — token yangilash
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      const { refreshToken, setAccessToken, logout } = useAuthStore.getState();
      if (!refreshToken) {
        logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const res = await axios.post('/api/v1/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = res.data.data;
        setAccessToken(accessToken);
        // Yangi refreshToken ham saqlanishi kerak!
        if (newRefreshToken) {
          useAuthStore.getState().setAuth(
            useAuthStore.getState().user!,
            accessToken,
            newRefreshToken
          );
        }
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
