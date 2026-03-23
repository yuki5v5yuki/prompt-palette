use rusqlite::Connection;

/// All migrations in order. Each function upgrades from version N-1 to N.
pub fn get_migrations() -> Vec<fn(&Connection) -> rusqlite::Result<()>> {
    vec![migrate_v1, migrate_v2]
}

/// V1: Initial schema — 5 data tables + schema_version
fn migrate_v1(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE categories (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL UNIQUE,
            icon        TEXT,
            color       TEXT,
            sort_order  INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE tags (
            id   TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE templates (
            id           TEXT PRIMARY KEY,
            title        TEXT NOT NULL,
            body         TEXT NOT NULL,
            category_id  TEXT REFERENCES categories(id) ON DELETE SET NULL,
            hotkey       TEXT,
            use_count    INTEGER NOT NULL DEFAULT 0,
            last_used_at TEXT,
            sort_order   INTEGER NOT NULL DEFAULT 0,
            created_at   TEXT NOT NULL,
            updated_at   TEXT NOT NULL
        );

        CREATE TABLE template_tags (
            template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
            tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (template_id, tag_id)
        );

        CREATE TABLE variables (
            id            TEXT PRIMARY KEY,
            template_id   TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
            key           TEXT NOT NULL,
            label         TEXT NOT NULL,
            default_value TEXT,
            options       TEXT,
            sort_order    INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX idx_templates_category ON templates(category_id);
        CREATE INDEX idx_variables_template ON variables(template_id);
        CREATE INDEX idx_template_tags_tag ON template_tags(tag_id);
        ",
    )
}

/// V2: Add allow_free_text column to variables
fn migrate_v2(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "ALTER TABLE variables ADD COLUMN allow_free_text INTEGER NOT NULL DEFAULT 1;",
    )
}
