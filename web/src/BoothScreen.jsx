// The laptop screen at the judging booth. Judges scan the QR with their own phones; everything
// here is read straight from Arkiv, so it keeps running when the server is switched off.
import QRCode from "qrcode"
import { useCallback, useEffect, useRef, useState } from "react"
import { formatLeft, useThumb } from "./components/StallCard.jsx"
import { api } from "./lib/api.js"
import { fetchSales, fetchStalls } from "./lib/arkiv.js"
import { SERVER_URL } from "./lib/env.js"
import { txUrl } from "./lib/whitechain.js"

const POLL_MS = 3000
// Where phones should go. On the booth laptop this is the LAN or deployed URL, not localhost.
const JOIN_URL = import.meta.env.VITE_PUBLIC_URL ?? location.origin

const short = (address) => `${address.slice(0, 6)}…${address.slice(-4)}`

function useNow(ms) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

function JoinQr() {
  const [svg, setSvg] = useState("")
  useEffect(() => {
    QRCode.toString(JOIN_URL, { type: "svg", margin: 1, color: { dark: "#1c120d", light: "#fbefdc" } }).then(setSvg)
  }, [])
  return (
    <div className="qr-card">
      <div className="qr" role="img" aria-label={`QR code for ${JOIN_URL}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="qr-cta">Scan to open a stall</p>
      <p className="qr-url">{JOIN_URL.replace(/^https?:\/\//, "")}</p>
    </div>
  )
}

function BoothStall({ stall, now, sold, flash }) {
  const src = useThumb(stall.key)
  const left = stall.vanishesAt - now
  const life = Math.max(1, stall.vanishesAt - stall.firstSeen)
  const state = left <= 0 ? "gone" : left < 20_000 ? "fading" : "open"
  return (
    <li className={`booth-stall ${state}`} data-flash={flash || undefined}>
      <div className="booth-media" aria-hidden="true">
        {src ? <img src={src} alt="" /> : <span>{stall.emoji}</span>}
      </div>
      <div className="booth-info">
        <p className="booth-title">{stall.title}</p>
        <p className="booth-seller">{stall.sellerName || "A stranger"}</p>
        <p className="booth-row">
          <span className="price">{Number(stall.price).toFixed(2)} USDT</span>
          {sold > 0 && <span className="badge">{sold} sold</span>}
        </p>
      </div>
      <div className="booth-timer">
        <span>{state === "gone" ? "gone" : formatLeft(left)}</span>
        <span className="timer-track" aria-hidden="true">
          <span className="timer-fill" style={{ transform: `scaleX(${Math.min(1, Math.max(0, left / life))})` }} />
        </span>
      </div>
    </li>
  )
}

export function BoothScreen() {
  const [config, setConfig] = useState(null)
  const [stalls, setStalls] = useState([])
  const [sales, setSales] = useState({ byStall: new Map(), total: 0, count: 0, buyers: 0, list: [] })
  const [serverUp, setServerUp] = useState(true)
  const [arkivUp, setArkivUp] = useState(true)
  const [flashes, setFlashes] = useState(new Set())
  const firstSeen = useRef(new Map())
  const lastCounts = useRef(null)
  const now = useNow(250)

  // The market name is cached so the board survives the server going away.
  useEffect(() => {
    api
      .config()
      .then((c) => {
        setConfig(c)
        try {
          localStorage.setItem("vb.config", JSON.stringify(c))
        } catch {}
      })
      .catch(() => {
        try {
          const cached = JSON.parse(localStorage.getItem("vb.config"))
          if (cached) setConfig(cached)
        } catch {}
      })
  }, [])

  const refresh = useCallback(async () => {
    if (!config) return
    try {
      const [list, s] = await Promise.all([fetchStalls(config.market), fetchSales(config.market)])
      for (const stall of list) if (!firstSeen.current.has(stall.key)) firstSeen.current.set(stall.key, Math.min(Date.now(), stall.vanishesAt))
      // Stalls that sold since the last poll flash for a moment (not on the first load).
      const fresh = new Set()
      if (lastCounts.current) {
        for (const [key, n] of s.byStall) if (n > (lastCounts.current.get(key) ?? 0)) fresh.add(key)
      }
      lastCounts.current = s.byStall
      if (fresh.size) {
        setFlashes(fresh)
        setTimeout(() => setFlashes(new Set()), 2400)
      }
      setStalls(list.map((stall) => ({ ...stall, firstSeen: firstSeen.current.get(stall.key) })))
      setSales(s)
      setArkivUp(true)
    } catch {
      setArkivUp(false)
    }
  }, [config])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    const ping = () =>
      fetch(`${SERVER_URL}/api/health`, { signal: AbortSignal.timeout(2000) })
        .then((r) => setServerUp(r.ok))
        .catch(() => setServerUp(false))
    ping()
    const id = setInterval(ping, 2000)
    return () => clearInterval(id)
  }, [])

  const visible = stalls.filter((s) => s.vanishesAt - now > -1500)
  const titles = new Map(stalls.map((s) => [s.key, s.title]))

  return (
    <main className="booth">
      <header className="booth-head">
        <h1 className="brand">
          Vanishing <span>Bazaar</span>
        </h1>
        <div className="status" aria-live="polite">
          <span className={`pill ${arkivUp ? "ok" : "down"}`}>Arkiv {arkivUp ? "live" : "unreachable"}</span>
          <span className={`pill ${serverUp ? "ok" : "down"}`}>
            {serverUp ? "Our server up" : "Our server OFF · market still running"}
          </span>
        </div>
      </header>

      <section className="booth-stats" aria-label="Market stats">
        <p><strong>{visible.length}</strong> stalls open</p>
        <p><strong>{sales.total.toFixed(2)}</strong> USDT traded</p>
        <p><strong>{sales.count}</strong> sales</p>
        <p><strong>{sales.buyers}</strong> buyers</p>
      </section>

      <div className="booth-body">
        <aside className="booth-side">
          <JoinQr />
          <section className="feed" aria-label="Latest sales">
            <h2>Latest sales</h2>
            {sales.list.length === 0 ? (
              <p className="muted">No sales yet. Be the first buyer.</p>
            ) : (
              <ol>
                {sales.list.slice(0, 6).map((sale) => (
                  <li key={sale.key}>
                    <span>
                      {short(sale.buyer)} bought <b>{titles.get(sale.stallKey) ?? "a vanished stall"}</b>
                    </span>
                    <a href={txUrl(sale.tx)} target="_blank" rel="noreferrer" className="price">
                      {Number(sale.price).toFixed(2)} USDT
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>

        {visible.length === 0 ? (
          <div className="booth-empty">
            <p aria-hidden="true">🏮</p>
            <p>The bazaar is empty. Scan the code and open the first stall.</p>
          </div>
        ) : (
          <ul className="booth-grid" aria-label="Open stalls">
            {visible.map((stall) => (
              <BoothStall key={stall.key} stall={stall} now={now} sold={sales.byStall.get(stall.key) ?? 0} flash={flashes.has(stall.key)} />
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
