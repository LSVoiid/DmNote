use std::sync::Arc;

use anyhow::Result;
use parking_lot::RwLock;
use tauri::{AppHandle, Emitter};

use crate::{
    keyboard::KeyboardManager,
    models::{BootstrapOverlayState, BootstrapPayload, SettingsDiff, SettingsState},
    services::settings::SettingsService,
    store::AppStore,
};

pub struct AppState {
    pub store: Arc<AppStore>,
    pub settings: SettingsService,
    pub keyboard: KeyboardManager,
    pub overlay_visible: RwLock<bool>,
}

impl AppState {
    pub fn initialize(store: AppStore) -> Result<Self> {
        let store = Arc::new(store);
        let snapshot = store.snapshot();
        let keyboard =
            KeyboardManager::new(snapshot.keys.clone(), snapshot.selected_key_type.clone());
        keyboard.set_mode(snapshot.selected_key_type.clone());
        let settings = SettingsService::new(store.clone());

        Ok(Self {
            store,
            settings,
            keyboard,
            overlay_visible: RwLock::new(false),
        })
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

    pub fn emit_settings_changed(&self, diff: &SettingsDiff, app: &AppHandle) -> Result<()> {
        app.emit("settings:changed", diff)?;
        Ok(())
    }
}
