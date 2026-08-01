import { useMemo, useState } from "react";
import type { SystemStatus } from "../types/domain";
import { Button, Card, ContextMenu, MenuItem } from "../components/Primitives";
import { Dialog, ErrorState, LoadingState, ProgressIndicator } from "../components/Feedback";
import { Icon } from "../components/Icon";

function numericState(value: string): number | null {
  const match = value.match(/^(\d+(?:\.\d+)?)%$/);
  return match ? Number(match[1]) : null;
}

export interface SystemPanelProps {
  statuses: SystemStatus[];
  loading: boolean;
  error?: string;
  onRefresh: () => void;
  onOpen: (uri: string) => void;
}

export function SystemPanel({ statuses, loading, error, onRefresh, onOpen }: SystemPanelProps) {
  const [selectedStatus, setSelectedStatus] = useState<SystemStatus | null>(null);
  const readyStatuses = useMemo(() => statuses.map((status) => ({ ...status, progress: numericState(status.state) })), [statuses]);

  return (
    <>
      <section className="settings-section-heading settings-section-heading--actions">
        <div>
          <h2>Sistema</h2>
          <p>Estado del equipo y accesos rápidos de Windows.</p>
        </div>
        <Button variant="secondary" icon="refresh" onClick={onRefresh}>Actualizar</Button>
      </section>

      {loading ? <LoadingState label="Bolty está analizando el sistema…" /> : error ? <ErrorState message={error} onRetry={onRefresh} /> : (
        <div className="system-grid system-grid--settings">
          {readyStatuses.map((status) => (
            <ContextMenu
              key={status.key}
              openOnContextMenu
              openOnClick={false}
              className="system-context-menu"
              trigger={
                <Card interactive={false} className="system-card system-card--settings" onClick={() => setSelectedStatus(status)}>
                  <header>
                    <span className={`system-card__icon ${status.active === false ? "is-danger" : ""}`}>{status.icon}</span>
                    <span className={`status-dot ${status.active === false ? "is-danger" : status.active === true ? "is-success" : ""}`} />
                  </header>
                  <h3>{status.title}</h3>
                  <strong className="system-card__state">{status.state}</strong>
                  {status.progress !== null ? <ProgressIndicator value={status.progress} /> : <p>{status.active === false ? "Requiere atención" : status.detail}</p>}
                  <footer><Icon name="more" size={14} /></footer>
                </Card>
              }
            >
              <MenuItem icon="info" onClick={() => setSelectedStatus(status)}>Ver más info</MenuItem>
              {status.settings_uri && <MenuItem icon="bolt" onClick={() => onOpen(status.settings_uri)}>Abrir</MenuItem>}
            </ContextMenu>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(selectedStatus)}
        onClose={() => setSelectedStatus(null)}
        title={selectedStatus?.title ?? "Detalle del sistema"}
        size="small"
        footer={selectedStatus?.settings_uri ? <Button icon="bolt" onClick={() => { onOpen(selectedStatus.settings_uri); setSelectedStatus(null); }}>Abrir</Button> : undefined}
      >
        {selectedStatus ? (
          <div className="system-detail">
            <div className="system-detail__hero">
              <span className={`system-card__icon ${selectedStatus.active === false ? "is-danger" : ""}`}>{selectedStatus.icon}</span>
              <div>
                <strong>{selectedStatus.state}</strong>
                <p>{selectedStatus.detail}</p>
              </div>
            </div>
            {numericState(selectedStatus.state) !== null && <ProgressIndicator value={numericState(selectedStatus.state) ?? 0} label="Nivel actual" />}
            <dl>
              <div><dt>Estado</dt><dd>{selectedStatus.active == null ? "Neutro" : selectedStatus.active ? "Activo" : "Inactivo"}</dd></div>
              <div><dt>Acción</dt><dd>{selectedStatus.settings_uri || "Sin acción disponible"}</dd></div>
            </dl>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

export function SystemPage(props: SystemPanelProps) {
  return (
    <div className="page system-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow"><Icon name="system" size={16} /> Telemetría local</span>
          <h1>Estado del sistema</h1>
        </div>
      </header>
      <SystemPanel {...props} />
    </div>
  );
}
