mod buffer;
mod color;
mod system;
mod types;

pub use buffer::NoteBuffer;
pub use color::NoteColor;
pub use system::NoteSystem;
pub use types::{NoteMessageType, NoteSettingsInput, TrackLayoutInput, TrackPositionInput};

pub const MAX_NOTES: usize = 2048;

