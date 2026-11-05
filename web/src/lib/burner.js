// A key that lives in this browser. The person never sees it, never funds it with gas,
// and never writes down a seed phrase: World ID is what ties it to them.
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

const KEY = "vb.burner"
const NAME = "vb.name"

function read(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode: the key only lives for this tab. Still works for a demo.
  }
}

let memoryKey = null

export function loadBurner() {
  let privateKey = read(KEY) ?? memoryKey
  if (!privateKey) {
    privateKey = generatePrivateKey()
    write(KEY, privateKey)
  }
  memoryKey = privateKey
  return privateKeyToAccount(privateKey)
}

export const loadName = () => read(NAME) ?? ""
export const saveName = (name) => write(NAME, name)
