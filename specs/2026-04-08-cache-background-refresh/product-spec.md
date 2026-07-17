---
author: lukasmasuch
created: 2026-04-08
---

# Background Refresh for `st.cache_data` and `st.cache_resource`

## Summary

Add a `refresh_mode` parameter to `st.cache_data` and `st.cache_resource` that enables expired
cache entries to be refreshed in the background while immediately returning stale data. This
eliminates blocking waits for users hitting expired cache entries, providing a significantly
better experience for slow functions (expensive database queries, ML model predictions, API
calls). Staleness and memory stay bounded: stale data is only served within a grace window of
one extra `ttl` period (users never see data older than `2 × ttl`); after that, entries are
evicted and calls block exactly as they do today.

## Problem

When a cached entry expires (TTL reached), the first user request after expiration triggers a
cache miss and must wait for the function to re-execute. For functions that take seconds or
even minutes to complete, this creates a frustrating experience where an unlucky user gets
stuck waiting while the cache refreshes.

**Requests:**

- [#5871](https://github.com/streamlit/streamlit/issues/5871) - Provide methods to refresh
  caching
- [#11050](https://github.com/streamlit/streamlit/issues/11050) - Add the ability to initialize
  the cache (and orchestrate its refreshment)

**Use cases:**

- **Dashboard fetching external data**: Users expect instant responses but data sources are
  slow (60+ seconds for CSV downloads mentioned in #5871)
- **ML inference endpoints**: Model loading is expensive; users shouldn't wait for cold starts
- **Database queries with periodic updates**: Data refreshes at known intervals (e.g., daily
  imports at 6am), but users hitting the app right after shouldn't wait
- **Real-time dashboards**: Showing slightly stale data is acceptable, blocking users is not

## Proposal

### API

Add a `refresh_mode` parameter to both `st.cache_data` and `st.cache_resource`:

```python
st.cache_data(
    ...,
    refresh_mode: Literal["foreground", "background"] = "foreground",
)

st.cache_resource(
    ...,
    refresh_mode: Literal["foreground", "background"] = "foreground",
)
```

### Parameter

| Parameter      | Type                                     | Default        | Description                                                   |
|----------------|------------------------------------------|----------------|---------------------------------------------------------------|
| `refresh_mode` | `Literal["foreground", "background"]`    | `"foreground"` | How to handle cache refresh when TTL expires                  |

### Behavior

**`refresh_mode="foreground"` (default, current behavior):**

1. TTL expires -> entry is treated as expired on the next access
2. Next call detects the expiration and blocks while the function re-executes
3. New value is cached and returned

**`refresh_mode="background"` (lazy background refresh):**

Background refresh separates *freshness* from *eviction* — a bounded variant of HTTP's
[stale-while-revalidate](https://datatracker.ietf.org/doc/html/rfc5861) pattern:

```
0 ────────────── ttl ────────────── 2 × ttl
       fresh     │   stale grace    │   evicted
```

1. Before `ttl`: cache hit -> return the fresh value (unchanged behavior)
2. Between `ttl` and `2 × ttl` (stale grace window), a call:
   - Returns the stale value immediately (no blocking)
   - Triggers a single background refresh in a separate thread
3. When the background refresh completes:
   - **Success:** New value replaces the stale entry; both clocks reset (fresh again
     for `ttl`). Note: For `cache_resource`, callers may still hold references to the
     previous object. This is consistent with current foreground TTL behavior where a
     resource can be evicted while still in use. The old resource is not explicitly
     disposed; callers holding references continue using it until they release it.
   - **Failure:** Log warning, keep serving the stale value, and retry on a later
     access with a per-key cooldown (so a failing upstream isn't retried on every
     rerun)
4. After `2 × ttl` (hard expiry): the entry is evicted -> next call is a normal
   blocking cache miss, identical to foreground behavior. If refreshes kept failing,
   the error surfaces to the user here.

```
Time=0        : First call -> cache miss -> foreground compute -> cache result
Time=30min    : Call -> cache hit (fresh) -> return cached value
Time=1h       : ttl reached -> entry becomes stale (kept in cache)
Time=1h+1s    : Call -> return stale value -> trigger background refresh
                |
Background completes:
  * Success -> replace value, clocks reset (entry fresh again for 1h)
  * Failure -> log warning, keep stale value, retry (with cooldown) on later access
                |
Time=1h+2s    : Call -> fresh value (success case) or stale value (failure case)
Time=2h       : Hard expiry -> entry evicted (if no refresh succeeded)
Time=2h+1s    : Call -> cache miss -> blocking foreground compute (errors surface here)
```

**Key behaviors:**

- **Bounded staleness & memory**: Users never see data older than `2 × ttl`, and a stale
  entry occupies memory for at most one extra `ttl` period — entries that are never
  requested again are still hard-evicted at `2 × ttl`. Stale entries count against
  `max_entries` and follow the same LRU eviction as fresh entries. The grace window
  equals `ttl` (mirroring the equal fresh/stale windows in the RFC 5861 example): it is
  easy to explain and scales automatically with the freshness requirement the user
  already expressed via `ttl`.
- **Deduplicated refreshes**: Only one background refresh runs per cache key at a time
  (reusing the existing per-key computation locks). Concurrent requests for the same
  stale key all receive stale data while a single background refresh runs. Deduplication
  is per-process; in multi-worker deployments, each worker independently detects
  staleness and triggers its own background refresh.
- **Bounded concurrency**: Background refreshes use a shared bounded `ThreadPoolExecutor`
  to prevent unbounded thread creation when many keys expire simultaneously. If the pool
  is exhausted, the refresh is skipped rather than queued — the stale value is still
  returned, and the next access re-triggers the refresh. This avoids building a hidden
  backlog of potentially never-needed work during mass expiry. Implementation details
  (pool size) will be determined in the tech spec.
- **Cleanup guarantee**: A stale entry is removed either by a successful refresh
  (replaced with the fresh value) or at hard expiry (`2 × ttl`), whichever comes first —
  including entries that are never requested again after turning stale.
- **Error surfacing**: Background refresh errors log a warning but don't crash the app
  and don't evict the stale entry. Users keep seeing (bounded) stale data while
  refreshes fail; the error only surfaces to a user after hard expiry, when the next
  call re-executes the function in the foreground.
- **No st.* replay**: `st.*` element calls inside cached functions won't replay after
  background refresh since there's no `ScriptRunContext` in background threads. This is
  consistent with current behavior when calling cached functions from non-script contexts.
- **Spinner behavior**: When `refresh_mode="background"` and the cached entry is stale,
  the stale value is returned immediately without showing a spinner, since there's no
  blocking wait. The `show_spinner` parameter only applies to foreground execution (cache
  miss or foreground refresh mode).

**Implementation note**: The storage layer builds on Streamlit's internal `TTLCache`
([#16014](https://github.com/streamlit/streamlit/pull/16014)), which we fully control —
tracking per-entry freshness (`ttl`) separately from hard eviction (`2 × ttl`) requires
no third-party changes. Details belong in the tech spec.

### Validation

```python
# Valid:
@st.cache_data(ttl="1h", refresh_mode="background")  # Background refresh at TTL
@st.cache_data(ttl="1h", refresh_mode="foreground")  # Explicit foreground
@st.cache_data(ttl="1h")                             # Defaults to foreground
@st.cache_data()                                     # No TTL, no refresh needed

# Invalid:
@st.cache_data(refresh_mode="background")            # ERROR: requires ttl
@st.cache_data(ttl=None, refresh_mode="background")  # ERROR: requires ttl
```

The `refresh_mode="background"` option requires a `ttl` parameter since background refresh
only makes sense when entries can expire. Using it without `ttl` raises a
`StreamlitAPIException`.

**Interaction with `persist` mode:**

When `persist="disk"` (or `persist=True`) is used with `st.cache_data`, entries are
stored on disk and currently do not respect `ttl` for eviction. Using
`refresh_mode="background"` with `persist` mode will raise a `StreamlitAPIException` since
background refresh requires TTL-based expiration. Users needing both persistence and
background refresh should use `persist=False` (the default) with `refresh_mode="background"`.

### Examples

**Basic usage:**

```python
import streamlit as st

@st.cache_data(ttl="1h", refresh_mode="background")
def fetch_stock_prices(symbol: str):
    """Fetch stock prices - users never wait after first call."""
    return expensive_api_call(symbol)

# First call: blocks while fetching
prices = fetch_stock_prices("AAPL")

# After TTL expires: returns stale data instantly, refreshes in background
prices = fetch_stock_prices("AAPL")
```

**Database connection:**

```python
@st.cache_resource(ttl="30m", refresh_mode="background")
def get_database_connection():
    """Connection refreshed in background to avoid stale connections."""
    return psycopg2.connect(host="localhost", database="mydb")

conn = get_database_connection()
```

**Slow API with periodic data updates:**

```python
import streamlit as st

@st.cache_data(ttl="6h", refresh_mode="background")
def fetch_daily_report():
    """
    Data updates at 6am daily. Background refresh ensures users
    always get instant responses even right after the update.
    """
    return download_and_process_csv()  # Takes 60+ seconds

# Users always see data instantly (possibly from yesterday until refresh completes)
report = fetch_daily_report()
st.dataframe(report)
```

**Comparing foreground vs background:**

```python
# Users wait 5 seconds every time TTL expires
@st.cache_data(ttl="1h")
def slow_query_foreground():
    time.sleep(5)
    return fetch_data()

# Users don't wait, as long as the app is used at least once per 2 x ttl
@st.cache_data(ttl="1h", refresh_mode="background")
def slow_query_background():
    time.sleep(5)  # Runs in background
    return fetch_data()
```

## API Alternatives

### Parameter Name Alternatives

#### Option A: `refresh_mode` (Recommended)

```python
@st.cache_data(ttl="1h", refresh_mode="background")
```

**Pros:**

- Clear, explicit naming that describes what's being configured
- Consistent with parameters like `selection_mode` in other Streamlit APIs
- Extensible for future modes

**Cons:**

- Slightly more verbose than `refresh`

#### Option B: `refresh`

```python
@st.cache_data(ttl="1h", refresh="background")
```

**Pros:**

- More concise
- Reads naturally ("refresh in background")

**Cons:**

- Could be confused with a verb/action rather than a configuration
- Less explicit about what's being configured

#### Option C: `refresh_type`

```python
@st.cache_data(ttl="1h", refresh_type="background")
```

**Pros:**

- Clear naming with `*_type` suffix
- Consistent with other `*_type` parameters in Python APIs

**Cons:**

- `type` is less natural for selecting between operational modes

#### Option D: Boolean parameter

```python
@st.cache_data(ttl="1h", background_refresh=True)
# or
@st.cache_data(ttl="1h", async_refresh=True)
```

**Pros:**

- Concise

**Cons:**

- Not extensible if we want to add more refresh strategies
- `async` could be confused with Python's `async`/`await`

#### Option E: `on_expire` parameter

```python
@st.cache_data(ttl="1h", on_expire="refresh")  # vs default "evict"
```

**Pros:**

- Describes what happens at TTL expiration

**Cons:**

- Doesn't clearly convey foreground vs background distinction
- Less intuitive naming

**Recommendation:** Option A (`refresh_mode`) provides the best balance of clarity and
explicitness.

### Value Alternatives

The proposed values are `"foreground"` and `"background"`. Alternative value names considered:

| Proposed       | Alternative | Notes                                                    |
|----------------|-------------|----------------------------------------------------------|
| `"foreground"` | `"blocking"`| More explicit about UX impact; less consistent with `"background"` |
| `"foreground"` | `"sync"`    | Technical but could confuse with Python async/await      |

**`"lazy"` / `"eager"` as a pair** (raised in review):

- **Wrong axis**: In established usage (lazy evaluation, lazy/eager fetching in ORMs,
  eager refresh in caching), the pair describes *when* work is triggered — proactively
  vs on demand. Both of our modes trigger identically (on access of a stale entry);
  they differ in *where* the caller waits, which foreground/background names directly.
- **Ambiguous mapping**: Both assignments are defensible — "lazy" can mean "only
  refresh when needed" (foreground) or "lazily refresh later while serving stale"
  (background) — so users have to guess which value is which mode.
- **Name collision**: `"eager"` is the natural name for a future proactive refresh mode
  (see "Eager Background Refresh" under Alternative Solutions); using it now for
  stale-while-revalidate would block that extension.

**Recommendation:** `"foreground"` / `"background"` are clear, user-friendly, and form a
natural pair.

## Alternative Solutions

### Eager Background Refresh (Proactive)

Instead of waiting for the next access after TTL expires, proactively refresh cache entries
as soon as they expire.

**How it would work:**

1. TTL expires -> immediately trigger background refresh (no user access needed)
2. Background thread monitors expiration times and refreshes entries preemptively
3. Users always get fresh data (within refresh completion time)

**Pros:**

- Users truly never see stale data after TTL
- Better for time-critical applications
- Cache is always warm

**Cons:**

- **Resource waste**: Refreshes entries that may never be accessed again. A function called
  once with 100 different argument combinations would trigger 100 background refreshes at
  TTL even if users only care about 2 of them.
- **Complexity**: Requires a background scheduler/timer thread to track all cache entries
  and their expiration times
- **Unbounded work**: No natural limit on background refresh activity; could overwhelm
  external APIs or databases
- **Memory overhead**: Must keep metadata for all cache keys to know when to refresh
- **Harder to reason about**: Refresh happens without any user action, making debugging
  more difficult

**Why lazy is better for Streamlit's use case:**

Streamlit apps often have cached functions called with many argument variations, but only a
subset are frequently accessed. Lazy refresh naturally prioritizes refreshing what users
actually use. It's simpler to implement, has predictable resource usage, and aligns with
Streamlit's "reactive" model where computation happens in response to user actions.

Eager refresh could be added as a future enhancement for users with specific requirements,
but the lazy approach should be the default and recommended option.

### Unbounded Stale Retention

Keep stale entries indefinitely and refresh whenever they are requested again, no matter
how much later.

**Why not included:**

- **Unbounded memory**: Keys that are never requested again would only be evicted via
  `max_entries`, which defaults to unlimited — parameterized functions could accumulate
  stale entries forever
- **Unbounded staleness**: A dashboard untouched for a week would instantly serve
  week-old data to the next visitor; with the `2 × ttl` bound, that visitor waits for a
  fresh foreground compute instead (today's predictable behavior)

### Refresh-Ahead (`ttl` as a hard accuracy limit)

Treat `ttl` as a strict upper bound on data age and trigger a background refresh when an
entry is accessed in the second half of its fresh window (Guava/Caffeine's
`refreshAfterWrite` pattern).

**Pros:**

- Users are never served data older than `ttl`
- No extra memory retention; entries still evict at `ttl`

**Cons:**

- Doesn't solve the headline problem: an app that is idle overnight has no access during
  the refresh window, so the entry expires normally and the first morning user still
  blocks
- Multiplies compute for frequently accessed keys: a continuously accessed key refreshes
  every `0.5 × ttl` instead of every `ttl` (worse with fragments/autorefresh). The
  chosen stale-while-revalidate design adds no compute over foreground mode — refreshes
  fire exactly when a foreground miss would have

Could be added later as an additional `refresh_mode` for apps where data accuracy
matters more than compute cost.

### Scheduled Refresh (via parameter)

Some users in #5871 requested scheduled refresh at specific times (e.g., "at 6:05am every
day, call this function").

```python
@st.cache_data(refresh_schedule="0 6 * * *")  # cron syntax
```

**Why not included:**

- Significantly more complex (requires cron parsing, background scheduler)
- Unclear interaction with TTL
- Can be achieved with external schedulers (cron, Celery, Airflow, Starlette background tasks)
  that call the cached function directly
- Out of scope for MVP; could be follow-up work

### Cache Warming API

An explicit API to pre-populate cache entries:

```python
fetch_stock_prices.warm("AAPL", "GOOGL", "MSFT")
```

**Why not included:**

- Different problem (initial population vs refresh)
- Can already be achieved during app startup by calling cached functions at module level
  or using custom initialization logic before the app's main script runs
- Could be a separate feature request for more ergonomic syntax
- Related to #11050

## Out of Scope (Future Work)

- **Scheduled/cron-based refresh**: Refresh at specific times rather than on-access
- **Cache warming API**: Explicit method to pre-populate cache with specific arguments
- **Refresh status callback**: Notify app when background refresh completes
- **Stale data indicator**: Visual indicator that displayed data is stale while refreshing
- **Priority-based refresh**: Prioritize some cache keys over others
- **Refresh timeout**: Limit how long background refresh can run
- **`max_stale` parameter**: Explicitly configure the stale grace window (default: equal
  to `ttl`), e.g. `ttl="1h", max_stale="12h"` to serve stale data across an overnight
  idle gap without blocking the first morning user
- **Smarter eviction under memory pressure**: Prefer evicting stale entries that were
  never requested again (a SIEVE-style reuse hint) before recently served ones — plain
  LRU already approximates this, so it's deferred until there's evidence it's needed

## Checklist

| Item                       | ✅ or comment                                                        |
|----------------------------|----------------------------------------------------------------------|
| Works on SiS, Cloud, etc?  | ✅ Uses standard Python threading (`concurrent.futures.ThreadPoolExecutor`). SiS/Snowflake environments support stdlib threading; if thread creation is restricted, refreshes will execute synchronously in the foreground as a graceful fallback. |
| No breaking API changes    | ✅ New optional parameter with backward-compatible default           |
| No new dependencies        | ✅ Uses stdlib `concurrent.futures`; builds on the internal `TTLCache` introduced in [#16014](https://github.com/streamlit/streamlit/pull/16014) |
| Metrics collected          | ✅ Parameter usage tracked via the `gather_metrics` decorator        |
| Any security/legal impact? | ✅ No new security concerns                                          |
| Any docs changes needed?   | ✅ Document `refresh_mode` param, note about `st.*` calls not replaying |
