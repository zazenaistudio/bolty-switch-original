from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class Event:
    id: int | None
    category: str
    name: str
    icon: str
    action_type: str
    target: str = ""
    description: str = ""
    folder: str = ""
    commands: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    is_builtin: bool = False
    created_at: str = ""
    updated_at: str = ""


@dataclass(slots=True)
class ScriptStep:
    event_id: int
    position: int
    delay_ms: int = 350


@dataclass(slots=True)
class CommandMatch:
    event: Event | None
    score: float
    matched_text: str = ""
    exact: bool = False


@dataclass(slots=True)
class SystemStatus:
    key: str
    title: str
    state: str
    detail: str
    icon: str
    active: bool | None = None
    settings_uri: str = ""
