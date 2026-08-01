import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import type { BoltyEvent, PageId } from "../types/domain";
import { Icon, type IconName } from "../components/Icon";
import { Button, ContextMenu, MenuItem, SearchField, Select } from "../components/Primitives";
import { Dialog } from "../components/Feedback";
import { EventVisual } from "../components/Events";

const slideBlueprints: Array<{ page: PageId; category?: string; title: string; subtitle: string; icon: IconName; mascot: string; accent: string }> = [
  { page: "applications", category: "Aplicaciones", title: "Centro de Control Cósmico", subtitle: "Accede a tus aplicaciones, herramientas y eventos anclados desde un inicio más limpio.", icon: "apps", mascot: "02_bolty_principal.png", accent: "from-control" },
  { page: "applications", category: "Aplicaciones", title: "Tus apps como un Launchpad", subtitle: "Accede a programas, juegos y herramientas con iconos grandes y una cuadrícula más visual.", icon: "apps", mascot: "03_bolty_aplicaciones.png", accent: "from-apps" },
  { page: "web", category: "Páginas Webs", title: "Tus webs favoritas en un clic", subtitle: "Guarda enlaces, recursos y páginas útiles como si fueran apps dentro de tu biblioteca.", icon: "globe", mascot: "04_bolty_paginas_web.png", accent: "from-apps" },
  { page: "media", category: "Películas y Series", title: "Disfruta de tus películas y series", subtitle: "Explora tu catálogo con una presentación más parecida a Netflix o Disney+.", icon: "play", mascot: "05_bolty_peliculas_series.png", accent: "from-media" },
  { page: "music", category: "Música", title: "Tu música siempre a mano", subtitle: "Organiza playlists, reproductores y accesos musicales de forma rápida y divertida.", icon: "music", mascot: "06_bolty_musica.png", accent: "from-music" },
  { page: "documents", category: "Documentos", title: "Documentos listos para despegar", subtitle: "Agrupa archivos de estudio, trabajo o uso diario y ábrelos sin perder tiempo.", icon: "file", mascot: "07_bolty_documentos.png", accent: "from-control" },
  { page: "images", category: "Imágenes", title: "Galería visual mejor organizada", subtitle: "Reúne imágenes y recursos con subcategorías para tenerlo todo bien ordenado.", icon: "image", mascot: "08_bolty_imagenes.png", accent: "from-control" },
  { page: "tasks", category: "Tareas", title: "Atajos del sistema más limpios", subtitle: "Tus tareas internas quedan más claras, rápidas y con menos información en pantalla.", icon: "bolt", mascot: "10_bolty_tareas.png", accent: "from-media" },
  { page: "scripts", category: "Guiones", title: "Automatiza con guiones encadenados", subtitle: "Combina acciones y crea flujos completos para que Bolty haga varias cosas por ti.", icon: "link", mascot: "12_bolty_guiones.png", accent: "from-music" },
];

function statLabelFor(category?: string) {
  if (!category) return "eventos";
  if (category === "Películas y Series") return "títulos";
  if (category === "Páginas Webs") return "webs";
  if (category === "Aplicaciones") return "apps";
  return "eventos";
}

export function DashboardPage({ counts, pinnedEvents, onNavigate, onCreate, onExecute, onLoadEvents, onPin, onUnpin, onOpenSettings }: {
  counts: Record<string, number>;
  pinnedEvents: BoltyEvent[];
  onNavigate: (page: PageId) => void;
  onCreate: () => void;
  onExecute: (event: BoltyEvent) => void;
  onLoadEvents: () => Promise<BoltyEvent[]>;
  onPin: (event: BoltyEvent) => Promise<void>;
  onUnpin: (event: BoltyEvent) => Promise<void>;
  onOpenSettings: () => void;
}) {
  const [active, setActive] = useState(0);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [catalog, setCatalog] = useState<BoltyEvent[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [pinningId, setPinningId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const totalEvents = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const slides = useMemo(() => slideBlueprints.map((slide) => ({
    ...slide,
    count: slide.category ? (counts[slide.category] ?? 0) : totalEvents,
    statLabel: statLabelFor(slide.category),
  })), [counts, totalEvents]);

  useEffect(() => {
    const timer = window.setTimeout(() => setActive((current) => (current + 1) % slides.length), 4200);
    return () => window.clearTimeout(timer);
  }, [active, slides.length]);

  const categories = useMemo(() => [...new Set(catalog.map((event) => event.category))].sort((a, b) => a.localeCompare(b, "es")), [catalog]);
  const pinnedIds = useMemo(() => new Set(pinnedEvents.map((event) => event.id)), [pinnedEvents]);
  const filteredCatalog = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return catalog.filter((event) => {
      const matchesCategory = category === "Todas" || event.category === category;
      const matchesQuery = !needle || `${event.name} ${event.category} ${event.folder}`.toLocaleLowerCase().includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [catalog, category, query]);

  const currentSlide = slides[active] ?? slides[0];

  async function openPinDialog() {
    setPinDialogOpen(true);
    setCatalogLoading(true);
    setCatalogError("");
    setQuery("");
    setCategory("Todas");
    try {
      setCatalog(await onLoadEvents());
    } catch (error) {
      setCatalog([]);
      setCatalogError(error instanceof Error ? error.message : "No se pudo cargar el catálogo.");
    } finally {
      setCatalogLoading(false);
    }
  }

  async function pinEvent(event: BoltyEvent) {
    if (!event.id || pinnedIds.has(event.id)) return;
    setPinningId(event.id);
    try {
      await onPin(event);
    } finally {
      setPinningId(null);
    }
  }

  return (
    <div className="page dashboard-page dashboard-page--carousel">
      <section className="hero-carousel">
        <motion.article
          key={`${currentSlide.page}-${active}`}
          className={`hero-carousel__slide ${currentSlide.accent}`}
          initial={{ opacity: 0, scale: 0.985, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="hero-carousel__copy">
            <span className="eyebrow"><Icon name={currentSlide.icon} size={16} /> Bolty te acompaña</span>
            <h1>{currentSlide.title}</h1>
            <p>{currentSlide.subtitle}</p>
            <div className="hero-carousel__actions">
              <Button icon={currentSlide.icon} onClick={() => onNavigate(currentSlide.page)}>Abrir sección</Button>
              <Button icon="plus" variant="secondary" onClick={onCreate}>Crear evento</Button>
            </div>
            <div className="hero-carousel__stats">
              <span><strong>{currentSlide.count}</strong> {currentSlide.statLabel}</span>
              <span><strong>{totalEvents}</strong> en total</span>
              <span><strong>{pinnedEvents.length}</strong> anclados</span>
            </div>
          </div>
          <div className="hero-carousel__visual">
            <motion.div className="hero-carousel__energy" aria-hidden="true" animate={{ rotate: 360 }} transition={{ duration: 16, repeat: Infinity, ease: "linear" }} />
            <motion.img
              key={currentSlide.mascot}
              src={`/mascot/${currentSlide.mascot}`}
              alt="Bolty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: [1, 1.028, 1], y: [0, -10, 0], rotate: [-1.5, 1.5, -1.5] }}
              transition={{ opacity: { duration: 0.28 }, scale: { duration: 3.2, repeat: Infinity, ease: "easeInOut" }, y: { duration: 3.2, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } }}
            />
          </div>
        </motion.article>
        <div className="hero-carousel__dots" aria-label="Promociones de funciones">
          {slides.map((slide, index) => (
            <button key={`${slide.page}-${slide.title}`} type="button" className={index === active ? "is-active" : ""} onClick={() => setActive(index)} aria-label={`Mostrar ${slide.title}`} />
          ))}
        </div>
      </section>

      <section className="home-dock-zone" aria-label="Accesos de Inicio">
        <div className="recent-dock pinned-dock" aria-label="Eventos anclados a Inicio">
          <div className="recent-dock__shell">
            <div className="recent-dock__rail" role="list">
              {pinnedEvents.map((event, index) => (
                <ContextMenu
                  key={event.id}
                  openOnContextMenu
                  openOnClick={false}
                  className="pinned-dock__context"
                  trigger={
                    <motion.button
                      type="button"
                      className="recent-dock__item"
                      role="listitem"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.02, duration: 0.2 }}
                      whileHover={{ scale: 1.18, y: -11 }}
                      whileFocus={{ scale: 1.18, y: -11 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onExecute(event)}
                      aria-label={event.name}
                    >
                      <span className="recent-dock__tooltip" aria-hidden="true">{event.name}</span>
                      <EventVisual event={event} size="md" />
                    </motion.button>
                  }
                >
                  <MenuItem icon="bolt" onClick={() => onExecute(event)}>Ejecutar</MenuItem>
                  <MenuItem icon="x" danger onClick={() => void onUnpin(event)}>Desanclar de Inicio</MenuItem>
                </ContextMenu>
              ))}
              <motion.button
                type="button"
                className="recent-dock__item pinned-dock__add"
                whileHover={{ scale: 1.18, y: -11 }}
                whileFocus={{ scale: 1.18, y: -11 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => void openPinDialog()}
                aria-label="Anclar evento a Inicio"
              >
                <span className="recent-dock__tooltip" aria-hidden="true">Anclar evento</span>
                <span className="pinned-dock__add-icon"><Icon name="plus" size={26} /></span>
              </motion.button>
            </div>
          </div>
        </div>
        <motion.button
          type="button"
          className="home-settings-button"
          whileHover={{ scale: 1.08, rotate: 8 }}
          whileTap={{ scale: 0.96 }}
          onClick={onOpenSettings}
          aria-label="Abrir opciones"
        >
          <Icon name="settings" size={25} />
        </motion.button>
      </section>

      <Dialog
        open={pinDialogOpen}
        onClose={() => setPinDialogOpen(false)}
        title="Anclar a Inicio"
        description="Busca un evento por nombre o categoría."
        size="medium"
        footer={<Button variant="ghost" onClick={() => setPinDialogOpen(false)}>Cerrar</Button>}
      >
        <div className="pin-event-dialog">
          <div className="pin-event-dialog__filters">
            <SearchField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar evento…" autoFocus />
            <Select aria-label="Filtrar por categoría" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option>Todas</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </Select>
          </div>
          <div className="pin-event-dialog__results">
            {catalogLoading ? (
              <div className="pin-event-dialog__status">Cargando eventos…</div>
            ) : catalogError ? (
              <div className="pin-event-dialog__status">{catalogError}</div>
            ) : filteredCatalog.length === 0 ? (
              <div className="pin-event-dialog__status">No se encontraron eventos.</div>
            ) : filteredCatalog.map((event) => {
              const isPinned = event.id != null && pinnedIds.has(event.id);
              return (
                <button
                  key={event.id}
                  type="button"
                  className={`pin-event-result ${isPinned ? "is-pinned" : ""}`}
                  disabled={isPinned || pinningId === event.id}
                  onClick={() => void pinEvent(event)}
                >
                  <EventVisual event={event} size="sm" />
                  <span className="pin-event-result__copy">
                    <strong>{event.name}</strong>
                    <small>{event.category}{event.folder ? ` · ${event.folder}` : ""}</small>
                  </span>
                  <span className="pin-event-result__action">{isPinned ? "Anclado" : pinningId === event.id ? "Anclando…" : "Anclar"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
