export type PageId =
  | "home"
  | "library"
  | "applications"
  | "web"
  | "media"
  | "music"
  | "documents"
  | "images"
  | "other"
  | "tasks"
  | "scripts"
  | "settings"
  | "help"
  | "about";

export type AssistantState =
  | "idle"
  | "searching"
  | "listening"
  | "wake"
  | "thinking"
  | "executing"
  | "success"
  | "error"
  | "create"
  | "edit"
  | "empty";

export interface BoltyEvent {
  id: number | null;
  category: string;
  name: string;
  icon: string;
  action_type: "url" | "path" | "task" | "script" | string;
  target: string;
  description: string;
  folder: string;
  commands: string[];
  metadata: Record<string, unknown>;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
  script_steps?: Array<{ event_id: number; position?: number; delay_ms: number }>;
}

export interface SystemStatus {
  key: string;
  title: string;
  state: string;
  detail: string;
  icon: string;
  active: boolean | null;
  settings_uri: string;
}

export interface AppSettings {
  sounds_enabled: boolean;
  sound_volume: number;
  hands_free: boolean;
  language: string;
  run_in_background: boolean;
  start_with_windows: boolean;
  confirm_dangerous_actions: boolean;
  wake_word: string;
  window_width: number;
  window_height: number;
  first_run: boolean;
  reduced_effects?: boolean;
  compact_density?: boolean;
  sidebar_collapsed?: boolean;
  background_music_enabled?: boolean;
  background_music_volume?: number;
  cosmic_theme?: string;
}

export interface BootstrapData {
  version: string;
  categories: Record<string, number>;
  events: BoltyEvent[];
  pinned_events: BoltyEvent[];
  settings: AppSettings;
}

export interface BackendError {
  code: string;
  message: string;
  details?: unknown;
}

export interface BackendResponse<T> {
  id: string;
  ok: boolean;
  data?: T;
  error?: BackendError;
}

export interface ToastMessage {
  id: string;
  tone: "info" | "success" | "danger";
  title: string;
  message?: string;
}

export type VoiceEvent =
  | { type: "listening"; active: boolean; timestamp: number }
  | { type: "partial"; text: string; timestamp: number }
  | { type: "transcript"; text: string; timestamp: number }
  | { type: "wake"; word: string; timestamp: number }
  | { type: "wake_end"; reason: "command" | "timeout" | "stopped" | string; timestamp: number }
  | { type: "level"; value: number; timestamp: number }
  | { type: "error"; message: string; timestamp: number };

export interface VoiceStatus {
  running: boolean;
  mode: "once" | "hands_free" | string;
  language: string;
  model_path: string;
  model_available: boolean;
  started?: boolean;
  stopped?: boolean;
  message?: string;
  events?: VoiceEvent[];
}
