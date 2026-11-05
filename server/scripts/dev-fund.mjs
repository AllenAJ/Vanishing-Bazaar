// Rehearsal helper: top up a test wallet with Arkiv gas (and optionally USDT) from the server key.
//   pnpm dev:fund <wallet> [usdt]
import { getAddress, parseUnits } from "viem"
import { arkiv, config, erc20Abi, wc } from "../src/config.mjs"

const [walletArg, usdtArg] = process.argv.slice(2)
const wallet = getAddress(walletArg)

const drip = await arkiv.wallet.sendTransaction({ to: wallet, value: config.dripGlm })
await arkiv.public.waitForTransactionReceipt({ hash: drip })
console.log("tGLM drip", drip)

if (usdtArg) {
  const hash = await wc.wallet.writeContract({
    address: config.usdt,
    abi: erc20Abi,
    functionName: "transfer",
    args: [wallet, parseUnits(usdtArg, 6)],
  })
  await wc.public.waitForTransactionReceipt({ hash })
  console.log(`${usdtArg} USDT`, hash)
}
