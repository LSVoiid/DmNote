import React from "react";
import { useTranslation } from "@contexts/I18nContext";
import Modal from "../Modal";
import KeyTabContent from "./KeyTabContent";
import NoteTabContent from "./NoteTabContent";
import CounterTabContent from "./CounterTabContent";
import {
  TABS,
  useUnifiedKeySettingState,
  type TabType,
  type KeyData,
  type SaveData,
  type PreviewData,
} from "@hooks/Modal/useUnifiedKeySettingState";
import type { KeyCounterSettings } from "@src/types/keys";

// ============================================================================
// 타입 정의
// ============================================================================

interface UnifiedKeySettingProps {
  keyData: KeyData;
  initialCounterSettings?: KeyCounterSettings | null;
  onSave: (data: SaveData) => void;
  onClose: () => void;
  onPreview?: (data: PreviewData) => void;
  skipAnimation?: boolean;
}

interface TabSwitchProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

// ============================================================================
// 탭 스위치 컴포넌트
// ============================================================================

const TabSwitch: React.FC<TabSwitchProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();

  const tabs = [
    { id: TABS.KEY, label: t("keySetting.tabKey") },
    { id: TABS.NOTE, label: t("keySetting.tabNote") },
    { id: TABS.COUNTER, label: t("keySetting.tabCounter") },
  ] as const;

  return (
    <div className="flex w-full h-[30px] bg-[#26262C] mb-[19px] rounded-[7px] items-center p-[3px] gap-[5px]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`w-full h-[24px] rounded-[7px] text-style-2 transition-colors ${
            activeTab === tab.id
              ? "bg-[#3A3943] text-white"
              : "bg-[#26262C] text-[#9395A1] hover:bg-[#303036]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// 메인 컴포넌트
// ============================================================================

const UnifiedKeySetting: React.FC<UnifiedKeySettingProps> = ({
  keyData,
  initialCounterSettings,
  onSave,
  onClose,
  onPreview,
  skipAnimation = false,
}) => {
  const { t } = useTranslation();
  const initialSkipRef = React.useRef(skipAnimation);

  const {
    activeTab,
    setActiveTab,
    keyState,
    setKeyState,
    noteState,
    setNoteState,
    counterState,
    setCounterState,
    handleKeyPreview,
    handleNotePreview,
    handleCounterPreview,
    handleSubmit,
    handleClose,
  } = useUnifiedKeySettingState({
    keyData,
    initialCounterSettings,
    onPreview,
    onSave,
    onClose,
  });

  // 탭 콘텐츠 렌더링
  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.KEY:
        return (
          <KeyTabContent
            state={keyState}
            setState={setKeyState}
            onPreview={handleKeyPreview}
          />
        );
      case TABS.NOTE:
        return (
          <NoteTabContent
            state={noteState}
            setState={setNoteState}
            onPreview={handleNotePreview}
          />
        );
      case TABS.COUNTER:
        return (
          <CounterTabContent
            state={counterState}
            setState={setCounterState}
            onPreview={handleCounterPreview}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal onClick={handleClose} animate={!initialSkipRef.current}>
      <div
        className="flex flex-col p-[20px] bg-[#1A191E] rounded-[13px] border-[1px] border-[#2A2A30]"
        onClick={(e) => e.stopPropagation()}
      >
        <TabSwitch activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1">{renderTabContent()}</div>

        {/* 저장/취소 버튼 */}
        <div className="flex gap-[10.5px] mt-[19px]">
          <button
            onClick={handleSubmit}
            className="w-[150px] h-[30px] bg-[#2A2A30] hover:bg-[#303036] active:bg-[#393941] rounded-[7px] text-[#DCDEE7] text-style-3"
          >
            {t("keySetting.save")}
          </button>
          <button
            onClick={handleClose}
            className="w-[75px] h-[30px] bg-[#3C1E1E] hover:bg-[#442222] active:bg-[#522929] rounded-[7px] text-[#E6DBDB] text-style-3"
          >
            {t("keySetting.cancel")}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UnifiedKeySetting;
