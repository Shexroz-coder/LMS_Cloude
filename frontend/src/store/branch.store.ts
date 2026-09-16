import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Tanlangan filial — barcha ma'lumotlar shu filial bo'yicha filtrlanadi.
 * selectedBranchId = null  →  "Barcha filiallar"
 */
interface BranchState {
  selectedBranchId: number | null;
  setBranch: (id: number | null) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      selectedBranchId: null,
      setBranch: (id) => set({ selectedBranchId: id }),
    }),
    { name: 'robotic_edu_branch' }
  )
);
