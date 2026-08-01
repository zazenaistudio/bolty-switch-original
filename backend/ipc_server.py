from __future__ import annotations

import json
import logging
import sys
import traceback
from dataclasses import asdict
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from bolty_switch.constants import APP_VERSION, DANGEROUS_TASKS  # noqa: E402
from bolty_switch.database import Database, DuplicateCommandError  # noqa: E402
from bolty_switch.models import Event, ScriptStep  # noqa: E402
from bolty_switch.services.command_engine import CommandEngine  # noqa: E402
from bolty_switch.services.settings_service import SettingsService  # noqa: E402
from bolty_switch.services.system_service import SystemService  # noqa: E402
from backend.headless_executor import ExecutionError, HeadlessExecutor  # noqa: E402
from backend.voice_engine import VoiceEngine  # noqa: E402

def configure_standard_streams() -> None:
    """Use UTF-8 for the line-delimited JSON channel on every Windows locale."""
    for name in ("stdin", "stdout", "stderr"):
        stream = getattr(sys, name, None)
        reconfigure = getattr(stream, "reconfigure", None)
        if not callable(reconfigure):
            continue
        try:
            reconfigure(encoding="utf-8", errors="backslashreplace")
        except (OSError, ValueError):
            pass


configure_standard_streams()
logging.basicConfig(level=logging.WARNING, stream=sys.stderr)


def event_from_json(value: dict[str, Any]) -> Event:
    return Event(
        id=int(value["id"]) if value.get("id") is not None else None,
        category=str(value.get("category", "Aplicaciones")),
        name=str(value.get("name", "")),
        icon=str(value.get("icon", "emoji:⚡")),
        action_type=str(value.get("action_type", "path")),
        target=str(value.get("target", "")),
        description=str(value.get("description", "")),
        folder=str(value.get("folder", "")),
        commands=[str(item) for item in value.get("commands", []) if str(item).strip()],
        metadata=dict(value.get("metadata") or {}),
        is_builtin=bool(value.get("is_builtin", False)),
        created_at=str(value.get("created_at", "")),
        updated_at=str(value.get("updated_at", "")),
    )


class Router:
    def __init__(self) -> None:
        self.database = Database()
        self.settings = SettingsService()
        self.commands = CommandEngine(self.database)
        self.executor = HeadlessExecutor(self.database)
        self.system = SystemService()
        self.voice = VoiceEngine()

    def event_payload(self, event: Event) -> dict[str, Any]:
        value = asdict(event)
        if event.action_type == "script" and event.id is not None:
            value["script_steps"] = [asdict(step) for step in self.database.get_script_steps(event.id)]
        return value

    def dispatch(self, command: str, payload: dict[str, Any]) -> dict[str, Any]:
        handler: Callable[[dict[str, Any]], dict[str, Any]] | None = getattr(self, f"cmd_{command}", None)
        if handler is None:
            raise ValueError(f"Comando IPC desconocido: {command}")
        return handler(payload)

    def cmd_bootstrap(self, payload: dict[str, Any]) -> dict[str, Any]:
        del payload
        events = self.database.list_events()
        return {
            "version": APP_VERSION,
            "categories": self.database.category_counts(),
            "events": [self.event_payload(event) for event in sorted(events, key=lambda item: item.updated_at, reverse=True)[:12]],
            "pinned_events": [self.event_payload(event) for event in self.database.list_pinned_events()],
            "settings": self.settings.as_dict(),
        }

    def cmd_list_events(self, payload: dict[str, Any]) -> dict[str, Any]:
        category = str(payload.get("category") or "").strip() or None
        query = str(payload.get("query") or "").strip().casefold()
        events = self.database.list_events(category)
        if query:
            events = [event for event in events if query in f"{event.name} {event.folder} {event.description} {' '.join(event.commands)}".casefold()]
        return {"events": [self.event_payload(event) for event in events]}

    def cmd_list_folders(self, payload: dict[str, Any]) -> dict[str, Any]:
        category = str(payload.get("category") or "").strip() or None
        return {"folders": self.database.list_folders(category)}

    def cmd_create_folder(self, payload: dict[str, Any]) -> dict[str, Any]:
        category = str(payload.get("category") or "").strip()
        name = str(payload.get("name") or "").strip()
        return {"folder": self.database.create_folder(category, name)}

    def cmd_rename_folder(self, payload: dict[str, Any]) -> dict[str, Any]:
        category = str(payload.get("category") or "").strip()
        old_name = str(payload.get("old_name") or "").strip()
        new_name = str(payload.get("new_name") or "").strip()
        return {"folder": self.database.rename_folder(category, old_name, new_name)}

    def cmd_delete_folder(self, payload: dict[str, Any]) -> dict[str, Any]:
        category = str(payload.get("category") or "").strip()
        name = str(payload.get("name") or "").strip()
        return self.database.delete_folder(category, name)

    def cmd_list_pinned_events(self, payload: dict[str, Any]) -> dict[str, Any]:
        del payload
        return {"events": [self.event_payload(event) for event in self.database.list_pinned_events()]}

    def cmd_pin_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        event_id = int(payload.get("event_id", 0))
        event = self.database.pin_event(event_id)
        return {"event": self.event_payload(event)}

    def cmd_unpin_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        event_id = int(payload.get("event_id", 0))
        return {"unpinned": self.database.unpin_event(event_id)}

    def cmd_search(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"suggestions": self.commands.suggestions(str(payload.get("query", "")), limit=8)}

    def cmd_save_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        value = payload.get("event")
        if not isinstance(value, dict):
            raise ValueError("El evento recibido no es válido.")
        steps_value = value.get("script_steps") or []
        steps: list[ScriptStep] = []
        if isinstance(steps_value, list):
            for position, step in enumerate(steps_value):
                if not isinstance(step, dict):
                    continue
                event_id = int(step.get("event_id", 0))
                if event_id > 0:
                    steps.append(ScriptStep(event_id=event_id, position=position, delay_ms=max(0, int(step.get("delay_ms", 350)))))
        event = event_from_json(value)
        if event.action_type == "script" and not steps:
            raise ValueError("El guion debe contener al menos un evento.")
        saved = self.database.save_event(event, script_steps=steps)
        self.commands.refresh()
        return {"event": self.event_payload(saved)}

    def cmd_delete_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        event_id = int(payload.get("event_id", 0))
        if not self.database.get_event(event_id):
            raise ValueError("El evento ya no existe.")
        self.database.delete_event(event_id)
        self.commands.refresh()
        return {"deleted": True}

    def cmd_execute_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        event = self.database.get_event(int(payload.get("event_id", 0)))
        if event is None:
            raise ValueError("El evento no existe.")
        confirmed = bool(payload.get("confirmed", False))
        action = event.target or str(event.metadata.get("task_action", ""))
        if event.action_type == "task" and action in DANGEROUS_TASKS and self.settings.get("confirm_dangerous_actions", True) and not confirmed:
            return {"executed": False, "event": self.event_payload(event), "message": "La acción requiere confirmación.", "requires_confirmation": True}
        message = self.executor.execute(event)
        return {"executed": True, "event": self.event_payload(event), "message": message}

    def cmd_execute_text(self, payload: dict[str, Any]) -> dict[str, Any]:
        text = str(payload.get("text", "")).strip()
        if text.startswith("open-uri:"):
            self.executor.open_uri(text.removeprefix("open-uri:"))
            return {"executed": True, "message": "Configuración abierta."}
        match = self.commands.match(text)
        if match.event is None:
            raise ValueError("Bolty no encontró un evento suficientemente parecido.")
        return self.cmd_execute_event({"event_id": match.event.id, "confirmed": payload.get("confirmed", False)})

    def cmd_get_system_status(self, payload: dict[str, Any]) -> dict[str, Any]:
        del payload
        return {"statuses": [asdict(item) for item in self.system.collect()]}

    def cmd_get_settings(self, payload: dict[str, Any]) -> dict[str, Any]:
        del payload
        return {"settings": self.settings.as_dict()}

    def cmd_update_settings(self, payload: dict[str, Any]) -> dict[str, Any]:
        patch = payload.get("patch")
        if not isinstance(patch, dict):
            raise ValueError("Los ajustes recibidos no son válidos.")
        allowed = {
            "sounds_enabled", "sound_volume", "hands_free", "language", "run_in_background",
            "start_with_windows", "confirm_dangerous_actions", "wake_word", "reduced_effects", "compact_density",
            "sidebar_collapsed", "background_music_enabled", "background_music_volume", "cosmic_theme",
        }
        clean = {key: value for key, value in patch.items() if key in allowed}
        if "start_with_windows" in clean:
            executable = str(payload.get("app_executable") or "").strip() or None
            success, message = self.settings.set_autostart(bool(clean.pop("start_with_windows")), executable=executable)
            if not success and sys.platform == "win32":
                raise ValueError(message)
        if clean:
            self.settings.update(clean)
        return {"settings": self.settings.as_dict()}

    def cmd_voice_status(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.voice.status(str(payload.get("language") or self.settings.get("language", "es")))

    def cmd_voice_start(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.voice.start(
            language=str(payload.get("language") or self.settings.get("language", "es")),
            hands_free=bool(payload.get("hands_free", False)),
            wake_word=str(payload.get("wake_word") or self.settings.get("wake_word", "Bolty")),
        )

    def cmd_install_voice_model(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.voice.install_model(str(payload.get("language") or self.settings.get("language", "es")))

    def cmd_voice_poll(self, payload: dict[str, Any]) -> dict[str, Any]:
        del payload
        return self.voice.poll()

    def cmd_voice_stop(self, payload: dict[str, Any]) -> dict[str, Any]:
        del payload
        return self.voice.stop()

    def cmd_open_voice_model_folder(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.voice.open_model_folder(str(payload.get("language") or self.settings.get("language", "es")))

    def cmd_restore_default_tasks(self, payload: dict[str, Any]) -> dict[str, Any]:
        del payload
        self.database.restore_default_tasks()
        self.commands.refresh()
        return {"restored": True}


def error_code(exc: Exception) -> str:
    if isinstance(exc, DuplicateCommandError):
        return "DUPLICATE_COMMAND"
    if isinstance(exc, ExecutionError):
        return "EXECUTION_ERROR"
    if isinstance(exc, ValueError):
        return "VALIDATION_ERROR"
    return "INTERNAL_ERROR"


def handle_request(router: Router, raw: str) -> dict[str, Any]:
    request_id = "unknown"
    try:
        request = json.loads(raw)
        if not isinstance(request, dict):
            raise ValueError("La solicitud IPC debe ser un objeto JSON.")
        request_id = str(request.get("id", "unknown"))
        command = str(request.get("command", ""))
        payload = request.get("payload") or {}
        if not isinstance(payload, dict):
            raise ValueError("El payload debe ser un objeto JSON.")
        data = router.dispatch(command, payload)
        return {"id": request_id, "ok": True, "data": data}
    except Exception as exc:
        logging.error("IPC failure: %s\n%s", exc, traceback.format_exc())
        return {"id": request_id, "ok": False, "error": {"code": error_code(exc), "message": str(exc) or "Error interno del backend."}}


def serialize_response(response: dict[str, Any]) -> str:
    # ASCII-only JSON prevents Windows code pages such as cp1252 from
    # terminating the frozen backend when an event contains emoji or Unicode.
    return json.dumps(response, ensure_ascii=True, separators=(",", ":"))


def main() -> int:
    router = Router()
    try:
        for raw in sys.stdin:
            raw = raw.strip()
            if not raw:
                continue
            response = handle_request(router, raw)
            sys.stdout.write(serialize_response(response) + "\n")
            sys.stdout.flush()
    finally:
        router.voice.stop(wait=0.5)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
