# Cadet

Cadet is a Tauri + React desktop app.

## Linux packaging notes

The Debian package intentionally stays small and does not bundle Python/CadQuery.
To generate models and use the bundled language server, you must have a usable
Python 3 environment available on the system with these packages installed:

- `cadquery`
- `ty`

If `python3` is not on your GUI app PATH, or you want to use a specific virtualenv,
set `CADET_PYTHON` to the full path of the Python interpreter.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
