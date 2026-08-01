from __future__ import annotations

import io
import zipfile
from pathlib import Path

from backend.voice_engine import VoiceEngine
from bolty_switch import paths


def _model_zip() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as bundle:
        bundle.writestr("vosk-model-small-es-0.42/am/final.mdl", b"model")
        bundle.writestr("vosk-model-small-es-0.42/conf/mfcc.conf", b"conf")
        bundle.writestr("vosk-model-small-es-0.42/conf/model.conf", b"conf")
    return buffer.getvalue()


class _Response(io.BytesIO):
    def __enter__(self) -> "_Response":
        return self

    def __exit__(self, *_: object) -> bool:
        self.close()
        return False


def test_voice_model_path_accepts_explicit_environment_model(tmp_path: Path, monkeypatch) -> None:
    model = tmp_path / "vosk-es"
    (model / "am").mkdir(parents=True)
    (model / "conf").mkdir(parents=True)
    (model / "am" / "final.mdl").write_bytes(b"model")
    (model / "conf" / "mfcc.conf").write_text("conf", encoding="utf-8")
    monkeypatch.setenv("BOLTY_VOSK_MODEL", str(model))

    assert paths.voice_model_path("es").resolve() == model.resolve()


def test_voice_model_installer_extracts_official_layout(tmp_path: Path, monkeypatch) -> None:
    payload = _model_zip()
    monkeypatch.setattr("backend.voice_engine.data_root", lambda: tmp_path)
    monkeypatch.setattr("backend.voice_engine.urllib.request.urlopen", lambda *_args, **_kwargs: _Response(payload))

    result = VoiceEngine().install_model("es")
    target = tmp_path / "models" / "vosk-es"

    assert result["installed"] is True
    assert result["model_available"] is True
    assert (target / "am" / "final.mdl").is_file()
    assert (target / "conf" / "mfcc.conf").is_file()


def test_wake_word_matches_common_vosk_variants() -> None:
    aliases = VoiceEngine._wake_aliases("Bolty")
    for phrase in ("bolty", "bol ti", "volti", "voltio", "volví", "boli"):
        assert VoiceEngine._wake_match(phrase, aliases), phrase


def test_wake_word_can_be_detected_inside_a_command() -> None:
    aliases = VoiceEngine._wake_aliases("Bolty")
    matched = VoiceEngine._wake_match("bol ti abre spotify", aliases)
    assert matched
    assert VoiceEngine._strip_wake_word("bol ti abre spotify", aliases, matched) == "abre spotify"


def test_unrelated_long_phrase_does_not_trigger_wake_word() -> None:
    aliases = VoiceEngine._wake_aliases("Bolty")
    assert VoiceEngine._wake_match("sube el volumen del sistema", aliases) == ""
