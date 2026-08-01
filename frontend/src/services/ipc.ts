import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  BackendResponse,
  BoltyEvent,
  BootstrapData,
  SystemStatus,
  VoiceStatus,
} from "../types/domain";

const isTauri = () => "__TAURI_INTERNALS__" in window;

const mockEvents: BoltyEvent[] = [
  {
    id: 9001,
    category: "Aplicaciones",
    name: "Obsidian",
    icon: "emoji:◈",
    action_type: "path",
    target: "C:\\Program Files\\Obsidian\\Obsidian.exe",
    description: "Abre tu espacio de notas y estudio.",
    folder: "Estudio",
    commands: ["abre obsidian", "inicia mis notas"],
    metadata: {},
    is_builtin: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 9002,
    category: "Páginas Webs",
    name: "Zazen AI Studio",
    icon: "emoji:✦",
    action_type: "url",
    target: "https://zazenaistudio.com",
    description: "Abre la web del estudio.",
    folder: "Favoritos",
    commands: ["abre zazen ai studio"],
    metadata: {},
    is_builtin: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 9003,
    category: "Tareas",
    name: "Subir volumen",
    icon: "emoji:🔊",
    action_type: "task",
    target: "volume_up",
    description: "Aumenta el volumen general de Windows.",
    folder: "Acciones rápidas",
    commands: ["sube el volumen"],
    metadata: { task_action: "volume_up" },
    is_builtin: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let previewEvents: BoltyEvent[] = mockEvents.map((event) => ({ ...event, commands: [...event.commands], metadata: { ...event.metadata } }));
let previewFolders: Array<{ category: string; name: string }> = [...new Map(
  previewEvents.filter((event) => event.folder).map((event) => [`${event.category}::${event.folder}`, { category: event.category, name: event.folder }]),
).values()];
let previewPinnedIds: number[] = [9001, 9003];

let previewSettings: AppSettings = {
  sounds_enabled: true,
  sound_volume: 0.72,
  hands_free: false,
  language: "es",
  run_in_background: true,
  start_with_windows: false,
  confirm_dangerous_actions: true,
  wake_word: "Bolty",
  window_width: 1500,
  window_height: 900,
  first_run: false,
  reduced_effects: false,
  compact_density: false,
  sidebar_collapsed: false,
  background_music_enabled: false,
  background_music_volume: 0.28,
  cosmic_theme: "nebula-blue",
};

function responseId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function backendErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; error?: { message?: unknown }; code?: unknown };
    if (typeof candidate.message === "string") return candidate.message;
    if (typeof candidate.error?.message === "string") return candidate.error.message;
    try { return JSON.stringify(error); } catch { /* ignore unserializable values */ }
  }
  return "No se pudo comunicar con el backend de Bolty Switch.";
}

async function backendRequest<T>(command: string, payload: Record<string, unknown> = {}): Promise<T> {
  const request = { id: responseId(), command, payload };
  if (!isTauri()) return mockRequest<T>(command, payload);
  try {
    const response = await invoke<BackendResponse<T>>("backend_request", { request });
    if (!response.ok || !response.data) {
      throw new Error(response.error?.message ?? "El backend no respondió correctamente.");
    }
    return response.data;
  } catch (error) {
    throw new Error(backendErrorMessage(error));
  }
}

async function mockRequest<T>(command: string, payload: Record<string, unknown>): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 180));
  if (command === "bootstrap") {
    return {
      version: "0.6.6-preview",
      categories: {
        Aplicaciones: 1,
        "Páginas Webs": 1,
        "Películas y Series": 0,
        Música: 0,
        Documentos: 0,
        Imágenes: 0,
        Otros: 0,
        Tareas: 1,
        Guiones: 0,
      },
      events: previewEvents,
      pinned_events: previewPinnedIds.map((id) => previewEvents.find((event) => event.id === id)).filter(Boolean),
      settings: previewSettings,
    } as T;
  }
  if (command === "list_events") {
    const category = String(payload.category ?? "");
    const query = String(payload.query ?? "").toLocaleLowerCase();
    return {
      events: previewEvents.filter((event) =>
        (!category || event.category === category) &&
        (!query || `${event.name} ${event.description} ${event.commands.join(" ")}`.toLocaleLowerCase().includes(query)),
      ),
    } as T;
  }
  if (command === "list_folders") {
    const category = String(payload.category ?? "");
    return { folders: previewFolders.filter((item) => !category || item.category === category).sort((a, b) => a.name.localeCompare(b.name, "es")) } as T;
  }
  if (command === "create_folder") {
    const category = String(payload.category ?? "");
    const name = String(payload.name ?? "").trim();
    if (!name) throw new Error("Escribe un nombre para la subcategoría.");
    if (previewFolders.some((item) => item.category === category && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error("Ya existe una subcategoría con ese nombre.");
    const folder = { category, name };
    previewFolders = [...previewFolders, folder];
    return { folder } as T;
  }
  if (command === "rename_folder") {
    const category = String(payload.category ?? "");
    const oldName = String(payload.old_name ?? "").trim();
    const newName = String(payload.new_name ?? "").trim();
    if (!newName) throw new Error("Escribe el nuevo nombre de la subcategoría.");
    if (previewFolders.some((item) => item.category === category && item.name.toLocaleLowerCase() === newName.toLocaleLowerCase() && item.name.toLocaleLowerCase() !== oldName.toLocaleLowerCase())) throw new Error("Ya existe una subcategoría con ese nombre.");
    previewFolders = previewFolders.map((item) => item.category === category && item.name === oldName ? { ...item, name: newName } : item);
    previewEvents = previewEvents.map((event) => event.category === category && event.folder === oldName ? { ...event, folder: newName, updated_at: new Date().toISOString() } : event);
    return { folder: { category, name: newName } } as T;
  }
  if (command === "delete_folder") {
    const category = String(payload.category ?? "");
    const name = String(payload.name ?? "").trim();
    const moved = previewEvents.filter((event) => event.category === category && event.folder === name).length;
    previewFolders = previewFolders.filter((item) => !(item.category === category && item.name === name));
    previewEvents = previewEvents.map((event) => event.category === category && event.folder === name ? { ...event, folder: "", updated_at: new Date().toISOString() } : event);
    return { deleted: true, moved_events: moved } as T;
  }
  if (command === "list_pinned_events") {
    return { events: previewPinnedIds.map((id) => previewEvents.find((event) => event.id === id)).filter(Boolean) } as T;
  }
  if (command === "pin_event") {
    const eventId = Number(payload.event_id);
    const event = previewEvents.find((item) => item.id === eventId);
    if (!event) throw new Error("El evento ya no existe.");
    if (!previewPinnedIds.includes(eventId)) previewPinnedIds = [...previewPinnedIds, eventId];
    return { event } as T;
  }
  if (command === "unpin_event") {
    const eventId = Number(payload.event_id);
    previewPinnedIds = previewPinnedIds.filter((id) => id !== eventId);
    return { unpinned: true } as T;
  }
  if (command === "get_system_status") {
    return {
      statuses: [
        { key: "cpu", title: "Procesador", state: "24%", detail: "8 procesadores lógicos", icon: "◈", active: true, settings_uri: "" },
        { key: "memory", title: "Memoria RAM", state: "48%", detail: "7,7 / 16 GB", icon: "▤", active: true, settings_uri: "" },
        { key: "disk", title: "Almacenamiento", state: "62%", detail: "186 GB libres", icon: "💾", active: true, settings_uri: "ms-settings:storagesense" },
        { key: "network", title: "Red", state: "Conectada", detail: "Adaptador principal activo", icon: "◎", active: true, settings_uri: "ms-settings:network-status" },
      ],
    } as T;
  }
  if (command === "get_settings") return { settings: previewSettings } as T;
  if (command === "update_settings") {
    previewSettings = { ...previewSettings, ...(payload.patch as Partial<AppSettings> ?? {}) };
    return { settings: previewSettings } as T;
  }
  if (command === "search") {
    const query = String(payload.query ?? "").toLowerCase();
    return { suggestions: previewEvents.map((item) => item.name).filter((name) => name.toLowerCase().includes(query)) } as T;
  }
  if (command === "execute_text") {
    return { executed: true, event: previewEvents[0], message: "Evento ejecutado en modo de previsualización." } as T;
  }
  if (command === "execute_event") {
    return { executed: true, event: previewEvents.find((item) => item.id === Number(payload.event_id)), message: "Evento ejecutado en modo de previsualización." } as T;
  }
  if (command === "save_event") {
    const incoming = payload.event as BoltyEvent;
    const now = new Date().toISOString();
    const saved = { ...incoming, folder: incoming.folder ?? "", id: incoming.id ?? Math.max(9000, ...previewEvents.map((item) => item.id ?? 0)) + 1, created_at: incoming.created_at || now, updated_at: now };
    previewEvents = incoming.id ? previewEvents.map((item) => item.id === incoming.id ? saved : item) : [saved, ...previewEvents];
    return { event: saved } as T;
  }
  if (command === "delete_event") {
    const eventId = Number(payload.event_id);
    previewEvents = previewEvents.filter((item) => item.id !== eventId);
    previewPinnedIds = previewPinnedIds.filter((id) => id !== eventId);
    return { deleted: true } as T;
  }
  if (command === "voice_status") return { running: false, mode: "once", language: "es", model_path: "models/vosk-es", model_available: true } as T;
  if (command === "install_voice_model") return { installed: true, downloaded: false, running: false, mode: "once", language: "es", model_path: "models/vosk-es", model_available: true, message: "Modelo Vosk preparado en previsualización." } as T;
  if (command === "voice_start") return { running: true, started: true, mode: payload.hands_free ? "hands_free" : "once", language: String(payload.language ?? "es"), model_path: "models/vosk-es", model_available: true, message: "Micrófono simulado en previsualización." } as T;
  if (command === "voice_poll") return { running: false, mode: "once", language: "es", model_path: "models/vosk-es", model_available: false, events: [] } as T;
  if (command === "voice_stop") return { running: false, stopped: true, mode: "once", language: "es", model_path: "models/vosk-es", model_available: false } as T;
  if (command === "open_voice_model_folder") return { opened: true, path: "models/vosk-es" } as T;
  return {} as T;
}

async function invokeDesktop<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!isTauri()) return undefined as T;
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new Error(backendErrorMessage(error));
  }
}

export const ipc = {
  bootstrap: () => backendRequest<BootstrapData>("bootstrap"),
  listEvents: (category?: string, query = "") => backendRequest<{ events: BoltyEvent[] }>("list_events", { category, query }),
  listPinnedEvents: () => backendRequest<{ events: BoltyEvent[] }>("list_pinned_events"),
  pinEvent: (eventId: number) => backendRequest<{ event: BoltyEvent }>("pin_event", { event_id: eventId }),
  unpinEvent: (eventId: number) => backendRequest<{ unpinned: boolean }>("unpin_event", { event_id: eventId }),
  listFolders: (category?: string) => backendRequest<{ folders: Array<{ category: string; name: string }> }>("list_folders", { category }),
  createFolder: (category: string, name: string) => backendRequest<{ folder: { category: string; name: string } }>("create_folder", { category, name }),
  renameFolder: (category: string, oldName: string, newName: string) => backendRequest<{ folder: { category: string; name: string } }>("rename_folder", { category, old_name: oldName, new_name: newName }),
  deleteFolder: (category: string, name: string) => backendRequest<{ deleted: boolean; moved_events: number }>("delete_folder", { category, name }),
  search: (query: string) => backendRequest<{ suggestions: string[] }>("search", { query }),
  executeText: (text: string, confirmed = false) => backendRequest<{ executed: boolean; event?: BoltyEvent; message: string; requires_confirmation?: boolean }>("execute_text", { text, confirmed }),
  executeEvent: (eventId: number, confirmed = false) => backendRequest<{ executed: boolean; event?: BoltyEvent; message: string; requires_confirmation?: boolean }>("execute_event", { event_id: eventId, confirmed }),
  saveEvent: (event: BoltyEvent) => backendRequest<{ event: BoltyEvent }>("save_event", { event }),
  deleteEvent: (eventId: number) => backendRequest<{ deleted: boolean }>("delete_event", { event_id: eventId }),
  getSystemStatus: () => backendRequest<{ statuses: SystemStatus[] }>("get_system_status"),
  getSettings: () => backendRequest<{ settings: AppSettings }>("get_settings"),
  updateSettings: (patch: Partial<AppSettings>) => backendRequest<{ settings: AppSettings }>("update_settings", { patch }),
  restoreTasks: () => backendRequest<{ restored: boolean }>("restore_default_tasks"),
  voiceStatus: (language: string) => backendRequest<VoiceStatus>("voice_status", { language }),
  installVoiceModel: (language: string) => backendRequest<VoiceStatus & { installed: boolean; downloaded: boolean; message: string }>("install_voice_model", { language }),
  voiceStart: (language: string, handsFree: boolean, wakeWord: string) => backendRequest<VoiceStatus>("voice_start", { language, hands_free: handsFree, wake_word: wakeWord }),
  voicePoll: () => backendRequest<VoiceStatus>("voice_poll"),
  voiceStop: () => backendRequest<VoiceStatus>("voice_stop"),
  openVoiceModelFolder: (language: string) => backendRequest<{ opened: boolean; path: string }>("open_voice_model_folder", { language }),
  showWidget: (kind: "command" | "microphone") => invokeDesktop<void>("show_widget", { kind }),
  hideWidget: (kind: "command" | "microphone") => invokeDesktop<void>("hide_widget", { kind }),
  resizeWidget: (kind: "command" | "microphone", expanded: boolean) => invokeDesktop<void>("resize_widget", { kind, expanded }),
  showMainWindow: () => invokeDesktop<void>("show_main_window"),
};
