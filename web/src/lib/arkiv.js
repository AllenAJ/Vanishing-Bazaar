// The app reads and writes Arkiv directly. The server is never in the way of a stall.
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { asc, eq } from "@arkiv-network/sdk/query"
import { addr, bytes, dec } from "@arkiv-network/sdk/schema"
import { http } from "viem"
import { Sale, Stall } from "../../../server/src/schemas.mjs"
import { ARKIV_ACCESS_KEY, BLOCK_SECONDS } from "./env.js"

const chain = rabdi({ accessKey: ARKIV_ACCESS_KEY })
export const arkivPublic = createPublicClient({ chain, transport: http() })

export function arkivWallet(account) {
  return createWalletClient({ chain, transport: http(), account })
}

/** Open stalls in a market, soonest to vanish first, with seconds left computed from blocks. */
export async function fetchStalls(market) {
  const [{ currentBlock }, { entities }] = await Promise.all([
    arkivPublic.getBlockTiming(),
    arkivPublic
      .select({ $key: true, $owner: true, $expiresAt: true, $createdAt: true, title: true, price: true, emoji: true, category: true, sellerName: true, seller: true })
      .from(Stall)
      .where(eq("market", market))
      .orderBy(asc("$expiresAt"))
      .limit(100)
      .fetch(),
  ])
  const fetchedAt = Date.now()
  return entities.map((s) => ({
    key: s.$key,
    owner: s.$owner,
    seller: s.seller.value,
    sellerName: s.sellerName.value,
    title: s.title.value,
    emoji: s.emoji.value,
    category: s.category.value,
    price: String(s.price.value),
    expiresAt: Number(s.$expiresAt),
    // Absolute time it vanishes, in this device's clock.
    vanishesAt: fetchedAt + (Number(s.$expiresAt) - Number(currentBlock)) * BLOCK_SECONDS * 1000,
  }))
}

/** Sales per stall in a market, plus the running USDT total. */
export async function fetchSales(market) {
  const { entities } = await arkivPublic
    .select({ $key: true, $createdAt: true, stallKey: true, price: true, buyer: true, whitechainTx: true })
    .from(Sale)
    .where(eq("market", market))
    .limit(100)
    .fetch()
  const byStall = new Map()
  const buyers = new Set()
  let total = 0
  for (const sale of entities) {
    byStall.set(sale.stallKey.value, (byStall.get(sale.stallKey.value) ?? 0) + 1)
    buyers.add(sale.buyer.value.toLowerCase())
    total += Number(sale.price.value)
  }
  // $createdAt can't be sorted on by the node, so newest-first happens here.
  const list = entities
    .map((s) => ({
      key: s.$key,
      createdAt: Number(s.$createdAt),
      stallKey: s.stallKey.value,
      buyer: s.buyer.value,
      price: String(s.price.value),
      tx: s.whitechainTx.value,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
  return { byStall, total, count: entities.length, buyers: buyers.size, list }
}

const thumbs = new Map()

/** The stall photo, fetched once per stall: thumbnails are kept out of the list query to keep it light. */
export async function fetchThumb(stallKey) {
  if (thumbs.has(stallKey)) return thumbs.get(stallKey)
  const job = arkivPublic
    .getEntity(stallKey, Stall)
    .then((s) => (s.thumb?.value ? `data:image/jpeg;base64,${hexToBase64(s.thumb.value)}` : null))
    .catch(() => null)
  thumbs.set(stallKey, job)
  return job
}

function hexToBase64(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex
  let binary = ""
  for (let i = 0; i < clean.length; i += 2) binary += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16))
  return btoa(binary)
}

/** The seller's own key signs this, so the seller owns the stall on Arkiv. */
export async function openStall(account, { market, title, price, emoji, category, sellerName, minutes, thumb }) {
  const { entityKey } = await arkivWallet(account).createEntity(
    Stall,
    {
      market,
      seller: addr(account.address),
      category,
      price: dec(price),
      title,
      sellerName,
      emoji,
      ...(thumb ? { thumb: bytes(thumb) } : {}),
    },
    { expiration: ExpirationTime.fromMinutes(minutes) },
  )
  return entityKey
}

export async function glmBalance(address) {
  return arkivPublic.getBalance({ address })
}
