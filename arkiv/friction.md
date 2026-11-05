# Arkiv friction log

Written as we hit things during ETHGlobal Mumbai, Nov 5 to 7, 2026.

## 1. Concurrent writes from one key fail with an opaque error
- **What we did:** two `createEntity` calls at the same time from the same account (two seed scripts in parallel).
- **What we expected:** both land, or a clear "nonce already used / replacement underpriced" error.
- **What happened:** one failed with `EntityMutationError: Transaction failed: Execution error without revert data`, caused by `ContractFunctionExecutionError: Missing or invalid parameters`. Nothing pointed at the nonce.
- **Reproduce:** run two `createEntity` calls concurrently with the same wallet client.
- **What we did about it:** our server queues every write from its key (`serialQueue` in `server/src/config.mjs`).
- **Suggestion:** have the SDK manage nonces per account, or map this RPC error to a "nonce conflict" message.

## 2. The error message includes the access key
- The error's `URL:` line prints the full RPC URL, and the access key is part of the path (`.../ark_live_...`). Anyone who pastes an error into Discord or a GitHub issue leaks their key.
- **Suggestion:** redact the key in error messages, or send it as a header instead of a path segment.

## 3. No event when an entity expires
- Expiry is the core of our app, but `watchEntityEvents` has no expired event. The booth screen has to compute each stall's burn from `$expiresAt` and the 2-second block time.
- **Suggestion:** an `onEntityExpired` event, or an "expiring within N blocks" subscription.

## 4. `$createdAt` can't be sorted on
- We want "latest sales first" from the node. We select `$createdAt` and sort in the browser instead.
