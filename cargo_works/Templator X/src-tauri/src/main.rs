use std::{fs, path::Path, collections::HashMap};
use calamine::{open_workbook, Reader, Xlsx, XlsxError};
use csv::ReaderBuilder;
use docx_template::docx::DocxTemplate;
use base64::Engine;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}
// Helper function to sanitize filenames
fn sanitize_filename(input: &str) -> String {
    let mut result = String::new();
    for c in input.chars() {
        match c {
            // Allow alphanumeric, spaces, hyphens, underscores, periods
            'a'..='z' | 'A'..='Z' | '0'..='9' | ' ' | '-' | '_' | '.' => {
                result.push(c);
            }
            // Replace other characters with underscore
            _ => {
                if !result.ends_with('_') {
                    result.push('_');
                }
            }
        }
    }
    // Trim leading/trailing spaces and underscores
    result.trim_matches(|c| c == ' ' || c == '_').to_string()
}
#[tauri::command]
fn generate_docs(
    template_path: String,
    data_path: String,
    output_dir: String,
    name_column: Option<String>, // ← NEW PARAMETER
) -> Result<(), String> {
    // Ensure output directory exists
    if !Path::new(&output_dir).exists() {
        fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    }

    let rows = read_rows(&data_path)?;

    for (index, row) in rows.iter().enumerate() {
        // Build output file path
        let file_name = if let Some(col_name) = &name_column {
            if let Some(value) = row.get(col_name) {
                let clean_value = sanitize_filename(value);
                if !clean_value.is_empty() {
                    format!("{}.docx", clean_value)
                } else {
                    format!("output_{}.docx", index + 1)
                }
            } else {
                format!("output_{}.docx", index + 1)
            }
        } else {
            format!("output_{}.docx", index + 1)
        };

        let output_path = Path::new(&output_dir).join(file_name);

        // Create template instance
        let mut template = DocxTemplate::new();

        // Add replacements for each field
        for (k, v) in row.iter() {
            template.add_text_replacement(&format!("{{{{{}}}}}", k), v);
        }

        // Process the template and write the output file
        template
            .process_template(&template_path, &output_path.to_string_lossy())
            .map_err(|e| format!("Template process failed: {}", e))?;
    }

    Ok(())
}


// --- Helper functions (unchanged) ---

fn read_rows(path: &str) -> Result<Vec<HashMap<String, String>>, String> {
    let path_obj = Path::new(path);
    let extension = path_obj.extension().and_then(|s| s.to_str()).unwrap_or("");

    match extension {
        "csv" => read_csv(path),
        "xlsx" => read_xlsx(path),
        _ => Err(format!("Unsupported extension: .{}", extension)),
    }
}

fn read_csv(path: &str) -> Result<Vec<HashMap<String, String>>, String> {
    let mut rdr = ReaderBuilder::new()
        .flexible(true)
        .from_path(path)
        .map_err(|e| e.to_string())?;

    let headers: Vec<String> = rdr.headers()
        .map_err(|e| e.to_string())?
        .iter()
        .map(|h| h.trim().to_string())
        .collect();

    let mut rows = vec![];
    for result in rdr.records() {
        if let Ok(reg) = result {
            let mut map = HashMap::new();
            for (i, value) in reg.iter().enumerate() {
                if let Some(header) = headers.get(i) {
                    map.insert(header.clone(), value.trim().to_string());
                }
            }
            rows.push(map);
        }
    }
    Ok(rows)
}

fn read_xlsx(path: &str) -> Result<Vec<HashMap<String, String>>, String> {
    let mut workbook: Xlsx<_> = open_workbook(path).map_err(|e: XlsxError| e.to_string())?;
    let sheet = workbook.worksheet_range_at(0)
        .ok_or("Worksheet not found")?
        .map_err(|e| e.to_string())?;

    let mut rows = vec![];
    let mut rows_iter = sheet.rows();
    
    let headers: Vec<String> = match rows_iter.next() {
        Some(row) => row.iter().map(|c| c.to_string().trim().to_string()).collect(),
        None => return Ok(rows),
    };

    for row in rows_iter {
        let mut map = HashMap::new();
        for (i, cell) in row.iter().enumerate() {
            if let Some(header) = headers.get(i) {
                map.insert(header.clone(), cell.to_string());
            }
        }
        rows.push(map);
    }
    Ok(rows)
}

#[tauri::command]
fn read_file_bytes(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path)
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
    
    // Encode as base64 string (safe for JSON)
    let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(base64)
}

#[tauri::command]
async fn list_directory(path: String) -> Result<Vec<String>, String> {
    use std::fs;
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory '{}': {}", path, e))?;

    let mut file_names = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            if let Some(name) = entry.file_name().to_str() {
                file_names.push(name.to_string());
            }
        }
    }
    
    // Sort alphabetically
    file_names.sort();
    Ok(file_names)
}
#[tauri::command]
async fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete file '{}': {}", path, e))
}
// --- Main entry point ---

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            generate_docs,
            list_directory,
            read_file_bytes,
            delete_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
