from __future__ import annotations

import ctypes
import os
from datetime import datetime
import platform
import re
import subprocess
import sys
from pathlib import Path

import psutil

from ..models import SystemStatus


CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0


def _run(command: list[str], timeout: float = 4.0) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=timeout,
        encoding="utf-8",
        errors="replace",
        creationflags=CREATE_NO_WINDOW,
        check=False,
    )


def _powershell(script: str, timeout: float = 5.0) -> str:
    if sys.platform != "win32":
        return ""
    result = _run(["powershell", "-NoProfile", "-NonInteractive", "-Command", script], timeout)
    return result.stdout.strip()


class SystemService:
    def collect(self) -> list[SystemStatus]:
        cpu = psutil.cpu_percent(interval=0.12)
        memory = psutil.virtual_memory()
        disk_root = Path(os.getenv("SystemDrive", "C:") + "\\") if sys.platform == "win32" else Path("/")
        try:
            disk = psutil.disk_usage(str(disk_root))
        except OSError:
            disk = psutil.disk_usage("/")

        uptime_seconds = max(0, int(datetime.now().timestamp() - psutil.boot_time()))
        uptime_days, remainder = divmod(uptime_seconds, 86400)
        uptime_hours, remainder = divmod(remainder, 3600)
        uptime_minutes = remainder // 60
        uptime_text = f"{uptime_days} d {uptime_hours} h" if uptime_days else f"{uptime_hours} h {uptime_minutes} min"
        statuses: list[SystemStatus] = [
            SystemStatus("os", "Windows", platform.platform(), platform.node() or "Equipo local", "▣", True, "ms-settings:about"),
            SystemStatus("cpu", "Procesador", f"{cpu:.0f}%", f"{psutil.cpu_count(logical=True) or 0} procesadores lógicos", "◈", cpu < 90),
            SystemStatus("memory", "Memoria RAM", f"{memory.percent:.0f}%", f"{memory.used / 1024**3:.1f} / {memory.total / 1024**3:.1f} GB", "▤", memory.percent < 90),
            SystemStatus("disk", "Almacenamiento", f"{disk.percent:.0f}%", f"{disk.free / 1024**3:.1f} GB libres", "💾", disk.percent < 92, "ms-settings:storagesense"),
            SystemStatus("uptime", "Tiempo encendido", uptime_text, f"{len(psutil.pids())} procesos activos", "⏱", True),
        ]
        volume, muted = self.get_master_volume()
        if volume is None:
            statuses.append(SystemStatus("volume", "Volumen", "Control disponible", "Abre Sonido para consultar el nivel exacto", "🔊", None, "ms-settings:sound"))
        else:
            level = round(volume * 100)
            statuses.append(SystemStatus("volume", "Volumen", "Silenciado" if muted else f"{level}%", "Volumen general de Windows", "🔇" if muted else "🔊", not muted, "ms-settings:sound"))
        statuses.extend(self._battery_status())
        statuses.extend(self._network_statuses())
        statuses.extend(self._windows_radio_statuses())
        statuses.extend(self._privacy_statuses())
        return statuses

    @staticmethod
    def _battery_status() -> list[SystemStatus]:
        battery = psutil.sensors_battery()
        if battery is None:
            return [SystemStatus("battery", "Batería", "No detectada", "Equipo de sobremesa o batería no disponible", "🔌", None, "ms-settings:batterysaver")]
        state = "Cargando" if battery.power_plugged else "En batería"
        return [SystemStatus("battery", "Batería", f"{battery.percent:.0f}%", state, "🔋", battery.percent > 20 or battery.power_plugged, "ms-settings:batterysaver")]

    def _network_statuses(self) -> list[SystemStatus]:
        connected = any(stat.isup for name, stat in psutil.net_if_stats().items() if not name.lower().startswith("loopback"))
        internet = SystemStatus(
            "network", "Red", "Conectada" if connected else "Sin conexión",
            "Hay al menos un adaptador activo" if connected else "No se detectan adaptadores conectados",
            "🌐", connected, "ms-settings:network-status",
        )
        if sys.platform != "win32":
            return [internet]
        output = _run(["netsh", "wlan", "show", "interfaces"]).stdout
        lowered = output.lower()
        is_connected = bool(re.search(r"(?:state|estado)\s*:\s*(?:connected|conectado)", lowered))
        ssid_match = re.search(r"^\s*SSID\s*:\s*(.+)$", output, re.MULTILINE | re.IGNORECASE)
        ssid = ssid_match.group(1).strip() if ssid_match else ""
        wifi_state = "Conectado" if is_connected else ("Disponible" if "interface" in lowered or "interfaz" in lowered else "No detectado")
        wifi_detail = ssid if ssid and is_connected else "Adaptador inalámbrico"
        return [internet, SystemStatus("wifi", "Wi-Fi", wifi_state, wifi_detail, "📶", is_connected, "ms-settings:network-wifi")]

    def _windows_radio_statuses(self) -> list[SystemStatus]:
        if sys.platform != "win32":
            return [
                SystemStatus("bluetooth", "Bluetooth", "Solo Windows", "Estado no disponible en este sistema", "ᛒ", None),
                SystemStatus("location", "Ubicación / GPS", "Solo Windows", "Estado no disponible", "⌖", None),
            ]
        service_script = (
            "$names='bthserv','lfsvc','WpnUserService*','RmSvc';"
            "Get-Service $names -ErrorAction SilentlyContinue | "
            "ForEach-Object {\"$($_.Name)|$($_.Status)|$($_.StartType)\"}"
        )
        rows = _powershell(service_script).splitlines()
        services: dict[str, tuple[str, str]] = {}
        for row in rows:
            parts = row.split("|")
            if len(parts) >= 3:
                services[parts[0].lower()] = (parts[1], parts[2])

        bluetooth_row = next((v for k, v in services.items() if k == "bthserv"), None)
        bluetooth_running = bool(bluetooth_row and bluetooth_row[0].lower() == "running")
        location_row = next((v for k, v in services.items() if k == "lfsvc"), None)
        location_running = bool(location_row and location_row[0].lower() == "running")
        notif_row = next((v for k, v in services.items() if k.startswith("wpnuserservice")), None)
        notifications_running = bool(notif_row and notif_row[0].lower() == "running")
        radio_row = next((v for k, v in services.items() if k == "rmsvc"), None)
        radio_running = bool(radio_row and radio_row[0].lower() == "running")

        return [
            SystemStatus("bluetooth", "Bluetooth", "Servicio activo" if bluetooth_running else "Servicio detenido", "Pulsa para abrir los controles del radio", "ᛒ", bluetooth_running, "ms-settings:bluetooth"),
            SystemStatus("location", "Ubicación / GPS", "Servicio activo" if location_running else "Servicio detenido", "La disponibilidad real depende del hardware", "⌖", location_running, "ms-settings:privacy-location"),
            SystemStatus("airplane", "Modo avión", "Controles disponibles" if radio_running else "Servicio no detectado", "Windows no ofrece un estado fiable sin APIs de radio", "✈", None, "ms-settings:network-airplanemode"),
            SystemStatus("dnd", "No molestar", "Notificaciones activas" if notifications_running else "Servicio detenido", "Pulsa para consultar la configuración actual", "☾", None, "ms-settings:notifications"),
        ]

    @staticmethod
    def _privacy_statuses() -> list[SystemStatus]:
        return [
            SystemStatus("microphone", "Micrófono", "Configurable", "Permisos de privacidad y dispositivos", "🎙", None, "ms-settings:privacy-microphone"),
            SystemStatus("camera", "Cámara", "Configurable", "Permisos de privacidad y dispositivos", "📷", None, "ms-settings:privacy-webcam"),
            SystemStatus("night_light", "Luz nocturna", "Configurable", "Pulsa para ver su estado exacto", "☀", None, "ms-settings:nightlight"),
            SystemStatus("focus", "Sesiones de concentración", "Disponible", "Temporizador y no molestar", "◉", None, "ms-clock:focus"),
        ]

    @staticmethod
    def open_settings(uri: str) -> None:
        if not uri:
            return
        if sys.platform == "win32":
            os.startfile(uri)  # type: ignore[attr-defined]
        else:
            subprocess.Popen(["xdg-open", uri])

    @staticmethod
    def get_master_volume() -> tuple[float | None, bool | None]:
        # Exact Core Audio level querying is intentionally optional. The task
        # controls themselves use native Windows volume keys and need no package.
        return None, None
