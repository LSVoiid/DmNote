use serde::Deserialize;

use crate::NoteColor;

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NoteMessageType {
    Sync = 0,
    Add = 1,
    Finalize = 2,
    Cleanup = 3,
    Clear = 4,
}

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

