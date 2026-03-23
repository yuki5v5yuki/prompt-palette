use serde_json::json;
use tauri::AppHandle;

use crate::db;

/// IPC health check — proves the Rust ↔ React bridge works.
#[tauri::command]
pub fn health_check() -> Result<serde_json::Value, String> {
    Ok(json!({
        "status": "ok",
        "version": "0.1.0"
    }))
}

/// Database status check — proves SQLite + migrations work.
#[tauri::command]
pub fn get_db_status(app: AppHandle) -> Result<serde_json::Value, String> {
    let conn = db::open(&app)?;
    let schema_version = db::get_schema_version(&conn);
    let table_count = db::get_table_count(&conn);
    Ok(json!({
        "schemaVersion": schema_version,
        "tableCount": table_count
    }))
}
