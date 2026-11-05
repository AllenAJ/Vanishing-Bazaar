import { useState } from "react"
import { openStall } from "../lib/arkiv.js"
import { photoToThumb } from "../lib/image.js"

const EMOJI = ["☕", "🍛", "🥟", "🌶️", "🧵", "📿", "🎨", "🤗", "🎶", "🪁"]
const LIFETIMES = [
  { minutes: 2, label: "2 min" },
  { minutes: 5, label: "5 min" },
  { minutes: 10, label: "10 min" },
]

export function SellForm({ account, config, name, onOpened, notify }) {
  const [title, setTitle] = useState("")
  const [price, setPrice] = useState("1.00")
  const [emoji, setEmoji] = useState(EMOJI[0])
  const [minutes, setMinutes] = useState(5)
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function pickPhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setPhoto(await photoToThumb(file))
      setError("")
    } catch (e) {
      setError(e.message)
    }
  }

  async function submit(event) {
    event.preventDefault()
    const amount = Number(price)
    if (!title.trim()) return setError("Say what you're selling.")
    if (!(amount >= 0.01 && amount <= 5)) return setError("Price has to be between 0.01 and 5 USDT.")
    setError("")
    setBusy(true)
    try {
      const key = await openStall(account, {
        market: config.market,
        title: title.trim(),
        price: amount.toFixed(2),
        emoji,
        category: "pop-up",
        sellerName: name,
        minutes,
        thumb: photo?.bytes,
      })
      notify(`Your stall is open for ${minutes} minutes.`)
      setTitle("")
      setPhoto(null)
      onOpened(key)
    } catch (e) {
      setError(e.shortMessage ?? e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card stack" onSubmit={submit} aria-labelledby="sell-title">
      <h2 id="sell-title">Open a stall</h2>

      <label className="photo" htmlFor="photo">
        {photo ? <img src={photo.url} alt="Your stall photo" /> : <span className="stall-emoji big" aria-hidden="true">{emoji}</span>}
        <span className="photo-cta">{photo ? "Change photo" : "Add a photo"}</span>
      </label>
      <input id="photo" type="file" accept="image/*" capture="environment" onChange={pickPhoto} className="visually-hidden" />

      <label htmlFor="title">What are you selling?</label>
      <input id="title" maxLength={40} placeholder="One cutting chai" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />

      <label htmlFor="price">Price (USDT)</label>
      <input id="price" type="number" inputMode="decimal" min="0.01" max="5" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />

      <fieldset>
        <legend>Pick an icon</legend>
        <div className="chips">
          {EMOJI.map((e) => (
            <button type="button" key={e} className="chip" aria-pressed={emoji === e} aria-label={`Icon ${e}`} onClick={() => setEmoji(e)}>
              {e}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>How long does it stay open?</legend>
        <div className="chips">
          {LIFETIMES.map((l) => (
            <button type="button" key={l.minutes} className="chip wide" aria-pressed={minutes === l.minutes} onClick={() => setMinutes(l.minutes)}>
              {l.label}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn primary big" disabled={busy}>
        {busy ? "Opening your stall…" : "Open stall"}
      </button>
      <p className="fine">Your stall lives on Arkiv, owned by your phone's key. When the time runs out, it's gone for everyone.</p>
    </form>
  )
}
