#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod interpolation;
mod migrations;
mod models;
mod paste;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let handle = app.handle().clone();
            db::initialize(&handle)?;

            // --- System Tray ---
            let show_launcher = MenuItemBuilder::with_id("show_launcher", "ランチャーを開く")
                .build(app)?;
            let show_main = MenuItemBuilder::with_id("show_main", "テンプレート管理")
                .build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "終了")
                .build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_launcher)
                .item(&show_main)
                .separator()
                .item(&quit)
                .build()?;

            let icon_bytes = include_bytes!("../icons/icon.png");
            let tray_icon = tauri::image::Image::from_bytes(icon_bytes)
                .expect("Failed to load icon");

            // Set window icon
            if let Some(main_win) = app.get_webview_window("main") {
                if let Ok(win_icon) = tauri::image::Image::from_bytes(icon_bytes) {
                    let _ = main_win.set_icon(win_icon);
                }
            }

            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .tooltip("Prompt Palette")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show_launcher" => {
                            commands::toggle_launcher(app);
                        }
                        "show_main" => {
                            if let Some(main_win) = app.get_webview_window("main") {
                                let _ = main_win.show();
                                let _ = main_win.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                        if button == tauri::tray::MouseButton::Left {
                            commands::toggle_launcher(tray.app_handle());
                        }
                    }
                })
                .build(app)?;

            // --- Global Shortcut (read saved hotkey or fallback to Ctrl+Space) ---
            let saved_hotkey = match db::open(&handle) {
                Ok(conn) => conn
                    .query_row(
                        "SELECT value FROM settings WHERE key = 'global_hotkey'",
                        [],
                        |row| row.get::<_, String>(0),
                    )
                    .unwrap_or_else(|_| "ctrl+space".to_string()),
                Err(e) => {
                    eprintln!(
                        "Prompt Palette: could not open database to read hotkey (using ctrl+space): {}",
                        e
                    );
                    "ctrl+space".to_string()
                }
            };
            let shortcut: Shortcut = match saved_hotkey.parse() {
                Ok(s) => s,
                Err(e) => {
                    eprintln!(
                        "Prompt Palette: invalid saved hotkey {:?} (using ctrl+space): {}",
                        saved_hotkey, e
                    );
                    "ctrl+space"
                        .parse()
                        .expect("ctrl+space must be a valid global shortcut")
                }
            };
            let _ = app.global_shortcut().unregister(shortcut);
            let handle_for_shortcut = app.handle().clone();
            app.handle().global_shortcut().on_shortcut(
                shortcut,
                move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        commands::toggle_launcher(&handle_for_shortcut);
                    }
                },
            )?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Health / Status / Onboarding
            commands::health_check,
            commands::get_db_status,
            commands::is_onboarded,
            commands::seed_sample_data,
            // Categories
            commands::list_categories,
            commands::create_category,
            commands::update_category,
            commands::delete_category,
            // Tags
            commands::list_tags,
            commands::create_tag,
            commands::delete_tag,
            // Variable Packages
            commands::list_variable_packages,
            commands::create_variable_package,
            commands::update_variable_package,
            commands::delete_variable_package,
            commands::get_template_packages,
            // Templates
            commands::list_templates,
            commands::get_template,
            commands::create_template,
            commands::update_template,
            commands::delete_template,
            commands::record_template_use,
            commands::list_templates_by_frequency,
            // Variables
            commands::list_variables,
            commands::create_variable,
            commands::update_variable,
            commands::delete_variable,
            commands::append_variable_option,
            // Interpolation
            commands::get_template_form_schema,
            commands::interpolate_template,
            // Export / Import
            commands::export_bundle,
            commands::preview_import,
            commands::import_bundle,
            // Paste
            paste::paste_template,
            // Settings
            commands::get_setting,
            commands::set_setting,
            commands::set_global_hotkey,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Prompt Palette");
}

