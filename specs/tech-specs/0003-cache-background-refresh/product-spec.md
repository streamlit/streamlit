---
author: "@lukasmasuch"
created: 2025-12-04
status: Draft
---

# Background refresh for `st.cache_data` and `st.cache_resource`

## Summary

Add a `refresh` parameter to `st.cache_data` and `st.cache_resource` that allows
expired cache entries to be refreshed in the background, returning stale data immediately
instead of blocking users while recomputing.

## Problem

When a cached entry expires (TTL reached), the first user request after expiration triggers
a cache miss and must wait for the function to re-execute. This creates poor UX for users
hitting expired entries, especially for slow functions (expensive database queries, ML
model predictions, API calls).

**Requests:**

- [#5871](https://github.com/streamlit/streamlit/issues/5871) - Provide methods to refresh caching
- [#11050](https://github.com/streamlit/streamlit/issues/11050) - Add the ability to initialize the cache (and orchestrate its refreshment)

**Use cases:**

- Dashboard fetching data from slow APIs where users expect instant responses
- ML inference endpoints where model loading is expensive
- Database queries with periodic data updates (e.g., daily CSV imports)

## Proposal

### API

Add a `refresh` parameter to both `st.cache_data` and `st.cache_resource`:

```python
st.cache_data(
    ...,
    refresh: Literal["foreground", "background"] = "foreground",
)

st.cache_resource(
    ...,
    refresh: Literal["foreground", "background"] = "foreground",
)
```

### Parameter

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `refresh` | `Literal["foreground", "background"]` | `"foreground"` | How to handle cache refresh when TTL expires |

### Naming Alternatives

- `on_expire: Literal["refresh", "evict"] = "evict"`
- `async: bool = False`

### Behavior

**`refresh="foreground"` (default, current behavior):**

1. TTL expires → entry is evicted at next TTLCach update.
2. Next call blocks while function re-executes
3. New value is cached and returned

**`refresh="background"`:**

1. TTL expires → entry remains in cache
2. Next call detects expiration, returns expired value immediately (no blocking)
3. Background thread executes function to compute new value
4. When background refresh completes:
   - **Success:** Write new value to cache (replaces expired entry)
   - **Failure:** Log warning, explicitly evict the expired entry
5. Subsequent calls:
   - If refresh succeeded: return fresh cached value
   - If refresh failed: cache miss → foreground refresh → user sees any error

Note: `TTLCache` from cachetools already holds expired entries until the next access
or cache operation (lazy eviction). We leverage this by intercepting the expiration
check rather than letting it trigger automatic eviction.

```
Time=0        : First call → cache miss → foreground compute → cache result
Time=30min    : Call → cache hit (within TTL) → return cached value
Time=1h       : TTL expires
Time=1h+1s    : Call → return expired value → trigger background refresh
                ↓
Background completes:
  • Success → replace with new value
  • Failure → evict expired entry
                ↓
Time=1h+2s    : Next call:
  • Success case → cache hit with fresh value
  • Failure case → cache miss → foreground refresh
```

**Key behaviors:**

- Only one background refresh runs per cache key (deduplicated)
- Expired entries are always cleaned up after background refresh completes
- Background refresh errors surface to users on subsequent access (foreground retry)
- `st.*` element calls inside cached functions won't replay after background refresh
  (no `ScriptRunContext` in background threads)

### Validation

```python
# Valid:
@st.cache_data(ttl="1h", refresh="background")  # Background refresh at TTL
@st.cache_data(ttl="1h", refresh="foreground")  # Explicit foreground
@st.cache_data(ttl="1h")                        # Defaults to foreground
@st.cache_data()                                # No TTL, no refresh needed

# Invalid:
@st.cache_data(refresh="background")            # ERROR: requires ttl
@st.cache_data(ttl=None, refresh="background")  # ERROR: requires ttl
```

### Examples

**Basic usage:**

```python
import streamlit as st

@st.cache_data(ttl="1h", refresh="background")
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
@st.cache_resource(ttl="30m", refresh="background")
def get_database_connection():
    """Connection refreshed in background to avoid stale connections."""
    return psycopg2.connect(host="localhost", database="mydb")

conn = get_database_connection()
```

**Comparing foreground vs background:**

```python
# Users wait 5 seconds every time TTL expires
@st.cache_data(ttl="1h")
def slow_query_foreground():
    time.sleep(5)
    return fetch_data()

# Users never wait (after first call)
@st.cache_data(ttl="1h", refresh="background")
def slow_query_background():
    time.sleep(5)  # Runs in background
    return fetch_data()
```

## Checklist

- [x] Will this work on all deployment platforms (e.g. [Streamlit Community Cloud](https://streamlit.io/cloud), [Streamlit in Snowflake](https://www.snowflake.com/en/product/features/streamlit-in-snowflake/), [Hugging Face Spaces](https://huggingface.co/spaces))?
  - Uses standard Python threading (`concurrent.futures.ThreadPoolExecutor`)
- [x] No breaking API changes?
  - New optional parameter with backward-compatible default
- [x] No new dependencies?
  - Uses stdlib `concurrent.futures`
- [x] Metrics collected?
- [x] Any security or legal implications?
- [x] Anything to keep in mind for docs?
  - Document that `st.*` calls won't replay after background refresh
  - Document error handling behavior (failed refresh → foreground retry)
- [x] Any other risks?
