---
name: verify
description: "Prove a change works before committing it. Use at the end of every task, and before saying anything is done."
---

# Verify

Prove the real thing works, not a proxy for it.

1. `bunx convex dev --once` pushes without errors, if `convex/` changed.
2. `bun run build` passes. Read the warnings too.
3. `bun run lint` has no errors in the files you touched.
4. For a backend change: call the function with `bunx convex run` and check the output against the contract in `docs/architecture.md`.
5. For a UI change: start `bun dev`, open the page, and look at it. Check the loading, empty and signed-out states. Check 390 px wide. Check dark mode.
6. For auth: sign up, sign out, sign in, save a place, open `/saved`.

Report what you ran and what you saw. If a step was skipped, say which and why.
