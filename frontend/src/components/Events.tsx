import type { MouseEvent } from "react";
import { motion } from "motion/react";
import type { BoltyEvent } from "../types/domain";
import { Icon, type IconName } from "./Icon";
import { Card, ContextMenu, IconButton, MenuItem } from "./Primitives";

const categoryIcon: Record<string, IconName> = {
  Aplicaciones: "apps",
  "Páginas Webs": "globe",
  "Películas y Series": "play",
  Música: "music",
  Documentos: "file",
  Imágenes: "image",
  Otros: "spark",
  Tareas: "bolt",
  Guiones: "link",
};

const actionTypeLabel: Record<string, string> = {
  url: "Web",
  path: "Archivo",
  task: "Sistema",
  script: "Guion",
};

const categoryArtwork: Record<string, string> = {
  Aplicaciones: "03_bolty_aplicaciones.png",
  "Páginas Webs": "04_bolty_paginas_web.png",
  "Películas y Series": "05_bolty_peliculas_series.png",
  Música: "06_bolty_musica.png",
  Documentos: "07_bolty_documentos.png",
  Imágenes: "08_bolty_imagenes.png",
  Otros: "09_bolty_otros.png",
  Tareas: "10_bolty_tareas.png",
  Guiones: "12_bolty_guiones.png",
};


const taskNeonIcon: Record<string, string> = {
  volume_up: "094_speaker.png",
  volume_down: "094_speaker.png",
  volume_mute: "094_speaker.png",
  media_play_pause: "003_video_play.png",
  media_next: "003_video_play.png",
  media_previous: "003_video_play.png",
  brightness_up: "080_sun.png",
  brightness_down: "079_moon_crescent.png",
  wifi_on: "038_wifi_signal.png",
  wifi_off: "038_wifi_signal.png",
  bluetooth_on: "039_bluetooth.png",
  bluetooth_off: "039_bluetooth.png",
  open_bluetooth: "039_bluetooth.png",
  open_airplane: "070_airplane.png",
  open_dnd: "008_notification_bell.png",
  lock: "046_padlock.png",
  sleep: "079_moon_crescent.png",
  shutdown: "092_power_plug.png",
  restart: "118_lightning_bolt.png",
  sign_out: "044_link_chain.png",
  show_desktop: "088_desktop_monitor.png",
  open_explorer: "029_folder.png",
  open_task_manager: "028_checklist.png",
  open_settings: "033_settings_gear.png",
  open_sound: "014_headphones.png",
  open_display: "088_desktop_monitor.png",
  open_network: "037_globe.png",
  open_power: "092_power_plug.png",
  open_storage: "029_folder.png",
  screenshot: "004_camera.png",
  empty_recycle_bin: "029_folder.png",
  clear_clipboard: "030_document_page.png",
  open_calculator: "101_calculator.png",
  open_terminal: "043_browser_window.png",
  open_control_panel: "033_settings_gear.png",
  open_device_manager: "096_robot_head.png",
  open_location: "040_gps_pin.png",
  open_notifications: "008_notification_bell.png",
  open_night_light: "079_moon_crescent.png",
  open_windows_update: "118_lightning_bolt.png",
  open_security: "047_shield.png",
  open_installed_apps: "001_chat_bubble.png",
  open_default_apps: "033_settings_gear.png",
  open_printers: "090_printer.png",
  open_mouse: "085_smartphone.png",
  open_keyboard: "087_laptop.png",
  open_clipboard_settings: "030_document_page.png",
  open_personalization: "024_sparkles_star.png",
  open_datetime: "026_clock.png",
  open_language: "037_globe.png",
  open_accessibility: "097_graduation_cap.png",
  open_about: "098_atom.png",
  open_accounts: "009_user_profile.png",
  open_microphone_privacy: "006_microphone.png",
  open_camera_privacy: "004_camera.png",
  open_downloads: "036_download_arrow.png",
  open_documents_folder: "030_document_page.png",
  open_pictures_folder: "005_photo_gallery.png",
  open_recycle_bin: "029_folder.png",
  shortcut_clipboard_history: "030_document_page.png",
  shortcut_emoji: "082_smiley_face.png",
  shortcut_dictation: "006_microphone.png",
  shortcut_run: "118_lightning_bolt.png",
  shortcut_search: "032_search_magnifier.png",
  shortcut_task_view: "028_checklist.png",
  shortcut_quick_settings: "033_settings_gear.png",
  shortcut_notifications: "008_notification_bell.png",
  shortcut_project: "088_desktop_monitor.png",
  shortcut_minimize_all: "044_link_chain.png",
  shortcut_restore_all: "118_lightning_bolt.png",
};

const mountAnimation = {
  initial: { opacity: 0, scale: 0.96, filter: "blur(8px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.98, filter: "blur(6px)" },
  transition: { duration: 0.22, ease: "easeOut" },
} as const;

export function displayEventIcon(eventOrIcon: BoltyEvent | string, category?: string): { emoji?: string; icon?: IconName; image?: string } {
  if (typeof eventOrIcon !== "string") {
    if (eventOrIcon.category === "Tareas") {
      const action = String(eventOrIcon.target || eventOrIcon.metadata.task_action || "");
      const neon = taskNeonIcon[action] ?? "118_lightning_bolt.png";
      return { image: `/neon-icons/${neon}` };
    }
    if (eventOrIcon.icon?.startsWith("neon:")) return { image: `/neon-icons/${eventOrIcon.icon.replace("neon:", "")}` };
    const image = typeof eventOrIcon.metadata.imageIcon === "string" ? eventOrIcon.metadata.imageIcon : "";
    if (image) return { image };
    if (eventOrIcon.icon?.startsWith("emoji:")) return { emoji: eventOrIcon.icon.replace("emoji:", "") };
    return { icon: categoryIcon[eventOrIcon.category] ?? "bolt" };
  }
  if (eventOrIcon?.startsWith("neon:")) return { image: `/neon-icons/${eventOrIcon.replace("neon:", "")}` };
  if (eventOrIcon?.startsWith("emoji:")) return { emoji: eventOrIcon.replace("emoji:", "") };
  return { icon: categoryIcon[category ?? ""] ?? "bolt" };
}

export function EventVisual({ event, size = "md" }: { event: BoltyEvent; size?: "sm" | "md" | "lg" | "xl" }) {
  const visual = displayEventIcon(event);
  return (
    <span className={`event-visual event-visual--${size}`}>
      {visual.image ? <img src={visual.image} alt="" /> : visual.emoji ? <span>{visual.emoji}</span> : <Icon name={visual.icon ?? "bolt"} size={size === "xl" ? 46 : size === "lg" ? 34 : size === "md" ? 26 : 20} />}
    </span>
  );
}


export function getEventArtwork(event: BoltyEvent) {
  const visual = displayEventIcon(event);
  if (visual.image) return visual.image;
  return `/mascot/${categoryArtwork[event.category] ?? "02_bolty_principal.png"}`;
}

function EventActions({ event, onExecute, onEdit, onDelete }: { event: BoltyEvent; onExecute: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <ContextMenu trigger={<IconButton icon="more" label={`Opciones de ${event.name}`} />}>
      <MenuItem icon="bolt" onClick={onExecute}>Ejecutar</MenuItem>
      <MenuItem icon="edit" onClick={onEdit}>Editar</MenuItem>
      <MenuItem icon="trash" danger onClick={onDelete}>Eliminar</MenuItem>
    </ContextMenu>
  );
}

export function EventCard({ event, onExecute, onEdit, onDelete, selected, onSelect }: {
  event: BoltyEvent;
  onExecute: () => void;
  onEdit: () => void;
  onDelete: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <motion.div {...mountAnimation} layout>
      <Card interactive selected={selected} className="event-card event-card--simple" onClick={onSelect}>
        <div className="event-card__top">
          <button className="event-card__icon-button" onClick={(e: MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); onExecute(); }}>
            <EventVisual event={event} size="md" />
          </button>
          <EventActions event={event} onExecute={onExecute} onEdit={onEdit} onDelete={onDelete} />
        </div>
        <div className="event-card__copy">
          <small>{event.folder || event.category}</small>
          <h3>{event.name}</h3>
        </div>
      </Card>
    </motion.div>
  );
}

export function LaunchpadEventCard({ event, onExecute, onEdit, onDelete, selected, onSelect }: {
  event: BoltyEvent;
  onExecute: () => void;
  onEdit: () => void;
  onDelete: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <motion.article layout className={`launchpad-card ${selected ? "is-selected" : ""}`} {...mountAnimation} whileHover={{ scale: 1.02 }} onClick={onSelect}>
      <div className="launchpad-card__toolbar"><EventActions event={event} onExecute={onExecute} onEdit={onEdit} onDelete={onDelete} /></div>
      <button type="button" className="launchpad-card__button" onClick={(e) => { e.stopPropagation(); onExecute(); }}>
        <EventVisual event={event} size="lg" />
        <strong>{event.name}</strong>
        {event.folder && <small>{event.folder}</small>}
      </button>
    </motion.article>
  );
}

export function StreamEventCard({ event, onExecute, onEdit, onDelete, selected, onSelect }: {
  event: BoltyEvent;
  onExecute: () => void;
  onEdit: () => void;
  onDelete: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <motion.article layout className={`stream-card ${selected ? "is-selected" : ""}`} {...mountAnimation} whileHover={{ scale: 1.01 }} onClick={onSelect}>
      <div className="stream-card__visual" onClick={(e) => { e.stopPropagation(); onExecute(); }}>
        <div className="stream-card__gradient" />
        <EventVisual event={event} size="lg" />
        <span className="stream-card__badge">{event.folder || actionTypeLabel[event.action_type] || event.category}</span>
      </div>
      <div className="stream-card__footer">
        <div>
          <strong>{event.name}</strong>
          <small>{event.category}</small>
        </div>
        <EventActions event={event} onExecute={onExecute} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </motion.article>
  );
}

export function PosterEventCard({ event, onExecute, onEdit, onDelete, selected, onSelect }: {
  event: BoltyEvent;
  onExecute: () => void;
  onEdit: () => void;
  onDelete: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const artwork = getEventArtwork(event);
  const badge = event.folder || actionTypeLabel[event.action_type] || event.category;
  return (
    <motion.article layout className={`media-poster ${selected ? "is-selected" : ""}`} {...mountAnimation} whileHover={{ y: -6, scale: 1.02 }} onClick={onSelect}>
      <button
        type="button"
        className="media-poster__visual"
        aria-label={`Abrir ${event.name}`}
        onClick={(e) => { e.stopPropagation(); onExecute(); }}
        style={{ backgroundImage: `linear-gradient(180deg, rgba(4, 8, 20, 0.06), rgba(4, 8, 20, 0.1) 30%, rgba(4, 8, 20, 0.84) 100%), url("${artwork}")` }}
      >
        <span className="media-poster__badge">{badge}</span>
        <span className="media-poster__play"><Icon name="play" size={15} /></span>
      </button>
      <div className="media-poster__meta">
        <strong>{event.name}</strong>
        <small>{event.description || event.category}</small>
      </div>
      <div className="media-poster__menu"><EventActions event={event} onExecute={onExecute} onEdit={onEdit} onDelete={onDelete} /></div>
    </motion.article>
  );
}

export function LandscapeEventCard({ event, onExecute, onEdit, onDelete, selected, onSelect }: {
  event: BoltyEvent;
  onExecute: () => void;
  onEdit: () => void;
  onDelete: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const artwork = getEventArtwork(event);
  const badge = event.folder || actionTypeLabel[event.action_type] || event.category;
  return (
    <motion.article layout className={`media-landscape ${selected ? "is-selected" : ""}`} {...mountAnimation} whileHover={{ y: -5, scale: 1.015 }} onClick={onSelect}>
      <button
        type="button"
        className="media-landscape__visual"
        aria-label={`Ver ${event.name}`}
        onClick={(e) => { e.stopPropagation(); onExecute(); }}
        style={{ backgroundImage: `linear-gradient(90deg, rgba(4, 8, 20, 0.9) 0%, rgba(4, 8, 20, 0.55) 45%, rgba(4, 8, 20, 0.12) 100%), url("${artwork}")` }}
      >
        <div className="media-landscape__copy">
          <span className="eyebrow">{badge}</span>
          <strong>{event.name}</strong>
          <small>{event.description || `Acceso directo a ${event.name}.`}</small>
        </div>
        <span className="media-landscape__play"><Icon name="play" size={15} /></span>
      </button>
      <div className="media-landscape__menu"><EventActions event={event} onExecute={onExecute} onEdit={onEdit} onDelete={onDelete} /></div>
    </motion.article>
  );
}

export function EventDetail({ event, onExecute, onEdit, onClose }: { event: BoltyEvent; onExecute: () => void; onEdit: () => void; onClose: () => void }) {
  return (
    <motion.aside className="event-detail" initial={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 0.99, filter: "blur(8px)" }}>
      <header>
        <EventVisual event={event} size="lg" />
        <IconButton icon="x" label="Cerrar detalle" onClick={onClose} />
      </header>
      <span className="eyebrow">{event.folder ? `${event.category} · ${event.folder}` : event.category}</span>
      <h2>{event.name}</h2>
      {event.description && <p>{event.description}</p>}
      <dl>
        <div><dt>Tipo</dt><dd>{actionTypeLabel[event.action_type] ?? event.action_type}</dd></div>
        <div><dt>Destino</dt><dd>{event.target || "Acción interna"}</dd></div>
      </dl>
      <div className="event-detail__commands">
        <strong>Comandos</strong>
        {event.commands.map((command) => <span key={command}>{command}</span>)}
      </div>
      <footer><button className="button button--secondary" onClick={onEdit}><Icon name="edit" size={17} /> Editar</button><button className="button button--primary" onClick={onExecute}><Icon name="bolt" size={17} /> Ejecutar</button></footer>
    </motion.aside>
  );
}
