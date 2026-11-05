// Rehearsal helper: opens a stall as the server key so a phone has something to buy.
//   pnpm seed:stall [title] [price] [minutes]
import { ExpirationTime } from "@arkiv-network/sdk"
import { addr, dec } from "@arkiv-network/sdk/schema"
import { account, arkiv, config } from "../src/config.mjs"
import { Stall } from "../src/schemas.mjs"

const [title = "Hot vada pav", price = "0.50", minutes = "5"] = process.argv.slice(2)
const { entityKey } = await arkiv.wallet.createEntity(
  Stall,
  { market: config.market, seller: addr(account.address), category: "food", price: dec(price), title, sellerName: "Bazaar Bot", emoji: "🥟" },
  { expiration: ExpirationTime.fromMinutes(Number(minutes)) },
)
console.log("stall", entityKey)
