# Streamlit Codebase Performance Improvements

This document outlines 15 small-to-medium complexity performance improvements for the Streamlit codebase. These changes focus on "under-the-hood" optimizations with high ROI, targeting serialization, I/O, and frontend rendering.

## 1. Optimize Protobuf Serialization with C++ Implementation
**Location:** `lib/streamlit/web/server/browser_websocket_handler.py`, `lib/streamlit/web/server/stats_request_handler.py`
**Issue:** Streamlit uses the default Python implementation of Protocol Buffers. For large messages (e.g., big DataFrames or charts), this is significantly slower than the C++ implementation.
**Improvement:** Ensure the environment uses the C++ implementation of protobuf (`google-protobuf` wheel with binary extension). Verify this at runtime and log a warning if the pure Python implementation is being used.
**ROI:** High (faster message serialization for all data-heavy apps).

## 2. Non-Blocking File I/O for Static Assets
**Location:** `lib/streamlit/web/server/component_request_handler.py`, `lib/streamlit/web/server/app_static_file_handler.py`
**Issue:** Static files and component assets are read using synchronous `open()` and `read()` calls within the async Tornado event loop.
**Improvement:** Use `aiofiles` or `loop.run_in_executor` to offload file reading to a thread pool.
**ROI:** Medium (prevents event loop blocking during concurrent static asset requests).

## 3. Async Script Loading
**Location:** `lib/streamlit/runtime/scriptrunner/script_cache.py`
**Issue:** `ScriptCache` reads user scripts synchronously using `open_python_file`. For large scripts or network-mounted filesystems, this blocks the server reload cycle.
**Improvement:** Switch to asynchronous file reading for the script content before compilation.
**ROI:** Low/Medium (smoother reloads, especially in enterprise environments with slow disks).

## 4. Optimized Hashing for Large DataFrames
**Location:** `lib/streamlit/runtime/caching/hashing.py`
**Issue:** The current hashing logic for DataFrames samples rows using `random_state=0`. While this limits work, it can still be slow for very wide DataFrames or complex types. It also falls back to `__reduce__` (pickle) for unknown types, which is slow.
**Improvement:**
- Optimize the sampling strategy to prioritize cheap metadata (shape, dtypes, index) and contiguous memory blocks.
- Avoid `__reduce__` fallback where possible; use specialized fast-path hashers for common third-party types.
**ROI:** High (faster `st.cache_data` hits/misses).

## 5. Avoid Redundant JSON Parsing in BidiComponents
**Location:** `frontend/lib/src/components/widgets/BidiComponent/BidiComponentContextProvider.tsx`
**Issue:** `getWidgetValue` calls `JSON.parse(raw)` on every access. While memoized, the raw string might change frequently.
**Improvement:** Store the parsed JSON value in the widget state if possible, or optimize the memoization strategy to avoid re-parsing identical strings (hash check).
**ROI:** Medium (smoother interaction for custom components sending frequent updates).

## 6. Lazy Import of Heavy Dependencies in Stats Handler
**Location:** `lib/streamlit/web/server/stats_request_handler.py`
**Issue:** The handler performs imports inside the method (`from streamlit.proto...`). While intended for lazy loading, repeated imports in Python still incur a small dictionary lookup overhead.
**Improvement:** Move these imports to module level (if safe) or ensure they are truly one-time lazy imports. More importantly, avoid constructing the Protobuf message if the client accepts plain text (OpenMetrics), which is lighter.
**ROI:** Low (micro-optimization for metrics scraping).

## 7. Reduce React Render Churn in DataFrame
**Location:** `frontend/lib/src/components/widgets/DataFrame/DataFrame.tsx`, `useColumnLoader.ts`
**Issue:** `useColumnLoader` and `useDataEditor` have complex dependency arrays. `parsedColumnConfig` is memoized but `setColumnConfigMapping` is called in `useEffect`, triggering a potential double render on prop changes.
**Improvement:**
- Derive `columnConfigMapping` directly during render if possible (state derivation), avoiding the `useEffect` + `useState` sync pattern.
- Tighten dependency arrays to primitives where possible.
**ROI:** Medium (faster table rendering and interaction).

## 8. Optimize "ForwardMsg" Hashing
**Location:** `lib/streamlit/runtime/forward_msg_cache.py`
**Issue:** `populate_hash_if_needed` computes an MD5 hash of the *entire* serialized protobuf message. For large messages (e.g., 100MB DataFrame), this doubles the serialization work (serialize + hash).
**Improvement:**
- As per the TODO: "Only hash the first N bytes of the message" + total length + type.
- Or use a faster non-cryptographic hash (e.g., `xxhash`) if available, as we only need collision resistance for cache keys, not security.
**ROI:** High (reduces latency for large data updates).

## 9. Debounce Widget State Updates More Intelligently
**Location:** `frontend/lib/src/components/widgets/DataFrame/DataFrame.tsx`
**Issue:** `DEBOUNCE_TIME_MS` is fixed at 150ms.
**Improvement:** Implement a dynamic debounce or "trailing edge" optimization. For example, allow immediate updates for small payloads but debounce larger ones. Or use `requestIdleCallback` to process state updates when the main thread is free.
**ROI:** Medium (responsiveness).

## 10. Efficient Arrow Serialization
**Location:** `lib/streamlit/components/v2/bidi_component/serialization.py`
**Issue:** `_extract_dataframes_from_dict` traverses the dictionary and serializes DataFrames to Arrow bytes one by one.
**Improvement:**
- If multiple DataFrames share the same schema, use a batched serialization approach.
- Cache Arrow serialization results for identical DataFrame objects (using object ID or fast hash) if they are reused across reruns.
**ROI:** Medium (faster reruns for apps using custom components with data).

## 11. Avoid "pickle.dumps" for Simple Session State Checks
**Location:** `lib/streamlit/runtime/state/session_state.py`
**Issue:** `_check_serializable` iterates through *all* session state items and attempts to `pickle.dumps` them to verify serializability. This is extremely expensive for large objects.
**Improvement:**
- Only check *new* or *modified* keys.
- Use a "known safe" allowlist (int, str, float, bool, list/dict of primitives) to skip pickle checks for common types.
**ROI:** High (removes a massive overhead at the end of every script run).

## 12. Use "aiofiles" for Media File Manager
**Location:** `lib/streamlit/runtime/media_file_manager.py`
**Issue:** Reading/writing media files (images, audio) is synchronous.
**Improvement:** Convert `add` and `read` operations to use async file I/O where backing storage is on disk.
**ROI:** Medium (reduces blocking when serving media).

## 13. Optimize "format" String Operations
**Location:** `lib/streamlit/runtime/runtime_util.py` (and others)
**Issue:** Extensive use of f-strings and format calls in logging or error paths that might not be taken.
**Improvement:** Use lazy logging interpolation (`logger.debug("Msg %s", arg)`) instead of eager f-strings (`logger.debug(f"Msg {arg}")`) for debug logs.
**ROI:** Low (micro-optimization).

## 14. Reduce CSS-in-JS Injection Overhead
**Location:** `frontend/lib/src/theme/utils.ts` (and usage)
**Issue:** Streamlit uses Emotion. Dynamic style generation based on props can be expensive if not correctly memoized.
**Improvement:** Verify that static styles are defined outside components and dynamic styles use the `css` prop efficiently without re-parsing styles on every render.
**ROI:** Medium (frontend interaction speed).

## 15. Faster "import streamlit" Time
**Location:** `lib/streamlit/__init__.py`
**Issue:** Importing `streamlit` triggers many sub-imports.
**Improvement:**
- Lazy import heavy submodules (e.g., `streamlit.elements.map` or `streamlit.charts`) inside the functions that need them, rather than at the top level.
- Use `TYPE_CHECKING` blocks to avoid runtime imports for typing.
**ROI:** Medium (faster app startup and CLI responsiveness).
