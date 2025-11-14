// @id kps-counter

/**
 * KPS (Keys Per Second) 카운터 플러그인
 *
 * 주요 기능:
 * 1. 그리드 컨텍스트 메뉴에서 KPS 패널 추가/제거
 * 2. Display Element로 드래그 가능한 패널 구현
 * 3. 패널 클릭 시 TOTAL/AVG/MAX 표시 설정 모달
 * 4. 오버레이에서 계산된 KPS 데이터를 브릿지로 수신
 * 5. 패널 위치 및 설정값 영속성 보장
 */
(function () {
  // 메인 윈도우 전용
  if (window.api.window.type !== "main") {
    return;
  }

  // ===== 상태 관리 =====
  let panelElementId = null; // Display Element ID
  let currentKpsData = { total: 0, avg: 0, max: 0 }; // 오버레이로부터 수신한 KPS 데이터

  // 기본 설정
  const DEFAULT_SETTINGS = {
    position: { x: 100, y: 100 },
    visibility: {
      total: true,
      avg: true,
      max: true,
    },
  };

  let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

  // ===== 스토리지 초기화 =====
  async function loadSettings() {
    const saved = await window.api.plugin.storage.get("settings");

    if (saved) {
      // 중첩된 객체도 제대로 병합
      settings = {
        ...DEFAULT_SETTINGS,
        ...saved,
        visibility: {
          ...DEFAULT_SETTINGS.visibility,
          ...(saved.visibility || {}),
        },
      };
    }

    return settings;
  }

  async function saveSettings() {
    await window.api.plugin.storage.set("settings", settings);
  }

  async function loadPanelState() {
    const deployed = await window.api.plugin.storage.get("deployed");
    return deployed === true;
  }

  async function savePanelState(deployed) {
    if (deployed) {
      await window.api.plugin.storage.set("deployed", true);
    } else {
      await window.api.plugin.storage.remove("deployed");
    }
  }

  // ===== KPS 패널 HTML 생성 =====
  function generatePanelHtml() {
    const { total, avg, max } = currentKpsData;
    const { visibility } = settings;

    let rows = "";
    if (visibility.total) {
      rows += `
        <div class="dmn-kps-key">TOTAL</div>
        <div class="dmn-kps-val">${total}</div>
      `;
    }
    if (visibility.avg) {
      rows += `
        <div class="dmn-kps-key">AVG</div>
        <div class="dmn-kps-val">${avg}</div>
      `;
    }
    if (visibility.max) {
      rows += `
        <div class="dmn-kps-key">MAX</div>
        <div class="dmn-kps-val">${max}</div>
      `;
    }

    if (!rows) {
      rows = `
        <div class="dmn-kps-key dmn-kps-muted">No data</div>
        <div class="dmn-kps-val dmn-kps-muted">-</div>
      `;
    }

    return `
      <style>
        .dmn-kps-panel {
          background: rgba(17, 17, 20, 0.88);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          padding: 8px;
          min-width: 100px;
          max-width: 260px;
          backdrop-filter: blur(3px);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          box-shadow: 0 8px 24px rgba(0,0,0,0.35);
          cursor: pointer;
          user-select: none;
        }
        .dmn-kps-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
          font-size: 14px;
          font-weight: 600;
        }
        .dmn-kps-body {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 4px 8px;
          font-size: 12px;
          line-height: 1.3;
        }
        .dmn-kps-key {
          color: #CBD5E1;
          white-space: nowrap;
        }
        .dmn-kps-val {
          color: #86EFAC;
          text-align: right;
          font-weight: 700;
        }
        .dmn-kps-muted {
          color: #6B7280;
        }
      </style>
      <div class="dmn-kps-panel">
        <div class="dmn-kps-header">
          <div>Keys per Second</div>
        </div>
        <div class="dmn-kps-body">
          ${rows}
        </div>
      </div>
    `;
  }

  // ===== KPS 패널 생성 =====
  function createPanel() {
    if (panelElementId) return; // 이미 존재하면 무시

    panelElementId = window.api.ui.displayElement.add({
      html: generatePanelHtml(),
      position: settings.position,
      draggable: true,
      zIndex: 100,
      scoped: true,
      onClick: "handleKpsPanelClick",
      onPositionChange: "handleKpsPositionChange",
      onDelete: "handleKpsDelete",
      estimatedSize: { width: 150, height: 100 },
      contextMenu: {
        enableDelete: true,
        deleteLabel: "🗑️ KPS 패널 제거",
      },
    });

    savePanelState(true);
  }

  // ===== KPS 패널 제거 =====
  function removePanel() {
    if (!panelElementId) return;

    window.api.ui.displayElement.remove(panelElementId);
    panelElementId = null;
    savePanelState(false);
  }

  // ===== KPS 패널 업데이트 =====
  function updatePanel() {
    if (!panelElementId) return;

    window.api.ui.displayElement.update(panelElementId, {
      html: generatePanelHtml(),
    });
  }

  // ===== 위치 변경 핸들러 =====
  async function handleKpsPositionChange(position) {
    settings.position = position;
    await saveSettings();
  }

  // ===== 삭제 핸들러 =====
  async function handleKpsDelete() {
    panelElementId = null;
    await savePanelState(false);
  }

  // ===== 설정 모달 열기 =====
  async function handleKpsPanelClick() {
    const { visibility } = settings;

    // 임시 설정값 (모달에서 변경사항 추적)
    const tempSettings = { ...visibility };

    // 체크박스 change 핸들러
    function checkboxHandler(e) {
      // input id는 "{id}-input" 형식이므로 "-input" 제거
      const id = e.target.id.replace("-input", "");
      const checked = e.target.checked;

      if (id === "kps-total-checkbox") tempSettings.total = checked;
      else if (id === "kps-avg-checkbox") tempSettings.avg = checked;
      else if (id === "kps-max-checkbox") tempSettings.max = checked;
    }

    // Components로 체크박스 생성
    const totalCheckbox = window.api.ui.components.checkbox({
      checked: visibility.total,
      id: "kps-total-checkbox",
    });

    const avgCheckbox = window.api.ui.components.checkbox({
      checked: visibility.avg,
      id: "kps-avg-checkbox",
    });

    const maxCheckbox = window.api.ui.components.checkbox({
      checked: visibility.max,
      id: "kps-max-checkbox",
    });

    // 전역에 핸들러 등록 (Display Element 콜백용)
    window.__kpsCheckboxHandler = checkboxHandler;

    // change 이벤트 핸들러 추가
    const addChangeHandler = (html, id) => {
      return html.replace(
        `id="${id}"`,
        `id="${id}" data-plugin-handler-change="__kpsCheckboxHandler"`
      );
    };

    const formHtml = `
      <div class="flex flex-col gap-[12px]">
        ${window.api.ui.components.formRow(
          "TOTAL 표시",
          addChangeHandler(totalCheckbox, "kps-total-checkbox")
        )}
        ${window.api.ui.components.formRow(
          "AVG 표시",
          addChangeHandler(avgCheckbox, "kps-avg-checkbox")
        )}
        ${window.api.ui.components.formRow(
          "MAX 표시",
          addChangeHandler(maxCheckbox, "kps-max-checkbox")
        )}
      </div>
    `;

    const confirmed = await window.api.ui.dialog.custom(formHtml, {
      title: "KPS 패널 설정",
      confirmText: "저장",
      showCancel: true,
    });

    // 핸들러 정리
    delete window.__kpsCheckboxHandler;

    if (confirmed) {
      // 임시 설정값을 실제 설정에 적용
      settings.visibility = { ...tempSettings };
      await saveSettings();
      updatePanel();
    }
  }

  // 전역에 핸들러 등록 (Display Element 콜백용)
  window.handleKpsPanelClick = handleKpsPanelClick;
  window.handleKpsPositionChange = handleKpsPositionChange;
  window.handleKpsDelete = handleKpsDelete;

  // ===== 그리드 컨텍스트 메뉴에 KPS 패널 추가 메뉴 등록 =====
  const menuId = window.api.ui.contextMenu.addGridMenuItem({
    id: "add-kps-panel",
    label: "📊 KPS 패널 추가",
    onClick: async (context) => {
      settings.position = { x: context.position.dx, y: context.position.dy };
      await saveSettings();
      createPanel();
    },
  });

  // ===== 브릿지로 오버레이로부터 KPS 데이터 수신 =====
  const unsubBridge = window.api.bridge.on("KPS_UPDATE", (data) => {
    currentKpsData = {
      total: data.total || 0,
      avg: data.avg || 0,
      max: data.max || 0,
    };
    updatePanel();
  });

  // ===== 초기화 =====
  async function init() {
    await loadSettings();
    const deployed = await loadPanelState();

    if (deployed) {
      createPanel();
    }
  }

  init();

  // ===== 클린업 등록 =====
  window.api.plugin.registerCleanup(() => {
    unsubBridge();
    window.api.ui.contextMenu.removeMenuItem(menuId);
    window.api.ui.displayElement.clearMyElements();
    delete window.handleKpsPanelClick;
    delete window.handleKpsPositionChange;
    delete window.handleKpsDelete;
    delete window.__kpsCheckboxHandler;
  });
})();

// ===== 오버레이: KPS 계산 및 메인으로 전송 =====
(function () {
  // 오버레이 윈도우 전용
  if (window.api.window.type !== "overlay") {
    return;
  }

  // 설정값
  const WINDOW_MS = 1000; // 집계 윈도우
  const REFRESH_MS = 100; // 계산 주기

  // 내부 상태
  let currentMode = null;
  let keyMap = {};
  let trackedKeys = new Set();
  const buckets = new Map(); // key => number[] (타임스탬프 배열)

  // 통계값
  let maxKps = 0;
  let kpsHistory = [];
  let lastKps = 0;

  // 유틸리티
  function pruneOld(now) {
    const cutoff = now - WINDOW_MS;
    for (const [k, arr] of buckets.entries()) {
      let w = 0;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] >= cutoff) arr[w++] = arr[i];
      }
      arr.length = w;
    }
  }

  function setTrackedKeys(mode) {
    trackedKeys.clear();
    const list = keyMap[mode] || [];
    for (const k of list) trackedKeys.add(k);
    for (const k of Array.from(buckets.keys())) {
      if (!trackedKeys.has(k)) buckets.delete(k);
    }
    // 모드 변경 시 초기화
    maxKps = 0;
    kpsHistory = [];
    lastKps = 0;
  }

  // KPS 계산 및 브로드캐스트
  function calculate() {
    const now = Date.now();
    pruneOld(now);

    let total = 0;
    for (const k of trackedKeys) {
      total += (buckets.get(k) || []).length;
    }

    // 통계 업데이트
    if (total !== lastKps && total > 0) {
      kpsHistory.push(total);
      maxKps = Math.max(maxKps, total);
      lastKps = total;
    }

    const avg =
      kpsHistory.length > 0
        ? Math.round(kpsHistory.reduce((a, b) => a + b, 0) / kpsHistory.length)
        : 0;

    // 메인 윈도우로 브릿지 전송 (Display Element 업데이트용)
    window.api.bridge.sendTo("main", "KPS_UPDATE", {
      total,
      avg,
      max: maxKps,
    });
  }

  const timer = setInterval(calculate, REFRESH_MS);

  // 키 이벤트 구독
  const unsubKey = window.api.keys.onKeyState(({ key, state }) => {
    if (!trackedKeys.has(key) || state !== "DOWN") return;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(Date.now());
  });

  const unsubMode = window.api.keys.onModeChanged(({ mode }) => {
    currentMode = mode;
    setTrackedKeys(currentMode);
  });

  const unsubKeys = window.api.keys.onChanged((nextMap) => {
    keyMap = nextMap || {};
    setTrackedKeys(currentMode);
  });

  // 초기화
  (async () => {
    try {
      const boot = await window.api.app.bootstrap();
      keyMap = boot.keys || {};
      currentMode = boot.selectedKeyType || Object.keys(keyMap)[0] || "4key";
      setTrackedKeys(currentMode);
    } catch (error) {
      console.error("[KPS] 초기화 실패:", error);
    }
  })();

  // 클린업
  window.api.plugin.registerCleanup(() => {
    clearInterval(timer);
    unsubKey();
    unsubMode();
    unsubKeys();
  });
})();
