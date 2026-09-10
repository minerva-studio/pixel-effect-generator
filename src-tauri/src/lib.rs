use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{Manager, State};
use tauri_plugin_dialog::{
    DialogExt, MessageDialogButtons, MessageDialogKind, MessageDialogResult,
};
use uuid::Uuid;

const PROJECT_MAX_BYTES: u64 = 5 * 1024 * 1024;
const MAX_RECENT_PROJECTS: usize = 8;
const RECENTS_FILE: &str = "recent-projects.json";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveRequest {
    kind: String,
    suggested_name: String,
    bytes: Vec<u8>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSaveRequest {
    suggested_name: String,
    bytes: Vec<u8>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UnsavedDialogLabels {
    title: String,
    message: String,
    save: String,
    discard: String,
    cancel: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RecentEntry {
    id: String,
    name: String,
    path: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
struct RecentProject {
    id: String,
    name: String,
}

#[derive(Default)]
struct DesktopState {
    current_project_path: Option<PathBuf>,
    dirty: bool,
    recent_entries: Vec<RecentEntry>,
    pending_opens: HashMap<String, PathBuf>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
enum SaveResult {
    Saved,
    Cancelled,
    Failed { error: String },
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
enum ProjectSaveResult {
    Saved { name: String },
    Cancelled,
    Failed { error: String },
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
enum ProjectOpenResult {
    Opened { id: String, name: String, text: String },
    Cancelled,
    Failed { error: String },
}

#[tauri::command]
async fn save_file(app: tauri::AppHandle, request: SaveRequest) -> SaveResult {
    let Some((extension, filter_name, extensions)) = save_spec(&request.kind) else {
        return SaveResult::Failed { error: "invalid save kind".into() };
    };
    let suggested_name = sanitize_suggested_name(&request.suggested_name, extension);
    let documents = match app.path().document_dir() {
        Ok(path) => path,
        Err(error) => return SaveResult::Failed { error: error.to_string() },
    };
    let dialog = app
        .dialog()
        .file()
        .set_title("Save file")
        .set_directory(documents)
        .set_file_name(suggested_name)
        .add_filter(filter_name, extensions);
    let Some(file_path) = dialog.blocking_save_file() else {
        return SaveResult::Cancelled;
    };
    let file_path = match file_path.into_path() {
        Ok(path) => enforce_extension(path, extension),
        Err(error) => return SaveResult::Failed { error: error.to_string() },
    };
    match write_atomic(&file_path, &request.bytes) {
        Ok(()) => SaveResult::Saved,
        Err(error) => SaveResult::Failed { error: error.to_string() },
    }
}

#[tauri::command]
async fn project_open(
    app: tauri::AppHandle,
    state: State<'_, Mutex<DesktopState>>,
) -> Result<ProjectOpenResult, String> {
    let documents = match app.path().document_dir() {
        Ok(path) => path,
        Err(error) => return Ok(ProjectOpenResult::Failed { error: error.to_string() }),
    };
    let dialog = app
        .dialog()
        .file()
        .set_title("Open project")
        .set_directory(documents)
        .add_filter("Project JSON", &["json"]);
    let Some(file_path) = dialog.blocking_pick_file() else {
        return Ok(ProjectOpenResult::Cancelled);
    };
    let file_path = match file_path.into_path() {
        Ok(path) => path,
        Err(error) => return Ok(ProjectOpenResult::Failed { error: error.to_string() }),
    };
    Ok(read_project_file(file_path, state))
}

#[tauri::command]
async fn project_open_recent(
    id: String,
    state: State<'_, Mutex<DesktopState>>,
) -> Result<ProjectOpenResult, String> {
    let path = {
        let state = state.lock().expect("desktop state poisoned");
        state
            .recent_entries
            .iter()
            .find(|entry| entry.id == id)
            .map(|entry| entry.path.clone())
    };
    let Some(path) = path else {
        return Ok(ProjectOpenResult::Failed { error: "recent project not found".into() });
    };
    Ok(read_project_file(path, state))
}

#[tauri::command]
fn project_confirm_open(
    app: tauri::AppHandle,
    id: String,
    state: State<'_, Mutex<DesktopState>>,
) -> Result<(), String> {
    let mut state = state.lock().map_err(|_| "desktop state poisoned".to_string())?;
    let Some(path) = state.pending_opens.remove(&id) else {
        return Ok(());
    };
    state.current_project_path = Some(path.clone());
    state.dirty = false;
    mark_recent(&mut state.recent_entries, path);
    persist_recents(&app, &state.recent_entries);
    Ok(())
}

#[tauri::command]
async fn project_save(
    app: tauri::AppHandle,
    bytes: Vec<u8>,
    state: State<'_, Mutex<DesktopState>>,
) -> Result<ProjectSaveResult, String> {
    if bytes.len() as u64 > PROJECT_MAX_BYTES {
        return Ok(ProjectSaveResult::Failed { error: "project too large".into() });
    }
    let current_path = state
        .lock()
        .expect("desktop state poisoned")
        .current_project_path
        .clone();
    let Some(path) = current_path else {
        return Ok(save_project_as(app, state, "project.json".into(), bytes).await);
    };
    match write_atomic(&path, &bytes) {
        Ok(()) => {
            state.lock().expect("desktop state poisoned").dirty = false;
            Ok(ProjectSaveResult::Saved { name: file_name(&path) })
        }
        Err(error) => Ok(ProjectSaveResult::Failed { error: error.to_string() }),
    }
}

#[tauri::command]
async fn project_save_as(
    app: tauri::AppHandle,
    request: ProjectSaveRequest,
    state: State<'_, Mutex<DesktopState>>,
) -> Result<ProjectSaveResult, String> {
    if request.bytes.len() as u64 > PROJECT_MAX_BYTES {
        return Ok(ProjectSaveResult::Failed { error: "project too large".into() });
    }
    Ok(save_project_as(app, state, request.suggested_name, request.bytes).await)
}

#[tauri::command]
fn project_recent(state: State<'_, Mutex<DesktopState>>) -> Vec<RecentProject> {
    state
        .lock()
        .expect("desktop state poisoned")
        .recent_entries
        .iter()
        .map(|entry| RecentProject { id: entry.id.clone(), name: entry.name.clone() })
        .collect()
}

#[tauri::command]
fn project_clear_recent(
    app: tauri::AppHandle,
    state: State<'_, Mutex<DesktopState>>,
) -> Result<(), String> {
    let mut state = state.lock().map_err(|_| "desktop state poisoned".to_string())?;
    state.recent_entries.clear();
    persist_recents(&app, &state.recent_entries);
    Ok(())
}

#[tauri::command]
async fn confirm_unsaved(app: tauri::AppHandle, labels: UnsavedDialogLabels) -> String {
    let save_label = labels.save.clone();
    let discard_label = labels.discard.clone();
    // Async Tauri commands run away from the main thread, so the blocking
    // native dialog does not freeze the webview event loop.
    let result = app
        .dialog()
        .message(labels.message)
        .title(labels.title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::YesNoCancelCustom(labels.save, labels.discard, labels.cancel))
        .blocking_show_with_result();
    match result {
        MessageDialogResult::Yes => "save".into(),
        MessageDialogResult::No => "discard".into(),
        MessageDialogResult::Custom(value) if value == save_label => "save".into(),
        MessageDialogResult::Custom(value) if value == discard_label => "discard".into(),
        MessageDialogResult::Custom(_) | MessageDialogResult::Ok => "cancel".into(),
        MessageDialogResult::Cancel => "cancel".into(),
    }
}

fn read_project_file(path: PathBuf, state: State<'_, Mutex<DesktopState>>) -> ProjectOpenResult {
    let metadata = match fs::metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) => return ProjectOpenResult::Failed { error: error.to_string() },
    };
    if metadata.len() > PROJECT_MAX_BYTES {
        remove_recent_path(&mut state.lock().expect("desktop state poisoned").recent_entries, &path);
        return ProjectOpenResult::Failed { error: "project too large".into() };
    }
    let text = match fs::read_to_string(&path) {
        Ok(text) => text,
        Err(error) => return ProjectOpenResult::Failed { error: error.to_string() },
    };
    let id = Uuid::new_v4().to_string();
    state
        .lock()
        .expect("desktop state poisoned")
        .pending_opens
        .insert(id.clone(), path.clone());
    ProjectOpenResult::Opened { id, name: file_name(&path), text }
}

async fn save_project_as(
    app: tauri::AppHandle,
    state: State<'_, Mutex<DesktopState>>,
    suggested_name: String,
    bytes: Vec<u8>,
) -> ProjectSaveResult {
    let documents = match app.path().document_dir() {
        Ok(path) => path,
        Err(error) => return ProjectSaveResult::Failed { error: error.to_string() },
    };
    let dialog = app
        .dialog()
        .file()
        .set_title("Save project")
        .set_directory(documents)
        .set_file_name(sanitize_suggested_name(&suggested_name, ".json"))
        .add_filter("Project JSON", &["json"]);
    let Some(file_path) = dialog.blocking_save_file() else {
        return ProjectSaveResult::Cancelled;
    };
    let path = match file_path.into_path() {
        Ok(path) => enforce_extension(path, ".json"),
        Err(error) => return ProjectSaveResult::Failed { error: error.to_string() },
    };
    if let Err(error) = write_atomic(&path, &bytes) {
        return ProjectSaveResult::Failed { error: error.to_string() };
    }
    let name = file_name(&path);
    let mut state = state.lock().expect("desktop state poisoned");
    state.current_project_path = Some(path.clone());
    state.dirty = false;
    mark_recent(&mut state.recent_entries, path);
    persist_recents(&app, &state.recent_entries);
    ProjectSaveResult::Saved { name }
}

fn save_spec(kind: &str) -> Option<(&'static str, &'static str, &'static [&'static str])> {
    match kind {
        "project-json" => Some((".json", "Project JSON", &["json"])),
        "spritesheet-png" => Some((".png", "PNG image", &["png"])),
        "gif" => Some((".gif", "GIF image", &["gif"])),
        "apng" => Some((".png", "APNG image", &["png"])),
        "frame-zip" | "unity-zip" => Some((".zip", "ZIP archive", &["zip"])),
        _ => None,
    }
}

fn sanitize_suggested_name(name: &str, extension: &str) -> String {
    let normalized = name.replace('\\', "/");
    let base = normalized.rsplit('/').next().unwrap_or_default();
    let invalid = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    let cleaned: String = base
        .chars()
        .map(|character| {
            if character.is_control() || invalid.contains(&character) { '_' } else { character }
        })
        .collect::<String>()
        .trim()
        .chars()
        .take(160)
        .collect();
    if cleaned.is_empty() {
        return format!("pixel-effect{extension}");
    }
    if cleaned.to_ascii_lowercase().ends_with(&extension.to_ascii_lowercase()) {
        cleaned
    } else {
        format!("{cleaned}{extension}")
    }
}

fn enforce_extension(path: PathBuf, extension: &str) -> PathBuf {
    if path.to_string_lossy().to_ascii_lowercase().ends_with(&extension.to_ascii_lowercase()) {
        path
    } else {
        PathBuf::from(format!("{}{}", path.to_string_lossy(), extension))
    }
}

fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let temp_path = path.with_file_name(format!(".{}.tmp-{}", file_name(path), Uuid::new_v4()));
    fs::write(&temp_path, bytes)?;
    if let Err(error) = fs::rename(&temp_path, path) {
        let _ = fs::remove_file(&temp_path);
        return Err(error);
    }
    Ok(())
}

fn mark_recent(entries: &mut Vec<RecentEntry>, path: PathBuf) {
    entries.retain(|entry| entry.path != path);
    entries.insert(0, RecentEntry { id: Uuid::new_v4().to_string(), name: file_name(&path), path });
    entries.truncate(MAX_RECENT_PROJECTS);
}

fn remove_recent_path(entries: &mut Vec<RecentEntry>, path: &Path) {
    entries.retain(|entry| entry.path != path);
}

fn persist_recents(app: &tauri::AppHandle, entries: &[RecentEntry]) {
    let Ok(directory) = app.path().app_data_dir() else { return };
    if fs::create_dir_all(&directory).is_err() { return; }
    let file = directory.join(RECENTS_FILE);
    if let Ok(text) = serde_json::to_string_pretty(entries) {
        let _ = fs::write(file, text);
    }
}

fn load_recents(app: &tauri::AppHandle, state: &mut DesktopState) {
    let Ok(directory) = app.path().app_data_dir() else { return; };
    let file = directory.join(RECENTS_FILE);
    let Ok(text) = fs::read_to_string(file) else { return; };
    let Ok(mut entries) = serde_json::from_str::<Vec<RecentEntry>>(&text) else { return; };
    entries.truncate(MAX_RECENT_PROJECTS);
    state.recent_entries = entries;
}

fn file_name(path: &Path) -> String {
    path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_else(|| "project.json".into())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(DesktopState::default()))
        .setup(|app| {
            let state = app.state::<Mutex<DesktopState>>();
            load_recents(app.handle(), &mut state.lock().expect("desktop state poisoned"));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_file,
            project_open,
            project_open_recent,
            project_confirm_open,
            project_save,
            project_save_as,
            project_recent,
            project_clear_recent,
            confirm_unsaved,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
