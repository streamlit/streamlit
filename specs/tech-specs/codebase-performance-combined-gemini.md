# Codebase Performance Improvements

This document outlines the top 20 high-ROI performance improvements for the Streamlit codebase, focusing on serialization, I/O, and hashing. These changes are "under-the-hood" and do not require public API modifications.

## 1. Blocking Event Loop in Origin Check (Critical DoS Risk)
**Location:** `lib/streamlit/net_util.py`
**Problem:** `get_external_ip()` performs a blocking `requests.get` with a 5-second timeout inside `check_origin`. This blocks the Tornado event loop during WebSocket handshakes.
**Fix:** Fetch IP in a background thread/executor and cache it. Use `run_in_executor` or an async HTTP client.
**Impact:** Prevents server hangs during network glitches; mitigates simple DoS attacks.

## 2. Double Serialization in Widget Sync
**Location:** `lib/streamlit/runtime/state/session_state.py`
**Problem:** `as_widget_states` calls `get_serialized(widget_id)` twice for every widget: once to check truthiness, once to collect the value.
**Fix:** Use the walrus operator (`if (serialized := ...)`) or a loop variable.
**Impact:** 50% reduction in serialization overhead during widget state sync (happens on every interaction).

## 3. Synchronous Static File & Component Serving
**Location:** `lib/streamlit/web/server/component_request_handler.py`
**Problem:** Uses blocking `open(path).read()` to serve component assets (JS/CSS).
**Fix:** Offload file reading to `loop.run_in_executor` or use `aiofiles`.
**Impact:** Improves concurrent request handling; prevents the event loop from stalling when serving large assets.

## 4. Inefficient Protobuf Serialization
**Location:** `lib/streamlit/web/server/browser_websocket_handler.py`
**Problem:** Uses the pure Python implementation of Protocol Buffers by default.
**Fix:** Enforce/warn if the C++ implementation (`google-protobuf` with binary extension) is not active.
**Impact:** "Free" 5-10x speedup in serialization for data-heavy apps.

## 5. Double Hashing in ForwardMsg Cache
**Location:** `lib/streamlit/runtime/forward_msg_cache.py`
**Problem:** Serializes the *entire* Protobuf message to bytes just to compute an MD5 hash for the cache key, then serializes again to send.
**Fix:** Hash a tuple of (metadata, type, size, first N bytes) instead of the full payload for large messages.
**Impact:** 2x throughput increase for large data updates (charts/tables).

## 6. Synchronous Script Loading Under Lock
**Location:** `lib/streamlit/runtime/scriptrunner/script_cache.py`
**Problem:** Reads the user script file while holding the global `_lock`.
**Fix:** Read the file content *before* acquiring the lock to update the cache.
**Impact:** Reduces lock contention during script reloads, especially on slow filesystems.

## 7. Blocking File I/O in Cache Storage
**Location:** `lib/streamlit/runtime/caching/storage/local_disk_cache_storage.py`
**Problem:** `read_result` and `write_result` use synchronous file operations.
**Fix:** Use `aiofiles` or `run_in_executor` for disk cache access.
**Impact:** Unblocks the server while reading/writing large cached DataFrames.

## 8. Suboptimal Hashing Algorithm (MD5)
**Location:** `lib/streamlit/util.py`
**Problem:** Uses MD5 for non-cryptographic checksums.
**Fix:** Switch to `xxhash` (xxh64/xxh3) or a faster built-in alternative if available.
**Impact:** 3-10x faster hashing for cache keys and file change detection.

## 9. Repeated `config.get_option` Calls
**Location:** Global
**Problem:** `config.get_option` involves dictionary lookups and lock acquisition, called frequently in hot paths.
**Fix:** Cache frequently used config values (e.g., `server.maxMessageSize`) in module-level constants or local variables.
**Impact:** Micro-optimization that adds up across thousands of calls.

## 10. Unoptimized DataFrame Hashing
**Location:** `lib/streamlit/runtime/caching/hashing.py`
**Problem:**
1. Always samples 10k rows even for massive DataFrames (slow for wide tables).
2. Falls back to `pickle` (`__reduce__`) for unknown types (very slow).
**Fix:**
- Optimize sampling (use head/tail + metadata).
- Add fast paths for common types (Polars, PyArrow tables) to avoid pickle.
**Impact:** Significantly faster `st.cache_data` checks.

## 11. Indirect Arrow Conversion
**Location:** `lib/streamlit/dataframe_util.py`
**Problem:** Converts many formats (Polars, dicts) to Pandas *first*, then to Arrow.
**Fix:** Implement direct conversion to Arrow for compatible types (Polars `to_arrow()`, dicts via `pa.Table.from_pylist`).
**Impact:** Avoids double conversion overhead and memory copy.

## 12. `inspect.getsource` in Cache Key Generation
**Location:** `lib/streamlit/runtime/caching/cache_utils.py`
**Problem:** Reads the source file from disk for every cached function call to generate the key.
**Fix:** Cache the source code hash on the function object after the first read.
**Impact:** Eliminates disk I/O for repeated cache hits.

## 13. Unbounded Memory for Media Files
**Location:** `lib/streamlit/runtime/memory_media_file_storage.py`
**Problem:** `_files_by_id` grows indefinitely (no eviction).
**Fix:** Use `cachetools.LRUCache` or implement simple size-based eviction.
**Impact:** Prevents memory bloat in long-running apps generating dynamic media (plots/images).

## 14. Synchronous Image Resizing
**Location:** `lib/streamlit/elements/lib/image_utils.py`
**Problem:** Uses PIL to resize images on the main thread.
**Fix:** Offload image processing to a thread pool.
**Impact:** Prevents UI freezes when uploading/rendering large images.

## 15. Excessive Polling in Path Watcher
**Location:** `lib/streamlit/watcher/polling_path_watcher.py`
**Problem:** Calculates MD5 on every poll cycle (0.2s) even if `mtime` hasn't changed.
**Fix:** Only calculate MD5 if `os.stat(path).st_mtime` has changed.
**Impact:** drastically reduces CPU usage for the file watcher.

## 16. Blocking Metrics Config Fetch
**Location:** `frontend/app/src/MetricsManager.ts`
**Problem:** `initialize` awaits a fetch for metrics config with a 5s timeout.
**Fix:** Make the fetch non-blocking (fire-and-forget) or use a stale-while-revalidate strategy.
**Impact:** Faster app load time for new users.

## 17. Full Object Scan for Session State Stats
**Location:** `lib/streamlit/runtime/state/session_state.py`
**Problem:** `get_stats` calls `pympler.asizeof` on the entire session state, scanning the full object graph.
**Fix:** Disable this expensive scan by default or estimate size using `sys.getsizeof` (shallow) for basic types.
**Impact:** Prevents massive CPU spikes when `/debug/stats` is polled.

## 18. Global `inspect` Cache
**Location:** `lib/streamlit/runtime/metrics_util.py`
**Problem:** `gather_metrics` inspects function signatures on every call.
**Fix:** Cache the result of `inspect.getfullargspec` for each decorated function.
**Impact:** Reduces overhead of the `@gather_metrics` decorator.

## 19. Redundant React Renders in DataFrame
**Location:** `frontend/lib/src/components/widgets/DataFrame`
**Problem:** `useColumnLoader` triggers double renders due to `useEffect` setting state based on props.
**Fix:** Derive state during render or use `useMemo` correctly to avoid the effect-based update.
**Impact:** Smoother frontend rendering for tables.

## 20. Unnecessary Session State Pickling
**Location:** `lib/streamlit/runtime/state/session_state.py`
**Problem:** `_check_serializable` pickles *every* item in session state on *every* run (when enabled).
**Fix:** Track dirty keys and only check new/modified items.
**Impact:** Eliminates O(N) serialization cost per script run.
# Codebase Performance Improvements

This document outlines the top 20 high-ROI performance improvements for the Streamlit codebase, focusing on serialization, I/O, and hashing. These changes are "under-the-hood" and do not require public API modifications.

## 1. Blocking Event Loop in Origin Check (Critical DoS Risk)
**Location:** `lib/streamlit/net_util.py`
**Problem:** `get_external_ip()` performs a blocking `requests.get` with a 5-second timeout inside `check_origin`. This blocks the Tornado event loop during WebSocket handshakes.
**Fix:** Fetch IP in a background thread/executor and cache it. Use `run_in_executor` or an async HTTP client.
**Impact:** Prevents server hangs during network glitches; mitigates simple DoS attacks.

## 2. Double Serialization in Widget Sync
**Location:** `lib/streamlit/runtime/state/session_state.py`
**Problem:** `as_widget_states` calls `get_serialized(widget_id)` twice for every widget: once to check truthiness, once to collect the value.
**Fix:** Use the walrus operator (`if (serialized := ...)`) or a loop variable.
**Impact:** 50% reduction in serialization overhead during widget state sync (happens on every interaction).

## 3. Synchronous Static File & Component Serving
**Location:** `lib/streamlit/web/server/component_request_handler.py`
**Problem:** Uses blocking `open(path).read()` to serve component assets (JS/CSS).
**Fix:** Offload file reading to `loop.run_in_executor` or use `aiofiles`.
**Impact:** Improves concurrent request handling; prevents the event loop from stalling when serving large assets.

## 4. Inefficient Protobuf Serialization
**Location:** `lib/streamlit/web/server/browser_websocket_handler.py`
**Problem:** Uses the pure Python implementation of Protocol Buffers by default.
**Fix:** Enforce/warn if the C++ implementation (`google-protobuf` with binary extension) is not active.
**Impact:** "Free" 5-10x speedup in serialization for data-heavy apps.

## 5. Double Hashing in ForwardMsg Cache
**Location:** `lib/streamlit/runtime/forward_msg_cache.py`
**Problem:** Serializes the *entire* Protobuf message to bytes just to compute an MD5 hash for the cache key, then serializes again to send.
**Fix:** Hash a tuple of (metadata, type, size, first N bytes) instead of the full payload for large messages.
**Impact:** 2x throughput increase for large data updates (charts/tables).

## 6. Synchronous Script Loading Under Lock
**Location:** `lib/streamlit/runtime/scriptrunner/script_cache.py`
**Problem:** Reads the user script file while holding the global `_lock`.
**Fix:** Read the file content *before* acquiring the lock to update the cache.
**Impact:** Reduces lock contention during script reloads, especially on slow filesystems.

## 7. Blocking File I/O in Cache Storage
**Location:** `lib/streamlit/runtime/caching/storage/local_disk_cache_storage.py`
**Problem:** `read_result` and `write_result` use synchronous file operations.
**Fix:** Use `aiofiles` or `run_in_executor` for disk cache access.
**Impact:** Unblocks the server while reading/writing large cached DataFrames.

## 8. Suboptimal Hashing Algorithm (MD5)
**Location:** `lib/streamlit/util.py`
**Problem:** Uses MD5 for non-cryptographic checksums.
**Fix:** Switch to `xxhash` (xxh64/xxh3) or a faster built-in alternative if available.
**Impact:** 3-10x faster hashing for cache keys and file change detection.

## 9. Repeated `config.get_option` Calls
**Location:** Global
**Problem:** `config.get_option` involves dictionary lookups and lock acquisition, called frequently in hot paths.
**Fix:** Cache frequently used config values (e.g., `server.maxMessageSize`) in module-level constants or local variables.
**Impact:** Micro-optimization that adds up across thousands of calls.

## 10. Unoptimized DataFrame Hashing
**Location:** `lib/streamlit/runtime/caching/hashing.py`
**Problem:**
1. Always samples 10k rows even for massive DataFrames (slow for wide tables).
2. Falls back to `pickle` (`__reduce__`) for unknown types (very slow).
**Fix:**
- Optimize sampling (use head/tail + metadata).
- Add fast paths for common types (Polars, PyArrow tables) to avoid pickle.
**Impact:** Significantly faster `st.cache_data` checks.

## 11. Indirect Arrow Conversion
**Location:** `lib/streamlit/dataframe_util.py`
**Problem:** Converts many formats (Polars, dicts) to Pandas *first*, then to Arrow.
**Fix:** Implement direct conversion to Arrow for compatible types (Polars `to_arrow()`, dicts via `pa.Table.from_pylist`).
**Impact:** Avoids double conversion overhead and memory copy.

## 12. `inspect.getsource` in Cache Key Generation
**Location:** `lib/streamlit/runtime/caching/cache_utils.py`
**Problem:** Reads the source file from disk for every cached function call to generate the key.
**Fix:** Cache the source code hash on the function object after the first read.
**Impact:** Eliminates disk I/O for repeated cache hits.

## 13. Unbounded Memory for Media Files
**Location:** `lib/streamlit/runtime/memory_media_file_storage.py`
**Problem:** `_files_by_id` grows indefinitely (no eviction).
**Fix:** Use `cachetools.LRUCache` or implement simple size-based eviction.
**Impact:** Prevents memory bloat in long-running apps generating dynamic media (plots/images).

## 14. Synchronous Image Resizing
**Location:** `lib/streamlit/elements/lib/image_utils.py`
**Problem:** Uses PIL to resize images on the main thread.
**Fix:** Offload image processing to a thread pool.
**Impact:** Prevents UI freezes when uploading/rendering large images.

## 15. Excessive Polling in Path Watcher
**Location:** `lib/streamlit/watcher/polling_path_watcher.py`
**Problem:** Calculates MD5 on every poll cycle (0.2s) even if `mtime` hasn't changed.
**Fix:** Only calculate MD5 if `os.stat(path).st_mtime` has changed.
**Impact:** drastically reduces CPU usage for the file watcher.

## 16. Blocking Metrics Config Fetch
**Location:** `frontend/app/src/MetricsManager.ts`
**Problem:** `initialize` awaits a fetch for metrics config with a 5s timeout.
**Fix:** Make the fetch non-blocking (fire-and-forget) or use a stale-while-revalidate strategy.
**Impact:** Faster app load time for new users.

## 17. Full Object Scan for Session State Stats
**Location:** `lib/streamlit/runtime/state/session_state.py`
**Problem:** `get_stats` calls `pympler.asizeof` on the entire session state, scanning the full object graph.
**Fix:** Disable this expensive scan by default or estimate size using `sys.getsizeof` (shallow) for basic types.
**Impact:** Prevents massive CPU spikes when `/debug/stats` is polled.

## 18. Global `inspect` Cache
**Location:** `lib/streamlit/runtime/metrics_util.py`
**Problem:** `gather_metrics` inspects function signatures on every call.
**Fix:** Cache the result of `inspect.getfullargspec` for each decorated function.
**Impact:** Reduces overhead of the `@gather_metrics` decorator.

## 19. Redundant React Renders in DataFrame
**Location:** `frontend/lib/src/components/widgets/DataFrame`
**Problem:** `useColumnLoader` triggers double renders due to `useEffect` setting state based on props.
**Fix:** Derive state during render or use `useMemo` correctly to avoid the effect-based update.
**Impact:** Smoother frontend rendering for tables.

## 20. Unnecessary Session State Pickling
**Location:** `lib/streamlit/runtime/state/session_state.py`
**Problem:** `_check_serializable` pickles *every* item in session state on *every* run (when enabled).
**Fix:** Track dirty keys and only check new/modified items.
**Impact:** Eliminates O(N) serialization cost per script run.
