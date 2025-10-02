# Tauri Migration Log

## 2025-10-02 20:08 — 초기 분석
- Electron 메인 프로세스가 `electron-store` 기반 상태와 IPC 도메인을 통해 창과 키 입력을 제어함.
- `OverlayWindow` 는 항상 위, 투명, 마우스 이벤트 무시, 위치 복원을 처리하며 메인 창과 상태를 공유함.
- `node-global-key-listener-extended` 로 글로벌 키 후킹, 특정 키맵 모드 필터 후 `keys:state` 이벤트 송신.
- 렌더러는 `preload.ts` 에 노출된 `window.api` 로 모든 기능 호출 및 이벤트 구독을 수행함.
- 마이그레이션 시 Tauri 다중 창, 영구 저장소, willhook 기반 후킹, 커맨드/이벤트 설계를 통해 동일한 기능을 복원해야 함.

## 2025-10-02 20:11 — Tauri 스캐폴딩
- `src-tauri` 디렉터리와 초기 `Cargo.toml`, `build.rs`, `main.rs` 를 추가해 Rust 백엔드 골격을 마련함.
- `tauri.conf.json` 으로 Vite 출력(`dist/renderer`)과 개발 서버(`http://localhost:3000/main/index.html`)를 연결하는 기본 창 구성을 정의함.
- fern 로깅 초기화를 포함해 Tauri 엔트리포인트를 준비하여 후속 모듈이 로그를 공유할 수 있도록 함.

## 2025-10-02 21:00 — 상태/도메인 마이그레이션
- Rust `AppStore` 와 데이터 모델을 도입하고 JSON 기반 기본값/복구 로직을 이식해 영구 저장소를 대체함.
- Settings·Keys·CSS·Preset·System 커맨드를 Tauri 2 `#[command]` 구조로 변환하고 이벤트 전파를 `AppHandle::emit` 기반으로 재구성함.
- `open`, `rfd` 등을 활용한 플랫폼 기능 대체와 함께 `cargo check` 를 통과하는 Tauri 백엔드 스켈레톤을 확보함.

### 다음 단계
- willhook 기반 키보드 후킹과 오버레이(WebviewWindow) 제어 로직을 구현하고 상태 연동을 마무리.
- 프론트엔드 API 층을 Tauri invoke 기반으로 교체하고 타입/스토어 동기화를 정리.
- 빌드/실행 스크립트를 Tauri 기준으로 정리하고 남은 Electron 의존성 제거.