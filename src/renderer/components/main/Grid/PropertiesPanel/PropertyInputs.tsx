import React, { useState, useEffect, useRef } from "react";
import type {
  PropertyRowProps,
  NumberInputProps,
  TextInputProps,
  ColorInputProps,
  SelectInputProps,
  ToggleSwitchProps,
  TabButtonProps,
  TabsProps,
  FontStyleToggleProps,
} from "./types";
import { TABS } from "./types";

// ============================================================================
// PropertyRow
// ============================================================================

export const PropertyRow: React.FC<PropertyRowProps> = ({ label, children }) => (
  <div className="flex justify-between items-center w-full">
    <p className="text-white text-style-2">{label}</p>
    <div className="flex items-center gap-[10.5px]">{children}</div>
  </div>
);

// ============================================================================
// NumberInput
// ============================================================================

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  onBlur,
  min = 0,
  max = 9999,
  prefix,
  suffix,
  width = "54px",
}) => {
  const hasSuffix = !!suffix;
  
  const getDisplayValue = (val: number | string, focused: boolean): string => {
    if (hasSuffix && !focused) {
      return `${val}${suffix}`;
    }
    return String(val);
  };

  const [localValue, setLocalValue] = useState<string>(getDisplayValue(value, false));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(getDisplayValue(value, false));
    }
  }, [value, isFocused, hasSuffix, suffix]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/[^0-9-]/g, "");
    setLocalValue(newValue);
    
    if (newValue !== "" && newValue !== "-" && !isNaN(Number(newValue))) {
      const numValue = Number(newValue);
      const clamped = Math.min(Math.max(numValue, min), max);
      onChange(clamped);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    const numericValue = String(value);
    setLocalValue(numericValue);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const numericValue = localValue.replace(/[^0-9-]/g, "");
    if (numericValue === "" || numericValue === "-" || isNaN(Number(numericValue))) {
      setLocalValue(getDisplayValue(value, false));
    } else {
      const numValue = Number(numericValue);
      const clamped = Math.min(Math.max(numValue, min), max);
      setLocalValue(getDisplayValue(clamped, false));
      onChange(clamped);
    }
    onBlur?.();
  };

  if (hasSuffix) {
    return (
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`text-center w-[47px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] ${
          isFocused ? "border-[#459BF8]" : "border-[#3A3943]"
        } text-style-4 text-[#DBDEE8]`}
      />
    );
  }

  return (
    <div
      className={`relative h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] ${
        isFocused ? "border-[#459BF8]" : "border-[#3A3943]"
      }`}
      style={{ width }}
    >
      {prefix && (
        <span className="absolute left-[5px] top-[50%] transform -translate-y-1/2 text-[#97999E] text-style-1 pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`absolute ${prefix ? "left-[20px]" : "left-[5px]"} top-[-1px] h-[23px] ${
          prefix ? "w-[26px]" : "w-[calc(100%-10px)]"
        } bg-transparent text-style-4 text-[#DBDEE8] text-left`}
      />
    </div>
  );
};

// ============================================================================
// TextInput
// ============================================================================

export const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  onBlur,
  placeholder,
  width = "90px",
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value);
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    onChange(e.target.value);
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={`text-center h-[23px] p-[6px] bg-[#2A2A30] rounded-[7px] border-[1px] ${
        isFocused ? "border-[#459BF8]" : "border-[#3A3943]"
      } text-style-4 text-[#DBDEE8]`}
      style={{ width }}
    />
  );
};

// ============================================================================
// ColorInput
// ============================================================================

export const ColorInput: React.FC<ColorInputProps> = ({ value, onChange, onChangeComplete }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (typeof (window as any).__dmn_showColorPicker === "function") {
      (window as any).__dmn_showColorPicker({
        initialColor: value || "#FFFFFF",
        onColorChange: onChange,
        onColorChangeComplete: onChangeComplete,
        referenceElement: buttonRef.current,
        id: `props-panel-color-${Date.now()}`,
      });
    }
  };

  const getDisplayColor = (color: string): string => {
    if (!color) return "#ffffff";
    if (color.startsWith("rgba") || color.startsWith("rgb")) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0]).toString(16).padStart(2, "0");
        const g = parseInt(match[1]).toString(16).padStart(2, "0");
        const b = parseInt(match[2]).toString(16).padStart(2, "0");
        return `#${r}${g}${b}`;
      }
    }
    if (color.startsWith("#")) {
      return color.slice(0, 7);
    }
    return "#ffffff";
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      className="w-[23px] h-[23px] rounded-[7px] border-[1px] border-[#3A3943] overflow-hidden cursor-pointer hover:border-[#505058] transition-colors flex-shrink-0"
      style={{ backgroundColor: getDisplayColor(value) }}
    />
  );
};

// ============================================================================
// SelectInput
// ============================================================================

export const SelectInput: React.FC<SelectInputProps> = ({ value, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-[23px] min-w-[70px] bg-[#2A2A30] rounded-[7px] border-[1px] ${
          isOpen ? "border-[#459BF8]" : "border-[#3A3943]"
        } px-[8px] flex items-center justify-between gap-[4px] hover:border-[#505058] transition-colors`}
      >
        <span className="text-style-4 text-[#DBDEE8]">
          {options.find((opt) => opt.value === value)?.label || value}
        </span>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" className="flex-shrink-0">
          <path d="M1 1L4 4L7 1" stroke="#6B6D75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-[27px] left-0 right-0 bg-[#2A2A30] border border-[#3A3943] rounded-[7px] z-20 overflow-hidden shadow-lg min-w-[70px]">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-[8px] py-[6px] text-left text-style-4 hover:bg-[#32323A] transition-colors ${
                  value === opt.value ? "text-[#459BF8]" : "text-[#DBDEE8]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================================
// ToggleSwitch
// ============================================================================

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange }) => {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-[32px] h-[18px] rounded-full transition-colors relative flex-shrink-0 ${
        checked ? "bg-[#459BF8]" : "bg-[#3A3943]"
      }`}
    >
      <div
        className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
          checked ? "translate-x-[16px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
};

// ============================================================================
// SectionDivider
// ============================================================================

export const SectionDivider: React.FC = () => (
  <div className="w-full h-[1px] bg-[#3A3943] my-[15px]" />
);

// ============================================================================
// 글꼴 스타일 아이콘
// ============================================================================

const BoldIcon: React.FC = () => (
  <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
    <path d="M1 1H5.5C7.433 1 9 2.343 9 4C9 5.657 7.433 6 5.5 6H1V1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M1 6H6C8.209 6 9.5 7.343 9.5 9C9.5 10.657 8.209 11 6 11H1V6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>
);

const ItalicIcon: React.FC = () => (
  <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
    <line x1="3" y1="1" x2="7" y2="1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="1" y1="11" x2="5" y2="11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="5.5" y1="1" x2="2.5" y2="11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const UnderlineIcon: React.FC = () => (
  <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
    <path d="M2 1V6C2 8.209 3.791 10 6 10C8.209 10 10 8.209 10 6V1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="1" y1="13" x2="11" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const StrikethroughIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M3 3C3 1.895 4.343 1 6 1C7.657 1 9 1.895 9 3C9 4 8 4.5 6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M6 7C8 7.5 9 8 9 9C9 10.105 7.657 11 6 11C4.343 11 3 10.105 3 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

// ============================================================================
// FontStyleToggle
// ============================================================================

export const FontStyleToggle: React.FC<FontStyleToggleProps> = ({
  isBold,
  isItalic,
  isUnderline,
  isStrikethrough,
  onBoldChange,
  onItalicChange,
  onUnderlineChange,
  onStrikethroughChange,
}) => {
  const buttonClass = (active: boolean) =>
    `w-[26px] h-[23px] flex items-center justify-center rounded-[5px] transition-colors ${
      active
        ? "bg-[#459BF8] text-white"
        : "bg-[#2A2A30] text-[#6B6D75] hover:bg-[#32323A] hover:text-[#97999E]"
    }`;

  return (
    <div className="flex items-center gap-[2px] bg-[#1F1F24] rounded-[7px] p-[2px] border border-[#3A3943]">
      <button
        onClick={() => onBoldChange(!isBold)}
        className={buttonClass(isBold)}
        title="Bold"
      >
        <BoldIcon />
      </button>
      <button
        onClick={() => onItalicChange(!isItalic)}
        className={buttonClass(isItalic)}
        title="Italic"
      >
        <ItalicIcon />
      </button>
      <button
        onClick={() => onUnderlineChange(!isUnderline)}
        className={buttonClass(isUnderline)}
        title="Underline"
      >
        <UnderlineIcon />
      </button>
      <button
        onClick={() => onStrikethroughChange(!isStrikethrough)}
        className={buttonClass(isStrikethrough)}
        title="Strikethrough"
      >
        <StrikethroughIcon />
      </button>
    </div>
  );
};

// ============================================================================
// TabButton & Tabs
// ============================================================================

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex-1 h-[28px] text-style-2 rounded-[5px] transition-colors ${
      active
        ? "bg-[#2A2A30] text-[#DBDEE8]"
        : "text-[#6B6D75] hover:text-[#97999E]"
    }`}
  >
    {children}
  </button>
);

export const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange, t }) => (
  <div className="flex items-center gap-[2px] bg-[#1F1F24] rounded-[7px] p-[2px] border border-[#3A3943]">
    <TabButton
      active={activeTab === TABS.STYLE}
      onClick={() => onTabChange(TABS.STYLE)}
    >
      {t("propertiesPanel.tabStyle") || "스타일"}
    </TabButton>
    <TabButton
      active={activeTab === TABS.NOTE}
      onClick={() => onTabChange(TABS.NOTE)}
    >
      {t("propertiesPanel.tabNote") || "노트"}
    </TabButton>
    <TabButton
      active={activeTab === TABS.COUNTER}
      onClick={() => onTabChange(TABS.COUNTER)}
    >
      {t("propertiesPanel.tabCounter") || "카운터"}
    </TabButton>
  </div>
);

// ============================================================================
// 아이콘 컴포넌트
// ============================================================================

export const CloseIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M1 1L9 9M9 1L1 9" stroke="#6B6D75" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const SidebarToggleIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
  <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
    <rect
      x="0.75"
      y="0.75"
      width="14.5"
      height="12.5"
      rx="2"
      stroke="#6B6D75"
      strokeWidth="1.5"
      fill="none"
    />
    <line
      x1={isOpen ? "10" : "12"}
      y1="1"
      x2={isOpen ? "10" : "12"}
      y2="13"
      stroke="#6B6D75"
      strokeWidth="1.5"
    />
    {isOpen && (
      <>
        <line x1="12" y1="4" x2="13.5" y2="4" stroke="#6B6D75" strokeWidth="1" strokeLinecap="round" />
        <line x1="12" y1="7" x2="13.5" y2="7" stroke="#6B6D75" strokeWidth="1" strokeLinecap="round" />
        <line x1="12" y1="10" x2="13.5" y2="10" stroke="#6B6D75" strokeWidth="1" strokeLinecap="round" />
      </>
    )}
  </svg>
);
