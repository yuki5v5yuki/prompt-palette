use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::migrations;

/// Get the database file path inside the app data directory.
fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create data dir: {}", e))?;
    Ok(data_dir.join("prompt-palette.db"))
}

/// Open a connection to the database.
pub fn open(app: &AppHandle) -> Result<Connection, String> {
    let path = db_path(app)?;
    Connection::open(&path).map_err(|e| format!("Failed to open database: {}", e))
}

/// Initialize the database: enable foreign keys and run pending migrations.
pub fn initialize(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = open(app).map_err(|e| e.to_string())?;

    // Ensure schema_version table exists
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);",
    )?;

    // Get current version
    let current_version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Run pending migrations with FK disabled (some migrations restructure tables)
    let all_migrations = migrations::get_migrations();
    let has_pending = all_migrations.len() as i32 > current_version;
    if has_pending {
        conn.execute_batch("PRAGMA foreign_keys = OFF;")?;
    }
    for (i, migration) in all_migrations.iter().enumerate() {
        let version = (i + 1) as i32;
        if version > current_version {
            let tx = conn.unchecked_transaction()?;
            migration(&conn)?;
            conn.execute(
                "INSERT INTO schema_version (version) VALUES (?1)",
                [version],
            )?;
            tx.commit()?;
        }
    }

    // Enable foreign key support (after migrations)
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    Ok(())
}

/// Get the current schema version.
pub fn get_schema_version(conn: &Connection) -> i32 {
    conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_version",
        [],
        |row| row.get(0),
    )
    .unwrap_or(0)
}

/// Count how many tables exist in the database (excluding internal sqlite tables).
pub fn get_table_count(conn: &Connection) -> i32 {
    conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        [],
        |row| row.get(0),
    )
    .unwrap_or(0)
}
