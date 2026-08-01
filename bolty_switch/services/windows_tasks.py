from __future__ import annotations

import base64
import ctypes
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Final, Iterable

from .system_service import CREATE_NO_WINDOW, SystemService


class WindowsTaskError(RuntimeError):
    """Raised when an allow-listed Windows task cannot be completed."""


@dataclass(frozen=True)
class TaskPlan:
    action: str
    kind: str
    value: object
    requires_admin: bool = False


SETTINGS_URIS: Final[dict[str, str]] = {
    "open_bluetooth": "ms-settings:bluetooth",
    "open_airplane": "ms-settings:network-airplanemode",
    "open_dnd": "ms-settings:notifications",
    "open_settings": "ms-settings:",
    "open_sound": "ms-settings:sound",
    "open_display": "ms-settings:display",
    "open_network": "ms-settings:network-status",
    "open_power": "ms-settings:powersleep",
    "open_storage": "ms-settings:storagesense",
    "open_location": "ms-settings:privacy-location",
    "open_notifications": "ms-settings:notifications",
    "open_night_light": "ms-settings:nightlight",
    "open_windows_update": "ms-settings:windowsupdate",
    "open_security": "ms-settings:windowsdefender",
    "open_installed_apps": "ms-settings:appsfeatures",
    "open_default_apps": "ms-settings:defaultapps",
    "open_printers": "ms-settings:printers",
    "open_mouse": "ms-settings:mousetouchpad",
    "open_keyboard": "ms-settings:typing",
    "open_clipboard_settings": "ms-settings:clipboard",
    "open_personalization": "ms-settings:personalization",
    "open_datetime": "ms-settings:dateandtime",
    "open_language": "ms-settings:regionlanguage",
    "open_accessibility": "ms-settings:easeofaccess-display",
    "open_about": "ms-settings:about",
    "open_accounts": "ms-settings:yourinfo",
    "open_microphone_privacy": "ms-settings:privacy-microphone",
    "open_camera_privacy": "ms-settings:privacy-webcam",
}

COMMANDS: Final[dict[str, tuple[str, ...]]] = {
    "lock": ("rundll32.exe", "user32.dll,LockWorkStation"),
    "sleep": ("rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"),
    "shutdown": ("shutdown.exe", "/s", "/t", "0"),
    "restart": ("shutdown.exe", "/r", "/t", "0"),
    "sign_out": ("shutdown.exe", "/l"),
    "open_explorer": ("explorer.exe",),
    "open_task_manager": ("taskmgr.exe",),
    "open_calculator": ("calc.exe",),
    "open_control_panel": ("control.exe",),
    "open_device_manager": ("mmc.exe", "devmgmt.msc"),
    # URI launches the modern Windows snipping overlay rather than only opening the app.
    "screenshot": ("explorer.exe", "ms-screenclip:"),
}

SPECIAL_FOLDERS: Final[dict[str, str]] = {
    "open_downloads": "shell:Downloads",
    "open_documents_folder": "shell:Personal",
    "open_pictures_folder": "shell:My Pictures",
    "open_recycle_bin": "shell:RecycleBinFolder",
}

SHORTCUTS: Final[dict[str, tuple[tuple[int, ...], int]]] = {
    "show_desktop": ((0x5B,), 0x44),
    "shortcut_clipboard_history": ((0x5B,), 0x56),
    "shortcut_emoji": ((0x5B,), 0xBE),
    "shortcut_dictation": ((0x5B,), 0x48),
    "shortcut_run": ((0x5B,), 0x52),
    "shortcut_search": ((0x5B,), 0x53),
    "shortcut_task_view": ((0x5B,), 0x09),
    "shortcut_quick_settings": ((0x5B,), 0x41),
    "shortcut_notifications": ((0x5B,), 0x4E),
    "shortcut_project": ((0x5B,), 0x50),
    "shortcut_minimize_all": ((0x5B,), 0x4D),
    "shortcut_restore_all": ((0x5B, 0x10), 0x4D),
}

MEDIA_KEYS: Final[dict[str, int]] = {
    "media_next": 0xB0,
    "media_previous": 0xB1,
    "media_play_pause": 0xB3,
}

# Native Windows virtual keys. These remove the pycaw/comtypes dependency from
# volume tasks and work in both development and the packaged sidecar.
VOLUME_KEYS: Final[dict[str, tuple[int, int]]] = {
    "volume_mute": (0xAD, 1),
    "volume_down": (0xAE, 3),
    "volume_up": (0xAF, 3),
}


def plan_task(action: str) -> TaskPlan:
    action = action.strip()
    if action in SETTINGS_URIS:
        return TaskPlan(action, "settings_uri", SETTINGS_URIS[action])
    if action in VOLUME_KEYS:
        return TaskPlan(action, "virtual_key", VOLUME_KEYS[action])
    if action in MEDIA_KEYS:
        return TaskPlan(action, "virtual_key", (MEDIA_KEYS[action], 1))
    if action in SHORTCUTS:
        return TaskPlan(action, "shortcut", SHORTCUTS[action])
    if action in SPECIAL_FOLDERS:
        return TaskPlan(action, "special_folder", SPECIAL_FOLDERS[action])
    if action in COMMANDS:
        return TaskPlan(action, "command", COMMANDS[action])
    if action == "open_terminal":
        return TaskPlan(action, "terminal", ())
    if action == "clear_clipboard":
        return TaskPlan(action, "clear_clipboard", None)
    if action == "empty_recycle_bin":
        return TaskPlan(action, "empty_recycle_bin", None)
    if action in {"brightness_up", "brightness_down"}:
        return TaskPlan(action, "brightness", 10 if action == "brightness_up" else -10)
    if action in {"wifi_on", "wifi_off"}:
        return TaskPlan(action, "wifi", action == "wifi_on", requires_admin=True)
    if action in {"bluetooth_on", "bluetooth_off"}:
        return TaskPlan(action, "bluetooth", action == "bluetooth_on", requires_admin=True)
    raise WindowsTaskError(f"Tarea no compatible o no permitida: {action or '(vacía)'}")


SUPPORTED_TASK_ACTIONS: Final[frozenset[str]] = frozenset(
    set(SETTINGS_URIS)
    | set(COMMANDS)
    | set(SPECIAL_FOLDERS)
    | set(SHORTCUTS)
    | set(MEDIA_KEYS)
    | set(VOLUME_KEYS)
    | {
        "open_terminal",
        "clear_clipboard",
        "empty_recycle_bin",
        "brightness_up",
        "brightness_down",
        "wifi_on",
        "wifi_off",
        "bluetooth_on",
        "bluetooth_off",
    }
)


def audit_task_actions(actions: Iterable[str]) -> dict[str, object]:
    values = list(actions)
    unique = set(values)
    duplicates = sorted({item for item in values if values.count(item) > 1})
    missing = sorted(unique - SUPPORTED_TASK_ACTIONS)
    unused = sorted(SUPPORTED_TASK_ACTIONS - unique)
    plans: dict[str, str] = {}
    for action in sorted(unique):
        try:
            plans[action] = plan_task(action).kind
        except WindowsTaskError:
            plans[action] = "unsupported"
    return {
        "total": len(values),
        "unique": len(unique),
        "duplicates": duplicates,
        "missing": missing,
        "unused": unused,
        "plans": plans,
    }


class WindowsTaskRunner:
    def execute(self, action: str) -> None:
        self._windows_required()
        plan = plan_task(action)
        if plan.kind == "settings_uri":
            SystemService.open_settings(str(plan.value))
            return
        if plan.kind == "virtual_key":
            key, repeats = plan.value  # type: ignore[misc]
            self._press_key(int(key), int(repeats))
            return
        if plan.kind == "shortcut":
            modifiers, key = plan.value  # type: ignore[misc]
            self._shortcut(tuple(int(item) for item in modifiers), int(key))
            return
        if plan.kind == "special_folder":
            self._spawn(("explorer.exe", str(plan.value)))
            return
        if plan.kind == "command":
            self._spawn(tuple(str(item) for item in plan.value))  # type: ignore[arg-type]
            return
        if plan.kind == "terminal":
            self._open_terminal()
            return
        if plan.kind == "clear_clipboard":
            self._clear_clipboard()
            return
        if plan.kind == "empty_recycle_bin":
            self._empty_recycle_bin()
            return
        if plan.kind == "brightness":
            self._brightness(int(plan.value))
            return
        if plan.kind == "wifi":
            self._wifi(bool(plan.value))
            return
        if plan.kind == "bluetooth":
            self._bluetooth(bool(plan.value))
            return
        raise WindowsTaskError(f"Plan de tarea no reconocido: {plan.kind}")

    @staticmethod
    def _windows_required() -> None:
        if sys.platform != "win32":
            raise WindowsTaskError("Esta tarea requiere Windows.")

    @staticmethod
    def _spawn(command: tuple[str, ...]) -> None:
        try:
            subprocess.Popen(list(command), creationflags=CREATE_NO_WINDOW)
        except FileNotFoundError as exc:
            executable = Path(command[0]).name
            raise WindowsTaskError(f"Windows no encontró el componente necesario: {executable}.") from exc
        except OSError as exc:
            raise WindowsTaskError(f"Windows no pudo iniciar la tarea: {exc}") from exc

    @classmethod
    def _open_terminal(cls) -> None:
        for command in (("wt.exe",), ("powershell.exe",), ("cmd.exe",)):
            try:
                subprocess.Popen(list(command), creationflags=CREATE_NO_WINDOW)
                return
            except FileNotFoundError:
                continue
            except OSError as exc:
                raise WindowsTaskError(f"No se pudo abrir la terminal: {exc}") from exc
        raise WindowsTaskError("No se encontró Windows Terminal, PowerShell ni Símbolo del sistema.")

    @staticmethod
    def _press_key(key: int, repeats: int = 1) -> None:
        user32 = ctypes.windll.user32
        for _ in range(max(1, repeats)):
            user32.keybd_event(key, 0, 0, 0)
            user32.keybd_event(key, 0, 2, 0)
            if repeats > 1:
                time.sleep(0.025)

    @staticmethod
    def _shortcut(modifiers: tuple[int, ...], key: int) -> None:
        user32 = ctypes.windll.user32
        for modifier in modifiers:
            user32.keybd_event(modifier, 0, 0, 0)
        user32.keybd_event(key, 0, 0, 0)
        user32.keybd_event(key, 0, 2, 0)
        for modifier in reversed(modifiers):
            user32.keybd_event(modifier, 0, 2, 0)

    @staticmethod
    def _run_powershell(script: str, *, timeout: float = 15.0) -> subprocess.CompletedProcess[str]:
        try:
            result = subprocess.run(
                ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=CREATE_NO_WINDOW,
                timeout=timeout,
                check=False,
            )
        except FileNotFoundError as exc:
            raise WindowsTaskError("PowerShell no está disponible en este equipo.") from exc
        except subprocess.TimeoutExpired as exc:
            raise WindowsTaskError("Windows tardó demasiado en completar la tarea.") from exc
        if result.returncode != 0:
            message = (result.stderr or result.stdout).strip()
            raise WindowsTaskError(message or "Windows no pudo completar la tarea.")
        return result

    @staticmethod
    def _run_powershell_elevated(script: str, *, timeout: float = 45.0) -> None:
        encoded = base64.b64encode(script.encode("utf-16le")).decode("ascii")
        launcher = (
            "$p=Start-Process powershell.exe -Verb RunAs -Wait -PassThru "
            f"-ArgumentList '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand','{encoded}';"
            "if($null -eq $p){exit 1}; exit $p.ExitCode"
        )
        try:
            result = subprocess.run(
                ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", launcher],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=CREATE_NO_WINDOW,
                timeout=timeout,
                check=False,
            )
        except FileNotFoundError as exc:
            raise WindowsTaskError("PowerShell no está disponible en este equipo.") from exc
        except subprocess.TimeoutExpired as exc:
            raise WindowsTaskError("La solicitud de permisos de administrador agotó el tiempo de espera.") from exc
        if result.returncode != 0:
            message = (result.stderr or result.stdout).strip()
            raise WindowsTaskError(message or "La tarea fue cancelada o Windows no concedió permisos de administrador.")

    @classmethod
    def _brightness(cls, delta: int) -> None:
        script = (
            "$monitor=Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction SilentlyContinue | Select-Object -First 1;"
            "if(-not $monitor){throw 'La pantalla no expone control de brillo WMI. Usa los controles del monitor o Configuración de pantalla.'};"
            "$method=Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue | Select-Object -First 1;"
            "if(-not $method){throw 'No se encontró el controlador de brillo de Windows.'};"
            f"$next=[Math]::Max(0,[Math]::Min(100,[int]$monitor.CurrentBrightness+({delta})));"
            "$method.WmiSetBrightness(1,$next) | Out-Null"
        )
        cls._run_powershell(script)

    @classmethod
    def _wifi(cls, enabled: bool) -> None:
        verb = "Enable-NetAdapter" if enabled else "Disable-NetAdapter"
        script = (
            "$adapter=Get-NetAdapter -Physical -ErrorAction SilentlyContinue | "
            "Where-Object {($_.InterfaceDescription -match 'Wireless|Wi-Fi|802.11|WLAN') -or ($_.Name -match 'Wi-Fi|WLAN')} | Select-Object -First 1;"
            "if(-not $adapter){throw 'No se encontró un adaptador Wi-Fi.'};"
            f"{verb} -Name $adapter.Name -Confirm:$false -ErrorAction Stop"
        )
        try:
            cls._run_powershell(script)
        except WindowsTaskError as exc:
            message = str(exc)
            if "Access is denied" in message or "Acceso denegado" in message or "privilege" in message.lower() or "administrator" in message.lower():
                try:
                    cls._run_powershell_elevated(script)
                    return
                except WindowsTaskError as elevated_exc:
                    raise WindowsTaskError("No se pudo cambiar el Wi-Fi. Acepta el aviso de administrador de Windows e inténtalo de nuevo.") from elevated_exc
            raise

    @classmethod
    def _bluetooth(cls, enabled: bool) -> None:
        # PnP is the most reliable built-in fallback across Windows 10/11. It may
        # require elevation depending on the adapter driver and device policy.
        verb = "Enable-PnpDevice" if enabled else "Disable-PnpDevice"
        script = (
            "$devices=Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | "
            "Where-Object {($_.FriendlyName -match 'Radio|Adapter|Adaptador') -and ($_.InstanceId -match '^(USB|PCI)')};"
            "if(-not $devices){throw 'No se encontró un adaptador Bluetooth compatible.'};"
            f"$devices | {verb} -Confirm:$false -ErrorAction Stop"
        )
        try:
            cls._run_powershell(script)
        except WindowsTaskError as exc:
            message = str(exc)
            if "Access is denied" in message or "Acceso denegado" in message or "privilege" in message.lower() or "administrator" in message.lower():
                try:
                    cls._run_powershell_elevated(script)
                    return
                except WindowsTaskError as elevated_exc:
                    raise WindowsTaskError("No se pudo cambiar Bluetooth. Acepta el aviso de administrador de Windows e inténtalo de nuevo.") from elevated_exc
            raise

    @staticmethod
    def _clear_clipboard() -> None:
        user32 = ctypes.windll.user32
        for attempt in range(5):
            if user32.OpenClipboard(None):
                try:
                    if not user32.EmptyClipboard():
                        raise WindowsTaskError("Windows no pudo vaciar el portapapeles.")
                    return
                finally:
                    user32.CloseClipboard()
            time.sleep(0.06 * (attempt + 1))
        raise WindowsTaskError("El portapapeles está siendo usado por otra aplicación.")

    @staticmethod
    def _empty_recycle_bin() -> None:
        flags = 0x1 | 0x2 | 0x4  # no confirmation, no progress, no sound
        result = ctypes.windll.shell32.SHEmptyRecycleBinW(None, None, flags)
        # S_OK or cancelled/empty-bin result used by Windows shell.
        if result not in (0, -2147418113):
            raise WindowsTaskError("No se pudo vaciar la papelera.")
