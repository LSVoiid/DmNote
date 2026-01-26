use std::{collections::HashMap, time::Instant};

use once_cell::sync::Lazy;
use serde::Deserialize;
use tauri::ipc::{Channel, InvokeResponseBody};

use crate::models::NoteColor;

pub const MAX_NOTES: usize = 2048;

const DEFAULT_FLOW_SPEED: f32 = 180.0;
const DEFAULT_TRACK_HEIGHT: f32 = 150.0;
const DEFAULT_NOTE_OPACITY: f32 = 80.0;
const DEFAULT_GLOW_OPACITY: f32 = 70.0;
const DEFAULT_GLOW_SIZE: f32 = 20.0;
const DEFAULT_BORDER_RADIUS: f32 = 2.0;
const CLEANUP_MARGIN_PX: f32 = 200.0;

const NOTE_MESSAGE_MAGIC: u32 = 0x444D_4E54; // "DMNT"
const NOTE_MESSAGE_HEADER_BYTES: usize = 24;

const MSG_TYPE_SYNC: u8 = 0;
const MSG_TYPE_ADD: u8 = 1;
const MSG_TYPE_FINALIZE: u8 = 2;
const MSG_TYPE_CLEANUP: u8 = 3;
const MSG_TYPE_CLEAR: u8 = 4;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSettingsInput {
    #[serde(default)]
    pub speed: Option<f32>,
    #[serde(default)]
    pub track_height: Option<f32>,
    #[serde(default)]
    pub delayed_note_enabled: Option<bool>,
    #[serde(default)]
    pub short_note_threshold_ms: Option<f32>,
    #[serde(default)]
    pub short_note_min_length_px: Option<f32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackPositionInput {
    pub dx: f32,
    pub dy: f32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackLayoutInput {
    pub track_key: String,
    #[serde(default)]
    pub track_index: i32,
    pub position: TrackPositionInput,
    pub width: f32,
    #[serde(default)]
    pub note_color: Option<NoteColor>,
    #[serde(default)]
    pub note_opacity: Option<f32>,
    #[serde(default)]
    pub note_opacity_top: Option<f32>,
    #[serde(default)]
    pub note_opacity_bottom: Option<f32>,
    #[serde(default)]
    pub note_glow_enabled: Option<bool>,
    #[serde(default)]
    pub note_glow_size: Option<f32>,
    #[serde(default)]
    pub note_glow_opacity: Option<f32>,
    #[serde(default)]
    pub note_glow_opacity_top: Option<f32>,
    #[serde(default)]
    pub note_glow_opacity_bottom: Option<f32>,
    #[serde(default)]
    pub note_glow_color: Option<NoteColor>,
    #[serde(default)]
    pub border_radius: Option<f32>,
    #[serde(default)]
    pub note_effect_enabled: Option<bool>,
}

#[derive(Debug, Clone)]
struct TrackLayoutNormalized {
    track_index: f32,
    track_x: f32,
    track_bottom_y: f32,
    width: f32,
    color_top: [f32; 3],
    color_bottom: [f32; 3],
    opacity_top: f32,
    opacity_bottom: f32,
    border_radius: f32,
    glow_size: f32,
    glow_opacity_top: f32,
    glow_opacity_bottom: f32,
    glow_color_top: [f32; 3],
    glow_color_bottom: [f32; 3],
}

#[derive(Debug, Clone)]
struct RuntimeSettings {
    flow_speed: f32,
    track_height: f32,
    delay_enabled: bool,
    delay_ms: f32,
    short_note_min_length_px: f32,
}

impl Default for RuntimeSettings {
    fn default() -> Self {
        Self {
            flow_speed: DEFAULT_FLOW_SPEED,
            track_height: DEFAULT_TRACK_HEIGHT,
            delay_enabled: false,
            delay_ms: 0.0,
            short_note_min_length_px: 0.0,
        }
    }
}

#[derive(Debug, Clone)]
struct ActiveState {
    use_delay: bool,
    down_time_ms: f64,
    release_time_ms: Option<f64>,
    start_time_ms: Option<f64>,
    note_id: Option<u64>,
    created: bool,
    released: bool,
    released_before_start: bool,
    target_end_time_ms: Option<f64>,
}

pub struct NoteIpcMessage {
    pub channel: Channel<InvokeResponseBody>,
    pub payload: Vec<u8>,
}

pub struct NoteSystem {
    origin: Instant,
    time_offset_ms: Option<f64>,
    enabled: bool,
    settings: RuntimeSettings,
    layouts: HashMap<String, TrackLayoutNormalized>,
    active_states: HashMap<String, Vec<ActiveState>>,
    buffer: NoteBuffer,
    channel: Option<Channel<InvokeResponseBody>>,
    next_note_id: u64,
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
            enabled: false,
            settings: RuntimeSettings::default(),
            layouts: HashMap::new(),
            active_states: HashMap::new(),
            buffer: NoteBuffer::new(),
            channel: None,
            next_note_id: 1,
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
        self.build_message(MSG_TYPE_SYNC)
    }

    pub fn set_enabled(&mut self, enabled: bool) -> Option<NoteIpcMessage> {
        self.enabled = enabled;
        if !enabled {
            self.active_states.clear();
            self.buffer.clear();
            return self.build_message(MSG_TYPE_CLEAR);
        }
        None
    }

    pub fn update_settings(&mut self, input: NoteSettingsInput) {
        if let Some(speed) = input.speed.filter(|v| v.is_finite()) {
            self.settings.flow_speed = speed.max(0.0);
        }
        if let Some(track_height) = input.track_height.filter(|v| v.is_finite()) {
            self.settings.track_height = track_height.max(0.0);
        }
        if let Some(enabled) = input.delayed_note_enabled {
            self.settings.delay_enabled = enabled;
        }
        if let Some(delay_ms) = input.short_note_threshold_ms.filter(|v| v.is_finite()) {
            self.settings.delay_ms = delay_ms.max(0.0);
        }
        if let Some(min_px) = input.short_note_min_length_px.filter(|v| v.is_finite()) {
            self.settings.short_note_min_length_px = min_px.max(0.0);
        }
    }

    pub fn update_track_layouts(&mut self, layouts: Vec<TrackLayoutInput>) {
        let mut next = HashMap::new();
        for layout in layouts {
            if layout.note_effect_enabled == Some(false) {
                continue;
            }
            if layout.width <= 0.0 {
                continue;
            }
            let normalized = normalize_layout(&layout);
            next.insert(layout.track_key, normalized);
        }
        self.layouts = next;
    }

    pub fn on_key_down(&mut self, key: &str) -> Option<NoteIpcMessage> {
        let now_ms = self.now_js_ms()?;
        self.on_key_down_at(key, now_ms)
    }

    pub fn on_key_up(&mut self, key: &str) -> Option<NoteIpcMessage> {
        let now_ms = self.now_js_ms()?;
        self.on_key_up_at(key, now_ms)
    }

    pub fn request_tick(&mut self, js_now_ms: f64) -> Option<NoteIpcMessage> {
        self.tick(js_now_ms)
    }

    pub fn tick_now(&mut self) -> Option<NoteIpcMessage> {
        let now_ms = self.now_js_ms()?;
        self.tick(now_ms)
    }

    pub fn has_pending_work(&self) -> bool {
        self.enabled
            && (self.buffer.active_count > 0
                || self.active_states.values().any(|states| !states.is_empty()))
    }

    pub fn snapshot(&self) -> Vec<u8> {
        self.buffer.serialize_active(MSG_TYPE_SYNC)
    }

    fn on_key_down_at(&mut self, key: &str, now_ms: f64) -> Option<NoteIpcMessage> {
        if !self.enabled {
            return None;
        }
        let use_delay = self.settings.delay_enabled && self.settings.delay_ms > 0.0;
        let layout = self.layouts.get(key)?;

        {
            let states = self.active_states.entry(key.to_string()).or_default();
            if states.iter().any(|state| !state.released) {
                return None;
            }

            if use_delay {
                states.push(ActiveState {
                    use_delay: true,
                    down_time_ms: now_ms,
                    release_time_ms: None,
                    start_time_ms: None,
                    note_id: None,
                    created: false,
                    released: false,
                    released_before_start: false,
                    target_end_time_ms: None,
                });
                return None;
            }
        }

        let note_id = self.next_note_id;
        self.next_note_id = self.next_note_id.wrapping_add(1).max(1);

        let _ = self
            .buffer
            .allocate(note_id, key, now_ms as f32, layout);

        {
            let states = self.active_states.entry(key.to_string()).or_default();
            states.push(ActiveState {
                use_delay: false,
                down_time_ms: now_ms,
                release_time_ms: None,
                start_time_ms: Some(now_ms),
                note_id: Some(note_id),
                created: true,
                released: false,
                released_before_start: false,
                target_end_time_ms: None,
            });
        }

        self.build_message(MSG_TYPE_ADD)
    }

    fn on_key_up_at(&mut self, key: &str, now_ms: f64) -> Option<NoteIpcMessage> {
        if !self.enabled {
            return None;
        }

        let min_length_ms = self.min_length_ms() as f64;
        let (should_remove_key, should_emit_finalize) = {
            let Some(states) = self.active_states.get_mut(key) else {
                return None;
            };

            let Some(i) = states.iter().rposition(|state| !state.released) else {
                return None;
            };

            let state = &mut states[i];
            state.released = true;
            state.release_time_ms = Some(now_ms);

            let mut emit_finalize = false;
            if !state.use_delay {
                if state.created {
                    if let Some(note_id) = state.note_id {
                        let _ = self.buffer.finalize(note_id, now_ms as f32);
                        emit_finalize = true;
                    }
                }
                states.remove(i);
            } else if !state.created {
                state.released_before_start = true;
            } else if state.target_end_time_ms.is_none() {
                let target = Self::compute_target_end_time_ms(min_length_ms, state, now_ms, false);
                state.target_end_time_ms = Some(target);
            }

            (states.is_empty(), emit_finalize)
        };

        if should_remove_key {
            self.active_states.remove(key);
        }

        if should_emit_finalize {
            return self.build_message(MSG_TYPE_FINALIZE);
        }
        None
    }

    fn tick(&mut self, now_ms: f64) -> Option<NoteIpcMessage> {
        if !self.enabled {
            return None;
        }

        let mut added = false;
        let mut finalized = false;

        let delay_ms = self.settings.delay_ms as f64;
        let min_length_ms = self.min_length_ms() as f64;

        let keys: Vec<String> = self.active_states.keys().cloned().collect();
        for key in keys {
            let Some(states) = self.active_states.get_mut(&key) else {
                continue;
            };

            let mut idx = 0;
            while idx < states.len() {
                let mut remove_state = false;
                let state = &mut states[idx];

                if state.use_delay && !state.created {
                    let scheduled_start = state.down_time_ms + delay_ms;
                    if now_ms >= scheduled_start {
                        if let Some(layout) = self.layouts.get(&key) {
                            let note_id = self.next_note_id;
                            self.next_note_id = self.next_note_id.wrapping_add(1).max(1);
                            let _ = self
                                .buffer
                                .allocate(note_id, &key, scheduled_start as f32, layout);
                            state.note_id = Some(note_id);
                            state.created = true;
                            state.start_time_ms = Some(scheduled_start);
                            added = true;
                        } else {
                            remove_state = true;
                        }

                        if state.released && state.created {
                            let force_min = state.released_before_start;
                            let target_end =
                                Self::compute_target_end_time_ms(min_length_ms, state, now_ms, force_min);
                            state.target_end_time_ms = Some(target_end);
                            state.released_before_start = false;
                        }
                    }
                }

                if state.use_delay && state.created && state.released {
                    if let Some(target_end) = state.target_end_time_ms {
                        if now_ms >= target_end {
                            if let Some(note_id) = state.note_id {
                                let _ = self.buffer.finalize(note_id, target_end as f32);
                                finalized = true;
                            }
                            remove_state = true;
                        }
                    }
                }

                if remove_state {
                    states.remove(idx);
                    continue;
                }
                idx += 1;
            }

            if states.is_empty() {
                self.active_states.remove(&key);
            }
        }

        let cleaned = self.cleanup_notes(now_ms);

        if cleaned {
            return self.build_message(MSG_TYPE_CLEANUP);
        }
        if finalized {
            return self.build_message(MSG_TYPE_FINALIZE);
        }
        if added {
            return self.build_message(MSG_TYPE_ADD);
        }
        None
    }

    fn cleanup_notes(&mut self, now_ms: f64) -> bool {
        if self.buffer.active_count == 0 {
            return false;
        }
        let flow_speed = self.settings.flow_speed.max(0.0) as f64;
        let track_height = self.settings.track_height.max(0.0) as f64;
        if flow_speed <= 0.0 {
            return false;
        }
        let threshold = track_height + CLEANUP_MARGIN_PX as f64;

        let mut removed_any = false;
        let mut idx = 0usize;
        while idx < self.buffer.active_count {
            let end_time = self.buffer.note_info[idx * 3 + 1] as f64;
            if end_time == 0.0 {
                idx += 1;
                continue;
            }
            let elapsed = now_ms - end_time;
            let y_position = (elapsed * flow_speed) / 1000.0;
            if y_position >= threshold {
                let note_id = self.buffer.note_id_by_index[idx];
                if note_id != 0 {
                    let _ = self.buffer.release(note_id);
                    removed_any = true;
                    continue;
                }
            }
            idx += 1;
        }

        removed_any
    }

    fn compute_target_end_time_ms(
        min_length_ms: f64,
        state: &ActiveState,
        now_ms: f64,
        force_min_length: bool,
    ) -> f64 {
        let start_time = state.start_time_ms.unwrap_or(state.down_time_ms);
        let release_time = state.release_time_ms.unwrap_or(now_ms);
        let baseline_start = start_time.min(release_time);
        let held_duration = (release_time - baseline_start).max(0.0);

        let desired_duration = if force_min_length {
            min_length_ms
        } else {
            min_length_ms.max(held_duration)
        };
        let safe_duration = desired_duration.max(1.0);
        start_time + safe_duration
    }

    fn min_length_ms(&self) -> u32 {
        let min_px = self.settings.short_note_min_length_px;
        let flow_speed = self.settings.flow_speed;
        if min_px <= 0.0 || flow_speed <= 0.0 {
            return 0;
        }
        ((min_px * 1000.0) / flow_speed).round().max(0.0) as u32
    }

    fn now_js_ms(&self) -> Option<f64> {
        let offset = self.time_offset_ms?;
        let backend_now_ms = self.origin.elapsed().as_secs_f64() * 1000.0;
        Some(backend_now_ms - offset)
    }

    fn build_message(&self, msg_type: u8) -> Option<NoteIpcMessage> {
        let channel = self.channel.as_ref()?.clone();
        Some(NoteIpcMessage {
            channel,
            payload: self.buffer.serialize_active(msg_type),
        })
    }
}

pub struct NoteBuffer {
    pub note_info: Vec<f32>,
    pub note_size: Vec<f32>,
    pub note_color_top: Vec<f32>,
    pub note_color_bottom: Vec<f32>,
    pub note_radius: Vec<f32>,
    pub track_index: Vec<f32>,
    pub note_glow: Vec<f32>,
    pub note_glow_color_top: Vec<f32>,
    pub note_glow_color_bottom: Vec<f32>,
    pub note_id_by_index: Vec<u64>,
    pub index_by_note_id: HashMap<u64, usize>,
    pub note_key_by_id: HashMap<u64, String>,
    pub active_count: usize,
    pub version: u32,
}

impl NoteBuffer {
    pub fn new() -> Self {
        Self {
            note_info: vec![0.0; MAX_NOTES * 3],
            note_size: vec![0.0; MAX_NOTES * 2],
            note_color_top: vec![0.0; MAX_NOTES * 4],
            note_color_bottom: vec![0.0; MAX_NOTES * 4],
            note_radius: vec![0.0; MAX_NOTES],
            track_index: vec![0.0; MAX_NOTES],
            note_glow: vec![0.0; MAX_NOTES * 3],
            note_glow_color_top: vec![0.0; MAX_NOTES * 3],
            note_glow_color_bottom: vec![0.0; MAX_NOTES * 3],
            note_id_by_index: vec![0; MAX_NOTES],
            index_by_note_id: HashMap::new(),
            note_key_by_id: HashMap::new(),
            active_count: 0,
            version: 0,
        }
    }

    fn allocate(
        &mut self,
        note_id: u64,
        track_key: &str,
        start_time: f32,
        layout: &TrackLayoutNormalized,
    ) -> i32 {
        if self.active_count >= MAX_NOTES {
            return -1;
        }

        let mut insert_index = self.active_count;
        for i in 0..self.active_count {
            if self.track_index[i] > layout.track_index {
                insert_index = i;
                break;
            }
        }

        let old_count = self.active_count;
        if insert_index < old_count {
            self.note_info
                .copy_within(insert_index * 3..old_count * 3, (insert_index + 1) * 3);
            self.note_size
                .copy_within(insert_index * 2..old_count * 2, (insert_index + 1) * 2);
            self.note_color_top
                .copy_within(insert_index * 4..old_count * 4, (insert_index + 1) * 4);
            self.note_color_bottom
                .copy_within(insert_index * 4..old_count * 4, (insert_index + 1) * 4);
            self.note_radius
                .copy_within(insert_index..old_count, insert_index + 1);
            self.track_index
                .copy_within(insert_index..old_count, insert_index + 1);
            self.note_glow
                .copy_within(insert_index * 3..old_count * 3, (insert_index + 1) * 3);
            self.note_glow_color_top
                .copy_within(insert_index * 3..old_count * 3, (insert_index + 1) * 3);
            self.note_glow_color_bottom
                .copy_within(insert_index * 3..old_count * 3, (insert_index + 1) * 3);
            self.note_id_by_index
                .copy_within(insert_index..old_count, insert_index + 1);

            for i in insert_index + 1..=old_count {
                let moved_id = self.note_id_by_index[i];
                if moved_id != 0 {
                    self.index_by_note_id.insert(moved_id, i);
                }
            }
        }

        self.active_count = old_count + 1;

        let info_offset = insert_index * 3;
        self.note_info[info_offset] = start_time;
        self.note_info[info_offset + 1] = 0.0;
        self.note_info[info_offset + 2] = layout.track_x;

        let size_offset = insert_index * 2;
        self.note_size[size_offset] = layout.width;
        self.note_size[size_offset + 1] = layout.track_bottom_y;

        let color_offset = insert_index * 4;
        self.note_color_top[color_offset] = layout.color_top[0];
        self.note_color_top[color_offset + 1] = layout.color_top[1];
        self.note_color_top[color_offset + 2] = layout.color_top[2];
        self.note_color_top[color_offset + 3] = layout.opacity_top;

        self.note_color_bottom[color_offset] = layout.color_bottom[0];
        self.note_color_bottom[color_offset + 1] = layout.color_bottom[1];
        self.note_color_bottom[color_offset + 2] = layout.color_bottom[2];
        self.note_color_bottom[color_offset + 3] = layout.opacity_bottom;

        self.note_radius[insert_index] = layout.border_radius;
        self.track_index[insert_index] = layout.track_index;

        let glow_offset = insert_index * 3;
        self.note_glow[glow_offset] = layout.glow_size;
        self.note_glow[glow_offset + 1] = layout.glow_opacity_top;
        self.note_glow[glow_offset + 2] = layout.glow_opacity_bottom;

        self.note_glow_color_top[glow_offset] = layout.glow_color_top[0];
        self.note_glow_color_top[glow_offset + 1] = layout.glow_color_top[1];
        self.note_glow_color_top[glow_offset + 2] = layout.glow_color_top[2];

        self.note_glow_color_bottom[glow_offset] = layout.glow_color_bottom[0];
        self.note_glow_color_bottom[glow_offset + 1] = layout.glow_color_bottom[1];
        self.note_glow_color_bottom[glow_offset + 2] = layout.glow_color_bottom[2];

        self.note_id_by_index[insert_index] = note_id;
        self.index_by_note_id.insert(note_id, insert_index);
        self.note_key_by_id.insert(note_id, track_key.to_string());
        self.version = self.version.wrapping_add(1);
        insert_index as i32
    }

    pub fn finalize(&mut self, note_id: u64, end_time: f32) -> i32 {
        let Some(&index) = self.index_by_note_id.get(&note_id) else {
            return -1;
        };
        self.note_info[index * 3 + 1] = end_time;
        self.version = self.version.wrapping_add(1);
        index as i32
    }

    pub fn release(&mut self, note_id: u64) -> i32 {
        let Some(index) = self.index_by_note_id.get(&note_id).copied() else {
            return -1;
        };
        if self.active_count == 0 {
            return -1;
        }
        let last = self.active_count - 1;

        if index < last {
            let next = index + 1;
            let total_info = self.active_count * 3;
            let total_size = self.active_count * 2;
            let total_color = self.active_count * 4;

            self.note_info.copy_within(next * 3..total_info, index * 3);
            self.note_size.copy_within(next * 2..total_size, index * 2);
            self.note_color_top
                .copy_within(next * 4..total_color, index * 4);
            self.note_color_bottom
                .copy_within(next * 4..total_color, index * 4);
            self.note_radius.copy_within(next..self.active_count, index);
            self.track_index.copy_within(next..self.active_count, index);
            self.note_glow
                .copy_within(next * 3..self.active_count * 3, index * 3);
            self.note_glow_color_top
                .copy_within(next * 3..self.active_count * 3, index * 3);
            self.note_glow_color_bottom
                .copy_within(next * 3..self.active_count * 3, index * 3);
            self.note_id_by_index.copy_within(next..self.active_count, index);

            for i in index..last {
                let moved_id = self.note_id_by_index[i];
                if moved_id != 0 {
                    self.index_by_note_id.insert(moved_id, i);
                }
            }
        }

        self.note_id_by_index[last] = 0;
        self.index_by_note_id.remove(&note_id);
        self.note_key_by_id.remove(&note_id);
        self.active_count = last;

        let info_offset = last * 3;
        self.note_info[info_offset..info_offset + 3].fill(0.0);
        let size_offset = last * 2;
        self.note_size[size_offset..size_offset + 2].fill(0.0);
        let color_offset = last * 4;
        self.note_color_top[color_offset..color_offset + 4].fill(0.0);
        self.note_color_bottom[color_offset..color_offset + 4].fill(0.0);
        self.note_radius[last] = 0.0;
        self.track_index[last] = 0.0;
        let glow_offset = last * 3;
        self.note_glow[glow_offset..glow_offset + 3].fill(0.0);
        self.note_glow_color_top[glow_offset..glow_offset + 3].fill(0.0);
        self.note_glow_color_bottom[glow_offset..glow_offset + 3].fill(0.0);

        self.version = self.version.wrapping_add(1);
        index as i32
    }

    pub fn clear(&mut self) {
        self.active_count = 0;
        self.version = self.version.wrapping_add(1);
        self.index_by_note_id.clear();
        self.note_key_by_id.clear();
        self.note_id_by_index.fill(0);
        self.note_info.fill(0.0);
        self.note_size.fill(0.0);
        self.note_color_top.fill(0.0);
        self.note_color_bottom.fill(0.0);
        self.note_radius.fill(0.0);
        self.track_index.fill(0.0);
        self.note_glow.fill(0.0);
        self.note_glow_color_top.fill(0.0);
        self.note_glow_color_bottom.fill(0.0);
    }

    pub fn serialize_active(&self, msg_type: u8) -> Vec<u8> {
        let active = self.active_count.min(MAX_NOTES);
        let body_bytes = active * 24 * 4;
        let mut out = Vec::with_capacity(NOTE_MESSAGE_HEADER_BYTES + body_bytes);

        out.extend_from_slice(&NOTE_MESSAGE_MAGIC.to_le_bytes());
        out.push(msg_type);
        out.extend_from_slice(&[0u8; 3]);
        out.extend_from_slice(&self.version.to_le_bytes());
        out.extend_from_slice(&(active as u32).to_le_bytes());
        out.extend_from_slice(&(MAX_NOTES as u32).to_le_bytes());
        out.extend_from_slice(&0u32.to_le_bytes());

        if active == 0 {
            return out;
        }

        let info_len = active * 3;
        let size_len = active * 2;
        let color_len = active * 4;
        let radius_len = active;
        let glow_len = active * 3;

        out.extend_from_slice(as_u8_slice(&self.note_info[..info_len]));
        out.extend_from_slice(as_u8_slice(&self.note_size[..size_len]));
        out.extend_from_slice(as_u8_slice(&self.note_color_top[..color_len]));
        out.extend_from_slice(as_u8_slice(&self.note_color_bottom[..color_len]));
        out.extend_from_slice(as_u8_slice(&self.note_radius[..radius_len]));
        out.extend_from_slice(as_u8_slice(&self.note_glow[..glow_len]));
        out.extend_from_slice(as_u8_slice(&self.note_glow_color_top[..glow_len]));
        out.extend_from_slice(as_u8_slice(&self.note_glow_color_bottom[..glow_len]));
        out.extend_from_slice(as_u8_slice(&self.track_index[..radius_len]));

        out
    }
}

fn as_u8_slice(slice: &[f32]) -> &[u8] {
    unsafe { std::slice::from_raw_parts(slice.as_ptr() as *const u8, slice.len() * 4) }
}

static SRGB_TO_LINEAR: Lazy<[f32; 256]> = Lazy::new(|| {
    let mut table = [0.0; 256];
    for (i, slot) in table.iter_mut().enumerate() {
        let c = (i as f32) / 255.0;
        *slot = if c < 0.04045 {
            c * 0.0773993808
        } else {
            (c * 0.9478672986 + 0.0521327014).powf(2.4)
        };
    }
    table
});

fn linear_to_srgb(c: f32) -> f32 {
    if c <= 0.0031308 {
        return c * 12.92;
    }
    1.055 * c.powf(1.0 / 2.4) - 0.055
}

fn parse_hex_color(hex: &str) -> Option<[f32; 3]> {
    let raw = hex.trim().trim_start_matches('#');
    if raw.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&raw[0..2], 16).ok()?;
    let g = u8::from_str_radix(&raw[2..4], 16).ok()?;
    let b = u8::from_str_radix(&raw[4..6], 16).ok()?;
    Some([
        SRGB_TO_LINEAR[r as usize],
        SRGB_TO_LINEAR[g as usize],
        SRGB_TO_LINEAR[b as usize],
    ])
}

fn extract_color_stops(color: Option<&NoteColor>, fallback: &str) -> ([f32; 3], [f32; 3]) {
    let fallback_linear = parse_hex_color(fallback).unwrap_or([1.0, 1.0, 1.0]);
    match color {
        None => (fallback_linear, fallback_linear),
        Some(NoteColor::Solid(s)) => {
            let parsed = parse_hex_color(s).unwrap_or(fallback_linear);
            (parsed, parsed)
        }
        Some(NoteColor::Gradient { top, bottom }) => {
            let top_linear = parse_hex_color(top).unwrap_or(fallback_linear);
            let bottom_linear = parse_hex_color(bottom).unwrap_or(fallback_linear);
            (top_linear, bottom_linear)
        }
    }
}

fn normalize_layout(layout: &TrackLayoutInput) -> TrackLayoutNormalized {
    let base_opacity_percent = layout
        .note_opacity
        .filter(|v| v.is_finite())
        .unwrap_or(DEFAULT_NOTE_OPACITY);
    let opacity_top_percent = layout
        .note_opacity_top
        .filter(|v| v.is_finite())
        .unwrap_or(base_opacity_percent);
    let opacity_bottom_percent = layout
        .note_opacity_bottom
        .filter(|v| v.is_finite())
        .unwrap_or(base_opacity_percent);

    let opacity_top = (opacity_top_percent / 100.0).clamp(0.0, 1.0);
    let opacity_bottom = (opacity_bottom_percent / 100.0).clamp(0.0, 1.0);

    let glow_enabled = layout.note_glow_enabled.unwrap_or(false);
    let raw_glow_size = layout
        .note_glow_size
        .filter(|v| v.is_finite())
        .unwrap_or(DEFAULT_GLOW_SIZE);
    let glow_size = if glow_enabled {
        raw_glow_size.clamp(0.0, 50.0)
    } else {
        0.0
    };

    let base_glow_opacity_percent = layout
        .note_glow_opacity
        .filter(|v| v.is_finite())
        .unwrap_or(DEFAULT_GLOW_OPACITY);
    let glow_opacity_top_percent = layout
        .note_glow_opacity_top
        .filter(|v| v.is_finite())
        .unwrap_or(base_glow_opacity_percent);
    let glow_opacity_bottom_percent = layout
        .note_glow_opacity_bottom
        .filter(|v| v.is_finite())
        .unwrap_or(base_glow_opacity_percent);
    let glow_opacity_top = if glow_enabled {
        (glow_opacity_top_percent / 100.0).clamp(0.0, 1.0)
    } else {
        0.0
    };
    let glow_opacity_bottom = if glow_enabled {
        (glow_opacity_bottom_percent / 100.0).clamp(0.0, 1.0)
    } else {
        0.0
    };

    let (top_linear, bottom_linear) = extract_color_stops(layout.note_color.as_ref(), "#FFFFFF");
    let glow_source = layout
        .note_glow_color
        .as_ref()
        .or(layout.note_color.as_ref());
    let (glow_top_linear, glow_bottom_linear) = extract_color_stops(glow_source, "#FFFFFF");

    let srgb_top = [
        linear_to_srgb(top_linear[0]),
        linear_to_srgb(top_linear[1]),
        linear_to_srgb(top_linear[2]),
    ];
    let srgb_bottom = [
        linear_to_srgb(bottom_linear[0]),
        linear_to_srgb(bottom_linear[1]),
        linear_to_srgb(bottom_linear[2]),
    ];
    let srgb_glow_top = [
        linear_to_srgb(glow_top_linear[0]),
        linear_to_srgb(glow_top_linear[1]),
        linear_to_srgb(glow_top_linear[2]),
    ];
    let srgb_glow_bottom = [
        linear_to_srgb(glow_bottom_linear[0]),
        linear_to_srgb(glow_bottom_linear[1]),
        linear_to_srgb(glow_bottom_linear[2]),
    ];

    TrackLayoutNormalized {
        track_index: layout.track_index as f32,
        track_x: layout.position.dx,
        track_bottom_y: layout.position.dy,
        width: layout.width,
        color_top: srgb_top,
        color_bottom: srgb_bottom,
        opacity_top,
        opacity_bottom,
        border_radius: layout
            .border_radius
            .filter(|v| v.is_finite())
            .unwrap_or(DEFAULT_BORDER_RADIUS),
        glow_size,
        glow_opacity_top,
        glow_opacity_bottom,
        glow_color_top: srgb_glow_top,
        glow_color_bottom: srgb_glow_bottom,
    }
}
