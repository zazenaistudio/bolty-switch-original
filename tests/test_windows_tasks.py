from __future__ import annotations

from pathlib import Path

import pytest

from bolty_switch.constants import DEFAULT_TASKS
from bolty_switch.services import windows_tasks
from bolty_switch.services.windows_tasks import WindowsTaskError, WindowsTaskRunner, audit_task_actions, plan_task


def task_actions() -> list[str]:
    return [task.action for task in DEFAULT_TASKS]


def test_default_task_catalog_has_exactly_70_unique_actions() -> None:
    actions = task_actions()
    assert len(actions) == 70
    assert len(set(actions)) == 70


def test_every_default_task_has_a_supported_execution_plan() -> None:
    audit = audit_task_actions(task_actions())
    assert audit["total"] == 70
    assert audit["unique"] == 70
    assert audit["duplicates"] == []
    assert audit["missing"] == []
    assert audit["unused"] == []
    assert set(audit["plans"].values()) <= {
        "settings_uri",
        "virtual_key",
        "shortcut",
        "special_folder",
        "command",
        "terminal",
        "clear_clipboard",
        "empty_recycle_bin",
        "brightness",
        "wifi",
        "bluetooth",
    }


def test_volume_tasks_use_native_windows_keys_without_pycaw() -> None:
    assert plan_task("volume_up").value == (0xAF, 3)
    assert plan_task("volume_down").value == (0xAE, 3)
    assert plan_task("volume_mute").value == (0xAD, 1)
    source = Path(windows_tasks.__file__).read_text(encoding="utf-8").lower()
    assert "from pycaw" not in source
    assert "import comtypes" not in source


def test_all_task_plans_dispatch_without_external_execution(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, object]] = []
    runner = WindowsTaskRunner()

    monkeypatch.setattr(windows_tasks.sys, "platform", "win32")
    monkeypatch.setattr(windows_tasks.SystemService, "open_settings", lambda value: calls.append(("settings_uri", value)))
    monkeypatch.setattr(runner, "_press_key", lambda key, repeats=1: calls.append(("virtual_key", (key, repeats))))
    monkeypatch.setattr(runner, "_shortcut", lambda modifiers, key: calls.append(("shortcut", (modifiers, key))))
    monkeypatch.setattr(runner, "_spawn", lambda command: calls.append(("spawn", command)))
    monkeypatch.setattr(runner, "_open_terminal", lambda: calls.append(("terminal", None)))
    monkeypatch.setattr(runner, "_clear_clipboard", lambda: calls.append(("clear_clipboard", None)))
    monkeypatch.setattr(runner, "_empty_recycle_bin", lambda: calls.append(("empty_recycle_bin", None)))
    monkeypatch.setattr(runner, "_brightness", lambda delta: calls.append(("brightness", delta)))
    monkeypatch.setattr(runner, "_wifi", lambda enabled: calls.append(("wifi", enabled)))
    monkeypatch.setattr(runner, "_bluetooth", lambda enabled: calls.append(("bluetooth", enabled)))

    for action in task_actions():
        before = len(calls)
        runner.execute(action)
        assert len(calls) == before + 1, action


def test_unknown_task_is_rejected() -> None:
    with pytest.raises(WindowsTaskError, match="no compatible"):
        plan_task("delete_everything")


def test_task_requirements_do_not_force_optional_audio_packages() -> None:
    project_root = Path(__file__).resolve().parents[1]
    for name in ("requirements-backend.txt", "requirements-dev.txt"):
        content = (project_root / name).read_text(encoding="utf-8").lower()
        assert "pycaw" not in content
        assert "comtypes" not in content


def test_windows_commands_are_explicit_and_allow_listed() -> None:
    assert windows_tasks.COMMANDS["open_device_manager"] == ("mmc.exe", "devmgmt.msc")
    assert windows_tasks.COMMANDS["screenshot"] == ("explorer.exe", "ms-screenclip:")
    assert windows_tasks.SHORTCUTS["show_desktop"] == ((0x5B,), 0x44)


def test_database_seeds_all_70_task_events_with_valid_targets(tmp_path: Path) -> None:
    from bolty_switch.database import Database

    database = Database(tmp_path / "tasks.sqlite3")
    events = database.list_events("Tareas")
    assert len(events) == 70
    assert all(event.action_type == "task" for event in events)
    targets = {event.target or str(event.metadata.get("task_action", "")) for event in events}
    assert targets == set(task_actions())
    for event in events:
        plan_task(event.target or str(event.metadata.get("task_action", "")))


def test_all_230_default_voice_and_text_aliases_are_unique() -> None:
    aliases: dict[str, str] = {}
    for task in DEFAULT_TASKS:
        for command in (*task.commands_es, *task.commands_en):
            normalized = " ".join(command.casefold().split())
            assert normalized not in aliases, (normalized, aliases.get(normalized), task.action)
            aliases[normalized] = task.action
    assert len(aliases) == 230
