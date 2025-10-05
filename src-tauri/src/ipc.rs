use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct HookMessage {
    pub labels: Vec<String>,
    pub state: HookKeyState,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub vk_code: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub scan_code: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub flags: Option<u32>,
}

#[repr(u8)]
#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum HookKeyState {
    Down = 0,
    Up = 1,
}
