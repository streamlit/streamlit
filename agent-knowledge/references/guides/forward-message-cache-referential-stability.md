---
status: stable
last_updated: 2026-02-10
---

# Overview

This guide documents the frontend `ForwardMsg` caching system used by Streamlit's WebSocket connection layer, with a focus on referential stability for cached protobuf payloads.

The implementation lives in:

- `frontend/connection/src/ForwardMessageCache.ts`
- `frontend/connection/src/ForwardMessageCacheInstrumentation.ts`
- `frontend/connection/src/ForwardMessagePayloadFreezer.ts`
- `frontend/connection/src/WebsocketConnection.tsx`

## Why this exists

Streamlit reruns often resend unchanged data by reference (`refHash`) instead of full payloads. Before this implementation, the frontend would decode the same cached bytes repeatedly, producing brand-new object graphs every time. This caused:

- avoidable CPU cost from redundant protobuf decode work
- avoidable GC pressure from repeated allocation of identical nested objects/arrays
- unstable object identity for unchanged payloads, which increased downstream React recalculation/churn

This caching design fixes those issues while preserving protobuf decode semantics and existing message behavior.

# Data Flow

## Message ingest path

1. `WebsocketConnection.handleMessage` decodes incoming bytes once via `ForwardMsg.decode(encodedMsg)`.
2. The decoded message and original bytes are passed to `ForwardMsgCache.processMessagePayload`.
3. `ForwardMsgCache` either:
   - returns the message directly (non-reference), or
   - resolves a `refHash` to a canonical cached payload and returns a delivery-specific wrapper.

## Canonical payload caching

For cacheable, non-`refHash` messages:

- Cache key: `msg.hash`
- Stored entry includes:
  - `decodedMsg` (canonical payload object graph)
  - `scriptRunCount` (age tracking)
  - `fragmentId` (fragment-aware expiration)

## `refHash` resolution semantics

For `msg.type === "refHash"`:

1. Lookup canonical payload by `msg.refHash`.
2. If missing, throw a cache-miss error (existing behavior).
3. Validate that reference message metadata exists.
4. Return a shallow wrapper via `createMessageWithMetadata(...)`:
   - shares canonical nested payload references (`delta`, `newSession`, etc.)
   - replaces only `metadata` with current-delivery metadata

This is the key structural-sharing mechanism: payload identity remains stable across repeated references, while delivery metadata stays accurate per message.

# Problems Solved

## 1) Redundant decode removal for cache hits

Before: `refHash` replay decoded cached bytes again for payload, and decoded reference bytes again for metadata extraction.

Now: payload is reused from cached decoded object; metadata comes directly from already-decoded `msg.metadata`.

## 2) Referential stability for unchanged payloads

Repeated `refHash` deliveries now share payload object references. This reduces identity churn for nested protobuf structures and helps avoid unnecessary React work in downstream layers.

## 3) Canonical payload immutability guardrails

Canonical payloads are deep-frozen at cache insertion time. This prevents accidental mutation of shared cached objects while preserving payload referential stability across `refHash` deliveries.

# Cache Eviction and Lifetime

Eviction remains aligned with the pre-existing run-count model:

- `incrementRunCount(maxMessageAge, fragmentIdsThisRun)` increments script age.
- Entries older than `maxMessageAge` are removed.
- Fragment reruns only evict entries belonging to the fragment IDs supplied for that run.

Decoded canonical payloads are evicted according to the same cache entry lifecycle.

# Instrumentation Design

`ForwardMsgCacheInstrumentation` is responsible only for counters:

- counters:
  - `cacheRefHits`
  - `cacheRefMisses`
  - `cachedMessages`
  - `payloadIdentityReused`
- no-op behavior when disabled

Canonical payload freezing is handled separately by:

- `freezeForwardMsgPayload(...)` in `ForwardMessagePayloadFreezer.ts`

`ForwardMsgCache` creates instrumentation via:

- `createForwardMsgCacheInstrumentation()` defaulting to `IS_DEV_ENV`
- optional explicit constructor override (`enableDevInstrumentation`) for tests

This keeps callsites simple and avoids scattering environment checks through cache logic.

# Key Implementation Decisions

## Preserve decode semantics

Canonical payload creation uses `ForwardMsg.decode(encodedMsg)` intentionally. While `fromObject(toObject(...))` can produce equivalent schema data, decode is kept to avoid representational differences.

## Metadata isolation without payload mutation

We do not mutate cached canonical payload metadata for `refHash` deliveries. Instead, we build a shallow wrapper with shared payload refs and delivery-specific metadata.

## Keep error behavior explicit

Cache misses for `refHash` remain hard errors. This preserves existing assumptions and provides immediate signals for protocol/cache coherence bugs.

# Testing Coverage

Primary tests are in `frontend/connection/src/ForwardMessageCache.test.ts` and validate:

- cacheability behavior and miss-path errors
- canonical payload identity reuse across repeated `refHash` deliveries
- metadata isolation (canonical metadata is not overwritten by references)
- instrumentation counters (enabled path)
- instrumentation no-op behavior (disabled path)
- existing expiration behavior, including fragment-aware eviction

# Operational Notes

- This cache is internal to the frontend connection layer and does not alter server protocol contracts.
- Benefits are strongest in rerun scenarios where backend emits many `refHash` messages.
- Development instrumentation counters are intended for diagnostics, not user-facing telemetry.
