from bolty_switch.services.settings_service import SettingsService


def test_cosmic_theme_default_and_persistence(tmp_path):
    path = tmp_path / "settings.json"
    settings = SettingsService(path)
    assert settings.get("cosmic_theme") == "nebula-blue"

    settings.update({"cosmic_theme": "violet-dream"})
    loaded = SettingsService(path)
    assert loaded.get("cosmic_theme") == "violet-dream"
