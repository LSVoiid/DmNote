use std::{fs, path::PathBuf};

use anyhow::{Context, Result};
use parking_lot::RwLock;
use serde_json::Value;
use tauri::path::PathResolver;
use tauri::Runtime;

use crate::{
    defaults::{default_keys, default_positions},
    models::{AppStoreData, KeyMappings, KeyPositions, NoteSettings, SettingsState},
};

pub struct AppStore {
    path: PathBuf,
    state: RwLock<AppStoreData>,
}

impl AppStore {
    pub fn initialize<R: Runtime>(resolver: &PathResolver<R>) -> Result<Self> {
        let dir = resolver
            .app_data_dir()
            .context("failed to resolve app data directory")?;
        fs::create_dir_all(&dir)
            .with_context(|| format!("failed to create data directory at {}", dir.display()))?;

        let path = dir.join("store.json");
        let state = if path.exists() {
            let content = fs::read_to_string(&path)
                .with_context(|| format!("failed to read store file at {}", path.display()))?;
            match serde_json::from_str::<AppStoreData>(&content) {
                Ok(data) => normalize_state(data),
                Err(_) => repair_legacy_state(&content),
            }
        } else {
            initialize_default_state()
        };

        Ok(Self {
            path,
            state: RwLock::new(state),
        })
    }

    pub fn snapshot(&self) -> AppStoreData {
        self.state.read().clone()
    }

    pub fn settings_snapshot(&self) -> SettingsState {
        settings_from_store(&self.state.read())
    }
    pub fn update<F>(&self, mut updater: F) -> Result<AppStoreData>
    where
        F: FnMut(&mut AppStoreData),
    {
        let mut guard = self.state.write();
        updater(&mut guard);
        *guard = normalize_state(guard.clone());
        self.persist_locked(&guard)?;
        Ok(guard.clone())
    }

    pub fn update_keys(&self, mappings: KeyMappings) -> Result<KeyMappings> {
        let mut guard = self.state.write();
        guard.keys = mappings.clone();
        *guard = normalize_state(guard.clone());
        self.persist_locked(&guard)?;
        Ok(guard.keys.clone())
    }

    pub fn update_positions(&self, positions: KeyPositions) -> Result<KeyPositions> {
        let mut guard = self.state.write();
        guard.key_positions = positions.clone();
        *guard = normalize_state(guard.clone());
        self.persist_locked(&guard)?;
        Ok(guard.key_positions.clone())
    }

    pub fn set_selected_key_type(&self, key: impl Into<String>) -> Result<String> {
        let key = key.into();
        let mut guard = self.state.write();
        guard.selected_key_type = key.clone();
        *guard = normalize_state(guard.clone());
        self.persist_locked(&guard)?;
        Ok(guard.selected_key_type.clone())
    }

    fn persist_locked(&self, state: &AppStoreData) -> Result<()> {
        let json = serde_json::to_string_pretty(state)?;
        fs::write(&self.path, json)
            .with_context(|| format!("failed to write store file at {}", self.path.display()))
    }
}

fn initialize_default_state() -> AppStoreData {
    let mut data = AppStoreData::default();
    data.keys = default_keys();
    data.key_positions = default_positions();
    normalize_state(data)
}

fn normalize_state(mut data: AppStoreData) -> AppStoreData {
    if data.keys.is_empty() {
        data.keys = default_keys();
    } else {
        merge_default_modes(&mut data.keys, default_keys());
    }

    if data.key_positions.is_empty() {
        data.key_positions = default_positions();
    } else {
        merge_default_positions(&mut data.key_positions, default_positions());
    }

    if !data.keys.contains_key(&data.selected_key_type) {
        data.selected_key_type = "4key".to_string();
    }

    data
}

fn merge_default_modes(target: &mut KeyMappings, defaults: KeyMappings) {
    for (mode, value) in defaults.into_iter() {
        target.entry(mode).or_insert(value);
    }
}

fn merge_default_positions(target: &mut KeyPositions, defaults: KeyPositions) {
    for (mode, positions) in defaults.into_iter() {
        target.entry(mode).or_insert(positions);
    }
}

fn settings_from_store(store: &AppStoreData) -> SettingsState {
    SettingsState {
        hardware_acceleration: store.hardware_acceleration,
        always_on_top: store.always_on_top,
        overlay_locked: store.overlay_locked,
        note_effect: store.note_effect,
        note_settings: store.note_settings.clone(),
        angle_mode: store.angle_mode.clone(),
        language: store.language.clone(),
        laboratory_enabled: store.laboratory_enabled,
        background_color: store.background_color.clone(),
        use_custom_css: store.use_custom_css,
        custom_css: store.custom_css.clone(),
        overlay_resize_anchor: store.overlay_resize_anchor.clone(),
    }
}

fn repair_legacy_state(raw: &str) -> AppStoreData {
    let value: Value = serde_json::from_str(raw).unwrap_or(Value::Null);
    let mut data = AppStoreData::default();
    if let Value::Object(obj) = value {
        if let Some(v) = obj.get("hardwareAcceleration").and_then(Value::as_bool) {
            data.hardware_acceleration = v;
        }
        if let Some(v) = obj.get("alwaysOnTop").and_then(Value::as_bool) {
            data.always_on_top = v;
        }
        if let Some(v) = obj.get("overlayLocked").and_then(Value::as_bool) {
            data.overlay_locked = v;
        }
        if let Some(v) = obj.get("noteEffect").and_then(Value::as_bool) {
            data.note_effect = v;
        }
        if let Some(v) = obj
            .get("noteSettings")
            .and_then(|v| serde_json::from_value::<NoteSettings>(v.clone()).ok())
        {
            data.note_settings = v;
        }
        if let Some(v) = obj.get("selectedKeyType").and_then(Value::as_str) {
            data.selected_key_type = v.to_string();
        }
        if let Some(v) = obj
            .get("customTabs")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
        {
            data.custom_tabs = v;
        }
        if let Some(v) = obj.get("angleMode").and_then(Value::as_str) {
            data.angle_mode = v.to_string();
        }
        if let Some(v) = obj.get("language").and_then(Value::as_str) {
            data.language = v.to_string();
        }
        if let Some(v) = obj.get("laboratoryEnabled").and_then(Value::as_bool) {
            data.laboratory_enabled = v;
        }
        if let Some(v) = obj
            .get("keys")
            .and_then(|v| serde_json::from_value::<KeyMappings>(v.clone()).ok())
        {
            data.keys = v;
        }
        if let Some(v) = obj
            .get("keyPositions")
            .and_then(|v| serde_json::from_value::<KeyPositions>(v.clone()).ok())
        {
            data.key_positions = v;
        }
        if let Some(v) = obj.get("backgroundColor").and_then(Value::as_str) {
            data.background_color = v.to_string();
        }
        if let Some(v) = obj.get("useCustomCSS").and_then(Value::as_bool) {
            data.use_custom_css = v;
        }
        if let Some(v) = obj
            .get("customCSS")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
        {
            data.custom_css = v;
        }
        if let Some(v) = obj
            .get("overlayResizeAnchor")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
        {
            data.overlay_resize_anchor = v;
        }
        if let Some(v) = obj
            .get("overlayLastContentTopOffset")
            .and_then(Value::as_f64)
        {
            data.overlay_last_content_top_offset = Some(v);
        }
    }
    normalize_state(data)
}
