pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_video_info,
            commands::download_audio,
            commands::transcribe_audio,
            commands::generate_summary,
            commands::send_to_notion,
            commands::save_markdown,
            commands::open_folder,
            commands::check_dependencies,
            commands::get_default_output_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
