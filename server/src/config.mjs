// Environment, chains and clients. Everything secret comes from ../.env.
import { createPublicClient as createArkivPublicClient, createWalletClient as createArkivWalletClient } from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { createPublicClient, createWalletClient, defineChain, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} in .env`)
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  market: process.env.MARKET ?? "ethglobal-mumbai",
  bazaar: required("BAZAAR_ADDRESS"),
  usdt: required("WHITECHAIN_USDT"),
  world: {
    appId: required("WORLD_APP_ID"),
    rpId: required("WORLD_RP_ID"),
    signingKey: required("WORLD_SIGNING_KEY"),
    environment: process.env.WORLD_ENVIRONMENT ?? "staging",
    action: "open-stall",
    // New app, so v4 proofs only: accepting v3 too would need both nullifier kinds tracked.
    allowLegacyProofs: process.env.WORLD_ALLOW_LEGACY === "true",
  },
  // One-time welcome per verified human.
  giftUsdt: 5_000_000n, // 5 USDT, so a new buyer can shop straight away
  dripGlm: 50_000_000_000_000_000n, // 0.05 tGLM, enough for a seller's own Arkiv writes
  maxRelaysPerHour: 20,
}

export const whitechain = defineChain({
  id: 1874,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WhiteBIT Coin", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: [required("WHITECHAIN_RPC")] } },
  blockExplorers: { default: { name: "Whitechain Explorer", url: "https://explorer.testnet.whitechain.io" } },
})

export const account = privateKeyToAccount(required("SERVER_PRIVATE_KEY"))

export const wc = {
  public: createPublicClient({ chain: whitechain, transport: http() }),
  wallet: createWalletClient({ chain: whitechain, transport: http(), account }),
}

const arkivChain = rabdi({ accessKey: required("ARKIV_ACCESS_KEY") })
export const arkiv = {
  chain: arkivChain,
  public: createArkivPublicClient({ chain: arkivChain, transport: http() }),
  wallet: createArkivWalletClient({ chain: arkivChain, transport: http(), account }),
}

/** Runs async jobs one at a time, so the server key never races itself for a nonce. */
export function serialQueue() {
  let tail = Promise.resolve()
  return (job) => {
    const run = tail.then(job, job)
    tail = run.catch(() => {})
    return run
  }
}
export const whitechainQueue = serialQueue()
export const arkivQueue = serialQueue()

export const erc20Abi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
]

export const bazaarAbi = [
  {
    type: "function",
    name: "buy",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "stallKey", type: "bytes32" },
          { name: "seller", type: "address" },
          { name: "buyer", type: "address" },
          { name: "price", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        name: "permit",
        type: "tuple",
        components: [
          { name: "deadline", type: "uint256" },
          { name: "v", type: "uint8" },
          { name: "r", type: "bytes32" },
          { name: "s", type: "bytes32" },
        ],
      },
      { name: "buyerSig", type: "bytes" },
    ],
    outputs: [],
  },
  { type: "error", name: "OrderExpired", inputs: [] },
  { type: "error", name: "OrderAlreadyFilled", inputs: [] },
  { type: "error", name: "BadSignature", inputs: [] },
  { type: "error", name: "ZeroPrice", inputs: [] },
]
