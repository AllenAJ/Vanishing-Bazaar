import { IDKitRequestWidget, proofOfHuman } from "@worldcoin/idkit"
import { useState } from "react"
import { api } from "../lib/api.js"

// Proof of Human is the least we can ask for: it stops one person (or a bot farm) from
// flooding the market with stalls and draining the welcome gift. A passport would be overkill.
export function JoinCard({ account, name, onNameChange, onVerified, notify }) {
  const [request, setRequest] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function start(event) {
    event.preventDefault()
    if (!name.trim()) return setError("Add a stall name first, so buyers know who you are.")
    setError("")
    setBusy(true)
    try {
      setRequest(await api.rpContext())
      setOpen(true)
    } catch (e) {
      setError(`Couldn't reach the bazaar server. ${e.message}`)
      setBusy(false)
    }
  }

  return (
    <section className="card join" aria-labelledby="join-title">
      <h2 id="join-title">Open your first stall in 10 seconds</h2>
      <p className="muted">One human, one stall keeper. You get 5 test USDT to shop with. No wallet, no gas.</p>
      <form onSubmit={start} className="stack">
        <label htmlFor="stall-name">Your stall name</label>
        <input
          id="stall-name"
          name="nickname"
          autoComplete="nickname"
          maxLength={32}
          placeholder="Allen's Chai Corner"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "join-error" : undefined}
        />
        {error && (
          <p id="join-error" className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "Waiting for World ID…" : "Verify I'm human"}
        </button>
      </form>

      {request && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) setBusy(false)
          }}
          app_id={request.app_id}
          action={request.action}
          rp_context={request.rp_context}
          environment={request.environment}
          allow_legacy_proofs={request.allow_legacy_proofs}
          preset={proofOfHuman({ signal: account.address.toLowerCase() })}
          handleVerify={async (result) => {
            // Throwing here shows World's failure screen, and nothing is unlocked.
            const res = await api.verify(result, account.address)
            notify(
              res.returning
                ? "Welcome back. Your stall is linked to this phone (the 5 USDT gift is once per human)."
                : "You're in. 5 USDT is on its way.",
            )
          }}
          onSuccess={() => {
            setBusy(false)
            onVerified()
          }}
          onError={(code) => {
            setBusy(false)
            setError(code === "user_rejected" ? "Verification cancelled. You can still browse." : `World ID didn't complete (${code}).`)
          }}
        />
      )}
    </section>
  )
}
