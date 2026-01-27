use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde::de::Error as DeError;
use serde::ser::SerializeMap;

#[derive(Debug, Clone, PartialEq)]
pub enum NoteColor {
    Solid(String),
    Gradient { top: String, bottom: String },
}

impl Serialize for NoteColor {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            NoteColor::Solid(s) => serializer.serialize_str(s),
            NoteColor::Gradient { top, bottom } => {
                let mut map = serializer.serialize_map(Some(3))?;
                map.serialize_entry("type", "gradient")?;
                map.serialize_entry("top", top)?;
                map.serialize_entry("bottom", bottom)?;
                map.end()
            }
        }
    }
}

impl<'de> Deserialize<'de> for NoteColor {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        use serde_json::Value;
        let value = Value::deserialize(deserializer)?;
        match value {
            Value::String(s) => Ok(NoteColor::Solid(s)),
            Value::Object(map) => {
                let ty = map.get("type").and_then(|v| v.as_str()).unwrap_or("");
                let top = map.get("top").and_then(|v| v.as_str());
                let bottom = map.get("bottom").and_then(|v| v.as_str());
                match (top, bottom) {
                    (Some(top), Some(bottom)) => Ok(NoteColor::Gradient {
                        top: top.to_string(),
                        bottom: bottom.to_string(),
                    }),
                    _ => Err(DeError::custom(format!(
                        "invalid noteColor object (type={ty})"
                    ))),
                }
            }
            _ => Err(DeError::custom("invalid noteColor value")),
        }
    }
}

pub(crate) fn srgb_u8_to_linear(value: u8) -> f32 {
    let c = (value as f32) / 255.0;
    if c < 0.04045 {
        c * 0.0773993808
    } else {
        (c * 0.9478672986 + 0.0521327014).powf(2.4)
    }
}

pub(crate) fn linear_to_srgb(c: f32) -> f32 {
    if c <= 0.0031308 {
        return c * 12.92;
    }
    1.055 * c.powf(1.0 / 2.4) - 0.055
}

pub(crate) fn parse_hex_color(hex: &str) -> Option<[f32; 3]> {
    let raw = hex.trim().trim_start_matches('#');
    if raw.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&raw[0..2], 16).ok()?;
    let g = u8::from_str_radix(&raw[2..4], 16).ok()?;
    let b = u8::from_str_radix(&raw[4..6], 16).ok()?;
    Some([srgb_u8_to_linear(r), srgb_u8_to_linear(g), srgb_u8_to_linear(b)])
}

pub(crate) fn extract_color_stops(
    color: Option<&NoteColor>,
    fallback: &str,
) -> ([f32; 3], [f32; 3]) {
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

