use rusqlite::Connection;

/// All migrations in order. Each function upgrades from version N-1 to N.
pub fn get_migrations() -> Vec<fn(&Connection) -> rusqlite::Result<()>> {
    vec![migrate_v1, migrate_v2, migrate_v3]
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

/// V3: Extract variables into reusable packages (variable_packages)
fn migrate_v3(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        -- 1. Create variable_packages table
        CREATE TABLE variable_packages (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL UNIQUE,
            description TEXT,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );

        -- 2. Create junction table for template <-> package (M:N)
        CREATE TABLE template_variable_packages (
            template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
            package_id  TEXT NOT NULL REFERENCES variable_packages(id) ON DELETE CASCADE,
            PRIMARY KEY (template_id, package_id)
        );

        CREATE INDEX idx_tvp_package ON template_variable_packages(package_id);
        ",
    )?;

    // 3. Migrate existing variables: group by template_id, create a package per template
    let mut stmt = conn.prepare(
        "SELECT DISTINCT v.template_id, t.title
         FROM variables v
         INNER JOIN templates t ON t.id = v.template_id",
    )?;
    let mappings: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<Vec<_>, _>>()?;

    let now = chrono::Utc::now().to_rfc3339();
    for (template_id, template_title) in &mappings {
        let package_id = ulid::Ulid::new().to_string();
        let package_name = format!("{}", template_title);

        conn.execute(
            "INSERT INTO variable_packages (id, name, description, sort_order, created_at, updated_at)
             VALUES (?1, ?2, NULL, 0, ?3, ?4)",
            rusqlite::params![package_id, package_name, now, now],
        )?;

        conn.execute(
            "INSERT INTO template_variable_packages (template_id, package_id) VALUES (?1, ?2)",
            rusqlite::params![template_id, package_id],
        )?;

        // Update variables to point to the new package
        conn.execute(
            "UPDATE variables SET template_id = ?1 WHERE template_id = ?2",
            rusqlite::params![package_id, template_id],
        )?;
    }

    // 4. Recreate variables table with package_id instead of template_id
    conn.execute_batch(
        "
        CREATE TABLE variables_new (
            id              TEXT PRIMARY KEY,
            package_id      TEXT NOT NULL REFERENCES variable_packages(id) ON DELETE CASCADE,
            key             TEXT NOT NULL,
            label           TEXT NOT NULL,
            default_value   TEXT,
            options         TEXT,
            sort_order      INTEGER NOT NULL DEFAULT 0,
            allow_free_text INTEGER NOT NULL DEFAULT 1
        );

        INSERT INTO variables_new (id, package_id, key, label, default_value, options, sort_order, allow_free_text)
            SELECT id, template_id, key, label, default_value, options, sort_order, allow_free_text
            FROM variables;

        DROP TABLE variables;
        ALTER TABLE variables_new RENAME TO variables;

        CREATE INDEX idx_variables_package ON variables(package_id);
        ",
    )
}
