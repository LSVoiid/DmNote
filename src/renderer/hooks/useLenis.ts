import { useEffect, useRef } from "react";
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
}

// easeOutExpo 이징 함수
const easeOutExpo = (t: number): number => {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

/**
 * Lenis smooth scroll을 특정 컨테이너에 적용하는 훅
 * @param options Lenis 옵션 (미지정 시 전역 설정 사용)
 * @returns scrollContainerRef - 스크롤 컨테이너에 연결할 ref
 */
export function useLenis(options: UseLenisOptions = {}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const {
    duration = LENIS_CONFIG.duration,
    easing = easeOutExpo,
    wheelMultiplier = LENIS_CONFIG.wheelMultiplier,
  } = options;

  useEffect(() => {
    const wrapper = scrollContainerRef.current;
    if (!wrapper) return;

    // Lenis 인스턴스 생성
    const lenis = new Lenis({
      wrapper,
      content: wrapper,
      duration,
      easing,
      wheelMultiplier,
    });

    lenisRef.current = lenis;

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
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [duration, easing, wheelMultiplier]);

  return {
    scrollContainerRef,
    lenisInstance: lenisRef,
  };
}

