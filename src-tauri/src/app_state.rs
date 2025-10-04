use std::{
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread::{self, JoinHandle},
};

use anyhow::{anyhow, Context, Result};
use log::{error, warn};
use parking_lot::RwLock;
use serde::Deserialize;
use serde_json::json;
use tauri::{
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};
use tauri_runtime_wry::wry::dpi::{LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize};

use crate::{
    keyboard::KeyboardManager,
    models::{
        overlay_resize_anchor_from_str, BootstrapOverlayState, BootstrapPayload, OverlayBounds,
        OverlayResizeAnchor, SettingsDiff, SettingsState,
    },
    services::settings::SettingsService,
    store::AppStore,
};

const OVERLAY_LABEL: &str = "overlay";
const DEFAULT_OVERLAY_WIDTH: f64 = 860.0;
const DEFAULT_OVERLAY_HEIGHT: f64 = 320.0;
const OVERLAY_MARGIN: f64 = 40.0;

pub struct AppState {
    pub store: Arc<AppStore>,
    pub settings: SettingsService,
    pub keyboard: KeyboardManager,
    overlay_visible: Arc<RwLock<bool>>,
    keyboard_task: RwLock<Option<KeyboardDaemonTask>>,
}

impl AppState {
    pub fn initialize(store: AppStore) -> Result<Self> {
        let store = Arc::new(store);
        let snapshot = store.snapshot();
        let keyboard =
            KeyboardManager::new(snapshot.keys.clone(), snapshot.selected_key_type.clone());
        let settings = SettingsService::new(store.clone());

        Ok(Self {
            store,
            settings,
            keyboard,
            overlay_visible: Arc::new(RwLock::new(false)),
            keyboard_task: RwLock::new(None),
        })
    }

    pub fn initialize_runtime(&self, app: &AppHandle) -> Result<()> {
        self.ensure_overlay_window(app)?;
        self.start_keyboard_hook(app.clone())?;
        Ok(())
    }

    pub fn bootstrap_payload(&self) -> BootstrapPayload {
        let state = self.store.snapshot();
        BootstrapPayload {
            settings: SettingsState {
                hardware_acceleration: state.hardware_acceleration,
                always_on_top: state.always_on_top,
                overlay_locked: state.overlay_locked,
                note_effect: state.note_effect,
                note_settings: state.note_settings.clone(),
                angle_mode: state.angle_mode.clone(),
                language: state.language.clone(),
                laboratory_enabled: state.laboratory_enabled,
                background_color: state.background_color.clone(),
                use_custom_css: state.use_custom_css,
                custom_css: state.custom_css.clone(),
                overlay_resize_anchor: state.overlay_resize_anchor.clone(),
            },
            keys: state.keys.clone(),
            positions: state.key_positions.clone(),
            custom_tabs: state.custom_tabs.clone(),
            selected_key_type: state.selected_key_type.clone(),
            current_mode: self.keyboard.current_mode(),
            overlay: BootstrapOverlayState {
                visible: *self.overlay_visible.read(),
                locked: state.overlay_locked,
                anchor: state.overlay_resize_anchor.as_str().to_string(),
            },
        }
    }

    pub fn overlay_status(&self) -> BootstrapOverlayState {
        let state = self.store.snapshot();
        BootstrapOverlayState {
            visible: *self.overlay_visible.read(),
            locked: state.overlay_locked,
            anchor: state.overlay_resize_anchor.as_str().to_string(),
        }
    }

    pub fn emit_settings_changed(&self, diff: &SettingsDiff, app: &AppHandle) -> Result<()> {
        self.apply_settings_effects(diff, app)?;
        app.emit("settings:changed", diff)?;
        Ok(())
    }

    pub fn set_overlay_visibility(&self, app: &AppHandle, visible: bool) -> Result<()> {
        let window = self.ensure_overlay_window(app)?;
        if visible {
            window.show()?;
        } else {
            window.hide()?;
        }
        *self.overlay_visible.write() = visible;
        app.emit("overlay:visibility", &json!({ "visible": visible }))?;
        Ok(())
    }

    pub fn set_overlay_lock(&self, app: &AppHandle, locked: bool, persist: bool) -> Result<()> {
        if persist {
            let _ = self.store.update(|state| {
                state.overlay_locked = locked;
            })?;
        }

        let window = self.ensure_overlay_window(app)?;
        window.set_ignore_cursor_events(locked)?;
        app.emit("overlay:lock", &json!({ "locked": locked }))?;
        Ok(())
    }

    pub fn shutdown(&self) {
        if let Some(task) = self.keyboard_task.write().take() {
            drop(task);
        }
    }

    pub fn set_overlay_anchor(&self, app: &AppHandle, anchor: &str) -> Result<String> {
        let parsed = overlay_resize_anchor_from_str(anchor);
        let value: OverlayResizeAnchor =
            parsed.unwrap_or_else(|| self.store.snapshot().overlay_resize_anchor.clone());
        let updated = self.store.update(|state| {
            state.overlay_resize_anchor = value.clone();
        })?;
        app.emit("overlay:anchor", &json!({ "anchor": value.as_str() }))?;
        Ok(updated.overlay_resize_anchor.as_str().to_string())
    }

    pub fn resize_overlay(
        &self,
        app: &AppHandle,
        width: f64,
        height: f64,
        anchor: Option<String>,
        content_top_offset: Option<f64>,
    ) -> Result<OverlayBounds> {
        let window = self.ensure_overlay_window(app)?;
        let anchor = anchor
            .and_then(|value| overlay_resize_anchor_from_str(&value))
            .unwrap_or_else(|| self.store.snapshot().overlay_resize_anchor.clone());

        let width = width.clamp(100.0, 2000.0).round();
        let height = height.clamp(100.0, 2000.0).round();

        let position = window
            .outer_position()
            .unwrap_or(PhysicalPosition::new(0, 0));
        let size = window.outer_size().unwrap_or(PhysicalSize::new(
            DEFAULT_OVERLAY_WIDTH as u32,
            DEFAULT_OVERLAY_HEIGHT as u32,
        ));

        let mut new_x = position.x as f64;
        let mut new_y = position.y as f64;

        match anchor {
            OverlayResizeAnchor::BottomLeft => new_y += size.height as f64 - height,
            OverlayResizeAnchor::TopRight => new_x += size.width as f64 - width,
            OverlayResizeAnchor::BottomRight => {
                new_x += size.width as f64 - width;
                new_y += size.height as f64 - height;
            }
            OverlayResizeAnchor::Center => {
                new_x += (size.width as f64 - width) / 2.0;
                new_y += (size.height as f64 - height) / 2.0;
            }
            OverlayResizeAnchor::TopLeft => {}
        }

        if let Some(offset) = content_top_offset {
            if offset.is_finite() {
                let previous = self
                    .store
                    .snapshot()
                    .overlay_last_content_top_offset
                    .unwrap_or(offset);
                let delta = offset - previous;
                if delta != 0.0 {
                    match anchor {
                        OverlayResizeAnchor::Center => new_y -= delta / 2.0,
                        OverlayResizeAnchor::BottomLeft | OverlayResizeAnchor::BottomRight => {}
                        _ => new_y -= delta,
                    }
                }
                let _ = self.store.update(|state| {
                    state.overlay_last_content_top_offset = Some(offset);
                })?;
            }
        }

        window.set_size(LogicalSize::new(width, height))?;
        window.set_position(LogicalPosition::new(new_x, new_y))?;

        let bounds = OverlayBounds {
            x: new_x,
            y: new_y,
            width,
            height,
        };

        let _ = self.store.update(|state| {
            state.overlay_bounds = Some(bounds.clone());
        })?;

        app.emit(
            "overlay:resized",
            &json!({
                "x": bounds.x,
                "y": bounds.y,
                "width": bounds.width,
                "height": bounds.height,
            }),
        )?;

        Ok(bounds)
    }

    pub fn start_keyboard_hook(&self, app: AppHandle) -> Result<()> {
        let mut task_guard = self.keyboard_task.write();
        if task_guard.is_some() {
            return Ok(());
        }

        let current_exe = std::env::current_exe().context("failed to locate dm-note executable")?;
        let mut child = Command::new(current_exe)
            .arg("--keyboard-daemon")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .context("failed to spawn keyboard daemon process")?;

        let stdout = child
            .stdout
            .take()
            .context("keyboard daemon stdout unavailable")?;
        let stderr = child.stderr.take();

        let running = Arc::new(AtomicBool::new(true));
        let running_reader = running.clone();
        let keyboard = self.keyboard.clone();
        let app_handle = app.clone();

        let reader_handle = thread::Builder::new()
            .name("keyboard-daemon-reader".into())
            .spawn(move || {
                let mut reader = BufReader::new(stdout);
                let mut line = String::new();

                while running_reader.load(Ordering::SeqCst) {
                    line.clear();
                    match reader.read_line(&mut line) {
                        Ok(0) => break,
                        Ok(_) => {
                            let trimmed = line.trim();
                            if trimmed.is_empty() {
                                continue;
                            }

                            match serde_json::from_str::<HookMessage>(trimmed) {
                                Ok(message) => {
                                    if message.labels.is_empty() {
                                        continue;
                                    }

                                    let Some(key_label) = keyboard
                                        .match_candidate(
                                            message.labels.iter().map(|label| label.as_str()),
                                        )
                                    else {
                                        continue;
                                    };

                                    let state = match message.state {
                                        HookKeyState::Down => "DOWN",
                                        HookKeyState::Up => "UP",
                                    };

                                    let mode = keyboard.current_mode();
                                    if let Err(err) = app_handle.emit(
                                        "keys:state",
                                        &json!({
                                            "key": key_label,
                                            "state": state,
                                            "mode": mode,
                                        }),
                                    ) {
                                        error!("failed to emit keys:state event: {err}");
                                    }
                                }
                                Err(err) => {
                                    error!(
                                        "failed to parse keyboard daemon message: {err}; payload={trimmed}"
                                    );
                                }
                            }
                        }
                        Err(err) => {
                            if running_reader.load(Ordering::SeqCst) {
                                error!("error reading keyboard daemon output: {err}");
                            }
                            break;
                        }
                    }
                }
            })
            .map_err(|err| anyhow!("failed to spawn keyboard daemon reader: {err}"))?;

        let stderr_handle = if let Some(stderr) = stderr {
            match thread::Builder::new()
                .name("keyboard-daemon-stderr".into())
                .spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        match line {
                            Ok(text) if !text.trim().is_empty() => {
                                warn!("keyboard-daemon stderr: {text}");
                            }
                            Ok(_) => {}
                            Err(err) => {
                                error!("error reading keyboard daemon stderr: {err}");
                                break;
                            }
                        }
                    }
                }) {
                Ok(handle) => Some(handle),
                Err(err) => {
                    warn!("failed to spawn keyboard daemon stderr reader: {err}");
                    None
                }
            }
        } else {
            None
        };

        *task_guard = Some(KeyboardDaemonTask {
            running,
            reader_handle: Some(reader_handle),
            stderr_handle,
            child: Some(child),
        });
        Ok(())
    }

    fn ensure_overlay_window(&self, app: &AppHandle) -> Result<WebviewWindow> {
        if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
            return Ok(window);
        }

        let snapshot = self.store.snapshot();
        let (mut bounds, had_bounds) = if let Some(bounds) = snapshot.overlay_bounds.clone() {
            (bounds, true)
        } else {
            (
                OverlayBounds {
                    x: 0.0,
                    y: 0.0,
                    width: DEFAULT_OVERLAY_WIDTH,
                    height: DEFAULT_OVERLAY_HEIGHT,
                },
                false,
            )
        };

        let position = self.compute_overlay_position(app, &bounds, had_bounds);
        bounds.x = position.x;
        bounds.y = position.y;

        let window = WebviewWindowBuilder::new(
            app,
            OVERLAY_LABEL,
            WebviewUrl::App("overlay/index.html".into()),
        )
        .decorations(false)
        .resizable(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(false)
        .visible(true)
        .inner_size(bounds.width, bounds.height)
        .position(bounds.x, bounds.y)
        .shadow(false)
        .build()
        .context("failed to create overlay window")?;

        window.set_ignore_cursor_events(snapshot.overlay_locked)?;
        window.set_always_on_top(snapshot.always_on_top)?;
        if let Err(err) = window.set_focus() {
            log::debug!("failed to focus overlay window: {err}");
        }

        *self.overlay_visible.write() = true;

        let _ = self.store.update(|state| {
            state.overlay_bounds = Some(bounds.clone());
        })?;

        self.configure_overlay_window(&window, app);

        Ok(window)
    }

    fn configure_overlay_window(&self, window: &WebviewWindow, app: &AppHandle) {
        let overlay_visible = self.overlay_visible.clone();
        let store = self.store.clone();
        let app_handle = app.clone();
        let overlay_window = window.clone();

        window.on_window_event(move |event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                if let Err(err) = overlay_window.hide() {
                    log::error!("failed to hide overlay window on close: {err}");
                }
                *overlay_visible.write() = false;
                if let Err(err) =
                    app_handle.emit("overlay:visibility", &json!({ "visible": false }))
                {
                    log::error!("failed to emit overlay visibility change: {err}");
                }
            }
            WindowEvent::Focused(false) => {
                let snapshot = store.snapshot();
                if let Err(err) = overlay_window.set_always_on_top(snapshot.always_on_top) {
                    log::warn!("failed to reapply always on top: {err}");
                }
            }
            WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                if let Err(err) = persist_overlay_bounds(&overlay_window, &store) {
                    log::warn!("failed to persist overlay bounds: {err}");
                }
            }
            _ => {}
        });
    }

    fn compute_overlay_position(
        &self,
        app: &AppHandle,
        bounds: &OverlayBounds,
        had_stored_bounds: bool,
    ) -> OverlayPosition {
        if had_stored_bounds {
            return OverlayPosition {
                x: bounds.x,
                y: bounds.y,
            };
        }

        if let Ok(Some(monitor)) = app.primary_monitor() {
            let work_area = monitor.work_area();

            let origin = work_area.position;
            let size = work_area.size;

            let origin_x = origin.x as f64;
            let origin_y = origin.y as f64;
            let work_width = size.width as f64;
            let work_height = size.height as f64;

            let x = origin_x + work_width - bounds.width - OVERLAY_MARGIN;
            let y = origin_y + work_height - bounds.height - OVERLAY_MARGIN;

            return OverlayPosition {
                x: x.max(origin_x),
                y: y.max(origin_y),
            };
        }

        OverlayPosition {
            x: OVERLAY_MARGIN,
            y: OVERLAY_MARGIN,
        }
    }

    fn apply_settings_effects(&self, diff: &SettingsDiff, app: &AppHandle) -> Result<()> {
        if let Some(value) = diff.changed.always_on_top {
            if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
                window.set_always_on_top(value)?;
            }
        }

        if let Some(value) = diff.changed.overlay_locked {
            self.set_overlay_lock(app, value, false)?;
        }

        Ok(())
    }
}

fn persist_overlay_bounds(window: &WebviewWindow, store: &Arc<AppStore>) -> Result<()> {
    let position = window.outer_position()?;
    let size = window.outer_size()?;

    let bounds = OverlayBounds {
        x: position.x as f64,
        y: position.y as f64,
        width: size.width as f64,
        height: size.height as f64,
    };

    let _ = store.update(|state| {
        state.overlay_bounds = Some(bounds.clone());
    })?;
    Ok(())
}

struct KeyboardDaemonTask {
    running: Arc<AtomicBool>,
    reader_handle: Option<JoinHandle<()>>,
    stderr_handle: Option<JoinHandle<()>>,
    child: Option<Child>,
}

impl Drop for KeyboardDaemonTask {
    fn drop(&mut self) {
        self.running.store(false, Ordering::SeqCst);

        if let Some(child) = self.child.as_mut() {
            if let Err(err) = child.kill() {
                if err.kind() != std::io::ErrorKind::InvalidInput {
                    warn!("failed to kill keyboard daemon: {err}");
                }
            }
            let _ = child.wait();
        }

        if let Some(handle) = self.reader_handle.take() {
            let _ = handle.join();
        }

        if let Some(handle) = self.stderr_handle.take() {
            let _ = handle.join();
        }
    }
}

#[derive(Clone)]
struct OverlayPosition {
    x: f64,
    y: f64,
}

#[derive(Debug, Deserialize)]
struct HookMessage {
    labels: Vec<String>,
    state: HookKeyState,
    #[allow(dead_code)]
    vk_code: Option<u32>,
    #[allow(dead_code)]
    scan_code: Option<u32>,
    #[allow(dead_code)]
    flags: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
enum HookKeyState {
    Down,
    Up,
}
