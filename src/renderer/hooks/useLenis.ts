import { useEffect, useRef, useState, useCallback } from "react";
import Lenis from "lenis";
import { LENIS_CONFIG } from "@config/lenis";

interface UseLenisOptions {
  /**
   * 스크롤 애니메이션 지속 시간 (초)
   * @default LENIS_CONFIG.duration
   */
  duration?: number;
  /**
   * 이징 함수
   * @default easeOutExpo
   */
  easing?: (t: number) => number;
  /**
   * 휠 이벤트 multiplier
   * @default LENIS_CONFIG.wheelMultiplier
   */
  wheelMultiplier?: number;
  /**
   * 터치 이벤트 multiplier
   * @default LENIS_CONFIG.touchMultiplier
   */
  touchMultiplier?: number;
  /**
   * 스크롤 이벤트 콜백
   * Lenis 스크롤 발생 시 호출됨
   */
  onScroll?: () => void;
}

// easeOutExpo 이징 함수
const easeOutExpo = (t: number): number => {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

/**
 * Lenis smooth scroll을 특정 컨테이너에 적용하는 훅
 * @param options Lenis 옵션 (미지정 시 전역 설정 사용)
 * @returns scrollContainerRef - 스크롤 컨테이너에 연결할 ref (callback ref)
 */
export function useLenis(options: UseLenisOptions = {}) {
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const onScrollRef = useRef<(() => void) | undefined>(options.onScroll);

  // onScroll 콜백 업데이트 (매 렌더마다)
  onScrollRef.current = options.onScroll;

  const {
    duration = LENIS_CONFIG.duration,
    easing = easeOutExpo,
    wheelMultiplier = LENIS_CONFIG.wheelMultiplier,
  } = options;

  // callback ref - DOM 요소가 마운트/언마운트될 때 호출됨
  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    setWrapper(node);
  }, []);

  useEffect(() => {
    if (!wrapper) return;

    // 기존 Lenis 인스턴스 정리
    if (lenisRef.current) {
      lenisRef.current.destroy();
      lenisRef.current = null;
    }

    // Lenis 인스턴스 생성
    const lenis = new Lenis({
      wrapper,
      content: wrapper,
      duration,
      easing,
      wheelMultiplier,
    });

    lenisRef.current = lenis;

    // Lenis scroll 이벤트 리스너 등록
    const handleLenisScroll = () => {
      onScrollRef.current?.();
    };
    lenis.on("scroll", handleLenisScroll);

    // RAF 루프 시작
    let rafId: number;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    // 클린업
    return () => {
      cancelAnimationFrame(rafId);
      lenis.off("scroll", handleLenisScroll);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [wrapper, duration, easing, wheelMultiplier]);

  return {
    scrollContainerRef,
    /** 스크롤 컨테이너 DOM 요소 (상태로 관리됨) */
    wrapperElement: wrapper,
    lenisInstance: lenisRef,
  };
}


