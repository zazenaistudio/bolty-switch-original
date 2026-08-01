from __future__ import annotations

from dataclasses import dataclass
from typing import Final

APP_NAME: Final = "Bolty Switch"
APP_VERSION: Final = "0.6.6"
APP_AUTHOR: Final = "Zazen AI Studio"
APP_ORG: Final = "Zazen AI Studio"
WAKE_WORD: Final = "bolty"

CATEGORY_ORDER: Final[list[str]] = [
    "Principal",
    "Aplicaciones",
    "Páginas Webs",
    "Películas y Series",
    "Música",
    "Documentos",
    "Imágenes",
    "Otros",
    "Tareas",
    "Sistema",
    "Guiones",
    "Opciones",
    "Ayuda",
    "Acerca De",
]

EVENT_CATEGORIES: Final[list[str]] = [
    "Aplicaciones",
    "Páginas Webs",
    "Películas y Series",
    "Música",
    "Documentos",
    "Imágenes",
    "Otros",
    "Tareas",
    "Guiones",
]

CATEGORY_ICONS: Final[dict[str, str]] = {
    "Principal": "⌂",
    "Aplicaciones": "▣",
    "Páginas Webs": "◎",
    "Películas y Series": "▶",
    "Música": "♫",
    "Documentos": "▤",
    "Imágenes": "▧",
    "Otros": "◇",
    "Tareas": "⚡",
    "Sistema": "◉",
    "Guiones": "⛓",
    "Opciones": "⚙",
    "Ayuda": "?",
    "Acerca De": "ⓘ",
}

CATEGORY_MASCOTS: Final[dict[str, str]] = {
    "Principal": "02_bolty_principal.png",
    "Aplicaciones": "03_bolty_aplicaciones.png",
    "Páginas Webs": "04_bolty_paginas_web.png",
    "Películas y Series": "05_bolty_peliculas_series.png",
    "Música": "06_bolty_musica.png",
    "Documentos": "07_bolty_documentos.png",
    "Imágenes": "08_bolty_imagenes.png",
    "Otros": "09_bolty_otros.png",
    "Tareas": "10_bolty_tareas.png",
    "Sistema": "11_bolty_sistema.png",
    "Guiones": "12_bolty_guiones.png",
    "Opciones": "13_bolty_opciones.png",
    "Ayuda": "14_bolty_ayuda.png",
    "Acerca De": "15_bolty_acerca_de.png",
}

ASSISTANT_MASCOTS: Final[dict[str, str]] = {
    "idle": "16_bolty_asistente_reposo.png",
    "searching": "17_bolty_buscando.png",
    "listening": "18_bolty_escuchando.png",
    "hands_free": "19_bolty_modo_manos_libres.png",
    "thinking": "20_bolty_pensando.png",
    "executing": "21_bolty_ejecutando.png",
    "success": "22_bolty_ejecucion_correcta.png",
    "error": "23_bolty_error.png",
    "create": "24_bolty_crear_evento.png",
    "edit": "25_bolty_editar_evento.png",
    "delete": "26_bolty_eliminar_evento.png",
    "duplicate": "27_bolty_comando_duplicado.png",
    "invalid": "28_bolty_ruta_invalida.png",
    "empty": "29_bolty_categoria_vacia.png",
    "no_results": "30_bolty_sin_resultados.png",
    "script": "31_bolty_guion_ejecutandose.png",
    "voice": "32_bolty_comandos_voz_microfono.png",
}

ICON_LIBRARY: Final[list[str]] = [
    "⚡", "★", "▶", "♫", "♬", "▣", "◎", "▤", "▧", "◇", "◉", "⛓",
    "⚙", "⌂", "☁", "☾", "☀", "✦", "✧", "✎", "✉", "⌁", "⌘", "◈",
    "🎬", "🎮", "🎵", "📁", "📄", "🖼", "🌐", "💻", "🧠", "🔋", "🔊", "🎧",
]

DANGEROUS_TASKS: Final[set[str]] = {"shutdown", "restart", "sign_out", "empty_recycle_bin"}


@dataclass(frozen=True)
class TaskDefinition:
    name_es: str
    name_en: str
    action: str
    icon: str
    commands_es: tuple[str, ...]
    commands_en: tuple[str, ...]
    description_es: str
    description_en: str


DEFAULT_TASKS: Final[tuple[TaskDefinition, ...]] = (
    TaskDefinition("Subir volumen", "Volume up", "volume_up", "🔊", ("sube el volumen", "aumenta el volumen"), ("volume up", "increase the volume"), "Aumenta el volumen general.", "Raises the master volume."),
    TaskDefinition("Bajar volumen", "Volume down", "volume_down", "🔉", ("baja el volumen", "reduce el volumen"), ("volume down", "decrease the volume"), "Reduce el volumen general.", "Lowers the master volume."),
    TaskDefinition("Silenciar sonido", "Mute sound", "volume_mute", "🔇", ("silencia el sonido", "quita el sonido"), ("mute sound", "mute the volume"), "Activa o desactiva el silencio.", "Toggles master mute."),
    TaskDefinition("Reproducir o pausar", "Play or pause", "media_play_pause", "⏯", ("pausa la música", "reanuda la música", "reproducir o pausar"), ("pause music", "resume music", "play or pause"), "Control multimedia global.", "Global media control."),
    TaskDefinition("Pista siguiente", "Next track", "media_next", "⏭", ("siguiente canción", "pasa de canción"), ("next song", "next track"), "Salta al siguiente contenido multimedia.", "Skips to the next media item."),
    TaskDefinition("Pista anterior", "Previous track", "media_previous", "⏮", ("canción anterior", "vuelve a la canción anterior"), ("previous song", "previous track"), "Vuelve al contenido multimedia anterior.", "Returns to the previous media item."),
    TaskDefinition("Subir brillo", "Brightness up", "brightness_up", "☀", ("sube el brillo", "aumenta el brillo"), ("brightness up", "increase brightness"), "Aumenta el brillo en pantallas compatibles.", "Raises brightness on supported displays."),
    TaskDefinition("Bajar brillo", "Brightness down", "brightness_down", "☾", ("baja el brillo", "reduce el brillo"), ("brightness down", "decrease brightness"), "Reduce el brillo en pantallas compatibles.", "Lowers brightness on supported displays."),
    TaskDefinition("Activar Wi-Fi", "Enable Wi-Fi", "wifi_on", "📶", ("activa el wifi", "enciende el wifi"), ("enable wifi", "turn wifi on"), "Activa el adaptador inalámbrico principal.", "Enables the primary wireless adapter."),
    TaskDefinition("Desactivar Wi-Fi", "Disable Wi-Fi", "wifi_off", "📵", ("desactiva el wifi", "apaga el wifi"), ("disable wifi", "turn wifi off"), "Desactiva el adaptador inalámbrico principal.", "Disables the primary wireless adapter."),
    TaskDefinition("Activar Bluetooth", "Enable Bluetooth", "bluetooth_on", "ᛒ", ("activa el bluetooth", "enciende el bluetooth"), ("enable bluetooth", "turn bluetooth on"), "Intenta habilitar el adaptador Bluetooth; puede requerir permisos.", "Attempts to enable the Bluetooth adapter; elevation may be required."),
    TaskDefinition("Desactivar Bluetooth", "Disable Bluetooth", "bluetooth_off", "ᛒ", ("desactiva el bluetooth", "apaga el bluetooth"), ("disable bluetooth", "turn bluetooth off"), "Intenta deshabilitar el adaptador Bluetooth; puede requerir permisos.", "Attempts to disable the Bluetooth adapter; elevation may be required."),
    TaskDefinition("Abrir Bluetooth", "Open Bluetooth", "open_bluetooth", "ᛒ", ("abre bluetooth", "configura el bluetooth"), ("open bluetooth", "bluetooth settings"), "Abre la configuración segura de Bluetooth.", "Opens Bluetooth settings."),
    TaskDefinition("Abrir modo avión", "Open airplane mode", "open_airplane", "✈", ("abre el modo avión", "configura el modo avión"), ("open airplane mode", "airplane mode settings"), "Abre los controles de modo avión.", "Opens airplane-mode controls."),
    TaskDefinition("Abrir no molestar", "Open do not disturb", "open_dnd", "☾", ("abre no molestar", "configura no molestar"), ("open do not disturb", "do not disturb settings"), "Abre la configuración de notificaciones.", "Opens notification settings."),
    TaskDefinition("Bloquear equipo", "Lock computer", "lock", "🔒", ("bloquea el equipo", "bloquea el ordenador"), ("lock computer", "lock the pc"), "Bloquea la sesión actual.", "Locks the current session."),
    TaskDefinition("Suspender equipo", "Sleep computer", "sleep", "💤", ("suspende el equipo", "pon el ordenador en suspensión"), ("sleep computer", "put the pc to sleep"), "Pone Windows en suspensión.", "Puts Windows to sleep."),
    TaskDefinition("Apagar equipo", "Shut down", "shutdown", "⏻", ("apaga el equipo", "apaga el ordenador"), ("shut down the computer", "turn off the pc"), "Apaga Windows tras confirmación.", "Shuts Windows down after confirmation."),
    TaskDefinition("Reiniciar equipo", "Restart", "restart", "↻", ("reinicia el equipo", "reinicia el ordenador"), ("restart the computer", "reboot the pc"), "Reinicia Windows tras confirmación.", "Restarts Windows after confirmation."),
    TaskDefinition("Cerrar sesión", "Sign out", "sign_out", "⇥", ("cierra mi sesión", "cerrar sesión"), ("sign out", "log me out"), "Cierra la sesión tras confirmación.", "Signs out after confirmation."),
    TaskDefinition("Mostrar escritorio", "Show desktop", "show_desktop", "▱", ("muestra el escritorio", "ve al escritorio"), ("show desktop", "go to desktop"), "Minimiza o restaura las ventanas.", "Toggles the desktop."),
    TaskDefinition("Abrir Explorador", "Open File Explorer", "open_explorer", "📁", ("abre el explorador", "abre mis archivos"), ("open file explorer", "open my files"), "Abre el Explorador de archivos.", "Opens File Explorer."),
    TaskDefinition("Abrir Administrador de tareas", "Open Task Manager", "open_task_manager", "▥", ("abre el administrador de tareas",), ("open task manager",), "Abre el Administrador de tareas.", "Opens Task Manager."),
    TaskDefinition("Abrir Configuración", "Open Settings", "open_settings", "⚙", ("abre configuración", "abre los ajustes"), ("open settings",), "Abre Configuración de Windows.", "Opens Windows Settings."),
    TaskDefinition("Abrir sonido", "Open sound settings", "open_sound", "🎧", ("abre configuración de sonido", "configura el sonido"), ("open sound settings",), "Abre los ajustes de sonido.", "Opens sound settings."),
    TaskDefinition("Abrir pantalla", "Open display settings", "open_display", "▣", ("abre configuración de pantalla", "configura la pantalla"), ("open display settings",), "Abre los ajustes de pantalla.", "Opens display settings."),
    TaskDefinition("Abrir red", "Open network settings", "open_network", "🌐", ("abre configuración de red", "configura internet"), ("open network settings",), "Abre los ajustes de red.", "Opens network settings."),
    TaskDefinition("Abrir energía", "Open power settings", "open_power", "🔋", ("abre configuración de energía",), ("open power settings",), "Abre los ajustes de energía.", "Opens power settings."),
    TaskDefinition("Abrir almacenamiento", "Open storage settings", "open_storage", "💾", ("abre almacenamiento", "configura el almacenamiento"), ("open storage settings",), "Abre los ajustes de almacenamiento.", "Opens storage settings."),
    TaskDefinition("Captura de pantalla", "Screenshot", "screenshot", "📷", ("haz una captura de pantalla", "captura la pantalla"), ("take a screenshot",), "Abre la herramienta de recortes.", "Opens the snipping tool."),
    TaskDefinition("Vaciar papelera", "Empty recycle bin", "empty_recycle_bin", "🗑", ("vacía la papelera",), ("empty recycle bin",), "Vacía la papelera tras confirmación.", "Empties the recycle bin after confirmation."),
    TaskDefinition("Limpiar portapapeles", "Clear clipboard", "clear_clipboard", "📋", ("limpia el portapapeles", "borra el portapapeles"), ("clear clipboard",), "Borra el contenido actual del portapapeles.", "Clears the clipboard."),
    TaskDefinition("Calculadora", "Calculator", "open_calculator", "🧮", ("abre la calculadora",), ("open calculator",), "Abre la calculadora de Windows.", "Opens Windows Calculator."),
    TaskDefinition("Terminal", "Terminal", "open_terminal", ">_", ("abre la terminal", "abre powershell"), ("open terminal", "open powershell"), "Abre Windows Terminal o PowerShell.", "Opens Windows Terminal or PowerShell."),
    TaskDefinition("Panel de control", "Control Panel", "open_control_panel", "◫", ("abre el panel de control",), ("open control panel",), "Abre el Panel de control clásico.", "Opens Control Panel."),
    TaskDefinition("Administrar dispositivos", "Device Manager", "open_device_manager", "🔌", ("abre el administrador de dispositivos",), ("open device manager",), "Abre el Administrador de dispositivos.", "Opens Device Manager."),
    TaskDefinition("Abrir ubicación", "Open location settings", "open_location", "⌖", ("abre configuración de ubicación", "configura el gps"), ("open location settings", "gps settings"), "Abre los permisos y servicios de ubicación.", "Opens location permissions and services."),
    TaskDefinition("Abrir notificaciones", "Open notifications", "open_notifications", "🔔", ("abre las notificaciones", "configura las notificaciones"), ("open notifications", "notification settings"), "Abre notificaciones y no molestar.", "Opens notifications and do not disturb."),
    TaskDefinition("Abrir luz nocturna", "Open night light", "open_night_light", "🌙", ("abre la luz nocturna", "configura la luz nocturna"), ("open night light", "night light settings"), "Abre la configuración de luz nocturna.", "Opens night-light settings."),
    TaskDefinition("Windows Update", "Windows Update", "open_windows_update", "↻", ("abre windows update", "busca actualizaciones de windows"), ("open windows update", "check windows updates"), "Abre Windows Update.", "Opens Windows Update."),
    TaskDefinition("Seguridad de Windows", "Windows Security", "open_security", "🛡", ("abre seguridad de windows", "abre windows defender"), ("open windows security", "open windows defender"), "Abre Seguridad de Windows.", "Opens Windows Security."),
    TaskDefinition("Aplicaciones instaladas", "Installed apps", "open_installed_apps", "▣", ("abre aplicaciones instaladas", "gestiona aplicaciones"), ("open installed apps", "manage apps"), "Abre la lista de aplicaciones instaladas.", "Opens the installed apps list."),
    TaskDefinition("Aplicaciones predeterminadas", "Default apps", "open_default_apps", "◇", ("abre aplicaciones predeterminadas",), ("open default apps",), "Abre las asociaciones de aplicaciones.", "Opens default-app associations."),
    TaskDefinition("Impresoras", "Printers", "open_printers", "🖨", ("abre las impresoras", "configura la impresora"), ("open printers", "printer settings"), "Abre impresoras y escáneres.", "Opens printers and scanners."),
    TaskDefinition("Ratón y panel táctil", "Mouse and touchpad", "open_mouse", "🖱", ("abre configuración del ratón", "configura el mouse"), ("open mouse settings", "mouse settings"), "Abre los ajustes del ratón y panel táctil.", "Opens mouse and touchpad settings."),
    TaskDefinition("Teclado y escritura", "Keyboard and typing", "open_keyboard", "⌨", ("abre configuración del teclado", "configura el teclado"), ("open keyboard settings", "typing settings"), "Abre las opciones de escritura.", "Opens typing settings."),
    TaskDefinition("Configuración del portapapeles", "Clipboard settings", "open_clipboard_settings", "📋", ("abre configuración del portapapeles",), ("open clipboard settings",), "Abre historial y sincronización del portapapeles.", "Opens clipboard history and sync settings."),
    TaskDefinition("Personalización", "Personalization", "open_personalization", "✦", ("abre personalización", "cambia el fondo de pantalla"), ("open personalization", "change wallpaper settings"), "Abre temas, fondo y colores.", "Opens themes, background and colors."),
    TaskDefinition("Fecha y hora", "Date and time", "open_datetime", "🕒", ("abre fecha y hora", "configura la hora"), ("open date and time", "time settings"), "Abre los ajustes de fecha y hora.", "Opens date and time settings."),
    TaskDefinition("Idioma y región", "Language and region", "open_language", "🌐", ("abre idioma y región", "configura el idioma de windows"), ("open language and region", "windows language settings"), "Abre idioma, región y formato.", "Opens language, region and formats."),
    TaskDefinition("Accesibilidad", "Accessibility", "open_accessibility", "◉", ("abre accesibilidad",), ("open accessibility",), "Abre las opciones de accesibilidad.", "Opens accessibility settings."),
    TaskDefinition("Información del equipo", "About this PC", "open_about", "ⓘ", ("abre información del equipo", "acerca de este pc"), ("open about this pc", "system information"), "Abre las especificaciones del dispositivo.", "Opens device specifications."),
    TaskDefinition("Cuentas", "Accounts", "open_accounts", "👤", ("abre configuración de cuentas",), ("open account settings",), "Abre las cuentas de Windows.", "Opens Windows account settings."),
    TaskDefinition("Privacidad del micrófono", "Microphone privacy", "open_microphone_privacy", "🎙", ("abre permisos del micrófono",), ("open microphone privacy",), "Abre los permisos de micrófono.", "Opens microphone permissions."),
    TaskDefinition("Privacidad de la cámara", "Camera privacy", "open_camera_privacy", "📷", ("abre permisos de cámara",), ("open camera privacy",), "Abre los permisos de cámara.", "Opens camera permissions."),
    TaskDefinition("Carpeta Descargas", "Downloads folder", "open_downloads", "⬇", ("abre descargas", "abre mi carpeta de descargas"), ("open downloads", "open downloads folder"), "Abre la carpeta Descargas del usuario.", "Opens the user Downloads folder."),
    TaskDefinition("Carpeta Documentos", "Documents folder", "open_documents_folder", "📄", ("abre mi carpeta de documentos",), ("open documents folder",), "Abre la carpeta Documentos del usuario.", "Opens the user Documents folder."),
    TaskDefinition("Carpeta Imágenes", "Pictures folder", "open_pictures_folder", "🖼", ("abre mi carpeta de imágenes", "abre mis fotos"), ("open pictures folder", "open my pictures"), "Abre la carpeta Imágenes del usuario.", "Opens the user Pictures folder."),
    TaskDefinition("Abrir papelera", "Open recycle bin", "open_recycle_bin", "🗑", ("abre la papelera",), ("open recycle bin",), "Abre la Papelera de reciclaje.", "Opens the Recycle Bin."),
    TaskDefinition("Historial del portapapeles", "Clipboard history", "shortcut_clipboard_history", "📋", ("muestra el historial del portapapeles",), ("show clipboard history",), "Pulsa Windows + V.", "Presses Windows + V."),
    TaskDefinition("Panel de emojis", "Emoji panel", "shortcut_emoji", "😊", ("abre el panel de emojis",), ("open emoji panel",), "Pulsa Windows + punto.", "Presses Windows + period."),
    TaskDefinition("Dictado por voz", "Voice typing", "shortcut_dictation", "🎙", ("abre el dictado", "activa escritura por voz"), ("open voice typing", "start dictation"), "Pulsa Windows + H.", "Presses Windows + H."),
    TaskDefinition("Ventana Ejecutar", "Run dialog", "shortcut_run", "⌘", ("abre ejecutar", "abre la ventana ejecutar"), ("open run dialog",), "Pulsa Windows + R.", "Presses Windows + R."),
    TaskDefinition("Búsqueda de Windows", "Windows Search", "shortcut_search", "⌕", ("abre la búsqueda de windows",), ("open windows search",), "Pulsa Windows + S.", "Presses Windows + S."),
    TaskDefinition("Vista de tareas", "Task view", "shortcut_task_view", "▦", ("abre la vista de tareas",), ("open task view",), "Pulsa Windows + Tab.", "Presses Windows + Tab."),
    TaskDefinition("Ajustes rápidos", "Quick settings", "shortcut_quick_settings", "⚡", ("abre los ajustes rápidos",), ("open quick settings",), "Pulsa Windows + A.", "Presses Windows + A."),
    TaskDefinition("Centro de notificaciones", "Notification center", "shortcut_notifications", "🔔", ("abre el centro de notificaciones",), ("open notification center",), "Pulsa Windows + N.", "Presses Windows + N."),
    TaskDefinition("Proyectar pantalla", "Project display", "shortcut_project", "▣", ("abre proyectar pantalla", "proyecta la pantalla"), ("open project display", "project screen"), "Pulsa Windows + P.", "Presses Windows + P."),
    TaskDefinition("Minimizar ventanas", "Minimize windows", "shortcut_minimize_all", "▱", ("minimiza todas las ventanas",), ("minimize all windows",), "Pulsa Windows + M.", "Presses Windows + M."),
    TaskDefinition("Restaurar ventanas", "Restore windows", "shortcut_restore_all", "▰", ("restaura todas las ventanas",), ("restore all windows",), "Pulsa Windows + Mayús + M.", "Presses Windows + Shift + M."),
)
