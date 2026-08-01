from __future__ import annotations

from difflib import SequenceMatcher

from ..database import Database, normalize_command
from ..models import CommandMatch, Event

try:
    from rapidfuzz import fuzz, process
except ImportError:  # pragma: no cover - fallback for minimal installations
    fuzz = process = None


ACTION_PREFIXES = {
    "abre", "abrir", "inicia", "iniciar", "ejecuta", "ejecutar", "pon", "poner",
    "quiero", "ver", "reproduce", "reproducir", "lanza", "lanzar", "activa", "activar",
    "desactiva", "desactivar", "open", "start", "run", "launch", "play", "show", "turn",
    "please", "por", "favor", "me", "mi", "the", "el", "la", "los", "las", "un", "una",
    "bolty",
}


class CommandEngine:
    def __init__(self, database: Database) -> None:
        self.database = database
        self._events: list[Event] = []
        self._lookup: dict[str, Event] = {}
        self.refresh()

    def refresh(self) -> None:
        self._events = self.database.list_events()
        lookup: dict[str, Event] = {}
        for event in self._events:
            lookup[normalize_command(event.name)] = event
            english_name = str(event.metadata.get("name_en", "")).strip()
            if english_name:
                lookup[normalize_command(english_name)] = event
            for command in event.commands:
                lookup[normalize_command(command)] = event
        self._lookup = lookup

    def suggestions(self, text: str, limit: int = 8) -> list[str]:
        needle = normalize_command(text)
        terms = self.database.list_search_terms()
        terms.extend(
            str(event.metadata.get("name_en"))
            for event in self._events
            if event.metadata.get("name_en")
        )
        terms = sorted(set(terms), key=str.casefold)
        if not needle:
            return terms[:limit]
        starts = [term for term in terms if normalize_command(term).startswith(needle)]
        contains = [term for term in terms if needle in normalize_command(term) and term not in starts]
        result = starts + contains
        if len(result) >= limit:
            return result[:limit]
        if process:
            extras = [match[0] for match in process.extract(text, terms, scorer=fuzz.WRatio, limit=limit)]
            result.extend(term for term in extras if term not in result)
        return result[:limit]

    def match(self, text: str, threshold: float = 67.0) -> CommandMatch:
        normalized = normalize_command(text)
        if not normalized:
            return CommandMatch(None, 0.0)
        if normalized in self._lookup:
            return CommandMatch(self._lookup[normalized], 100.0, normalized, True)

        stripped = self._strip_action_words(normalized)
        if stripped in self._lookup:
            return CommandMatch(self._lookup[stripped], 98.0, stripped, True)

        # Strong containment is ideal for phrases such as "quiero ver House of the Dragon".
        candidates: list[tuple[float, str, Event]] = []
        for phrase, event in self._lookup.items():
            if len(phrase) >= 4 and phrase in normalized:
                coverage = min(1.0, len(phrase) / max(1, len(normalized)))
                candidates.append((88.0 + 10.0 * coverage, phrase, event))
            elif normalized in phrase and len(normalized) >= 4:
                candidates.append((84.0, phrase, event))
        if candidates:
            score, phrase, event = max(candidates, key=lambda item: item[0])
            return CommandMatch(event, score, phrase, False)

        if not self._lookup:
            return CommandMatch(None, 0.0)
        if process:
            result = process.extractOne(normalized, list(self._lookup), scorer=fuzz.WRatio)
            if result:
                phrase, score, _ = result
                event = self._lookup[phrase]
                return CommandMatch(event if score >= threshold else None, float(score), phrase, False)

        phrase, score = max(
            ((phrase, SequenceMatcher(None, normalized, phrase).ratio() * 100) for phrase in self._lookup),
            key=lambda item: item[1],
        )
        return CommandMatch(self._lookup[phrase] if score >= threshold else None, score, phrase, False)

    @staticmethod
    def _strip_action_words(normalized: str) -> str:
        words = normalized.split()
        stripped = [word for word in words if word not in ACTION_PREFIXES]
        return " ".join(stripped) or normalized
