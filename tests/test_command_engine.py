from pathlib import Path

from bolty_switch.database import Database
from bolty_switch.models import Event
from bolty_switch.services.command_engine import CommandEngine


def test_natural_language_matches_event_name(tmp_path: Path) -> None:
    db = Database(tmp_path / "test.db")
    event = db.save_event(
        Event(
            None,
            "Páginas Webs",
            "MoureDev Pro",
            "emoji:🌐",
            "url",
            "https://example.com",
            commands=["abre mouredev pro"],
        )
    )
    engine = CommandEngine(db)
    match = engine.match("Bolty, quiero abrir MoureDev Pro por favor")
    assert match.event is not None
    assert match.event.id == event.id
    assert match.score >= 80


def test_unknown_command_returns_no_event(tmp_path: Path) -> None:
    db = Database(tmp_path / "test.db")
    engine = CommandEngine(db)
    match = engine.match("cultiva patatas en marte", threshold=90)
    assert match.event is None
