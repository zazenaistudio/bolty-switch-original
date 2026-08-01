import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { AssistantState } from "../types/domain";

const mascotByState: Record<AssistantState, string> = {
  idle: "16_bolty_asistente_reposo.png",
  searching: "17_bolty_buscando.png",
  listening: "18_bolty_escuchando.png",
  wake: "19_bolty_modo_manos_libres.png",
  thinking: "20_bolty_pensando.png",
  executing: "21_bolty_ejecutando.png",
  success: "22_bolty_ejecucion_correcta.png",
  error: "23_bolty_error.png",
  create: "24_bolty_crear_evento.png",
  edit: "25_bolty_editar_evento.png",
  empty: "29_bolty_categoria_vacia.png",
};

export function CosmicBackdrop() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const listener = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }, []);
  return (
    <div className={`cosmic-backdrop ${reduce || !visible ? "is-paused" : ""}`} aria-hidden="true">
      <div className="cosmic-backdrop__nebula" />
      <div className="cosmic-backdrop__aurora cosmic-backdrop__aurora--one" />
      <div className="cosmic-backdrop__aurora cosmic-backdrop__aurora--two" />
      <div className="cosmic-backdrop__stars cosmic-backdrop__stars--one" />
      <div className="cosmic-backdrop__stars cosmic-backdrop__stars--two" />
      <div className="cosmic-backdrop__dust" />
      <div className="cosmic-backdrop__comet cosmic-backdrop__comet--one" />
      <div className="cosmic-backdrop__comet cosmic-backdrop__comet--two" />
      <div className="cosmic-backdrop__orbit"><span /><i /></div>
    </div>
  );
}

export function BoltyAssistant({ state, label, compact = false }: { state: AssistantState; label: string; compact?: boolean }) {
  const reduce = useReducedMotion();
  const isWake = state === "wake";
  const isEnergetic = state === "executing" || state === "success" || state === "create" || isWake;
  const isListening = state === "listening" || state === "searching" || state === "thinking" || isWake;
  return (
    <div className={`bolty-assistant ${compact ? "bolty-assistant--compact" : ""} bolty-assistant--${state}`} aria-label={label} role="status">
      <motion.div
        className="bolty-assistant__glow"
        aria-hidden="true"
        animate={reduce ? undefined : { opacity: [0.45, 0.9, 0.45], scale: [0.92, 1.08, 0.92], rotate: isEnergetic ? 360 : 0 }}
        transition={reduce ? undefined : { opacity: { duration: 2.4, repeat: Infinity }, scale: { duration: 2.4, repeat: Infinity }, rotate: { duration: 9, repeat: Infinity, ease: "linear" } }}
      />
      <motion.img
        key={state}
        src={`/mascot/${mascotByState[state]}`}
        alt="Bolty"
        initial={reduce ? false : { opacity: 0, scale: 0.82, y: 12, rotate: -4 }}
        animate={reduce ? { opacity: 1 } : {
          opacity: 1,
          scale: isWake ? [1, 1.12, 1] : isEnergetic ? [1, 1.045, 1] : [1, 1.018, 1],
          y: isWake ? [0, -14, 0] : isEnergetic ? [0, -9, 0] : [0, -5, 0],
          rotate: isWake ? [-5, 5, -5] : isListening ? [-2, 2, -2] : [-0.8, 0.8, -0.8],
        }}
        transition={reduce ? { duration: 0.1 } : {
          opacity: { duration: 0.24 },
          scale: { duration: isWake ? 0.75 : isEnergetic ? 1.6 : 3.1, repeat: Infinity, ease: "easeInOut" },
          y: { duration: isWake ? 0.75 : isEnergetic ? 1.6 : 3.1, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: isWake ? 0.7 : isListening ? 1.35 : 4.2, repeat: Infinity, ease: "easeInOut" },
        }}
        whileHover={reduce ? undefined : { scale: 1.08, rotate: 2 }}
      />
      {!compact && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={label}>{label}</motion.span>}
    </div>
  );
}
