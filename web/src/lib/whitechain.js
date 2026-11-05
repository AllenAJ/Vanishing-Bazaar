// Buying signs two messages and sends no transaction: the relayer pays the gas.
import { createPublicClient, defineChain, http, parseSignature, parseUnits } from "viem"

export const whitechain = defineChain({
  id: 1874,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WhiteBIT Coin", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.whitechain.io"] } },
  blockExplorers: { default: { name: "Explorer", url: "https://explorer.testnet.whitechain.io" } },
})

const client = createPublicClient({ chain: whitechain, transport: http() })

const tokenAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "nonces", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
]

export const txUrl = (hash) => `${whitechain.blockExplorers.default.url}/tx/${hash}`

export async function usdtBalance(usdt, address) {
  return client.readContract({ address: usdt, abi: tokenAbi, functionName: "balanceOf", args: [address] })
}

/** Signs the USDT permit and the Bazaar order for one stall item. */
export async function signPurchase(account, { usdt, bazaar }, stall) {
  const price = parseUnits(stall.price, 6)
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 5 * 60)
  const nonce = await client.readContract({ address: usdt, abi: tokenAbi, functionName: "nonces", args: [account.address] })

  const permitSig = await account.signTypedData({
    // Verified against the token's live DOMAIN_SEPARATOR.
    domain: { name: "Tether USD", version: "1", chainId: whitechain.id, verifyingContract: usdt },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: { owner: account.address, spender: bazaar, value: price, nonce, deadline },
  })

  const order = { stallKey: stall.key, seller: stall.seller, buyer: account.address, price, deadline }
  const sig = await account.signTypedData({
    domain: { name: "VanishingBazaar", version: "1", chainId: whitechain.id, verifyingContract: bazaar },
    types: {
      Order: [
        { name: "stallKey", type: "bytes32" },
        { name: "seller", type: "address" },
        { name: "buyer", type: "address" },
        { name: "price", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Order",
    message: order,
  })

  const { v, r, s } = parseSignature(permitSig)
  return {
    order: { ...order, price: price.toString(), deadline: deadline.toString() },
    permit: { deadline: deadline.toString(), v: Number(v), r, s },
    sig,
  }
}
