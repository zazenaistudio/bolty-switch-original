from __future__ import annotations

import json
import sqlite3
import threading
import unicodedata
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterator, Sequence

from .constants import DEFAULT_TASKS, EVENT_CATEGORIES
from .models import Event, ScriptStep
from .paths import database_path


def normalize_command(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.strip().lower())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    normalized = []
    for ch in text:
        normalized.append(ch if ch.isalnum() or ch.isspace() else " ")
    return " ".join("".join(normalized).split())


class DuplicateCommandError(ValueError):
    def __init__(self, command: str, owner_name: str = "") -> None:
        self.command = command
        self.owner_name = owner_name
        suffix = f" (ya pertenece a «{owner_name}»)" if owner_name else ""
        super().__init__(f"El comando «{command}» ya existe{suffix}.")


class Database:
    def __init__(self, path: Path | None = None) -> None:
        self.path = Path(path or database_path())
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._initialize()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        con = sqlite3.connect(self.path, timeout=20)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys = ON")
        con.execute("PRAGMA journal_mode = WAL")
        try:
            yield con
            con.commit()
        except Exception:
            con.rollback()
            raise
        finally:
            con.close()

    def _initialize(self) -> None:
        with self._lock, self.connection() as con:
            con.executescript(
                """
                CREATE TABLE IF NOT EXISTS categories (
                    name TEXT PRIMARY KEY,
                    position INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT NOT NULL,
                    name TEXT NOT NULL,
                    icon TEXT NOT NULL DEFAULT '⚡',
                    action_type TEXT NOT NULL,
                    target TEXT NOT NULL DEFAULT '',
                    description TEXT NOT NULL DEFAULT '',
                    folder TEXT NOT NULL DEFAULT '',
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    is_builtin INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(category) REFERENCES categories(name) ON UPDATE CASCADE,
                    UNIQUE(category, name COLLATE NOCASE)
                );

                CREATE TABLE IF NOT EXISTS folders (
                    category TEXT NOT NULL,
                    name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY(category, name),
                    FOREIGN KEY(category) REFERENCES categories(name) ON UPDATE CASCADE
                );

                CREATE TABLE IF NOT EXISTS commands (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id INTEGER NOT NULL,
                    phrase TEXT NOT NULL,
                    normalized TEXT NOT NULL UNIQUE,
                    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS script_steps (
                    script_event_id INTEGER NOT NULL,
                    event_id INTEGER NOT NULL,
                    position INTEGER NOT NULL,
                    delay_ms INTEGER NOT NULL DEFAULT 350,
                    PRIMARY KEY(script_event_id, position),
                    FOREIGN KEY(script_event_id) REFERENCES events(id) ON DELETE CASCADE,
                    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS disabled_default_tasks (
                    action TEXT PRIMARY KEY,
                    disabled_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS pinned_events (
                    event_id INTEGER PRIMARY KEY,
                    position INTEGER NOT NULL,
                    pinned_at TEXT NOT NULL,
                    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
                CREATE INDEX IF NOT EXISTS idx_commands_event ON commands(event_id);
                CREATE INDEX IF NOT EXISTS idx_commands_normalized ON commands(normalized);
                CREATE INDEX IF NOT EXISTS idx_folders_category ON folders(category);
                CREATE INDEX IF NOT EXISTS idx_pinned_events_position ON pinned_events(position);
                """
            )
            columns = {row["name"] for row in con.execute("PRAGMA table_info(events)").fetchall()}
            if "folder" not in columns:
                con.execute("ALTER TABLE events ADD COLUMN folder TEXT NOT NULL DEFAULT ''")
            con.execute("CREATE INDEX IF NOT EXISTS idx_events_folder ON events(category, folder)")
            for position, category in enumerate(EVENT_CATEGORIES):
                con.execute(
                    "INSERT OR IGNORE INTO categories(name, position) VALUES(?, ?)",
                    (category, position),
                )
        self.seed_default_tasks()

    @staticmethod
    def _now() -> str:
        return datetime.now(UTC).isoformat(timespec="seconds")

    def seed_default_tasks(self) -> None:
        existing = {e.metadata.get("task_action") for e in self.list_events("Tareas")}
        with self.connection() as con:
            disabled = {row["action"] for row in con.execute("SELECT action FROM disabled_default_tasks")}
        for task in DEFAULT_TASKS:
            if task.action in existing or task.action in disabled:
                continue
            event = Event(
                id=None,
                category="Tareas",
                name=task.name_es,
                icon=f"emoji:{task.icon}",
                action_type="task",
                target=task.action,
                description=task.description_es,
                commands=list(task.commands_es) + list(task.commands_en),
                metadata={
                    "task_action": task.action,
                    "name_en": task.name_en,
                    "description_en": task.description_en,
                },
                is_builtin=True,
            )
            try:
                self.save_event(event)
            except DuplicateCommandError:
                # A user-created command takes priority over a seed alias.
                event.commands = [c for c in event.commands if not self.command_owner(c)]
                if event.commands:
                    self.save_event(event)

    def _row_to_event(self, row: sqlite3.Row, commands: list[str] | None = None) -> Event:
        try:
            metadata = json.loads(row["metadata_json"] or "{}")
        except json.JSONDecodeError:
            metadata = {}
        return Event(
            id=int(row["id"]),
            category=row["category"],
            name=row["name"],
            icon=row["icon"],
            action_type=row["action_type"],
            target=row["target"],
            description=row["description"],
            folder=row["folder"] if "folder" in row.keys() else "",
            commands=commands or [],
            metadata=metadata,
            is_builtin=bool(row["is_builtin"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def get_event(self, event_id: int) -> Event | None:
        with self.connection() as con:
            row = con.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
            if not row:
                return None
            commands = [r[0] for r in con.execute(
                "SELECT phrase FROM commands WHERE event_id = ? ORDER BY id", (event_id,)
            )]
            return self._row_to_event(row, commands)

    def list_events(self, category: str | None = None) -> list[Event]:
        with self.connection() as con:
            if category:
                rows = con.execute(
                    "SELECT * FROM events WHERE category = ? ORDER BY name COLLATE NOCASE", (category,)
                ).fetchall()
            else:
                rows = con.execute(
                    "SELECT * FROM events ORDER BY category, name COLLATE NOCASE"
                ).fetchall()
            if not rows:
                return []
            command_rows = con.execute(
                "SELECT event_id, phrase FROM commands ORDER BY id"
            ).fetchall()
            command_map: dict[int, list[str]] = {}
            for command_row in command_rows:
                command_map.setdefault(int(command_row["event_id"]), []).append(command_row["phrase"])
            return [self._row_to_event(row, command_map.get(int(row["id"]), [])) for row in rows]

    def list_pinned_events(self) -> list[Event]:
        with self.connection() as con:
            rows = con.execute(
                "SELECT event_id FROM pinned_events ORDER BY position, pinned_at"
            ).fetchall()
        pinned: list[Event] = []
        for row in rows:
            event = self.get_event(int(row["event_id"]))
            if event is not None:
                pinned.append(event)
        return pinned

    def pin_event(self, event_id: int) -> Event:
        event = self.get_event(event_id)
        if event is None:
            raise ValueError("El evento ya no existe.")
        with self._lock, self.connection() as con:
            existing = con.execute(
                "SELECT 1 FROM pinned_events WHERE event_id = ?", (event_id,)
            ).fetchone()
            if not existing:
                row = con.execute(
                    "SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM pinned_events"
                ).fetchone()
                con.execute(
                    "INSERT INTO pinned_events(event_id, position, pinned_at) VALUES(?, ?, ?)",
                    (event_id, int(row["next_position"] if row else 0), self._now()),
                )
        return event

    def unpin_event(self, event_id: int) -> bool:
        with self._lock, self.connection() as con:
            cursor = con.execute("DELETE FROM pinned_events WHERE event_id = ?", (event_id,))
            if cursor.rowcount:
                rows = con.execute(
                    "SELECT event_id FROM pinned_events ORDER BY position, pinned_at"
                ).fetchall()
                con.executemany(
                    "UPDATE pinned_events SET position = ? WHERE event_id = ?",
                    [(position, int(row["event_id"])) for position, row in enumerate(rows)],
                )
            return bool(cursor.rowcount)

    def list_search_terms(self) -> list[str]:
        with self.connection() as con:
            rows = con.execute(
                """
                SELECT name AS term FROM events
                UNION
                SELECT phrase AS term FROM commands
                ORDER BY term COLLATE NOCASE
                """
            ).fetchall()
        return [row["term"] for row in rows]

    def list_folders(self, category: str | None = None) -> list[dict[str, str]]:
        with self.connection() as con:
            if category:
                rows = con.execute(
                    "SELECT category, name FROM folders WHERE category = ? ORDER BY name COLLATE NOCASE",
                    (category,),
                ).fetchall()
            else:
                rows = con.execute(
                    "SELECT category, name FROM folders ORDER BY category, name COLLATE NOCASE"
                ).fetchall()
        return [{"category": row["category"], "name": row["name"]} for row in rows]

    def create_folder(self, category: str, name: str) -> dict[str, str]:
        clean_category = category.strip()
        clean_name = " ".join(name.strip().split())
        if not clean_category or clean_category not in EVENT_CATEGORIES:
            raise ValueError("La subcategoría necesita una categoría válida.")
        if not clean_name:
            raise ValueError("Escribe un nombre para la subcategoría.")
        with self._lock, self.connection() as con:
            existing = con.execute(
                "SELECT 1 FROM folders WHERE category = ? AND name = ? COLLATE NOCASE",
                (clean_category, clean_name),
            ).fetchone()
            if existing:
                raise ValueError("Ya existe una subcategoría con ese nombre.")
            con.execute(
                "INSERT INTO folders(category, name, created_at) VALUES(?, ?, ?)",
                (clean_category, clean_name, self._now()),
            )
        return {"category": clean_category, "name": clean_name}

    def rename_folder(self, category: str, old_name: str, new_name: str) -> dict[str, str]:
        clean_category = category.strip()
        clean_old = " ".join(old_name.strip().split())
        clean_new = " ".join(new_name.strip().split())
        if not clean_category or clean_category not in EVENT_CATEGORIES:
            raise ValueError("La subcategoría necesita una categoría válida.")
        if not clean_old or not clean_new:
            raise ValueError("Indica el nombre actual y el nuevo nombre.")
        if clean_old == clean_new:
            return {"category": clean_category, "name": clean_new}
        with self._lock, self.connection() as con:
            current = con.execute(
                "SELECT rowid AS folder_rowid FROM folders WHERE category = ? AND name = ? COLLATE NOCASE",
                (clean_category, clean_old),
            ).fetchone()
            if not current:
                raise ValueError("La subcategoría ya no existe.")
            duplicate = con.execute(
                "SELECT 1 FROM folders WHERE category = ? AND name = ? COLLATE NOCASE AND rowid != ?",
                (clean_category, clean_new, current["folder_rowid"]),
            ).fetchone()
            if duplicate:
                raise ValueError("Ya existe una subcategoría con ese nombre.")
            con.execute(
                "UPDATE folders SET name = ? WHERE rowid = ?",
                (clean_new, current["folder_rowid"]),
            )
            con.execute(
                "UPDATE events SET folder = ?, updated_at = ? WHERE category = ? AND folder = ? COLLATE NOCASE",
                (clean_new, self._now(), clean_category, clean_old),
            )
        return {"category": clean_category, "name": clean_new}

    def delete_folder(self, category: str, name: str) -> dict[str, object]:
        clean_category = category.strip()
        clean_name = " ".join(name.strip().split())
        if not clean_category or clean_category not in EVENT_CATEGORIES:
            raise ValueError("La subcategoría necesita una categoría válida.")
        if not clean_name:
            raise ValueError("Indica la subcategoría que quieres eliminar.")
        with self._lock, self.connection() as con:
            exists = con.execute(
                "SELECT 1 FROM folders WHERE category = ? AND name = ? COLLATE NOCASE",
                (clean_category, clean_name),
            ).fetchone()
            if not exists:
                raise ValueError("La subcategoría ya no existe.")
            affected = con.execute(
                "SELECT COUNT(*) AS total FROM events WHERE category = ? AND folder = ? COLLATE NOCASE",
                (clean_category, clean_name),
            ).fetchone()
            con.execute(
                "UPDATE events SET folder = '', updated_at = ? WHERE category = ? AND folder = ? COLLATE NOCASE",
                (self._now(), clean_category, clean_name),
            )
            con.execute(
                "DELETE FROM folders WHERE category = ? AND name = ? COLLATE NOCASE",
                (clean_category, clean_name),
            )
        return {"deleted": True, "moved_events": int(affected["total"] if affected else 0)}

    def category_counts(self) -> dict[str, int]:
        counts = {category: 0 for category in EVENT_CATEGORIES}
        with self.connection() as con:
            for row in con.execute("SELECT category, COUNT(*) AS total FROM events GROUP BY category"):
                counts[row["category"]] = int(row["total"])
        return counts

    def command_owner(self, command: str, exclude_event_id: int | None = None) -> str:
        normalized = normalize_command(command)
        if not normalized:
            return ""
        sql = (
            "SELECT events.name FROM commands JOIN events ON events.id = commands.event_id "
            "WHERE commands.normalized = ?"
        )
        params: list[object] = [normalized]
        if exclude_event_id is not None:
            sql += " AND events.id != ?"
            params.append(exclude_event_id)
        with self.connection() as con:
            row = con.execute(sql, params).fetchone()
            return row["name"] if row else ""

    def validate_commands(self, commands: Sequence[str], exclude_event_id: int | None = None) -> list[str]:
        cleaned: list[str] = []
        local_seen: set[str] = set()
        for raw in commands:
            phrase = " ".join(raw.strip().split())
            normalized = normalize_command(phrase)
            if not normalized:
                continue
            if normalized in local_seen:
                raise DuplicateCommandError(phrase, "este mismo evento")
            local_seen.add(normalized)
            owner = self.command_owner(phrase, exclude_event_id)
            if owner:
                raise DuplicateCommandError(phrase, owner)
            cleaned.append(phrase)
        if not cleaned:
            raise ValueError("Debes añadir al menos un comando.")
        return cleaned

    def save_event(self, event: Event, script_steps: Sequence[ScriptStep] | None = None) -> Event:
        commands = self.validate_commands(event.commands, event.id)
        now = self._now()
        metadata_json = json.dumps(event.metadata or {}, ensure_ascii=False)
        with self._lock, self.connection() as con:
            try:
                if event.id is None:
                    cursor = con.execute(
                        """
                        INSERT INTO events(
                            category, name, icon, action_type, target, description, folder,
                            metadata_json, is_builtin, created_at, updated_at
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            event.category, event.name.strip(), event.icon or "emoji:⚡",
                            event.action_type, event.target.strip(), event.description.strip(), event.folder.strip(),
                            metadata_json, int(event.is_builtin), now, now,
                        ),
                    )
                    event_id = int(cursor.lastrowid)
                else:
                    event_id = int(event.id)
                    con.execute(
                        """
                        UPDATE events SET category=?, name=?, icon=?, action_type=?, target=?,
                            description=?, folder=?, metadata_json=?, is_builtin=?, updated_at=?
                        WHERE id=?
                        """,
                        (
                            event.category, event.name.strip(), event.icon or "emoji:⚡",
                            event.action_type, event.target.strip(), event.description.strip(), event.folder.strip(),
                            metadata_json, int(event.is_builtin), now, event_id,
                        ),
                    )
                    con.execute("DELETE FROM commands WHERE event_id = ?", (event_id,))
                if event.folder.strip():
                    con.execute(
                        "INSERT OR IGNORE INTO folders(category, name, created_at) VALUES(?, ?, ?)",
                        (event.category, event.folder.strip(), now),
                    )
                con.executemany(
                    "INSERT INTO commands(event_id, phrase, normalized) VALUES(?, ?, ?)",
                    [(event_id, phrase, normalize_command(phrase)) for phrase in commands],
                )
                if event.action_type == "script":
                    con.execute("DELETE FROM script_steps WHERE script_event_id = ?", (event_id,))
                    for position, step in enumerate(script_steps or []):
                        if step.event_id == event_id:
                            continue
                        con.execute(
                            """
                            INSERT INTO script_steps(script_event_id, event_id, position, delay_ms)
                            VALUES(?, ?, ?, ?)
                            """,
                            (event_id, step.event_id, position, max(0, int(step.delay_ms))),
                        )
            except sqlite3.IntegrityError as exc:
                message = str(exc).lower()
                if "commands.normalized" in message or "unique constraint failed: commands.normalized" in message:
                    raise DuplicateCommandError("alguno de los comandos") from exc
                if "events.category, events.name" in message:
                    raise ValueError("Ya existe un evento con ese nombre en la categoría.") from exc
                raise
        saved = self.get_event(event_id)
        assert saved is not None
        return saved

    def delete_event(self, event_id: int) -> None:
        with self._lock, self.connection() as con:
            row = con.execute(
                "SELECT category, target, metadata_json, is_builtin FROM events WHERE id = ?",
                (event_id,),
            ).fetchone()
            if row and bool(row["is_builtin"]) and row["category"] == "Tareas":
                action = row["target"]
                if not action:
                    try:
                        action = json.loads(row["metadata_json"] or "{}").get("task_action", "")
                    except json.JSONDecodeError:
                        action = ""
                if action:
                    con.execute(
                        "INSERT OR REPLACE INTO disabled_default_tasks(action, disabled_at) VALUES(?, ?)",
                        (action, self._now()),
                    )
            con.execute("DELETE FROM events WHERE id = ?", (event_id,))

    def restore_default_tasks(self) -> None:
        with self._lock, self.connection() as con:
            con.execute("DELETE FROM disabled_default_tasks")
            con.execute("DELETE FROM events WHERE is_builtin = 1")
        self.seed_default_tasks()

    def get_script_steps(self, script_event_id: int) -> list[ScriptStep]:
        with self.connection() as con:
            rows = con.execute(
                """
                SELECT event_id, position, delay_ms
                FROM script_steps WHERE script_event_id = ? ORDER BY position
                """,
                (script_event_id,),
            ).fetchall()
        return [ScriptStep(int(r["event_id"]), int(r["position"]), int(r["delay_ms"])) for r in rows]

    def replace_script_steps(self, script_event_id: int, steps: Sequence[ScriptStep]) -> None:
        with self._lock, self.connection() as con:
            con.execute("DELETE FROM script_steps WHERE script_event_id = ?", (script_event_id,))
            for position, step in enumerate(steps):
                if step.event_id == script_event_id:
                    continue
                con.execute(
                    "INSERT INTO script_steps(script_event_id, event_id, position, delay_ms) VALUES(?, ?, ?, ?)",
                    (script_event_id, step.event_id, position, max(0, step.delay_ms)),
                )

    def event_by_command(self, command: str) -> Event | None:
        normalized = normalize_command(command)
        with self.connection() as con:
            row = con.execute(
                """
                SELECT events.* FROM commands
                JOIN events ON events.id = commands.event_id
                WHERE commands.normalized = ?
                """,
                (normalized,),
            ).fetchone()
            if not row:
                return None
            commands = [r[0] for r in con.execute(
                "SELECT phrase FROM commands WHERE event_id = ? ORDER BY id", (row["id"],)
            )]
            return self._row_to_event(row, commands)
