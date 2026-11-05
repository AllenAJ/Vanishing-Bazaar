import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.jsx"
import { BoothScreen } from "./BoothScreen.jsx"
import "./styles.css"

// localhost:5200/#booth is the laptop screen at the judging table; everything else is the phone app.
const isBooth = location.hash === "#booth"
addEventListener("hashchange", () => location.reload())

createRoot(document.getElementById("root")).render(<StrictMode>{isBooth ? <BoothScreen /> : <App />}</StrictMode>)
