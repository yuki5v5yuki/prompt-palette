#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
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

            let tray_icon = app
                .default_window_icon()
                .cloned()
                .expect("No default window icon set");

            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .tooltip("Prompt Palette")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show_launcher" => {
                            toggle_launcher(app);
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
                            toggle_launcher(tray.app_handle());
                        }
                    }
                })
                .build(app)?;

            // --- Global Shortcut (Ctrl+Space) ---
            let shortcut: Shortcut = "ctrl+space".parse().expect("Invalid shortcut");
            let handle_for_shortcut = app.handle().clone();
            app.handle().global_shortcut().on_shortcut(
                shortcut,
                move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_launcher(&handle_for_shortcut);
                    }
                },
            )?;
            // Unregister first in case it's already registered from a previous session
            let _ = app.global_shortcut().unregister(shortcut);
            if let Err(e) = app.global_shortcut().register(shortcut) {
                eprintln!("Warning: Failed to register global shortcut: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Health / Status
            commands::health_check,
            commands::get_db_status,
            // Categories
            commands::list_categories,
            commands::create_category,
            commands::update_category,
            commands::delete_category,
            // Tags
            commands::list_tags,
            commands::create_tag,
            commands::delete_tag,
            // Templates
            commands::list_templates,
            commands::get_template,
            commands::create_template,
            commands::update_template,
            commands::delete_template,
            commands::record_template_use,
            commands::list_templates_by_frequency,
            // Paste
            paste::paste_template,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Prompt Palette");
}

fn toggle_launcher(app: &tauri::AppHandle) {
    if let Some(launcher) = app.get_webview_window("launcher") {
        if launcher.is_visible().unwrap_or(false) {
            let _ = launcher.hide();
        } else {
            let _ = launcher.center();
            let _ = launcher.show();
            let _ = launcher.set_focus();
        }
    }
}
