# Vanishing Bazaar

**A shop for people whose shop only exists for a weekend.**

Open a stall from your phone in 10 seconds, sell to anyone in USDT with no wallet and no gas, and watch the stall disappear when its time runs out. Built at ETHGlobal Mumbai (Nov 5 to 7, 2026).

Flea markets, college fests, Diwali melas, concert merch tables: pop-up sellers set up fast, sell to strangers (often tourists who can't use UPI) and vanish. Every tool they have assumes a permanent business. Vanishing Bazaar gives them a stall that is born, paid and gone in one session.

## How it works

```
 phone (seller / buyer)                     booth screen (localhost:5200/#booth)
  burner key in the browser                   reads Arkiv directly
  │  World ID (IDKit, Proof of Human)          stalls burn away at $expiresAt
  │                                            ▲
  ├── POST /api/world/verify ─► server ─ tGLM gas drip ─► Arkiv (rabdi testnet)
  │                                └── 5 USDT welcome ──► Whitechain Sepolia (1874)
  ├── createEntity(Stall) ───────────────────────────────► Arkiv  (seller signs, seller owns)
  ├── sign Order + USDT permit ─► server /api/relay/buy ─► Bazaar.buy() on Whitechain
  │                                    └── createEntity(Sale) ─► Arkiv
```

1. **Join.** The phone makes a hidden burner key. The person proves they are a unique human with World ID; the proof is bound to their burner address. They get a little Arkiv gas and 5 test USDT, once per human.
2. **Sell.** The phone writes a `stall` entity to Arkiv signed by its own key, so the seller owns it. The seller picks how long it lives (2, 5 or 10 minutes at the demo; "until the market closes" in real life).
3. **Buy.** The buyer signs an EIP-712 order and a USDT EIP-2612 permit. No transaction, no gas, no popup. Our relayer checks the order against the live stall on Arkiv and submits `Bazaar.buy`, which pays the seller 99% and the treasury 1% (which refills the relayer's gas). The relayer then records a `sale` entity on Arkiv.
4. **Vanish.** When a stall's expiry block passes, Arkiv stops returning it. Nobody has to delete it, including us.

## Pull the plug

The booth screen and the market list read Arkiv directly. Kill our server and the stalls keep counting down and vanishing on schedule, because Arkiv expires them, not our backend. The booth screen shows **"Our server OFF · market still running"**.

Honest trade-off: new **payments** need the relayer, because the relayer is what makes them gasless. Sellers who already have Arkiv gas can still open stalls while it is down.

## Deployed

| What | Where |
|---|---|
| `Bazaar` checkout contract (verified) | [0x9f8Df40996313fa4c4A562480eC59bba2BC24a90](https://explorer.testnet.whitechain.io/address/0x9f8Df40996313fa4c4A562480eC59bba2BC24a90) on Whitechain Sepolia (1874) |
| Settled USDT payment through the relayer | [0x0438e26d…0d93](https://explorer.testnet.whitechain.io/tx/0x0438e26d05b5b033c3911a2915361805aecf0d327c49129114b82ba2f1500d93) |
| Payment token | Whitechain test USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` |
| Server / relayer / Arkiv writer of `sale` entities | `0xDe74bc008F4898aFBf9Db2A94363511D250d5275` |
| Arkiv network | rabdi testnet, chain ID 7794095 |

`stall` entities are written by each seller's own burner key, so their owners are many addresses; the server only writes `sale` entities (and the "Bazaar Bot" rehearsal stalls).

### One Arkiv query you can run

```ts
import { createPublicClient } from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { eq } from "@arkiv-network/sdk/query"
import { http } from "viem"
import { Sale } from "./server/src/schemas.mjs"

const client = createPublicClient({ chain: rabdi({ accessKey: "" }), transport: http() })
const { entities } = await client
  .select({ $key: true, stallKey: true, buyer: true, price: true, whitechainTx: true })
  .from(Sale)
  .where(eq("market", "ethglobal-mumbai"))
  .fetch()
```

Every sale points to the stall it came from (`stallKey`) and to the Whitechain payment that settled it (`whitechainTx`). See [arkiv/schema.md](arkiv/schema.md).

## Why each sponsor is load-bearing

- **Arkiv:** a stall is data the seller owns, with a lifespan. Expiry *is* the product. Any app can query "what's open in this market right now" without asking us.
- **Whitechain:** the buyer pays in USDT and never sees gas, a seed phrase or a chain name. The seller has dollars in seconds, with no payment gateway onboarding and no chargebacks. A card or UPI rail can't take dollars from a foreign stranger instantly for a 50-cent chai.
- **World ID:** one human, one stall keeper. Without it, one person with a script floods the market with stalls and drains the welcome gift and the relayer's gas. Proof of Human is the minimum that stops that; a passport check would be overkill for selling a samosa.

## Relayer drain protection

- Gas is only sponsored for orders from World ID-verified burners, at most 20 purchases per human per hour.
- The relayer only ever sends `Bazaar.buy`, the one-time welcome USDT and the Arkiv gas drip.
- Before paying gas it checks the order against the live stall on Arkiv (seller owns it, price matches, not expired) and simulates the call.
- The buyer signed seller, price and buyer, so the relayer can't redirect or inflate a payment (see `contracts/test/Bazaar.t.sol`).
- The 1% fee on every sale refills the relayer.

## Run it

Requirements: Node 22+, pnpm, Foundry.

```bash
git clone --recursive https://github.com/AllenAJ/Vanishing-Bazaar.git
cd Vanishing-Bazaar
cp .env.example .env   # fill in keys (see below)
```

```bash
cd contracts && forge test                                                    # 8 tests
forge test --match-contract BazaarForkTest --fork-url https://rpc.testnet.whitechain.io  # same tests on live USDT
```

```bash
cd server && pnpm install && pnpm start        # API on :8787
cd web && pnpm install && pnpm dev --port 5200 # phone app on :5200, booth screen on :5200/#booth
```

`.env` needs: `SERVER_PRIVATE_KEY` (funded with WBT + test USDT on Whitechain and tGLM on Arkiv), `BAZAAR_ADDRESS`, `ARKIV_ACCESS_KEY`, `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_SIGNING_KEY`, `WORLD_ENVIRONMENT=staging`. `web/.env.local` needs `VITE_ARKIV_ACCESS_KEY` and `VITE_PUBLIC_URL` (the address phones use, shown as the booth QR code).

Rehearsal helpers in `server/`: `pnpm seed:stall "Kutting chai" 0.40 6`, `pnpm dev:fund <wallet> [usdt]`, `pnpm e2e:relay`.

## Current limitations

- The burner key lives in the browser's local storage. Clearing it loses that wallet's USDT; World ID lets the same human link a new burner, but the welcome USDT is once per human.
- World ID runs in the staging environment with the simulator for the hackathon.
- Stall photos are small JPEG thumbnails stored on Arkiv (up to 24 KB). Full photos on Swarm are next.
- The Arkiv access key is in the web bundle (it only buys rate limit on testnet).

## How we used AI

Built with Claude Code (Anthropic) as a pair programmer: it read the sponsor docs, wrote most of the code and tests, and ran the end-to-end checks on testnet. Product decisions, sponsor choices and the demo were ours.

## License

MIT
