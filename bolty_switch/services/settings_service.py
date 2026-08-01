from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from ..paths import settings_path


DEFAULT_SETTINGS: dict[str, Any] = {
    "sounds_enabled": True,
    "sound_volume": 0.72,
    "hands_free": False,
    "language": "es",
    "run_in_background": True,
    "start_with_windows": False,
    "confirm_dangerous_actions": True,
    "wake_word": "Bolty",
    "window_width": 1500,
    "window_height": 900,
    "first_run": True,
    "reduced_effects": False,
    "compact_density": False,
    "sidebar_collapsed": False,
    "background_music_enabled": False,
    "background_music_volume": 0.28,
    "cosmic_theme": "nebula-blue",
}


class SettingsService:
    def __init__(self, path: Path | None = None) -> None:
        self.path = Path(path or settings_path())
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._data = DEFAULT_SETTINGS.copy()
        self.load()

    def load(self) -> None:
        if not self.path.exists():
            self.save()
            return
        try:
            content = json.loads(self.path.read_text(encoding="utf-8"))
            if isinstance(content, dict):
                self._data.update(content)
        except (OSError, json.JSONDecodeError):
            self.save()

    def save(self) -> None:
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self._data, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.path)

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def set(self, key: str, value: Any, *, save: bool = True) -> None:
        self._data[key] = value
        if save:
            self.save()

    def update(self, values: dict[str, Any]) -> None:
        self._data.update(values)
        self.save()

    def as_dict(self) -> dict[str, Any]:
        return dict(self._data)

    def set_autostart(self, enabled: bool, executable: str | None = None) -> tuple[bool, str]:
        if sys.platform != "win32":
            self.set("start_with_windows", enabled)
            return False, "El inicio automático solo se registra en Windows."
        try:
            import winreg

            key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
            command = self._startup_command(executable)
            with winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                key_path,
                0,
                winreg.KEY_SET_VALUE,
            ) as key:
                if enabled:
                    winreg.SetValueEx(key, "Bolty Switch", 0, winreg.REG_SZ, command)
                else:
                    try:
                        winreg.DeleteValue(key, "Bolty Switch")
                    except FileNotFoundError:
                        pass
            self.set("start_with_windows", enabled)
            return True, "Inicio automático actualizado."
        except OSError as exc:
            return False, f"No se pudo cambiar el inicio automático: {exc}"

    @staticmethod
    def _startup_command(executable: str | None = None) -> str:
        if executable:
            path = Path(executable).expanduser().resolve()
            if path.is_file() and path.suffix.casefold() == ".exe":
                return f'"{path}"'
        if getattr(sys, "frozen", False) and Path(sys.executable).suffix.casefold() == ".exe":
            return f'"{sys.executable}" --background'
        raise FileNotFoundError("No se recibió la ruta del ejecutable de Bolty Switch.")
