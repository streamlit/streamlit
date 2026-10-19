---
author: lukasmasuch
created: 2026-08-02
---

# Memory-bounded caching for `st.cache_data`

## Summary

Today the only ways to bound a cache are `ttl` (time) and `max_entries` (count). Neither
bounds *memory*, so apps that cache differently-sized objects across many argument
combinations can slowly grow the cache until the process runs out of memory. V1 adds two
complementary controls for `st.cache_data`: a per-function `max_size` parameter and an
opt-in process-wide memory budget via `server.maxCacheDataSize`. The config option is unset
by default (internally `None`), so upgrading does not impose a new global cache limit on
existing apps. Setting a 4 GB global default is a proposed follow-up after we have more
usage and compatibility evidence. When enabled, both controls bound the in-memory cache
(`persist="disk"` storage stays unbounded) and evict least-recently-used entries by their
serialized byte size — which for `st.cache_data` is exact and cheap because entries are
already stored as pickled bytes. `st.cache_resource` is intentionally out of scope (see
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

The historical discussion on this problem surfaced two different users, and the eventual
solution should serve both:

1. **The explicit developer** knows their deployment and wants an exact, per-function
   memory cap. `ttl`/`max_entries` are too imprecise for them. → solved by a `max_size`
   **parameter**.
2. **The "forgot to set anything" developer** — the majority — never configures caching
   and only discovers the problem when the app crashes. A new *optional* parameter or
   config does **not** help them, because they will not set it. → fully addressed only by a
   **safe default** that is active out of the box.

V1 solves the explicit-control use case and gives operators an opt-in global safety net.
It intentionally leaves the automatic safety net disabled: silently evicting cached data
could slow or disrupt existing apps that rely on large caches, and we do not yet have
enough evidence to choose a safe default. A separate follow-up can enable a proposed 4 GB
default after reviewing cache-size telemetry, opt-in eviction data, and customer feedback.

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
| `max_size` | `int`, `str`, `None` | `None`  | Maximum total serialized size of this function's in-memory cache. `None` = no per-function cap (an explicitly configured process-wide `server.maxCacheDataSize` budget may still apply). One entry larger than the cap is still stored; see [Behavior](#behavior). |

`max_size` accepts either an integer number of **bytes**, or a human-readable **string**
with a unit (`"500MB"`, `"1.5GB"`, `"200KB"`) — mirroring how `ttl` already accepts either
a number of seconds or a string like `"1h30m"`. Units are case-insensitive and binary:
`"1KB"` is 1024 bytes, and `KiB`/`MiB`/`GiB`/`TiB` are accepted as aliases. When the cache's
total serialized size would exceed `max_size`, the least-recently-used entries are evicted
(same LRU order as `max_entries`) until it fits. A single result larger than `max_size` is
still cached, and Streamlit logs a warning (see [Behavior](#behavior)).

```python
import streamlit as st


# Cap this function's in-memory cache at 500 MB of cached data.
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


# Cap both the entry count and the total size.
@st.cache_data(max_entries=100, max_size="2GB")
def transform(key: str) -> pd.DataFrame: ...
```

**What "size" means:** For `st.cache_data`, entries are stored as **pickled bytes**, so
`max_size` bounds the *total serialized size* of the cache. `len(pickled_bytes)` is exact
and cheap (the `cache_memory_bytes` metric already sums those lengths), but it is **not**
the same as live heap usage or process RSS — an unpickled dataframe occupies more memory
than its pickle — so `max_size` is a predictable proxy for cache memory, not a hard cap on
the app's total RAM. This trade-off is called out explicitly in the docstring.

**Unit options for a bare number.** The unit of an unsuffixed `max_size` is a lasting public
choice, so the alternatives are recorded here:

**Option 1 — `int` in bytes, or a unit string. ✅ RECOMMENDED**
- Pros: Follows `ttl` (a number is the base unit, a string carries the unit). Bytes are what
  `len(pickled_bytes)` measures, so a computed byte count can be passed directly.
- Cons: `max_size=500` means 500 bytes: the cache keeps one entry and logs the oversized-entry
  warning, and a reader could mistake the number for an entry count. Megabyte-based size
  options (`server.maxUploadSize`, `server.maxMessageSize`, `max_upload_size` on
  `st.file_uploader` / `st.chat_input`) read differently.

**Option 2 — unit strings only (reject `int`).**
- Pros: No ambiguous numbers.
- Cons: Breaks with the `ttl` pattern and forces formatting a computed byte count as a string.

**Option 3 — `int` in megabytes.**
- Pros: Matches `server.maxUploadSize` and `max_upload_size`.
- Cons: Hides the unit at the call site, cannot express sub-megabyte caps, and differs from
  `ttl`.

With Option 1, the docstring states the byte unit up front, and the oversized-entry warning
catches `max_size=500`-style mistakes on the first write.

### Part 2 — an opt-in global memory budget (v1 config)

Add a process-wide budget for the combined serialized size of **all** `st.cache_data`
in-memory caches. The option is unset by default (internally `None`), which disables global
enforcement and preserves existing behavior. Operators can opt in explicitly:

```toml
# .streamlit/config.toml
[server]
maxCacheDataSize = "4gb"   # opt in across all @st.cache_data functions
```

The option lives under `[server]` because it is a process-wide resource cap, in the same
family as `server.maxUploadSize` and `server.maxMessageSize`, and it follows their
`max{Noun}Size` name pattern. It is not a per-run cache policy, which is what `[runner]`
is for (`runner.cacheBackgroundRefreshTTLMultiplier`). It is named after `st.cache_data`,
the only cache it bounds. `server.maxCacheSize` was rejected because it reads as if it
also covered `st.cache_resource`.

**Config values.** Unset (the v1 default, internally `None`) disables the budget. A
non-zero value must be a unit string with the same case-insensitive binary units as
`max_size` (`"4gb"`, `"500MB"`, `"1.5GB"`; fractional magnitudes are allowed). `0` and
`"0"` also disable it. A bare non-zero integer (`500`) or a unit-less string (`"500"`)
is rejected at startup with an error that tells the operator to add a unit. Those values
are neither megabytes nor bytes: the other `server.*` size options are integer megabytes,
and a bare number here is too easy to misread as one of those.

When the combined size of all `st.cache_data` caches exceeds this budget, Streamlit evicts
globally least-recently-used entries (across functions) until it fits. A per-function
`max_size` is a second ceiling: it can only shrink that function's cache and does not raise
the process-wide budget. A single stored entry may still exceed either limit (see
[Behavior](#behavior)).

Because eviction only drops cached data that can be recomputed or reloaded, an app with
an explicitly configured budget degrades by reproducing that data instead of allowing
unbounded cache growth. The
budget reduces out-of-memory risk but does not guarantee the process stays up: it counts
serialized values only (not unpickled copies or cache metadata), and a single entry larger
than the budget is still stored. Operators should choose a value below their deployment's
memory limit.

V1 leaves `maxCacheDataSize` unset. The proposed 4 GB default and the evidence required to
enable it are documented in
[Rollout plan for the global budget](#rollout-plan-for-the-global-budget) below.

### Behavior

- **No explicit limits** → when `max_size` and `server.maxCacheDataSize` are both unset,
  the cache remains unbounded by size, matching today's behavior (`max_entries` and `ttl`
  still apply when configured). Setting `server.maxCacheDataSize` opts all
  `st.cache_data` caches into the process-wide budget. `0` / `"0"` explicitly disables it.
- **Eviction order**: least-recently-used first, identical to `max_entries` (recency is
  refreshed on both read and write).
- **A single entry larger than the limit**: A write is never rejected, and eviction never
  drops the entry currently being written. One result larger than `max_size` or the global
  budget is still stored. That is a soft ceiling for a single entry: it stays until a
  later write evicts it, and for the life of the cache when it is the only entry. Keeping
  it, and logging a warning once per cache, avoids recomputing that input on every call.
- **Global-budget eviction warning**: The first time the global budget evicts some other
  entry, Streamlit logs a one-time warning per process, for example: *"st.cache_data
  reached its 4.0 GB serialized-size budget (server.maxCacheDataSize) and is evicting
  least-recently-used entries, which are recomputed on their next use, or reloaded from
  disk if they were persisted. Set server.maxCacheDataSize to change the budget, or to "0"
  to disable it."* The oversized-entry warning and this global-budget warning both go to
  the console log only. The write still succeeds, and an in-app message would appear in
  every session that reaches a configured process budget.
- **Global eviction can empty a function's cache**: Right after a write, that function's
  cache holds at least the entry just written. The process-wide budget, however, evicts the
  globally least-recently-used entries across *all* functions and can later shrink an
  individual function's cache to zero. Each evicted entry is recomputed on its next
  access, or reloaded from disk when `persist="disk"`.
- **`max_size` + `max_entries` together**: both are enforced; a write evicts until *both*
  constraints are satisfied.
- **Interaction with `persist="disk"`**: `max_size` and the global budget bound the
  in-memory layer only (the LRU front cache). Eviction removes that layer and leaves the
  on-disk file in place, matching `max_entries`: the in-memory LRU is bounded and the disk
  layer stays unbounded. A later miss reloads the file. This is not how `ttl` behaves —
  `persist="disk"` ignores `ttl`. `st.cache_data.clear()` removes both layers and drops
  that cache's bytes from the global budget, so later writes are not charged for entries
  that are gone.
- **Interaction with `refresh_mode="background"`**: stale-but-retained entries (kept until
  hard expiry at `runner.cacheBackgroundRefreshTTLMultiplier × ttl`, 2 × `ttl` by default; see
  [background refresh spec](../2026-04-08-cache-background-refresh/product-spec.md)) count
  toward `max_size` like any other entry and participate in the same LRU eviction.
- **Interaction with `scope="session"`**: `max_size` applies to each cache instance.
  A session-scoped function has a separate cache per session, the same way `max_entries`
  does, so `max_size="500MB"` allows about 500 MB of serialized data *per session*, not
  one shared cap. `server.maxCacheDataSize`, when set, is the process-wide ceiling on the
  combined serialized size of every `st.cache_data` cache, including each session's
  entries and all `scope="global"` caches. It does not bound process RSS. Under that
  budget a busy session can evict another session's least-recently-used entries.
- **Validation**: Invalid `max_size` values fail at decoration time (fail fast, fail
  helpfully). A `bool` or a `float` raises `StreamlitInvalidParameterTypeError`; pass an
  `int` byte count or a unit string such as `"1.5GB"`. A computed float such as `5e8` or
  `2 * 1024**3 / 2` is rejected too — use `int(5e8)` or `"500MB"`. A value that parses to
  `<= 0` or uses an unrecognized unit raises `StreamlitValueError`.

### Rollout plan for the global budget

The per-function parameter is additive and low-risk. A default-on process-wide budget is
different: it changes cache behavior for apps that never opted in. The rollout is therefore
split into two decisions.

**Option A — default unset (`None`), opt-in only. ✅ V1**

- Pros: Existing apps keep today's behavior after upgrading. Developers and operators can
  still set any explicit budget, including `"4gb"`, and exercise the complete global-LRU
  implementation.
- Cons: Does not yet solve the majority problem: developers who configure nothing can still
  OOM because their caches remain unbounded.

**Option B — fixed `"4gb"` default. 🔜 PROPOSED FOLLOW-UP**

- Pros: Normal apps (well under 4 GB of *serialized* cache) see no change; runaway caches
  evict LRU instead of crashing. Simple, predictable, no new dependency, easy to document
  and override. Directly addresses the crash-instead-of-degrade use case.
- Cons: It is a behavior change — an app that legitimately relies on caching more than 4 GB
  of serialized data would start recomputing evicted entries and could become materially
  slower. Four gigabytes is a heuristic rather than a value tailored to the machine.

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

**Recommendation:** V1 ships `max_size` and `server.maxCacheDataSize`, with the config
defaulting to `None`. This lands the API and lets early adopters validate global eviction
without silently changing existing apps. A separate follow-up may change the default to
`"4gb"` only after reviewing the existing `cache_memory_bytes` distribution, opt-in global
eviction metrics, performance results, and customer feedback. That follow-up needs its
own compatibility review and release-note callout; `"0"` remains the explicit escape hatch
for restoring an unlimited global cache if the default is enabled later.

### Technical feasibility (validated against the current implementation)

This section records what the current code makes easy vs. hard — the primary question the
proposal hinges on. User-visible rules — memory-only eviction, and `clear()` dropping the
budget — are in [Behavior](#behavior). Lock order, hit-path cost, and accounting tests are
in the [tech spec](https://issues.streamlit.app/agent_wiki_explorer?file=pull-requests/16293/tech-spec.md),
which should be reviewed with the implementation change.

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
can be revisited if there's clear demand.

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
- **Enabling a default global budget** — v1 leaves `server.maxCacheDataSize` unset. Changing
  the default to the proposed `"4gb"` is a separate follow-up after compatibility evidence
  and performance data are available.
- **Per-function default (auto-dividing a global budget across functions)** — rejected in
  favor of a single global budget, which is simpler to reason about and doesn't need
  re-tuning when functions are added.

## Checklist

| Item                       | ✅ or comment                                                                                                                                                              |
|----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Works on SiS, Cloud, etc?  | ✅ Pure Python, no new dependency. SiS and Community Cloud use Streamlit's built-in cache storage, so `max_size` and an explicitly configured global budget behave the same as locally. |
| No breaking API changes    | ✅ V1 is additive: `max_size` and `server.maxCacheDataSize` both default to `None`, so existing apps retain unbounded-by-size behavior. The proposed 4 GB follow-up requires a separate compatibility review. |
| No new dependencies        | ✅ Byte sizes come from `len(pickled_bytes)`. A future memory-fraction default is the only variant that would need memory detection. |
| Metrics collected          | ✅ `cache_memory_bytes` already reports per-cache serialized size, and the existing `cache_data` command metrics record `max_size` usage. Global-budget eviction counts need a new counter (tech spec). |
| Any security/legal impact? | ✅ None for `max_size`. A future `evict=`/`getsizeof=` callable could expose cache contents cross-session — that's why it's out of scope.                                    |
| Any docs changes needed?   | ✅ Document `max_size` on `st.cache_data`, the `maxCacheDataSize` config option, the "serialized size, not RSS" caveat, and that `st.cache_resource` is unaffected.        |
