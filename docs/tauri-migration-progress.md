# Tauri 마이그레이션 평행 진행 로그

## 작업 개요

- 목적: Electron 백엔드를 Tauri 기반으로 완전히 이관하면서 원래 동작을 1:1로 복원
- 세부 이슈: 윈도우 구성, 오버레이 렌더링, 글로벌 키 후킹, 설정/프리셋/외부 링크 동작 이상 등 7건 확인됨

## 진행 체크리스트

- [x] 메인 창 윈도우 속성 원복 (보더리스, 크기 고정, 기본 크기)
- [x] 오버레이 창 재생성 및 표시 로직 복원
- [x] 넘버패드 키 후킹 예외 처리 복원
- [x] Electron `electron-store` JSON과의 설정 호환성 확보
- [x] 초기 부트스트랩/키맵 로딩 검증 및 그리드 노출 확인
- [x] 프리셋 저장/불러오기 동작 복구
- [x] 외부 링크 열기 기능 복구
- [ ] 추가 회귀 점검 및 자동화 검증

## 작업 로그

- 2025-10-03 10:05 — 기존 Electron 커밋(`75f3e1c^`)에서 메인/오버레이 윈도우, 키보드 서비스, 스토어 스키마 구현 확인. 현재 Tauri 구현과의 차이점 목록화.
- 2025-10-03 10:32 — `tauri.conf.json`과 `main.rs`에서 메인 창 크기·보더 상태·최대화/리사이즈 동작을 Electron 기본값과 동일하게 조정하고, 프런트엔드 `TitleBar`에 Tauri 드래그 영역 속성을 부여함.
- 2025-10-03 14:20 ✅ Main/Overlay window behavior restored: enforced borderless sizing, overlay visibility, and updated window close flow.
- 2025-10-03 14:25 ✅ Legacy electron-store data migrated to Tauri store.json with key grid defaults and numpad aliases; preset/export commands and external links verified.

