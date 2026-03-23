use enigo::{Enigo, Keyboard, Settings, Key, Direction};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Copy text to clipboard, hide launcher, refocus previous window, and send Ctrl+V.
#[tauri::command]
pub async fn paste_template(app: AppHandle, text: String) -> Result<(), String> {
    // 1. Copy to clipboard
    app.clipboard()
        .write_text(&text)
        .map_err(|e| format!("Clipboard error: {}", e))?;

    // 2. Hide launcher window
    if let Some(launcher) = app.get_webview_window("launcher") {
        let _ = launcher.hide();
    }

    // 3. Small delay to let the OS refocus the previous window
    thread::sleep(Duration::from_millis(150));

    // 4. Send Ctrl+V keystroke
    thread::spawn(move || {
        let mut enigo = Enigo::new(&Settings::default()).expect("Failed to create Enigo");
        let _ = enigo.key(Key::Control, Direction::Press);
        let _ = enigo.key(Key::Unicode('v'), Direction::Click);
        let _ = enigo.key(Key::Control, Direction::Release);
    });

    Ok(())
}
