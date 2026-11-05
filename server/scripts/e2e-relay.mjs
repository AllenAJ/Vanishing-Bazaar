// End-to-end gasless purchase against the running server (pnpm start).
// Plays a fresh buyer burner: the server opens a 3-minute test stall on Arkiv, the buyer signs
// an order + USDT permit (no gas), and the relayer settles it on Whitechain.
// World ID is stood in for by marking the test buyer verified directly in the local DB.
import { ExpirationTime } from "@arkiv-network/sdk"
import { addr, dec } from "@arkiv-network/sdk/schema"
import { formatUnits, parseSignature } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { account, arkiv, config, erc20Abi, wc } from "../src/config.mjs"
import { humans } from "../src/db.mjs"
import { Stall } from "../src/schemas.mjs"

const SERVER = process.env.SERVER_URL ?? `http://localhost:${config.port}`
const PRICE = 1_500_000n // 1.50 USDT

const buyer = privateKeyToAccount(generatePrivateKey())
humans.insert(`e2e-${Date.now()}`, buyer.address)
console.log("buyer burner", buyer.address)

const serverUsdt = await wc.public.readContract({ address: config.usdt, abi: erc20Abi, functionName: "balanceOf", args: [account.address] })
console.log("server USDT", formatUnits(serverUsdt, 6))
if (serverUsdt >= PRICE) {
  const hash = await wc.wallet.writeContract({ address: config.usdt, abi: erc20Abi, functionName: "transfer", args: [buyer.address, PRICE] })
  await wc.public.waitForTransactionReceipt({ hash })
  console.log("funded buyer with 1.50 USDT", hash)
} else {
  console.log("server has no USDT yet: expect the payment to be rejected for balance")
}

const { entityKey: stallKey } = await arkiv.wallet.createEntity(
  Stall,
  { market: config.market, seller: addr(account.address), category: "test", price: dec("1.50"), title: "E2E chai", emoji: "☕" },
  { expiration: ExpirationTime.fromMinutes(3) },
)
console.log("stall", stallKey)

const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
const nonce = await wc.public.readContract({
  address: config.usdt,
  abi: [{ type: "function", name: "nonces", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }],
  functionName: "nonces",
  args: [buyer.address],
})
const permitSig = await buyer.signTypedData({
  domain: { name: "Tether USD", version: "1", chainId: 1874, verifyingContract: config.usdt },
  types: { Permit: [
    { name: "owner", type: "address" }, { name: "spender", type: "address" }, { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" },
  ] },
  primaryType: "Permit",
  message: { owner: buyer.address, spender: config.bazaar, value: PRICE, nonce, deadline },
})
const order = { stallKey, seller: account.address, buyer: buyer.address, price: PRICE, deadline }
const sig = await buyer.signTypedData({
  domain: { name: "VanishingBazaar", version: "1", chainId: 1874, verifyingContract: config.bazaar },
  types: { Order: [
    { name: "stallKey", type: "bytes32" }, { name: "seller", type: "address" }, { name: "buyer", type: "address" },
    { name: "price", type: "uint256" }, { name: "deadline", type: "uint256" },
  ] },
  primaryType: "Order",
  message: order,
})
const { v, r, s } = parseSignature(permitSig)

const t0 = Date.now()
const res = await fetch(`${SERVER}/api/relay/buy`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    order: { ...order, price: PRICE.toString(), deadline: deadline.toString() },
    permit: { deadline: deadline.toString(), v: Number(v), r, s },
    sig,
  }),
})
console.log(`relay -> ${res.status} in ${Date.now() - t0} ms`, await res.json())
const buyerWbt = await wc.public.getBalance({ address: buyer.address })
console.log("buyer WBT spent on gas:", buyerWbt.toString(), "(always 0: the buyer never paid gas)")
