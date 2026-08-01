# Publicar Bolty Switch en GitHub

## Datos recomendados del repositorio

- **Nombre:** `Bolty-Switch`
- **Descripción:** `Automatización visual y por voz para Windows con eventos, widgets flotantes y una interfaz cósmica kawaii.`
- **Visibilidad:** `Public`
- **README inicial:** no marcar
- **.gitignore inicial:** no seleccionar
- **Licencia inicial de GitHub:** no seleccionar; el proyecto ya incluye la licencia personalizada de Zazen AI Studio.
- **Temas:** `windows`, `automation`, `tauri`, `react`, `typescript`, `python`, `voice-control`, `vosk`, `desktop-app`, `kawaii`, `zazen-ai-studio`

## Primera publicación mediante Git

Abre PowerShell o Git Bash dentro de la carpeta del proyecto y ejecuta:

```bash
git init -b main
git add .
git commit -m "Publicación inicial de Bolty Switch v0.6.6"
git remote add origin https://github.com/TU_USUARIO/Bolty-Switch.git
git push -u origin main
```

Sustituye `TU_USUARIO` por tu nombre real de usuario de GitHub.

## Primera versión descargable

El repositorio incluye GitHub Actions para compilar Windows. Para lanzar la versión 0.6.6:

```bash
git tag v0.6.6
git push origin v0.6.6
```

También puedes crear una Release manual desde GitHub y adjuntar el instalador `.exe` y el `.msi`.

## Imagen social

Usa `assets/readme/social-preview.png` como imagen de vista previa social desde:

`Settings → General → Social preview → Edit`
