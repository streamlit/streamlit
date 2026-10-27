---
author: lukasmasuch
created: 2026-05-02
---

# Local Storage API (`st.local_storage`)

## Summary

Add a first-class API for reading and writing browser localStorage in Streamlit apps,
enabling persistent client-side storage for larger data that survives page refreshes and
browser sessions.

## Problem

Streamlit apps cannot persist client-side state across page refreshes. `st.session_state`
is server-side and lost on refresh. While cookies work for small data (~4KB), many use
cases need more storage capacity.

**Requests:**

- [#5105](https://github.com/streamlit/streamlit/issues/5105) — localStorage access (50+
  upvotes)
- [#13609](https://github.com/streamlit/streamlit/issues/13609) — Widget binding to
  localStorage

**Use cases:**

1. **User scores/progress** — Track game scores, quiz results, learning progress
2. **UI state persistence** — Remember filters, settings, view configurations
3. **Draft preservation** — Store larger form data, chat history, document drafts
4. **Watchlists/saved items** — User-curated lists without server-side storage
5. **Offline-first data** — Cache data locally for better performance

**Current workarounds** (all have significant limitations):

- `streamlit_javascript` / `streamlit_js` — Requires extra reruns, timing issues,
  double-loads
- Custom components with `localStorage` — Same rerun/timing issues as cookie components
- `st.cookies` (proposed) — Limited to ~4KB per cookie

**Cookies vs localStorage:**

| Feature         | Cookies                       | localStorage               |
|-----------------|-------------------------------|----------------------------|
| Size limit      | ~4KB per cookie               | ~5-10MB total              |
| Sent to server  | Yes (every HTTP request)      | Yes (snapshot synced to Streamlit backend on session connect) |
| Expiration      | Configurable                  | Persistent until cleared   |
| HTTP-only       | Yes                           | No (always JS-accessible)  |
| Best for        | Auth tokens, session IDs      | Larger user data, prefs    |

## Proposal

### API Options

**Option 1: New `st.local_storage` namespace** ✅ PREFERRED

```python
st.local_storage["scores"] = {"level1": 100, "level2": 85}
scores = st.local_storage.get("scores", {})
del st.local_storage["scores"]
```

- Pros: Mirrors `st.session_state` pattern, clear separation, supports JSON natively
- Cons: New top-level namespace

**Option 2: Extend `st.context`**

```python
st.context.local_storage["scores"] = data
```

- Pros: Groups browser-side state together
- Cons: `st.context` is conceptually read-only (request snapshot)

**Option 3: Unified `st.browser_storage`**

```python
st.browser_storage.local["scores"] = data
st.browser_storage.session["temp"] = data  # sessionStorage
```

- Pros: Future-proof for sessionStorage
- Cons: Extra nesting, sessionStorage rarely needed (we have `st.session_state`)

### API (Option 1)

```python
import streamlit as st

# Read (returns None if not found)
scores = st.local_storage.get("scores")
scores = st.local_storage["scores"]  # KeyError if not found

# Write (auto-serializes to JSON, persisted to browser localStorage)
# Note: Values are readable only after a full page reload (see Timing section)
st.local_storage["scores"] = {"level1": 100, "level2": 85}
st.local_storage["theme"] = "dark"

# Write with expiration (optional)
st.local_storage.set("session_cache", data, expires_in=timedelta(hours=24))

# Delete
del st.local_storage["theme"]
st.local_storage.delete("theme")

# Clear all app data
st.local_storage.clear()

# Check/iterate
if "scores" in st.local_storage: ...
for key in st.local_storage: ...
```

### `st.local_storage.set()` Parameters

```python
def set(
    key: str,
    value: Any,  # JSON-serializable
    *,
    expires_in: timedelta | None = None,  # Auto-delete after duration
) -> None:
```

**Expiration behavior:** If `expires_in` is set, the value is stored with a timestamp.
On read, if expired, returns `None` (or raises `KeyError`) and queues deletion. This is
implemented in Python, not a browser feature.

**Multi-tab behavior:** `localStorage` is shared across all browser tabs for the same
origin. If a user has the same app open in multiple tabs, each tab has its own WebSocket
session with its own server-side snapshot. A write in Tab A updates the browser's
localStorage, but Tab B's server-side snapshot won't reflect it until Tab B reconnects
or reloads. This is a known limitation; apps requiring real-time cross-tab sync should
use explicit polling or document this behavior to users.

### Behavior

**Timing:**

Values written with `st.local_storage` are queued during the script run and sent to the
browser via `ForwardMsg` after the run completes. They are **not** readable in the same
run. Read-after-write becomes visible only after a **full page reload or new browser
connection**, when the backend receives a fresh `LocalStorageSnapshot` from the browser
during session initialization.

```python
st.local_storage["draft"] = "my text"  # Queued and sent to browser after this run
st.rerun()                             # Does not make the new value readable yet

# Same live session: st.local_storage.get("draft") may still return old value
# After a full browser reload / reconnect:
# st.local_storage["draft"] == "my text"
```

**Auto-serialization:**

Unlike cookies (string-only), localStorage automatically serializes/deserializes JSON:

```python
st.local_storage["prefs"] = {"theme": "dark", "lang": "en"}  # Auto JSON.stringify
prefs = st.local_storage["prefs"]  # Auto JSON.parse -> dict
```

**Namespacing:**

Keys are automatically namespaced per-app to prevent cross-app collisions:

```
st_ls_{app_id}_{key}
```

Where `app_id` is derived from the app's URL path (e.g., a hash of the path). This
prevents one app from reading/overwriting another app's data on the same domain.

**Note:** If an app is redeployed at a different URL path, previously stored keys become
inaccessible (orphaned). This is a known limitation. Future work may add an `app_id`
override option for migration scenarios.

**Size limits:**

- Individual values: Hard limit ~1MB per JSON-serialized value (writes raise
  `StreamlitAPIException` if exceeded)
- Total storage: ~5-10MB (browser-dependent)
- Browser quota failures (`QuotaExceededError` / `DOMException`) are caught in the
  frontend, serialized over WebSocket, and re-raised as `StreamlitAPIException` with the
  original browser error message included for debugging

### Examples

**Track user progress:**

```python
# Load from local storage only on initial page load
if "progress" not in st.session_state:
    st.session_state.progress = st.local_storage.get("quiz_progress", {"score": 0, "level": 1})

progress = st.session_state.progress
st.write(f"Level {progress['level']}, Score: {progress['score']}")

if st.button("Complete level"):
    st.session_state.progress["score"] += 10
    st.session_state.progress["level"] += 1
    # Persist to local storage for next page load
    st.local_storage["quiz_progress"] = st.session_state.progress
```

**Remember UI settings:**

```python
settings = st.local_storage.get("settings", {
    "theme": "light",
    "columns": 3,
    "show_advanced": False
})

theme = st.selectbox("Theme", ["light", "dark"],
                     index=0 if settings["theme"] == "light" else 1)
cols = st.slider("Columns", 1, 5, settings["columns"])

if theme != settings["theme"] or cols != settings["columns"]:
    settings["theme"] = theme
    settings["columns"] = cols
    st.local_storage["settings"] = settings
```

**Draft preservation (larger data):**

```python
draft = st.local_storage.get("document_draft", "")

# Use session_state to track the last saved value to avoid infinite save loops
if "last_saved_draft" not in st.session_state:
    st.session_state.last_saved_draft = draft

content = st.text_area("Document", value=draft, height=400)

# Auto-save on change, comparing against session-tracked value
if content != st.session_state.last_saved_draft:
    st.local_storage["document_draft"] = content
    st.session_state.last_saved_draft = content

if st.button("Publish"):
    publish(content)
    st.local_storage.delete("document_draft")
    st.session_state.last_saved_draft = ""
    st.success("Published!")
```

### Edge Cases

| Scenario                        | Behavior                                       |
|---------------------------------|------------------------------------------------|
| Value exceeds 1MB               | Raises `StreamlitAPIException`                 |
| Browser quota exceeded          | Raises `StreamlitAPIException` (translated from browser error) |
| Key not found (subscript)       | Raises `KeyError`                              |
| Key not found (`.get()`)        | Returns default value (or `None`)              |
| Non-JSON-serializable value     | Raises `TypeError`                             |
| Read-after-write (same run)     | Returns old value (see Timing section)         |
| localStorage disabled/blocked   | Raises `StreamlitAPIException` with guidance   |

### Widget Binding (Related Feature)

The query-params binding spec (2026-01-06) mentions `"localstorage"` as a possible future
extension:

```python
st.selectbox("Theme", ["light", "dark"], bind="localstorage", key="theme")
```

This spec focuses on the **direct API** (`st.local_storage`). Widget binding is a separate
feature that can be implemented alongside or after the direct API.

| Feature           | Direct API (`st.local_storage`)    | Widget Binding               |
|-------------------|------------------------------------|------------------------------|
| Use case          | Arbitrary data                     | Widget state persistence     |
| Data type         | Any JSON-serializable              | Widget-specific              |
| Scope             | Full control                       | Automatic per-widget         |

### Security & Privacy

- **Browser-managed storage:** Data is stored in the browser; the current design syncs a
  snapshot to the backend over the Streamlit WebSocket so the Python API can read it
- **Same-origin:** Browser enforces same-origin policy
- **User-controlled:** Users can clear via browser dev tools
- **No sensitive data:** Docs will warn against storing passwords or tokens in
  localStorage; sensitive values should use server-managed auth/session mechanisms

## Out of Scope (Future Work)

| Feature                              | Rationale                                          |
|--------------------------------------|----------------------------------------------------|
| `st.session_storage`                 | sessionStorage rarely needed; `st.session_state` covers most cases |
| Widget binding (`bind="localstorage"`)| Separate feature in query-params spec             |
| Encryption helpers                   | Can add later based on demand                      |
| Storage quota management             | Let browser handle; document limits                |

## Checklist

| Item                         | ✅ or comment                                              |
|------------------------------|------------------------------------------------------------|
| Works on SiS, Cloud, etc?    | Needs verification for iframe/cross-origin restrictions    |
| No breaking API changes      | ✅ Additive only                                           |
| No new dependencies          | ✅ Uses browser localStorage API                           |
| Metrics collected            | Track `get`, `set`, `delete`, `clear` calls                |
| Any security/legal impact?   | Privacy: data synced to backend; GDPR/privacy review may be needed depending on what apps store |
| Any docs changes needed?     | New guide: "Client-Side Storage" covering cookies + localStorage |
