#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_state;
mod commands;
mod defaults;
mod keyboard;
mod models;
mod services;
mod store;

use anyhow::Result;
use log::LevelFilter;
use tauri::Manager;

use app_state::AppState;
use store::AppStore;

fn main() {
    if let Err(err) = setup_logging() {
        eprintln!("Failed to initialize logging: {err}");
    }

    let context = tauri::generate_context!();

    tauri::Builder::default()
        .setup(|app| {
            let resolver = app.path();
            let store = AppStore::initialize(&resolver)
                .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            let app_state = AppState::initialize(store)
                .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::app_bootstrap,
            commands::settings::settings_get,
            commands::settings::settings_update,
            commands::keys::keys_get,
            commands::keys::positions_get,
            commands::keys::keys_update,
            commands::keys::positions_update,
            commands::keys::keys_set_mode,
            commands::keys::keys_reset_all,
            commands::keys::keys_reset_mode,
            commands::keys::custom_tabs_list,
            commands::keys::custom_tabs_create,
            commands::keys::custom_tabs_delete,
            commands::keys::custom_tabs_select,
            commands::css::css_get,
            commands::css::css_get_use,
            commands::css::css_toggle,
            commands::css::css_reset,
            commands::css::css_set_content,
            commands::css::css_load,
            commands::preset::preset_save,
            commands::preset::preset_load,
            commands::system::window_minimize,
            commands::system::window_close,
            commands::system::app_open_external,
            commands::system::app_restart,
        ])
        .run(context)
        .expect("error while running tauri application");
}

fn setup_logging() -> Result<()> {
    let _ = fern::Dispatch::new()
        .format(|out, message, record| {
            out.finish(format_args!(
                "[{level}][{target}] {message}",
                level = record.level(),
                target = record.target(),
                message = message
            ))
        })
        .level(LevelFilter::Info)
        .chain(std::io::stdout())
        .apply();
    Ok(())
}
