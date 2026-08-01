import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { WidgetApp } from "./WidgetApp";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/responsive.css";

const widget = new URLSearchParams(window.location.search).get("widget");
if (widget === "command" || widget === "microphone") {
  document.documentElement.dataset.widget = widget;
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
}
const content = widget === "command" || widget === "microphone" ? <WidgetApp mode={widget} /> : <App />;
createRoot(document.getElementById("root")!).render(<StrictMode>{content}</StrictMode>);
