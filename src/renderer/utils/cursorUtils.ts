/**
 * macOS 네이티브 커서 스타일을 동적으로 생성하는 유틸리티
 * Tauri IPC를 통해 시스템 커서 설정(크기, 색상)을 가져와 적용합니다.
 */

import { invoke } from "@tauri-apps/api/core";
import { isMac } from "./platform";

/** 커서 설정 응답 타입 */
export interface CursorSettings {
  /** 커서 크기 배율 (1.0 ~ 4.0) */
  size: number;
  /** 기본 픽셀 크기 (24px - macOS 기본 커서 크기) */
  base_size: number;
  /** 채우기 색상 (HEX) */
  fill_color: string;
  /** 테두리 색상 (HEX) */
  outline_color: string;
  /** macOS 플랫폼 여부 */
  is_macos: boolean;
}

/** 커서 타입 */
export type CursorType =
  | "ns-resize"
  | "ew-resize"
  | "nwse-resize"
  | "nesw-resize";

/** 캐시된 커서 설정 */
let cachedSettings: CursorSettings | null = null;
/** 캐시된 커서 URL 맵 */
let cachedCursors: Map<CursorType, string> | null = null;
/** 초기화 Promise */
let initPromise: Promise<void> | null = null;

/**
 * 시스템 커서 설정을 Tauri에서 가져옵니다.
 */
export async function fetchCursorSettings(): Promise<CursorSettings> {
  try {
    const settings = await invoke<CursorSettings>("get_cursor_settings");
    return settings;
  } catch (error) {
    console.warn(
      "[Cursor] Failed to fetch cursor settings, using defaults:",
      error
    );
    return {
      size: 1.0,
      base_size: 24,
      fill_color: "#000000",
      outline_color: "#FFFFFF",
      is_macos: isMac(),
    };
  }
}

/**
 * apple_cursor 원본 SVG 커서를 생성합니다.
 * https://github.com/ful1e5/apple_cursor
 */
function createCursorSvg(type: CursorType, settings: CursorSettings): string {
  const { fill_color, outline_color, size, base_size } = settings;

  // 실제 커서 크기 (기본 24px * 크기 배율)
  const cursorSize = Math.round(base_size * size);
  const hotspot = Math.round(cursorSize / 2);

  // 그림자 설정
  const shadowBlur = Math.max(1, 2 * size).toFixed(1);
  const shadowOpacity = 0.25;

  let outlinePath: string;
  let fillPath: string;

  // apple_cursor 원본 디자인 (257x257 viewBox)
  // outline = #0000FF → outline_color
  // fill = #00FF00 → fill_color
  switch (type) {
    case "ew-resize":
      // left_side.svg - 좌우 양방향 화살표
      outlinePath = `M82.3713 105.66L82.0812 59.2437L13.1138 128.426L82.9513 198.475L82.6435 151.846L149.457 152.218L172.669 152.375L172.952 199.029L242.133 129.848L172.074 59.7891L172.348 106.205L82.3713 105.66Z`;
      fillPath = `M70.88 117.54L70.8749 87.536L29.52 129.154L70.8889 170.752L70.892 140.527L184.137 140.505L184.133 170.763L225.759 129.137L184.136 87.5139L184.124 117.534L70.88 117.54Z`;
      break;
    case "ns-resize":
      // top_side.svg - 상하 양방향 화살표
      outlinePath = `M104.667 174.388L58.251 174.679L127.433 243.646L197.483 173.808L150.853 174.116L151.225 107.303L151.382 84.0906L198.036 83.8073L128.856 14.6265L58.7964 84.6856L105.212 84.4119L104.667 174.388Z`;
      fillPath = `M116.547 185.88L86.5436 185.885L128.161 227.24L169.76 185.871L139.534 185.868L139.512 72.6232L169.77 72.6264L128.145 31.0006L86.5215 72.6239L116.542 72.6353L116.547 185.88Z`;
      break;
    case "nwse-resize":
      // bottom_right_corner.svg - 북서-남동 대각선
      outlinePath = `M112.146 80.5377L144.762 47.5115L47.0757 47.6633L46.9258 146.578L79.6801 113.389L126.661 160.896L142.964 177.421L110.175 210.61L208.011 210.61V111.532L175.384 144.546L112.146 80.5377Z`;
      fillPath = `M95.6259 80.8019L116.838 59.5825L58.1678 59.7682L58.0054 118.435L79.3802 97.0647L159.472 177.125L138.074 198.519L196.941 198.519V139.654L175.706 160.874L95.6259 80.8019Z`;
      break;
    case "nesw-resize":
      // bottom_left_corner.svg - 북동-남서 대각선
      outlinePath = `M143.59 80.5377L110.974 47.5115L208.661 47.6633L208.81 146.578L176.056 113.389L129.075 160.896L112.773 177.421L145.561 210.61L47.7251 210.61V111.532L80.3526 144.546L143.59 80.5377Z`;
      fillPath = `M160.109 80.8019L138.897 59.5825L197.568 59.7682L197.73 118.435L176.355 97.0647L96.2637 177.125L117.662 198.519L58.7939 198.519L58.794 139.654L80.0295 160.874L160.109 80.8019Z`;
      break;
  }

  // SVG 생성 - 257x257 viewBox (apple_cursor 원본)
  const svg = `<svg width="${cursorSize}" height="${cursorSize}" viewBox="0 0 257 257" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><filter id="s" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="${shadowBlur}" flood-color="#000" flood-opacity="${shadowOpacity}"/></filter></defs><g filter="url(#s)"><path fill-rule="evenodd" clip-rule="evenodd" d="${outlinePath}" fill="${outline_color}"/><path fill-rule="evenodd" clip-rule="evenodd" d="${fillPath}" fill="${fill_color}"/></g></svg>`;

  const encoded = encodeURIComponent(svg);
  return `url("data:image/svg+xml,${encoded}") ${hotspot} ${hotspot}, ${type}`;
}

/**
 * 커서 시스템을 초기화합니다.
 * 앱 시작 시 한 번 호출하여 설정을 캐싱합니다.
 */
export async function initializeCursorSystem(): Promise<void> {
  if (!isMac()) {
    cachedSettings = null;
    cachedCursors = null;
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    cachedSettings = await fetchCursorSettings();
    cachedCursors = new Map();

    const cursorTypes: CursorType[] = [
      "ns-resize",
      "ew-resize",
      "nwse-resize",
      "nesw-resize",
    ];
    for (const type of cursorTypes) {
      const cursorUrl = createCursorSvg(type, cachedSettings);
      cachedCursors.set(type, cursorUrl);
    }

    console.log("[Cursor] System initialized with settings:", {
      size: cachedSettings.size,
      fillColor: cachedSettings.fill_color,
      outlineColor: cachedSettings.outline_color,
    });
  })();

  return initPromise;
}

/**
 * 커서 설정을 다시 가져와 캐시를 갱신합니다.
 * 시스템 설정 변경 시 호출합니다.
 */
export async function refreshCursorSettings(): Promise<void> {
  initPromise = null;
  await initializeCursorSystem();
}

/**
 * 플랫폼에 맞는 커서 스타일을 반환합니다.
 * - macOS: 시스템 설정을 반영한 커스텀 SVG 커서
 * - Windows/Linux: 기본 CSS 커서
 */
export function getCursor(cursorType: CursorType): string {
  if (!isMac()) {
    return cursorType;
  }

  // 초기화 전이면 기본 fallback 반환
  if (!cachedCursors) {
    return cursorType;
  }

  return cachedCursors.get(cursorType) || cursorType;
}

/**
 * 현재 캐시된 커서 설정을 반환합니다.
 */
export function getCachedSettings(): CursorSettings | null {
  return cachedSettings;
}

/**
 * 커서 시스템 초기화 여부를 반환합니다.
 */
export function isCursorSystemInitialized(): boolean {
  return cachedCursors !== null;
}
