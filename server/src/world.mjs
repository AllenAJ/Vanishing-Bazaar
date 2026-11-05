// World ID: one human, one seller profile. The proof's signal is the human's burner wallet,
// so a proof can't be replayed to claim the welcome gift for someone else's wallet.
import { hashSignal } from "@worldcoin/idkit-core/hashing"
import { signRequest } from "@worldcoin/idkit-core/signing"
import { getAddress } from "viem"
import { arkiv, arkivQueue, config, erc20Abi, wc, whitechainQueue } from "./config.mjs"
import { humans } from "./db.mjs"

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** Signal the client must request with: the checksummed wallet, lowercased. */
export const signalFor = (wallet) => getAddress(wallet).toLowerCase()

export function rpContext() {
  const { sig, nonce, createdAt, expiresAt } = signRequest({
    signingKeyHex: config.world.signingKey,
    action: config.world.action,
  })
  return {
    app_id: config.world.appId,
    action: config.world.action,
    environment: config.world.environment,
    allow_legacy_proofs: config.world.allowLegacyProofs,
    rp_context: { rp_id: config.world.rpId, nonce, created_at: createdAt, expires_at: expiresAt, signature: sig },
  }
}

export async function verifyHuman(result, wallet) {
  if (!result || typeof result !== "object") throw new HttpError(400, "Missing World ID result")
  const signal = signalFor(wallet)

  // Cheap local checks before calling World.
  if (result.environment !== config.world.environment) throw new HttpError(400, "Wrong World ID environment")
  if (result.action !== config.world.action) throw new HttpError(400, "Wrong World ID action")
  const response = result.responses?.[0]
  if (!response?.nullifier) throw new HttpError(400, "World ID result has no nullifier")
  if (response.signal_hash && BigInt(response.signal_hash) !== BigInt(hashSignal(signal))) {
    throw new HttpError(400, "Proof was made for a different wallet")
  }

  const res = await fetch(`https://developer.world.org/api/v4/verify/${config.world.rpId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(result),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.success !== true || (body.environment && body.environment !== config.world.environment)) {
    throw new HttpError(403, body.detail ?? body.code ?? "World ID verification failed")
  }

  // v4 nullifiers are decimal, v3 are hex: BigInt reads both, store as decimal.
  const nullifier = BigInt(response.nullifier).toString()
  const existing = humans.byNullifier(nullifier)
  if (existing) {
    // Same human, new burner (cleared browser, new phone): move them over. They get Arkiv gas again
    // so they can still open stalls, but never a second USDT gift, so rebinding can't farm money.
    if (existing.wallet === signal) return { verified: true, returning: true }
    humans.rebind(nullifier, signal)
    const dripTx = await dripGlm(signal)
    return { verified: true, returning: true, dripTx }
  }
  if (humans.byWallet(signal)) throw new HttpError(409, "This wallet already belongs to another human")

  humans.insert(nullifier, signal)
  const [giftTx, dripTx] = await Promise.all([giftUsdt(signal), dripGlm(signal)])
  humans.setTxs(nullifier, giftTx, dripTx)
  return { verified: true, returning: false, giftTx, dripTx }
}

function giftUsdt(wallet) {
  return whitechainQueue(async () => {
    const hash = await wc.wallet.writeContract({
      address: config.usdt,
      abi: erc20Abi,
      functionName: "transfer",
      args: [wallet, config.giftUsdt],
    })
    await wc.public.waitForTransactionReceipt({ hash })
    return hash
  })
}

function dripGlm(wallet) {
  return arkivQueue(async () => {
    const hash = await arkiv.wallet.sendTransaction({ to: wallet, value: config.dripGlm })
    await arkiv.public.waitForTransactionReceipt({ hash })
    return hash
  })
}
