use serde_json::{json, Value};
use std::{
    env,
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStderr, ChildStdin, ChildStdout, Command, Stdio},
    sync::{Arc, Mutex},
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    webview::Color, AppHandle, LogicalSize, Manager, PhysicalPosition, State, WebviewUrl, WebviewWindowBuilder,
};

struct BackendProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    stderr: BufReader<ChildStderr>,
}

impl Drop for BackendProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Clone, Default)]
struct BackendState(Arc<Mutex<Option<BackendProcess>>>);

fn backend_candidates(app: &AppHandle) -> (Vec<PathBuf>, Vec<PathBuf>) {
    let mut executables = Vec::new();
    let mut scripts = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        executables.push(resource_dir.join("backend").join("bolty-backend.exe"));
        scripts.push(resource_dir.join("backend").join("ipc_server.py"));
    }

    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    scripts.push(manifest.join("..").join("..").join("backend").join("ipc_server.py"));
    if let Ok(current) = env::current_dir() {
        scripts.push(current.join("..").join("backend").join("ipc_server.py"));
        scripts.push(current.join("backend").join("ipc_server.py"));
        executables.push(current.join("..").join("backend").join("bolty-backend.exe"));
    }
    (executables, scripts)
}

fn python_command(script: &Path) -> Command {
    let executable = env::var("BOLTY_PYTHON").unwrap_or_else(|_| {
        if cfg!(target_os = "windows") { "python".to_string() } else { "python3".to_string() }
    });
    let mut command = Command::new(executable);
    command.arg(script);
    command
}

fn spawn_backend(app: &AppHandle) -> Result<BackendProcess, String> {
    let (executables, scripts) = backend_candidates(app);
    let mut command = if let Some(binary) = executables.iter().find(|path| path.is_file()) {
        Command::new(binary)
    } else if let Some(script) = scripts.iter().find(|path| path.is_file()) {
        python_command(script)
    } else {
        return Err("No se encontró el backend Python. Ejecuta desde la raíz del proyecto o genera backend/bolty-backend.exe.".into());
    };

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("PYTHONUTF8", "1")
        .env("PYTHONIOENCODING", "utf-8");

    if let Ok(resource_dir) = app.path().resource_dir() {
        command.env("BOLTY_RESOURCE_DIR", resource_dir);
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if let Some(project_root) = manifest.parent().and_then(|path| path.parent()) {
        command.env("BOLTY_PROJECT_ROOT", project_root);
    }

    let mut child = command.spawn().map_err(|error| format!("No se pudo iniciar el backend: {error}"))?;
    let stdin = child.stdin.take().ok_or_else(|| "El backend no expuso stdin.".to_string())?;
    let stdout = child.stdout.take().ok_or_else(|| "El backend no expuso stdout.".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "El backend no expuso stderr.".to_string())?;
    Ok(BackendProcess { child, stdin, stdout: BufReader::new(stdout), stderr: BufReader::new(stderr) })
}

fn send_request(app: &AppHandle, state: &BackendState, request: &Value) -> Result<Value, String> {
    let serialized = serde_json::to_string(request).map_err(|error| error.to_string())?;
    let mut guard = state.0.lock().map_err(|_| "El canal IPC está bloqueado.".to_string())?;

    for attempt in 0..2 {
        let needs_start = match guard.as_mut() {
            Some(process) => process.child.try_wait().map_err(|error| error.to_string())?.is_some(),
            None => true,
        };
        if needs_start {
            *guard = Some(spawn_backend(app)?);
        }

        let process = guard.as_mut().expect("backend was initialized");
        let write_result = writeln!(process.stdin, "{serialized}").and_then(|_| process.stdin.flush());
        if let Err(error) = write_result {
            *guard = None;
            if attempt == 0 { continue; }
            return Err(format!("No se pudo enviar la solicitud al backend: {error}"));
        }

        let mut line = String::new();
        match process.stdout.read_line(&mut line) {
            Ok(0) => {
                let mut details = String::new();
                let _ = process.stderr.read_to_string(&mut details);
                let detail = details.trim();
                *guard = None;
                if attempt == 0 { continue; }
                if detail.is_empty() {
                    return Err("El backend se cerró sin responder.".into());
                }
                return Err(format!("El backend se cerró sin responder: {detail}"));
            }
            Ok(_) => return serde_json::from_str::<Value>(line.trim()).map_err(|error| format!("Respuesta JSON inválida del backend: {error}")),
            Err(error) => {
                *guard = None;
                if attempt == 0 { continue; }
                return Err(format!("No se pudo leer la respuesta del backend: {error}"));
            }
        }
    }
    Err("No se pudo restablecer el canal IPC.".into())
}

#[tauri::command]
async fn backend_request(app: AppHandle, state: State<'_, BackendState>, mut request: Value) -> Result<Value, Value> {
    if request.get("command").and_then(Value::as_str) == Some("update_settings") {
        if let (Some(payload), Ok(executable)) = (
            request.get_mut("payload").and_then(Value::as_object_mut),
            env::current_exe(),
        ) {
            payload.insert(
                "app_executable".to_string(),
                Value::String(executable.to_string_lossy().into_owned()),
            );
        }
    }
    let app_for_worker = app.clone();
    let state_for_worker = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || send_request(&app_for_worker, &state_for_worker, &request))
        .await
        .map_err(|error| json!({ "code": "IPC_WORKER_ERROR", "message": error.to_string() }))?
        .map_err(|message| json!({ "code": "BACKEND_START_ERROR", "message": message }))
}


#[tauri::command]
fn close_window(app: AppHandle, run_in_background: bool) -> Result<(), String> {
    if run_in_background {
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "No se encontró la ventana principal.".to_string())?;
        window.hide().map_err(|error| error.to_string())
    } else {
        app.exit(0);
        Ok(())
    }
}

fn reveal_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn widget_definition(kind: &str) -> Result<(&'static str, f64, f64), String> {
    match kind {
        "command" => Ok(("command-widget", 760.0, 100.0)),
        "microphone" => Ok(("microphone-widget", 128.0, 128.0)),
        _ => Err("Tipo de widget desconocido.".to_string()),
    }
}

#[tauri::command]
async fn show_widget(app: AppHandle, kind: String) -> Result<(), String> {
    let (label, width, height) = widget_definition(&kind)?;
    if let Some(window) = app.get_webview_window(label) {
        window.show().map_err(|error| error.to_string())?;
        let _ = window.set_size(LogicalSize::new(width, height));
        let _ = window.set_always_on_top(true);
        let _ = window.set_focus();
        return Ok(());
    }

    let url = WebviewUrl::App(format!("index.html?widget={kind}").into());
    WebviewWindowBuilder::new(&app, label, url)
        .title(if kind == "command" { "Bolty · Comandos" } else { "Bolty · Micrófono" })
        .inner_size(width, height)
        .min_inner_size(width, height)
        .max_inner_size(width, if kind == "command" { 470.0 } else { height })
        .decorations(false)
        .transparent(true)
        .background_color(Color(0, 0, 0, 0))
        .initialization_script(r#"(() => { const widget = new URLSearchParams(window.location.search).get('widget'); if (widget) { document.documentElement.dataset.widget = widget; document.documentElement.style.background = 'transparent'; } })();"#)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .shadow(false)
        .center()
        .build()
        .map_err(|error| format!("No se pudo crear el widget: {error}"))?;
    Ok(())
}

#[tauri::command]
fn resize_widget(app: AppHandle, kind: String, expanded: bool) -> Result<(), String> {
    let (label, width, collapsed_height) = widget_definition(&kind)?;
    let target_height = if kind == "command" && expanded { 452.0 } else { collapsed_height };
    if let Some(window) = app.get_webview_window(label) {
        let position = window.outer_position().map_err(|error| error.to_string())?;
        let size = window.outer_size().map_err(|error| error.to_string())?;
        let bottom = position.y + size.height as i32;
        window.set_size(LogicalSize::new(width, target_height)).map_err(|error| error.to_string())?;
        let scale = window.scale_factor().map_err(|error| error.to_string())?;
        let target_physical_height = (target_height * scale).round() as i32;
        window.set_position(PhysicalPosition::new(position.x, bottom - target_physical_height)).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_widget(app: AppHandle, kind: String) -> Result<(), String> {
    let (label, _, _) = widget_definition(&kind)?;
    if let Some(window) = app.get_webview_window(label) {
        window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    reveal_main_window(&app);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(BackendState::default())
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "Mostrar Bolty Switch", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
            let mut tray = TrayIconBuilder::new()
                .tooltip("Bolty Switch")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => reveal_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        reveal_main_window(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![backend_request, close_window, show_widget, resize_widget, hide_widget, show_main_window])
        .run(tauri::generate_context!())
        .expect("error while running Bolty Switch");
}
