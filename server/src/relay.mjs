// Gasless checkout. The buyer signs; we check the order against the live stall on Arkiv,
// pay the gas on Whitechain, then record the sale on Arkiv for the projector.
import { ExpirationTime } from "@arkiv-network/sdk"
import { addr, dec, key } from "@arkiv-network/sdk/schema"
import { BaseError, ContractFunctionRevertedError, formatUnits, getAddress, isHex, parseUnits } from "viem"
import { arkiv, arkivQueue, bazaarAbi, config, wc, whitechainQueue } from "./config.mjs"
import { humans, relays } from "./db.mjs"
import { Sale, Stall } from "./schemas.mjs"
import { HttpError } from "./world.mjs"

const HOUR = 60 * 60 * 1000

export async function relayBuy({ order, permit, sig }) {
  if (!order || !permit || !isHex(sig)) throw new HttpError(400, "Expected { order, permit, sig }")
  if (!isHex(order.stallKey, { strict: true }) || order.stallKey.length !== 66) throw new HttpError(400, "Bad stallKey")
  const buyer = getAddress(order.buyer)
  const seller = getAddress(order.seller)
  const price = BigInt(order.price)

  // Drain protection: only verified humans, and only so many sponsored orders an hour.
  if (!humans.byWallet(buyer)) throw new HttpError(403, "Verify with World ID before buying")
  if (relays.countSince(buyer, Date.now() - HOUR) >= config.maxRelaysPerHour) {
    throw new HttpError(429, "Too many purchases this hour")
  }

  // The stall must still be open on Arkiv, and the order must match it exactly.
  let stall
  try {
    stall = await arkiv.public.getEntity(order.stallKey, Stall)
  } catch {
    throw new HttpError(410, "This stall has vanished")
  }
  if (stall.market.value !== config.market) throw new HttpError(400, "Stall is in another market")
  if (getAddress(stall.$owner) !== seller || getAddress(stall.seller.value) !== seller) {
    throw new HttpError(400, "Order seller does not own this stall")
  }
  if (parseUnits(String(stall.price.value), 6) !== price) throw new HttpError(400, "Order price does not match stall")

  const args = [
    { stallKey: order.stallKey, seller, buyer, price, deadline: BigInt(order.deadline) },
    { deadline: BigInt(permit.deadline), v: Number(permit.v), r: permit.r, s: permit.s },
    sig,
  ]

  const whitechainTx = await whitechainQueue(async () => {
    try {
      const { request } = await wc.public.simulateContract({
        account: wc.wallet.account,
        address: config.bazaar,
        abi: bazaarAbi,
        functionName: "buy",
        args,
      })
      const hash = await wc.wallet.writeContract(request)
      const receipt = await wc.public.waitForTransactionReceipt({ hash })
      if (receipt.status !== "success") throw new HttpError(502, `Payment reverted: ${hash}`)
      return hash
    } catch (error) {
      if (error instanceof HttpError) throw error
      const revert = error instanceof BaseError && error.walk((e) => e instanceof ContractFunctionRevertedError)
      // Solidity `require` strings arrive as errorName "Error" with the message in args[0].
      const reason =
        revert?.data?.errorName === "Error" ? revert.data.args?.[0] : (revert?.data?.errorName ?? revert?.reason)
      throw new HttpError(400, `Payment rejected: ${reason ?? error.shortMessage ?? error.message}`)
    }
  })
  relays.record(buyer)

  // Recording the sale takes a few seconds on Arkiv; the buyer already has their receipt.
  const sale = arkivQueue(() =>
    arkiv.wallet.createEntity(
      Sale,
      {
        market: config.market,
        stallKey: key(order.stallKey),
        seller: addr(seller),
        buyer: addr(buyer),
        price: dec(formatUnits(price, 6)),
        whitechainTx,
      },
      { expiration: ExpirationTime.fromDays(30) },
    ),
  ).catch((error) => {
    console.error(`sale record failed for ${whitechainTx}:`, error.message)
    return null
  })

  return { whitechainTx, sale }
}
