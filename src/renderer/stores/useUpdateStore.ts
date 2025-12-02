import { create } from "zustand";

const GITHUB_REPO = "lee-sihun/DmNote";
const STORAGE_KEY = "dmnote:skipped-version";
const COOLDOWN_KEY = "dmnote:update-check-cooldown";
const COOLDOWN_MS = 5 * 60 * 1000; // 5분
const CURRENT_VERSION = __APP_VERSION__;

// TODO: UI 테스트용 - 쿨다운 비활성화 (나중에 false로 변경)
const DISABLE_COOLDOWN = false;

// TODO: UI 테스트용 - 모달 강제 표시 (나중에 "none"으로 변경)
// "none" = 정상 동작, "update" = 업데이트 있음 모달, "latest" = 최신 버전 모달
type ForceShowModalType = "none" | "update" | "latest";
const FORCE_SHOW_MODAL = "none" as ForceShowModalType;

interface GithubRelease {
  tag_name: string;
  html_url: string;
  name: string;
  body: string;
  published_at: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
}

interface UpdateState {
  updateAvailable: boolean;
  isLatestVersion: boolean;
  updateInfo: UpdateInfo | null;
  isChecking: boolean;
  error: string | null;
  dismissed: boolean;
  cooldownUntil: number | null;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  dismissUpdate: () => void;
  skipVersion: () => void;
  isOnCooldown: () => boolean;
}

function compareVersions(current: string, latest: string): number {
  const normalize = (v: string) => v.replace(/^v/, "");
  const currentParts = normalize(current).split(".").map(Number);
  const latestParts = normalize(latest).split(".").map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const a = currentParts[i] || 0;
    const b = latestParts[i] || 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
}

function getSkippedVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setSkippedVersion(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch (e) {
    console.warn("Failed to save skipped version", e);
  }
}

function clearSkippedVersion(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear skipped version", e);
  }
}

function getCooldownUntil(): number | null {
  try {
    const stored = localStorage.getItem(COOLDOWN_KEY);
    if (stored) {
      const time = parseInt(stored, 10);
      if (time > Date.now()) {
        return time;
      }
      localStorage.removeItem(COOLDOWN_KEY);
    }
  } catch {
    // ignore
  }
  return null;
}

function setCooldownUntil(time: number): void {
  try {
    localStorage.setItem(COOLDOWN_KEY, String(time));
  } catch {
    // ignore
  }
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  updateAvailable: false,
  isLatestVersion: false,
  updateInfo: null,
  isChecking: false,
  error: null,
  dismissed: false,
  cooldownUntil: getCooldownUntil(),

  isOnCooldown: () => {
    if (DISABLE_COOLDOWN) return false;
    const { cooldownUntil } = get();
    return cooldownUntil !== null && cooldownUntil > Date.now();
  },

  checkForUpdates: async (manual = false) => {
    const state = get();

    // 이미 체크 중이면 무시
    if (state.isChecking) return;

    set({
      isChecking: true,
      error: null,
      dismissed: false,
      isLatestVersion: false,
    });

    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release: GithubRelease = await response.json();
      const latestVersion = release.tag_name;
      const skippedVersion = getSkippedVersion();

      // 쿨다운 설정 (성공적으로 체크 완료 시)
      const cooldownTime = Date.now() + COOLDOWN_MS;
      setCooldownUntil(cooldownTime);
      set({ cooldownUntil: cooldownTime });

      // 건너뛴 버전이면 무시 (자동 체크일 때만)
      if (!manual && skippedVersion === latestVersion) {
        set({ updateAvailable: false, updateInfo: null, isChecking: false });
        return;
      }

      // 버전 비교
      const hasUpdate = compareVersions(CURRENT_VERSION, latestVersion) < 0;

      // 테스트용 강제 모달 표시
      const forceUpdate = FORCE_SHOW_MODAL === "update";
      const forceLatest = FORCE_SHOW_MODAL === "latest";
      const showAsUpdate = forceUpdate || (!forceLatest && hasUpdate);
      const showAsLatest = forceLatest || (!forceUpdate && !hasUpdate);

      if (showAsUpdate) {
        set({
          updateInfo: {
            currentVersion: CURRENT_VERSION,
            latestVersion,
            releaseUrl: release.html_url,
            releaseName: release.name || latestVersion,
            releaseNotes: release.body || "",
            publishedAt: release.published_at,
          },
          updateAvailable: true,
          isLatestVersion: false,
          isChecking: false,
        });
      } else if (showAsLatest) {
        // 최신 버전 모달은 수동 체크일 때만 표시
        set({
          updateAvailable: false,
          isLatestVersion: manual, // 수동 체크일 때만 true
          updateInfo: {
            currentVersion: CURRENT_VERSION,
            latestVersion,
            releaseUrl: release.html_url,
            releaseName: release.name || latestVersion,
            releaseNotes: release.body || "",
            publishedAt: release.published_at,
          },
          isChecking: false,
        });
        // 현재 버전이 최신이거나 더 높으면 건너뛰기 정보 초기화
        clearSkippedVersion();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      set({ error: message, isChecking: false });
      console.error("Update check failed:", e);
    }
  },

  dismissUpdate: () => {
    set({ dismissed: true, updateAvailable: false, isLatestVersion: false });
  },

  skipVersion: () => {
    const { updateInfo } = get();
    if (updateInfo) {
      setSkippedVersion(updateInfo.latestVersion);
    }
    set({ dismissed: true, updateAvailable: false, isLatestVersion: false });
  },
}));

// 훅 래퍼 (기존 코드 호환성)
export function useUpdateCheck() {
  const store = useUpdateStore();

  return {
    updateAvailable: store.updateAvailable && !store.dismissed,
    isLatestVersion: store.isLatestVersion && !store.dismissed,
    updateInfo: store.updateInfo,
    isChecking: store.isChecking,
    error: store.error,
    dismissUpdate: store.dismissUpdate,
    skipVersion: store.skipVersion,
    checkForUpdates: store.checkForUpdates,
    isOnCooldown: store.isOnCooldown,
    cooldownUntil: store.cooldownUntil,
  };
}
