mod commands;
mod lsp;

use commands::generate_model;
use lsp::{start_lsp_server, stop_lsp_server, LSPState};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn lsp_start(app: tauri::AppHandle, state: tauri::State<'_, LSPState>) -> Result<(), String> {
    start_lsp_server(app, state)
}

#[tauri::command]
async fn lsp_stop(app: tauri::AppHandle, state: tauri::State<'_, LSPState>) -> Result<(), String> {
    stop_lsp_server(app, state)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Start building the Tauri app
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(LSPState::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            generate_model,
            lsp_start,
            lsp_stop
        ]);

    // Only attach devtools in debug mode
    #[cfg(debug_assertions)]
    {
        let devtools = tauri_plugin_devtools::init();
        builder = builder.plugin(devtools);
    }

    // Run the app
    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
