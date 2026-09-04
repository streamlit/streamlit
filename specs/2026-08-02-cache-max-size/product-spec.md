---
author: lukasmasuch
created: 2026-08-02
---

# Memory-bounded caching for `st.cache_data`

## Summary

Today the only ways to bound a cache are `ttl` (time) and `max_entries` (count). Neither
bounds *memory*, so apps that cache differently-sized objects across many argument
combinations can slowly grow the cache until the process runs out of memory. This spec
proposes two complementary additions for `st.cache_data`: a per-function `max_size`
parameter for developers who want explicit control, and a process-wide default memory
budget (via config) that catches the far more common case of a developer who never set
any limit at all. Both evict least-recently-used entries by their serialized byte size —
which for `st.cache_data` is exact and cheap because entries are already stored as pickled
bytes. `st.cache_resource` is intentionally out of scope (see
[Why `st.cache_resource` is out of scope](#why-stcache_resource-is-out-of-scope)).

## Problem

`st.cache_data` and `st.cache_resource` are among the biggest contributors to memory
growth in long-running Streamlit apps. The existing controls are indirect proxies for the
thing developers actually care about — memory:

- `max_entries` bounds the *count* of entries, but says nothing about their size. If a
  cached function returns a 1 KB result for some inputs and a 2 GB dataframe for others,
  `max_entries=100` can mean anything from 100 KB to 200 GB.
- `ttl` bounds *age*, not size. A short `ttl` still lets a burst of large, distinct inputs
  blow past the memory budget before anything expires.
- With no parameters set (the overwhelmingly common case), the cache is **unbounded**:
  entries accumulate for every distinct argument combination and are never evicted, even
  if requested only once. A parameterized function driven by user input is effectively a
  slow memory leak.

**Requests:**

- [#2911](https://github.com/streamlit/streamlit/issues/2911) — Add option to limit
  `st.cache` size by memory footprint rather than total number of entries.
- [#6602](https://github.com/streamlit/streamlit/issues/6602) — Long-lived session support
  (memory reduction): steadily increasing memory in long-running apps, which explicitly
  lists #2911 among the issues a memory-bounded cache would help address.

**Use cases:**

- **Enterprise dashboards over large data**: A `@st.cache_data` function keyed on user
  filters caches dataframes of wildly varying size. The developer wants to say "use at
  most 2 GB for this cache," not guess a `max_entries` value.
- **Apps that crash instead of degrading**: A developer adds `@st.cache_data` to speed up
  their app, and weeks later it starts OOM-crashing in production with a cryptic error
  (segfault / OOM kill). They never set `max_entries` because they didn't know they
  needed to. They would strongly prefer the app to evict old entries and keep running.
- **Community Cloud / SiS with fixed memory**: Platforms run apps under a hard memory
  limit. A runaway cache is a leading cause of deployment failures, and the failure mode
  today is opaque.

### Two distinct personas

The historical discussion on this problem surfaced two different users, and a good
solution has to serve both:

1. **The explicit developer** knows their deployment and wants an exact, per-function
   memory cap. `ttl`/`max_entries` are too imprecise for them. → solved by a `max_size`
   **parameter**.
2. **The "forgot to set anything" developer** — the majority — never configures caching
   and only discovers the problem when the app crashes. A new *optional* parameter does
   **not** help them, because they won't set it either. → solved only by a **safe default**
   that is active out of the box.

Shipping just the parameter would repeat the `max_entries` mistake: it helps power users
but leaves the common OOM case unsolved. This spec therefore proposes both.

## Proposal

### Part 1 — `max_size` parameter for `st.cache_data`

```python
st.cache_data(
    ...,
    max_size: int | str | None = None,
)
```

| Parameter  | Type                 | Default | Description                                                                                                                                 |
|------------|----------------------|---------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `max_size` | `int`, `str`, `None` | `None`  | Maximum total serialized size of the cache. `None` = no per-function cap (the process-wide `server.maxCachedDataSize` budget may still apply). |

`max_size` accepts either an integer number of **bytes**, or a human-readable **string**
with a unit (`"500MB"`, `"1.5GB"`, `"200KB"`) — mirroring how `ttl` already accepts either
a number of seconds or a string like `"1h30m"`. When the cache's total serialized size
would exceed `max_size`, the least-recently-used entries are evicted (same LRU order as
`max_entries`) until it fits.

```python
import streamlit as st


# Cap this function's cache at 500 MB of cached data.
@st.cache_data(max_size="500MB")
def load_filtered_data(user_filter: str) -> pd.DataFrame:
    return expensive_query(user_filter)
```

`max_size` composes with the existing parameters — every configured limit is enforced
independently, and whichever is hit first triggers eviction:

```python
# Evict when older than 1 hour OR when the cache exceeds 1 GB, whichever comes first.
@st.cache_data(ttl="1h", max_size="1GB")
def fetch_report(report_id: str) -> pd.DataFrame: ...


# max_size and max_entries can both apply (belt and suspenders).
@st.cache_data(max_entries=100, max_size="2GB")
def transform(key: str) -> pd.DataFrame: ...
```

**What "size" means:** For `st.cache_data`, entries are stored as **pickled bytes**, so
`max_size` bounds the *total serialized size* of the cache. This is an exact, cheap,
monotonic measure (Streamlit already records `len(pickled_bytes)` per entry for the
`cache_memory_bytes` metric). It is **not** the same as live heap usage or process RSS —
an unpickled dataframe occupies more memory than its pickle — so `max_size` is a
predictable proxy for cache memory, not a hard cap on the app's total RAM. This trade-off
is called out explicitly in the docstring.

### Part 2 — a safe default via a global memory budget (config)

To help the majority who never set anything, add a process-wide default budget for the
combined serialized size of **all** `st.cache_data` in-memory caches:

```toml
# .streamlit/config.toml
[server]
maxCachedDataSize = "1gb"   # applies across all @st.cache_data functions
```

When the combined size of all `st.cache_data` caches exceeds this budget, Streamlit evicts
globally least-recently-used entries (across functions) until it fits. A per-function
`max_size` is enforced *in addition to* the global budget (the function cap can only make a
cache smaller, never exceed the global budget).

Because eviction only ever drops recomputable cached data, an app that stays under the
budget sees **no behavior change**, and an app that would previously OOM instead degrades
gracefully (slower, because of recomputation) while staying alive. This is the core reason
a default here is far safer than, say, a default `ttl`.

Choosing the **default value** for `maxCachedDataSize` is the main open decision; options
and a recommendation are in
[Default-value options](#default-value-options-for-the-global-budget) below.

### Behavior

- **No explicit `max_size`** → the cache is bounded only by the global budget (and by
  `max_entries`/`ttl` if set). Unbounded-by-anything behavior — exactly as today — requires
  *both* `max_size=None` and a disabled global budget (`0`).
- **Eviction order**: least-recently-used first, identical to `max_entries` (recency is
  refreshed on both read and write).
- **A single entry larger than the limit**: A write is never rejected. If the entry alone
  exceeds `max_size` (or the global budget), it is still stored and the limit is temporarily
  exceeded — eviction never drops the entry currently being written. Streamlit logs a
  warning once per cache when a stored entry exceeds the configured `max_size`, so the
  developer learns their cap is smaller than a single result.
- **Global eviction can empty a function's cache**: The per-function `max_size` keeps at
  least one entry per function, but the process-wide budget evicts the globally
  least-recently-used entries across *all* functions and can therefore shrink an individual
  function's cache to zero (each evicted entry is simply recomputed as a normal miss on the
  next access). The only entry it never evicts is the one a write is currently inserting.
- **`max_size` + `max_entries` together**: both are enforced; a write evicts until *both*
  constraints are satisfied.
- **Interaction with `persist="disk"`**: `max_size` bounds the in-memory layer (the LRU
  front cache), which is where the memory-pressure problem lives. The on-disk layer is not
  bounded by `max_size` (disk isn't the scarce resource); this matches how `max_entries`
  and `ttl` already behave relative to the in-memory wrapper.
- **Interaction with `refresh_mode="background"`**: stale-but-retained entries (kept up to
  `2 × ttl`, see
  [background refresh spec](../2026-04-08-cache-background-refresh/product-spec.md)) count
  toward `max_size` like any other entry and participate in the same LRU eviction.
- **Interaction with `scope="session"`**: The global budget is process-wide. Session-scoped
  entries (`@st.cache_data(scope="session")`) live in the same process and compete in the
  same global LRU as every other session's entries and all `scope="global"` caches. This is
  intentional — the budget bounds *total* process memory, so under pressure a busy session
  can evict another session's least-recently-used entries. The per-function `max_size` still
  applies independently within each function's cache regardless of scope.
- **Validation**: A `max_size` that parses to `<= 0`, or a string with an unrecognized
  unit, raises `StreamlitAPIException` at decoration time (fail fast, fail helpfully).

### Default-value options for the global budget

The parameter (Part 1) is uncontroversial and low-risk. The judgment call is what
`maxCachedDataSize` should default to. Ordered from safest-but-least-effective to
most-protective:

**Option A — default off (`0` / unlimited), opt-in only.**
- Pros: Zero behavior change; nothing can regress.
- Cons: Doesn't solve the majority problem (developers who never set anything still OOM).
  Effectively ships only Part 1.

**Option B — generous fixed default (e.g. `"1gb"` of serialized data). ✅ RECOMMENDED**
- Pros: Normal apps (well under 1 GB of *serialized* cache) see no change; runaway caches
  evict LRU instead of crashing. Simple, predictable, no new dependency, easy to document
  and override. Directly addresses the crash-instead-of-degrade use case.
- Cons: It's a behavior change — an app that legitimately relied on caching >1 GB of
  serialized data now recomputes evicted entries (slower, but not broken). The value is a
  heuristic, not tailored to the machine.

**Option C — fraction of available memory (e.g. 50% of total RAM).**
- Pros: Adapts to the deployment; a big machine gets a big budget.
- Cons: Reliable total-memory detection is platform-specific. `psutil` is **not** a current
  Streamlit dependency, so this needs either a new dependency (undesirable) or a
  best-effort, dependency-free probe (cgroup limits / `/proc/meminfo` / `os.sysconf`) with
  a fixed fallback — and container/SiS memory limits are notoriously easy to misread.

**Option D — warn-only default (no eviction).**
- Log a one-time warning when any `st.cache_data` cache grows past a threshold without a
  `max_size`, but never evict automatically.
- Pros: Non-breaking; nudges developers toward setting a limit; leaves them in full
  control.
- Cons: Doesn't actually prevent the crash — a warning in logs is easy to miss before the
  OOM. Best used *in combination* with A/B, not on its own.

**Recommendation:** Ship **Part 1 (`max_size`) unconditionally**, and adopt **Option B**
for the default global budget, combined with the Option D one-time warning (so developers
who hit the budget are told why entries are being evicted and how to tune it). Start with a
conservative, clearly-documented fixed default and revisit the exact number based on
telemetry and G2K feedback. This gives explicit developers precise control while giving the
silent majority a safety net that degrades instead of crashes.

### Technical feasibility (validated against the current implementation)

This section records what the current code makes easy vs. hard — the primary question the
proposal hinges on. Implementation details are in [`tech-spec.md`](./tech-spec.md).

- **`st.cache_data` — cheap and exact.** Entries live as `bytes` in a `TTLCache[str, bytes]`
  inside `InMemoryCacheStorageWrapper`. Per-entry size is just `len(bytes)` — already
  computed for the `cache_memory_bytes` metric. The internal `TTLCache`
  ([#16014](https://github.com/streamlit/streamlit/pull/16014)) currently does count-based
  eviction only; adding byte-based eviction means giving it an optional size function and a
  running byte total (the same capability `cachetools.Cache` had before we replaced it) —
  fully under our control, no third-party changes, no new dependency.
- **Global budget — feasible, but new cross-cache accounting.** Each `DataCache` today owns
  an independent `TTLCache`; there is no coordinator across functions. A true global budget
  needs a process-wide byte total plus a global LRU ordering to choose a victim across
  caches. This is the main new complexity and is designed in the tech spec.
- **`st.cache_resource` — expensive and unreliable.** See
  [Why `st.cache_resource` is out of scope](#why-stcache_resource-is-out-of-scope).

## Why `st.cache_resource` is out of scope

`st.cache_resource` stores arbitrary Python objects (DB connections, ML models), not
pickled bytes, so there is no cheap size measurement. Streamlit's only tool is
`safe_sizeof` (vendored `pympler.asizeof`), a recursive object-graph traversal that is:

- **Slow** — already gated behind `server.enableExpensiveMemoryStats` precisely because it
  can be very expensive for large objects, and running it on every cache write would be a
  significant per-call cost.
- **Unreliable** — it returns `0` for objects it can't size (e.g. things that don't support
  weak references) and can't cleanly account for shared references between cached objects.

Byte-based eviction here would be both costly and inaccurate, and evicting a resource that
apps treat as a singleton (a connection pool, a loaded model) is riskier than dropping a
recomputable data blob. `st.cache_resource` therefore keeps `max_entries`/`ttl` only. This
matches the original spec's conclusion and can be revisited if there's clear demand.

## Out of scope (future work)

- **Byte-based `max_size` for `st.cache_resource`** — needs a cheap, reliable sizing story
  first (see above).
- **`getsizeof=` callable** — let advanced users plug in their own size function (e.g.
  `pympler.asizeof`) so `max_size` could work for `cache_resource`. Powerful but niche;
  revisit if requested.
- **`evict=` callable** — a fully custom eviction predicate (e.g. "keep 500 MB of system
  memory free" via `psutil`). Most flexible, most complex, and risks exposing cross-session
  cache contents; deferred.
- **RSS/heap-accurate accounting** — bounding the *actual* process memory rather than
  serialized cache size. Would require live-memory measurement Streamlit doesn't have today.
- **Per-function default (auto-dividing a global budget across functions)** — rejected in
  favor of a single global budget, which is simpler to reason about and doesn't need
  re-tuning when functions are added.

## Checklist

| Item                       | ✅ or comment                                                                                                                                                              |
|----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Works on SiS, Cloud, etc?  | ✅ Pure Python, no new dependency. SiS may enforce its own per-entry/account cache limits; the `max_size` parameter can be ignored there if it conflicts (like `max_entries`). Confirm with SiS before enabling a non-zero global default there. |
| No breaking API changes    | ✅ `max_size` is a new optional parameter defaulting to `None`. ⚠️ A non-zero global default (Option B/C) is a behavior change — but only evicts recomputable data, never errors. Option A avoids even that. |
| No new dependencies        | ✅ Byte sizes come from `len(pickled_bytes)`. Option C (memory-fraction default) is the only variant that would need memory detection; the recommendation (Option B) avoids it. |
| Metrics collected          | ✅ `cache_memory_bytes` already reports per-cache serialized size. `max_size` adoption and global-budget eviction counts need explicit instrumentation (tech spec).         |
| Any security/legal impact? | ✅ None for `max_size`. A future `evict=`/`getsizeof=` callable could expose cache contents cross-session — that's why it's out of scope.                                    |
| Any docs changes needed?   | ✅ Document `max_size` on `st.cache_data`, the `maxCachedDataSize` config option, the "serialized size, not RSS" caveat, and that `st.cache_resource` is unaffected.        |
