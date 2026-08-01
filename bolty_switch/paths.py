from __future__ import annotations

import os
import sys
from pathlib import Path


def resource_root() -> Path:
    """Return the read-only bundle root in source and PyInstaller builds."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent.parent


def asset_path(*parts: str) -> Path:
    return resource_root().joinpath("assets", *parts)


def data_root() -> Path:
    if sys.platform == "win32":
        base = Path(os.getenv("APPDATA", Path.home() / "AppData" / "Roaming"))
    else:
        base = Path(os.getenv("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    path = base / "Zazen AI Studio" / "Bolty Switch"
    path.mkdir(parents=True, exist_ok=True)
    return path


def database_path() -> Path:
    return data_root() / "bolty_switch.db"


def settings_path() -> Path:
    return data_root() / "settings.json"


def log_path() -> Path:
    return data_root() / "bolty_switch.log"


def _valid_vosk_model(path: Path) -> bool:
    """Return True when a directory looks like a complete Vosk model."""
    return path.is_dir() and (path / "am" / "final.mdl").is_file() and (path / "conf" / "mfcc.conf").is_file()


def voice_model_candidates(language: str) -> list[Path]:
    folder = "vosk-es" if language.lower().startswith("es") else "vosk-en"
    candidates: list[Path] = []

    explicit = os.getenv("BOLTY_VOSK_MODEL", "").strip()
    if explicit:
        explicit_path = Path(explicit).expanduser()
        candidates.append(explicit_path / folder if explicit_path.name != folder else explicit_path)

    resource_dir = os.getenv("BOLTY_RESOURCE_DIR", "").strip()
    if resource_dir:
        candidates.append(Path(resource_dir) / "models" / folder)

    project_root = os.getenv("BOLTY_PROJECT_ROOT", "").strip()
    if project_root:
        candidates.append(Path(project_root) / "models" / folder)

    candidates.extend([
        data_root() / "models" / folder,
        resource_root() / "models" / folder,
        Path(sys.executable).resolve().parent / "models" / folder,
        Path.cwd() / "models" / folder,
        Path.cwd().parent / "models" / folder,
        Path.cwd().parent.parent / "models" / folder,
    ])

    unique: list[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        try:
            key = str(candidate.resolve(strict=False)).casefold()
        except OSError:
            key = str(candidate).casefold()
        if key not in seen:
            seen.add(key)
            unique.append(candidate)
    return unique


def voice_model_path(language: str) -> Path:
    candidates = voice_model_candidates(language)
    for candidate in candidates:
        if _valid_vosk_model(candidate):
            return candidate
    # The writable user location is always returned as the install destination.
    folder = "vosk-es" if language.lower().startswith("es") else "vosk-en"
    return data_root() / "models" / folder
