import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { motion } from "motion/react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import type { BoltyEvent } from "../types/domain";
import { Dialog } from "./Feedback";
import { Button, IconButton, SearchField, Select, TextField } from "./Primitives";
import { EventVisual } from "./Events";
import { Icon } from "./Icon";
import { neonIcons } from "../data/neonIcons";

type CategoryEditorConfig = {
  mascot: string;
  description: string;
  targetLabel?: string;
  targetPlaceholder?: string;
  usesFilePicker?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
};

const categoryDisplayLabel: Record<string, string> = {
  "Películas y Series": "Películas",
  "Páginas Webs": "Páginas web",
};

function displayCategory(category: string) {
  return categoryDisplayLabel[category] ?? category;
}

const categoryEditorConfig: Record<string, CategoryEditorConfig> = {
  Aplicaciones: {
    mascot: "03_bolty_aplicaciones.png",
    description: "Añade un programa o juego a tu Launchpad.",
    targetLabel: "Ruta",
    targetPlaceholder: "Selecciona una aplicación",
    usesFilePicker: true,
    filters: [{ name: "Aplicaciones", extensions: ["exe", "lnk", "msi", "bat", "cmd", "com"] }],
  },
  "Páginas Webs": {
    mascot: "04_bolty_paginas_web.png",
    description: "Guarda una página para abrirla con una orden.",
    targetLabel: "URL",
    targetPlaceholder: "https://...",
  },
  "Películas y Series": {
    mascot: "05_bolty_peliculas_series.png",
    description: "Añade una película, serie o episodio a tu colección visual.",
    targetLabel: "Ruta",
    targetPlaceholder: "Selecciona una película o episodio",
    usesFilePicker: true,
    filters: [{ name: "Vídeos", extensions: ["mp4", "mkv", "avi", "mov", "wmv", "webm", "m4v"] }],
  },
  Música: {
    mascot: "06_bolty_musica.png",
    description: "Añade una canción, audio o lista de reproducción.",
    targetLabel: "Ruta",
    targetPlaceholder: "Selecciona un archivo de audio",
    usesFilePicker: true,
    filters: [{ name: "Audio", extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "wma", "m3u", "m3u8"] }],
  },
  Documentos: {
    mascot: "07_bolty_documentos.png",
    description: "Añade un documento para abrirlo rápidamente.",
    targetLabel: "Ruta",
    targetPlaceholder: "Selecciona un documento",
    usesFilePicker: true,
    filters: [{ name: "Documentos", extensions: ["pdf", "txt", "md", "doc", "docx", "odt", "rtf", "xls", "xlsx", "ods", "ppt", "pptx", "odp", "csv"] }],
  },
  Imágenes: {
    mascot: "08_bolty_imagenes.png",
    description: "Añade una imagen a tu galería de accesos.",
    targetLabel: "Ruta",
    targetPlaceholder: "Selecciona una imagen",
    usesFilePicker: true,
    filters: [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "ico", "tiff"] }],
  },
  Otros: {
    mascot: "09_bolty_otros.png",
    description: "Añade cualquier archivo que quieras tener a mano.",
    targetLabel: "Ruta",
    targetPlaceholder: "Selecciona un archivo",
    usesFilePicker: true,
  },
  Tareas: {
    mascot: "10_bolty_tareas.png",
    description: "Crea una acción rápida del sistema Windows.",
    targetLabel: "Acción interna",
    targetPlaceholder: "open_settings",
  },
  Guiones: {
    mascot: "12_bolty_guiones.png",
    description: "Combina eventos existentes en una secuencia.",
  },
};

function resolveActionType(category: string, target = ""): BoltyEvent["action_type"] {
  if (category === "Guiones") return "script";
  if (category === "Tareas") return "task";
  if (category === "Páginas Webs" || /^https?:\/\//i.test(target.trim())) return "url";
  return "path";
}

function emptyEvent(category = "Aplicaciones"): BoltyEvent {
  return {
    id: null,
    category,
    name: "",
    icon: "neon:118_lightning_bolt.png",
    action_type: resolveActionType(category),
    target: "",
    description: "",
    folder: "",
    commands: [],
    metadata: {},
    is_builtin: false,
    created_at: "",
    updated_at: "",
    script_steps: [],
  };
}

export function EventEditor({ open, event, defaultCategory, saving, availableEvents, availableFolders, onClose, onSave }: {
  open: boolean;
  event: BoltyEvent | null;
  defaultCategory?: string;
  saving: boolean;
  availableEvents: BoltyEvent[];
  availableFolders: string[];
  onClose: () => void;
  onSave: (event: BoltyEvent) => void;
}) {
  const [draft, setDraft] = useState<BoltyEvent>(emptyEvent(defaultCategory));
  const [commands, setCommands] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconQuery, setIconQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const category = event?.category || defaultCategory || "Aplicaciones";
    const next = event
      ? {
          ...event,
          category,
          folder: event.folder ?? "",
          commands: [...event.commands],
          metadata: { ...event.metadata },
          script_steps: (event.script_steps ?? []).map((step) => ({ ...step })),
        }
      : emptyEvent(category);
    next.action_type = resolveActionType(next.category, next.target);
    setDraft(next);
    setCommands(next.commands.join("\n"));
    setSubmitted(false);
    setPickerError("");
  }, [event, defaultCategory, open]);

  const editorConfig = categoryEditorConfig[draft.category] ?? categoryEditorConfig.Aplicaciones;
  const isScript = draft.category === "Guiones";
  const usesFilePicker = Boolean(editorConfig.usesFilePicker);
  const selectableEvents = useMemo(
    () => availableEvents.filter((item) => item.id != null && item.id !== draft.id),
    [availableEvents, draft.id],
  );
  const commandList = commands.split("\n").map((value) => value.trim()).filter(Boolean);
  const currentFolders = useMemo(() => {
    const values = [...availableFolders];
    if (draft.folder) values.push(draft.folder);
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  }, [availableFolders, draft.folder]);
  const imageIcon = typeof draft.metadata.imageIcon === "string" ? draft.metadata.imageIcon : "";
  const selectedNeonIcon = draft.icon.startsWith("neon:") ? draft.icon.replace("neon:", "") : "";
  const filteredNeonIcons = useMemo(() => {
    const needle = iconQuery.trim().toLocaleLowerCase("es");
    return needle ? neonIcons.filter((item) => `${item.label} ${item.filename}`.toLocaleLowerCase("es").includes(needle)) : neonIcons;
  }, [iconQuery]);
  const errors = {
    name: submitted && !draft.name.trim() ? "Escribe un nombre para el evento." : "",
    target: submitted && !isScript && !draft.target.trim()
      ? usesFilePicker ? "Selecciona un archivo." : "Completa este campo."
      : "",
    commands: submitted && commandList.length === 0 ? "Añade al menos un comando." : "",
    steps: submitted && isScript && !(draft.script_steps?.length) ? "Añade al menos un evento al guion." : "",
  };

  function patch(patchValue: Partial<BoltyEvent>) {
    setDraft((current) => ({ ...current, ...patchValue }));
  }

  function patchMetadata(key: string, value: unknown) {
    setDraft((current) => ({ ...current, metadata: { ...current.metadata, [key]: value } }));
  }

  function addStep() {
    const candidate = selectableEvents.find((item) => !draft.script_steps?.some((step) => step.event_id === item.id));
    if (!candidate?.id) return;
    patch({ script_steps: [...(draft.script_steps ?? []), { event_id: candidate.id, delay_ms: 350 }] });
  }

  function updateStep(index: number, patchValue: Partial<{ event_id: number; delay_ms: number }>) {
    patch({ script_steps: (draft.script_steps ?? []).map((step, position) => position === index ? { ...step, ...patchValue } : step) });
  }

  function removeStep(index: number) {
    patch({ script_steps: (draft.script_steps ?? []).filter((_, position) => position !== index) });
  }

  function submit() {
    setSubmitted(true);
    if (!draft.name.trim() || (!isScript && !draft.target.trim()) || commandList.length === 0) return;
    if (isScript && !(draft.script_steps?.length)) return;
    const actionType = resolveActionType(draft.category, draft.target);
    onSave({
      ...draft,
      category: draft.category,
      action_type: actionType,
      name: draft.name.trim(),
      description: draft.description.trim(),
      folder: draft.folder.trim(),
      target: draft.target.trim(),
      commands: [...new Set(commandList)],
      metadata: Object.fromEntries(Object.entries(draft.metadata).filter(([, value]) => value !== "" && value != null)),
      script_steps: actionType === "script"
        ? (draft.script_steps ?? []).map((step, position) => ({ ...step, position, delay_ms: Math.max(0, Number(step.delay_ms) || 0) }))
        : [],
    });
  }

  async function pickTargetFile() {
    setPickerError("");
    try {
      const selected = await openFileDialog({
        title: `Seleccionar archivo para ${draft.category}`,
        multiple: false,
        directory: false,
        defaultPath: draft.target || undefined,
        ...(editorConfig.filters?.length ? { filters: editorConfig.filters } : {}),
      });
      if (typeof selected === "string") {
        patch({ target: selected, action_type: "path" });
      }
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : "No se pudo abrir el selector de archivos.");
    }
  }

  function handleIconImage(eventFile: ChangeEvent<HTMLInputElement>) {
    const file = eventFile.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      patchMetadata("imageIcon", String(reader.result ?? ""));
      patch({ icon: `image:${file.name}` });
    };
    reader.readAsDataURL(file);
  }

  function resetIconImage() {
    const next = { ...draft.metadata };
    delete next.imageIcon;
    setDraft((current) => ({ ...current, icon: current.icon.startsWith("neon:") ? current.icon : "neon:118_lightning_bolt.png", metadata: next }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function selectNeonIcon(filename: string) {
    const metadata = { ...draft.metadata };
    delete metadata.imageIcon;
    setDraft((current) => ({ ...current, icon: `neon:${filename}`, metadata }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIconPickerOpen(false);
    setIconQuery("");
  }

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      title={`${event ? "Editar" : "Crear"} evento · ${displayCategory(draft.category)}`}
      description={editorConfig.description}
      size="large"
      className="event-editor-dialog"
      contentClassName="event-editor-dialog__content"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" loading={saving} onClick={submit}>{event ? "Guardar" : "Crear"}</Button></>}
    >
      <div className={`event-editor event-editor--mockup event-editor--${draft.category.toLocaleLowerCase("es").replaceAll(" ", "-")}`}>
        <aside className="event-editor__showcase">
          <motion.div className="event-editor__mascot-card" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.32 }}>
            <span className="event-editor__starfield" aria-hidden="true" />
            <motion.img
              src={`/mascot/${editorConfig.mascot}`}
              alt={`Bolty en ${displayCategory(draft.category)}`}
              animate={{ y: [0, -8, 0], rotate: [-1, 1, -1] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="event-editor__helper-chip"><img src="/icons/bolty-icon.png" alt="" /> Bolty te ayuda <Icon name="spark" size={13} /></span>
          </motion.div>
          <section className="event-editor__live-preview" aria-label="Vista previa del evento">
            <span className="event-editor__preview-title">Vista previa</span>
            <div className="event-editor__preview-card">
              <EventVisual event={draft} size="md" />
              <span><strong>{draft.name || "Nuevo evento"}</strong><small>{displayCategory(draft.category)}{draft.folder ? ` · ${draft.folder}` : ""}</small></span>
              <Icon name="chevron" size={16} />
            </div>
          </section>
        </aside>
        <div className="event-editor__form">
          <div className="editor-hero-preview editor-hero-preview--premium">
            <div className="editor-hero-preview__visual"><EventVisual event={draft} size="lg" /></div>
            <div className="editor-hero-preview__copy">
              <strong>{draft.name || "Nuevo evento"}</strong>
              <small><span className="editor-category-pill">{displayCategory(draft.category)}</span>{draft.folder ? ` ${draft.folder}` : ""}</small>
            </div>
          </div>

          <div className="form-grid form-grid--event-basics">
            <TextField label="Nombre" value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder={draft.category === "Películas y Series" ? "Ej. Mi película favorita" : draft.category === "Música" ? "Ej. Mi playlist favorita" : "Ej. Mi acceso favorito"} error={errors.name} autoFocus />
            <Select label="Subcategoría" value={draft.folder} onChange={(e) => patch({ folder: e.target.value })}>
              <option value="">Sin subcategoría</option>
              {currentFolders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
            </Select>
          </div>

          <section className="icon-picker-panel icon-picker-panel--neon icon-picker-panel--premium" aria-label="Personalización del icono">
            <div className="icon-picker-panel__header"><div><strong>Icono Blue Neon</strong></div></div>
            <div className="event-icon-choice">
              <div className="event-icon-choice__preview"><EventVisual event={draft} size="lg" /></div>
              <div className="event-icon-choice__actions">
                <Button type="button" variant="secondary" icon="apps" onClick={() => setIconPickerOpen(true)}>Elegir icono</Button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple={false} onChange={handleIconImage} />
                <Button type="button" variant="ghost" icon="image" onClick={() => fileInputRef.current?.click()}>Imagen personalizada</Button>
                {imageIcon && <Button type="button" variant="ghost" onClick={resetIconImage}>Quitar imagen</Button>}
              </div>
            </div>
          </section>

          {!isScript && usesFilePicker && (
            <div className="field route-picker">
              <span className="field__label">{editorConfig.targetLabel ?? "Ruta"}</span>
              <span className={`field__control ${errors.target || pickerError ? "field__control--error" : ""}`}>
                <input
                  value={draft.target}
                  placeholder={editorConfig.targetPlaceholder}
                  readOnly
                  aria-label={editorConfig.targetLabel ?? "Ruta"}
                  aria-invalid={Boolean(errors.target || pickerError)}
                  onClick={() => void pickTargetFile()}
                />
                <IconButton type="button" icon="file" label="Seleccionar un archivo" variant="surface" className="route-picker__button" onClick={() => void pickTargetFile()} />
              </span>
              {(errors.target || pickerError) && <span className="field__message field__message--error">{errors.target || pickerError}</span>}
            </div>
          )}

          {!isScript && !usesFilePicker && (
            <TextField
              label={editorConfig.targetLabel ?? "Destino"}
              value={draft.target}
              onChange={(e) => patch({ target: e.target.value, action_type: resolveActionType(draft.category, e.target.value) })}
              placeholder={editorConfig.targetPlaceholder}
              error={errors.target}
            />
          )}

          {isScript && (
            <section className="script-builder" aria-label="Pasos del guion">
              <header><div><strong>Secuencia</strong><small>Elige el orden de ejecución.</small></div><Button type="button" variant="secondary" icon="plus" onClick={addStep} disabled={!selectableEvents.length}>Añadir paso</Button></header>
              {(draft.script_steps ?? []).map((step, index) => (
                <div className="script-step" key={`${step.event_id}-${index}`}>
                  <span className="script-step__number">{index + 1}</span>
                  <Select label="Evento" value={String(step.event_id)} onChange={(e) => updateStep(index, { event_id: Number(e.target.value) })}>
                    {selectableEvents.map((item) => <option key={item.id} value={String(item.id)}>{item.name} · {item.category}</option>)}
                  </Select>
                  <TextField type="number" min={0} max={30000} step={50} label="Espera (ms)" value={step.delay_ms} onChange={(e) => updateStep(index, { delay_ms: Number(e.target.value) })} />
                  <IconButton type="button" icon="trash" label={`Eliminar paso ${index + 1}`} variant="danger" onClick={() => removeStep(index)} />
                </div>
              ))}
              {!(draft.script_steps?.length) && <p className={`script-builder__empty ${errors.steps ? "is-error" : ""}`}>{errors.steps || "Añade eventos existentes para crear una automatización encadenada."}</p>}
            </section>
          )}

          <TextField label="Descripción" value={draft.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Describe el evento (opcional)" />
          <label className="field">
            <span className="field__label">Comandos</span>
            <textarea value={commands} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCommands(e.target.value)} placeholder={"abre mis dibujos\ninicia mi playlist"} aria-invalid={Boolean(errors.commands)} />
            <span className={`field__message ${errors.commands ? "field__message--error" : ""}`}>{errors.commands || "Uno por línea."}</span>
          </label>
        </div>
      </div>
    </Dialog>
    <Dialog
        open={iconPickerOpen}
        onClose={() => { setIconPickerOpen(false); setIconQuery(""); }}
        title="Iconos Blue Neon"
        description="Selecciona un icono para el evento."
        size="large"
      >
        <div className="neon-icon-picker">
          <SearchField value={iconQuery} onChange={(event) => setIconQuery(event.target.value)} placeholder="Buscar icono…" autoFocus />
          <div className="neon-icon-grid" role="list" aria-label="Pack de 120 iconos Blue Neon">
            {filteredNeonIcons.map((item) => (
              <button
                key={item.filename}
                type="button"
                className={selectedNeonIcon === item.filename ? "is-selected" : ""}
                onClick={() => selectNeonIcon(item.filename)}
                title={item.label}
                role="listitem"
              >
                <img src={`/neon-icons/${item.filename}`} alt="" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Dialog>
    </>
  );
}
