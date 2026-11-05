import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BuySheet } from "./components/BuySheet.jsx"
import { JoinCard } from "./components/JoinCard.jsx"
import { SellForm } from "./components/SellForm.jsx"
import { StallCard } from "./components/StallCard.jsx"
import { api } from "./lib/api.js"
import { fetchSales, fetchStalls } from "./lib/arkiv.js"
import { loadBurner, loadName, saveName } from "./lib/burner.js"
import { usdtBalance } from "./lib/whitechain.js"

const POLL_MS = 4000
const account = loadBurner()

function useNow(intervalMs) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function App() {
  const [config, setConfig] = useState(null)
  const [configError, setConfigError] = useState("")
  const [verified, setVerified] = useState(false)
  const [name, setName] = useState(loadName)
  const [tab, setTab] = useState("market")
  const [stalls, setStalls] = useState(null)
  const [sales, setSales] = useState({ byStall: new Map(), total: 0, count: 0 })
  const [marketError, setMarketError] = useState("")
  const [balance, setBalance] = useState(null)
  const [open, setOpen] = useState(null)
  const [toast, setToast] = useState("")
  const firstSeen = useRef(new Map())
  const now = useNow(250)

  const notify = useCallback((message) => {
    setToast(message)
    setTimeout(() => setToast(""), 3500)
  }, [])

  const loadConfig = useCallback(() => {
    setConfigError("")
    api
      .config()
      .then(setConfig)
      .catch((e) => setConfigError(e.message))
  }, [])
  useEffect(loadConfig, [loadConfig])

  useEffect(() => {
    api
      .me(account.address)
      .then((me) => setVerified(me.verified))
      .catch(() => {})
  }, [])

  const refreshBalance = useCallback(async () => {
    if (!config) return
    const raw = await usdtBalance(config.usdt, account.address).catch(() => null)
    if (raw !== null) setBalance(Number(raw) / 1e6)
  }, [config])

  // Poll Arkiv directly. If our server dies, this keeps working.
  const refreshMarket = useCallback(async () => {
    if (!config) return
    try {
      const [list, s] = await Promise.all([fetchStalls(config.market), fetchSales(config.market)])
      for (const stall of list) if (!firstSeen.current.has(stall.key)) firstSeen.current.set(stall.key, Math.min(Date.now(), stall.vanishesAt))
      setStalls(list.map((stall) => ({ ...stall, firstSeen: firstSeen.current.get(stall.key) })))
      setSales(s)
      setMarketError("")
    } catch (e) {
      setMarketError(e.shortMessage ?? e.message)
    }
  }, [config])

  useEffect(() => {
    if (!config) return
    refreshMarket()
    refreshBalance()
    const id = setInterval(() => {
      refreshMarket()
      refreshBalance()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [config, refreshMarket, refreshBalance])

  const visible = useMemo(() => (stalls ?? []).filter((s) => s.vanishesAt - now > -1500), [stalls, now])
  const mine = visible.filter((s) => s.seller.toLowerCase() === account.address.toLowerCase())
  const shown = tab === "mine" ? mine : visible

  function changeName(value) {
    setName(value)
    saveName(value)
  }

  if (configError) {
    return (
      <main className="shell">
        <div className="card stack" role="alert">
          <h1 className="brand">Vanishing Bazaar</h1>
          <p className="error">Can't reach the bazaar: {configError}</p>
          <button type="button" className="btn primary" onClick={loadConfig}>
            Try again
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="shell">
      <header className="top">
        <h1 className="brand">
          Vanishing <span>Bazaar</span>
        </h1>
        <p className="wallet" aria-label="Your balance">
          {balance === null ? "…" : `${balance.toFixed(2)} USDT`}
        </p>
      </header>

      <p className="ticker" aria-live="polite">
        <strong>{visible.length}</strong> stalls open · <strong>{sales.total.toFixed(2)}</strong> USDT traded
      </p>

      {!verified && config && (
        <JoinCard
          account={account}
          name={name}
          onNameChange={changeName}
          notify={notify}
          onVerified={() => {
            setVerified(true)
            setTab("sell")
            setTimeout(refreshBalance, 4000)
          }}
        />
      )}

      <nav className="tabs" aria-label="Sections">
        {[
          ["market", "Market"],
          ["sell", "Sell"],
          ["mine", `My stalls${mine.length ? ` (${mine.length})` : ""}`],
        ].map(([id, label]) => (
          <button key={id} type="button" className="tab" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "sell" ? (
        verified ? (
          <SellForm
            account={account}
            config={config}
            name={name}
            notify={notify}
            onOpened={() => {
              setTab("mine")
              refreshMarket()
            }}
          />
        ) : (
          <p className="card muted">Verify above to open a stall. It takes one tap in World App.</p>
        )
      ) : stalls === null ? (
        marketError ? (
          <div className="card stack" role="alert">
            <p className="error">Couldn't load the market: {marketError}</p>
            <button type="button" className="btn" onClick={refreshMarket}>
              Retry
            </button>
          </div>
        ) : (
          <ul className="grid" aria-busy="true" aria-label="Loading stalls">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="stall skeleton" />
            ))}
          </ul>
        )
      ) : shown.length === 0 ? (
        <div className="card stack center">
          <p className="empty-emoji" aria-hidden="true">
            🏮
          </p>
          <p>{tab === "mine" ? "You have no open stalls." : "The bazaar is quiet. Be the first stall."}</p>
          <button type="button" className="btn primary" onClick={() => setTab("sell")}>
            Open a stall
          </button>
        </div>
      ) : (
        <ul className="grid" aria-label={tab === "mine" ? "Your stalls" : "Open stalls"}>
          {shown.map((stall) => (
            <StallCard
              key={stall.key}
              stall={stall}
              now={now}
              sold={sales.byStall.get(stall.key) ?? 0}
              mine={stall.seller.toLowerCase() === account.address.toLowerCase()}
              onOpen={setOpen}
            />
          ))}
        </ul>
      )}

      {open && config && (
        <BuySheet
          stall={open}
          now={now}
          account={account}
          config={config}
          verified={verified}
          balance={balance}
          onClose={() => setOpen(null)}
          onBought={() => {
            refreshBalance()
            setTimeout(refreshMarket, 8000)
          }}
          onNeedJoin={() => {
            setOpen(null)
            window.scrollTo({ top: 0, behavior: "smooth" })
          }}
        />
      )}

      <div className="toast" role="status" aria-live="polite" data-show={Boolean(toast) || undefined}>
        {toast}
      </div>
    </main>
  )
}
