use once_cell::sync::Lazy;

use crate::models::{KeyMappings, KeyPositions};

static DEFAULT_KEYS_RAW: &str = include_str!("../default_keys.json");
static DEFAULT_POSITIONS_RAW: &str = include_str!("../default_positions.json");

static DEFAULT_KEYS: Lazy<KeyMappings> = Lazy::new(|| {
    serde_json::from_str(DEFAULT_KEYS_RAW).expect("failed to parse default key mappings")
});

static DEFAULT_POSITIONS: Lazy<KeyPositions> = Lazy::new(|| {
    serde_json::from_str(DEFAULT_POSITIONS_RAW).expect("failed to parse default key positions")
});

pub fn default_keys() -> KeyMappings {
    DEFAULT_KEYS.clone()
}

pub fn default_positions() -> KeyPositions {
    DEFAULT_POSITIONS.clone()
}
