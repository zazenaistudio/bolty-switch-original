import { Card } from "../components/Primitives";
import { Icon } from "../components/Icon";

export function HelpPage() {
  const steps = [
    ["Crea una misión", "Elige una categoría, un nombre, comandos naturales y una acción."],
    ["Ejecuta como prefieras", "Usa una tarjeta, el buscador, el dock de comandos o tu voz."],
    ["Combina eventos", "Los guiones encadenan varias acciones con pausas configurables."],
    ["Mantén el control", "Las acciones peligrosas siempre pueden pedir confirmación."],
  ];
  return <div className="page static-page"><header className="page-heading"><div><span className="eyebrow"><Icon name="help" size={16} /> Centro de ayuda</span><h1>Aprende a usar Bolty</h1><p>Todo lo esencial, organizado en misiones sencillas.</p></div></header><div className="help-grid">{steps.map(([title, body], index) => <Card key={title} className="help-card"><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{body}</p></Card>)}</div><Card className="shortcut-card"><img src="/mascot/14_bolty_ayuda.png" alt="Bolty ayudando" /><div><span className="eyebrow">Atajo estelar</span><h2>Abre la búsqueda desde cualquier pantalla</h2><p>Pulsa <kbd>Ctrl</kbd> + <kbd>K</kbd>, escribe el nombre o una frase y presiona Enter.</p></div></Card></div>;
}

export function AboutPage() {
  return <div className="page static-page about-page"><Card className="about-card"><div className="about-card__planet" aria-hidden="true" /><img src="/mascot/15_bolty_acerca_de.png" alt="Bolty" /><span className="eyebrow"><Icon name="spark" size={16} /> Zazen AI Studio</span><h1>Bolty Switch</h1><p>Automatización del sistema mediante eventos, texto y voz. Diseñado para convertir tareas complejas en acciones claras, rápidas y divertidas.</p><dl><div><dt>Versión</dt><dd>0.6.6 Cosmic UI</dd></div><div><dt>Frontend</dt><dd>Tauri 2 · React · TypeScript</dd></div><div><dt>Backend</dt><dd>Python · SQLite · IPC JSON</dd></div></dl><small>© 2026 Zazen AI Studio. Software propietario.</small></Card></div>;
}
