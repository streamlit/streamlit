# Background Refresh for Cached Functions - Implementation Plan

## GitHub Issue Reference
- Issue: [#5871 - Background refreshing for cached functions](https://github.com/streamlit/streamlit/issues/5871)

## Executive Summary

This document outlines the implementation plan for adding background refresh capabilities to Streamlit's caching decorators (`st.cache_data` and `st.cache_resource`). The feature enables cached entries to be refreshed in the background before they expire, ensuring users always receive cached data quickly while keeping data fresh.

---

## 1. Problem Statement

### Current Behavior
Currently, when a cached entry expires (TTL reached):
1. The first user request after expiration triggers a cache miss
2. The user must wait for the function to re-execute
3. Subsequent users get the newly cached value

This creates **"cache stampede"** scenarios and poor UX for the first user hitting an expired entry, especially for slow functions (e.g., expensive database queries, ML model predictions, API calls).

### Desired Behavior
Implement the **"Stale-While-Revalidate" (SWR)** pattern:
1. Cache entry is marked "stale" after `refresh_after` time
2. When a stale entry is accessed:
   - Return the stale (but still valid) cached value immediately
   - Trigger a background refresh to update the cache
3. Entry is fully evicted only after `ttl` expires

This ensures:
- Users always receive fast responses (cached value)
- Data stays fresh via background updates
- No cache stampede on expiration

---

## 2. Current Caching Architecture

### Key Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         CacheDataAPI / CacheResourceAPI          │
│                    (@st.cache_data / @st.cache_resource)         │
├─────────────────────────────────────────────────────────────────┤
│                         CachedFuncInfo                           │
│        (stores decorator params: ttl, max_entries, etc.)         │
├─────────────────────────────────────────────────────────────────┤
│                    CachedFunc (wrapper)                          │
│    (_get_or_create_cached_value, _handle_cache_miss/hit)         │
├─────────────────────────────────────────────────────────────────┤
│                         Cache (abstract)                         │
│        DataCache (pickle-based) / ResourceCache (in-memory)      │
├─────────────────────────────────────────────────────────────────┤
│              TTLCache (from cachetools library)                  │
│           (handles TTL expiration and LRU eviction)              │
├─────────────────────────────────────────────────────────────────┤
│                    CacheStorage (for cache_data)                 │
│       InMemoryCacheStorageWrapper + Optional Disk Persistence    │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files
- `lib/streamlit/runtime/caching/cache_data_api.py` - `@st.cache_data` implementation
- `lib/streamlit/runtime/caching/cache_resource_api.py` - `@st.cache_resource` implementation
- `lib/streamlit/runtime/caching/cache_utils.py` - Shared utilities (`CachedFunc`, `CachedFuncInfo`, `Cache`)
- `lib/streamlit/runtime/caching/cached_message_replay.py` - Message replay for cached `st.*` calls
- `lib/streamlit/runtime/caching/storage/` - Storage layer abstraction

### TTLCache Behavior
The `cachetools.TTLCache` library handles:
- Automatic eviction when `ttl` expires
- LRU eviction when `maxsize` is reached
- Thread-safe operations via external locks

**Limitation**: TTLCache doesn't support "stale" entries - items are either valid or evicted.

---

## 3. Proposed API Design

### 3.1 New Parameter: `refresh`

Add a `refresh` parameter to both `@st.cache_data` and `@st.cache_resource`:

```python
@st.cache_data(
    ttl="1h",              # When to trigger refresh
    refresh="background",  # How to handle refresh: "foreground" or "background"
)
def fetch_data(url):
    return expensive_api_call(url)
```

### 3.2 Parameter Semantics

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `refresh` | `Literal["foreground", "background"]` | `"foreground"` | How to handle cache refresh when TTL expires |

**Behavior by Mode:**

| Mode | When TTL Expires | User Experience |
|------|------------------|-----------------|
| `"foreground"` (default) | Evict entry → next call blocks to recompute | Current behavior, user waits |
| `"background"` | Keep expired entry → return stale value → refresh in background | User gets instant response |

### 3.3 Background Refresh Flow

```
Time=0        : First call → cache miss → foreground compute → store result
Time=30min    : Call → cache hit (within TTL) → return cached value
Time=1h       : TTL expires (entry marked as expired but kept)
Time=1h+1s    : Call → expired hit → return stale value → trigger background refresh
                ↓
Background refresh completes:
  • Success → Replace cache entry with new value
  • Failure → Remove expired entry from cache (evict)
                ↓
Time=1h+2s    : Next call:
  • If refresh succeeded → cache hit with fresh value
  • If refresh failed → cache miss → foreground refresh → error visible to user
```

### 3.4 Validation Rules

```python
# Valid configurations:
@st.cache_data(ttl="1h", refresh="background")  # OK: background refresh at TTL
@st.cache_data(ttl="1h", refresh="foreground")  # OK: explicit foreground (default)
@st.cache_data(ttl="1h")                        # OK: defaults to foreground
@st.cache_data(ttl=None)                        # OK: never expires, no refresh

# Invalid configurations:
@st.cache_data(refresh="background")            # ERROR: background requires ttl
@st.cache_data(ttl=None, refresh="background")  # ERROR: background requires ttl
```

### 3.5 Design Rationale

**Why `refresh="background"` instead of `refresh_after` + `ttl`?**

| Aspect | Two Parameters (`refresh_after` + `ttl`) | Single Parameter (`refresh`) |
|--------|------------------------------------------|------------------------------|
| API complexity | Two time values to configure | One enum choice |
| User confusion | "Which should be larger?" | Clear binary decision |
| Mental model | "Stale window vs hard expiration" | "How to handle expiration" |
| Common use case | Requires both params | Just add `refresh="background"` |

Most users simply want: *"When my cache expires, don't make me wait."*
The `refresh="background"` parameter captures this intent directly.

**Why remove expired entries after failed refresh?**

- **Simple**: No need for `max_stale`, retry limits, or cleanup logic
- **Errors surface naturally**: Failed background refresh → cache miss → foreground retry → user sees error
- **No stale data lingers**: Expired entries are always cleaned up after one background attempt
- **Predictable**: Background refresh is a "one-shot grace period"

---

## 4. Implementation Strategy

### 4.1 Core Components

#### 4.1.1 Background Refresh Manager

Create a new singleton class to manage background refresh tasks:

```python
# lib/streamlit/runtime/caching/background_refresh.py

class BackgroundRefreshManager:
    """Manages background refresh tasks for cached functions."""

    _instance: BackgroundRefreshManager | None = None

    def __init__(self) -> None:
        self._executor: ThreadPoolExecutor | None = None
        self._pending_refreshes: dict[str, Future] = {}
        self._pending_lock = threading.Lock()

    @classmethod
    def instance(cls) -> BackgroundRefreshManager:
        if cls._instance is None:
            cls._instance = BackgroundRefreshManager()
        return cls._instance

    def schedule_refresh(
        self,
        refresh_key: str,
        func: Callable,
        args: tuple,
        kwargs: dict,
        on_complete: Callable[[Any], None],
        on_error: Callable[[Exception], None] | None = None,
    ) -> bool:
        """Schedule a background refresh if not already pending."""
        with self._pending_lock:
            if refresh_key in self._pending_refreshes:
                return False  # Already refreshing

            if self._executor is None:
                self._executor = ThreadPoolExecutor(
                    max_workers=4,  # Configurable
                    thread_name_prefix="st_cache_refresh"
                )

            future = self._executor.submit(
                self._execute_refresh,
                refresh_key,
                func,
                args,
                kwargs,
                on_complete,
                on_error,
            )
            self._pending_refreshes[refresh_key] = future
            return True

    def _execute_refresh(
        self,
        refresh_key: str,
        func: Callable,
        args: tuple,
        kwargs: dict,
        on_complete: Callable[[Any], None],
        on_error: Callable[[Exception], None] | None,
    ) -> None:
        try:
            result = func(*args, **kwargs)
            on_complete(result)
        except Exception as e:
            if on_error:
                on_error(e)
            else:
                _LOGGER.warning(f"Background refresh failed: {e}")
        finally:
            with self._pending_lock:
                self._pending_refreshes.pop(refresh_key, None)

    def shutdown(self) -> None:
        """Shutdown the executor and cancel pending tasks."""
        if self._executor:
            self._executor.shutdown(wait=False, cancel_futures=True)
            self._executor = None
        with self._pending_lock:
            self._pending_refreshes.clear()
```

#### 4.1.2 Extended Cache Entry Metadata

Modify cache storage to track entry timestamps:

```python
@dataclass
class CacheEntryMetadata:
    """Metadata for a cached entry."""
    created_at: float  # time.monotonic() when entry was created
    value_key: str

    def is_stale(self, refresh_after_seconds: float | None) -> bool:
        if refresh_after_seconds is None:
            return False
        elapsed = cache_utils.TTLCACHE_TIMER() - self.created_at
        return elapsed >= refresh_after_seconds
```

#### 4.1.3 Modified Cache Read Logic

Update `CachedFunc._get_or_create_cached_value`:

```python
def _get_or_create_cached_value(
    self,
    func_args: tuple[Any, ...],
    func_kwargs: dict[str, Any],
    spinner_message: str | None = None,
) -> R:
    cache = self._info.get_function_cache(self._function_key)
    value_key = _make_value_key(...)

    try:
        cached_result, metadata = cache.read_result_with_metadata(value_key)

        # Check if entry is stale and needs background refresh
        if (
            self._info.refresh_after_seconds is not None
            and metadata.is_stale(self._info.refresh_after_seconds)
        ):
            self._schedule_background_refresh(
                cache, value_key, func_args, func_kwargs
            )

        return self._handle_cache_hit(cached_result)

    except CacheKeyNotFoundError:
        # Cache miss - compute synchronously
        return self._handle_cache_miss(cache, value_key, func_args, func_kwargs)

def _schedule_background_refresh(
    self,
    cache: Cache[R],
    value_key: str,
    func_args: tuple[Any, ...],
    func_kwargs: dict[str, Any],
) -> None:
    """Schedule a background refresh for a stale cache entry."""
    refresh_key = f"{self._function_key}:{value_key}"

    def on_complete(result: R) -> None:
        # Write the new result to cache
        # NOTE: No message replay in background threads
        cache.write_result(value_key, result, messages=[])

    def on_error(error: Exception) -> None:
        _LOGGER.warning(
            f"Background refresh failed for {self._info.display_name}: {error}"
        )

    BackgroundRefreshManager.instance().schedule_refresh(
        refresh_key=refresh_key,
        func=self._info.func,
        args=func_args,
        kwargs=func_kwargs,
        on_complete=on_complete,
        on_error=on_error,
    )
```

### 4.2 Storage Layer Changes

#### For `cache_data` (DataCache)

Modify `InMemoryCacheStorageWrapper` to store timestamps:

```python
class CacheEntryWithTimestamp(NamedTuple):
    data: bytes
    created_at: float

class InMemoryCacheStorageWrapper(CacheStorage):
    def __init__(self, ...):
        # Store (data, timestamp) tuples instead of just data
        self._mem_cache: TTLCache[str, CacheEntryWithTimestamp] = TTLCache(...)

    def get_with_timestamp(self, key: str) -> tuple[bytes, float]:
        entry = self._read_from_mem_cache(key)
        return entry.data, entry.created_at
```

#### For `cache_resource` (ResourceCache)

Modify `CachedResult` to include timestamp:

```python
@dataclass
class CachedResult(Generic[R]):
    value: R
    messages: list[MsgData]
    main_id: str
    sidebar_id: str
    created_at: float = field(default_factory=time.monotonic)
```

### 4.3 Key Implementation Details

#### Thread Safety

The background refresh must be thread-safe:
1. Use locks when checking/updating pending refresh set
2. Cache writes must be atomic (already handled by existing locks)
3. Avoid race conditions between stale check and refresh completion

```python
# Prevent duplicate refreshes for the same key
with self._pending_lock:
    if refresh_key in self._pending_refreshes:
        return  # Another thread is already refreshing
    self._pending_refreshes.add(refresh_key)
```

#### Message Replay Limitation

**Critical Constraint**: Background refreshes cannot capture `st.*` element calls because:
1. No `ScriptRunContext` in background threads
2. No frontend connection to send messages to
3. `CachedMessageReplayContext` relies on thread-local storage

**Decision**: Background-refreshed entries will have empty `messages` lists. This means:
- Elements created inside the cached function won't replay after background refresh
- Users should be aware of this limitation

**Mitigation Options**:
1. **Documentation**: Clearly document this limitation
2. **Warning**: Log warning if function attempts `st.*` calls during background refresh
3. **Parameter**: Add `allow_background_refresh=True` to opt-in, with automatic disabling if function uses `st.*` elements

#### Error Handling

Background refresh errors should not crash the app:
```python
def on_error(error: Exception) -> None:
    _LOGGER.warning(
        f"Background refresh failed for {func_name}({args}): {error}"
    )
    # Optionally: increment metrics counter
    # Optionally: call user-provided error callback
```

### 4.4 Lifecycle Management

The `BackgroundRefreshManager` must be properly cleaned up:

```python
# In Runtime.stop() or Runtime.__del__():
def stop(self) -> None:
    # ... existing cleanup ...
    BackgroundRefreshManager.instance().shutdown()
```

---

## 5. Implementation Phases

### Phase 1: Core Infrastructure (Estimated: 3-4 days)
- [ ] Create `BackgroundRefreshManager` class
- [ ] Add `refresh_after` parameter to `CachedDataFuncInfo` and `CachedResourceFuncInfo`
- [ ] Add parameter validation (refresh_after < ttl)
- [ ] Update `time_to_seconds` if needed for new parameter
- [ ] Add timestamp tracking to cache entries

### Phase 2: Cache Read Logic (Estimated: 2-3 days)
- [ ] Modify `CachedFunc._get_or_create_cached_value` for stale detection
- [ ] Implement `_schedule_background_refresh` method
- [ ] Handle background refresh completion and cache updates
- [ ] Ensure thread-safety with proper locking

### Phase 3: Storage Layer Updates (Estimated: 2 days)
- [ ] Update `InMemoryCacheStorageWrapper` to store timestamps
- [ ] Update `ResourceCache` to track creation times
- [ ] Update `CachedResult` dataclass with timestamp field
- [ ] Ensure disk persistence handles new format (for `cache_data(persist="disk")`)

### Phase 4: Error Handling & Edge Cases (Estimated: 2 days)
- [ ] Implement error handling for background refresh failures
- [ ] Handle edge case: entry evicted before refresh completes
- [ ] Handle edge case: function raises exception during refresh
- [ ] Handle edge case: app shutdown during pending refresh
- [ ] Add logging for background refresh events

### Phase 5: Testing (Estimated: 3-4 days)
- [ ] Unit tests for `BackgroundRefreshManager`
- [ ] Unit tests for stale detection logic
- [ ] Unit tests for timestamp tracking
- [ ] Integration tests with mocked time
- [ ] Thread-safety tests with concurrent access
- [ ] E2E tests demonstrating the feature

### Phase 6: Documentation & Polish (Estimated: 2 days)
- [ ] Update docstrings for `cache_data` and `cache_resource`
- [ ] Add API documentation for `refresh_after` parameter
- [ ] Document message replay limitations
- [ ] Add examples to documentation
- [ ] Add type stubs/annotations

---

## 6. Testing Strategy

### Unit Tests

```python
# test_background_refresh.py

class BackgroundRefreshManagerTest(unittest.TestCase):
    def test_schedule_refresh_executes_function(self):
        """Scheduled refresh should execute the function."""
        pass

    def test_duplicate_refresh_skipped(self):
        """Second refresh for same key should be skipped."""
        pass

    def test_refresh_error_logged(self):
        """Errors during refresh should be logged, not raised."""
        pass

    def test_shutdown_cancels_pending(self):
        """Shutdown should cancel pending refresh tasks."""
        pass


class CacheDataRefreshTest(unittest.TestCase):
    @patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
    def test_stale_entry_triggers_refresh(self, timer_mock):
        """Accessing stale entry should trigger background refresh."""
        pass

    @patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
    def test_fresh_entry_no_refresh(self, timer_mock):
        """Accessing fresh entry should not trigger refresh."""
        pass

    def test_refresh_after_greater_than_ttl_raises(self):
        """refresh_after > ttl should raise error."""
        with self.assertRaises(StreamlitAPIException):
            @st.cache_data(ttl="30m", refresh_after="1h")
            def foo():
                return 42


class CacheResourceRefreshTest(unittest.TestCase):
    # Similar tests for cache_resource
    pass
```

### Integration Tests

```python
# test_background_refresh_integration.py

@patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
def test_background_refresh_updates_cache(timer_mock):
    """Background refresh should update cache with new value."""
    call_count = 0

    @st.cache_data(ttl=100, refresh_after=50)
    def get_data():
        nonlocal call_count
        call_count += 1
        return f"value_{call_count}"

    # First call - cache miss
    timer_mock.return_value = 0
    assert get_data() == "value_1"
    assert call_count == 1

    # Second call - cache hit (not stale)
    timer_mock.return_value = 30
    assert get_data() == "value_1"
    assert call_count == 1

    # Third call - stale, triggers background refresh
    timer_mock.return_value = 60
    assert get_data() == "value_1"  # Returns stale value immediately

    # Wait for background refresh to complete
    time.sleep(0.1)
    assert call_count == 2

    # Fourth call - should get refreshed value
    timer_mock.return_value = 61
    assert get_data() == "value_2"
```

### E2E Tests

```python
# e2e_playwright/st_cache_refresh_test.py

def test_background_refresh_visual():
    """Visual test for background refresh behavior."""
    # Test app showing last refresh timestamp
    # Verify that data updates without user interaction
    pass
```

---

## 7. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Thread safety issues | High | Medium | Thorough locking strategy, extensive testing |
| Memory leaks from pending tasks | Medium | Low | Proper cleanup in shutdown, weak references |
| Background refresh slows app | Medium | Low | Configurable thread pool size, rate limiting |
| Message replay breaks | High | High | Document limitation clearly, consider warning |
| Disk persistence format change | Medium | Low | Version the cache format, handle migration |

---

## 8. Future Enhancements

### 8.1 Proactive Refresh (Beyond Scope)
Pre-refresh entries before they become stale:
```python
@st.cache_data(ttl="1h", refresh_before_stale="5m")
```

### 8.2 Refresh Callbacks
User-provided callbacks for refresh events:
```python
@st.cache_data(
    ttl="1h",
    refresh_after="30m",
    on_refresh_start=lambda: log("Refreshing..."),
    on_refresh_complete=lambda val: log(f"Refreshed: {val}"),
    on_refresh_error=lambda e: alert(f"Refresh failed: {e}"),
)
```

### 8.3 Warm-up API
Explicitly warm the cache without blocking:
```python
fetch_data.warm(url="https://api.example.com")  # Async, returns immediately
```

### 8.4 Refresh Scheduling
Time-based scheduling (cron-like):
```python
@st.cache_data(refresh_schedule="0 6 * * *")  # Daily at 6 AM
```

---

## 9. Open Questions

1. **Should `refresh_after` require `ttl`?**
   - Yes (recommended): Ensures sensible behavior
   - No: More flexible but potentially confusing

2. **What happens if refresh takes longer than `ttl - refresh_after`?**
   - Entry might expire before refresh completes
   - Recommendation: Log warning, allow natural TTL expiration

3. **Should background refresh be disabled for functions using `st.*` elements?**
   - Option A: Always allow, document limitation
   - Option B: Detect `st.*` usage and disable/warn
   - Recommendation: Option A with clear documentation

4. **Thread pool configuration**
   - Should pool size be configurable via `st.set_option()`?
   - Default: 4 workers (reasonable for most apps)

5. **Interaction with `validate` parameter (`cache_resource`)**
   - Should `validate` be called on background-refreshed values?
   - Recommendation: Yes, validate before storing

---

## 10. Dependencies

### External Dependencies
- `concurrent.futures.ThreadPoolExecutor` (stdlib) - thread pool management
- `cachetools.TTLCache` (existing) - TTL cache implementation

### Internal Dependencies
- `lib/streamlit/runtime/caching/cache_utils.py`
- `lib/streamlit/runtime/caching/cache_data_api.py`
- `lib/streamlit/runtime/caching/cache_resource_api.py`
- `lib/streamlit/runtime/caching/storage/`
- `lib/streamlit/time_util.py`
- `lib/streamlit/runtime/runtime.py` (lifecycle management)

---

## 11. Appendix: Code Examples

### Example 1: Basic Usage

```python
import streamlit as st
from datetime import timedelta

@st.cache_data(ttl=timedelta(hours=1), refresh_after=timedelta(minutes=30))
def fetch_stock_prices(symbol: str):
    """Fetch stock prices from API."""
    import yfinance as yf
    return yf.Ticker(symbol).history(period="1d")

# First call: Cache miss, blocks while fetching
prices = fetch_stock_prices("AAPL")

# Subsequent calls within 30 min: Cache hit, instant return
prices = fetch_stock_prices("AAPL")

# Call after 30 min but before 1 hour:
# - Returns stale cached value immediately
# - Triggers background refresh
# - Next call gets fresh data
prices = fetch_stock_prices("AAPL")
```

### Example 2: With Error Handling

```python
@st.cache_data(ttl="1h", refresh_after="30m")
def fetch_data_with_fallback(url: str):
    try:
        return requests.get(url).json()
    except Exception:
        # If refresh fails, old cached value is preserved
        raise

# Background refresh failure is logged but doesn't affect app
data = fetch_data_with_fallback("https://api.example.com/data")
```

### Example 3: Resource Connection

```python
@st.cache_resource(ttl="1h", refresh_after="30m")
def get_database_connection():
    """Get or refresh database connection."""
    return psycopg2.connect(
        host="localhost",
        database="mydb",
        user="user",
        password="password"
    )

# Connection is refreshed in background to avoid stale connections
conn = get_database_connection()
```

---

## 12. References

- [Stale-While-Revalidate (RFC 5861)](https://tools.ietf.org/html/rfc5861)
- [Django Cacheback](https://django-cacheback.readthedocs.io/)
- [Guava Cache refreshAfterWrite](https://github.com/google/guava/wiki/CachesExplained#refresh)
- [GitHub Issue #5871](https://github.com/streamlit/streamlit/issues/5871)
- [cachetools Documentation](https://cachetools.readthedocs.io/)
