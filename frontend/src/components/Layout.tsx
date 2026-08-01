import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { AssistantState, PageId } from "../types/domain";
import { BoltyAssistant, CosmicBackdrop } from "./Cosmic";
import { Icon, type IconName } from "./Icon";
import { Button, IconButton, SearchField, Tooltip } from "./Primitives";


const sidebarMissions = [
  { title: "Misión estelar", subtitle: "Bolty está listo", image: "02_bolty_principal.png" },
  { title: "Radar de eventos", subtitle: "Tus accesos en órbita", image: "17_bolty_buscando.png" },
  { title: "Control por voz", subtitle: "Bolty puede escucharte", image: "32_bolty_comandos_voz_microfono.png" },
  { title: "Centro de opciones", subtitle: "Personaliza tu experiencia", image: "13_bolty_opciones.png" },
  { title: "Automatización activa", subtitle: "Una orden, varias acciones", image: "31_bolty_guion_ejecutandose.png" },
];

const missionIndexByPage: Partial<Record<PageId, number>> = {
  home: 0,
  applications: 1,
  web: 1,
  media: 1,
  music: 1,
  documents: 1,
  images: 1,
  other: 1,
  tasks: 4,
  scripts: 4,
  help: 2,
  about: 0,
};

export interface NavigationEntry {
  id: PageId;
  label: string;
  icon: IconName;
  group?: "main" | "library" | "support";
  badge?: number;
}

export function TitleBar({ runInBackground }: { runInBackground: boolean }) {
  const [maximized, setMaximized] = useState(false);

  async function withWindow(action: "minimize" | "toggleMaximize" | "close") {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const current = getCurrentWindow();
    if (action === "minimize") await current.minimize();
    if (action === "close") {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("close_window", { runInBackground });
    }
    if (action === "toggleMaximize") {
      await current.toggleMaximize();
      setMaximized(await current.isMaximized());
    }
  }

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar__brand" data-tauri-drag-region>
        <img src="/icons/bolty-icon.png" alt="" />
        <span data-tauri-drag-region><strong>Bolty Switch</strong><small>Automatización mediante eventos</small></span>
      </div>
      <div className="titlebar__status" data-tauri-drag-region><i /> Sistema conectado</div>
      <div className="titlebar__controls">
        <IconButton icon="minus" label="Minimizar" onClick={() => void withWindow("minimize")} />
        <IconButton icon="maximize" label={maximized ? "Restaurar" : "Maximizar"} onClick={() => void withWindow("toggleMaximize")} />
        <IconButton icon="x" label="Cerrar" variant="danger" onClick={() => void withWindow("close")} />
      </div>
    </header>
  );
}

export function NavigationItem({ item, active, collapsed, onSelect }: { item: NavigationEntry; active: boolean; collapsed: boolean; onSelect: () => void }) {
  const content = (
    <motion.button className={`navigation-item ${active ? "is-active" : ""}`} onClick={onSelect} aria-current={active ? "page" : undefined} whileTap={{ scale: 0.98 }}>
      <span className="navigation-item__icon"><Icon name={item.icon} size={19} /></span>
      {!collapsed && <span className="navigation-item__label">{item.label}</span>}
      {!collapsed && typeof item.badge === "number" && <span className="navigation-item__badge">{item.badge}</span>}
      {active && <motion.i layoutId="sidebar-active" className="navigation-item__active" />}
    </motion.button>
  );
  return collapsed ? <Tooltip label={item.label}>{content}</Tooltip> : content;
}

export function Sidebar({ items, active, onNavigate, collapsed }: { items: NavigationEntry[]; active: PageId; onNavigate: (page: PageId) => void; collapsed: boolean }) {
  const [missionIndex, setMissionIndex] = useState(missionIndexByPage[active] ?? 0);

  useEffect(() => {
    setMissionIndex(missionIndexByPage[active] ?? 0);
  }, [active]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMissionIndex((current) => (current + 1) % sidebarMissions.length);
    }, 4800);
    return () => window.clearInterval(timer);
  }, []);

  const mission = sidebarMissions[missionIndex] ?? sidebarMissions[0];

  const groups = useMemo(() => ({
    main: items.filter((item) => (item.group ?? "main") === "main"),
    library: items.filter((item) => item.group === "library"),
    support: items.filter((item) => item.group === "support"),
  }), [items]);

  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="sidebar__top">
        <nav aria-label="Navegación principal">
          {groups.main.map((item) => <NavigationItem key={item.id} item={item} active={active === item.id} collapsed={collapsed} onSelect={() => onNavigate(item.id)} />)}
          <span className="sidebar__section">{collapsed ? "" : "Categorías"}</span>
          {groups.library.map((item) => <NavigationItem key={item.id} item={item} active={active === item.id} collapsed={collapsed} onSelect={() => onNavigate(item.id)} />)}
        </nav>
      </div>
      <div className="sidebar__footer">
        {groups.support.map((item) => <NavigationItem key={item.id} item={item} active={active === item.id} collapsed={collapsed} onSelect={() => onNavigate(item.id)} />)}
        <div className="sidebar__mission" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${mission.title}-${missionIndex}`}
              className="sidebar__mission-content"
              initial={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.98, filter: "blur(5px)" }}
              transition={{ duration: 0.28 }}
            >
              <img src={`/mascot/${mission.image}`} alt="" />
              {!collapsed && <span><strong>{mission.title}</strong><small>{mission.subtitle}</small></span>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}

export function CommandDock({ value, onChange, onExecute, suggestions, onSuggestion, state, busy, onVoice }: {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  suggestions: string[];
  onSuggestion: (value: string) => void;
  state: AssistantState;
  busy: boolean;
  onVoice: () => void;
}) {
  return (
    <section className="command-dock" aria-label="Comandos de Bolty">
      <BoltyAssistant state={state} label={state === "wake" ? "Te escucho, dime tu orden…" : state === "listening" ? "Esperando la palabra de activación…" : state === "executing" ? "Ejecutando misión…" : "¿Qué hacemos ahora?"} compact />
      <SearchField
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && onExecute()}
        placeholder="Dile a Bolty qué quieres hacer…"
        suggestions={suggestions}
        onSuggestion={onSuggestion}
        suggestionsPosition="top"
      />
      <IconButton icon="mic" label="Escuchar comando de voz" variant={state === "listening" ? "surface" : "ghost"} onClick={onVoice} />
      <Button icon="bolt" loading={busy} onClick={onExecute}>Ejecutar</Button>
    </section>
  );
}

export function AppShell({ items, active, onNavigate, pageKey, children, commandDock, runInBackground, sidebarCollapsed }: {
  items: NavigationEntry[];
  active: PageId;
  onNavigate: (page: PageId) => void;
  pageKey: string;
  children: ReactNode;
  commandDock?: ReactNode;
  runInBackground: boolean;
  sidebarCollapsed: boolean;
}) {
  const hasCommandDock = Boolean(commandDock);
  return (
    <div className="app-shell">
      <CosmicBackdrop />
      <TitleBar runInBackground={runInBackground} />
      <div className="app-shell__body">
        <Sidebar items={items} active={active} onNavigate={onNavigate} collapsed={sidebarCollapsed} />
        <main className={`app-content ${hasCommandDock ? "app-content--with-dock" : "app-content--plain"}`} id="main-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={pageKey} className="page-transition" initial={{ opacity: 0, scale: 0.992, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 0.996, filter: "blur(8px)" }} transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}>
              {children}
            </motion.div>
          </AnimatePresence>
          {commandDock}
        </main>
      </div>
    </div>
  );
}
