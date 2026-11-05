import { SERVER_URL } from "./env.js"

async function call(path, body) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`)
  return json
}

export const api = {
  config: () => call("/api/config"),
  me: (wallet) => call(`/api/me/${wallet}`),
  rpContext: () => call("/api/world/rp-context", {}),
  verify: (result, wallet) => call("/api/world/verify", { result, wallet }),
  buy: (signed) => call("/api/relay/buy", signed),
}
