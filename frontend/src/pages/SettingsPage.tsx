import { useState } from "react";
import type { AppSettings, SystemStatus } from "../types/domain";
import { BoltyAssistant } from "../components/Cosmic";
import { Button, Card, ListItem, Select, Slider, Switch } from "../components/Primitives";
import { Icon, type IconName } from "../components/Icon";
import { SystemPanel } from "./SystemPage";


const cosmicThemes = [
  { id: "nebula-blue", label: "Nebulosa azul", description: "Azul profundo, cian y órbitas suaves." },
  { id: "void-black", label: "Vacío negro", description: "Negro espacial con destellos azul hielo." },
  { id: "violet-dream", label: "Sueño violeta", description: "Morados intensos y auroras púrpura." },
  { id: "aurora-teal", label: "Aurora turquesa", description: "Ondas verdes, cian y azul oceánico." },
  { id: "magenta-pulse", label: "Pulso magenta", description: "Rosa neón, violeta y partículas brillantes." },
  { id: "supernova-red", label: "Supernova roja", description: "Rojo cósmico, coral y energía cálida." },
  { id: "emerald-orbit", label: "Órbita esmeralda", description: "Verde neón sobre un vacío oscuro." },
  { id: "golden-eclipse", label: "Eclipse dorado", description: "Ámbar, oro y reflejos de eclipse." },
] as const;

const tabs: Array<{ id: string; label: string; icon: IconName; description: string }> = [
  { id: "general", label: "General", icon: "settings", description: "Inicio y comportamiento" },
  { id: "appearance", label: "Apariencia", icon: "spark", description: "Densidad y movimiento" },
  { id: "voice", label: "Voz y sonido", icon: "mic", description: "Escucha y efectos" },
  { id: "accessibility", label: "Accesibilidad", icon: "help", description: "Lectura y control" },
  { id: "widgets", label: "Widgets", icon: "apps", description: "Accesos sobre Windows" },
  { id: "system", label: "Sistema", icon: "system", description: "Estado del equipo" },
  { id: "help", label: "Ayuda", icon: "help", description: "Primeros pasos" },
  { id: "about", label: "Acerca de", icon: "info", description: "Bolty Switch" },
];

export function SettingsPage({ settings, saving, onPatch, onRestore, onOpenVoiceFolder, systemStatuses, systemLoading, systemError, onRefreshSystem, onOpenSystem, onShowWidget, embedded = false }: {
  settings: AppSettings;
  saving: boolean;
  onPatch: (patch: Partial<AppSettings>) => void;
  onRestore: () => void;
  onOpenVoiceFolder: () => void;
  systemStatuses: SystemStatus[];
  systemLoading: boolean;
  systemError?: string;
  onRefreshSystem: () => void;
  onOpenSystem: (uri: string) => void;
  onShowWidget: (kind: "command" | "microphone") => void;
  embedded?: boolean;
}) {
  const [tab, setTab] = useState("general");
  return (
    <div className={`${embedded ? "settings-page settings-page--embedded" : "page settings-page"}`}>
      {!embedded && <header className="page-heading"><div><span className="eyebrow"><Icon name="settings" size={16} /> Configuración</span><h1>Ajustes de Bolty Switch</h1><p>Personaliza la experiencia sin perder claridad ni rendimiento.</p></div>{saving && <span className="saving-indicator"><i /> Guardando…</span>}</header>}
      {embedded && saving && <span className="saving-indicator settings-saving-indicator"><i /> Guardando…</span>}
      <div className="settings-layout">
        <aside className="settings-nav">{tabs.map((item) => <ListItem key={item.id} icon={item.icon} title={item.label} description={item.description} active={tab === item.id} onClick={() => setTab(item.id)} />)}</aside>
        <Card className="settings-panel">
          {tab === "general" && <>
            <section><h2>Comportamiento</h2><p>Controla cómo se integra Bolty con Windows.</p></section>
            <Switch checked={settings.run_in_background} onChange={(value) => onPatch({ run_in_background: value })} label="Ejecución en segundo plano" description="Mantiene a Bolty disponible desde el área de notificación." />
            <Switch checked={settings.start_with_windows} onChange={(value) => onPatch({ start_with_windows: value })} label="Iniciar con Windows" description="Abre Bolty automáticamente al entrar en tu sesión." />
            <Switch checked={settings.confirm_dangerous_actions} onChange={(value) => onPatch({ confirm_dangerous_actions: value })} label="Confirmar acciones críticas" description="Pregunta antes de apagar, reiniciar o eliminar contenido." />
            <Select label="Idioma" value={settings.language} onChange={(event) => onPatch({ language: event.target.value })}><option value="es">Español</option><option value="en">English</option></Select>
            <div className="settings-danger"><span><strong>Restaurar tareas predeterminadas</strong><small>Recupera la biblioteca original de automatizaciones de Windows.</small></span><Button variant="secondary" icon="refresh" onClick={onRestore}>Restaurar</Button></div>
          </>}
          {tab === "appearance" && <>
            <section><h2>Apariencia cósmica</h2><p>Los efectos decorativos nunca deben competir con el contenido.</p></section>
            <div className="theme-preview"><div><i /><span /><b /></div><BoltyAssistant state="idle" label="Vista previa de Bolty" compact /></div>
            <section className="settings-theme-section">
              <div className="settings-theme-section__heading">
                <span><strong>Temas</strong><small>Elige un fondo cósmico animado. La paleta también adapta botones, bordes y resplandores.</small></span>
                <em>{cosmicThemes.find((theme) => theme.id === (settings.cosmic_theme || "nebula-blue"))?.label}</em>
              </div>
              <div className="cosmic-theme-grid" role="radiogroup" aria-label="Temas cósmicos">
                {cosmicThemes.map((theme) => {
                  const active = (settings.cosmic_theme || "nebula-blue") === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`cosmic-theme-card ${active ? "is-active" : ""}`}
                      data-theme-preview={theme.id}
                      onClick={() => onPatch({ cosmic_theme: theme.id })}
                    >
                      <span className="cosmic-theme-card__visual" aria-hidden="true"><i /><b /><em /></span>
                      <span className="cosmic-theme-card__copy"><strong>{theme.label}</strong><small>{theme.description}</small></span>
                      <span className="cosmic-theme-card__check"><Icon name={active ? "check" : "spark"} size={15} /></span>
                    </button>
                  );
                })}
              </div>
            </section>
            <Switch checked={Boolean(settings.reduced_effects)} onChange={(value) => onPatch({ reduced_effects: value })} label="Reducir efectos cósmicos" description="Simplifica estrellas, órbitas y resplandores continuos." />
            <Switch checked={Boolean(settings.compact_density)} onChange={(value) => onPatch({ compact_density: value })} label="Densidad compacta" description="Muestra más eventos en pantallas pequeñas." />
            <div className="settings-action-row">
              <span><strong>Barra lateral</strong><small>Alterna entre iconos con texto o una vista compacta de solo iconos.</small></span>
              <Button variant="secondary" icon="chevron" onClick={() => onPatch({ sidebar_collapsed: !settings.sidebar_collapsed })}>{settings.sidebar_collapsed ? "Expandir" : "Contraer"}</Button>
            </div>
          </>}
          {tab === "voice" && <>
            <section><h2>Voz y efectos</h2><p>La voz se procesa localmente mediante el backend Python.</p></section>
            <Switch checked={settings.sounds_enabled} onChange={(value) => onPatch({ sounds_enabled: value })} label="Efectos de sonido" description="Respuestas para navegación, ejecución y avisos." />
            <Slider label="Volumen de efectos" value={settings.sound_volume * 100} onChange={(value) => onPatch({ sound_volume: value / 100 })} />
            <Switch checked={Boolean(settings.background_music_enabled)} onChange={(value) => onPatch({ background_music_enabled: value })} label="Música de fondo" description="Reproduce music.mp3 en bucle mientras Bolty Switch está abierto." />
            <Slider label="Volumen de la música" value={(settings.background_music_volume ?? 0.28) * 100} onChange={(value) => onPatch({ background_music_volume: value / 100 })} />
            <Switch checked={settings.hands_free} onChange={(value) => onPatch({ hands_free: value })} label={`Modo manos libres: «${settings.wake_word}»`} description="Al iniciar el micrófono, mantiene la escucha y espera la palabra de activación." />
            <div className="model-card"><img src="/mascot/32_bolty_comandos_voz_microfono.png" alt="Bolty usando el micrófono" /><span><strong>Modelo de voz local</strong><small>Coloca el modelo Vosk en la carpeta de datos de Bolty Switch.</small></span><Button variant="secondary" onClick={onOpenVoiceFolder}>Abrir carpeta</Button></div>
          </>}
          {tab === "accessibility" && <>
            <section><h2>Accesibilidad</h2><p>Bolty adapta la experiencia a la configuración del sistema.</p></section>
            <Switch checked={Boolean(settings.reduced_effects)} onChange={(value) => onPatch({ reduced_effects: value })} label="Movimiento reducido" description="También respeta prefers-reduced-motion de Windows." />
            <div className="accessibility-note"><Icon name="info" size={20} /><span><strong>Navegación por teclado</strong><small>Usa Tab para desplazarte, Enter para activar y Ctrl+K para abrir el buscador global.</small></span></div>
          </>}
          {tab === "widgets" && <>
            <section><h2>Widgets flotantes</h2><p>Mantén Bolty visible sobre otras aplicaciones sin abrir la ventana completa.</p></section>
            <div className="widget-options-grid">
              <article className="widget-option-card">
                <div className="widget-option-card__preview widget-option-card__preview--command">
                  <Icon name="bolt" size={20} />
                  <span>Escribe una orden…</span>
                  <Icon name="mic" size={18} />
                </div>
                <div><strong>Barra de ejecución</strong><small>Texto, ejecución y acceso al micrófono en una barra compacta.</small></div>
                <Button icon="bolt" onClick={() => onShowWidget("command")}>Mostrar widget</Button>
              </article>
              <article className="widget-option-card">
                <div className="widget-option-card__preview widget-option-card__preview--mic"><Icon name="mic" size={30} /></div>
                <div><strong>Micrófono compacto</strong><small>Un botón siempre visible para hablar con Bolty.</small></div>
                <Button icon="mic" variant="secondary" onClick={() => onShowWidget("microphone")}>Mostrar widget</Button>
              </article>
            </div>
            <div className="accessibility-note"><Icon name="info" size={20} /><span><strong>Siempre en primer plano</strong><small>Puedes arrastrar los widgets por la pantalla y ocultarlos desde su botón de cierre.</small></span></div>
          </>}
          {tab === "system" && <SystemPanel statuses={systemStatuses} loading={systemLoading} error={systemError} onRefresh={onRefreshSystem} onOpen={onOpenSystem} />}
          {tab === "help" && <>
            <section><h2>Aprende a usar Bolty</h2><p>Todo lo esencial organizado en pasos sencillos.</p></section>
            <div className="embedded-help-grid">
              {[ ["01", "Crea una misión", "Elige una categoría, un nombre, un icono y una acción."], ["02", "Ejecuta como prefieras", "Usa una tarjeta, el widget, el buscador o tu voz."], ["03", "Combina eventos", "Los guiones encadenan varias acciones con pausas configurables."], ["04", "Mantén el control", "Las acciones peligrosas pueden pedir confirmación."] ].map(([number, title, body]) => <article key={number}><span>{number}</span><div><strong>{title}</strong><small>{body}</small></div></article>)}
            </div>
            <div className="accessibility-note"><Icon name="command" size={20} /><span><strong>Atajo global dentro de la app</strong><small>Pulsa Ctrl + K para enfocar la barra de comandos de Inicio.</small></span></div>
          </>}
          {tab === "about" && <div className="embedded-about">
            <img src="/mascot/15_bolty_acerca_de.png" alt="Bolty" />
            <span className="eyebrow"><Icon name="spark" size={16} /> Zazen AI Studio</span>
            <h2>Bolty Switch</h2>
            <p>Automatización de Windows mediante eventos, texto, voz y widgets flotantes.</p>
            <dl><div><dt>Versión</dt><dd>0.6.6 Cosmic UI</dd></div><div><dt>Frontend</dt><dd>Tauri 2 · React · TypeScript</dd></div><div><dt>Backend</dt><dd>Python · SQLite · IPC JSON</dd></div></dl>
            <small>© 2026 Zazen AI Studio. Software propietario.</small>
          </div>}
        </Card>
      </div>
    </div>
  );
}
