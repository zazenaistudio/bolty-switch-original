from pathlib import Path

import pytest

from bolty_switch.database import Database, DuplicateCommandError
from bolty_switch.models import Event, ScriptStep


def create_db(tmp_path: Path) -> Database:
    return Database(tmp_path / "test.db")


def test_default_tasks_are_seeded(tmp_path: Path) -> None:
    db = create_db(tmp_path)
    tasks = db.list_events("Tareas")
    assert len(tasks) >= 25
    assert any(event.target == "volume_up" for event in tasks)
    assert any(event.target == "lock" for event in tasks)


def test_command_uniqueness_is_accent_and_case_insensitive(tmp_path: Path) -> None:
    db = create_db(tmp_path)
    first = Event(None, "Páginas Webs", "Ejemplo", "emoji:🌐", "url", "https://example.com", commands=["ÁBRE Ejemplo"])
    db.save_event(first)
    second = Event(None, "Páginas Webs", "Otro", "emoji:🌐", "url", "https://example.org", commands=["abre ejemplo!"])
    with pytest.raises(DuplicateCommandError):
        db.save_event(second)


def test_script_steps_preserve_order(tmp_path: Path) -> None:
    db = create_db(tmp_path)
    a = db.save_event(Event(None, "Páginas Webs", "A", "emoji:A", "url", "https://a.example", commands=["abre a web"]))
    b = db.save_event(Event(None, "Páginas Webs", "B", "emoji:B", "url", "https://b.example", commands=["abre b web"]))
    script = Event(None, "Guiones", "Workspace", "emoji:⛓", "script", commands=["abre mi workspace"])
    saved = db.save_event(script, [ScriptStep(a.id or 0, 0, 100), ScriptStep(b.id or 0, 1, 250)])
    steps = db.get_script_steps(saved.id or 0)
    assert [step.event_id for step in steps] == [a.id, b.id]
    assert [step.delay_ms for step in steps] == [100, 250]


def test_deleted_builtin_task_stays_disabled_until_restore(tmp_path: Path) -> None:
    db = create_db(tmp_path)
    task = next(event for event in db.list_events("Tareas") if event.target == "volume_up")
    db.delete_event(task.id or 0)
    db.seed_default_tasks()
    assert not any(event.target == "volume_up" for event in db.list_events("Tareas"))
    db.restore_default_tasks()
    assert any(event.target == "volume_up" for event in db.list_events("Tareas"))


def test_subcategories_can_be_created_renamed_and_deleted(tmp_path: Path) -> None:
    db = create_db(tmp_path)
    db.create_folder("Aplicaciones", "Juegos")
    event = db.save_event(
        Event(None, "Aplicaciones", "Demo", "emoji:⚡", "path", "C:/demo.exe", folder="Juegos", commands=["abre demo"])
    )
    db.rename_folder("Aplicaciones", "Juegos", "Favoritos")
    assert db.get_event(event.id or 0).folder == "Favoritos"
    result = db.delete_folder("Aplicaciones", "Favoritos")
    assert result["moved_events"] == 1
    assert db.get_event(event.id or 0).folder == ""


def test_events_can_be_pinned_and_unpinned_from_home(tmp_path: Path) -> None:
    db = create_db(tmp_path)
    first = db.save_event(Event(None, "Aplicaciones", "Editor", "emoji:📝", "path", "C:/editor.exe", commands=["abre editor"] ))
    second = db.save_event(Event(None, "Páginas Webs", "Portal", "emoji:🌐", "url", "https://example.com", commands=["abre portal"] ))

    db.pin_event(first.id or 0)
    db.pin_event(second.id or 0)
    db.pin_event(first.id or 0)

    assert [event.id for event in db.list_pinned_events()] == [first.id, second.id]
    assert db.unpin_event(first.id or 0) is True
    assert [event.id for event in db.list_pinned_events()] == [second.id]

    db.delete_event(second.id or 0)
    assert db.list_pinned_events() == []
