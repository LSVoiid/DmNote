use tauri::{
    ipc::{Channel, InvokeResponseBody, Response},
    State,
};

use crate::{
    app_state::AppState,
    note_system::{NoteSettingsInput, TrackLayoutInput},
};

#[tauri::command]
pub fn init_note_system(
    state: State<'_, AppState>,
    channel: Channel<InvokeResponseBody>,
    now: f64,
) -> Result<(), String> {
    let msg = { state.note_system.write().init(channel, now) };
    if let Some(msg) = msg {
        let _ = msg.channel.send(InvokeResponseBody::Raw(msg.payload));
    }
    Ok(())
}

#[tauri::command]
pub fn get_note_buffer(state: State<'_, AppState>) -> Result<Response, String> {
    let bytes = state.note_system.read().snapshot();
    Ok(Response::new(bytes))
}

#[tauri::command]
pub fn update_note_settings(
    state: State<'_, AppState>,
    settings: NoteSettingsInput,
) -> Result<(), String> {
    state.note_system.write().update_settings(settings);
    Ok(())
}

#[tauri::command]
pub fn update_track_layouts(
    state: State<'_, AppState>,
    layouts: Vec<TrackLayoutInput>,
) -> Result<(), String> {
    state.note_system.write().update_track_layouts(layouts);
    Ok(())
}

#[tauri::command]
pub fn set_note_effect_enabled(state: State<'_, AppState>, enabled: bool) -> Result<(), String> {
    let msg = { state.note_system.write().set_enabled(enabled) };
    if let Some(msg) = msg {
        let _ = msg.channel.send(InvokeResponseBody::Raw(msg.payload));
    }
    Ok(())
}

#[tauri::command]
pub fn request_tick(state: State<'_, AppState>, now: f64) -> Result<(), String> {
    let msg = { state.note_system.write().request_tick(now) };
    if let Some(msg) = msg {
        let _ = msg.channel.send(InvokeResponseBody::Raw(msg.payload));
    }
    Ok(())
}

