import { useEffect, useState } from "react"
import { fetchThumb } from "../lib/arkiv.js"

export function formatLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`
}

export function useThumb(stallKey) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let live = true
    fetchThumb(stallKey).then((url) => live && setSrc(url))
    return () => {
      live = false
    }
  }, [stallKey])
  return src
}

export function StallCard({ stall, now, sold, mine, onOpen }) {
  const src = useThumb(stall.key)
  const left = stall.vanishesAt - now
  const life = Math.max(1, stall.vanishesAt - stall.firstSeen)
  const fraction = Math.min(1, Math.max(0, left / life))
  const state = left <= 0 ? "gone" : left < 20_000 ? "fading" : "open"

  return (
    <li className={`stall ${state}`} data-sold={sold > 0 || undefined}>
      <button type="button" className="stall-btn" onClick={() => onOpen(stall)} disabled={state === "gone"}>
        <span className="stall-media" aria-hidden="true">
          {src ? <img src={src} alt="" /> : <span className="stall-emoji">{stall.emoji}</span>}
        </span>
        <span className="stall-body">
          <span className="stall-title">{stall.title}</span>
          <span className="stall-seller">{mine ? "Your stall" : stall.sellerName || "A stranger"}</span>
          <span className="stall-row">
            <span className="price">{Number(stall.price).toFixed(2)} USDT</span>
            {sold > 0 && <span className="badge">{sold} sold</span>}
          </span>
        </span>
        <span className="timer" aria-label={`Vanishes in ${formatLeft(left)}`}>
          <span className="timer-text">{state === "gone" ? "gone" : formatLeft(left)}</span>
          <span className="timer-track" aria-hidden="true">
            <span className="timer-fill" style={{ transform: `scaleX(${fraction})` }} />
          </span>
        </span>
      </button>
    </li>
  )
}
