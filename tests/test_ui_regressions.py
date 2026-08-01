from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_command_dock_remains_absolutely_positioned() -> None:
    css = (ROOT / "frontend/src/styles/components.css").read_text(encoding="utf-8")
    assert ".command-dock {\n  position: absolute !important;" in css


def test_widget_webviews_reset_desktop_minimums() -> None:
    css = (ROOT / "frontend/src/styles/global.css").read_text(encoding="utf-8")
    assert "html[data-widget]" in css
    assert "min-width: 0 !important;" in css
    assert "min-height: 0 !important;" in css
    assert "background: transparent !important;" in css


def test_widget_input_does_not_use_native_focus_shadow() -> None:
    css = (ROOT / "frontend/src/styles/components.css").read_text(encoding="utf-8")
    assert ".command-widget__input-shell input:focus-visible" in css
    assert "box-shadow: none !important;" in css


def test_microphone_widget_window_matches_compact_layout() -> None:
    rust = (ROOT / "frontend/src-tauri/src/lib.rs").read_text(encoding="utf-8")
    css = (ROOT / "frontend/src/styles/components.css").read_text(encoding="utf-8")
    widget = (ROOT / "frontend/src/WidgetApp.tsx").read_text(encoding="utf-8")
    assert '("microphone-widget", 128.0, 128.0)' in rust
    assert ".microphone-widget__core {" in css
    assert "grid-template-rows: 16px minmax(0, 1fr) 20px;" in css
    assert 'className="microphone-widget__core"' in widget


def test_home_dock_is_bottom_centred_and_settings_is_right_aligned() -> None:
    css = (ROOT / "frontend/src/styles/components.css").read_text(encoding="utf-8")
    assert ".home-dock-zone {\n  position: absolute;" in css
    assert "grid-template-columns: minmax(72px, 1fr) auto minmax(72px, 1fr);" in css
    assert ".home-dock-zone .recent-dock {\n  grid-column: 2;" in css
    assert ".home-settings-button {\n  position: static !important;\n  grid-column: 3;" in css


def test_command_widget_expanded_height_fits_complete_suggestions() -> None:
    rust = (ROOT / "frontend/src-tauri/src/lib.rs").read_text(encoding="utf-8")
    css = (ROOT / "frontend/src/styles/components.css").read_text(encoding="utf-8")
    assert "expanded { 452.0 }" in rust
    assert ".command-widget__suggestion-list {\n  max-height: 218px;" in css
    assert ".command-widget__suggestions-footer {\n  flex: 0 0 auto;" in css


def test_widget_windows_set_a_fully_transparent_webview_background() -> None:
    rust = (ROOT / "frontend/src-tauri/src/lib.rs").read_text(encoding="utf-8")
    css = (ROOT / "frontend/src/styles/components.css").read_text(encoding="utf-8")
    assert ".background_color(Color(0, 0, 0, 0))" in rust
    assert "html[data-widget] .floating-widget::after" in css
    assert "display: none !important;" in css
    assert "backdrop-filter: none !important;" in css


def test_widget_refreshes_voice_settings_before_starting_hands_free() -> None:
    widget = (ROOT / "frontend/src/WidgetApp.tsx").read_text(encoding="utf-8")
    assert "const activeSettings = await refreshVoiceSettings();" in widget
    assert "ipc.voiceStart(activeSettings.language, activeSettings.hands_free, activeSettings.wake_word)" in widget
    assert '"Pulsa para activar"' in widget


def test_motion_event_animation_uses_a_typed_easing_value() -> None:
    events = (ROOT / "frontend/src/components/Events.tsx").read_text(encoding="utf-8")
    assert 'transition: { duration: 0.22, ease: "easeOut" }' in events
    assert '} as const;' in events
    assert 'ease: [0.2, 0.8, 0.2, 1]' not in events.split('export function displayEventIcon', 1)[0]


def test_motion_primitives_use_motion_component_props() -> None:
    primitives = (ROOT / "frontend/src/components/Primitives.tsx").read_text(encoding="utf-8")
    assert 'type MotionButtonProps = ComponentPropsWithoutRef<typeof motion.button>;' in primitives
    assert 'type MotionDivProps = ComponentPropsWithoutRef<typeof motion.div>;' in primitives
    assert 'ButtonHTMLAttributes<HTMLButtonElement>' not in primitives
    assert 'HTMLAttributes<HTMLDivElement>' not in primitives


def test_vite_config_does_not_require_global_node_types() -> None:
    vite = (ROOT / "frontend/vite.config.ts").read_text(encoding="utf-8")
    package = (ROOT / "frontend/package.json").read_text(encoding="utf-8")
    assert 'process.env' not in vite
    assert 'globalThis as NodeLikeGlobal' in vite
    assert '"typecheck": "tsc -b"' in package
