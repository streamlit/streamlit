---
author: lukasmasuch
created: 2026-04-08
---

# Background Refresh for `st.cache_data` and `st.cache_resource`

## Summary

Add a `refresh` parameter to `st.cache_data` and `st.cache_resource` that enables expired
cache entries to be refreshed in the background while immediately returning stale data. This
eliminates blocking waits for users hitting expired cache entries, providing a significantly
better experience for slow functions (expensive database queries, ML model predictions, API
calls).

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

Add a `refresh_type` parameter to both `st.cache_data` and `st.cache_resource`:

```python
st.cache_data(
    ...,
    refresh_type: Literal["foreground", "background"] = "foreground",
)

st.cache_resource(
    ...,
    refresh_type: Literal["foreground", "background"] = "foreground",
)
```

### Parameter

| Parameter      | Type                                     | Default        | Description                                                   |
|----------------|------------------------------------------|----------------|---------------------------------------------------------------|
| `refresh_type` | `Literal["foreground", "background"]`    | `"foreground"` | How to handle cache refresh when TTL expires                  |

### Behavior

**`refresh_type="foreground"` (default, current behavior):**

1. TTL expires -> entry is treated as expired on the next access
2. Next call detects the expiration and blocks while the function re-executes
3. New value is cached and returned

**`refresh_type="background"` (lazy background refresh):**

1. TTL expires -> entry remains in cache (stale but valid)
2. Next call detects expiration:
   - Returns the stale/expired value immediately (no blocking)
   - Triggers background refresh in a separate thread
3. When background refresh completes:
   - **Success:** New value replaces the expired entry in cache. Note: For
     `cache_resource`, callers may still hold references to the previous object. This is
     consistent with current foreground TTL behavior where a resource can be evicted
     while still in use. The old resource is not explicitly disposed; callers holding
     references continue using it until they release it.
   - **Failure:** Log warning, evict the expired entry
4. Subsequent calls:
   - If refresh succeeded -> return fresh cached value
   - If refresh failed -> cache miss -> foreground refresh (user sees any error)

```
Time=0        : First call -> cache miss -> foreground compute -> cache result
Time=30min    : Call -> cache hit (within TTL) -> return cached value
Time=1h       : TTL expires
Time=1h+1s    : Call -> return expired value -> trigger background refresh
                |
Background completes:
  * Success -> replace with new value
  * Failure -> evict expired entry
                |
Time=1h+2s    : Next call:
  * Success case -> cache hit with fresh value
  * Failure case -> cache miss -> foreground refresh
```

**Key behaviors:**

- **Deduplicated refreshes**: Only one background refresh runs per cache key at a time.
  Concurrent requests for the same expired key all receive stale data while a single
  background refresh runs. Deduplication is per-process; in multi-worker deployments,
  each worker independently detects expiration and triggers its own background refresh.
- **Bounded concurrency**: Background refreshes use a shared bounded `ThreadPoolExecutor`
  to prevent unbounded thread creation when many keys expire simultaneously. If the pool
  is exhausted, additional refresh requests are queued. Implementation details (pool
  size, queue depth) will be determined in the tech spec.
- **Cleanup guarantee**: Expired entries are always cleaned up after background refresh
  completes, whether successful or not.
- **Error surfacing**: Background refresh errors log a warning but don't crash the app.
  Users only see errors if they hit the cache after a failed refresh (foreground retry).
- **No st.* replay**: `st.*` element calls inside cached functions won't replay after
  background refresh since there's no `ScriptRunContext` in background threads. This is
  consistent with current behavior when calling cached functions from non-script contexts.

### Validation

```python
# Valid:
@st.cache_data(ttl="1h", refresh_type="background")  # Background refresh at TTL
@st.cache_data(ttl="1h", refresh_type="foreground")  # Explicit foreground
@st.cache_data(ttl="1h")                             # Defaults to foreground
@st.cache_data()                                     # No TTL, no refresh needed

# Invalid:
@st.cache_data(refresh_type="background")            # ERROR: requires ttl
@st.cache_data(ttl=None, refresh_type="background")  # ERROR: requires ttl
```

The `refresh_type="background"` option requires a `ttl` parameter since background refresh
only makes sense when entries can expire. Using it without `ttl` raises a
`StreamlitAPIException`.

**Interaction with `persist` mode:**

When `persist="disk"` (or `persist=True`) is used with `st.cache_data`, entries are
stored on disk and currently do not respect `ttl` for eviction. Using
`refresh_type="background"` with `persist` mode will raise a `StreamlitAPIException` since
background refresh requires TTL-based expiration. Users needing both persistence and
background refresh should use `persist=False` (the default) with `refresh="background"`.

### Examples

**Basic usage:**

```python
import streamlit as st

@st.cache_data(ttl="1h", refresh_type="background")
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
@st.cache_resource(ttl="30m", refresh_type="background")
def get_database_connection():
    """Connection refreshed in background to avoid stale connections."""
    return psycopg2.connect(host="localhost", database="mydb")

conn = get_database_connection()
```

**Slow API with periodic data updates:**

```python
import streamlit as st

@st.cache_data(ttl="6h", refresh_type="background")
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

# Users never wait (after first call)
@st.cache_data(ttl="1h", refresh_type="background")
def slow_query_background():
    time.sleep(5)  # Runs in background
    return fetch_data()
```

## API Alternatives

### Parameter Name Alternatives

#### Option A: `refresh_type` (Recommended)

```python
@st.cache_data(ttl="1h", refresh_type="background")
```

**Pros:**

- Clear, explicit naming that describes what's being configured
- Consistent with other `*_type` parameters in Python APIs
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

#### Option C: Boolean parameter

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

#### Option D: `on_expire` parameter

```python
@st.cache_data(ttl="1h", on_expire="refresh")  # vs default "evict"
```

**Pros:**

- Describes what happens at TTL expiration

**Cons:**

- Doesn't clearly convey foreground vs background distinction
- Less intuitive naming

**Recommendation:** Option A (`refresh_type`) provides the best balance of clarity and
explicitness.

### Value Alternatives

The proposed values are `"foreground"` and `"background"`. Alternative value names considered:

| Proposed       | Alternative | Notes                                                    |
|----------------|-------------|----------------------------------------------------------|
| `"background"` | `"lazy"`    | Describes the on-access trigger pattern; less clear about threading |
| `"foreground"` | `"blocking"`| More explicit about UX impact; less consistent with `"background"` |
| `"foreground"` | `"sync"`    | Technical but could confuse with Python async/await      |

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

## Checklist

| Item                       | ✅ or comment                                                        |
|----------------------------|----------------------------------------------------------------------|
| Works on SiS, Cloud, etc?  | ✅ Uses standard Python threading (`concurrent.futures.ThreadPoolExecutor`). SiS/Snowflake environments support stdlib threading; if thread creation is restricted, refreshes will execute synchronously in the foreground as a graceful fallback. |
| No breaking API changes    | ✅ New optional parameter with backward-compatible default           |
| No new dependencies        | ✅ Uses stdlib `concurrent.futures`                                  |
| Metrics collected          | ✅ Parameter usage tracked via the `gather_metrics` decorator        |
| Any security/legal impact? | ✅ No new security concerns                                          |
| Any docs changes needed?   | ✅ Document `refresh_type` param, note about `st.*` calls not replaying |
