import { create } from 'zustand';

interface PropertyFilterState {
  activePropertyId: number | null;
  setActivePropertyId: (id: number | null) => void;
}

export const usePropertyFilterStore = create<PropertyFilterState>((set) => ({
  activePropertyId: null,
  setActivePropertyId: (id) => set({ activePropertyId: id }),
}));
