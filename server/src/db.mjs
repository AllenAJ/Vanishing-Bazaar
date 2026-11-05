// Off-Arkiv state: who is a verified human, and relay rate limits.
// Kept off Arkiv on purpose: nullifiers would link a person across their wallets if published.
import { DatabaseSync } from "node:sqlite"

const db = new DatabaseSync(process.env.DB_PATH ?? new URL("../bazaar.db", import.meta.url).pathname)

db.exec(`
  CREATE TABLE IF NOT EXISTS humans (
    nullifier   TEXT PRIMARY KEY,           -- decimal, unique per human for action "open-stall"
    wallet      TEXT NOT NULL UNIQUE,       -- lowercase burner address currently bound to this human
    gift_tx     TEXT,
    drip_tx     TEXT,
    created_at  INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS relays (
    wallet  TEXT NOT NULL,
    at      INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS relays_wallet_at ON relays (wallet, at);
`)

export const humans = {
  byNullifier: (nullifier) => db.prepare("SELECT * FROM humans WHERE nullifier = ?").get(nullifier),
  byWallet: (wallet) => db.prepare("SELECT * FROM humans WHERE wallet = ?").get(wallet.toLowerCase()),
  insert: (nullifier, wallet) =>
    db.prepare("INSERT INTO humans (nullifier, wallet, created_at) VALUES (?, ?, ?)").run(
      nullifier,
      wallet.toLowerCase(),
      Date.now(),
    ),
  rebind: (nullifier, wallet) =>
    db.prepare("UPDATE humans SET wallet = ? WHERE nullifier = ?").run(wallet.toLowerCase(), nullifier),
  setTxs: (nullifier, giftTx, dripTx) =>
    db.prepare("UPDATE humans SET gift_tx = ?, drip_tx = ? WHERE nullifier = ?").run(giftTx, dripTx, nullifier),
}

export const relays = {
  countSince: (wallet, since) =>
    db.prepare("SELECT COUNT(*) AS n FROM relays WHERE wallet = ? AND at > ?").get(wallet.toLowerCase(), since).n,
  record: (wallet) => db.prepare("INSERT INTO relays (wallet, at) VALUES (?, ?)").run(wallet.toLowerCase(), Date.now()),
}
