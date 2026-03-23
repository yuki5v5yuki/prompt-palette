use serde::{Deserialize, Serialize};

// --- Category ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategoryInput {
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryInput {
    pub name: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i32>,
}

// --- Tag ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTagInput {
    pub name: String,
}

// --- Template ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Template {
    pub id: String,
    pub title: String,
    pub body: String,
    pub category_id: Option<String>,
    pub hotkey: Option<String>,
    pub use_count: i32,
    pub last_used_at: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// Template with related tags
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TemplateWithTags {
    #[serde(flatten)]
    pub template: Template,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTemplateInput {
    pub title: String,
    pub body: String,
    pub category_id: Option<String>,
    pub hotkey: Option<String>,
    pub sort_order: Option<i32>,
    pub tag_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTemplateInput {
    pub title: Option<String>,
    pub body: Option<String>,
    pub category_id: Option<String>,
    pub hotkey: Option<String>,
    pub sort_order: Option<i32>,
    pub tag_ids: Option<Vec<String>>,
}

// --- Variable ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Variable {
    pub id: String,
    pub template_id: String,
    pub key: String,
    pub label: String,
    pub default_value: Option<String>,
    pub options: Option<Vec<String>>,
    pub sort_order: i32,
    pub allow_free_text: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVariableInput {
    pub template_id: String,
    pub key: String,
    pub label: String,
    pub default_value: Option<String>,
    pub options: Option<Vec<String>>,
    pub sort_order: Option<i32>,
    pub allow_free_text: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateVariableInput {
    pub key: Option<String>,
    pub label: Option<String>,
    pub default_value: Option<String>,
    pub options: Option<Vec<String>>,
    pub sort_order: Option<i32>,
    pub allow_free_text: Option<bool>,
}

/// Request to interpolate a template with variable values
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterpolateRequest {
    pub template_id: String,
    pub values: std::collections::HashMap<String, String>,
}

/// Schema for a variable form field sent to the frontend
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VariableFormField {
    pub key: String,
    pub label: String,
    pub default_value: Option<String>,
    pub options: Option<Vec<String>>,
    pub is_builtin: bool,
    pub allow_free_text: bool,
}
