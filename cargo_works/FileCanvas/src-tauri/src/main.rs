mod openwith;
use openwith::{list_open_with_apps, open_with_app};
use std::fs;
use std::path::PathBuf;
use std::path::Path;


use serde::{Deserialize, Serialize};
use tauri::async_runtime::spawn_blocking;
use tauri::Runtime;
use tauri_plugin_dialog::DialogExt;
// Import the shell plugin trait to enable .shell() on app_handle
use tauri_plugin_shell::ShellExt; 
use std::process::Command;
use tauri::Manager;

// --- Data Structures ---

#[derive(Debug, Serialize, Deserialize)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileItem>>,
    pub mtime: u64,
    pub ctime: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileProperties {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,      // recursive if directory
    pub mtime: u64,
    pub ctime: u64,
    pub children: Option<Vec<FileItem>>,
}


// --- Helpers ---

fn read_dir_shallow(path: &PathBuf) -> Vec<FileItem> {
    let mut items = Vec::new();

    let entries = match fs::read_dir(path) {
        Ok(e) => e,
        Err(_) => return items,
    };

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }

        let entry_path = entry.path();

        let metadata = match fs::metadata(&entry_path) {
            Ok(m) => m,
            Err(_) => continue, 
        };

        let mtime = metadata
            .modified()
            .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64)
            .unwrap_or(0);

        let ctime = metadata
            .created()
            .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64)
            .unwrap_or(mtime); 

        items.push(FileItem {
            name,
            path: entry_path.to_string_lossy().to_string(),
            is_directory: metadata.is_dir(),
            children: None,
            mtime,
            ctime,
        });
    }

    items.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    items
}

// --- Commands ---

#[tauri::command]
async fn pick_folder<R: Runtime>(
    app_handle: tauri::AppHandle<R>,
) -> Result<Vec<String>, String> {
    // Note: use blocking_pick_folders if you aren't in a closure, 
    // but typically for v2 plugins we use pick_folders(callback) or the sync version
    let result = app_handle.dialog().file().blocking_pick_folders();

    match result {
        Some(paths) => Ok(paths
            .into_iter()
            .filter_map(|fp| fp.into_path().ok())
            .filter_map(|pb| pb.to_str().map(|s| s.to_owned()))
            .collect()),
        None => Ok(vec![]),
    }
}

#[tauri::command]
async fn read_folder(folder_path: String) -> Result<Vec<FileItem>, String> {
    let path = PathBuf::from(folder_path);
    spawn_blocking(move || Ok(read_dir_shallow(&path)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn create_folder(parent_path: String, folder_name: String) -> Result<FileItem, String> {
    let new_path = PathBuf::from(&parent_path).join(&folder_name);
    fs::create_dir(&new_path).map_err(|e| e.to_string())?;

    let metadata = fs::metadata(&new_path).map_err(|e| e.to_string())?;
    let mtime = metadata
        .modified()
        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64)
        .unwrap_or(0);
    let ctime = metadata
        .created()
        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64)
        .unwrap_or(mtime);

    Ok(FileItem {
        name: folder_name,
        path: new_path.to_string_lossy().to_string(),
        is_directory: true,
        children: None,
        mtime,
        ctime,
    })
}

#[tauri::command]
async fn create_file(parent_path: String, file_name: String) -> Result<FileItem, String> {
    let new_path = PathBuf::from(&parent_path).join(&file_name);
    fs::File::create(&new_path).map_err(|e| e.to_string())?;

    let metadata = fs::metadata(&new_path).map_err(|e| e.to_string())?;
    let mtime = metadata
        .modified()
        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64)
        .unwrap_or(0);
    let ctime = metadata
        .created()
        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64)
        .unwrap_or(mtime);

    Ok(FileItem {
        name: file_name,
        path: new_path.to_string_lossy().to_string(),
        is_directory: false,
        children: None,
        mtime,
        ctime,
    })
}

#[tauri::command]
async fn move_file(src: String, dest_folder: String) -> Result<String, String> {
    let src_path = PathBuf::from(src);
    let file_name = src_path.file_name().ok_or("Invalid source path")?;
    let dest_path = PathBuf::from(dest_folder).join(file_name);

    fs::rename(&src_path, &dest_path)
        .map_err(|e| e.to_string())?;

    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn move_folder(src: String, dest_folder: String) -> Result<String, String> {
    let src_path = PathBuf::from(&src);
    if !src_path.is_dir() {
        return Err("Source is not a folder".into());
    }
    let folder_name = src_path.file_name().ok_or("Invalid source path")?;
    let dest_path = PathBuf::from(&dest_folder).join(folder_name);

    fs::rename(&src_path, &dest_path).map_err(|e| e.to_string())?;
    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn copy_file(src: String, dest_folder: String) -> Result<String, String> {
    let src_path = PathBuf::from(src);
    let file_name = src_path.file_name().ok_or("Invalid source path")?;
    let dest_path = PathBuf::from(dest_folder).join(file_name);

    fs::copy(&src_path, &dest_path).map_err(|e| e.to_string())?;
    Ok(dest_path.to_string_lossy().to_string())
}

fn copy_dir_recursive(src: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if path.is_dir() {
            copy_dir_recursive(&path, &dest_path)?;
        } else {
            fs::copy(&path, &dest_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn copy_folder(src: String, dest_folder: String) -> Result<String, String> {
    let src_path = PathBuf::from(&src);
    if !src_path.is_dir() {
        return Err("Source is not a folder".into());
    }
    let folder_name = src_path.file_name().ok_or("Invalid source path")?;
    let dest_path = PathBuf::from(&dest_folder).join(folder_name);

    copy_dir_recursive(&src_path, &dest_path)?;
    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn delete_item(path_str: String) -> Result<(), String> {
    let path = PathBuf::from(path_str);
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;

    if metadata.is_dir() {
        fs::remove_dir_all(&path)
    } else {
        fs::remove_file(&path)
    }
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn is_dir(path: String) -> Result<bool, String> {
    std::fs::metadata(&path)
        .map(|m| m.is_dir())
        .map_err(|e| e.to_string())
}

// --- Open with default app (Fixed for Tauri v2) ---
#[tauri::command]
async fn open_file<R: Runtime>(app_handle: tauri::AppHandle<R>, path: String) -> Result<(), String> {
    // Use tauri_plugin_shell
    app_handle.shell().open(&path, None).map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_with<R: Runtime>(_app_handle: tauri::AppHandle<R>, path: String) -> Result<(), String> {
    let file_path = std::path::PathBuf::from(&path);
    
    if !file_path.exists() {
        return Err("File does not exist".into());
    }

    #[cfg(windows)]
    {
        Command::new("cmd")
            .args(&["/C", "rundll32.exe", "shell32.dll,OpenAs_RunDLL", &file_path.to_string_lossy()])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "tell application \"Finder\" to open POSIX file \"{}\" using (choose application)",
            file_path.to_string_lossy()
        );
        Command::new("osascript")
            .args(&["-e", &script])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try 'gio' first (GNOME/Standard), then 'kioclient5' (KDE), then fallback to 'mimeopen'
        let gio_status = Command::new("gio")
            .args(&["open", "--launch", &file_path.to_string_lossy()])
            .spawn();

        if gio_status.is_err() {
             Command::new("kioclient5")
                .args(&["exec", &file_path.to_string_lossy()])
                .spawn()
                .map_err(|_| "Could not find a suitable 'Open With' handler (gio or kioclient5).".to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn rename_item(old_path: String, new_name: String) -> Result<String, String> {
    let old_path = PathBuf::from(old_path);
    let parent = old_path.parent().ok_or("Invalid path")?;
    let new_path = parent.join(new_name);

    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

fn dir_size(path: &Path) -> u64 {
    let mut size = 0;

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    size += dir_size(&entry.path());
                } else {
                    size += metadata.len();
                }
            }
        }
    }

    size
}


#[tauri::command]
async fn get_file_info(path: String) -> Result<FileProperties, String> {
    let path = PathBuf::from(&path);
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;

    let name = path
        .file_name()
        .ok_or("Invalid file path")?
        .to_string_lossy()
        .to_string();

    let mtime = metadata
        .modified()
        .map(|t| t.duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64)
        .unwrap_or(0);

    let ctime = metadata
        .created()
        .map(|t| t.duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64)
        .unwrap_or(mtime);

    let size = if metadata.is_dir() {
        dir_size(&path)
    } else {
        metadata.len()
    };

    Ok(FileProperties{
        name,
        path: path.to_string_lossy().to_string(),
        is_directory: metadata.is_dir(),
        size,
        children: None,
        mtime,
        ctime,
    })
}



fn main() {
    // Prevent GTK/Tauri initialization in headless CI
    if std::env::var("CI").is_ok() {
        println!("CI environment detected — skipping Tauri runtime startup");
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            rename_item,
            get_file_info,
            pick_folder,
            read_folder,
            create_folder,
            create_file,
            move_file,
            move_folder,
            copy_folder,
            copy_file,
            delete_item,
            open_file,
            open_with,
            list_open_with_apps,
            open_with_app,
            is_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
