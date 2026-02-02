# Provably Fair

Pullz.gg uses a provably fair system for case outcomes. The server maintains a **server seed**, **server seed hash**, **client seed**, and **nonce**.

When opening a case, the roll is computed using an HMAC-SHA256 hash of:

```
clientSeed:nonce:boxId
```

The roll value selects a prize based on weighted odds. Players can view or rotate their provably fair state (server seed hash, client seed, nonce) through the provably fair endpoints.

If you need a specific verification flow or UI steps, those are currently not specified.
