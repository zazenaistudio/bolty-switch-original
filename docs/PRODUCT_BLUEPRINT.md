# Bolty Switch 0.2 — Blueprint UX/UI y arquitectura

## 1. Concepto visual

**“Observatorio eléctrico de Bolty”**: una cabina espacial oscura donde cada evento es una órbita accionable. El fondo comunica profundidad, mientras Bolty funciona como guía emocional y estado vivo del sistema. La estética combina ciencia ficción luminosa, interfaces de videojuego y una lectura kawaii accesible para niños y jóvenes.

Principios:

- Profundidad sin ruido: negro azulado, superficies escalonadas y estrellas de baja opacidad.
- Electricidad como respuesta: cian para foco y ejecución; violeta para selección y creación.
- Bolty explica el estado: reposo, búsqueda, escucha, ejecución, éxito, error y vacío.
- Launchpad antes que tabla: tarjetas grandes y reconocibles, con administración secundaria por menú contextual.
- Profesional, no infantilizado: tipografía clara, iconografía coherente y animación contenida.

## 2. Arquitectura de información

1. **Inicio**: resumen, acceso rápido, recientes y actividad.
2. **Biblioteca**: todas las categorías y eventos.
3. **Categorías**: Aplicaciones, Webs, Multimedia, Música, Documentos, Imágenes, Otros y Tareas.
4. **Guiones**: secuencias de eventos.
5. **Sistema**: telemetría y accesos a ajustes de Windows.
6. **Opciones**: apariencia, sonido, voz, comportamiento y accesibilidad.
7. **Ayuda / Acerca de**.

## 3. Mapa de navegación

```text
Splash
└─ AppShell
   ├─ Inicio
   │  ├─ Buscar / ejecutar
   │  ├─ Recientes
   │  └─ Categorías destacadas
   ├─ Biblioteca
   │  └─ Categoría → detalle de evento → editar / ejecutar / eliminar
   ├─ Guiones
   │  └─ Crear / editar secuencia
   ├─ Sistema
   │  └─ Estado → abrir ajuste de Windows
   ├─ Opciones
   │  ├─ General
   │  ├─ Apariencia
   │  ├─ Voz y sonido
   │  └─ Accesibilidad
   ├─ Ayuda
   └─ Acerca de
```

## 4. Paleta y tokens

- `--color-bg: #03040A`
- `--color-surface: #0B1020`
- `--color-primary: #5B8CFF`
- `--color-secondary: #7C4DFF`
- `--color-accent: #2EE6D6`
- `--color-surface-highlight: #19234A`
- `--color-success: #37D39A`
- `--color-danger: #FF5F7A`
- `--color-text: #F3F7FF`
- `--color-text-muted: #8B98B8`

Las variantes hover, pressed, focus, disabled y selected se derivan globalmente mediante mezcla de color y opacidad; ningún componente introduce colores arbitrarios.

## 5. Tipografía

- Interfaz: `Inter`, con fallback `Segoe UI Variable`, `Segoe UI`, sans-serif.
- Titulares narrativos: `Space Grotesk`, con fallback de sistema.
- Escala fluida con `clamp()` entre 12 y 42 px.
- Altura de línea mínima de 1.4 para texto funcional.

## 6. Inventario de componentes

- Shell: AppShell, TitleBar, Sidebar, NavigationItem.
- Acciones: Button, IconButton, ContextMenu.
- Formularios: TextField, SearchField, Select, Switch, Slider.
- Contenido: Card, EventCard, ListItem, StatCard.
- Estado: EmptyState, LoadingState, ErrorState, Skeleton, ProgressIndicator.
- Overlay: Dialog, Toast, Tooltip.
- Marca: CosmicBackdrop, BoltyAssistant, CommandDock.

Todos aceptan variantes mediante propiedades y comparten tokens.

## 7. Pantallas

### Splash
Bolty entra con escala y destello eléctrico; duración máxima de 1,8 s y omisión con reducción de movimiento.

### Inicio
Hero con mensaje, Bolty, acción “Crear evento”, buscador global y categorías destacadas. Debajo aparecen recientes y un resumen de eventos, guiones y estado del asistente.

### Biblioteca / categoría
Cabecera contextual, filtros, orden, cuadrícula responsive y panel de detalle ocultable. Los estados vacíos usan la ilustración específica de Bolty.

### Guiones
Secuencias representadas como líneas orbitales; edición en diálogo por pasos.

### Sistema
Tarjetas de CPU, RAM, almacenamiento, batería, red y servicios. La actualización pesada se solicita al backend.

### Opciones
Navegación interna por secciones; previsualización de tema; sonido, volumen, voz, manos libres, inicio automático y reducción de efectos.

## 8. Estados de interacción

- Hover: elevación de 2 px, borde más luminoso y feedback en 140 ms.
- Pressed: escala 0,98 y duración de 90 ms.
- Focus: anillo cian de 2 px con separación de 2 px.
- Selected: fondo destacado y borde primario/violeta.
- Disabled: 45 % de opacidad y sin transformaciones.
- Loading: skeleton inmediato; no se bloquea toda la aplicación.
- Error: explicación humana, acción de reintento y Bolty en estado de error.
- Acción peligrosa: confirmación explícita antes de enviar `confirmed: true` al backend.

## 9. Estrategia de animación

- Motion for React para entrada/salida, cambios de página y layout.
- CSS para estrellas, órbitas y destellos ligeros.
- Solo `transform` y `opacity` en animaciones continuas.
- `document.visibilityState` y `prefers-reduced-motion` reducen o pausan el movimiento.
- Duraciones: hover 140 ms, press 90 ms, página 240 ms, diálogo 260 ms, Bolty 520 ms.

## 10. Estrategia responsive

- Base: CSS Grid, sin posiciones absolutas para estructura.
- ≥ 1440 px: sidebar de 248 px, 4 columnas de eventos.
- 1100–1439 px: sidebar de 220 px, 3 columnas.
- 820–1099 px: sidebar compacta de 84 px, panel de detalle como diálogo.
- < 820 px: navegación inferior/overlay, 1–2 columnas y command dock apilado.
- Densidad adaptable a 125 %, 150 % y 200 % con tamaños en `rem`, `clamp()` y mínimos de 44 px.

## 11. Accesibilidad

- Orden lógico de tabulación y atajo `Ctrl+K` para búsqueda.
- Roles, nombres accesibles y estados `aria-*`.
- Foco siempre visible.
- Contraste AA en texto funcional.
- Objetivos mínimos de 44×44 px.
- `aria-live` para toasts y ejecución.
- Mensajes de error sin códigos internos.
- Movimiento reducible y efectos decorativos fuera del árbol accesible.

## 12. Estructura de carpetas

```text
frontend/
├─ src/
│  ├─ components/      # UI reusable
│  ├─ pages/           # composición de pantallas
│  ├─ services/        # IPC y sonido
│  ├─ styles/          # tokens, base, componentes
│  ├─ types/           # contratos JSON
│  ├─ App.tsx
│  └─ main.tsx
├─ public/              # Bolty, sonidos e iconos
└─ src-tauri/           # shell nativo y puente IPC
backend/
├─ ipc_server.py        # router JSON
├─ headless_executor.py # ejecución fuera del hilo visual
└─ voice_engine.py      # Vosk en hilo independiente
bolty_switch/           # dominio Python existente
```

## 13. Plan IPC con backend

Contrato único:

```json
{
  "id": "uuid",
  "command": "list_events",
  "payload": { "category": "Aplicaciones", "query": "obsidian" }
}
```

Respuesta:

```json
{
  "id": "uuid",
  "ok": true,
  "data": { "events": [] }
}
```

- React llama `invoke("backend_request", { request })`.
- Rust ejecuta el sidecar Python en un worker bloqueante, envía JSON por stdin y devuelve JSON.
- Python enruta comandos, opera SQLite/Windows y escribe una única respuesta JSON por stdout.
- Los errores se normalizan en `{ code, message, details? }`.
- No se expone shell arbitraria desde el frontend.
- Los comandos peligrosos requieren doble llamada con confirmación explícita.
- La voz se inicia en un hilo Python y el frontend consulta eventos breves (`partial`, `transcript`, `wake`, `error`) sin bloquear el router.
- Rust mantiene el proceso Python persistente, registra el icono de bandeja y enriquece el alta de inicio automático con la ruta real del ejecutable Tauri.

## 14. Plan por fases

1. **Base visual y shell**: tokens, layout, navegación, Bolty, responsive.
2. **Biblioteca**: listado, búsqueda, filtros, CRUD y estados.
3. **Ejecución**: comandos de texto, confirmaciones y feedback.
4. **Guiones y sistema**: secuencias, telemetría y accesos Windows.
5. **Voz**: Vosk en hilo del backend, escucha puntual, manos libres y eventos consultables por IPC. **Implementado en esta entrega.**
6. **Pulido**: sonido, accesibilidad, carga diferida, `content-visibility` y pruebas 4K. **Base implementada; validación visual final pendiente en Windows físico.**
7. **Distribución**: PyInstaller sidecar, bundle Tauri y firma de Windows.
