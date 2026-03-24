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
    pub package_ids: Option<Vec<String>>,
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
    pub package_ids: Option<Vec<String>>,
}

// --- Variable Package ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VariablePackage {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVariablePackageInput {
    pub name: String,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateVariablePackageInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
}

// --- Variable ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Variable {
    pub id: String,
    pub package_id: String,
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
    pub package_id: String,
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

// --- Export / Import Bundle ---

/// .ppb.json bundle format
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Bundle {
    pub format: String,
    pub version: String,
    pub exported_at: String,
    pub pack: BundlePack,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BundlePack {
    pub name: String,
    pub description: Option<String>,
    pub categories: Vec<BundleCategory>,
    pub tags: Vec<BundleTag>,
    pub variable_packages: Vec<BundleVariablePackage>,
    pub templates: Vec<BundleTemplate>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BundleCategory {
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BundleTag {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BundleVariablePackage {
    pub name: String,
    pub description: Option<String>,
    pub variables: Vec<BundleVariable>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BundleVariable {
    pub key: String,
    pub label: String,
    pub default_value: Option<String>,
    pub options: Option<Vec<String>>,
    pub allow_free_text: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BundleTemplate {
    pub title: String,
    pub body: String,
    pub category: Option<String>,
    pub tags: Vec<String>,
    pub variable_packages: Vec<String>,
}

/// Export request: which template IDs to export (empty = all)
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    pub template_ids: Option<Vec<String>>,
    pub pack_name: String,
    pub pack_description: Option<String>,
}

/// Import preview: shows what will be imported and any conflicts
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub pack_name: String,
    pub pack_description: Option<String>,
    pub categories: Vec<ImportPreviewItem>,
    pub tags: Vec<ImportPreviewItem>,
    pub variable_packages: Vec<ImportPreviewItem>,
    pub templates: Vec<ImportPreviewItem>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreviewItem {
    pub name: String,
    pub conflict: bool,
}

/// Import request: bundle + conflict resolution strategy
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRequest {
    pub bundle_json: String,
    pub conflict_strategy: ConflictStrategy,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ConflictStrategy {
    Skip,
    Overwrite,
    KeepBoth,
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
    pub variable_id: Option<String>,
}
