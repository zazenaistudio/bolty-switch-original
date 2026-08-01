import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, AssistantState, BoltyEvent, PageId, SystemStatus, ToastMessage } from "./types/domain";
import { ipc } from "./services/ipc";
import { playSound } from "./services/sound";
import { AppShell, CommandDock, type NavigationEntry } from "./components/Layout";
import { Dialog, ErrorState, LoadingState, ToastRegion } from "./components/Feedback";
import { Button } from "./components/Primitives";
import { EventEditor } from "./components/EventEditor";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const LibraryPage = lazy(() => import("./pages/LibraryPage").then((module) => ({ default: module.LibraryPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

const pageCategory: Partial<Record<PageId, string>> = {
  applications: "Aplicaciones",
  web: "Páginas Webs",
  media: "Películas y Series",
  music: "Música",
  documents: "Documentos",
  images: "Imágenes",
  other: "Otros",
  tasks: "Tareas",
  scripts: "Guiones",
};

const pageCopy: Record<string, { title: string; description: string }> = {
  Aplicaciones: { title: "Aplicaciones", description: "Tus programas y herramientas, listos para despegar." },
  "Páginas Webs": { title: "Páginas web", description: "Portales, recursos y destinos digitales en una sola órbita." },
  "Películas y Series": { title: "Películas", description: "Accesos directos a tus mundos audiovisuales." },
  Música: { title: "Música", description: "Reproduce tus listas, artistas y ambientes favoritos." },
  Documentos: { title: "Documentos", description: "Abre archivos y carpetas importantes sin perder tiempo." },
  Imágenes: { title: "Imágenes", description: "Colecciones, proyectos gráficos y subcategorías visuales." },
  Otros: { title: "Otros eventos", description: "Todo lo que no necesita seguir una órbita convencional." },
  Tareas: { title: "Tareas de Windows", description: "Controla ajustes y acciones del sistema con seguridad." },
  Guiones: { title: "Guiones", description: "Encadena varias misiones y ejecútalas con una sola frase." },
};

const defaultSubcategoriesByCategory: Partial<Record<string, string[]>> = {
  Aplicaciones: ["Productividad", "Comunicación", "Diseño", "Juegos", "Utilidades"],
  "Páginas Webs": ["Favoritos", "Trabajo", "Estudio", "Redes", "Herramientas"],
  "Películas y Series": ["Acción", "Comedia", "Drama", "Animación", "Ciencia ficción", "Terror"],
  Música: ["Pop", "Rock", "Lo-fi", "Bandas sonoras", "Clásica"],
  Documentos: ["Trabajo", "Estudio", "Facturas", "Plantillas", "PDF"],
  Imágenes: ["Fondos", "Diseños", "Fotos", "Memes", "Referencias"],
  Otros: ["Favoritos", "Experimentos", "Utilidades"],
  Tareas: ["Sistema", "Ventanas", "Audio", "Accesos rápidos", "Carpetas"],
  Guiones: ["Rutinas", "Automatización", "Inicio", "Productividad"],
};

function mergeUnique(values: string[]) {
  const unique = new Map<string, string>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase("es");
    if (!unique.has(key)) unique.set(key, value);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, "es"));
}

function defaultSubcategoryMap() {
  return Object.fromEntries(Object.entries(defaultSubcategoriesByCategory).map(([category, names]) => [category, mergeUnique(names ?? [])]));
}

const defaultSettings: AppSettings = {
  sounds_enabled: true, sound_volume: 0.72, hands_free: false, language: "es",
  run_in_background: true, start_with_windows: false, confirm_dangerous_actions: true,
  wake_word: "Bolty", window_width: 1500, window_height: 900, first_run: false,
  sidebar_collapsed: false, background_music_enabled: false, background_music_volume: 0.28,
  cosmic_theme: "nebula-blue",
};

export default function App() {
  const [page, setPage] = useState<PageId>("home");
  const [events, setEvents] = useState<BoltyEvent[]>([]);
  const [pinnedEvents, setPinnedEvents] = useState<BoltyEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [booting, setBooting] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BoltyEvent | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [librarySubcategories, setLibrarySubcategories] = useState<Record<string, string[]>>(defaultSubcategoryMap);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorEvent, setEditorEvent] = useState<BoltyEvent | null>(null);
  const [editorChoices, setEditorChoices] = useState<BoltyEvent[]>([]);
  const [editorFolders, setEditorFolders] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BoltyEvent | null>(null);
  const [pendingDanger, setPendingDanger] = useState<{ type: "event" | "text"; value: number | string; name: string } | null>(null);
  const [assistant, setAssistant] = useState<AssistantState>("idle");
  const [command, setCommand] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [systemStatuses, setSystemStatuses] = useState<SystemStatus[]>([]);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceRunning, setVoiceRunning] = useState(false);
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);

  const addToast = useCallback((tone: ToastMessage["tone"], title: string, message?: string) => {
    const id = crypto.randomUUID?.() ?? String(Date.now());
    setToasts((current) => [...current, { id, tone, title, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4300);
  }, []);

  const bootstrap = useCallback(async () => {
    setBooting(true); setFatalError("");
    try {
      const data = await ipc.bootstrap();
      setEvents(data.events);
      setPinnedEvents(data.pinned_events ?? []);
      setCounts(data.categories);
      setSettings({ ...defaultSettings, ...data.settings });
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "No se pudo iniciar Bolty Switch.");
    } finally { setBooting(false); }
  }, []);

  useEffect(() => { void bootstrap(); }, [bootstrap]);

  useEffect(() => {
    const audio = new Audio("/sounds/music.mp3");
    audio.loop = true;
    audio.preload = "auto";
    backgroundMusicRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      backgroundMusicRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = backgroundMusicRef.current;
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, settings.background_music_volume ?? 0.28));
    if (!settings.background_music_enabled) {
      audio.pause();
      return;
    }

    const play = () => { void audio.play().catch(() => undefined); };
    play();
    window.addEventListener("pointerdown", play, { once: true });
    window.addEventListener("keydown", play, { once: true });
    return () => {
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("keydown", play);
    };
  }, [settings.background_music_enabled, settings.background_music_volume]);

  const currentCategory = pageCategory[page];
  const loadEvents = useCallback(async (category?: string) => {
    setLoadingEvents(true);
    try {
      const result = await ipc.listEvents(category);
      setEvents(result.events);
      setSelected(null);
    } catch (error) {
      addToast("danger", "No se cargó la biblioteca", error instanceof Error ? error.message : undefined);
    } finally { setLoadingEvents(false); }
  }, [addToast]);

  const loadFolders = useCallback(async (category?: string) => {
    if (!category) { setFolders([]); return; }
    try {
      const result = await ipc.listFolders(category);
      setFolders(mergeUnique([...(defaultSubcategoriesByCategory[category] ?? []), ...result.folders.map((item) => item.name)]));
    } catch {
      setFolders([]);
    }
  }, []);

  const loadLibrarySubcategories = useCallback(async () => {
    const next = defaultSubcategoryMap();
    try {
      const result = await ipc.listFolders();
      for (const folder of result.folders) {
        next[folder.category] = mergeUnique([...(next[folder.category] ?? []), folder.name]);
      }
    } catch {
      // The default kawaii library remains available even if the database cannot be read.
    }
    setLibrarySubcategories(next);
  }, []);

  useEffect(() => {
    if (page === "home") { setQuery(""); return; }
    if (page === "library") {
      void loadEvents();
      void loadLibrarySubcategories();
      setFolders([]);
      setQuery("");
      return;
    }
    if (currentCategory) {
      void loadEvents(currentCategory);
      void loadFolders(currentCategory);
    }
    setQuery("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    document.documentElement.dataset.reducedEffects = settings.reduced_effects ? "true" : "false";
    document.documentElement.dataset.density = settings.compact_density ? "compact" : "comfortable";
    document.documentElement.dataset.cosmicTheme = settings.cosmic_theme || "nebula-blue";
  }, [settings.reduced_effects, settings.compact_density, settings.cosmic_theme]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".command-dock input")?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    if (!command.trim()) { setSuggestions([]); if (!voiceRunning) setAssistant("idle"); return; }
    if (!voiceRunning) setAssistant("searching");
    const timer = window.setTimeout(async () => {
      try { setSuggestions((await ipc.search(command)).suggestions); }
      catch { setSuggestions([]); }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [command, voiceRunning]);

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return events.filter((event) => (!currentCategory || event.category === currentCategory) && (!needle || `${event.name} ${event.folder} ${event.description} ${event.commands.join(" ")}`.toLocaleLowerCase().includes(needle)));
  }, [events, currentCategory, query]);

  const navigation: NavigationEntry[] = useMemo(() => [
    { id: "home", label: "Inicio", icon: "home", group: "main" },
    { id: "library", label: "Biblioteca", icon: "library", group: "main", badge: Object.values(counts).reduce((sum, value) => sum + value, 0) },
    { id: "applications", label: "Aplicaciones", icon: "apps", group: "library", badge: counts.Aplicaciones },
    { id: "web", label: "Páginas web", icon: "globe", group: "library", badge: counts["Páginas Webs"] },
    { id: "media", label: "Películas", icon: "play", group: "library", badge: counts["Películas y Series"] },
    { id: "music", label: "Música", icon: "music", group: "library", badge: counts.Música },
    { id: "documents", label: "Documentos", icon: "file", group: "library", badge: counts.Documentos },
    { id: "images", label: "Imágenes", icon: "image", group: "library", badge: counts.Imágenes },
    { id: "other", label: "Otros", icon: "spark", group: "library", badge: counts.Otros },
    { id: "tasks", label: "Tareas", icon: "bolt", group: "support", badge: counts.Tareas },
    { id: "scripts", label: "Guiones", icon: "link", group: "support", badge: counts.Guiones },
  ], [counts]);

  function navigate(next: PageId) {
    if (next === "settings") return;
    setPage(next); setSelected(null); playSound("navigation", settings.sounds_enabled, settings.sound_volume);
  }

  function openSettings() {
    setSettingsOpen(true);
    void loadSystem();
    playSound("modal", settings.sounds_enabled, settings.sound_volume);
  }

  async function prepareEditor(event: BoltyEvent | null) {
    const editorCategory = event?.category ?? currentCategory ?? "Aplicaciones";
    setEditorEvent(event); setEditorOpen(true); setAssistant(event ? "edit" : "create");
    playSound("modal", settings.sounds_enabled, settings.sound_volume);
    const [eventResult, folderResult] = await Promise.allSettled([
      ipc.listEvents(),
      ipc.listFolders(editorCategory),
    ]);
    setEditorChoices(eventResult.status === "fulfilled" ? eventResult.value.events : events);
    setEditorFolders(mergeUnique([...(defaultSubcategoriesByCategory[editorCategory] ?? []), ...(folderResult.status === "fulfilled" ? folderResult.value.folders.map((item) => item.name) : [])]));
  }
  function openCreate() { void prepareEditor(null); }
  function openEdit(event: BoltyEvent) { void prepareEditor(event); }
  function closeEditor() { setEditorOpen(false); setEditorEvent(null); setAssistant("idle"); }

  async function saveEvent(event: BoltyEvent) {
    setSaving(true);
    try {
      const result = await ipc.saveEvent(event);
      setEvents((current) => event.id ? current.map((item) => item.id === result.event.id ? result.event : item) : [result.event, ...current]);
      setPinnedEvents((current) => current.map((item) => item.id === result.event.id ? result.event : item));
      setCounts((current) => {
        const next = { ...current };
        if (!event.id) next[result.event.category] = (next[result.event.category] ?? 0) + 1;
        else if (editorEvent && editorEvent.category !== result.event.category) {
          next[editorEvent.category] = Math.max(0, (next[editorEvent.category] ?? 1) - 1);
          next[result.event.category] = (next[result.event.category] ?? 0) + 1;
        }
        return next;
      });
      if (result.event.folder) {
        setFolders((current) => current.includes(result.event.folder) ? current : [...current, result.event.folder].sort((a, b) => a.localeCompare(b, "es")));
      }
      closeEditor();
      addToast("success", event.id ? "Evento actualizado" : "Nueva misión creada", `«${result.event.name}» está listo.`);
      playSound("success", settings.sounds_enabled, settings.sound_volume);
    } catch (error) {
      setAssistant("error"); addToast("danger", "No se pudo guardar", error instanceof Error ? error.message : undefined); playSound("error", settings.sounds_enabled, settings.sound_volume);
    } finally { setSaving(false); }
  }

  async function deleteEvent() {
    if (!pendingDelete?.id) return;
    try {
      await ipc.deleteEvent(pendingDelete.id);
      setEvents((current) => current.filter((event) => event.id !== pendingDelete.id));
      setPinnedEvents((current) => current.filter((event) => event.id !== pendingDelete.id));
      setCounts((current) => ({ ...current, [pendingDelete.category]: Math.max(0, (current[pendingDelete.category] ?? 1) - 1) }));
      addToast("success", "Evento eliminado", `«${pendingDelete.name}» abandonó la órbita.`);
    } catch (error) { addToast("danger", "No se pudo eliminar", error instanceof Error ? error.message : undefined); }
    finally { setPendingDelete(null); }
  }

  async function loadDockCatalog() {
    const result = await ipc.listEvents();
    return result.events;
  }

  async function pinToHome(event: BoltyEvent) {
    if (!event.id) return;
    try {
      const result = await ipc.pinEvent(event.id);
      setPinnedEvents((current) => current.some((item) => item.id === result.event.id) ? current : [...current, result.event]);
      addToast("success", "Anclado a Inicio", `«${result.event.name}» ya aparece en Inicio.`);
    } catch (error) {
      addToast("danger", "No se pudo anclar", error instanceof Error ? error.message : undefined);
      throw error;
    }
  }

  async function unpinFromHome(event: BoltyEvent) {
    if (!event.id) return;
    try {
      await ipc.unpinEvent(event.id);
      setPinnedEvents((current) => current.filter((item) => item.id !== event.id));
      addToast("success", "Desanclado de Inicio", `«${event.name}» ya no aparece en Inicio.`);
    } catch (error) {
      addToast("danger", "No se pudo desanclar", error instanceof Error ? error.message : undefined);
      throw error;
    }
  }

  async function runEvent(event: BoltyEvent, confirmed = false) {
    if (!event.id) return;
    setCommandBusy(true); setAssistant("executing"); playSound("execute", settings.sounds_enabled, settings.sound_volume);
    try {
      const result = await ipc.executeEvent(event.id, confirmed);
      if (result.requires_confirmation) { setPendingDanger({ type: "event", value: event.id, name: event.name }); setAssistant("idle"); return; }
      setAssistant("success"); addToast("success", "Misión completada", result.message); playSound("success", settings.sounds_enabled, settings.sound_volume);
      window.setTimeout(() => setAssistant(voiceRunning && settings.hands_free ? "listening" : "idle"), 1800);
    } catch (error) {
      setAssistant("error");
      addToast("danger", "La misión falló", error instanceof Error ? error.message : undefined);
      playSound("error", settings.sounds_enabled, settings.sound_volume);
      window.setTimeout(() => setAssistant(voiceRunning && settings.hands_free ? "listening" : "idle"), 1800);
    }
    finally { setCommandBusy(false); }
  }

  async function runCommand(confirmed = false, textOverride?: string) {
    const text = (textOverride ?? command).trim(); if (!text) return;
    setCommandBusy(true); setAssistant("thinking");
    try {
      const result = await ipc.executeText(text, confirmed);
      if (result.requires_confirmation) { setPendingDanger({ type: "text", value: text, name: result.event?.name ?? text }); setAssistant("idle"); return; }
      setAssistant("success"); addToast("success", "Orden ejecutada", result.message); setCommand(""); setSuggestions([]); playSound("success", settings.sounds_enabled, settings.sound_volume);
      window.setTimeout(() => setAssistant(voiceRunning && settings.hands_free ? "listening" : "idle"), 1800);
    } catch (error) {
      setAssistant("error");
      addToast("danger", "Bolty no pudo ejecutar la orden", error instanceof Error ? error.message : undefined);
      playSound("error", settings.sounds_enabled, settings.sound_volume);
      window.setTimeout(() => setAssistant(voiceRunning && settings.hands_free ? "listening" : "idle"), 1800);
    }
    finally { setCommandBusy(false); }
  }

  async function toggleVoice() {
    if (voiceRunning) {
      try { await ipc.voiceStop(); }
      catch (error) { addToast("danger", "No se pudo detener el micrófono", error instanceof Error ? error.message : undefined); }
      setVoiceRunning(false);
      setAssistant("idle");
      playSound("toggleOff", settings.sounds_enabled, settings.sound_volume);
      return;
    }

    setAssistant("thinking");
    try {
      const currentStatus = await ipc.voiceStatus(settings.language);
      if (!currentStatus.model_available) {
        addToast("info", "Preparando reconocimiento de voz", "Bolty está descargando el modelo Vosk oficial. Solo será necesario la primera vez.");
        const installed = await ipc.installVoiceModel(settings.language);
        if (!installed.model_available) throw new Error(installed.message || `No se pudo instalar el modelo en ${installed.model_path}.`);
        addToast("success", "Modelo de voz instalado", "El reconocimiento de voz ya está listo para usarse.");
      }

      setAssistant("listening");
      const status = await ipc.voiceStart(settings.language, settings.hands_free, settings.wake_word);
      if (!status.started) throw new Error(status.message ?? `No se encontró el modelo de voz en ${status.model_path}.`);
      setVoiceRunning(true);
      playSound("toggleOn", settings.sounds_enabled, settings.sound_volume);
      addToast("info", settings.hands_free ? `Modo manos libres: «${settings.wake_word}»` : "Bolty te escucha", settings.hands_free ? "Bolty queda en espera. Di la palabra de activación y escucharás una señal cuando acepte tu orden." : "Di una orden clara; la escucha termina automáticamente.");
    } catch (error) {
      setVoiceRunning(false);
      setAssistant("error");
      addToast("danger", "No se inició el reconocimiento de voz", error instanceof Error ? error.message : undefined);
      playSound("error", settings.sounds_enabled, settings.sound_volume);
      window.setTimeout(() => setAssistant("idle"), 2200);
    }
  }

  async function confirmDanger() {
    const pending = pendingDanger; setPendingDanger(null);
    if (!pending) return;
    if (pending.type === "event") {
      const event = events.find((item) => item.id === pending.value);
      if (event) await runEvent(event, true);
    } else { const text = String(pending.value); setCommand(text); await runCommand(true, text); }
  }

  useEffect(() => {
    if (!voiceRunning) return;
    let cancelled = false;
    let polling = false;
    const poll = async () => {
      if (polling || cancelled) return;
      polling = true;
      try {
        const status = await ipc.voicePoll();
        for (const event of status.events ?? []) {
          if (event.type === "partial" && !settings.hands_free) setCommand(event.text);
          if (event.type === "wake") {
            setAssistant("wake");
            playSound("wakeOn", settings.sounds_enabled, settings.sound_volume);
            addToast("info", "Bolty te está escuchando", "Palabra de activación detectada. Di ahora tu orden.");
          }
          if (event.type === "transcript") {
            setCommand(event.text);
            if (!settings.hands_free) setVoiceRunning(false);
            await runCommand(false, event.text);
          }
          if (event.type === "wake_end") {
            playSound("wakeOff", settings.sounds_enabled, settings.sound_volume);
            if (settings.hands_free && !cancelled && voiceRunning) {
              setAssistant("listening");
              if (event.reason === "timeout") addToast("info", "Bolty vuelve a estar en espera", `Di «${settings.wake_word}» cuando quieras dar otra orden.`);
            }
          }
          if (event.type === "error") {
            setVoiceRunning(false);
            setAssistant("error");
            addToast("danger", "Error de micrófono", event.message);
            playSound("error", settings.sounds_enabled, settings.sound_volume);
            window.setTimeout(() => setAssistant("idle"), 2200);
          }
          if (event.type === "listening" && !event.active) {
            setVoiceRunning(false);
            setAssistant((current) => current === "listening" || current === "wake" ? "idle" : current);
            playSound("toggleOff", settings.sounds_enabled, settings.sound_volume);
          }
        }
        if (!status.running && !settings.hands_free) setVoiceRunning(false);
      } catch (error) {
        setVoiceRunning(false); setAssistant("error");
        addToast("danger", "Se perdió la conexión con el micrófono", error instanceof Error ? error.message : undefined);
      } finally { polling = false; }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 280);
    return () => { cancelled = true; window.clearInterval(timer); };
  // The voice session deliberately captures the settings that were active when it started.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceRunning]);

  async function loadSystem() {
    setSystemLoading(true); setSystemError("");
    try { setSystemStatuses((await ipc.getSystemStatus()).statuses); }
    catch (error) { setSystemError(error instanceof Error ? error.message : "No se pudo leer el sistema."); }
    finally { setSystemLoading(false); }
  }

  async function patchSettings(patch: Partial<AppSettings>) {
    const previous = settings;
    setSettings((current) => ({ ...current, ...patch })); setSettingsSaving(true);
    try {
      const result = await ipc.updateSettings(patch); setSettings(result.settings);
      const boolValue = Object.values(patch)[0]; if (typeof boolValue === "boolean") playSound(boolValue ? "toggleOn" : "toggleOff", result.settings.sounds_enabled, result.settings.sound_volume);
    } catch (error) { setSettings(previous); addToast("danger", "No se guardaron los ajustes", error instanceof Error ? error.message : undefined); }
    finally { setSettingsSaving(false); }
  }

  async function restoreTasks() {
    try { await ipc.restoreTasks(); addToast("success", "Tareas restauradas", "La biblioteca original vuelve a estar disponible."); if (page === "tasks") await loadEvents("Tareas"); }
    catch (error) { addToast("danger", "No se pudieron restaurar", error instanceof Error ? error.message : undefined); }
  }

  async function createSubcategory(name: string) {
    if (!currentCategory) return;
    try {
      const result = await ipc.createFolder(currentCategory, name);
      setFolders((current) => mergeUnique([...current, result.folder.name]));
      setLibrarySubcategories((current) => ({ ...current, [currentCategory]: mergeUnique([...(current[currentCategory] ?? []), result.folder.name]) }));
      addToast("success", "Subcategoría creada", `«${result.folder.name}» está lista.`);
    } catch (error) {
      addToast("danger", "No se pudo crear la subcategoría", error instanceof Error ? error.message : undefined);
      throw error;
    }
  }

  async function renameSubcategory(oldName: string, newName: string) {
    if (!currentCategory) return;
    try {
      const result = await ipc.renameFolder(currentCategory, oldName, newName);
      setFolders((current) => mergeUnique(current.map((item) => item === oldName ? result.folder.name : item)));
      setEvents((current) => current.map((event) => event.category === currentCategory && event.folder === oldName ? { ...event, folder: result.folder.name } : event));
      setEditorFolders((current) => mergeUnique(current.map((item) => item === oldName ? result.folder.name : item)));
      setLibrarySubcategories((current) => ({ ...current, [currentCategory]: mergeUnique((current[currentCategory] ?? []).map((item) => item === oldName ? result.folder.name : item)) }));
      addToast("success", "Subcategoría actualizada", `Ahora se llama «${result.folder.name}».`);
    } catch (error) {
      addToast("danger", "No se pudo renombrar la subcategoría", error instanceof Error ? error.message : undefined);
      throw error;
    }
  }

  async function deleteSubcategory(name: string) {
    if (!currentCategory) return;
    try {
      const result = await ipc.deleteFolder(currentCategory, name);
      setFolders((current) => current.filter((item) => item !== name));
      setEditorFolders((current) => current.filter((item) => item !== name));
      setEvents((current) => current.map((event) => event.category === currentCategory && event.folder === name ? { ...event, folder: "" } : event));
      setLibrarySubcategories((current) => ({ ...current, [currentCategory]: (current[currentCategory] ?? []).filter((item) => item !== name) }));
      addToast("success", "Subcategoría eliminada", result.moved_events ? `${result.moved_events} evento${result.moved_events === 1 ? "" : "s"} ahora aparecen en Todas.` : undefined);
    } catch (error) {
      addToast("danger", "No se pudo eliminar la subcategoría", error instanceof Error ? error.message : undefined);
      throw error;
    }
  }

  function renderPage() {
    if (page === "home") return <DashboardPage counts={counts} pinnedEvents={pinnedEvents} onNavigate={navigate} onCreate={openCreate} onExecute={runEvent} onLoadEvents={loadDockCatalog} onPin={pinToHome} onUnpin={unpinFromHome} onOpenSettings={openSettings} />;
    const category = currentCategory;
    const copy = category ? pageCopy[category] : { title: "Biblioteca", description: "Tu galaxia completa de categorías, subcategorías y accesos favoritos." };
    return <LibraryPage title={copy.title} description={copy.description} category={category} counts={counts} subcategories={folders} allSubcategories={librarySubcategories} events={filteredEvents} loading={loadingEvents} query={query} onQuery={setQuery} onCreate={openCreate} onCreateSubcategory={createSubcategory} onRenameSubcategory={renameSubcategory} onDeleteSubcategory={deleteSubcategory} onExecute={runEvent} onEdit={openEdit} onDelete={setPendingDelete} selected={selected} onSelect={setSelected} onOpenCategory={navigate} />;
  }

  if (booting) return <div className="startup-screen"><img src="/mascot/01_bolty_splash_intro.png" alt="Bolty Switch" /><LoadingState label="Encendiendo el observatorio de Bolty…" /></div>;
  if (fatalError) return <div className="startup-screen"><ErrorState message={fatalError} onRetry={() => void bootstrap()} /></div>;

  const shouldShowCommandDock = page === "home";

  return (
    <>
      <AppShell
        items={navigation}
        active={page}
        onNavigate={navigate}
        pageKey={page}
        runInBackground={settings.run_in_background}
        sidebarCollapsed={Boolean(settings.sidebar_collapsed)}
        commandDock={shouldShowCommandDock ? (
          <CommandDock
            value={command}
            onChange={setCommand}
            onExecute={() => void runCommand()}
            suggestions={suggestions}
            onSuggestion={(value) => { setCommand(value); setSuggestions([]); }}
            state={assistant}
            busy={commandBusy}
            onVoice={() => void toggleVoice()}
          />
        ) : undefined}
      >
        <Suspense fallback={<LoadingState label="Alineando esta zona de la galaxia…" />}>{renderPage()}</Suspense>
      </AppShell>
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Opciones" description="Personaliza Bolty Switch y consulta el estado del equipo." size="large">
        <Suspense fallback={<LoadingState label="Preparando las opciones de Bolty…" />}>
          <SettingsPage
            embedded
            settings={settings}
            saving={settingsSaving}
            onPatch={patchSettings}
            onRestore={() => void restoreTasks()}
            onOpenVoiceFolder={() => void ipc.openVoiceModelFolder(settings.language).then((result) => addToast("info", "Carpeta del modelo abierta", result.path)).catch((error) => addToast("danger", "No se abrió la carpeta", error instanceof Error ? error.message : undefined))}
            systemStatuses={systemStatuses}
            systemLoading={systemLoading}
            systemError={systemError}
            onRefreshSystem={() => void loadSystem()}
            onOpenSystem={(uri) => void ipc.executeText(`open-uri:${uri}`).catch((error) => addToast("danger", "No se abrió la configuración", error.message))}
            onShowWidget={(kind) => void ipc.showWidget(kind).catch((error) => addToast("danger", "No se pudo abrir el widget", error instanceof Error ? error.message : undefined))}
          />
        </Suspense>
      </Dialog>
      <EventEditor open={editorOpen} event={editorEvent} defaultCategory={currentCategory ?? "Aplicaciones"} saving={saving} availableEvents={editorChoices} availableFolders={editorFolders} onClose={closeEditor} onSave={(event) => void saveEvent(event)} />
      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} title="Eliminar evento" description="Esta acción no puede deshacerse." size="small" footer={<><Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancelar</Button><Button variant="danger" icon="trash" onClick={() => void deleteEvent()}>Eliminar</Button></>}><div className="confirm-dialog"><img src="/mascot/26_bolty_eliminar_evento.png" alt="Bolty" /><p>¿Quieres eliminar <strong>«{pendingDelete?.name}»</strong> y sus comandos asociados?</p></div></Dialog>
      <Dialog open={Boolean(pendingDanger)} onClose={() => setPendingDanger(null)} title="Confirmar acción crítica" description="Bolty necesita tu permiso antes de continuar." size="small" footer={<><Button variant="ghost" onClick={() => setPendingDanger(null)}>Cancelar</Button><Button variant="danger" icon="bolt" onClick={() => void confirmDanger()}>Confirmar y ejecutar</Button></>}><div className="confirm-dialog"><img src="/mascot/23_bolty_error.png" alt="Bolty avisa de una acción crítica" /><p>La misión <strong>«{pendingDanger?.name}»</strong> puede cerrar la sesión, reiniciar, apagar o eliminar contenido.</p></div></Dialog>
      <ToastRegion toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </>
  );
}
