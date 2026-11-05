import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  // The Arkiv schemas live in ../server/src/schemas.mjs and are shared with the server.
  // dedupe makes their SDK import resolve to this app's copy.
  resolve: { dedupe: ["@arkiv-network/sdk", "viem"] },
  server: { fs: { allow: [".."] } },
})
