from __future__ import annotations

import json
import os
import queue
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unicodedata
import urllib.request
import zipfile
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from bolty_switch.paths import data_root, voice_model_candidates, voice_model_path


class VoiceEngine:
    """Headless Vosk microphone service controlled through short IPC polling calls.

    Audio capture runs in a daemon thread, so the JSON request loop remains responsive.
    The frontend starts a session and polls lightweight state events.
    """

    MODEL_DOWNLOADS = {
        "es": ("https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip", "vosk-model-small-es-0.42"),
        "en": ("https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip", "vosk-model-small-en-us-0.15"),
    }

    def __init__(self) -> None:
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._events: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=128)
        self._lock = threading.Lock()
        self._running = False
        self._mode = "once"
        self._language = "es"
        self._wake_word = "bolty"

    def status(self, language: str = "es") -> dict[str, Any]:
        model = Path(voice_model_path(language))
        available = self._model_is_valid(model)
        return {
            "running": self.running,
            "mode": self._mode,
            "language": language,
            "model_path": str(model),
            "model_available": available,
            "model_candidates": [str(path) for path in voice_model_candidates(language)],
        }

    @staticmethod
    def _model_is_valid(path: Path) -> bool:
        return path.is_dir() and (path / "am" / "final.mdl").is_file() and (path / "conf" / "mfcc.conf").is_file()


    @staticmethod
    def _normalize_speech(value: str) -> str:
        """Normalize Vosk text so wake-word matching tolerates accents and spacing."""
        normalized = unicodedata.normalize("NFKD", value or "")
        normalized = "".join(char for char in normalized if not unicodedata.combining(char))
        normalized = re.sub(r"[^a-z0-9]+", " ", normalized.casefold()).strip()
        return re.sub(r"\s+", " ", normalized)

    @classmethod
    def _wake_aliases(cls, wake_word: str) -> set[str]:
        base = cls._normalize_speech(wake_word)
        aliases = {
            base,
            "bolty", "bolti", "bol ti", "bolt", "boli", "boti", "bulti",
            "volty", "volti", "vol ti", "voltio", "volvi",
        }
        return {alias for alias in (cls._normalize_speech(item) for item in aliases) if alias}

    @classmethod
    def _wake_match(cls, text: str, aliases: set[str]) -> str:
        """Return the matched wake fragment, including common Vosk phonetic variants."""
        normalized = cls._normalize_speech(text)
        if not normalized:
            return ""
        compact = normalized.replace(" ", "")
        for alias in sorted(aliases, key=len, reverse=True):
            alias_compact = alias.replace(" ", "")
            if re.search(r"(?:^|\s)" + re.escape(alias) + r"(?:$|\s)", normalized):
                return alias
            if compact == alias_compact:
                return alias

        # Vosk can turn a made-up name into a close short token. Limit fuzzy
        # matching to short fragments to avoid waking on full ordinary phrases.
        candidates = normalized.split()
        if len(compact) <= 10:
            candidates.append(compact)
        for candidate in candidates:
            if not 3 <= len(candidate) <= 8:
                continue
            for alias in aliases:
                alias_compact = alias.replace(" ", "")
                if not 3 <= len(alias_compact) <= 8 or abs(len(candidate) - len(alias_compact)) > 2:
                    continue
                if SequenceMatcher(None, candidate, alias_compact).ratio() >= 0.78:
                    return candidate
        return ""

    @classmethod
    def _strip_wake_word(cls, text: str, aliases: set[str], matched: str = "") -> str:
        normalized = cls._normalize_speech(text)
        if not normalized:
            return ""
        ordered = [matched, *sorted(aliases, key=len, reverse=True)]
        for alias in ordered:
            alias = cls._normalize_speech(alias)
            if not alias:
                continue
            pattern = r"(?:^|\s)" + re.escape(alias) + r"(?:$|\s)"
            cleaned, count = re.subn(pattern, " ", normalized, count=1)
            if count:
                return re.sub(r"\s+", " ", cleaned).strip()
            alias_compact = alias.replace(" ", "")
            tokens = normalized.split()
            for index, token in enumerate(tokens):
                if token == alias_compact or SequenceMatcher(None, token, alias_compact).ratio() >= 0.78:
                    return " ".join(tokens[:index] + tokens[index + 1:]).strip()
        return normalized

    @staticmethod
    def _input_sample_rate(sounddevice: Any) -> int:
        """Prefer 16 kHz, falling back to the microphone's native rate."""
        try:
            sounddevice.check_input_settings(samplerate=16_000, channels=1, dtype="int16")
            return 16_000
        except Exception:
            try:
                info = sounddevice.query_devices(kind="input")
                rate = int(float(info.get("default_samplerate", 16_000)))
                return rate if rate > 0 else 16_000
            except Exception:
                return 16_000

    def install_model(self, language: str = "es") -> dict[str, Any]:
        """Download and install the official small Vosk model into the user data directory."""
        lang = "es" if language.lower().startswith("es") else "en"
        target = data_root() / "models" / ("vosk-es" if lang == "es" else "vosk-en")
        if self._model_is_valid(target):
            return {
                "running": self.running,
                "mode": self._mode,
                "language": language,
                "model_path": str(target),
                "model_available": True,
                "installed": True,
                "downloaded": False,
                "message": "El modelo Vosk ya está instalado.",
            }

        url, archive_root_name = self.MODEL_DOWNLOADS[lang]
        target.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="bolty-vosk-") as temp_dir_value:
            temp_dir = Path(temp_dir_value)
            archive = temp_dir / "model.zip"
            request = urllib.request.Request(url, headers={"User-Agent": "Bolty-Switch/0.6.6"})
            try:
                with urllib.request.urlopen(request, timeout=90) as response, archive.open("wb") as output:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        output.write(chunk)
            except Exception as exc:
                raise RuntimeError(f"No se pudo descargar el modelo Vosk: {exc}") from exc

            extract_root = temp_dir / "extract"
            extract_root.mkdir(parents=True, exist_ok=True)
            try:
                with zipfile.ZipFile(archive) as bundle:
                    for member in bundle.infolist():
                        member_path = (extract_root / member.filename).resolve()
                        if extract_root.resolve() not in member_path.parents and member_path != extract_root.resolve():
                            raise RuntimeError("El archivo del modelo contiene rutas no seguras.")
                    bundle.extractall(extract_root)
            except (zipfile.BadZipFile, OSError) as exc:
                raise RuntimeError(f"El modelo descargado no es un ZIP válido: {exc}") from exc

            extracted = extract_root / archive_root_name
            if not self._model_is_valid(extracted):
                extracted = next((path for path in extract_root.iterdir() if self._model_is_valid(path)), extracted)
            if not self._model_is_valid(extracted):
                raise RuntimeError("El modelo descargado no contiene la estructura requerida por Vosk.")

            staging = target.with_name(target.name + ".installing")
            if staging.exists():
                shutil.rmtree(staging, ignore_errors=True)
            shutil.copytree(extracted, staging)
            if target.exists():
                shutil.rmtree(target, ignore_errors=True)
            staging.replace(target)

        return {
            "running": self.running,
            "mode": self._mode,
            "language": language,
            "model_path": str(target),
            "model_available": True,
            "installed": True,
            "downloaded": True,
            "message": "Modelo Vosk instalado correctamente.",
        }

    @property
    def running(self) -> bool:
        with self._lock:
            return self._running

    def start(self, *, language: str = "es", hands_free: bool = False, wake_word: str = "Bolty") -> dict[str, Any]:
        self.stop(wait=0.6)
        self._drain_events()
        self._stop.clear()
        self._mode = "hands_free" if hands_free else "once"
        self._language = language or "es"
        self._wake_word = (wake_word or "Bolty").strip().casefold()
        model = Path(voice_model_path(self._language))
        if not self._model_is_valid(model):
            candidates = "\n".join(f"• {path}" for path in voice_model_candidates(self._language))
            return {
                **self.status(self._language),
                "started": False,
                "message": f"No se encontró un modelo Vosk válido. Bolty puede descargarlo automáticamente. Rutas comprobadas:\n{candidates}",
            }
        with self._lock:
            self._running = True
        self._thread = threading.Thread(
            target=self._worker,
            args=(model, hands_free),
            name="bolty-voice",
            daemon=True,
        )
        self._thread.start()
        return {**self.status(self._language), "started": True, "message": "Micrófono iniciado."}

    def stop(self, *, wait: float = 1.5) -> dict[str, Any]:
        self._stop.set()
        thread = self._thread
        if thread and thread.is_alive() and thread is not threading.current_thread():
            thread.join(timeout=max(0.0, wait))
        if not thread or not thread.is_alive():
            with self._lock:
                self._running = False
            self._thread = None
        return {**self.status(self._language), "stopped": not self.running}

    def poll(self) -> dict[str, Any]:
        events: list[dict[str, Any]] = []
        while len(events) < 32:
            try:
                events.append(self._events.get_nowait())
            except queue.Empty:
                break
        return {**self.status(self._language), "events": events}

    def open_model_folder(self, language: str = "es") -> dict[str, Any]:
        model = Path(voice_model_path(language))
        folder = model if model.exists() else data_root() / "models" / ("vosk-es" if language.lower().startswith("es") else "vosk-en")
        folder.mkdir(parents=True, exist_ok=True)
        if sys.platform == "win32":
            os.startfile(str(folder))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(folder)])
        else:
            subprocess.Popen(["xdg-open", str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"opened": True, "path": str(folder)}

    def _worker(self, model_path: Path, hands_free: bool) -> None:
        audio_queue: queue.Queue[bytes] = queue.Queue(maxsize=32)
        try:
            try:
                import sounddevice as sd
                from vosk import KaldiRecognizer, Model
            except ImportError as exc:
                raise RuntimeError("Instala Vosk y sounddevice con requirements-backend.txt.") from exc

            sample_rate = self._input_sample_rate(sd)
            model = Model(str(model_path))
            recognizer = KaldiRecognizer(model, sample_rate)
            aliases = self._wake_aliases(self._wake_word)
            wake_window_until = 0.0
            wake_active = False
            detected_wake = ""
            last_wake_at = 0.0
            started = time.monotonic()

            def activate_wake(fragment: str) -> None:
                nonlocal wake_active, wake_window_until, detected_wake, last_wake_at
                now = time.monotonic()
                if wake_active or now - last_wake_at < 1.0:
                    return
                detected_wake = fragment
                wake_active = True
                wake_window_until = now + 8.0
                last_wake_at = now
                self._emit("wake", word=fragment)

            def finish_command(command_text: str) -> None:
                nonlocal wake_active, wake_window_until, detected_wake
                command_text = self._normalize_speech(command_text)
                if not command_text:
                    return
                self._emit("transcript", text=command_text)
                self._emit("wake_end", reason="command")
                wake_active = False
                wake_window_until = 0.0
                detected_wake = ""

            def callback(indata: Any, frames: int, time_info: Any, status: Any) -> None:  # noqa: ARG001
                if self._stop.is_set():
                    return
                payload = bytes(indata)
                try:
                    audio_queue.put_nowait(payload)
                except queue.Full:
                    try:
                        audio_queue.get_nowait()
                    except queue.Empty:
                        pass
                    try:
                        audio_queue.put_nowait(payload)
                    except queue.Full:
                        pass
                if payload:
                    peak = max((abs(int.from_bytes(payload[i:i + 2], "little", signed=True)) for i in range(0, len(payload) - 1, 16)), default=0)
                    self._emit("level", value=min(1.0, peak / 32768.0))

            self._emit("listening", active=True, mode="hands_free" if hands_free else "once", sample_rate=sample_rate)
            with sd.RawInputStream(samplerate=sample_rate, blocksize=max(2_000, sample_rate // 8), dtype="int16", channels=1, callback=callback, latency="low"):
                while not self._stop.is_set():
                    now = time.monotonic()
                    if not hands_free and now - started > 10.0:
                        break
                    if hands_free and wake_active and wake_window_until and now > wake_window_until:
                        self._emit("wake_end", reason="timeout")
                        wake_active = False
                        wake_window_until = 0.0
                        detected_wake = ""
                    try:
                        data = audio_queue.get(timeout=0.20)
                    except queue.Empty:
                        continue

                    if recognizer.AcceptWaveform(data):
                        text = str(json.loads(recognizer.Result()).get("text", "")).strip()
                        if not text:
                            continue
                        if hands_free:
                            matched = self._wake_match(text, aliases)
                            if not wake_active and matched:
                                activate_wake(matched)
                            if wake_active:
                                remainder = self._strip_wake_word(text, aliases, matched or detected_wake)
                                if remainder:
                                    finish_command(remainder)
                                else:
                                    wake_window_until = time.monotonic() + 8.0
                        else:
                            self._emit("transcript", text=self._normalize_speech(text))
                            break
                    else:
                        partial = str(json.loads(recognizer.PartialResult()).get("partial", "")).strip()
                        if not partial:
                            continue
                        if hands_free:
                            matched = self._wake_match(partial, aliases)
                            if not wake_active and matched:
                                activate_wake(matched)
                            if wake_active:
                                wake_window_until = time.monotonic() + 8.0
                                remainder = self._strip_wake_word(partial, aliases, matched or detected_wake)
                                if remainder:
                                    self._emit("partial", text=remainder, phase="command")
                        else:
                            self._emit("partial", text=partial)

            if not hands_free and not self._stop.is_set():
                final_text = str(json.loads(recognizer.FinalResult()).get("text", "")).strip()
                if final_text:
                    self._emit("transcript", text=self._normalize_speech(final_text))
        except Exception as exc:
            self._emit("error", message=f"Error de reconocimiento de voz: {exc}")
        finally:
            try:
                if hands_free and 'wake_active' in locals() and wake_active:
                    self._emit("wake_end", reason="stopped")
            except Exception:
                pass
            with self._lock:
                self._running = False
            self._emit("listening", active=False)

    def _emit(self, kind: str, **payload: Any) -> None:
        event = {"type": kind, **payload, "timestamp": time.time()}
        try:
            self._events.put_nowait(event)
        except queue.Full:
            try:
                self._events.get_nowait()
                self._events.put_nowait(event)
            except queue.Empty:
                pass

    def _drain_events(self) -> None:
        while True:
            try:
                self._events.get_nowait()
            except queue.Empty:
                return
