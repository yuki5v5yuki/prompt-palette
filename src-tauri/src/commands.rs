use serde_json::json;
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::db;
use crate::interpolation;
use crate::models::*;

// ─── Health / Status / Onboarding ───

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

/// Check if onboarding (sample data) has already been loaded.
#[tauri::command]
pub fn is_onboarded(app: AppHandle) -> Result<bool, String> {
    let conn = db::open(&app)?;
    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM templates", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    Ok(count > 0)
}

/// Insert sample templates for first-time users.
#[tauri::command]
pub fn seed_sample_data(app: AppHandle) -> Result<(), String> {
    let conn = db::open(&app)?;
    let now = chrono::Utc::now().to_rfc3339();

    // Sample category
    let cat_id = ulid::Ulid::new().to_string();
    conn.execute(
        "INSERT INTO categories (id, name, icon, color, sort_order) VALUES (?1, ?2, ?3, ?4, 0)",
        rusqlite::params![cat_id, "Sample", "📋", "#ffd700"],
    ).map_err(|e| e.to_string())?;

    // Sample tag
    let tag_id = ulid::Ulid::new().to_string();
    conn.execute(
        "INSERT INTO tags (id, name) VALUES (?1, ?2)",
        rusqlite::params![tag_id, "sample"],
    ).map_err(|e| e.to_string())?;

    // Sample variable package
    let pkg_id = ulid::Ulid::new().to_string();
    conn.execute(
        "INSERT INTO variable_packages (id, name, description, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, 0, ?4, ?5)",
        rusqlite::params![pkg_id, "Contact Info", "Basic contact information", now, now],
    ).map_err(|e| e.to_string())?;

    // Variables for package
    let var_name_id = ulid::Ulid::new().to_string();
    conn.execute(
        "INSERT INTO variables (id, package_id, key, label, default_value, options, sort_order, allow_free_text)
         VALUES (?1, ?2, 'name', 'Name', NULL, NULL, 0, 1)",
        rusqlite::params![var_name_id, pkg_id],
    ).map_err(|e| e.to_string())?;

    let var_suffix_id = ulid::Ulid::new().to_string();
    conn.execute(
        "INSERT INTO variables (id, package_id, key, label, default_value, options, sort_order, allow_free_text)
         VALUES (?1, ?2, 'suffix', 'Suffix', '様', ?3, 1, 1)",
        rusqlite::params![var_suffix_id, pkg_id, serde_json::to_string(&vec!["様", "さん", "御中"]).unwrap()],
    ).map_err(|e| e.to_string())?;

    // Sample templates
    let samples = vec![
        ("Greeting (挨拶)", "{{name}}{{suffix}}\n\nお世話になっております。\n{{@today}}"),
        ("Thank You (お礼)", "{{name}}{{suffix}}\n\nご対応ありがとうございます。\n引き続きよろしくお願いいたします。"),
        ("Quick Note (メモ)", "【メモ】{{@now}}\n\n"),
    ];

    for (i, (title, body)) in samples.iter().enumerate() {
        let tmpl_id = ulid::Ulid::new().to_string();
        conn.execute(
            "INSERT INTO templates (id, title, body, category_id, hotkey, use_count, last_used_at, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, NULL, 0, NULL, ?5, ?6, ?7)",
            rusqlite::params![tmpl_id, title, body, cat_id, i as i32, now, now],
        ).map_err(|e| e.to_string())?;

        // Link tag
        conn.execute(
            "INSERT INTO template_tags (template_id, tag_id) VALUES (?1, ?2)",
            rusqlite::params![tmpl_id, tag_id],
        ).map_err(|e| e.to_string())?;

        // Link variable package (only for templates that use variables)
        if body.contains("{{name}}") {
            conn.execute(
                "INSERT INTO template_variable_packages (template_id, package_id) VALUES (?1, ?2)",
                rusqlite::params![tmpl_id, pkg_id],
            ).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
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

// ─── Variable Packages ───

#[tauri::command]
pub fn list_variable_packages(app: AppHandle) -> Result<Vec<VariablePackage>, String> {
    let conn = db::open(&app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, sort_order, created_at, updated_at
             FROM variable_packages ORDER BY sort_order, name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(VariablePackage {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                sort_order: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_variable_package(app: AppHandle, input: CreateVariablePackageInput) -> Result<VariablePackage, String> {
    let conn = db::open(&app)?;
    let id = ulid::Ulid::new().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let sort_order = input.sort_order.unwrap_or(0);
    conn.execute(
        "INSERT INTO variable_packages (id, name, description, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![id, input.name, input.description, sort_order, now, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(VariablePackage {
        id,
        name: input.name,
        description: input.description,
        sort_order,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_variable_package(app: AppHandle, id: String, input: UpdateVariablePackageInput) -> Result<VariablePackage, String> {
    let conn = db::open(&app)?;
    let current: VariablePackage = conn
        .query_row(
            "SELECT id, name, description, sort_order, created_at, updated_at FROM variable_packages WHERE id = ?1",
            [&id],
            |row| {
                Ok(VariablePackage {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    sort_order: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    let name = input.name.unwrap_or(current.name);
    let description = input.description.or(current.description);
    let sort_order = input.sort_order.unwrap_or(current.sort_order);
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE variable_packages SET name = ?1, description = ?2, sort_order = ?3, updated_at = ?4 WHERE id = ?5",
        rusqlite::params![name, description, sort_order, now, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(VariablePackage {
        id,
        name,
        description,
        sort_order,
        created_at: current.created_at,
        updated_at: now,
    })
}

#[tauri::command]
pub fn delete_variable_package(app: AppHandle, id: String) -> Result<(), String> {
    let conn = db::open(&app)?;
    conn.execute("DELETE FROM variable_packages WHERE id = ?1", [&id])
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

fn get_packages_for_template(conn: &rusqlite::Connection, template_id: &str) -> Result<Vec<VariablePackage>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT vp.id, vp.name, vp.description, vp.sort_order, vp.created_at, vp.updated_at
             FROM variable_packages vp
             INNER JOIN template_variable_packages tvp ON tvp.package_id = vp.id
             WHERE tvp.template_id = ?1
             ORDER BY vp.sort_order, vp.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([template_id], |row| {
            Ok(VariablePackage {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                sort_order: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_template_packages(app: AppHandle, template_id: String) -> Result<Vec<VariablePackage>, String> {
    let conn = db::open(&app)?;
    get_packages_for_template(&conn, &template_id)
}

fn set_template_packages(conn: &rusqlite::Connection, template_id: &str, package_ids: &[String]) -> Result<(), String> {
    conn.execute("DELETE FROM template_variable_packages WHERE template_id = ?1", [template_id])
        .map_err(|e| e.to_string())?;
    for package_id in package_ids {
        conn.execute(
            "INSERT INTO template_variable_packages (template_id, package_id) VALUES (?1, ?2)",
            rusqlite::params![template_id, package_id],
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
    if let Some(package_ids) = &input.package_ids {
        set_template_packages(&conn, &id, package_ids)?;
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
    let category_id = match &input.category_id {
        Some(id) if id.is_empty() => None,
        Some(id) => Some(id.clone()),
        None => current.category_id,
    };
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
    if let Some(package_ids) = &input.package_ids {
        set_template_packages(&conn, &id, package_ids)?;
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

// ─── Variables ───

fn row_to_variable(row: &rusqlite::Row) -> rusqlite::Result<Variable> {
    let options_json: Option<String> = row.get(5)?;
    let options: Option<Vec<String>> = options_json
        .and_then(|s| serde_json::from_str(&s).ok());
    let allow_free_text: i32 = row.get(7)?;
    Ok(Variable {
        id: row.get(0)?,
        package_id: row.get(1)?,
        key: row.get(2)?,
        label: row.get(3)?,
        default_value: row.get(4)?,
        options,
        sort_order: row.get(6)?,
        allow_free_text: allow_free_text != 0,
    })
}

#[tauri::command]
pub fn list_variables(app: AppHandle, package_id: String) -> Result<Vec<Variable>, String> {
    let conn = db::open(&app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, package_id, key, label, default_value, options, sort_order, allow_free_text
             FROM variables
             WHERE package_id = ?1
             ORDER BY sort_order, key",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&package_id], row_to_variable)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_variable(app: AppHandle, input: CreateVariableInput) -> Result<Variable, String> {
    let conn = db::open(&app)?;
    let id = ulid::Ulid::new().to_string();
    let sort_order = input.sort_order.unwrap_or(0);
    let allow_free_text = input.allow_free_text.unwrap_or(true);
    let options_json = input.options.as_ref().map(|o| serde_json::to_string(o).unwrap());

    conn.execute(
        "INSERT INTO variables (id, package_id, key, label, default_value, options, sort_order, allow_free_text)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![id, input.package_id, input.key, input.label, input.default_value, options_json, sort_order, allow_free_text as i32],
    )
    .map_err(|e| e.to_string())?;

    Ok(Variable {
        id,
        package_id: input.package_id,
        key: input.key,
        label: input.label,
        default_value: input.default_value,
        options: input.options,
        sort_order,
        allow_free_text,
    })
}

#[tauri::command]
pub fn update_variable(app: AppHandle, id: String, input: UpdateVariableInput) -> Result<Variable, String> {
    let conn = db::open(&app)?;
    let current: Variable = conn
        .query_row(
            "SELECT id, package_id, key, label, default_value, options, sort_order, allow_free_text FROM variables WHERE id = ?1",
            [&id],
            row_to_variable,
        )
        .map_err(|e| e.to_string())?;

    let key = input.key.unwrap_or(current.key);
    let label = input.label.unwrap_or(current.label);
    let default_value = input.default_value.or(current.default_value);
    let options = input.options.or(current.options);
    let sort_order = input.sort_order.unwrap_or(current.sort_order);
    let allow_free_text = input.allow_free_text.unwrap_or(current.allow_free_text);
    let options_json = options.as_ref().map(|o| serde_json::to_string(o).unwrap());

    conn.execute(
        "UPDATE variables SET key = ?1, label = ?2, default_value = ?3, options = ?4, sort_order = ?5, allow_free_text = ?6 WHERE id = ?7",
        rusqlite::params![key, label, default_value, options_json, sort_order, allow_free_text as i32, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(Variable {
        id,
        package_id: current.package_id,
        key,
        label,
        default_value,
        options,
        sort_order,
        allow_free_text,
    })
}

#[tauri::command]
pub fn delete_variable(app: AppHandle, id: String) -> Result<(), String> {
    let conn = db::open(&app)?;
    conn.execute("DELETE FROM variables WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Append a new option value to a variable's options list (for input history).
#[tauri::command]
pub fn append_variable_option(app: AppHandle, variable_id: String, value: String) -> Result<(), String> {
    let conn = db::open(&app)?;
    let current_options: Option<String> = conn
        .query_row(
            "SELECT options FROM variables WHERE id = ?1",
            [&variable_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut opts: Vec<String> = current_options
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    if !value.is_empty() && !opts.contains(&value) {
        opts.push(value);
        let json = serde_json::to_string(&opts).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE variables SET options = ?1 WHERE id = ?2",
            rusqlite::params![json, variable_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Get the form schema for a template (variables needed for input).
#[tauri::command]
pub fn get_template_form_schema(app: AppHandle, template_id: String) -> Result<Vec<VariableFormField>, String> {
    let conn = db::open(&app)?;

    let body: String = conn
        .query_row(
            "SELECT body FROM templates WHERE id = ?1",
            [&template_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let tokens = interpolation::extract_tokens(&body);

    // Get all variables from packages linked to this template
    let variables = {
        let mut stmt = conn
            .prepare(
                "SELECT v.id, v.package_id, v.key, v.label, v.default_value, v.options, v.sort_order, v.allow_free_text
                 FROM variables v
                 INNER JOIN template_variable_packages tvp ON tvp.package_id = v.package_id
                 WHERE tvp.template_id = ?1
                 ORDER BY v.sort_order",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([&template_id], row_to_variable)
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<Variable>, _>>().map_err(|e| e.to_string())?
    };

    let mut fields = Vec::new();
    let mut seen_keys = std::collections::HashSet::new();
    for (_full, name, _filter) in &tokens {
        if interpolation::is_builtin(name) || name.starts_with('#') || name.starts_with('/') {
            continue;
        }
        if !seen_keys.insert(name.clone()) {
            continue;
        }
        if let Some(var) = variables.iter().find(|v| v.key == *name) {
            fields.push(VariableFormField {
                key: var.key.clone(),
                label: var.label.clone(),
                default_value: var.default_value.clone(),
                options: var.options.clone(),
                is_builtin: false,
                allow_free_text: var.allow_free_text,
                variable_id: Some(var.id.clone()),
            });
        } else {
            fields.push(VariableFormField {
                key: name.clone(),
                label: name.clone(),
                default_value: None,
                options: None,
                is_builtin: false,
                allow_free_text: true,
                variable_id: None,
            });
        }
    }
    Ok(fields)
}

/// Interpolate a template with provided variable values.
#[tauri::command]
pub fn interpolate_template(app: AppHandle, request: InterpolateRequest) -> Result<String, String> {
    let conn = db::open(&app)?;

    let body: String = conn
        .query_row(
            "SELECT body FROM templates WHERE id = ?1",
            [&request.template_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let clipboard_content = app
        .clipboard()
        .read_text()
        .unwrap_or_default();

    let result = interpolation::interpolate(&body, &request.values, &clipboard_content);
    Ok(result)
}

// ─── Export / Import ───

/// Export selected templates (or all) as a .ppb.json bundle.
#[tauri::command]
pub fn export_bundle(app: AppHandle, request: ExportRequest) -> Result<Bundle, String> {
    let conn = db::open(&app)?;

    // Determine which templates to export
    let templates: Vec<Template> = if let Some(ids) = &request.template_ids {
        if ids.is_empty() {
            return Err("No template IDs provided".into());
        }
        let placeholders: Vec<String> = ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
        let sql = format!(
            "SELECT id, title, body, category_id, hotkey, use_count, last_used_at, sort_order, created_at, updated_at
             FROM templates WHERE id IN ({})",
            placeholders.join(",")
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let params: Vec<&dyn rusqlite::types::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
        let rows = stmt.query_map(params.as_slice(), row_to_template).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, title, body, category_id, hotkey, use_count, last_used_at, sort_order, created_at, updated_at FROM templates ORDER BY sort_order, title"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_template).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    // Collect related data
    let mut category_names = std::collections::HashSet::new();
    let mut tag_names = std::collections::HashSet::new();
    let mut package_names = std::collections::HashSet::new();

    let mut bundle_templates = Vec::new();
    for t in &templates {
        // Get category name
        let cat_name: Option<String> = if let Some(cat_id) = &t.category_id {
            conn.query_row("SELECT name FROM categories WHERE id = ?1", [cat_id], |row| row.get(0)).ok()
        } else {
            None
        };
        if let Some(ref name) = cat_name {
            category_names.insert(name.clone());
        }

        // Get tag names
        let tags = get_tags_for_template(&conn, &t.id)?;
        let tag_name_list: Vec<String> = tags.iter().map(|tg| {
            tag_names.insert(tg.name.clone());
            tg.name.clone()
        }).collect();

        // Get variable package names
        let packages = get_packages_for_template(&conn, &t.id)?;
        let pkg_name_list: Vec<String> = packages.iter().map(|p| {
            package_names.insert(p.name.clone());
            p.name.clone()
        }).collect();

        bundle_templates.push(BundleTemplate {
            title: t.title.clone(),
            body: t.body.clone(),
            category: cat_name,
            tags: tag_name_list,
            variable_packages: pkg_name_list,
        });
    }

    // Build bundle categories
    let bundle_categories: Vec<BundleCategory> = {
        let mut result = Vec::new();
        for name in &category_names {
            if let Ok(cat) = conn.query_row(
                "SELECT icon, color FROM categories WHERE name = ?1", [name],
                |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, Option<String>>(1)?))
            ) {
                result.push(BundleCategory { name: name.clone(), icon: cat.0, color: cat.1 });
            }
        }
        result
    };

    // Build bundle tags
    let bundle_tags: Vec<BundleTag> = tag_names.into_iter().map(|name| BundleTag { name }).collect();

    // Build bundle variable packages (with variables)
    let bundle_packages: Vec<BundleVariablePackage> = {
        let mut result = Vec::new();
        for name in &package_names {
            if let Ok((pkg_id, desc)) = conn.query_row(
                "SELECT id, description FROM variable_packages WHERE name = ?1", [name],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
            ) {
                let mut stmt = conn.prepare(
                    "SELECT id, package_id, key, label, default_value, options, sort_order, allow_free_text
                     FROM variables WHERE package_id = ?1 ORDER BY sort_order"
                ).map_err(|e| e.to_string())?;
                let vars: Vec<Variable> = stmt.query_map([&pkg_id], row_to_variable)
                    .map_err(|e| e.to_string())?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| e.to_string())?;
                let bundle_vars: Vec<BundleVariable> = vars.into_iter().map(|v| BundleVariable {
                    key: v.key,
                    label: v.label,
                    default_value: v.default_value,
                    options: v.options,
                    allow_free_text: v.allow_free_text,
                }).collect();
                result.push(BundleVariablePackage { name: name.clone(), description: desc, variables: bundle_vars });
            }
        }
        result
    };

    Ok(Bundle {
        format: "prompt-palette-bundle".into(),
        version: "1.0.0".into(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        pack: BundlePack {
            name: request.pack_name,
            description: request.pack_description,
            categories: bundle_categories,
            tags: bundle_tags,
            variable_packages: bundle_packages,
            templates: bundle_templates,
        },
    })
}

/// Preview what an import will do (detect conflicts).
#[tauri::command]
pub fn preview_import(app: AppHandle, bundle_json: String) -> Result<ImportPreview, String> {
    let bundle: Bundle = serde_json::from_str(&bundle_json).map_err(|e| format!("Invalid bundle JSON: {}", e))?;
    if bundle.format != "prompt-palette-bundle" {
        return Err("Invalid bundle format".into());
    }
    let conn = db::open(&app)?;

    let categories: Vec<ImportPreviewItem> = bundle.pack.categories.iter().map(|c| {
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) FROM categories WHERE name = ?1", [&c.name], |row| row.get::<_, i32>(0)
        ).unwrap_or(0) > 0;
        ImportPreviewItem { name: c.name.clone(), conflict: exists }
    }).collect();

    let tags: Vec<ImportPreviewItem> = bundle.pack.tags.iter().map(|t| {
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) FROM tags WHERE name = ?1", [&t.name], |row| row.get::<_, i32>(0)
        ).unwrap_or(0) > 0;
        ImportPreviewItem { name: t.name.clone(), conflict: exists }
    }).collect();

    let variable_packages: Vec<ImportPreviewItem> = bundle.pack.variable_packages.iter().map(|p| {
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) FROM variable_packages WHERE name = ?1", [&p.name], |row| row.get::<_, i32>(0)
        ).unwrap_or(0) > 0;
        ImportPreviewItem { name: p.name.clone(), conflict: exists }
    }).collect();

    let templates: Vec<ImportPreviewItem> = bundle.pack.templates.iter().map(|t| {
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) FROM templates WHERE title = ?1", [&t.title], |row| row.get::<_, i32>(0)
        ).unwrap_or(0) > 0;
        ImportPreviewItem { name: t.title.clone(), conflict: exists }
    }).collect();

    Ok(ImportPreview {
        pack_name: bundle.pack.name,
        pack_description: bundle.pack.description,
        categories,
        tags,
        variable_packages,
        templates,
    })
}

/// Import a bundle with conflict resolution.
#[tauri::command]
pub fn import_bundle(app: AppHandle, request: ImportRequest) -> Result<serde_json::Value, String> {
    let bundle: Bundle = serde_json::from_str(&request.bundle_json)
        .map_err(|e| format!("Invalid bundle JSON: {}", e))?;
    if bundle.format != "prompt-palette-bundle" {
        return Err("Invalid bundle format".into());
    }
    let conn = db::open(&app)?;
    let strategy = &request.conflict_strategy;

    let mut imported_categories = 0u32;
    let mut imported_tags = 0u32;
    let mut imported_packages = 0u32;
    let mut imported_templates = 0u32;
    let mut skipped = 0u32;

    // 1. Import categories
    let mut category_name_to_id: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    // Load existing categories
    {
        let mut stmt = conn.prepare("SELECT id, name FROM categories").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(1)?, row.get::<_, String>(0)?)))
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (name, id) = row.map_err(|e| e.to_string())?;
            category_name_to_id.insert(name, id);
        }
    }
    for cat in &bundle.pack.categories {
        if let Some(existing_id) = category_name_to_id.get(&cat.name) {
            match strategy {
                ConflictStrategy::Skip => { skipped += 1; }
                ConflictStrategy::Overwrite => {
                    conn.execute(
                        "UPDATE categories SET icon = ?1, color = ?2 WHERE id = ?3",
                        rusqlite::params![cat.icon, cat.color, existing_id],
                    ).map_err(|e| e.to_string())?;
                    imported_categories += 1;
                }
                ConflictStrategy::KeepBoth => {
                    let new_name = format!("{} (imported)", cat.name);
                    let id = ulid::Ulid::new().to_string();
                    conn.execute(
                        "INSERT INTO categories (id, name, icon, color, sort_order) VALUES (?1, ?2, ?3, ?4, 0)",
                        rusqlite::params![id, new_name, cat.icon, cat.color],
                    ).map_err(|e| e.to_string())?;
                    category_name_to_id.insert(new_name, id);
                    imported_categories += 1;
                }
            }
        } else {
            let id = ulid::Ulid::new().to_string();
            conn.execute(
                "INSERT INTO categories (id, name, icon, color, sort_order) VALUES (?1, ?2, ?3, ?4, 0)",
                rusqlite::params![id, cat.name, cat.icon, cat.color],
            ).map_err(|e| e.to_string())?;
            category_name_to_id.insert(cat.name.clone(), id);
            imported_categories += 1;
        }
    }

    // 2. Import tags
    let mut tag_name_to_id: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare("SELECT id, name FROM tags").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(1)?, row.get::<_, String>(0)?)))
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (name, id) = row.map_err(|e| e.to_string())?;
            tag_name_to_id.insert(name, id);
        }
    }
    for tag in &bundle.pack.tags {
        if tag_name_to_id.contains_key(&tag.name) {
            if *strategy != ConflictStrategy::KeepBoth {
                skipped += 1;
            } else {
                let new_name = format!("{} (imported)", tag.name);
                let id = ulid::Ulid::new().to_string();
                conn.execute("INSERT INTO tags (id, name) VALUES (?1, ?2)", rusqlite::params![id, new_name])
                    .map_err(|e| e.to_string())?;
                tag_name_to_id.insert(new_name, id);
                imported_tags += 1;
            }
        } else {
            let id = ulid::Ulid::new().to_string();
            conn.execute("INSERT INTO tags (id, name) VALUES (?1, ?2)", rusqlite::params![id, tag.name])
                .map_err(|e| e.to_string())?;
            tag_name_to_id.insert(tag.name.clone(), id);
            imported_tags += 1;
        }
    }

    // 3. Import variable packages
    let mut package_name_to_id: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare("SELECT id, name FROM variable_packages").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(1)?, row.get::<_, String>(0)?)))
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (name, id) = row.map_err(|e| e.to_string())?;
            package_name_to_id.insert(name, id);
        }
    }
    for pkg in &bundle.pack.variable_packages {
        let now = chrono::Utc::now().to_rfc3339();
        if let Some(existing_id) = package_name_to_id.get(&pkg.name).cloned() {
            match strategy {
                ConflictStrategy::Skip => { skipped += 1; }
                ConflictStrategy::Overwrite => {
                    conn.execute(
                        "UPDATE variable_packages SET description = ?1, updated_at = ?2 WHERE id = ?3",
                        rusqlite::params![pkg.description, now, existing_id],
                    ).map_err(|e| e.to_string())?;
                    // Delete old variables and re-insert
                    conn.execute("DELETE FROM variables WHERE package_id = ?1", [&existing_id])
                        .map_err(|e| e.to_string())?;
                    for (i, v) in pkg.variables.iter().enumerate() {
                        let vid = ulid::Ulid::new().to_string();
                        let opts_json = v.options.as_ref().map(|o| serde_json::to_string(o).unwrap());
                        conn.execute(
                            "INSERT INTO variables (id, package_id, key, label, default_value, options, sort_order, allow_free_text)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                            rusqlite::params![vid, existing_id, v.key, v.label, v.default_value, opts_json, i as i32, v.allow_free_text as i32],
                        ).map_err(|e| e.to_string())?;
                    }
                    imported_packages += 1;
                }
                ConflictStrategy::KeepBoth => {
                    let new_name = format!("{} (imported)", pkg.name);
                    let id = ulid::Ulid::new().to_string();
                    conn.execute(
                        "INSERT INTO variable_packages (id, name, description, sort_order, created_at, updated_at)
                         VALUES (?1, ?2, ?3, 0, ?4, ?5)",
                        rusqlite::params![id, new_name, pkg.description, now, now],
                    ).map_err(|e| e.to_string())?;
                    for (i, v) in pkg.variables.iter().enumerate() {
                        let vid = ulid::Ulid::new().to_string();
                        let opts_json = v.options.as_ref().map(|o| serde_json::to_string(o).unwrap());
                        conn.execute(
                            "INSERT INTO variables (id, package_id, key, label, default_value, options, sort_order, allow_free_text)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                            rusqlite::params![vid, id, v.key, v.label, v.default_value, opts_json, i as i32, v.allow_free_text as i32],
                        ).map_err(|e| e.to_string())?;
                    }
                    package_name_to_id.insert(new_name, id);
                    imported_packages += 1;
                }
            }
        } else {
            let id = ulid::Ulid::new().to_string();
            conn.execute(
                "INSERT INTO variable_packages (id, name, description, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, 0, ?4, ?5)",
                rusqlite::params![id, pkg.name, pkg.description, now, now],
            ).map_err(|e| e.to_string())?;
            for (i, v) in pkg.variables.iter().enumerate() {
                let vid = ulid::Ulid::new().to_string();
                let opts_json = v.options.as_ref().map(|o| serde_json::to_string(o).unwrap());
                conn.execute(
                    "INSERT INTO variables (id, package_id, key, label, default_value, options, sort_order, allow_free_text)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    rusqlite::params![vid, id, v.key, v.label, v.default_value, opts_json, i as i32, v.allow_free_text as i32],
                ).map_err(|e| e.to_string())?;
            }
            package_name_to_id.insert(pkg.name.clone(), id);
            imported_packages += 1;
        }
    }

    // 4. Import templates
    for tmpl in &bundle.pack.templates {
        let now = chrono::Utc::now().to_rfc3339();
        let existing: Option<String> = conn.query_row(
            "SELECT id FROM templates WHERE title = ?1", [&tmpl.title], |row| row.get(0)
        ).ok();

        let template_id: String;

        if let Some(existing_id) = existing {
            match strategy {
                ConflictStrategy::Skip => { skipped += 1; continue; }
                ConflictStrategy::Overwrite => {
                    let cat_id = tmpl.category.as_ref().and_then(|name| category_name_to_id.get(name));
                    conn.execute(
                        "UPDATE templates SET body = ?1, category_id = ?2, updated_at = ?3 WHERE id = ?4",
                        rusqlite::params![tmpl.body, cat_id, now, existing_id],
                    ).map_err(|e| e.to_string())?;
                    template_id = existing_id;
                }
                ConflictStrategy::KeepBoth => {
                    let new_title = format!("{} (imported)", tmpl.title);
                    let cat_id = tmpl.category.as_ref().and_then(|name| category_name_to_id.get(name));
                    template_id = ulid::Ulid::new().to_string();
                    conn.execute(
                        "INSERT INTO templates (id, title, body, category_id, hotkey, use_count, last_used_at, sort_order, created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, NULL, 0, NULL, 0, ?5, ?6)",
                        rusqlite::params![template_id, new_title, tmpl.body, cat_id, now, now],
                    ).map_err(|e| e.to_string())?;
                }
            }
        } else {
            let cat_id = tmpl.category.as_ref().and_then(|name| category_name_to_id.get(name));
            template_id = ulid::Ulid::new().to_string();
            conn.execute(
                "INSERT INTO templates (id, title, body, category_id, hotkey, use_count, last_used_at, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, NULL, 0, NULL, 0, ?5, ?6)",
                rusqlite::params![template_id, tmpl.title, tmpl.body, cat_id, now, now],
            ).map_err(|e| e.to_string())?;
        }

        // Set tags
        conn.execute("DELETE FROM template_tags WHERE template_id = ?1", [&template_id])
            .map_err(|e| e.to_string())?;
        for tag_name in &tmpl.tags {
            if let Some(tag_id) = tag_name_to_id.get(tag_name) {
                conn.execute(
                    "INSERT OR IGNORE INTO template_tags (template_id, tag_id) VALUES (?1, ?2)",
                    rusqlite::params![template_id, tag_id],
                ).map_err(|e| e.to_string())?;
            }
        }

        // Set variable packages
        conn.execute("DELETE FROM template_variable_packages WHERE template_id = ?1", [&template_id])
            .map_err(|e| e.to_string())?;
        for pkg_name in &tmpl.variable_packages {
            if let Some(pkg_id) = package_name_to_id.get(pkg_name) {
                conn.execute(
                    "INSERT OR IGNORE INTO template_variable_packages (template_id, package_id) VALUES (?1, ?2)",
                    rusqlite::params![template_id, pkg_id],
                ).map_err(|e| e.to_string())?;
            }
        }
        imported_templates += 1;
    }

    Ok(json!({
        "importedCategories": imported_categories,
        "importedTags": imported_tags,
        "importedPackages": imported_packages,
        "importedTemplates": imported_templates,
        "skipped": skipped,
    }))
}

// ─── Launcher Toggle ───

pub(crate) fn toggle_launcher(app: &tauri::AppHandle) {
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

// ─── Settings ───

#[tauri::command]
pub fn get_setting(app: AppHandle, key: String) -> Result<Option<String>, String> {
    let conn = db::open(&app)?;
    let result = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            rusqlite::params![key],
            |row| row.get(0),
        )
        .ok();
    Ok(result)
}

#[tauri::command]
pub fn set_global_hotkey(app: AppHandle, shortcut: String) -> Result<(), String> {
    // Validate the new shortcut
    let new_shortcut: Shortcut = shortcut
        .parse()
        .map_err(|_| format!("Invalid shortcut: {}", shortcut))?;

    // Read the old shortcut from DB and unregister it
    let conn = db::open(&app)?;
    let old_shortcut_str: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'global_hotkey'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "ctrl+space".to_string());

    if let Ok(old_shortcut) = old_shortcut_str.parse::<Shortcut>() {
        let _ = app.global_shortcut().unregister(old_shortcut);
    }

    // Register the new shortcut
    let handle = app.clone();
    app.global_shortcut()
        .on_shortcut(new_shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                toggle_launcher(&handle);
            }
        })
        .map_err(|e| format!("Failed to register shortcut: {}", e))?;

    // Persist to DB
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('global_hotkey', ?1)
         ON CONFLICT(key) DO UPDATE SET value = ?1",
        rusqlite::params![shortcut],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
