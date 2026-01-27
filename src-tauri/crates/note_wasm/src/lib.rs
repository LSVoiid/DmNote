use note_core::{NoteSettingsInput, NoteSystem, TrackLayoutInput, MAX_NOTES};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct NoteSystemWasm {
    inner: NoteSystem,
}

#[wasm_bindgen]
impl NoteSystemWasm {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: NoteSystem::new(),
        }
    }

    #[wasm_bindgen(getter)]
    pub fn max_notes(&self) -> usize {
        MAX_NOTES
    }

    pub fn has_pending_work(&self) -> bool {
        self.inner.has_pending_work()
    }

    pub fn set_enabled(&mut self, enabled: bool) -> u8 {
        self.inner.set_enabled(enabled).map(|v| v as u8).unwrap_or(0)
    }

    pub fn update_settings(&mut self, settings: JsValue) -> Result<(), JsValue> {
        let input: NoteSettingsInput = serde_wasm_bindgen::from_value(settings)?;
        self.inner.update_settings(input);
        Ok(())
    }

    pub fn update_track_layouts(&mut self, layouts: JsValue) -> Result<(), JsValue> {
        let layouts: Vec<TrackLayoutInput> = serde_wasm_bindgen::from_value(layouts)?;
        self.inner.update_track_layouts(layouts);
        Ok(())
    }

    pub fn on_key_down(&mut self, key: &str, now_ms: f64) -> u8 {
        self.inner
            .on_key_down_at(key, now_ms)
            .map(|v| v as u8)
            .unwrap_or(0)
    }

    pub fn on_key_up(&mut self, key: &str, now_ms: f64) -> u8 {
        self.inner
            .on_key_up_at(key, now_ms)
            .map(|v| v as u8)
            .unwrap_or(0)
    }

    pub fn tick(&mut self, now_ms: f64) -> u8 {
        self.inner.tick(now_ms).map(|v| v as u8).unwrap_or(0)
    }

    pub fn active_count(&self) -> u32 {
        self.inner.buffer().active_count.min(MAX_NOTES) as u32
    }

    pub fn version(&self) -> u32 {
        self.inner.buffer().version
    }

    pub fn note_info_ptr(&self) -> *const f32 {
        self.inner.buffer().note_info.as_ptr()
    }

    pub fn note_size_ptr(&self) -> *const f32 {
        self.inner.buffer().note_size.as_ptr()
    }

    pub fn note_color_top_ptr(&self) -> *const f32 {
        self.inner.buffer().note_color_top.as_ptr()
    }

    pub fn note_color_bottom_ptr(&self) -> *const f32 {
        self.inner.buffer().note_color_bottom.as_ptr()
    }

    pub fn note_radius_ptr(&self) -> *const f32 {
        self.inner.buffer().note_radius.as_ptr()
    }

    pub fn note_glow_ptr(&self) -> *const f32 {
        self.inner.buffer().note_glow.as_ptr()
    }

    pub fn note_glow_color_top_ptr(&self) -> *const f32 {
        self.inner.buffer().note_glow_color_top.as_ptr()
    }

    pub fn note_glow_color_bottom_ptr(&self) -> *const f32 {
        self.inner.buffer().note_glow_color_bottom.as_ptr()
    }

    pub fn track_index_ptr(&self) -> *const f32 {
        self.inner.buffer().track_index.as_ptr()
    }
}

