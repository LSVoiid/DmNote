import { create } from "zustand";

interface UIState {
  // 기타 설정 팝업(extras popup)의 열림 상태
  isExtrasPopupOpen: boolean;
  setExtrasPopupOpen: (value: boolean) => void;
  // 불러오기/내보내기 팝업의 열림 상태
  isExportImportPopupOpen: boolean;
  setExportImportPopupOpen: (value: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isExtrasPopupOpen: false,
  setExtrasPopupOpen: (value) => set({ isExtrasPopupOpen: value }),
  isExportImportPopupOpen: false,
  setExportImportPopupOpen: (value) => set({ isExportImportPopupOpen: value }),
}));
