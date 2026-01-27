use std::time::Instant;

use note_core::{NoteMessageType, NoteSystem as CoreNoteSystem};
use tauri::ipc::{Channel, InvokeResponseBody};

pub use note_core::{NoteSettingsInput, TrackLayoutInput};

pub struct NoteIpcMessage {
    pub channel: Channel<InvokeResponseBody>,
    pub payload: Vec<u8>,
}

pub struct NoteSystem {
    origin: Instant,
    time_offset_ms: Option<f64>,
    core: CoreNoteSystem,
    channel: Option<Channel<InvokeResponseBody>>,
}

impl Default for NoteSystem {
    fn default() -> Self {
        Self::new()
    }
}

impl NoteSystem {
    pub fn new() -> Self {
        Self {
            origin: Instant::now(),
            time_offset_ms: None,
            core: CoreNoteSystem::new(),
            channel: None,
        }
    }

    pub fn init(
        &mut self,
        channel: Channel<InvokeResponseBody>,
        js_now_ms: f64,
    ) -> Option<NoteIpcMessage> {
        self.channel = Some(channel);
        let backend_now_ms = self.origin.elapsed().as_secs_f64() * 1000.0;
        self.time_offset_ms = Some(backend_now_ms - js_now_ms);
        self.build_message(NoteMessageType::Sync)
    }

    pub fn set_enabled(&mut self, enabled: bool) -> Option<NoteIpcMessage> {
        let msg_type = self.core.set_enabled(enabled)?;
        self.build_message(msg_type)
    }

    pub fn update_settings(&mut self, input: NoteSettingsInput) {
        self.core.update_settings(input);
    }

    pub fn update_track_layouts(&mut self, layouts: Vec<TrackLayoutInput>) {
        self.core.update_track_layouts(layouts);
    }

    pub fn on_key_down(&mut self, key: &str) -> Option<NoteIpcMessage> {
        let now_ms = self.now_js_ms()?;
        let msg_type = self.core.on_key_down_at(key, now_ms)?;
        self.build_message(msg_type)
    }

    pub fn on_key_up(&mut self, key: &str) -> Option<NoteIpcMessage> {
        let now_ms = self.now_js_ms()?;
        let msg_type = self.core.on_key_up_at(key, now_ms)?;
        self.build_message(msg_type)
    }

    pub fn request_tick(&mut self, js_now_ms: f64) -> Option<NoteIpcMessage> {
        let msg_type = self.core.tick(js_now_ms)?;
        self.build_message(msg_type)
    }

    pub fn tick_now(&mut self) -> Option<NoteIpcMessage> {
        let now_ms = self.now_js_ms()?;
        let msg_type = self.core.tick(now_ms)?;
        self.build_message(msg_type)
    }

    pub fn has_pending_work(&self) -> bool {
        self.core.has_pending_work()
    }

    pub fn snapshot(&self) -> Vec<u8> {
        self.core.snapshot()
    }

    fn now_js_ms(&self) -> Option<f64> {
        let offset = self.time_offset_ms?;
        let backend_now_ms = self.origin.elapsed().as_secs_f64() * 1000.0;
        Some(backend_now_ms - offset)
    }

    fn build_message(&self, msg_type: NoteMessageType) -> Option<NoteIpcMessage> {
        let channel = self.channel.as_ref()?.clone();
        Some(NoteIpcMessage {
            channel,
            payload: self.core.buffer().serialize_active(msg_type as u8),
        })
    }
}
