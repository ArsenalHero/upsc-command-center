import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./auth.css";
import "./visual-refinements.css";
createRoot(document.getElementById("root")!).render(<App />);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(new URL("sw.js", document.baseURI), { scope: "./" })
      .catch(() => {
        /* Storage and online use remain available if registration is unsupported. */
      });
  });
}
