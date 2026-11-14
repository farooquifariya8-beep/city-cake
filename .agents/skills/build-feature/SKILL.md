---
name: build-feature
description: "Build a new page, flow or Convex function from its data shape to its finished states. Use for any new behaviour in the app."
---

# Build a feature

## 1. Name the data shape

Write down what the feature reads and writes, as Convex validators or a `PlaceCard`-style return type. If it needs a new function, add a row to the contract table in `docs/architecture.md` before writing it. Reuse `convex/lib/categories.ts` and `convex/lib/cities.ts`. Never copy their contents.

## 2. Backend first

- Put pure logic in `convex/lib/` with no Convex imports, so it can be read and tested alone.
- Queries read, mutations write, actions call the outside world. An action that must store data calls an internal mutation.
- Check auth with `getAuthUserId(ctx)`. Throw `NOT_SIGNED_IN` when a write needs an account.
- Push with `bunx convex dev --once`. Call the function with `bunx convex run` and look at the output.

## 3. Then the UI

- Server component for the page shell. A client component only where there is state, a map or a Convex hook.
- Use `useQuery` from `convex/react`. `undefined` means loading. Design that state, don't leave it blank.
- Build all four states: loading (skeletons shaped like the content), empty (says what to do next), error, and signed out where it applies.
- Follow `docs/design.md`. Category colour comes from `lib/category-style.ts`.

## 4. Prove it

Run the **verify** skill.
