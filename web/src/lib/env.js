// The server runs next to the dev server, so phones on the same Wi-Fi reach it by the same host.
export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? `${location.protocol}//${location.hostname}:8787`

// Arkiv's public endpoint is heavily rate limited, so the app uses an access key.
// It only buys rate limit, not write access, but it is visible in the bundle: testnet trade-off.
export const ARKIV_ACCESS_KEY = import.meta.env.VITE_ARKIV_ACCESS_KEY ?? ""

export const BLOCK_SECONDS = 2
