# Bolty Switch 0.2 — Sistema de diseño cósmico

Este documento define la capa visual compartida por el frontend Tauri/React. Los valores ejecutables viven en `frontend/src/styles/tokens.css`; los componentes no deben introducir colores o medidas de marca por su cuenta.

## 1. Color

| Token | Valor base | Función |
|---|---:|---|
| `--color-bg` | `#03040A` | Fondo de máxima profundidad |
| `--color-surface` | `#0B1020` | Paneles y tarjetas |
| `--color-primary` | `#5B8CFF` | Acción principal y foco |
| `--color-secondary` | `#7C4DFF` | Selección, creación y gradientes |
| `--color-accent` | `#2EE6D6` | Estado activo y electricidad |
| `--color-surface-highlight` | `#19234A` | Superficie seleccionada |
| `--color-success` | `#37D39A` | Ejecución correcta |
| `--color-danger` | `#FF5F7A` | Error o acción crítica |
| `--color-text` | `#F3F7FF` | Texto principal |
| `--color-text-muted` | `#8B98B8` | Texto secundario |

Hover, pressed, disabled, focus y selected se derivan en los tokens mediante `color-mix()`, alfa y gradientes compartidos. Las superficies nunca usan un hexadecimal local.

## 2. Tipografía

- Interfaz: `Inter`, `Segoe UI Variable`, `Segoe UI`, sans-serif.
- Titulares: `Space Grotesk`, `Segoe UI Variable Display`, sans-serif.
- Escala fluida con `clamp()` para conservar jerarquía desde 1280×720 hasta 4K.
- Peso 400 para lectura, 600 para controles y 700 para títulos.
- Altura de línea entre 1.35 y 1.65.

## 3. Escala, espaciado y densidad

- Escala tipográfica: 12, 14, 16, 18, 22, 28, 36 y 42 px equivalentes.
- Espaciado base: 4 px; pasos de 4, 8, 12, 16, 20, 24, 32, 40 y 48.
- Objetivo interactivo mínimo: 44×44 px.
- Densidad cómoda por defecto; `data-density="compact"` reduce espacios sin bajar el objetivo mínimo.

## 4. Radios, bordes y elevación

- Radio pequeño: 10 px.
- Radio de control: 12–14 px.
- Tarjeta: 18 px.
- Diálogo y panel flotante: 22–24 px.
- Borde base: 1 px con mezcla de texto o primario a baja opacidad.
- Elevación 1: tarjeta sobre superficie.
- Elevación 2: panel de detalle, menú contextual y command dock.
- Elevación 3: diálogo y toast.
- Los resplandores son estáticos o se animan solo mediante opacidad; no se recalculan desenfoques grandes cada fotograma.

## 5. Movimiento

| Interacción | Duración | Curva |
|---|---:|---|
| Hover | 140 ms | `ease-out` |
| Pulsación | 90 ms | `ease-out` |
| Cambio de pantalla | 240 ms | spring suave / ease-out |
| Diálogo | 260 ms | ease-out |
| Bolty e ilustraciones | 520 ms | spring contenida |

Se priorizan `transform`, `opacity`, máscaras SVG y gradientes. `prefers-reduced-motion`, `data-reduced-effects` y `document.visibilityState` reducen o detienen movimiento decorativo.

## 6. Iconografía e ilustraciones

- Iconos funcionales: SVG de trazo coherente, 16–24 px y `currentColor`.
- Emoji solo como icono personalizable de un evento, nunca como sustituto de controles críticos.
- Bolty comunica estados: reposo, búsqueda, escucha, pensamiento, ejecución, éxito, error, creación, edición y vacío.
- El fondo espacial usa estrellas y órbitas ligeras; nunca se coloca una nebulosa brillante detrás de texto funcional.

## 7. Estados interactivos

- **Hover:** borde más visible y desplazamiento máximo de 2 px.
- **Pressed:** escala 0,98.
- **Focus:** anillo cian de 2 px con separación visible.
- **Selected:** superficie destacada y borde primario-violeta.
- **Disabled:** opacidad aproximada del 45 %, sin movimiento.
- **Loading:** skeleton inmediato o progreso localizado.
- **Error:** mensaje humano, opción de recuperación y Bolty en estado de error.
- **Danger:** diálogo explícito antes de reenviar la operación con `confirmed: true`.

## 8. Reglas de composición

- `AppShell` organiza TitleBar, Sidebar, contenido y command dock.
- CSS Grid define la estructura; Flexbox alinea componentes internos.
- Los paneles secundarios son ocultables y los detalles se convierten en overlay en anchuras reducidas.
- Las listas extensas están preparadas para virtualización y usan `content-visibility` cuando procede.
- No se usa posicionamiento absoluto como base del layout; queda reservado para decoración o overlays.

## 9. Accesibilidad

- Navegación completa por teclado y atajo `Ctrl+K`.
- Foco visible, etiquetas accesibles, roles, estados `aria-*` y `aria-live`.
- Contraste AA en texto funcional.
- Escalado de texto sin recorte y comportamiento estable al 125 %, 150 % y 200 %.
- Sonido, movimiento y ejecución en segundo plano configurables.

La referencia visual original se conserva en `docs/reference/12_Espacial_Cosmica.png` y el análisis completo de arquitectura se encuentra en `PRODUCT_BLUEPRINT.md`.
