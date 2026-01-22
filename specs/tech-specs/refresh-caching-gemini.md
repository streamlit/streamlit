# Background Caching & Refresh Plan

## Goal
Enable Streamlit developers to configure cached functions (`st.cache_data`, `st.cache_resource`) to:
1.  Refresh automatically in the background (without blocking user interaction).
2.  Execute eagerly on app startup (warmup).

Ref: [Issue #5871](https://github.com/streamlit/streamlit/issues/5871)

## Problem Analysis
Currently, Streamlit's caching is "lazy": computation only happens when a user connects and requests the data. This blocks the user's script execution. For slow computations, this leads to poor UX.

Users want to:
-   Keep the cache "warm" by refreshing it periodically in the background.
-   Warm up the cache when the server starts, before any user connects.

## Core Challenges
1.  **Execution Context**: Streamlit functions (`st.write`, `st.spinner`) and the caching machinery (`CachedFunc`, `DeltaGenerator`) rely on `ScriptRunContext` (thread-local). Background threads don't have this by default.
2.  **Thread Safety**: `st.cache_resource` and `st.cache_data` are accessed by multiple sessions. Background updates must be atomic or properly locked (handled by `CachedFunc` logic, but we need to ensure we don't deadlock).
3.  **Message Capture**: `st.cache_data` captures "messages" (like `st.write` output) to replay them. Background execution must capture these messages so they can be replayed to *real* users later.

## Proposed Solution

### 1. API Design

Add a `refresh_every` (or `ttl` extension) and `warmup` parameter to the decorators.

```python
@st.cache_data(ttl="1h", refresh_every="30m")
def fetch_data():
    ...

@st.cache_resource(warmup=True)
def load_model():
    ...
```
*   `refresh_every`: Time interval to refresh the cache. If the entry is older than this, a background task is triggered. The current request might return the old data (stale-while-revalidate) or wait (if `ttl` is also expired).
*   `warmup`: If True, the function is called once at app startup with default arguments (if possible, or maybe strictly for 0-arg functions).

### 2. Architecture Components

#### A. `CacheRefreshManager`
A singleton service within `Runtime` responsible for:
-   Tracking functions that need background refresh.
-   Scheduling refresh tasks.
-   Managing the thread pool for background execution.

#### B. `BackgroundScriptRunContext`
A specialized `ScriptRunContext` for background tasks.
-   **Session ID**: "background" (or unique task ID).
-   **Cursor**: A "null" or "capturing" cursor that accepts `st.write` calls but doesn't try to send them to a browser.
-   **State**: Isolated `SessionState`.

#### C. `CachedFunc` Modifications
Update `CachedFunc` to register itself with `CacheRefreshManager` if `refresh_every` is set.

### 3. Implementation Steps

#### Phase 1: Background Execution Logic (The "How")
Implement the mechanism to run a cached function in a background thread while properly updating the cache.

*   Create `BackgroundScriptRunContext`.
*   Implement `CacheRefreshManager.refresh_cache_entry(func, args, kwargs)`.
    *   Acquire `compute_value_lock`.
    *   Set up `BackgroundScriptRunContext`.
    *   Call `func`.
    *   Update cache storage (value + messages).

#### Phase 2: Scheduling (The "When")
*   Integrate a lightweight scheduler (or simple `asyncio.sleep` loops if keeping it simple) in `CacheRefreshManager`.
*   When `CachedFunc` is accessed, if it's "stale" (older than `refresh_every` but younger than `ttl`), return the current value immediately and trigger a background refresh.

#### Phase 3: API & Hooks
*   Update `@st.cache_data` and `@st.cache_resource` signatures.
*   Update `Runtime` to initialize `CacheRefreshManager`.
*   Implement "Eager Execution":
    *   Registry of `warmup` functions.
    *   `Runtime` iterates and triggers them on startup.

## Detailed Investigation Findings

*   **Locking**: `CachedFunc` uses per-key locking. Background refresh can safely acquire this lock. If a user request comes in during refresh:
    *   If strictly blocking: User waits (same as now).
    *   If Stale-While-Revalidate: We need to check if "stale" data is available and return it while background works. Currently `CachedFunc` clears or overwrites. We might need a "grace period".
*   **Context**: `st.cache_data` works without context for *reading*, but needs it for *writing* (computing). `reproduce_background_cache.py` confirmed we can manually set a context in a thread and successfully update the cache.
*   **Message Replay**: `CachedMessageReplayContext` works by intercepting `DeltaGenerator` calls. As long as `in_cached_function` is set and a valid (dummy) cursor exists, messages will be captured correctly.

## Roadmap

1.  **Prototype `BackgroundScriptRunContext`**: Ensure `st.write` doesn't crash and messages are captured.
2.  **Implement `CacheRefreshManager`**: Basic threaded worker.
3.  **Modify `CachedFunc`**: Add the "trigger refresh" logic on access.
4.  **Add `refresh_every` param**: Expose to users.
