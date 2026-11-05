# Arkiv schema

Defined once in [`server/src/schemas.mjs`](../server/src/schemas.mjs) and shared by the server, the phone app and the booth screen. Network: rabdi testnet (chain ID 7794095).

## `vb.stall`: a pop-up stall

| Column | Type | Indexed | Why |
|---|---|---|---|
| `market` | str | yes | Every view filters to one market, e.g. `ethglobal-mumbai` |
| `seller` | addr | yes | "My stalls", and the relayer checks it matches the order |
| `category` | str | yes | Filter by kind of stall |
| `price` | dec | yes | Shown, and the relayer checks the signed order matches it exactly |
| `title` | str | no | Display only |
| `sellerName` | str | no | Display only |
| `emoji` | str | no | Display fallback when there's no photo |
| `imageRef` | str, optional | no | Swarm reference for the full photo (next step) |
| `thumb` | bytes, optional | no | A JPEG of up to 24 KB, fetched once per stall, never in list queries |

- **Owner:** the seller's own burner key signs the `createEntity`, so creator and owner are the seller. Only they can patch or delete it.
- **Expires:** whatever the seller picks: 2, 5 or 10 minutes at the demo. Expiry is the product: when the block passes, the stall is gone for every app.

## `vb.sale`: one paid order

| Column | Type | Indexed | Why |
|---|---|---|---|
| `market` | str | yes | Ticker totals and the sales feed |
| `stallKey` | key | yes | Links the sale to its stall; "N sold" badges |
| `seller` | addr | yes | A seller's sales history |
| `buyer` | addr | yes | Unique buyer count |
| `price` | dec | yes | USDT traded |
| `whitechainTx` | str | no | The settled payment on Whitechain, so anyone can verify it |

- **Owner:** the relayer (`0xDe74bc008F4898aFBf9Db2A94363511D250d5275`). It writes the sale only after `Bazaar.buy` succeeds, so the seller doesn't need to be online.
- **Expires:** 30 days. Sales outlive the stall so sellers keep a history.

## `vb.seller`: a seller profile (planned)

`handle` (str, indexed) and `wallet` (addr, indexed), owned by the seller and kept at the maximum lifetime, extended whenever they open a stall: a reputation that outlives each market.

## Kept off Arkiv

- **World ID nullifiers** stay in the server's SQLite. Publishing them would link one person across all their wallets.
- **Money** settles on Whitechain. Arkiv only stores the payment's transaction hash.
