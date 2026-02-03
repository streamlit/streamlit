# Top Performance Tasks (Re-verified Jan 23, 2026)

## Methodology
- Verified against the current codebase in this workspace.
- Scope weighting: Starlette or shared code = 1.0, Tornado-only legacy = 0.5 (de-prioritized since Tornado is planned for removal).
- Impact scale: Critical=5, High=4, Medium=3, Low=2.
- Complexity scale: Low=1, Medium=2, High=3.
- Priority score = (Impact * Scope) - (0.5 * Complexity).
- Ranked by score (desc). Critical blockers are kept near the top even when complexity is higher.

## Combined Ranking (Impact x Complexity x Scope)
| Rank | Task | Impact | Complexity | Scope | Status | Score | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Blocking external IP lookup during origin checks (prefetch/cache async) | Critical | Medium | Starlette + Tornado | Still present | 4.0 | `lib/streamlit/net_util.py:34`, `lib/streamlit/web/server/server_util.py:65`, `lib/streamlit/web/server/starlette/starlette_websocket.py:104` |
| 2 | Cache `inspect.getfullargspec` per command in metrics_util | High | Low | Shared | Still present | 3.5 | `lib/streamlit/runtime/metrics_util.py:369` |
| 3 | Direct Arrow conversion paths (avoid pandas fallback) | High | Medium | Shared | Still present | 3.0 | `lib/streamlit/dataframe_util.py:884` |
| 4 | LocalDiskCacheStorage sync disk I/O on main thread | High | Medium | Shared | Still present | 3.0 | `lib/streamlit/runtime/caching/storage/local_disk_cache_storage.py:137` |
| 5 | ForwardMsg double serialization/hashing | High | Medium | Shared | Still present | 3.0 | `lib/streamlit/runtime/forward_msg_cache.py:36`, `lib/streamlit/runtime/runtime_util.py:66` |
| 6 | Session state pickling every rerun when enforceSerializable is on | High | Medium | Shared | Still present | 3.0 | `lib/streamlit/runtime/state/session_state.py:954` |
| 7 | Replace MD5 with faster non-crypto hash (xxhash) | Medium | Low | Shared | Still present | 2.5 | `lib/streamlit/util.py:68` |
| 8 | Adaptive debounce for DataFrame widget state updates | Medium | Low | Frontend | Still present | 2.5 | `frontend/lib/src/components/widgets/DataFrame/hooks/useWidgetState.ts:36` |
| 9 | Metrics config fetch blocks up to 5s before fallback | Medium | Low | Frontend | Still present | 2.5 | `frontend/app/src/MetricsManager.ts:164` |
| 10 | `pympler.asizeof()` for session_state stats | Medium | Low | Shared | Still present | 2.5 | `lib/streamlit/runtime/state/session_state.py:942` |
| 11 | Double `get_serialized()` call in `as_widget_states()` | Medium | Low | Shared | Still present | 2.5 | `lib/streamlit/runtime/state/session_state.py:254` |
| 12 | Starlette component asset serving reads full file into memory | Medium | Low | Starlette | New (starlette review) | 2.5 | `lib/streamlit/web/server/starlette/starlette_routes.py:687` |
| 13 | Starlette upload reads full multipart body (no streaming) | Medium | Medium | Starlette | Still present (starlette) | 2.0 | `lib/streamlit/web/server/starlette/starlette_routes.py:612` |
| 14 | MediaFileManager orphan cleanup is O(N) scan each run | Medium | Medium | Shared | Still present | 2.0 | `lib/streamlit/runtime/media_file_manager.py:121` |
| 15 | Script cache reads file while holding global lock | Medium | Medium | Shared | Still present | 2.0 | `lib/streamlit/runtime/scriptrunner/script_cache.py:61` |
| 16 | DOMPurify sanitization on main thread | Medium | Medium | Frontend | Still present | 2.0 | `frontend/lib/src/components/elements/Html/SanitizedHtml.tsx:25` |
| 17 | Heavy imports in `streamlit/__init__.py` slow startup | Medium | Medium | Shared | Still present | 2.0 | `lib/streamlit/__init__.py:60` |
| 18 | SHA-224 hashing of all media bytes for IDs | Medium | Medium | Shared | Still present | 2.0 | `lib/streamlit/runtime/memory_media_file_storage.py:53` |
| 19 | Tornado component handler sync file reads | High | Low | Tornado only (legacy) | Still present | 1.5 | `lib/streamlit/web/server/component_request_handler.py:55` |
| 20 | UploadedFileManager stats recompute entire storage | Low | Low | Shared | Still present | 1.5 | `lib/streamlit/runtime/memory_uploaded_file_manager.py:120` |
| 21 | Polling watcher MD5 when mtime=0.0 (e.g., s3fs/fuse) | Low | Low | Shared | Partially addressed | 1.5 | `lib/streamlit/watcher/polling_path_watcher.py:100` |
| 22 | Tornado upload parses body before session validation | Medium | Medium | Tornado only (legacy) | Still present | 0.5 | `lib/streamlit/web/server/upload_file_request_handler.py:107` |

## Validation Notes vs Original List
- Item 1 is still blocking and now affects Starlette WebSocket handshakes too. `is_url_from_allowed_origins()` still calls `net_util.get_external_ip()` synchronously. Suggest prefetching external IP on startup or offloading to a thread and caching the result. Evidence: `lib/streamlit/net_util.py:34`, `lib/streamlit/web/server/server_util.py:65`, `lib/streamlit/web/server/starlette/starlette_websocket.py:104`.
- Item 2 (component serving) is fixed for Starlette (async open_file) but still sync in Tornado. Because Tornado is legacy, it is deprioritized in the score. Evidence: `lib/streamlit/web/server/component_request_handler.py:55`, `lib/streamlit/web/server/starlette/starlette_routes.py:687`.
- Item 11 (uploads) is improved in Starlette (session validated before body read + Content-Length check) but still reads full multipart body. Tornado still parses body before session validation. Evidence: `lib/streamlit/web/server/starlette/starlette_routes.py:586`, `lib/streamlit/web/server/upload_file_request_handler.py:107`.
- Item 20 (polling watcher MD5) now short-circuits when mtime is unchanged. It only still computes MD5 every poll when mtime is always 0.0 (s3fs/fuse). Evidence: `lib/streamlit/watcher/polling_path_watcher.py:100`.

## New Findings from Starlette Review
1) Starlette component assets are read fully into memory for every request. Switching to `FileResponse` or `StreamingResponse` would avoid large memory copies and enable sendfile optimizations. Evidence: `lib/streamlit/web/server/starlette/starlette_routes.py:687`, `lib/streamlit/web/server/starlette/starlette_routes.py:780`.

## Quick Takeaways
- Highest leverage: external IP lookup blocking origin checks (critical event-loop stall) and Arrow direct conversion paths.
- Highest ROI quick wins: caching `inspect.getfullargspec`, avoiding double `get_serialized`, MD5 -> xxhash swap, adaptive debounce, metrics config async fetch.
- Starlette-specific follow-ups: streaming uploads and component asset serving without full reads.
- Tornado-only items are noted but deliberately down-weighted.
