# Modelos de voz Vosk

Bolty Switch descarga automáticamente el modelo pequeño oficial de Vosk la primera vez que se activa el micrófono.

## Instalación automática

1. Activa el micrófono desde Inicio o desde el widget.
2. Si falta el modelo, Bolty lo descarga e instala en:

```text
%APPDATA%\Zazen AI Studio\Bolty Switch\models\vosk-es
```

También puede prepararse antes de iniciar la aplicación:

```bat
scripts\install_voice_windows.bat
```

## Instalación manual

Para español, descarga `vosk-model-small-es-0.42.zip`, descomprímelo y renombra la carpeta resultante a `vosk-es`.

Ubicaciones reconocidas:

- `%APPDATA%\Zazen AI Studio\Bolty Switch\models\vosk-es`
- `Bolty-Switch\models\vosk-es`
- ruta indicada por la variable de entorno `BOLTY_VOSK_MODEL`

La carpeta debe contener al menos `am\final.mdl` y `conf\mfcc.conf`.
