from __future__ import annotations

import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

from bolty_switch.database import Database
from bolty_switch.models import Event
from bolty_switch.services.system_service import CREATE_NO_WINDOW, SystemService
from bolty_switch.services.windows_tasks import WindowsTaskError, WindowsTaskRunner


class ExecutionError(RuntimeError):
    pass


class HeadlessExecutor:
    """Executes allow-listed Bolty events without importing the Qt presentation layer."""

    def __init__(self, database: Database) -> None:
        self.database = database
        self._task_runner = WindowsTaskRunner()

    def execute(self, event: Event, visited: set[int] | None = None) -> str:
        visited = visited or set()
        if event.id is not None:
            if event.id in visited:
                raise ExecutionError("El guion contiene una referencia circular.")
            visited.add(event.id)
        if event.action_type == "url":
            self._open_url(event.target)
        elif event.action_type == "path":
            self._open_path(event.target)
        elif event.action_type == "task":
            self._execute_task(event.target or str(event.metadata.get("task_action", "")))
        elif event.action_type == "script":
            self._execute_script(event, visited)
        else:
            raise ExecutionError(f"Tipo de acción no compatible: {event.action_type}")
        return f"«{event.name}» se ha ejecutado."

    @staticmethod
    def _open_url(target: str) -> None:
        value = target.strip()
        if not value:
            raise ExecutionError("La página web no tiene una URL configurada.")
        if not value.lower().startswith(("http://", "https://", "mailto:")):
            value = "https://" + value
        if sys.platform == "win32":
            try:
                subprocess.Popen(["cmd", "/c", "start", "", value], creationflags=CREATE_NO_WINDOW)
                return
            except OSError:
                pass
        if not webbrowser.open(value, new=2):
            raise ExecutionError("Windows no pudo abrir la página web.")

    @staticmethod
    def _open_path(target: str) -> None:
        value = os.path.expandvars(os.path.expanduser(target.strip().strip('"')))
        if not value:
            raise ExecutionError("El evento no tiene una ruta configurada.")
        path = Path(value)
        if not path.exists():
            raise ExecutionError(f"La ruta no existe: {path}")
        if sys.platform == "win32":
            try:
                subprocess.Popen(["cmd", "/c", "start", "", str(path)], creationflags=CREATE_NO_WINDOW)
            except OSError:
                os.startfile(str(path))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
        else:
            subprocess.Popen(["xdg-open", str(path)])

    def _execute_script(self, event: Event, visited: set[int]) -> None:
        if event.id is None:
            raise ExecutionError("El guion todavía no se ha guardado.")
        steps = self.database.get_script_steps(event.id)
        if not steps:
            raise ExecutionError("El guion no contiene eventos.")
        for step in steps:
            child = self.database.get_event(step.event_id)
            if child is not None:
                self.execute(child, set(visited))
            if step.delay_ms > 0:
                time.sleep(min(step.delay_ms, 30_000) / 1000)

    def _execute_task(self, action: str) -> None:
        try:
            self._task_runner.execute(action)
        except WindowsTaskError as exc:
            raise ExecutionError(str(exc)) from exc

    @staticmethod
    def open_uri(uri: str) -> None:
        if not uri.startswith(("ms-settings:", "windowsdefender:", "ms-clock:")):
            raise ExecutionError("El URI solicitado no está permitido.")
        SystemService.open_settings(uri)
