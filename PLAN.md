# Vanishing Bazaar: build plan

ETHGlobal Mumbai, Nov 5 to 7, 2026. Hacking started Thu 9:00 PM IST.
Partner prizes (3 picks): **Arkiv: Build on Arkiv (from scratch)** + Arkiv/Swarm bonus, **Whitechain: Scale (Payments Nobody Notices)**, **World: Best Use of IDKit**.

One line: a shop for people whose shop only exists for a weekend. Open a stall in 10 seconds, sell to anyone with a phone in USDT with no wallet or gas, and the stall disappears when it expires.

## Architecture

```
 phone (seller / buyer)                     projector (/screen)
  burner key in browser                       reads Arkiv directly
  │  World ID (IDKit)                         burns stalls at $expiresAt
  │                                            ▲
  ├── POST /verify ───► server ──drip tGLM──► Arkiv (rabdi testnet)
  │                       │   ──gift USDT───► Whitechain Sepolia (1874)
  ├── createEntity(Stall) ─────────────────► Arkiv  (seller signs, seller owns)
  ├── sign Order + USDT permit ─► server /relay ─► Bazaar.buy() on Whitechain
  │                                  └── createEntity(Sale) ─► Arkiv
  └── stall photo ─► Swarm (ref stored in Stall.imageRef)
```

### Whitechain: `contracts/src/Bazaar.sol`
- `buy(Order, PermitSig, buyerSig)`: the buyer signs an EIP-712 `Order {stallKey, seller, buyer, price, deadline}` and a USDT EIP-2612 permit (domain `Tether USD`, version `1`, verified against the live `DOMAIN_SEPARATOR`). Anyone can submit; the relayer does.
- Pays the seller `price - fee` and the treasury `fee` (100 bps), so each sale funds the relayer's gas.
- Replay protection: each order digest can be used once. The relayer cannot change the price, seller or buyer because the buyer signed them.
- Test USDT: `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`, 6 decimals, has `permit`, no EIP-3009.

### Arkiv: schemas (go into `/arkiv/schema.md`)
| Entity | Owner | Indexed | Expires |
|---|---|---|---|
| `stall` | seller (seller's burner signs the create) | `market`, `seller`, `category`, `price` | seller picks: 2 to 10 min at the demo, "when the market closes" in real life |
| `sale` | relayer | `stallKey`, `market`, `seller`, `buyer` | 30 days (sales history, pays `whitechainTx`) |
| `seller` | seller | `handle` | max (182 days), extended on every new stall: the seller's reputation that outlives each market |

A stall counts as sold when a `sale` with its `stallKey` exists, so the seller does not need to be online to mark it.

### World ID
- One action `open-stall`: one human, one seller profile. The nullifier gates both the tGLM drip and the USDT gift, which is also our answer to "what stops someone draining the relayer".
- Credential: Proof of Human is the minimum that stops bots flooding the market; passport would be overkill for selling a samosa.
- Test with the simulator (`environment: "staging"`).

### Relayer drain protection (Whitechain asks for this)
- Gas is sponsored only for orders from verified humans' burners, at most 20 per human per hour.
- Only `Bazaar.buy` and the one-time USDT gift are ever sent.
- The 1% fee on each sale goes to the treasury, which tops up the relayer's WBT.

## Pull the Plug (last 20 seconds of the demo)
Kill the server. The projector keeps running because it reads Arkiv directly, and stalls keep burning because Arkiv expires them. Sellers who already got tGLM can still open stalls.
Honest trade-off for the CROPS-style claim: new **payments** need the relayer while it is down. We say this out loud and in the README.

## Milestones
1. **Contract** `Bazaar.sol` + Foundry tests with a permit-capable mock. Deploy and verify on Whitechain Sepolia.
2. **Server** (Node + Hono): `/rp-sign`, `/verify`, `/relay/buy`, nullifier store (SQLite).
3. **Phone app** (Vite + React): join, sell (photo, price, lifetime), market list, buy.
4. **Projector** `/screen`: canvas bazaar, stalls light up on sale and crumble at expiry, live USDT counter.
5. **Swarm**: photos uploaded with a booth-provided postage batch; fall back to an on-Arkiv thumbnail (128 KiB max) until then.
6. **Submission files**: `/arkiv/{schema,friction,reach,why-arkiv,how-you-use-arkiv,swarm}.md`, `WHITECHAIN_FEEDBACK.md`, World integration debrief, README with explorer links, a 2 to 4 minute video.

## What you need to do (accounts I can't create)
- [ ] Arkiv access key: https://hub.arkiv.network/access-keys
- [ ] Fund the **server** address with tGLM: https://hub.arkiv.network/faucet
- [ ] Fund the **relayer** address with WBT and USDT: https://faucet.testnet.whitechain.io
- [ ] World Developer Portal app: `app_id`, `rp_id`, `signing_key`: https://developer.world.org
- [ ] Ask the Swarm/Arkiv booth for a postage stamp batch
- [ ] Create a public GitHub repo (Whitechain wants steady commits through the weekend)
