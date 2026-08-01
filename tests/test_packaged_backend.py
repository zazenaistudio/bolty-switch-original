from __future__ import annotations

import json
from pathlib import Path

from backend.ipc_server import serialize_response

ROOT = Path(__file__).resolve().parents[1]


def test_ipc_json_is_safe_on_spanish_windows_code_page() -> None:
    payload = {"ok": True, "data": {"icon": "emoji:💾", "name": "Música española"}}
    serialized = serialize_response(payload)

    # The packaged executable previously crashed while cp1252 tried to emit 💾.
    serialized.encode("cp1252")
    assert json.loads(serialized) == payload
    assert "💾" not in serialized
    assert "\\ud83d\\udcbe" in serialized.lower()


def test_windows_launcher_hides_backend_console_and_forces_utf8() -> None:
    rust = (ROOT / "frontend/src-tauri/src/lib.rs").read_text(encoding="utf-8")
    assert "CREATE_NO_WINDOW" in rust
    assert "command.creation_flags(CREATE_NO_WINDOW);" in rust
    assert '.env("PYTHONIOENCODING", "utf-8")' in rust


def test_ipc_server_reconfigures_standard_streams_to_utf8() -> None:
    source = (ROOT / "backend/ipc_server.py").read_text(encoding="utf-8")
    assert "configure_standard_streams()" in source
    assert 'reconfigure(encoding="utf-8", errors="backslashreplace")' in source
    assert "ensure_ascii=True" in source
