import { useEffect, useRef, useState } from "react"
import { api } from "../lib/api.js"
import { signPurchase, txUrl } from "../lib/whitechain.js"
import { formatLeft, useThumb } from "./StallCard.jsx"

export function BuySheet({ stall, now, account, config, verified, balance, onClose, onBought, onNeedJoin }) {
  const dialog = useRef(null)
  const src = useThumb(stall.key)
  const [status, setStatus] = useState({ kind: "idle" })
  const left = stall.vanishesAt - now
  const mine = stall.seller.toLowerCase() === account.address.toLowerCase()
  const price = Number(stall.price)
  const short = balance !== null && balance < price

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  async function buy() {
    setStatus({ kind: "paying" })
    try {
      const signed = await signPurchase(account, config, stall)
      const { whitechainTx } = await api.buy(signed)
      setStatus({ kind: "paid", tx: whitechainTx })
      onBought()
    } catch (e) {
      setStatus({ kind: "error", message: e.message })
    }
  }

  let action
  if (left <= 0) action = <p className="muted">This stall has vanished.</p>
  else if (mine) action = <p className="muted">This is your stall. Share your phone and let someone else buy.</p>
  else if (!verified)
    action = (
      <button type="button" className="btn primary" onClick={onNeedJoin}>
        Verify to buy
      </button>
    )
  else if (status.kind === "paid")
    action = (
      <div className="stack center" role="status">
        <p className="paid">Paid. {stall.sellerName || "The seller"} has your money.</p>
        <a className="link" href={txUrl(status.tx)} target="_blank" rel="noreferrer">
          See the payment on Whitechain
        </a>
      </div>
    )
  else
    action = (
      <>
        <button type="button" className="btn primary big" onClick={buy} disabled={status.kind === "paying" || short}>
          {status.kind === "paying" ? "Paying…" : `Buy for ${price.toFixed(2)} USDT`}
        </button>
        {short && <p className="error">You have {balance.toFixed(2)} USDT, not enough for this one.</p>}
        {status.kind === "error" && (
          <p className="error" role="alert">
            {status.message}
          </p>
        )}
        <p className="fine">No gas, no wallet popup. You sign once; the bazaar pays the network fee.</p>
      </>
    )

  return (
    <dialog ref={dialog} className="sheet" onClose={onClose} aria-labelledby="sheet-title">
      <div className="sheet-media" aria-hidden="true">
        {src ? <img src={src} alt="" /> : <span className="stall-emoji big">{stall.emoji}</span>}
      </div>
      <h2 id="sheet-title">{stall.title}</h2>
      <p className="muted">
        {stall.sellerName || "A stranger"} · vanishes in {formatLeft(left)}
      </p>
      {action}
      <form method="dialog">
        <button type="submit" className="btn ghost">
          Close
        </button>
      </form>
    </dialog>
  )
}
