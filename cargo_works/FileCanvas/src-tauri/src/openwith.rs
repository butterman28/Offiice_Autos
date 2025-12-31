use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize, Clone)]
pub struct OpenWithApp {
    pub id: String,
    pub name: String,
    pub exec: String,
    pub icon: Option<String>,
    pub is_recommended: bool,
}

#[tauri::command]
pub fn list_open_with_apps(file_path: String) -> Vec<OpenWithApp> {
    #[cfg(target_os = "linux")]
    {
        return linux_apps(&file_path);
    }

    #[cfg(target_os = "windows")]
    {
        return windows_apps(&file_path);
    }

    #[cfg(target_os = "macos")]
    {
        return macos_apps(&file_path);
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    Vec::new()
}

#[tauri::command]
pub fn open_with_app(exec: String, file_path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // macOS needs special handling for .app bundles
        if exec.ends_with(".app") {
            Command::new("open")
                .arg("-a")
                .arg(&exec)
                .arg(&file_path)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            Command::new(&exec)
                .arg(&file_path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        // Parse the exec command
        let parts: Vec<&str> = exec.split_whitespace().collect();
        if parts.is_empty() {
            return Err("Empty exec command".to_string());
        }

        let first_cmd = parts[0];

        // Handle Flatpak apps
        if first_cmd == "flatpak" || first_cmd == "/usr/bin/flatpak" {
            // Look for the app ID in the command
            // Common patterns: "flatpak run org.videolan.VLC"
            let app_id = parts.iter()
                .skip_while(|&&p| p == "flatpak" || p == "run" || p.starts_with('-'))
                .find(|&&p| p.contains('.'))
                .ok_or_else(|| "Could not find Flatpak app ID".to_string())?;

            Command::new("flatpak")
                .arg("run")
                .arg(app_id)
                .arg(&file_path)
                .spawn()
                .map_err(|e| format!("Failed to launch Flatpak app: {}", e))?;
            return Ok(());
        }

        // Handle Snap apps
        if first_cmd == "snap" || first_cmd.starts_with("/snap/") {
            // For snap, just use the full command as-is
            Command::new("sh")
                .arg("-c")
                .arg(format!("{} \"{}\"", exec, file_path))
                .spawn()
                .map_err(|e| format!("Failed to launch Snap app: {}", e))?;
            return Ok(());
        }

        // Regular apps - try to find full path if needed
        let actual_exec = if first_cmd.starts_with('/') {
            first_cmd.to_string()
        } else {
            // Use 'which' to find the full path
            match Command::new("which").arg(first_cmd).output() {
                Ok(output) if output.status.success() => {
                    String::from_utf8_lossy(&output.stdout).trim().to_string()
                }
                _ => first_cmd.to_string()
            }
        };

        // Launch with any additional arguments from the original exec
        let mut cmd = Command::new(&actual_exec);
        
        // Add any additional args from the exec line (excluding the first command)
        for arg in parts.iter().skip(1) {
            cmd.arg(arg);
        }
        
        cmd.arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to launch {}: {}", actual_exec, e))?;
        
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new(&exec)
            .arg(&file_path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    Err("Unsupported platform".to_string())
}

// Linux implementation
#[cfg(target_os = "linux")]
fn linux_apps(file_path: &str) -> Vec<OpenWithApp> {
    use std::fs;
    use std::collections::HashSet;

    let mut apps = Vec::new();
    let mut seen_ids = HashSet::new();
    let home = std::env::var("HOME").unwrap_or_default();

    // Get file extension for filtering
    let extension = std::path::Path::new(file_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    let dirs = [
        "/usr/share/applications",
        &format!("{}/.local/share/applications", home),
        "/var/lib/flatpak/exports/share/applications",
        &format!("{}/.local/share/flatpak/exports/share/applications", home),
    ];

    for dir in dirs {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) != Some("desktop") {
                    continue;
                }

                if let Ok(content) = fs::read_to_string(&path) {
                    if let Some(app) = parse_desktop_file(&content, &path, extension) {
                        // Avoid duplicates
                        if !seen_ids.contains(&app.id) {
                            seen_ids.insert(app.id.clone());
                            apps.push(app);
                        }
                    }
                }
            }
        }
    }

    // Separate recommended and other apps, then sort each group
    let mut recommended: Vec<_> = apps.iter().filter(|a| a.is_recommended).cloned().collect();
    let mut others: Vec<_> = apps.iter().filter(|a| !a.is_recommended).cloned().collect();
    
    recommended.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    others.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    // Combine: recommended first, then others
    recommended.extend(others);
    recommended
}

#[cfg(target_os = "linux")]
fn parse_desktop_file(content: &str, path: &std::path::Path, file_ext: &str) -> Option<OpenWithApp> {
    let mut name = None;
    let mut exec = None;
    let mut icon = None;
    let mut mime_types = Vec::new();
    let mut no_display = false;

    for line in content.lines() {
        let line = line.trim();
        
        if line.starts_with("Name=") && name.is_none() {
            name = Some(line[5..].to_string());
        } else if line.starts_with("Exec=") {
            let exec_raw = line[5..].to_string();
            // Clean up exec string but preserve the base command
            let cleaned = exec_raw
                .replace("%f", "")
                .replace("%F", "")
                .replace("%u", "")
                .replace("%U", "")
                .replace("%d", "")
                .replace("%D", "")
                .replace("%n", "")
                .replace("%N", "")
                .replace("%i", "")
                .replace("%c", "")
                .replace("%k", "")
                .replace("%v", "")
                .replace("%m", "")
                .trim()
                .to_string();
            
            // Store the full exec line for special cases like Flatpak/Snap
            exec = Some(cleaned);
        } else if line.starts_with("Icon=") {
            icon = Some(line[5..].to_string());
        } else if line.starts_with("MimeType=") {
            mime_types = line[9..].split(';').map(|s| s.to_string()).collect();
        } else if line == "NoDisplay=true" {
            no_display = true;
        }
    }

    // Skip if NoDisplay is true
    if no_display {
        return None;
    }

    // Check if app can handle this file type
    let is_recommended = check_mime_match(&mime_types, file_ext);

    if let (Some(name), Some(exec)) = (name, exec) {
        Some(OpenWithApp {
            id: path.display().to_string(),
            name,
            exec,
            icon,
            is_recommended,
        })
    } else {
        None
    }
}

#[cfg(target_os = "linux")]
fn check_mime_match(mime_types: &[String], file_ext: &str) -> bool {
    if file_ext.is_empty() || mime_types.is_empty() {
        return false; // Not recommended if no extension or no MIME types
    }

    // Common extension to MIME type mappings
    let mime = match file_ext.to_lowercase().as_str() {
        "txt" | "text" => "text/plain",
        "pdf" => "application/pdf",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "mp4" => "video/mp4",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "zip" => "application/zip",
        "html" | "htm" => "text/html",
        "json" => "application/json",
        "xml" => "application/xml",
        "csv" => "text/csv",
        "js" => "application/javascript",
        "py" => "text/x-python",
        "rs" => "text/x-rust",
        "cpp" | "cc" => "text/x-c++",
        "c" => "text/x-c",
        "java" => "text/x-java",
        "md" => "text/markdown",
        _ => return false, // Unknown types - not recommended
    };

    mime_types.iter().any(|m| 
        m.starts_with(mime) || 
        m.starts_with(&format!("{}/*", mime.split('/').next().unwrap_or("")))
    )
}

// Windows implementation
#[cfg(target_os = "windows")]
fn windows_apps(file_path: &str) -> Vec<OpenWithApp> {
    use std::fs;
    use walkdir::WalkDir;

    let mut apps = Vec::new();
    
    // Get file extension for recommendations
    let extension = std::path::Path::new(file_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    // Get common program directories
    let dirs = [
        format!(
            "{}\\Microsoft\\Windows\\Start Menu\\Programs",
            std::env::var("PROGRAMDATA").unwrap_or_default()
        ),
        format!(
            "{}\\Microsoft\\Windows\\Start Menu\\Programs",
            std::env::var("APPDATA").unwrap_or_default()
        ),
    ];

    for dir in dirs {
        for entry in WalkDir::new(&dir)
            .max_depth(5)
            .into_iter()
            .flatten() 
        {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("lnk") {
                if let Some(name) = path.file_stem() {
                    let name_str = name.to_string_lossy().to_string();
                    
                    // Filter out uninstall and setup utilities
                    if name_str.to_lowercase().contains("uninstall") 
                        || name_str.to_lowercase().contains("setup") {
                        continue;
                    }

                    let is_recommended = is_windows_app_recommended(&name_str, extension);

                    apps.push(OpenWithApp {
                        id: path.display().to_string(),
                        name: name_str,
                        exec: path.display().to_string(),
                        icon: None,
                        is_recommended,
                    });
                }
            }
        }
    }

    // Separate and sort
    let mut recommended: Vec<_> = apps.iter().filter(|a| a.is_recommended).cloned().collect();
    let mut others: Vec<_> = apps.iter().filter(|a| !a.is_recommended).cloned().collect();
    
    recommended.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    others.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    recommended.extend(others);
    recommended
}

#[cfg(target_os = "windows")]
fn is_windows_app_recommended(app_name: &str, file_ext: &str) -> bool {
    let name_lower = app_name.to_lowercase();
    let ext_lower = file_ext.to_lowercase();
    
    match ext_lower.as_str() {
        "txt" | "md" | "log" => {
            name_lower.contains("notepad") || name_lower.contains("note") || 
            name_lower.contains("text") || name_lower.contains("code")
        },
        "pdf" => {
            name_lower.contains("acrobat") || name_lower.contains("pdf") || 
            name_lower.contains("reader") || name_lower.contains("edge")
        },
        "jpg" | "jpeg" | "png" | "gif" | "bmp" => {
            name_lower.contains("photo") || name_lower.contains("paint") || 
            name_lower.contains("image") || name_lower.contains("gimp")
        },
        "mp4" | "avi" | "mkv" | "mov" => {
            name_lower.contains("media") || name_lower.contains("vlc") || 
            name_lower.contains("player") || name_lower.contains("video")
        },
        "mp3" | "wav" | "flac" => {
            name_lower.contains("media") || name_lower.contains("music") || 
            name_lower.contains("audio") || name_lower.contains("groove")
        },
        "html" | "htm" => {
            name_lower.contains("chrome") || name_lower.contains("firefox") || 
            name_lower.contains("edge") || name_lower.contains("browser")
        },
        "zip" | "rar" | "7z" => {
            name_lower.contains("zip") || name_lower.contains("winrar") || 
            name_lower.contains("7-zip") || name_lower.contains("archive")
        },
        "docx" | "doc" => {
            name_lower.contains("word") || name_lower.contains("office")
        },
        "xlsx" | "xls" => {
            name_lower.contains("excel") || name_lower.contains("office")
        },
        "pptx" | "ppt" => {
            name_lower.contains("powerpoint") || name_lower.contains("office")
        },
        "py" => {
            name_lower.contains("python") || name_lower.contains("code") || name_lower.contains("pycharm")
        },
        "js" | "ts" | "json" => {
            name_lower.contains("code") || name_lower.contains("studio")
        },
        _ => false,
    }
}

// macOS implementation
#[cfg(target_os = "macos")]
fn macos_apps(file_path: &str) -> Vec<OpenWithApp> {
    use std::fs;
    use std::process::Command;

    let mut apps = Vec::new();
    let home = std::env::var("HOME").unwrap_or_default();
    
    // Get file extension for recommendations
    let extension = std::path::Path::new(file_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    let dirs = [
        "/Applications".to_string(),
        format!("{}/Applications", home),
        "/System/Applications".to_string(),
    ];

    for dir in dirs {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("app") {
                    if let Some(name) = path.file_stem() {
                        let name_str = name.to_string_lossy().to_string();
                        let is_recommended = is_macos_app_recommended(&name_str, extension);
                        
                        // Use the .app bundle path directly
                        apps.push(OpenWithApp {
                            id: path.display().to_string(),
                            name: name_str,
                            exec: path.display().to_string(), // Store .app path
                            icon: None,
                            is_recommended,
                        });
                    }
                }
            }
        }
    }

    // Separate and sort
    let mut recommended: Vec<_> = apps.iter().filter(|a| a.is_recommended).cloned().collect();
    let mut others: Vec<_> = apps.iter().filter(|a| !a.is_recommended).cloned().collect();
    
    recommended.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    others.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    recommended.extend(others);
    recommended
}

#[cfg(target_os = "macos")]
fn is_macos_app_recommended(app_name: &str, file_ext: &str) -> bool {
    let name_lower = app_name.to_lowercase();
    let ext_lower = file_ext.to_lowercase();
    
    match ext_lower.as_str() {
        "txt" | "md" | "log" => {
            name_lower.contains("textedit") || name_lower.contains("notes") || 
            name_lower.contains("text") || name_lower.contains("code")
        },
        "pdf" => {
            name_lower.contains("preview") || name_lower.contains("acrobat") || 
            name_lower.contains("pdf") || name_lower.contains("reader")
        },
        "jpg" | "jpeg" | "png" | "gif" | "bmp" => {
            name_lower.contains("preview") || name_lower.contains("photo") || 
            name_lower.contains("image") || name_lower.contains("gimp")
        },
        "mp4" | "avi" | "mkv" | "mov" => {
            name_lower.contains("quicktime") || name_lower.contains("vlc") || 
            name_lower.contains("player") || name_lower.contains("video")
        },
        "mp3" | "wav" | "flac" => {
            name_lower.contains("music") || name_lower.contains("quicktime") || 
            name_lower.contains("audio") || name_lower.contains("itunes")
        },
        "html" | "htm" => {
            name_lower.contains("safari") || name_lower.contains("chrome") || 
            name_lower.contains("firefox") || name_lower.contains("browser")
        },
        "zip" | "rar" | "7z" => {
            name_lower.contains("archive") || name_lower.contains("unarchiver") || 
            name_lower.contains("keka") || name_lower.contains("zip")
        },
        "docx" | "doc" => {
            name_lower.contains("pages") || name_lower.contains("word") || 
            name_lower.contains("office")
        },
        "xlsx" | "xls" => {
            name_lower.contains("numbers") || name_lower.contains("excel") || 
            name_lower.contains("office")
        },
        "pptx" | "ppt" => {
            name_lower.contains("keynote") || name_lower.contains("powerpoint") || 
            name_lower.contains("office")
        },
        "py" => {
            name_lower.contains("python") || name_lower.contains("code") || 
            name_lower.contains("pycharm")
        },
        "js" | "ts" | "json" => {
            name_lower.contains("code") || name_lower.contains("studio")
        },
        _ => false,
    }
}