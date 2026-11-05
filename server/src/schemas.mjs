// Arkiv schemas shared by the server, the phone app and the projector.
// Documented for judges in /arkiv/schema.md.
import { addr, bytes, dec, defineSchema, key, str } from "@arkiv-network/sdk/schema"

/** A pop-up stall. Created and owned by the seller's own key; expires when the stall closes. */
export const Stall = defineSchema("vb.stall", {
  market: str().indexed(), // e.g. "ethglobal-mumbai"
  seller: addr().indexed(),
  category: str().indexed(),
  price: dec().indexed(), // USDT, e.g. "2.50"
  title: str(),
  sellerName: str().default(""),
  emoji: str().default("🛍️"),
  imageRef: str().optional(), // Swarm reference of the full photo
  thumb: bytes().optional(), // small JPEG fallback until Swarm is wired
})

/** One paid order. Written by the relayer after Bazaar.buy settles on Whitechain. */
export const Sale = defineSchema("vb.sale", {
  market: str().indexed(),
  stallKey: key().indexed(),
  seller: addr().indexed(),
  buyer: addr().indexed(),
  price: dec().indexed(),
  whitechainTx: str(),
})

/** A seller's profile. Outlives every market; extended each time they open a stall. */
export const Seller = defineSchema("vb.seller", {
  handle: str().indexed(),
  wallet: addr().indexed(),
})
