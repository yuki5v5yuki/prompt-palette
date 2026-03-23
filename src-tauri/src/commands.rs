use serde_json::json;
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::db;
use crate::interpolation;
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
