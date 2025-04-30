use std::io::Write;
use std::process::Stdio;

const PYTHON_PATH: &str = "../.venv/bin/python";

#[tauri::command]
pub fn generate_model(code: String, format: String, output_path: String) -> Result<String, String> {
    let mut child = std::process::Command::new(PYTHON_PATH)
        .arg("python/wrapper.py") // run from stdin
        .arg(&format) // e.g., "stl"
        .arg(&output_path) // pass output file path as sys.argv[2]
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start Python: {}", e))?;

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
