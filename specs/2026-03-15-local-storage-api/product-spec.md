---
author: lukasmasuch
created: 2026-03-15
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

**Use cases:**

1. **User scores/progress** - Track game scores, quiz results, learning progress
2. **UI state persistence** - Remember filters, settings, view configurations
3. **Draft preservation** - Store larger form data, chat history, document drafts
4. **Watchlists/saved items** - User-curated lists without server-side storage
5. **Offline-first data** - Cache data locally for better performance

**Current workarounds** (all have significant limitations):

- `streamlit_javascript` / `streamlit_js` - Requires extra reruns, timing issues, double-loads
- Custom components with `localStorage` - Same rerun/timing issues as cookie components
- `st.cookies` (proposed) - Limited to ~4KB per cookie

**Cookies vs localStorage:**

| Feature | Cookies | localStorage |
|---------|---------|--------------|
| Size limit | ~4KB per cookie | ~5-10MB total |
| Sent to server | Yes (every request) | No (client-only) |
| Expiration | Configurable | Persistent until cleared |
| HTTP-only option | Yes | No (always JS-accessible) |
| Best for | Auth tokens, session IDs | Larger user data, preferences |

Issues: #5105 (50+ upvotes), #13609 (widget binding to localStorage)

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

### Recommended API (Option 1)

```python
import streamlit as st

# Read (returns None if not found)
scores = st.local_storage.get("scores")
scores = st.local_storage["scores"]  # KeyError if not found

# Write (auto-serializes to JSON, available on next rerun)
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

### Why No Other Options?

Unlike cookies, localStorage has no native configuration options:

| Cookies option | localStorage equivalent |
|----------------|------------------------|
| `max_age`/`expires` | Not native (we implement via `expires_in`) |
| `path`/`domain` | Same-origin only (browser-enforced) |
| `secure`/`httponly`/`samesite` | N/A (data never sent to server) |

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

### Behavior

**Timing:** Same as `st.cookies` - values are queued during script run and sent to browser
via ForwardMsg. Readable on **next** rerun.

```python
st.local_storage["draft"] = "my text"  # Queued
st.rerun()                             # Sent to browser
# Next run: st.local_storage["draft"] == "my text"
```

**Auto-serialization:** Unlike cookies (string-only), localStorage automatically
serializes/deserializes JSON:

```python
st.local_storage["prefs"] = {"theme": "dark", "lang": "en"}  # Auto JSON.stringify
prefs = st.local_storage["prefs"]  # Auto JSON.parse -> dict
```

**Namespacing:** Keys are automatically namespaced per-app to prevent cross-app collisions:

```
st_local_storage_{app_id}_{key}
```

Where `app_id` is derived from the app's URL path. This prevents one app from reading/
overwriting another app's data on the same domain.

**Size limits:**

- Individual values: Soft limit ~1MB (warn if exceeded)
- Total storage: ~5-10MB (browser-dependent)
- Raises `StreamlitAPIException` on `QuotaExceededError`

### Widget Binding (Related Feature)

The existing query-params binding spec (2026-01-06) includes plans for `bind="local-storage"`:

```python
st.selectbox("Theme", ["light", "dark"], bind="local-storage", key="theme")
```

This spec focuses on the **direct API** (`st.local_storage`). Widget binding is a separate
feature that can be implemented alongside or after the direct API.

| Feature | Direct API (`st.local_storage`) | Widget Binding (`bind="local-storage"`) |
|---------|--------------------------------|----------------------------------------|
| Use case | Arbitrary data | Widget state persistence |
| Data type | Any JSON-serializable | Widget-specific |
| Scope | Full control | Automatic per-widget |

### Examples

**Track user progress:**

```python
progress = st.local_storage.get("quiz_progress", {"score": 0, "level": 1})

st.write(f"Level {progress['level']}, Score: {progress['score']}")

if st.button("Complete level"):
    progress["score"] += 10
    progress["level"] += 1
    st.local_storage["quiz_progress"] = progress
    st.rerun()
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

content = st.text_area("Document", value=draft, height=400)

# Auto-save on change
if content != draft:
    st.local_storage["document_draft"] = content

if st.button("Publish"):
    publish(content)
    st.local_storage.delete("document_draft")
    st.success("Published!")
```

### Security & Privacy

- **Client-only:** Data never sent to server (unlike cookies)
- **Same-origin:** Browser enforces same-origin policy
- **User-controlled:** Users can clear via browser dev tools
- **No sensitive data:** Docs will warn against storing passwords, tokens (use `st.cookies`
  with `httponly=True` instead)

### Out of Scope (Future Work)

| Feature | Rationale |
|---------|-----------|
| `st.session_storage` | sessionStorage rarely needed; `st.session_state` covers most cases |
| Widget binding (`bind="local-storage"`) | Separate feature in query-params spec |
| Encryption helpers | Can add later based on demand |
| Storage quota management | Let browser handle; document limits |

## Checklist

| Item                         | Status |
|------------------------------|--------|
| Works on SiS, Cloud, etc?    | Needs verification for iframe/cross-origin restrictions |
| No breaking API changes      | ✅ Additive only |
| No new dependencies          | ✅ Uses browser localStorage API |
| Metrics collected            | Track `get`, `set`, `delete`, `clear` calls |
| Any security/legal impact?   | Privacy: client-only, no GDPR concerns for essential use |
| Any docs changes needed?     | New guide: "Client-Side Storage" covering cookies + localStorage |
