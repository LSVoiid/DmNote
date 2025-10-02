use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread::{self, JoinHandle},
    time::Duration,
};

use anyhow::{anyhow, Context, Result};
use log::{error, warn};
use parking_lot::RwLock;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_runtime_wry::wry::dpi::{LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize};
use willhook::{
    hook::event::{InputEvent, KeyPress, KeyboardKey},
    keyboard_hook,
};

use crate::{
    keyboard::KeyboardManager,
    models::{BootstrapOverlayState, BootstrapPayload, OverlayBounds, SettingsDiff, SettingsState},
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
    overlay_visible: RwLock<bool>,
    keyboard_task: RwLock<Option<KeyboardHookTask>>,
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
            overlay_visible: RwLock::new(false),
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
            self.store.update(|state| {
                state.overlay_locked = locked;
            })?;
        }
        let window = self.ensure_overlay_window(app)?;
        window.set_ignore_cursor_events(locked)?;
        app.emit("overlay:lock", &json!({ "locked": locked }))?;
        Ok(())
    }

    pub fn set_overlay_anchor(&self, app: &AppHandle, anchor: &str) -> Result<String> {
        let parsed = crate::models::overlay_resize_anchor_from_str(anchor);
        let value = parsed.unwrap_or_else(|| self.store.snapshot().overlay_resize_anchor);
        self.store.update(|state| {
            state.overlay_resize_anchor = value.clone();
        })?;
        app.emit("overlay:anchor", &json!({ "anchor": value.as_str() }))?;
        Ok(value.as_str().to_string())
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
            .and_then(|value| crate::models::overlay_resize_anchor_from_str(&value))
            .unwrap_or_else(|| self.store.snapshot().overlay_resize_anchor);

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

        match anchor.as_str() {
            "bottom-left" => new_y += size.height as f64 - height,
            "top-right" => new_x += size.width as f64 - width,
            "bottom-right" => {
                new_x += size.width as f64 - width;
                new_y += size.height as f64 - height;
            }
            "center" => {
                new_x += (size.width as f64 - width) / 2.0;
                new_y += (size.height as f64 - height) / 2.0;
            }
            _ => {}
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
                    match anchor.as_str() {
                        "center" => new_y -= delta / 2.0,
                        anchor if anchor.contains("bottom") => {}
                        _ => new_y -= delta,
                    }
                }
                self.store.update(|state| {
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
        self.store.update(|state| {
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

        let running = Arc::new(AtomicBool::new(true));
        let keyboard = self.keyboard.clone();
        let running_flag = running.clone();

        let handle = thread::Builder::new()
            .name("willhook-keyboard".into())
            .spawn(move || {
                let Some(hook) = keyboard_hook() else {
                    warn!("failed to initialize global keyboard hook");
                    return;
                };

                while running_flag.load(Ordering::SeqCst) {
                    match hook.try_recv() {
                        Ok(InputEvent::Keyboard(event)) => {
                            if let Some(key) = event.key.and_then(keyboard_key_to_global) {
                                if !keyboard.is_valid_key(&key) {
                                    continue;
                                }

                                let state = match event.pressed {
                                    KeyPress::Down(_) => "DOWN",
                                    KeyPress::Up(_) => "UP",
                                    _ => continue,
                                };

                                let mode = keyboard.current_mode();
                                if let Err(err) = app.emit(
                                    "keys:state",
                                    &json!({
                                        "key": key,
                                        "state": state,
                                        "mode": mode,
                                    }),
                                ) {
                                    error!("failed to emit keys:state event: {err}");
                                }
                            }
                        }
                        Ok(_) => {}
                        Err(std::sync::mpsc::TryRecvError::Empty) => {
                            thread::sleep(Duration::from_millis(1));
                        }
                        Err(std::sync::mpsc::TryRecvError::Disconnected) => break,
                    }
                }
            })
            .map_err(|err| anyhow!("failed to spawn keyboard hook thread: {err}"))?;

        *task_guard = Some(KeyboardHookTask {
            running,
            handle: Some(handle),
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
        .skip_taskbar(true)
        .visible(true)
        .inner_size(bounds.width, bounds.height)
        .position(bounds.x, bounds.y)
        .shadow(false)
        .build()
        .context("failed to create overlay window")?;

        window.set_ignore_cursor_events(snapshot.overlay_locked)?;
        window.set_always_on_top(snapshot.always_on_top)?;

        *self.overlay_visible.write() = true;

        self.store.update(|state| {
            state.overlay_bounds = Some(bounds.clone());
        })?;

        Ok(window)
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

struct KeyboardHookTask {
    running: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl Drop for KeyboardHookTask {
    fn drop(&mut self) {
        self.running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.handle.take() {
            if let Err(err) = handle.join() {
                error!("failed to join keyboard hook thread: {:?}", err);
            }
        }
    }
}

#[derive(Clone)]
struct OverlayPosition {
    x: f64,
    y: f64,
}

fn keyboard_key_to_global(key: KeyboardKey) -> Option<String> {
    use KeyboardKey::*;
    let label = match key {
        A => "A",
        B => "B",
        C => "C",
        D => "D",
        E => "E",
        F => "F",
        G => "G",
        H => "H",
        I => "I",
        J => "J",
        K => "K",
        L => "L",
        M => "M",
        N => "N",
        O => "O",
        P => "P",
        Q => "Q",
        R => "R",
        S => "S",
        T => "T",
        U => "U",
        V => "V",
        W => "W",
        X => "X",
        Y => "Y",
        Z => "Z",
        Number0 => "0",
        Number1 => "1",
        Number2 => "2",
        Number3 => "3",
        Number4 => "4",
        Number5 => "5",
        Number6 => "6",
        Number7 => "7",
        Number8 => "8",
        Number9 => "9",
        LeftAlt => "LEFT ALT",
        RightAlt => "RIGHT ALT",
        LeftShift => "LEFT SHIFT",
        RightShift => "RIGHT SHIFT",
        LeftControl => "LEFT CTRL",
        RightControl => "25",
        BackSpace => "BACKSPACE",
        Tab => "TAB",
        Enter => "RETURN",
        Escape => "ESCAPE",
        Space => "SPACE",
        PageUp => "PAGE UP",
        PageDown => "PAGE DOWN",
        Home => "HOME",
        ArrowLeft => "LEFT ARROW",
        ArrowUp => "UP ARROW",
        ArrowRight => "RIGHT ARROW",
        ArrowDown => "DOWN ARROW",
        Print => "PRINT",
        PrintScreen => "PRINT SCREEN",
        Insert => "INS",
        Delete => "DELETE",
        LeftWindows => "91",
        RightWindows => "92",
        Comma => "COMMA",
        Period => "DOT",
        Slash => "FORWARD SLASH",
        SemiColon => "SEMICOLON",
        Apostrophe => "QUOTE",
        LeftBrace => "SQUARE BRACKET OPEN",
        BackwardSlash => "BACKSLASH",
        RightBrace => "SQUARE BRACKET CLOSE",
        Grave => "SECTION",
        Add => "NUMPAD PLUS",
        Subtract => "NUMPAD MINUS",
        Decimal => "NUMPAD DELETE",
        Divide => "NUMPAD DIVIDE",
        Multiply => "NUMPAD MULTIPLY",
        Separator => "NUMPAD SEPARATOR",
        F1 => "F1",
        F2 => "F2",
        F3 => "F3",
        F4 => "F4",
        F5 => "F5",
        F6 => "F6",
        F7 => "F7",
        F8 => "F8",
        F9 => "F9",
        F10 => "F10",
        F11 => "F11",
        F12 => "F12",
        F13 => "F13",
        F14 => "F14",
        F15 => "F15",
        F16 => "F16",
        F17 => "F17",
        F18 => "F18",
        F19 => "F19",
        F20 => "F20",
        F21 => "F21",
        F22 => "F22",
        F23 => "F23",
        F24 => "F24",
        NumLock => "NUM LOCK",
        ScrollLock => "SCROLL LOCK",
        CapsLock => "CAPS LOCK",
        Numpad0 => "NUMPAD 0",
        Numpad1 => "NUMPAD 1",
        Numpad2 => "NUMPAD 2",
        Numpad3 => "NUMPAD 3",
        Numpad4 => "NUMPAD 4",
        Numpad5 => "NUMPAD 5",
        Numpad6 => "NUMPAD 6",
        Numpad7 => "NUMPAD 7",
        Numpad8 => "NUMPAD 8",
        Numpad9 => "NUMPAD 9",
        Other(code) => return other_key_label(code),
        InvalidKeyCodeReceived => return None,
    };
    Some(label.to_string())
}

fn other_key_label(code: u32) -> Option<String> {
    let label = match code {
        187 => "EQUALS",
        189 => "MINUS",
        _ => return Some(code.to_string()),
    };
    Some(label.to_string())
}
