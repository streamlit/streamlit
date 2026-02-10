---
status: stable
last_updated: 2026-02-09
---

# Overview

This guide documents the render-tree referential-stability work that complements the connection-layer `ForwardMsg` payload cache.

Phase 1 stabilized decoded protobuf payload identity in the websocket cache. This phase (render-tree structural sharing) ensures unchanged deltas also preserve `AppNode` identity so React work is reduced end-to-end.

Primary implementation files:

- `frontend/app/src/App.tsx`
- `frontend/lib/src/render-tree/AppRoot.ts`
- `frontend/lib/src/render-tree/AppNode.interface.ts`
- `frontend/lib/src/render-tree/ElementNode.ts`
- `frontend/lib/src/render-tree/BlockNode.ts`
- `frontend/lib/src/render-tree/NodeTouchTracking.ts`
- `frontend/lib/src/render-tree/visitors/SetNodeByDeltaPathVisitor.ts`
- `frontend/lib/src/render-tree/visitors/ClearStaleNodeVisitor.ts`
- `frontend/lib/src/components/core/Block/utils.ts`

# Problems This Solves

Before this phase, unchanged payloads could still churn render-tree identity:

- each delta application rebuilt touched ancestors, even if the target payload was unchanged
- `ElementNode`/`BlockNode` identity churn invalidated node-local caches (for example, quiver/vega derived data)
- stale detection depended mainly on `scriptRunId` mutation, which forced replacement-like behavior to mark nodes as current

Result: phase 1 decode caching reduced object churn in transport, but unchanged render-tree branches could still be recreated during reruns.

# Design Summary

## 1) Message hash is threaded into render-tree updates

`App` now passes `ForwardMsg.hash` into `AppRoot.applyDelta(...)`. This provides a stable identity signal at the tree mutation boundary.

## 2) Hash-aware short-circuit in `AppRoot`

For `newElement`, `addBlock`, and `newTransient`:

- inspect existing node at `deltaPath`
- if existing node type matches and `sourceMessageHash` matches incoming `messageHash`, treat delta as unchanged
- no-op the replacement and keep existing node instances

This is always enabled when a message hash is present.

## 3) Source hash is stored on render-tree nodes

`sourceMessageHash?: string` is now part of `AppNode` and is carried by `ElementNode` and `BlockNode` so future deltas can make reconciliation decisions.

## 4) Visitor-level no-op fast-path

`SetNodeByDeltaPathVisitor` now returns the original block node when a child replacement resolves to the same instance. This avoids rebuilding untouched ancestors and preserves structural sharing.

## 5) Touch-aware staleness tracking

Because unchanged nodes may now intentionally keep old `scriptRunId`, staleness logic is decoupled from strict run-id equality:

- `NodeTouchTracking` tracks nodes touched in the current run via `WeakMap<AppNode, scriptRunId>`
- `AppRoot.applyDelta` marks nodes along the delta path as touched
- `ClearStaleNodeVisitor` and `isElementStale` treat touched nodes as current-run fresh

This preserves stale-pruning correctness while allowing identity stability.

# Technical Choices and Rationale

## Why use `ForwardMsg.hash`?

- already available from backend protocol
- stable signal for payload identity in this flow
- avoids expensive deep equality checks on protobuf object graphs

## Why `WeakMap` for touched tracking?

- touch markers should not extend node lifetime
- nodes are immutable and frequently replaced; weak references avoid manual cleanup bookkeeping

## Why keep staleness checks in both visitor and component utility paths?

- stale cleanup (`clearStaleNodes`) and runtime UI stale styling/disablement (`isElementStale`) are separate paths
- both need the same touched-node semantics to avoid regressions during reruns and fragment runs

# Validation Coverage

Key regression coverage added:

- unchanged hash-matching deltas preserve leaf + ancestor identity
- touched unchanged nodes survive stale cleanup in subsequent run
- visitor fast-path returns original block when child instance is unchanged
- stale checks do not mark touched nodes as stale during current run

Primary test files:

- `frontend/lib/src/render-tree/AppRoot.test.ts`
- `frontend/lib/src/render-tree/visitors/SetNodeByDeltaPathVisitor.test.ts`
- `frontend/lib/src/components/core/Block/utils.test.ts`

# Related Documentation

- Connection-layer phase 1 guide:
  - `agent-knowledge/references/guides/forward-message-cache-referential-stability.md`
- Render-tree implementation references:
  - `frontend/lib/src/render-tree/AppRoot.ts`
  - `frontend/lib/src/render-tree/visitors/SetNodeByDeltaPathVisitor.ts`
  - `frontend/lib/src/render-tree/visitors/ClearStaleNodeVisitor.ts`
  - `frontend/lib/src/components/core/Block/utils.ts`
