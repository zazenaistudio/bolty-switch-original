# Historial de cambios


## 0.6.6

- Corregido el tipado de `children` en `Button` y `Card` para compatibilidad con Motion y React 19.
- Desbloqueada la comprobación `npm run typecheck` previa a la compilación del instalador.

## 0.6.4

- Corregida la incompatibilidad de tipos entre React 19 y los componentes `motion.*`.
- Tipados los botones y tarjetas animadas a partir de las propiedades reales de Motion.
- Corregida la curva de animación compartida de las tarjetas de eventos.
- Eliminada la dependencia de los tipos globales de Node en `vite.config.ts`.
- Añadida una comprobación TypeScript independiente antes de generar los instaladores.

## 0.6.3

- Repositorio limpiado y preparado para publicación en GitHub.
- Eliminados informes temporales, notas de intentos y documentación de la interfaz PySide6 retirada.
- Añadida compilación local en Windows mediante `BUILD_EXE.bat`.
- Añadidos flujos de GitHub Actions para validar, compilar y publicar instaladores `.exe` y `.msi`.
- El instalador incluye el backend Python compilado con PyInstaller; el usuario final no necesita instalar Python, Node.js ni Rust.
- Recursos de Tauri reducidos al backend ejecutable necesario, evitando duplicar código y recursos visuales.
