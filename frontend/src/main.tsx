import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"
import { toast } from "sonner"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("Service Worker registered:", reg.scope)
        toast("Service Worker registered successfully")
      })
      .catch((err) => {
        console.error("Service Worker registration failed:", err)
        toast.error(`Service Worker registration failed: ${err?.message || err}`)
      })
  })
}

