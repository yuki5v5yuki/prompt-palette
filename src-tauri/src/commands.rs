use serde_json::json;
use tauri::AppHandle;

use crate::db;
use crate::models::*;

// ─── Health / Status ───

#[tauri::command]
pub fn health_check() -> Result<serde_json::Value, String> {
    Ok(json!({
        "status": "ok",
        "version": "0.1.0"
    }))
}

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

// ─── Categories ───

#[tauri::command]
pub fn list_categories(app: AppHandle) -> Result<Vec<Category>, String> {
    let conn = db::open(&app)?;
    let mut stmt = conn
        .prepare("SELECT id, name, icon, color, sort_order FROM categories ORDER BY sort_order, name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                color: row.get(3)?,
                sort_order: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_category(app: AppHandle, input: CreateCategoryInput) -> Result<Category, String> {
    let conn = db::open(&app)?;
    let id = ulid::Ulid::new().to_string();
    let sort_order = input.sort_order.unwrap_or(0);
    conn.execute(
        "INSERT INTO categories (id, name, icon, color, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, input.name, input.icon, input.color, sort_order],
    )
    .map_err(|e| e.to_string())?;
    Ok(Category {
        id,
        name: input.name,
        icon: input.icon,
        color: input.color,
        sort_order,
    })
}

#[tauri::command]
pub fn update_category(app: AppHandle, id: String, input: UpdateCategoryInput) -> Result<Category, String> {
    let conn = db::open(&app)?;
    // Fetch current
    let current: Category = conn
        .query_row(
            "SELECT id, name, icon, color, sort_order FROM categories WHERE id = ?1",
            [&id],
            |row| {
                Ok(Category {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    color: row.get(3)?,
                    sort_order: row.get(4)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    let name = input.name.unwrap_or(current.name);
    let icon = input.icon.or(current.icon);
    let color = input.color.or(current.color);
    let sort_order = input.sort_order.unwrap_or(current.sort_order);

    conn.execute(
        "UPDATE categories SET name = ?1, icon = ?2, color = ?3, sort_order = ?4 WHERE id = ?5",
        rusqlite::params![name, icon, color, sort_order, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(Category { id, name, icon, color, sort_order })
}

#[tauri::command]
pub fn delete_category(app: AppHandle, id: String) -> Result<(), String> {
    let conn = db::open(&app)?;
    conn.execute("DELETE FROM categories WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Tags ───

#[tauri::command]
pub fn list_tags(app: AppHandle) -> Result<Vec<Tag>, String> {
    let conn = db::open(&app)?;
    let mut stmt = conn
        .prepare("SELECT id, name FROM tags ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_tag(app: AppHandle, input: CreateTagInput) -> Result<Tag, String> {
    let conn = db::open(&app)?;
    let id = ulid::Ulid::new().to_string();
    conn.execute(
        "INSERT INTO tags (id, name) VALUES (?1, ?2)",
        rusqlite::params![id, input.name],
    )
    .map_err(|e| e.to_string())?;
    Ok(Tag { id, name: input.name })
}

#[tauri::command]
pub fn delete_tag(app: AppHandle, id: String) -> Result<(), String> {
    let conn = db::open(&app)?;
    conn.execute("DELETE FROM tags WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Templates ───

fn get_tags_for_template(conn: &rusqlite::Connection, template_id: &str) -> Result<Vec<Tag>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name FROM tags t
             INNER JOIN template_tags tt ON tt.tag_id = t.id
             WHERE tt.template_id = ?1
             ORDER BY t.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([template_id], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn set_template_tags(conn: &rusqlite::Connection, template_id: &str, tag_ids: &[String]) -> Result<(), String> {
    conn.execute("DELETE FROM template_tags WHERE template_id = ?1", [template_id])
        .map_err(|e| e.to_string())?;
    for tag_id in tag_ids {
        conn.execute(
            "INSERT INTO template_tags (template_id, tag_id) VALUES (?1, ?2)",
            rusqlite::params![template_id, tag_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn row_to_template(row: &rusqlite::Row) -> rusqlite::Result<Template> {
    Ok(Template {
        id: row.get(0)?,
        title: row.get(1)?,
        body: row.get(2)?,
        category_id: row.get(3)?,
        hotkey: row.get(4)?,
        use_count: row.get(5)?,
        last_used_at: row.get(6)?,
        sort_order: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

#[tauri::command]
pub fn list_templates(app: AppHandle) -> Result<Vec<TemplateWithTags>, String> {
    let conn = db::open(&app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, body, category_id, hotkey, use_count, last_used_at, sort_order, created_at, updated_at
             FROM templates
             ORDER BY sort_order, title",
        )
        .map_err(|e| e.to_string())?;
    let templates: Vec<Template> = stmt
        .query_map([], row_to_template)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut result = Vec::with_capacity(templates.len());
    for t in templates {
        let tags = get_tags_for_template(&conn, &t.id)?;
        result.push(TemplateWithTags { template: t, tags });
    }
    Ok(result)
}

#[tauri::command]
pub fn get_template(app: AppHandle, id: String) -> Result<TemplateWithTags, String> {
    let conn = db::open(&app)?;
    let template: Template = conn
        .query_row(
            "SELECT id, title, body, category_id, hotkey, use_count, last_used_at, sort_order, created_at, updated_at
             FROM templates WHERE id = ?1",
            [&id],
            row_to_template,
        )
        .map_err(|e| e.to_string())?;
    let tags = get_tags_for_template(&conn, &template.id)?;
    Ok(TemplateWithTags { template, tags })
}

#[tauri::command]
pub fn create_template(app: AppHandle, input: CreateTemplateInput) -> Result<TemplateWithTags, String> {
    let conn = db::open(&app)?;
    let id = ulid::Ulid::new().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let sort_order = input.sort_order.unwrap_or(0);

    conn.execute(
        "INSERT INTO templates (id, title, body, category_id, hotkey, use_count, last_used_at, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, NULL, ?6, ?7, ?8)",
        rusqlite::params![id, input.title, input.body, input.category_id, input.hotkey, sort_order, now, now],
    )
    .map_err(|e| e.to_string())?;

    if let Some(tag_ids) = &input.tag_ids {
        set_template_tags(&conn, &id, tag_ids)?;
    }

    let tags = get_tags_for_template(&conn, &id)?;
    Ok(TemplateWithTags {
        template: Template {
            id,
            title: input.title,
            body: input.body,
            category_id: input.category_id,
            hotkey: input.hotkey,
            use_count: 0,
            last_used_at: None,
            sort_order,
            created_at: now.clone(),
            updated_at: now,
        },
        tags,
    })
}

#[tauri::command]
pub fn update_template(app: AppHandle, id: String, input: UpdateTemplateInput) -> Result<TemplateWithTags, String> {
    let conn = db::open(&app)?;
    let current: Template = conn
        .query_row(
            "SELECT id, title, body, category_id, hotkey, use_count, last_used_at, sort_order, created_at, updated_at
             FROM templates WHERE id = ?1",
            [&id],
            row_to_template,
        )
        .map_err(|e| e.to_string())?;

    let title = input.title.unwrap_or(current.title);
    let body = input.body.unwrap_or(current.body);
    let category_id = input.category_id.or(current.category_id);
    let hotkey = input.hotkey.or(current.hotkey);
    let sort_order = input.sort_order.unwrap_or(current.sort_order);
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE templates SET title = ?1, body = ?2, category_id = ?3, hotkey = ?4, sort_order = ?5, updated_at = ?6 WHERE id = ?7",
        rusqlite::params![title, body, category_id, hotkey, sort_order, now, id],
    )
    .map_err(|e| e.to_string())?;

    if let Some(tag_ids) = &input.tag_ids {
        set_template_tags(&conn, &id, tag_ids)?;
    }

    let tags = get_tags_for_template(&conn, &id)?;
    Ok(TemplateWithTags {
        template: Template {
            id,
            title,
            body,
            category_id,
            hotkey,
            use_count: current.use_count,
            last_used_at: current.last_used_at,
            sort_order,
            created_at: current.created_at,
            updated_at: now,
        },
        tags,
    })
}

#[tauri::command]
pub fn delete_template(app: AppHandle, id: String) -> Result<(), String> {
    let conn = db::open(&app)?;
    conn.execute("DELETE FROM templates WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Increment use_count and update last_used_at for a template.
#[tauri::command]
pub fn record_template_use(app: AppHandle, id: String) -> Result<(), String> {
    let conn = db::open(&app)?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE templates SET use_count = use_count + 1, last_used_at = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// List templates sorted by frequency (for launcher initial display).
#[tauri::command]
pub fn list_templates_by_frequency(app: AppHandle) -> Result<Vec<TemplateWithTags>, String> {
    let conn = db::open(&app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, body, category_id, hotkey, use_count, last_used_at, sort_order, created_at, updated_at
             FROM templates
             ORDER BY use_count DESC, last_used_at DESC NULLS LAST",
        )
        .map_err(|e| e.to_string())?;
    let templates: Vec<Template> = stmt
        .query_map([], row_to_template)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut result = Vec::with_capacity(templates.len());
    for t in templates {
        let tags = get_tags_for_template(&conn, &t.id)?;
        result.push(TemplateWithTags { template: t, tags });
    }
    Ok(result)
}
