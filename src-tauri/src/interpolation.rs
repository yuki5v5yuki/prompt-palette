use std::collections::HashMap;

use regex::Regex;

/// Extract all {{...}} tokens from a template body.
/// Returns a list of (full_match, token_name, optional_filter) tuples.
pub fn extract_tokens(body: &str) -> Vec<(String, String, Option<String>)> {
    let re = Regex::new(r"\{\{([#@/]?\w+)(\|[^}]+)?\}\}").unwrap();
    let mut tokens = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for cap in re.captures_iter(body) {
        let full = cap[0].to_string();
        let name = cap[1].to_string();
        let filter = cap.get(2).map(|m| m.as_str()[1..].to_string()); // strip leading |

        if seen.insert(name.clone()) {
            tokens.push((full, name, filter));
        }
    }
    tokens
}

/// Check if a token is a built-in variable (@-prefixed).
pub fn is_builtin(name: &str) -> bool {
    matches!(name, "@clipboard" | "@today" | "@now")
}

/// Resolve a built-in variable value.
pub fn resolve_builtin(name: &str, clipboard_content: &str) -> Option<String> {
    match name {
        "@clipboard" => Some(clipboard_content.to_string()),
        "@today" => {
            let now = chrono::Local::now();
            Some(now.format("%Y-%m-%d").to_string())
        }
        "@now" => {
            let now = chrono::Local::now();
            Some(now.format("%Y-%m-%d %H:%M").to_string())
        }
        _ => None,
    }
}

/// Apply a pipe filter to a value.
pub fn apply_filter(value: &str, filter: &str) -> String {
    if filter.starts_with("default:") {
        if value.is_empty() {
            // Extract the default value from default:"value"
            let default_val = filter
                .trim_start_matches("default:")
                .trim_matches('"')
                .trim_matches('\'');
            return default_val.to_string();
        }
        return value.to_string();
    }

    match filter {
        "upper" => value.to_uppercase(),
        "lower" => value.to_lowercase(),
        "trim" => value.trim().to_string(),
        _ => value.to_string(),
    }
}

/// Evaluate conditional blocks: {{#if var}}...{{/if}}
pub fn evaluate_conditionals(body: &str, values: &HashMap<String, String>) -> String {
    let re = Regex::new(r"\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{/if\}\}").unwrap();
    re.replace_all(body, |caps: &regex::Captures| {
        let var_name = &caps[1];
        let content = &caps[2];
        match values.get(var_name) {
            Some(v) if !v.is_empty() => content.to_string(),
            _ => String::new(),
        }
    })
    .to_string()
}

/// Perform full interpolation of a template body.
pub fn interpolate(
    body: &str,
    values: &HashMap<String, String>,
    clipboard_content: &str,
) -> String {
    // 1. Evaluate conditional blocks first
    let result = evaluate_conditionals(body, values);

    // 2. Replace all {{...}} tokens
    let re = Regex::new(r"\{\{([#@/]?\w+)(\|[^}]+)?\}\}").unwrap();
    re.replace_all(&result, |caps: &regex::Captures| {
        let name = &caps[1];
        let filter = caps.get(2).map(|m| &m.as_str()[1..]); // strip leading |

        // Resolve value
        let raw_value = if is_builtin(name) {
            resolve_builtin(name, clipboard_content).unwrap_or_default()
        } else {
            values.get(name).cloned().unwrap_or_default()
        };

        // Apply filter if present
        match filter {
            Some(f) => apply_filter(&raw_value, f),
            None => raw_value,
        }
    })
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_tokens() {
        let body = "Hello {{name}}, today is {{@today}}. {{name|upper}}";
        let tokens = extract_tokens(body);
        assert_eq!(tokens.len(), 2); // name appears once (deduped), @today once
        assert_eq!(tokens[0].1, "name");
        assert_eq!(tokens[1].1, "@today");
    }

    #[test]
    fn test_interpolate_basic() {
        let mut values = HashMap::new();
        values.insert("name".to_string(), "Tanaka".to_string());
        let result = interpolate("Hello {{name}}", &values, "");
        assert_eq!(result, "Hello Tanaka");
    }

    #[test]
    fn test_filter_upper() {
        let mut values = HashMap::new();
        values.insert("name".to_string(), "tanaka".to_string());
        let result = interpolate("{{name|upper}}", &values, "");
        assert_eq!(result, "TANAKA");
    }

    #[test]
    fn test_filter_default() {
        let values = HashMap::new();
        let result = interpolate("{{name|default:\"N/A\"}}", &values, "");
        assert_eq!(result, "N/A");
    }

    #[test]
    fn test_conditional() {
        let mut values = HashMap::new();
        values.insert("company".to_string(), "Acme".to_string());
        let result = interpolate("Hi{{#if company}} from {{company}}{{/if}}!", &values, "");
        assert_eq!(result, "Hi from Acme!");

        let empty_values = HashMap::new();
        let result2 = interpolate("Hi{{#if company}} from {{company}}{{/if}}!", &empty_values, "");
        assert_eq!(result2, "Hi!");
    }

    #[test]
    fn test_builtin_clipboard() {
        let values = HashMap::new();
        let result = interpolate("Pasted: {{@clipboard}}", &values, "hello world");
        assert_eq!(result, "Pasted: hello world");
    }
}
