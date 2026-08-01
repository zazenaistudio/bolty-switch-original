import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import type { BoltyEvent, PageId } from "../types/domain";
import { Dialog, EmptyState, LoadingState } from "../components/Feedback";
import { EventCard, EventDetail, LaunchpadEventCard, PosterEventCard, LandscapeEventCard, getEventArtwork } from "../components/Events";
import { Button, IconButton, SearchField, TextField } from "../components/Primitives";
import { Icon, type IconName } from "../components/Icon";

const mascotByCategory: Record<string, string> = {
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

const categoryPageMap: Record<string, PageId> = {
  Aplicaciones: "applications",
  "Páginas Webs": "web",
  "Películas y Series": "media",
  Música: "music",
  Documentos: "documents",
  Imágenes: "images",
  Otros: "other",
  Tareas: "tasks",
  Guiones: "scripts",
};

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

const categoryLabel: Record<string, string> = {
  "Películas y Series": "Películas",
  "Páginas Webs": "Páginas web",
};

const categoryInsightCopy: Record<string, string> = {
  Aplicaciones: "Tus programas, juegos y herramientas en una sola órbita.",
  "Páginas Webs": "Tus destinos digitales favoritos organizados por Bolty.",
  "Películas y Series": "Tu colección audiovisual, géneros y accesos directos.",
  Música: "Canciones, playlists y ambientes siempre a mano.",
  Documentos: "Todo lo que Bolty sabe sobre esta categoría.",
  Imágenes: "Galerías, diseños y referencias visuales organizadas.",
  Otros: "Accesos especiales que no necesitan una órbita convencional.",
  Tareas: "Automatizaciones y controles de Windows listos para ejecutarse.",
  Guiones: "Secuencias de eventos para automatizar misiones completas.",
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

function labelForCategory(category: string) {
  return categoryLabel[category] ?? category;
}

function mergeSubcategories(base: string[], defaults: string[]) {
  const unique = new Map<string, string>();
  for (const raw of [...defaults, ...base]) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase("es");
    if (!unique.has(key)) unique.set(key, value);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, "es"));
}

function shuffleEvents(events: BoltyEvent[]) {
  const shuffled = [...events];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

type SortMode = "name" | "recent";
type ViewMode = "launchpad" | "stream" | "cards";

function pageSizeFor(viewMode: ViewMode) {
  return viewMode === "stream" ? 12 : 12;
}

function getDefaultView(category?: string): ViewMode {
  if (!category) return "cards";
  if (category === "Aplicaciones" || category === "Páginas Webs") return "launchpad";
  return "stream";
}

function getPageSequence(totalPages: number, currentPage: number): Array<number | string> {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const sequence: Array<number | string> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) sequence.push("start-ellipsis");
  for (let page = start; page <= end; page += 1) sequence.push(page);
  if (end < totalPages - 1) sequence.push("end-ellipsis");
  sequence.push(totalPages);
  return sequence;
}

function StreamingCollection({ collection, category, selected, onSelect, onExecute, onEdit, onDelete }: {
  collection: BoltyEvent[];
  category?: string;
  selected: BoltyEvent | null;
  onSelect: (event: BoltyEvent | null) => void;
  onExecute: (event: BoltyEvent) => void;
  onEdit: (event: BoltyEvent) => void;
  onDelete: (event: BoltyEvent) => void;
}) {
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const collectionKey = useMemo(() => collection.map((event) => event.id ?? `${event.category}:${event.name}`).join("|"), [collection]);
  const recommendations = useMemo(() => shuffleEvents(collection).slice(0, Math.min(6, collection.length)), [collectionKey]);
  const featured = recommendations[featuredIndex] ?? recommendations[0];

  useEffect(() => {
    setFeaturedIndex(0);
    setDirection(1);
  }, [collectionKey]);

  useEffect(() => {
    if (recommendations.length < 2) return;
    const timer = window.setTimeout(() => {
      setDirection(1);
      setFeaturedIndex((current) => (current + 1) % recommendations.length);
    }, 4800);
    return () => window.clearTimeout(timer);
  }, [featuredIndex, recommendations.length]);

  function move(delta: number) {
    if (recommendations.length < 2) return;
    setDirection(delta > 0 ? 1 : -1);
    setFeaturedIndex((current) => (current + delta + recommendations.length) % recommendations.length);
  }

  function onDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (Math.abs(info.offset.x) < 55 && Math.abs(info.velocity.x) < 450) return;
    move(info.offset.x < 0 ? 1 : -1);
  }

  if (!featured) return null;
  const featuredArtwork = getEventArtwork(featured);
  const featuredLabel = featured.folder || labelForCategory(featured.category);
  const posterRail = collection.slice(0, Math.min(6, collection.length));
  const landscapeRail = collection.slice(6, 12);

  return (
    <div className="stream-hub">
      <section className="stream-swipe" aria-label="Recomendaciones aleatorias">
        <AnimatePresence initial={false} custom={direction} mode="sync">
          <motion.article
            key={featured.id ?? `${featured.name}-${featuredIndex}`}
            custom={direction}
            className="stream-hero stream-hero--swipe"
            initial={{ opacity: 0, x: direction > 0 ? 90 : -90, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction > 0 ? -90 : 90, scale: 0.99 }}
            transition={{ duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }}
            drag={recommendations.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={onDragEnd}
            style={{ backgroundImage: `linear-gradient(90deg, rgba(4, 8, 20, 0.96) 0%, rgba(4, 8, 20, 0.72) 40%, rgba(4, 8, 20, 0.24) 76%, rgba(4, 8, 20, 0.08) 100%), url("${featuredArtwork}")` }}
          >
            <div className="stream-hero__copy">
              <span className="eyebrow"><Icon name={categoryIcon[featured.category] ?? "spark"} size={16} /> {featuredLabel}</span>
              <h2>{featured.name}</h2>
              {featured.description && <p>{featured.description}</p>}
              <div className="stream-hero__actions">
                <Button icon="bolt" onClick={() => onExecute(featured)}>Abrir</Button>
                <Button variant="secondary" icon="edit" onClick={() => onEdit(featured)}>Editar</Button>
              </div>
            </div>
          </motion.article>
        </AnimatePresence>

        {recommendations.length > 1 && (
          <>
            <button type="button" className="stream-swipe__arrow stream-swipe__arrow--previous" onClick={() => move(-1)} aria-label="Recomendación anterior"><Icon name="chevron" size={22} /></button>
            <button type="button" className="stream-swipe__arrow stream-swipe__arrow--next" onClick={() => move(1)} aria-label="Siguiente recomendación"><Icon name="chevron" size={22} /></button>
            <div className="stream-swipe__dots">
              {recommendations.map((event, index) => (
                <button key={event.id ?? event.name} type="button" className={index === featuredIndex ? "is-active" : ""} onClick={() => { setDirection(index > featuredIndex ? 1 : -1); setFeaturedIndex(index); }} aria-label={`Mostrar ${event.name}`} />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="stream-section">
        <header className="stream-section__header"><h3>Todos los eventos</h3></header>
        <div className="media-poster-row">
          <AnimatePresence initial={false}>
            {posterRail.map((event) => (
              <PosterEventCard key={event.id} event={event} selected={selected?.id === event.id} onSelect={() => onSelect(event)} onExecute={() => onExecute(event)} onEdit={() => onEdit(event)} onDelete={() => onDelete(event)} />
            ))}
          </AnimatePresence>
        </div>
      </section>

      {landscapeRail.length > 0 && (
        <section className="stream-section">
          <header className="stream-section__header"><h3>{category === "Películas y Series" ? "Más de tu colección" : "Más accesos"}</h3></header>
          <div className="media-landscape-row">
            <AnimatePresence initial={false}>
              {landscapeRail.map((event) => (
                <LandscapeEventCard key={event.id} event={event} selected={selected?.id === event.id} onSelect={() => onSelect(event)} onExecute={() => onExecute(event)} onEdit={() => onEdit(event)} onDelete={() => onDelete(event)} />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  );
}

function CategoryToolsFab({ open, onToggle, onCreate, onSearch, onNewSubcategory, onManageSubcategories, hasSubcategories, viewMode, onViewMode, sortMode, onSortMode, category }: {
  open: boolean;
  onToggle: () => void;
  onCreate: () => void;
  onSearch: () => void;
  onNewSubcategory: () => void;
  onManageSubcategories: () => void;
  hasSubcategories: boolean;
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  sortMode: SortMode;
  onSortMode: (mode: SortMode) => void;
  category: string;
}) {
  const launchpadAvailable = category === "Aplicaciones" || category === "Páginas Webs";
  return (
    <div className="admin-fab">
      <AnimatePresence>
        {open && (
          <motion.div className="admin-fab__menu" initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }}>
            <button type="button" className="admin-fab__action is-primary" onClick={onCreate}><Icon name="plus" size={18} /><span>Añadir evento</span></button>
            <button type="button" className="admin-fab__action" onClick={onSearch}><Icon name="search" size={18} /><span>Buscar</span></button>
            <button type="button" className="admin-fab__action" onClick={onNewSubcategory}><Icon name="file" size={18} /><span>Nueva subcategoría</span></button>
            <button type="button" className="admin-fab__action" onClick={onManageSubcategories} disabled={!hasSubcategories}><Icon name="settings" size={18} /><span>Gestionar subcategorías</span></button>
            <div className="admin-fab__section">
              <small>Vista</small>
              <div className="admin-fab__choices">
                {launchpadAvailable && <button type="button" className={viewMode === "launchpad" ? "is-active" : ""} onClick={() => onViewMode("launchpad")} title="Launchpad"><Icon name="apps" size={17} /></button>}
                <button type="button" className={viewMode === "stream" ? "is-active" : ""} onClick={() => onViewMode("stream")} title="Streaming"><Icon name="play" size={17} /></button>
                <button type="button" className={viewMode === "cards" ? "is-active" : ""} onClick={() => onViewMode("cards")} title="Tarjetas"><Icon name="library" size={17} /></button>
              </div>
            </div>
            <button type="button" className="admin-fab__action" onClick={() => onSortMode(sortMode === "name" ? "recent" : "name")}><Icon name="refresh" size={18} /><span>{sortMode === "name" ? "Orden: nombre" : "Orden: recientes"}</span></button>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button type="button" className="admin-fab__button" onClick={onToggle} aria-expanded={open} aria-label={open ? "Cerrar herramientas" : "Abrir herramientas"} whileTap={{ scale: 0.92 }} animate={{ rotate: open ? 45 : 0 }}>
        <Icon name="plus" size={25} />
      </motion.button>
    </div>
  );
}

export function LibraryPage({ title, description, category, counts, subcategories, allSubcategories, events, loading, query, onQuery, onCreate, onCreateSubcategory, onRenameSubcategory, onDeleteSubcategory, onExecute, onEdit, onDelete, selected, onSelect, onOpenCategory }: {
  title: string;
  description: string;
  category?: string;
  counts: Record<string, number>;
  subcategories: string[];
  allSubcategories: Record<string, string[]>;
  events: BoltyEvent[];
  loading: boolean;
  query: string;
  onQuery: (query: string) => void;
  onCreate: () => void;
  onCreateSubcategory: (name: string) => Promise<void> | void;
  onRenameSubcategory: (oldName: string, newName: string) => Promise<void> | void;
  onDeleteSubcategory: (name: string) => Promise<void> | void;
  onExecute: (event: BoltyEvent) => void;
  onEdit: (event: BoltyEvent) => void;
  onDelete: (event: BoltyEvent) => void;
  selected: BoltyEvent | null;
  onSelect: (event: BoltyEvent | null) => void;
  onOpenCategory: (page: PageId) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [newSubcategoryOpen, setNewSubcategoryOpen] = useState(false);
  const [manageSubcategoriesOpen, setManageSubcategoriesOpen] = useState(false);
  const [subcategoryName, setSubcategoryName] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [editingSubcategory, setEditingSubcategory] = useState("");
  const [editingValue, setEditingValue] = useState("");
  const [pendingSubcategoryDelete, setPendingSubcategoryDelete] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [viewMode, setViewMode] = useState<ViewMode>(getDefaultView(category));
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryDialog, setCategoryDialog] = useState<string>("");

  useEffect(() => {
    setCurrentPage(1);
    setSubcategoryFilter("all");
    setViewMode(getDefaultView(category));
    setFabOpen(false);
  }, [category]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, sortMode, subcategoryFilter, viewMode]);

  const availableSubcategories = useMemo(() => mergeSubcategories(subcategories, defaultSubcategoriesByCategory[category ?? ""] ?? []), [subcategories, category]);

  const sortedEvents = useMemo(() => {
    const filtered = events.filter((event) => subcategoryFilter === "all" || (event.folder || "") === subcategoryFilter);
    const copy = [...filtered];
    if (sortMode === "recent") return copy.sort((a, b) => Date.parse(b.updated_at || b.created_at || "") - Date.parse(a.updated_at || a.created_at || ""));
    return copy.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [events, sortMode, subcategoryFilter]);

  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / pageSizeFor(viewMode)));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSizeFor(viewMode);
  const pageEvents = sortedEvents.slice(pageStart, pageStart + pageSizeFor(viewMode));
  const pageSequence = getPageSequence(totalPages, safeCurrentPage);

  useEffect(() => {
    if (selected && !sortedEvents.some((event) => event.id === selected.id)) onSelect(null);
  }, [selected, sortedEvents, onSelect]);

  async function createSubcategory() {
    const clean = subcategoryName.trim();
    if (!clean) return;
    await onCreateSubcategory(clean);
    setSubcategoryName("");
    setNewSubcategoryOpen(false);
    setSubcategoryFilter(clean);
  }

  async function renameSubcategory() {
    const clean = editingValue.trim();
    if (!editingSubcategory || !clean) return;
    await onRenameSubcategory(editingSubcategory, clean);
    if (subcategoryFilter === editingSubcategory) setSubcategoryFilter(clean);
    setEditingSubcategory("");
    setEditingValue("");
  }

  async function deleteSubcategory() {
    if (!pendingSubcategoryDelete) return;
    await onDeleteSubcategory(pendingSubcategoryDelete);
    if (subcategoryFilter === pendingSubcategoryDelete) setSubcategoryFilter("all");
    setPendingSubcategoryDelete("");
  }

  function renderEventCollection(collection: BoltyEvent[]) {
    if (viewMode === "launchpad") {
      return <motion.div layout className="launchpad-grid"><AnimatePresence initial={false}>{collection.map((event) => <LaunchpadEventCard key={event.id} event={event} selected={selected?.id === event.id} onSelect={() => onSelect(event)} onExecute={() => onExecute(event)} onEdit={() => onEdit(event)} onDelete={() => onDelete(event)} />)}</AnimatePresence></motion.div>;
    }
    if (viewMode === "stream") return <StreamingCollection collection={collection} category={category} selected={selected} onSelect={onSelect} onExecute={onExecute} onEdit={onEdit} onDelete={onDelete} />;
    return <motion.div layout className="event-grid event-grid--library"><AnimatePresence initial={false}>{collection.map((event) => <EventCard key={event.id} event={event} selected={selected?.id === event.id} onSelect={() => onSelect(event)} onExecute={() => onExecute(event)} onEdit={() => onEdit(event)} onDelete={() => onDelete(event)} />)}</AnimatePresence></motion.div>;
  }

  if (loading) return <LoadingState label="Bolty está organizando tu biblioteca…" />;

  if (!category) {
    const insightSubcategories = categoryDialog
      ? mergeSubcategories(allSubcategories[categoryDialog] ?? [], defaultSubcategoriesByCategory[categoryDialog] ?? [])
      : [];

    return (
      <div className="page library-page library-page--kawaii-only">
        <div className="kawaii-library-grid" aria-label="Categorías de la biblioteca">
          {Object.entries(categoryPageMap).map(([name], index) => (
            <motion.button
              key={name}
              type="button"
              className="kawaii-library-card"
              onClick={() => setCategoryDialog(name)}
              initial={{ opacity: 0, scale: 0.92, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ delay: index * 0.045, duration: 0.34 }}
              whileHover={{ y: -7, scale: 1.018 }}
              whileTap={{ scale: 0.985 }}
              aria-label={`Ver información de ${labelForCategory(name)}`}
            >
              <span className="kawaii-library-card__glow" aria-hidden="true" />
              <motion.img
                src={`/mascot/${mascotByCategory[name]}`}
                alt=""
                animate={{ y: [0, -8, 0], rotate: [0, index % 2 === 0 ? 1.5 : -1.5, 0] }}
                transition={{ duration: 4 + (index % 3) * 0.5, repeat: Infinity, ease: "easeInOut", delay: index * 0.12 }}
              />
              <span className="kawaii-library-card__copy">
                <strong>{labelForCategory(name)}</strong>
                <small>{counts[name] ?? 0} eventos</small>
              </span>
              <span className="kawaii-library-card__spark"><Icon name={categoryIcon[name] ?? "spark"} size={18} /></span>
            </motion.button>
          ))}
        </div>

        <Dialog
          open={Boolean(categoryDialog)}
          onClose={() => setCategoryDialog("")}
          title={categoryDialog ? labelForCategory(categoryDialog) : "Categoría"}
          size="large"
          className="category-details-dialog"
          contentClassName="category-details-dialog__content"
          hideHeader
        >
          {categoryDialog && (() => {
            const categoryEvents = events.filter((event) => event.category === categoryDialog);
            const latestEvent = [...categoryEvents].sort((a, b) => Date.parse(b.updated_at || b.created_at || "") - Date.parse(a.updated_at || a.created_at || ""))[0];
            const latestDate = latestEvent?.updated_at || latestEvent?.created_at;
            const formattedDate = latestDate ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(latestDate)) : "Sin actividad todavía";
            const openCategory = () => { const target = categoryPageMap[categoryDialog]; setCategoryDialog(""); onOpenCategory(target); };
            return (
              <div className="category-details">
                <header className="category-details__header">
                  <div className="category-details__heading">
                    <span className="category-details__icon"><Icon name={categoryIcon[categoryDialog] ?? "spark"} size={34} /></span>
                    <span><strong>{labelForCategory(categoryDialog)}</strong><small>{categoryInsightCopy[categoryDialog]}</small><em><img src="/icons/bolty-icon.png" alt="" /> Biblioteca orbital <Icon name="spark" size={12} /></em></span>
                  </div>
                  <IconButton icon="x" label="Cerrar detalles" className="category-details__close" onClick={() => setCategoryDialog("")} />
                </header>

                <div className="category-details__hero-grid">
                  <div className="category-details__stats">
                    <article><span><Icon name="calendar" size={23} /></span><strong>{counts[categoryDialog] ?? 0}</strong><b>eventos</b><small>En esta categoría</small></article>
                    <article><span><Icon name="apps" size={23} /></span><strong>{insightSubcategories.length}</strong><b>subcategorías</b><small>Organizadas y listas</small></article>
                  </div>
                  <motion.div className="category-details__mascot" animate={{ y: [0, -8, 0], rotate: [-1, 1, -1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
                    <i className="category-details__orbit" aria-hidden="true" />
                    <img src={`/mascot/${mascotByCategory[categoryDialog]}`} alt={`Bolty en ${labelForCategory(categoryDialog)}`} />
                    <span className="category-details__floating-file category-details__floating-file--one"><Icon name="file" size={25} /></span>
                    <span className="category-details__floating-file category-details__floating-file--two"><Icon name="folder" size={25} /></span>
                  </motion.div>
                </div>

                <section className="category-details__subcategories">
                  <header><Icon name="apps" size={18} /><strong>Subcategorías</strong></header>
                  <div>{insightSubcategories.map((subcategory, index) => <span key={subcategory}><Icon name={index % 3 === 0 ? "bookmark" : index % 3 === 1 ? "file" : "spark"} size={16} />{subcategory}</span>)}</div>
                </section>

                <div className="category-details__metadata">
                  <span><i><Icon name="clock" size={20} /></i><b>Última actualización</b><strong>{formattedDate}</strong><small>{latestEvent ? latestEvent.name : "Bolty espera tu primer evento"}</small></span>
                  <span><i className="is-success"><Icon name="check" size={20} /></i><b>Estado</b><strong className="is-success-text">Activa</strong><small>Todo funcionando</small></span>
                  <span><i><Icon name="pin" size={20} /></i><b>Elementos disponibles</b><strong>{categoryEvents.length}</strong><small>Listos para ejecutar</small></span>
                </div>

                <footer className="category-details__footer">
                  <Button variant="secondary" icon="settings" onClick={openCategory}>Editar subcategorías</Button>
                  <span><Button variant="ghost" onClick={() => setCategoryDialog("")}>Cerrar</Button><Button icon="folder" onClick={openCategory}>Abrir categoría</Button></span>
                </footer>
              </div>
            );
          })()}
        </Dialog>
      </div>
    );
  }

  return (
    <div className="page library-page library-page--category-clean">
      <nav className="subcategory-switcher" aria-label="Subcategorías">
        <button type="button" className={subcategoryFilter === "all" ? "is-active" : ""} onClick={() => setSubcategoryFilter("all")}>Todas</button>
        {availableSubcategories.map((subcategory) => <button key={subcategory} type="button" className={subcategoryFilter === subcategory ? "is-active" : ""} onClick={() => setSubcategoryFilter(subcategory)}>{subcategory}</button>)}
      </nav>

      {sortedEvents.length === 0 ? (
        <EmptyState image={`/mascot/${mascotByCategory[category] ?? "29_bolty_categoria_vacia.png"}`} title={subcategoryFilter === "all" ? "Esta categoría está vacía" : "Esta subcategoría está vacía"} message="Usa el botón flotante para añadir contenido." />
      ) : (
        <div className={`library-layout ${selected ? "has-detail" : ""}`}>
          <div className="library-results library-results--immersive">
            {renderEventCollection(pageEvents)}
            {totalPages > 1 && (
              <nav className="pagination" aria-label="Paginación de eventos">
                <button type="button" onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} disabled={safeCurrentPage === 1}>Anterior</button>
                <div className="pagination__numbers">{pageSequence.map((item) => typeof item === "number" ? <button key={item} type="button" className={item === safeCurrentPage ? "is-active" : ""} onClick={() => setCurrentPage(item)} aria-current={item === safeCurrentPage ? "page" : undefined}>{item}</button> : <span key={item} aria-hidden="true">…</span>)}</div>
                <button type="button" onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))} disabled={safeCurrentPage === totalPages}>Siguiente</button>
              </nav>
            )}
          </div>
          <AnimatePresence>{selected && <EventDetail event={selected} onClose={() => onSelect(null)} onExecute={() => onExecute(selected)} onEdit={() => onEdit(selected)} />}</AnimatePresence>
        </div>
      )}

      <CategoryToolsFab open={fabOpen} onToggle={() => setFabOpen((value) => !value)} onCreate={() => { setFabOpen(false); onCreate(); }} onSearch={() => { setFabOpen(false); setSearchOpen(true); }} onNewSubcategory={() => { setFabOpen(false); setNewSubcategoryOpen(true); }} onManageSubcategories={() => { setFabOpen(false); setManageSubcategoriesOpen(true); }} hasSubcategories={availableSubcategories.length > 0} viewMode={viewMode} onViewMode={(mode) => { setViewMode(mode); setFabOpen(false); }} sortMode={sortMode} onSortMode={(mode) => { setSortMode(mode); setFabOpen(false); }} category={category} />

      <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} title="Buscar" description="Encuentra eventos por nombre o comando." size="medium" footer={<><Button variant="ghost" onClick={() => { onQuery(""); setSearchOpen(false); }}>Limpiar</Button><Button onClick={() => setSearchOpen(false)}>Cerrar</Button></>}><div className="search-modal"><SearchField value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Buscar…" autoFocus /><div className="search-modal__results">{events.slice(0, 8).map((event) => <button key={event.id} type="button" className="search-result" onClick={() => { onSelect(event); setSearchOpen(false); }}><span className="search-result__icon"><Icon name={categoryIcon[event.category] ?? "spark"} size={16} /></span><span><strong>{event.name}</strong><small>{event.folder || labelForCategory(event.category)}</small></span></button>)}</div></div></Dialog>

      <Dialog open={newSubcategoryOpen} onClose={() => setNewSubcategoryOpen(false)} title="Nueva subcategoría" size="small" footer={<><Button variant="ghost" onClick={() => setNewSubcategoryOpen(false)}>Cancelar</Button><Button icon="plus" onClick={() => void createSubcategory()}>Crear</Button></>}><TextField label="Nombre" value={subcategoryName} onChange={(event) => setSubcategoryName(event.target.value)} placeholder="Ej. Favoritas" autoFocus /></Dialog>

      <Dialog open={manageSubcategoriesOpen} onClose={() => { setManageSubcategoriesOpen(false); setEditingSubcategory(""); }} title="Gestionar subcategorías" size="medium" footer={<Button onClick={() => setManageSubcategoriesOpen(false)}>Cerrar</Button>}>
        <div className="subcategory-manager">
          {availableSubcategories.map((subcategory) => (
            <div className="subcategory-manager__row" key={subcategory}>
              {editingSubcategory === subcategory ? (
                <><TextField value={editingValue} onChange={(event) => setEditingValue(event.target.value)} autoFocus /><div className="subcategory-manager__actions"><IconButton icon="check" label="Guardar nombre" onClick={() => void renameSubcategory()} /><IconButton icon="x" label="Cancelar edición" onClick={() => { setEditingSubcategory(""); setEditingValue(""); }} /></div></>
              ) : (
                <><strong>{subcategory}</strong><div className="subcategory-manager__actions"><IconButton icon="edit" label={`Renombrar ${subcategory}`} onClick={() => { setEditingSubcategory(subcategory); setEditingValue(subcategory); }} /><IconButton icon="trash" label={`Eliminar ${subcategory}`} variant="danger" onClick={() => { setManageSubcategoriesOpen(false); setPendingSubcategoryDelete(subcategory); }} /></div></>
              )}
            </div>
          ))}
        </div>
      </Dialog>

      <Dialog open={Boolean(pendingSubcategoryDelete)} onClose={() => setPendingSubcategoryDelete("")} title="Eliminar subcategoría" description="Los eventos no se eliminarán; volverán a aparecer dentro de Todas." size="small" footer={<><Button variant="ghost" onClick={() => setPendingSubcategoryDelete("")}>Cancelar</Button><Button variant="danger" icon="trash" onClick={() => void deleteSubcategory()}>Eliminar</Button></>}><p>¿Quieres eliminar <strong>«{pendingSubcategoryDelete}»</strong>?</p></Dialog>
    </div>
  );
}
