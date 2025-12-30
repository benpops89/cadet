use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, EventId, Listener};

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn ty_path() -> PathBuf {
    project_root().join(".venv").join("bin").join("ty")
}

pub struct LSPState {
    pub child: Arc<Mutex<Option<Child>>>,
    pub stdin: Arc<Mutex<Option<Arc<Mutex<std::process::ChildStdin>>>>>,
    pub request_listener: Arc<Mutex<Option<EventId>>>,
}

impl LSPState {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            stdin: Arc::new(Mutex::new(None)),
            request_listener: Arc::new(Mutex::new(None)),
        }
    }
}

pub fn start_lsp_server(
    app_handle: AppHandle,
    state: tauri::State<LSPState>,
) -> Result<(), String> {
    let mut guard = state.child.lock().map_err(|e| e.to_string())?;

    // Check if already running
    if guard.is_some() {
        return Ok(());
    }

    let ty = ty_path();
    if !ty.exists() {
        return Err(format!("ty binary not found at {}", ty.display()));
    }

    // Start ty server
    let mut child = Command::new(&ty)
        .arg("server")
        .current_dir(project_root())
        .env("VIRTUAL_ENV", project_root().join(".venv"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start ty server: {}", e))?;

    // If the process exits immediately, surface the real stderr.
    for _ in 0..10 {
        thread::sleep(Duration::from_millis(20));
        if let Ok(Some(status)) = child.try_wait() {
            let mut stderr_output = String::new();
            if let Some(mut stderr) = child.stderr.take() {
                let _ = stderr.read_to_string(&mut stderr_output);
            }
            return Err(format!(
                "ty server exited early ({status}). stderr: {stderr_output}"
            ));
        }
    }

    let stdin = Arc::new(Mutex::new(child.stdin.take().ok_or("Failed to get stdin")?));
    if let Ok(mut stdin_state) = state.stdin.lock() {
        *stdin_state = Some(Arc::clone(&stdin));
    }
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;

    // Drain stderr so the child process never blocks on a full pipe.
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().flatten() {
                eprintln!("[ty] {line}");
            }
        });
    }

    // Spawn thread to read LSP responses
    let app_handle_clone = app_handle.clone();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);

        loop {
            // Read headers until the blank line.
            let mut content_length: Option<usize> = None;
            loop {
                let mut line = String::new();
                match reader.read_line(&mut line) {
                    Ok(0) => return, // EOF
                    Ok(_) => {
                        let line = line.trim_end_matches(['\r', '\n']);
                        if line.is_empty() {
                            break;
                        }
                        if let Some(value) = line.strip_prefix("Content-Length:") {
                            content_length = value.trim().parse::<usize>().ok();
                        }
                    }
                    Err(_) => return,
                }
            }

            let Some(content_length) = content_length else {
                continue;
            };

            let mut buffer = vec![0u8; content_length];
            if reader.read_exact(&mut buffer).is_err() {
                return;
            }

            if let Ok(content) = String::from_utf8(buffer) {
                let _ = app_handle_clone.emit("lsp-response", content);
            }
        }
    });

    // Listen for messages from frontend.
    // Important: we must keep the returned `EventHandler` alive.
    // Dropping it unregisters the callback, which drops `stdin_clone`, which closes the pipe,
    // causing `ty server` to exit immediately ("disconnected channel").
    let stdin_clone = Arc::clone(&stdin);
    let handler = app_handle.listen_any("lsp-request", move |event| {
        // Payload comes from the JS API where it is JSON-serialized.
        // Since we emit a `string` from the frontend, the payload arrives as a JSON string
        // literal (quoted/escaped). Unwrap it so `ty` receives valid JSON-RPC.
        let payload = event.payload();
        let payload = match serde_json::from_str::<String>(payload) {
            Ok(inner) => inner,
            Err(_) => payload.to_string(),
        };

        if let Ok(mut stdin_guard) = stdin_clone.lock() {
            eprintln!("[lsp] request bytes={}", payload.len());

            let content_length = payload.as_bytes().len();
            let message = format!("Content-Length: {}\r\n\r\n{}", content_length, payload);
            let _ = stdin_guard.write_all(message.as_bytes());
            let _ = stdin_guard.flush();
        }
    });

    if let Ok(mut request_listener) = state.request_listener.lock() {
        *request_listener = Some(handler);
    }

    *guard = Some(child);
    Ok(())
}

pub fn stop_lsp_server(app_handle: AppHandle, state: tauri::State<LSPState>) -> Result<(), String> {
    if let Ok(mut listener_guard) = state.request_listener.lock() {
        if let Some(handler) = listener_guard.take() {
            app_handle.unlisten(handler);
        }
    }

    if let Ok(mut stdin_guard) = state.stdin.lock() {
        *stdin_guard = None;
    }

    let mut guard = state.child.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }

    Ok(())
}
