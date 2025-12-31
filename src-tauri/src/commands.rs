use std::io::Write;
use std::path::PathBuf;
use std::process::Stdio;
use tauri::Manager;

#[cfg(debug_assertions)]
fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn resolve_python() -> PathBuf {
    if let Ok(path) = std::env::var("CADET_PYTHON") {
        return PathBuf::from(path);
    }

    #[cfg(debug_assertions)]
    {
        // Dev convenience: use the repo venv if present.
        let dev = project_root().join(".venv").join("bin").join("python");
        if dev.exists() {
            return dev;
        }
    }

    let system = PathBuf::from("/usr/bin/python3");
    if system.exists() {
        return system;
    }

    PathBuf::from("python3")
}

fn resolve_wrapper(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource dir: {e}"))?
        .join("python");

    // Try to use compiled .pyc file in production
    let pyc_file = resource_dir
        .join("__pycache__")
        .join("wrapper.cpython-311.pyc");
    if cfg!(not(debug_assertions)) && pyc_file.exists() {
        return Ok(pyc_file);
    }

    // Fallback to .py file for dev or if .pyc not found
    let py_file = resource_dir.join("wrapper.py");
    if py_file.exists() {
        return Ok(py_file);
    }

    // Dev fallback.
    Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("python")
        .join("wrapper.py"))
}

#[tauri::command]
pub fn generate_model(
    app: tauri::AppHandle,
    code: String,
    format: String,
    output_path: String,
) -> Result<String, String> {
    let python = resolve_python();
    let wrapper = resolve_wrapper(&app)?;

    let mut child = std::process::Command::new(&python)
        .arg(wrapper) // run from stdin
        .arg(&format) // e.g., "stl"
        .arg(&output_path) // pass output file path as sys.argv[2]
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to start Python ({}): {e}. Install python3 + cadquery/ty, or set CADET_PYTHON to a venv python.",
                python.display()
            )
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(code.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to get output: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let path = stdout.trim();
        Ok(path.to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
