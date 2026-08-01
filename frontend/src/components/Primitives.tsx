import {
  forwardRef,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type FocusEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type MotionButtonProps = ComponentPropsWithoutRef<typeof motion.button>;
type MotionDivProps = ComponentPropsWithoutRef<typeof motion.div>;

export const Button = forwardRef<HTMLButtonElement, Omit<MotionButtonProps, "children"> & {
  children?: ReactNode;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
}>(function Button({ variant = "primary", icon, loading, children, className = "", disabled, ...props }, ref) {
  return (
    <motion.button
      ref={ref}
      className={`button button--${variant} ${className}`}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.09 }}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="button__spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={18} /> : null}
      <span>{children}</span>
    </motion.button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, MotionButtonProps & {
  icon: IconName;
  label: string;
  variant?: "ghost" | "surface" | "danger";
}>(function IconButton({ icon, label, variant = "ghost", className = "", ...props }, ref) {
  return (
    <motion.button
      ref={ref}
      className={`icon-button icon-button--${variant} ${className}`}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.09 }}
      {...props}
    >
      <Icon name={icon} size={19} />
    </motion.button>
  );
});

export function TextField({ label, error, hint, icon, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  icon?: IconName;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <label className={`field ${className}`} htmlFor={id}>
      {label && <span className="field__label">{label}</span>}
      <span className={`field__control ${error ? "field__control--error" : ""}`}>
        {icon && <Icon name={icon} size={18} />}
        <input id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      </span>
      {error ? <span id={`${id}-error`} className="field__message field__message--error">{error}</span> : hint ? <span id={`${id}-hint`} className="field__message">{hint}</span> : null}
    </label>
  );
}

export function SearchField({ suggestions = [], onSuggestion, suggestionsPosition = "bottom", ...props }: InputHTMLAttributes<HTMLInputElement> & {
  suggestions?: string[];
  onSuggestion?: (value: string) => void;
  suggestionsPosition?: "top" | "bottom";
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="search-field">
      <TextField
        icon="search"
        aria-label={props["aria-label"] ?? "Buscar eventos"}
        {...props}
        onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
        onBlur={(event) => { window.setTimeout(() => setFocused(false), 100); props.onBlur?.(event); }}
      />
      <AnimatePresence>
        {focused && suggestions.length > 0 && (
          <motion.div className={`search-field__suggestions search-field__suggestions--${suggestionsPosition}`} role="listbox" initial={{ opacity: 0, y: suggestionsPosition === "top" ? 6 : -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: suggestionsPosition === "top" ? 4 : -4 }}>
            {suggestions.slice(0, 7).map((suggestion) => (
              <button key={suggestion} type="button" role="option" onMouseDown={() => onSuggestion?.(suggestion)}>
                <Icon name="search" size={16} />
                <span>{suggestion}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Select({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      {label && <span className="field__label">{label}</span>}
      <span className="select-control">
        <select id={id} {...props}>{children}</select>
        <Icon name="chevron" size={16} />
      </span>
    </label>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`switch-row ${disabled ? "is-disabled" : ""}`}>
      <span className="switch-row__copy"><strong>{label}</strong>{description && <small>{description}</small>}</span>
      <input type="checkbox" checked={checked} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)} disabled={disabled} />
      <span className="switch" aria-hidden="true"><span /></span>
    </label>
  );
}

export function Slider({ label, value, min = 0, max = 100, onChange, suffix = "%" }: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider-row">
      <span><strong>{label}</strong><output>{Math.round(value)}{suffix}</output></span>
      <input type="range" min={min} max={max} value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))} style={{ "--slider-progress": `${progress}%` } as CSSProperties} />
    </label>
  );
}

export function Card({ interactive = false, selected = false, className = "", children, ...props }: Omit<MotionDivProps, "children"> & {
  children?: ReactNode;
  interactive?: boolean;
  selected?: boolean;
}) {
  return (
    <motion.div
      className={`card ${interactive ? "card--interactive" : ""} ${selected ? "is-selected" : ""} ${className}`}
      whileHover={interactive ? { y: -2 } : undefined}
      transition={{ duration: 0.14 }}
      {...props}
    >{children}</motion.div>
  );
}

export function ListItem({ icon, title, description, trailing, active, onClick }: {
  icon?: IconName;
  title: string;
  description?: string;
  trailing?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`list-item ${active ? "is-active" : ""}`} onClick={onClick as never}>
      {icon && <span className="list-item__icon"><Icon name={icon} size={18} /></span>}
      <span className="list-item__copy"><strong>{title}</strong>{description && <small>{description}</small>}</span>
      {trailing && <span className="list-item__trailing">{trailing}</span>}
    </Tag>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="tooltip-host" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {children}
      <AnimatePresence>{open && <motion.span role="tooltip" className="tooltip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{label}</motion.span>}</AnimatePresence>
    </span>
  );
}

export function ContextMenu({ trigger, children, openOnContextMenu = false, openOnClick = true, className = "" }: { trigger: ReactNode; children: ReactNode; openOnContextMenu?: boolean; openOnClick?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  return (
    <div
      className={`context-menu ${className}`}
      ref={host}
      onBlur={(event: FocusEvent<HTMLDivElement>) => { if (!host.current?.contains(event.relatedTarget as Node)) setOpen(false); }}
      onContextMenu={openOnContextMenu ? (event) => { event.preventDefault(); setOpen(true); } : undefined}
    >
      <span onClick={openOnClick ? (event) => { event.stopPropagation(); setOpen((value) => !value); } : undefined}>{trigger}</span>
      <AnimatePresence>
        {open && <motion.div className="context-menu__panel" role="menu" initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} onClick={() => setOpen(false)}>{children}</motion.div>}
      </AnimatePresence>
    </div>
  );
}

export function MenuItem({ icon, danger, children, onClick }: { icon: IconName; danger?: boolean; children: ReactNode; onClick?: () => void }) {
  return <button type="button" role="menuitem" className={danger ? "is-danger" : ""} onClick={onClick}><Icon name={icon} size={17} />{children}</button>;
}
