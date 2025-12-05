import { useEffect } from "react";

/**
 * 브라우저 기본 단축키를 차단하는 훅
 * Tauri 웹뷰에서 Ctrl+P (인쇄), Ctrl+S (저장), Ctrl+F (찾기) 등의
 * 브라우저 기본 동작을 방지합니다.
 */
export function useBlockBrowserShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // 차단할 단축키 목록
      const blockedShortcuts: Array<{
        key: string;
        ctrl?: boolean;
        shift?: boolean;
        alt?: boolean;
      }> = [
        // 인쇄
        { key: "p", ctrl: true },
        // 저장
        { key: "s", ctrl: true },
        // 찾기
        { key: "f", ctrl: true },
        // 모두 찾기
        { key: "g", ctrl: true },
        { key: "g", ctrl: true, shift: true },
        // 새로고침
        { key: "r", ctrl: true },
        // 강력 새로고침
        { key: "r", ctrl: true, shift: true },
        // 페이지 소스 보기
        { key: "u", ctrl: true },
        // 다운로드
        { key: "j", ctrl: true },
        // 히스토리
        { key: "h", ctrl: true },
        // 북마크
        { key: "d", ctrl: true },
        // 새 창
        { key: "n", ctrl: true },
        // 새 탭
        { key: "t", ctrl: true },
        // 탭 닫기
        { key: "w", ctrl: true },
        // 닫은 탭 복원
        { key: "t", ctrl: true, shift: true },
        // 확대/축소
        // { key: "+", ctrl: true },
        // { key: "-", ctrl: true },
        // { key: "=", ctrl: true },
        // { key: "0", ctrl: true },
        // F 키들
        { key: "F1" }, // 도움말
        { key: "F3" }, // 찾기
        { key: "F5" }, // 새로고침
        { key: "F6" }, // 주소창 포커스
        { key: "F7" }, // 캐럿 브라우징
        // 전체 선택 (필요한 경우 input 요소에서는 허용)
        // { key: "a", ctrl: true },
      ];

      // 현재 눌린 단축키가 차단 목록에 있는지 확인
      const shouldBlock = blockedShortcuts.some((shortcut) => {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? isCtrlOrCmd : !isCtrlOrCmd;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        // F 키는 modifier 키 없이도 차단
        if (shortcut.key.startsWith("F") && shortcut.key.length <= 3) {
          return e.key === shortcut.key;
        }

        return keyMatch && ctrlMatch && shiftMatch && altMatch;
      });

      if (shouldBlock) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 캡처 단계에서 이벤트를 가로채서 가장 먼저 처리
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);
}
