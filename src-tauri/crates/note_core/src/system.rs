use std::collections::HashMap;

use crate::buffer::NoteBuffer;
use crate::color::{extract_color_stops, linear_to_srgb};
use crate::{NoteMessageType, NoteSettingsInput, TrackLayoutInput};

const DEFAULT_FLOW_SPEED: f32 = 180.0;
const DEFAULT_TRACK_HEIGHT: f32 = 150.0;
const DEFAULT_NOTE_OPACITY: f32 = 80.0;
const DEFAULT_GLOW_OPACITY: f32 = 70.0;
const DEFAULT_GLOW_SIZE: f32 = 20.0;
const DEFAULT_BORDER_RADIUS: f32 = 2.0;
const CLEANUP_MARGIN_PX: f32 = 200.0;

#[derive(Debug, Clone)]
pub(crate) struct TrackLayoutNormalized {
    pub(crate) track_index: f32,
    pub(crate) track_x: f32,
    pub(crate) track_bottom_y: f32,
    pub(crate) width: f32,
    pub(crate) color_top: [f32; 3],
    pub(crate) color_bottom: [f32; 3],
    pub(crate) opacity_top: f32,
    pub(crate) opacity_bottom: f32,
    pub(crate) border_radius: f32,
    pub(crate) glow_size: f32,
    pub(crate) glow_opacity_top: f32,
    pub(crate) glow_opacity_bottom: f32,
    pub(crate) glow_color_top: [f32; 3],
    pub(crate) glow_color_bottom: [f32; 3],
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

#[derive(Debug)]
pub struct NoteSystem {
    enabled: bool,
    settings: RuntimeSettings,
    layouts: HashMap<String, TrackLayoutNormalized>,
    active_states: HashMap<String, Vec<ActiveState>>,
    buffer: NoteBuffer,
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
            enabled: false,
            settings: RuntimeSettings::default(),
            layouts: HashMap::new(),
            active_states: HashMap::new(),
            buffer: NoteBuffer::new(),
            next_note_id: 1,
        }
    }

    pub fn enabled(&self) -> bool {
        self.enabled
    }

    pub fn buffer(&self) -> &NoteBuffer {
        &self.buffer
    }

    pub fn set_enabled(&mut self, enabled: bool) -> Option<NoteMessageType> {
        self.enabled = enabled;
        if !enabled {
            self.active_states.clear();
            self.buffer.clear();
            return Some(NoteMessageType::Clear);
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

    pub fn has_pending_work(&self) -> bool {
        self.enabled
            && (self.buffer.active_count > 0
                || self.active_states.values().any(|states| !states.is_empty()))
    }

    pub fn snapshot(&self) -> Vec<u8> {
        self.buffer.serialize_active(NoteMessageType::Sync as u8)
    }

    pub fn on_key_down_at(&mut self, key: &str, now_ms: f64) -> Option<NoteMessageType> {
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

        Some(NoteMessageType::Add)
    }

    pub fn on_key_up_at(&mut self, key: &str, now_ms: f64) -> Option<NoteMessageType> {
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
                let target =
                    Self::compute_target_end_time_ms(min_length_ms, state, now_ms, false);
                state.target_end_time_ms = Some(target);
            }

            (states.is_empty(), emit_finalize)
        };

        if should_remove_key {
            self.active_states.remove(key);
        }

        if should_emit_finalize {
            return Some(NoteMessageType::Finalize);
        }
        None
    }

    pub fn tick(&mut self, now_ms: f64) -> Option<NoteMessageType> {
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
                            let target_end = Self::compute_target_end_time_ms(
                                min_length_ms,
                                state,
                                now_ms,
                                force_min,
                            );
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
            return Some(NoteMessageType::Cleanup);
        }
        if finalized {
            return Some(NoteMessageType::Finalize);
        }
        if added {
            return Some(NoteMessageType::Add);
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
