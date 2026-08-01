import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ToastMessage } from "../types/domain";
import { Button, IconButton } from "./Primitives";
import { Icon } from "./Icon";

export function Skeleton({ width = "100%", height = 16, radius = 10 }: { width?: string | number; height?: string | number; radius?: number }) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

export function ProgressIndicator({ value, label, indeterminate = false }: { value?: number; label?: string; indeterminate?: boolean }) {
  const bounded = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="progress" aria-label={label} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={indeterminate ? undefined : bounded}>
      {label && <span>{label}<strong>{indeterminate ? "" : `${Math.round(bounded)}%`}</strong></span>}
      <div className={`progress__track ${indeterminate ? "is-indeterminate" : ""}`}><i style={indeterminate ? undefined : { width: `${bounded}%` }} /></div>
    </div>
  );
}

export function EmptyState({ image = "/mascot/29_bolty_categoria_vacia.png", title, message, action }: { image?: string; title: string; message: string; action?: ReactNode }) {
  return (
    <motion.div className="state state--empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <img src={image} alt="Bolty" />
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </motion.div>
  );
}

export function LoadingState({ label = "Bolty está preparando esta zona…" }: { label?: string }) {
  return (
    <div className="state state--loading" role="status">
      <div className="loading-orbit" aria-hidden="true"><span /><i /></div>
      <p>{label}</p>
      <div className="loading-grid"><Skeleton height={110} /><Skeleton height={110} /><Skeleton height={110} /></div>
    </div>
  );
}

export function ErrorState({ title = "No se pudo completar la misión", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <img src="/mascot/23_bolty_error.png" alt="Bolty muestra un error" />
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && <Button variant="secondary" icon="refresh" onClick={onRetry}>Reintentar</Button>}
    </div>
  );
}

export function Dialog({ open, title, description, children, footer, onClose, size = "medium", className = "", contentClassName = "", hideHeader = false }: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: "small" | "medium" | "large";
  className?: string;
  contentClassName?: string;
  hideHeader?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const content = dialogRef.current?.querySelector<HTMLElement>(".dialog__content");
      content?.scrollTo({ top: 0 });
      const autofocus = dialogRef.current?.querySelector<HTMLElement>("[autofocus], [data-autofocus]");
      const first = dialogRef.current?.querySelector<HTMLElement>("button:not([disabled]), input:not([disabled]):not([type='hidden']):not([type='file']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])");
      (autofocus ?? first ?? dialogRef.current)?.focus();
    });
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]):not([type='hidden']):not([type='file']), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) { event.preventDefault(); dialogRef.current.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", listener);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", listener);
      previous?.focus();
    };
  // The close callback active when the dialog opens is the one restored on cleanup.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="dialog-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event: MouseEvent<HTMLDivElement>) => event.target === event.currentTarget && onClose()}>
          <motion.section ref={dialogRef} tabIndex={-1} className={`dialog dialog--${size} ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}>
            {hideHeader ? <h2 id={titleId} className="sr-only">{title}</h2> : <header><div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><IconButton icon="x" label="Cerrar diálogo" onClick={onClose} /></header>}
            <div className={`dialog__content ${contentClassName}`.trim()}>{children}</div>
            {footer && <footer>{footer}</footer>}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ToastRegion({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.article key={toast.id} className={`toast toast--${toast.tone}`} initial={{ opacity: 0, x: 28, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 20, scale: 0.96 }} layout>
            <span className="toast__icon"><Icon name={toast.tone === "success" ? "check" : toast.tone === "danger" ? "alert" : "spark"} size={19} /></span>
            <div><strong>{toast.title}</strong>{toast.message && <p>{toast.message}</p>}</div>
            <IconButton icon="x" label="Cerrar notificación" onClick={() => onDismiss(toast.id)} />
          </motion.article>
        ))}
      </AnimatePresence>
    </div>
  );
}
