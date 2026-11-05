// Writes one short-lived test stall to Arkiv testnet and reads it back with a market query.
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { and, eq } from "@arkiv-network/sdk/query"
import { addr, dec } from "@arkiv-network/sdk/schema"
import { http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { Stall } from "../src/schemas.mjs"

const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY })
const account = privateKeyToAccount(process.env.SERVER_PRIVATE_KEY)
const publicClient = createPublicClient({ chain, transport: http() })
const walletClient = createWalletClient({ chain, transport: http(), account })

const market = "smoke-test"
const t0 = Date.now()
const { entityKey, txHash, expiresAt } = await walletClient.createEntity(
  Stall,
  {
    market,
    seller: addr(account.address),
    category: "food",
    price: dec("2.50"),
    title: "Smoke test vada pav",
  },
  { expiration: ExpirationTime.fromMinutes(2) },
)
console.log(`created ${entityKey} in ${Date.now() - t0} ms, tx ${txHash}, expires at block ${expiresAt}`)

const { currentBlock } = await publicClient.getBlockTiming()
const t1 = Date.now()
const { entities } = await publicClient
  .select({ $key: true, $owner: true, $expiresAt: true, title: true, price: true, emoji: true })
  .from(Stall)
  .where(and(eq("market", market), eq("category", "food")))
  .limit(10)
  .fetch()
console.log(`query returned ${entities.length} stall(s) in ${Date.now() - t1} ms, current block ${currentBlock}`)
for (const s of entities) {
  console.log(` ${s.$key} owner=${s.$owner} "${s.title.value}" ${s.emoji.value} ${s.price.value} USDT, ${(Number(s.$expiresAt) - Number(currentBlock)) * 2}s left`)
}
