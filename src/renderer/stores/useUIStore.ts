import { create } from "zustand";

interface UIState {
  // 기타 설정 팝업(extras popup)의 열림 상태
  isExtrasPopupOpen: boolean;
  setExtrasPopupOpen: (value: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isExtrasPopupOpen: false,
  setExtrasPopupOpen: (value) => set({ isExtrasPopupOpen: value }),
}));
