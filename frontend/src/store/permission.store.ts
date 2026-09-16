import { create } from 'zustand';
import api from '../api/axios';

/**
 * Joriy foydalanuvchi ruxsatlari (backend /permissions/my dan).
 * Menyu va tugmalarni yashirish/ko'rsatish uchun.
 */
interface PermissionState {
  permissions: Record<string, boolean>;
  loaded: boolean;
  fetchPermissions: () => Promise<void>;
  can: (key: string) => boolean;
  reset: () => void;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: {},
  loaded: false,
  fetchPermissions: async () => {
    try {
      const r = await api.get('/permissions/my');
      set({ permissions: r.data?.data?.permissions ?? {}, loaded: true });
    } catch {
      set({ permissions: {}, loaded: true });
    }
  },
  // Ruxsat yuklanmagan bo'lsa — ruxsat bor deb hisoblaymiz (ADMIN uchun ham)
  can: (key: string) => {
    const { permissions, loaded } = get();
    if (!loaded) return true;
    return permissions[key] !== false;
  },
  reset: () => set({ permissions: {}, loaded: false }),
}));
