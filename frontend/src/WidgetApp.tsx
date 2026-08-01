import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { ipc } from "./services/ipc";
import { playSound } from "./services/sound";
import { Icon, type IconName } from "./components/Icon";
import type { AppSettings } from "./types/domain";

type WidgetMode = "command" | "microphone";
type WidgetState = "idle" | "waiting" | "listening" | "working" | "success" | "error";

const widgetDefaults: Pick<AppSettings, "sounds_enabled" | "sound_volume" | "hands_free" | "wake_word" | "language"> = {
  sounds_enabled: true,
  sound_volume: 0.72,
  hands_free: false,
  wake_word: "Bolty",
  language: "es",
};

type SuggestionPresentation = {
  icon: IconName;
  detail: string;
  category: string;
};

function suggestionPresentation(value: string): SuggestionPresentation {
  const text = value.toLocaleLowerCase("es");
  if (text.includes("volumen") || text.includes("sonido") || text.includes("silenciar")) return { icon: "volume", detail: "Control del audio del sistema", category: "Tarea" };
  if (text.includes("spotify") || text.includes("música") || text.includes("playlist")) return { icon: "music", detail: "Reproduce música o abre tu biblioteca", category: "Música" };
  if (text.includes("document") || text.includes("pdf") || text.includes("archivo") || text.includes("carpeta")) return { icon: "folder", detail: "Abre un archivo o una carpeta", category: "Archivo" };
  if (text.includes("bloquear") || text.includes("seguridad") || text.includes("apagar") || text.includes("reiniciar")) return { icon: "system", detail: "Acción rápida de Windows", category: "Sistema" };
  if (text.includes("web") || text.includes("página") || text.includes("navegador") || text.includes("http")) return { icon: "globe", detail: "Abre una página o servicio web", category: "Web" };
  if (text.includes("película") || text.includes("vídeo") || text.includes("video") || text.includes("serie")) return { icon: "play", detail: "Abre contenido multimedia", category: "Películas" };
  if (text.includes("nota") || text.includes("recordar") || text.includes("reunión")) return { icon: "calendar", detail: "Acceso de productividad", category: "Productividad" };
  if (text.includes("buscar")) return { icon: "search", detail: "Busca eventos y accesos", category: "Búsqueda" };
  return { icon: "bolt", detail: "Ejecutar evento o comando", category: "Comando" };
}

export function WidgetApp({ mode }: { mode: WidgetMode }) {
  const [command, setCommand] = useState("");
  const [state, setState] = useState<WidgetState>("idle");
  const [voiceRunning, setVoiceRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [voiceSettings, setVoiceSettings] = useState(widgetDefaults);
  const listeningCueActive = useRef(false);

  async function refreshVoiceSettings() {
    try {
      const { settings } = await ipc.getSettings();
      const next = {
        sounds_enabled: settings.sounds_enabled,
        sound_volume: settings.sound_volume,
        hands_free: settings.hands_free,
        wake_word: settings.wake_word,
        language: settings.language,
      };
      setVoiceSettings(next);
      return next;
    } catch {
      return voiceSettings;
    }
  }

  useEffect(() => {
    void refreshVoiceSettings();
    const refresh = () => void refreshVoiceSettings();
    const visible = () => { if (!document.hidden) refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function listeningStarted() {
    if (listeningCueActive.current) return;
    listeningCueActive.current = true;
    playSound("wakeOn", voiceSettings.sounds_enabled, voiceSettings.sound_volume);
  }

  function listeningStopped() {
    if (!listeningCueActive.current) return;
    listeningCueActive.current = false;
    playSound("wakeOff", voiceSettings.sounds_enabled, voiceSettings.sound_volume);
  }

  async function execute(textOverride?: string) {
    const text = (textOverride ?? command).trim();
    if (!text) return;
    setState("working");
    setMessage("Ejecutando…");
    playSound("execute", voiceSettings.sounds_enabled, voiceSettings.sound_volume);
    try {
      const result = await ipc.executeText(text);
      setState("success");
      setMessage(result.message || "Completado");
      setCommand("");
      setSuggestions([]);
      setActiveSuggestion(-1);
      playSound("success", voiceSettings.sounds_enabled, voiceSettings.sound_volume);
      window.setTimeout(() => {
        if (voiceRunning && voiceSettings.hands_free) {
          setState("waiting");
          setMessage(`Di «${voiceSettings.wake_word}»`);
        } else {
          setState("idle");
          setMessage("");
        }
      }, 1700);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo ejecutar");
      playSound("error", voiceSettings.sounds_enabled, voiceSettings.sound_volume);
      window.setTimeout(() => { setState(voiceRunning && voiceSettings.hands_free ? "waiting" : "idle"); setMessage(voiceRunning && voiceSettings.hands_free ? `Di «${voiceSettings.wake_word}»` : ""); }, 2600);
    }
  }

  async function stopVoice(manual = false) {
    await ipc.voiceStop().catch(() => undefined);
    listeningStopped();
    if (manual) playSound("toggleOff", voiceSettings.sounds_enabled, voiceSettings.sound_volume);
    setVoiceRunning(false);
    setState("idle");
    setMessage("");
  }

  async function toggleVoice() {
    if (voiceRunning) {
      await stopVoice(true);
      return;
    }
    setState("working");
    setMessage("Preparando voz…");
    try {
      const activeSettings = await refreshVoiceSettings();
      const currentStatus = await ipc.voiceStatus(activeSettings.language);
      if (!currentStatus.model_available) {
        setMessage("Instalando modelo Vosk…");
        const installed = await ipc.installVoiceModel(activeSettings.language);
        if (!installed.model_available) throw new Error(installed.message || "No se pudo instalar el modelo Vosk.");
      }
      const status = await ipc.voiceStart(activeSettings.language, activeSettings.hands_free, activeSettings.wake_word);
      if (!status.started) throw new Error(status.message || "No se pudo iniciar el micrófono.");
      setVoiceRunning(true);
      if (activeSettings.hands_free) {
        setState("waiting");
        setMessage(`Di «${activeSettings.wake_word}»`);
        playSound("toggleOn", activeSettings.sounds_enabled, activeSettings.sound_volume);
      } else {
        setState("listening");
        setMessage("Te escucho…");
        playSound("wakeOn", activeSettings.sounds_enabled, activeSettings.sound_volume);
        listeningCueActive.current = true;
      }
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Micrófono no disponible");
      playSound("error", voiceSettings.sounds_enabled, voiceSettings.sound_volume);
      window.setTimeout(() => { setState("idle"); setMessage(""); }, 2600);
    }
  }

  useEffect(() => {
    if (!voiceRunning) return;
    let cancelled = false;
    let polling = false;
    const poll = async () => {
      if (cancelled || polling) return;
      polling = true;
      try {
        const status = await ipc.voicePoll();
        for (const event of status.events ?? []) {
          if (event.type === "partial" && !voiceSettings.hands_free) {
            setCommand(event.text);
            setMessage(event.text || "Te escucho…");
          }
          if (event.type === "wake") {
            listeningStarted();
            setState("listening");
            setMessage("Te escucho…");
          }
          if (event.type === "transcript") {
            setCommand(event.text);
            if (!voiceSettings.hands_free) {
              listeningStopped();
              setVoiceRunning(false);
            }
            await execute(event.text);
          }
          if (event.type === "wake_end") {
            listeningStopped();
            if (voiceSettings.hands_free) {
              setState("waiting");
              setMessage(`Di «${voiceSettings.wake_word}»`);
            }
          }
          if (event.type === "error") {
            listeningStopped();
            setVoiceRunning(false);
            setState("error");
            setMessage(event.message);
            playSound("error", voiceSettings.sounds_enabled, voiceSettings.sound_volume);
          }
          if (event.type === "listening" && !event.active) {
            listeningStopped();
            setVoiceRunning(false);
            setState("idle");
            setMessage("");
            playSound("toggleOff", voiceSettings.sounds_enabled, voiceSettings.sound_volume);
          }
        }
        if (!status.running && !voiceSettings.hands_free) {
          listeningStopped();
          setVoiceRunning(false);
        }
      } catch (error) {
        listeningStopped();
        setVoiceRunning(false);
        setState("error");
        setMessage(error instanceof Error ? error.message : "Conexión de voz perdida");
      } finally {
        polling = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 280);
    return () => { cancelled = true; window.clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceRunning, voiceSettings.hands_free, voiceSettings.wake_word]);

  useEffect(() => {
    if (!command.trim()) { setSuggestions([]); setActiveSuggestion(-1); return; }
    const timer = window.setTimeout(async () => {
      try {
        const result = await ipc.search(command);
        const options = result.suggestions.slice(0, 7);
        setSuggestions(options);
        setActiveSuggestion(options.length ? 0 : -1);
      } catch {
        setSuggestions([]);
        setActiveSuggestion(-1);
      }
    }, 160);
    return () => window.clearTimeout(timer);
  }, [command]);

  const suggestionsVisible = mode === "command" && focused && suggestions.length > 0;
  useEffect(() => {
    if (mode !== "command") return;
    void ipc.resizeWidget("command", suggestionsVisible).catch(() => undefined);
  }, [mode, suggestionsVisible]);

  function handleCommandKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((current) => (current - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (event.key === "Escape") {
      setSuggestions([]);
      setActiveSuggestion(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = activeSuggestion >= 0 ? suggestions[activeSuggestion] : command;
      void execute(selected);
    }
  }

  async function hide() {
    if (voiceRunning) await stopVoice();
    if (mode === "command") await ipc.resizeWidget("command", false).catch(() => undefined);
    await ipc.hideWidget(mode);
  }

  async function showMain() {
    await ipc.showMainWindow();
  }

  if (mode === "microphone") {
    const stateLabel = !voiceRunning ? "Pulsa para activar" : state === "waiting" ? `Di «${voiceSettings.wake_word}»` : state === "listening" ? "Escuchando" : state === "working" ? "Preparando" : state === "error" ? "Error" : "En espera";
    const micIcon: IconName = state === "working" ? "refresh" : state === "success" ? "check" : state === "error" ? "alert" : "mic";
    return (
      <main className={`floating-widget floating-widget--microphone is-${state}`} data-tauri-drag-region>
        <span className="widget-hologram-sheen" aria-hidden="true" />
        <div className="floating-widget__hover-actions">
          <button type="button" onClick={() => void showMain()} aria-label="Abrir Bolty Switch"><Icon name="maximize" size={12} /></button>
          <button type="button" onClick={() => void hide()} aria-label="Ocultar widget"><Icon name="x" size={12} /></button>
        </div>
        <div className="microphone-widget__brandline"><i className={voiceRunning ? "is-live" : ""} /><span>Bolty</span></div>
        <div className="microphone-widget__core">
          <span className="microphone-widget__orbit" aria-hidden="true"><i /><i /><i /></span>
          <span className="microphone-widget__wave microphone-widget__wave--left" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="microphone-widget__wave microphone-widget__wave--right" aria-hidden="true"><i /><i /><i /><i /></span>
          <motion.button
            type="button"
            className="microphone-widget__button"
            onClick={() => void toggleVoice()}
            aria-label={voiceRunning ? "Detener escucha" : "Escuchar comando"}
            animate={state === "listening" ? { scale: [1, 1.07, 1], boxShadow: ["0 0 18px rgba(46,230,214,.25)", "0 0 38px rgba(46,230,214,.72)", "0 0 18px rgba(46,230,214,.25)"] } : state === "waiting" ? { scale: [1, 1.035, 1] } : undefined}
            transition={(state === "listening" || state === "waiting") ? { duration: state === "listening" ? 1.1 : 2.2, repeat: Infinity } : undefined}
          >
            <span className="microphone-widget__pulse" aria-hidden="true" />
            <img src="/icons/bolty-icon.png" alt="" />
            <span className="microphone-widget__mic"><Icon name={micIcon} size={18} /></span>
          </motion.button>
        </div>
        <strong className="microphone-widget__state"><Icon name={micIcon} size={10} />{stateLabel}</strong>
        {message && <span className="microphone-widget__tooltip">{message}</span>}
      </main>
    );
  }

  return (
    <main className={`floating-widget floating-widget--command is-${state}`} data-tauri-drag-region>
      <span className="widget-hologram-sheen" aria-hidden="true" />
      {suggestionsVisible && (
        <div className="command-widget__suggestions" role="listbox" aria-label="Opciones de comandos">
          <header><span><Icon name="spark" size={15} /> Sugerencias de comandos</span><small>{suggestions.length} opciones</small></header>
          <div className="command-widget__suggestion-list">
            {suggestions.map((suggestion, index) => {
              const presentation = suggestionPresentation(suggestion);
              return (
                <button key={suggestion} type="button" role="option" aria-selected={index === activeSuggestion} className={index === activeSuggestion ? "is-active" : ""} onMouseEnter={() => setActiveSuggestion(index)} onMouseDown={(event) => { event.preventDefault(); setCommand(suggestion); setSuggestions([]); void execute(suggestion); }}>
                  <span className="command-widget__suggestion-icon"><Icon name={presentation.icon} size={17} /></span>
                  <span><strong>{suggestion}</strong><small>{presentation.detail}</small></span>
                  <em>{presentation.category}</em>
                </button>
              );
            })}
          </div>
          <button type="button" className="command-widget__suggestions-footer" onMouseDown={(event) => { event.preventDefault(); void showMain(); }}>
            <span><Icon name="bolt" size={14} /> Ver todos los comandos</span><Icon name="chevron" size={14} />
          </button>
          <span className="command-widget__popover-tip" aria-hidden="true" />
        </div>
      )}
      <button type="button" className="command-widget__brand" onClick={() => void showMain()} aria-label="Abrir Bolty Switch">
        <span className="command-widget__brand-orbit" aria-hidden="true"><b /><b /><b /></span>
        <img src="/icons/bolty-icon.png" alt="" /><i className={voiceRunning ? "is-live" : ""} />
      </button>
      <label className={`command-widget__input-shell ${state !== "idle" ? "has-status" : ""}`}>
        <Icon name="search" size={18} />
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 130)}
          onKeyDown={handleCommandKey}
          placeholder={message || "Dile a Bolty qué quieres hacer…"}
          aria-label="Comando para Bolty"
          aria-autocomplete="list"
          aria-expanded={suggestionsVisible}
        />
        {state !== "idle" && <small>{state === "waiting" ? `Esperando «${voiceSettings.wake_word}»` : message}</small>}
      </label>
      <button type="button" className={`command-widget__voice ${voiceRunning ? "is-active" : ""}`} onClick={() => void toggleVoice()} aria-label="Usar micrófono">
        <span className="command-widget__voice-wave command-widget__voice-wave--left" aria-hidden="true"><i /><i /><i /></span>
        <Icon name="mic" size={20} />
        <span className="command-widget__voice-wave command-widget__voice-wave--right" aria-hidden="true"><i /><i /><i /></span>
      </button>
      <button type="button" className="command-widget__execute" onClick={() => void execute()} aria-label="Ejecutar comando"><Icon name={state === "working" ? "refresh" : state === "success" ? "check" : state === "error" ? "alert" : "bolt"} size={20} /></button>
      <button type="button" className="command-widget__close" onClick={() => void hide()} aria-label="Ocultar widget"><Icon name="x" size={16} /></button>
    </main>
  );
}
