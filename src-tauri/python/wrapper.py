import sys
from uuid import uuid4
import importlib.util
from pathlib import Path
from cadquery.occ_impl.exporters import export, ExportTypes


def run_user_code(code: str, export_type: str, data_dir: str):
    user_file = Path(data_dir).joinpath("code.py")
    _ = user_file.write_text(code)

    spec = importlib.util.spec_from_file_location("user_code", str(user_file))
    if spec is None or spec.loader is None:
        print("Failed to load module specification from file", file=sys.stderr)
        sys.exit(1)

    user_module = importlib.util.module_from_spec(spec)

    try:
        spec.loader.exec_module(user_module)
    except Exception as e:
        print(f"Error running user code: {e}", file=sys.stderr)
        sys.exit(1)

    if not hasattr(user_module, "result"):
        print("Expected variable `result` not found in user code", file=sys.stderr)
        sys.exit(1)

    export_extension = getattr(ExportTypes, export_type.upper(), None)
    if export_extension is None:
        print(f"Invalid export type: {export_type}", file=sys.stderr)
        sys.exit(1)

    filename = Path(data_dir).joinpath(f"model_output_{uuid4().hex}.{export_type}")
    try:
        export(
            user_module.result,
            str(filename),
            export_extension,
        )
    except Exception as e:
        print(f"Failed to export: {e}", file=sys.stderr)
        sys.exit(1)

    # Output the path so Rust/frontend can read it
    print(filename)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python wrapper.py <export_type> <data_dir>", file=sys.stderr)
        sys.exit(1)

    export_type = sys.argv[1]
    data_dir = sys.argv[2]
    code = sys.stdin.read()

    run_user_code(code, export_type, data_dir)
