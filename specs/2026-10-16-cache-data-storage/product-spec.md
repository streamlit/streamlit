---
author: lukasmasuch
created: 2026-10-16
---

# Configurable storage for `st.cache_data`

## Summary

Let an app choose once where `st.cache_data` stores its entries, instead of opting
individual functions in with `persist="disk"`. Streamlit ships a built-in disk storage
configured in `config.toml`, and `st.App` accepts any custom storage, such as Redis. All
replicas of an app can share one storage, and cache hits stay as fast as today because each
replica keeps an in-memory copy of the entries it uses. `persist` is deprecated and keeps
working on the new disk storage during a long deprecation window.

The [tech spec](./tech-spec.md) covers how this works across replicas.

## Problem

**Requests:**

- [#5849](https://github.com/streamlit/streamlit/issues/5849) — Bring your own Redis cache
  (98 👍). With several replicas, a user gets a cache hit on one replica and a miss on the
  next.
- [#3018](https://github.com/streamlit/streamlit/issues/3018) — Configurable location for
  the persistent cache (22 👍).
- [#4859](https://github.com/streamlit/streamlit/issues/4859) — `persist="disk"` ignores
  `ttl`.
- [#16907](https://github.com/streamlit/streamlit/issues/16907) — Deprecate `persist` in
  favor of configurable storage.
- [#16559](https://github.com/streamlit/streamlit/issues/16559) — Distinct arguments can
  collide on one key. Fixing the key format is harder while persisted entries depend on it.
- Draft [#14902](https://github.com/streamlit/streamlit/pull/14902) — Custom storage API for
  `st.App`, covering cache, media, and uploads.

### What's wrong with `persist` today

`persist` is a per-function switch for what is really a deployment decision, and it
conflicts with most other cache features:

| Feature | With `persist="disk"` today |
|---|---|
| `ttl` | Ignored. Once the in-memory copy expires, the entry is reloaded from disk with a new TTL ([#4859](https://github.com/streamlit/streamlit/issues/4859)). |
| `max_entries` | Only limits memory. The disk folder grows without limit, and evicted entries come back from disk. |
| `refresh_mode="background"` | Rejected with an error. |
| `scope="session"` | Accepted, but sessions read each other's entries from disk, and a session ending deletes every session's entries. |
| Several apps on one machine | Two apps with an identical cached function, such as a `load_data()` that reads `"data.csv"`, read each other's entries. |
| Several replicas | Each replica has its own disk, so nothing is shared. |
| Location | Fixed to `~/.streamlit/cache` ([#3018](https://github.com/streamlit/streamlit/issues/3018)). |
| Upgrades | An entry that no longer unpickles (for example, after a class was renamed) raises an error in the app instead of being recomputed. |

The `scope="session"` and multi-app rows were confirmed with scripts during this
investigation (see the tech spec).

### Use cases

1. **Keep expensive results across restarts**, during development or on a single server.
   This is what `persist` users do today.
2. **Share one cache across replicas** (Kubernetes, ECS, several uvicorn workers), so a value
   computed on one replica is reused by all others and a cold start computes each value
   once.
3. **Use existing infrastructure** such as Redis, Memcached, or a database as the cache
   backend.

## Proposal

### Overview

- The storage is configured once per app and applies to every `st.cache_data` function
  with `scope="global"`.
- Each replica keeps an in-memory copy of the entries it has used, as today. A cache hit
  reads the entry from memory. Its only storage access is a check of small invalidation
  markers, at most once per second per function.
- `scope="session"` caches and `st.cache_resource` always stay in memory. Session caches
  belong to one session on one replica, and resources aren't serializable.
- The default stays in-memory, so apps that configure nothing behave exactly as today.

### API

**Built-in storages in `config.toml`:**

```toml
[cache]
storage = "disk"
diskPath = "/mnt/shared/streamlit-cache"
namespace = "sales-dashboard"
```

| Option | Type | Default | Description |
|---|---|---|---|
| `cache.storage` | `"memory"`, `"disk"` | `"memory"` | Where `st.cache_data` stores entries. `"memory"` keeps them only in the process; `"disk"` also writes them to `cache.diskPath`. Other values are rejected at startup. |
| `cache.diskPath` | `str` | `"~/.streamlit/cache"` | Folder for `storage = "disk"`. Can be a volume that several replicas share. `~` is expanded, and a relative path is resolved against the working directory. |
| `cache.namespace` | `str` | A hash of the main script's absolute path | Keeps the entries of different apps apart when they share one storage. Up to 64 lowercase letters, digits, `.`, `_`, and `-`, starting with a letter or digit; other values are rejected at startup. |

The default namespace only separates apps whose main scripts have different absolute paths.
Different apps that share one storage from containers with the same path, such as
`/app/streamlit_app.py`, must each set their own `cache.namespace`.

**Custom storages in `st.App`:**

```python
st.App(
    script_path,
    *,
    ...,  # existing parameters
    cache_storage: CacheStorage | None = None,
)
```

If set, `cache_storage` takes precedence over `cache.storage`.

`CacheStorage` is a protocol. It and the built-in `DiskCacheStorage` are exported from a new
public module:

```python
from streamlit.storage import CacheStorage, DiskCacheStorage


class CacheStorage(Protocol):
    def get(self, key: str) -> bytes | None: ...
    def set(self, key: str, value: bytes, *, ttl_seconds: float | None) -> None: ...
    def delete(self, key: str) -> None: ...
```

A storage only stores bytes. Streamlit handles serialization, expiry, the key layout, and
invalidation, so a storage needs no knowledge of caching. Optional methods (`get_many`,
`add`, `delete_prefix`) make a storage faster, or keep replicas from computing the same cold
key more than once. The full contract is in the tech spec.

### Behavior

**Cache parameters with a storage:**

- `ttl`: Every replica expires an entry at the same time, `ttl` after it was computed (later
  with background refresh, see below). Expired entries are never served, whether from memory
  or from the storage.
- `max_entries`: Limits how many entries each replica keeps in memory for that function. The
  storage's own eviction policy limits what it keeps: disk only deletes expired entries, so
  entries without a `ttl` stay until they're cleared; Redis uses its memory policy. An entry
  evicted from memory can still be read back from the storage.
- `refresh_mode="background"`: Supported. As today, an entry goes stale after `ttl` and
  expires at `runner.cacheBackgroundRefreshTTLMultiplier` × `ttl`. When an entry goes
  stale, every replica keeps serving it while it's refreshed. If the storage implements
  `add`, usually one replica refreshes it and the others reuse the result; otherwise each
  replica may refresh it.
- Other parameters and async cached functions work as today, including their limits:
  coroutines can't use `refresh_mode="background"`, and background mode doesn't replay
  display output. Otherwise, display output from cached functions is replayed on every
  replica, including media. Audio and video passed as a local file path are read from that
  path again, so the file must exist on every replica.
- Storage calls are synchronous, so an async cached function blocks the event loop during
  them: on a miss, and during the marker check.

**Clearing:**

- `my_func.clear()`, `my_func.clear(*args)`, and `st.cache_data.clear()` clear the shared
  storage, and so does **Clear cache** in the app menu. As today, `st.cache_data.clear()`
  also clears `scope="session"` caches on the replica that calls it. Session caches on
  other replicas aren't in the storage, so they stay.
- The replica that cleared sees the change immediately. A session stays on one replica, so
  a user who clicks a "Refresh" button gets fresh data. Other replicas see the clear within
  about one second. After `my_func.clear(*args)`, a compute of that key that was already
  running on another replica can still store its result.
- `streamlit cache clear` deletes the entries of every namespace in `cache.diskPath`, and the
  old `persist` files in `~/.streamlit/cache`, but no other files. It reads `cache.diskPath`
  the way `streamlit config show` does, from the global and current folder's `config.toml`,
  environment variables, and flags. It can't reach a storage passed to `st.App`; use
  `st.cache_data.clear()` from the app instead.

**Several replicas:**

- A value computed on one replica is reused by all others.
- A cold key that several replicas request at the same time is usually computed only once if
  the storage implements `add`. The built-in disk storage and the documented Redis recipe
  both do. This is best-effort: a replica that stalls for more than 30 seconds can let
  another one compute the key again. Without `add`, each replica may compute the key once.
- Replicas must run the same code, at the same path or with the same `cache.namespace`, and
  keep `runner.cacheHashSeed` at its default or the same value on all of them. Changing a
  function's code changes its keys, so during a rolling deploy, old and new replicas don't
  read each other's entries for changed functions. To keep deploy versions completely apart,
  for example when upgrading pandas, set `cache.namespace` to the version.
- Replica clocks must be in sync (NTP), because expiry is compared across replicas.

**Failures:**

- If the storage is unavailable, the app keeps working. Each replica serves its in-memory
  entries and computes misses itself. Streamlit logs a warning, at most once per minute.
  This needs storage calls to fail quickly instead of hanging, so a custom storage should
  set a client timeout, as the Redis recipe does.
- An entry that can't be read is treated as a miss and recomputed. This covers corrupted
  entries, entries written by an incompatible Streamlit version, and entries whose class no
  longer exists.

**Security:** Entries are pickled, so anyone who can write to the storage can run code in
the app's process. That's already true of `~/.streamlit/cache` today, but a shared storage
can widen who has write access. The docs must say to restrict access to the storage, for
example with file permissions, or Redis authentication and network rules.

### Examples

**Keep cached data across restarts on a single server:**

```toml
# .streamlit/config.toml
[cache]
storage = "disk"
```

```python
import streamlit as st


@st.cache_data(ttl="1d")
def load_embeddings(model: str):
    return compute_embeddings(model)  # Survives restarts and expires after a day.
```

**Several replicas sharing a volume:**

```toml
[cache]
storage = "disk"
diskPath = "/mnt/shared/streamlit-cache"
```

**Redis through `st.App`:**

```python
import os

import redis
import streamlit as st
from streamlit.storage import CacheStorage


def _ms(ttl_seconds: float | None) -> int | None:
    return None if ttl_seconds is None else max(1, int(ttl_seconds * 1000))


class RedisCacheStorage(CacheStorage):
    def __init__(self, url: str) -> None:
        # Fail fast instead of stalling reruns when Redis is unreachable.
        self._redis = redis.Redis.from_url(url, socket_timeout=1)

    def get(self, key: str) -> bytes | None:
        return self._redis.get(key)

    def set(self, key: str, value: bytes, *, ttl_seconds: float | None) -> None:
        self._redis.set(key, value, px=_ms(ttl_seconds))

    def delete(self, key: str) -> None:
        self._redis.delete(key)

    # Optional: replicas compute a cold key only once.
    def add(self, key: str, value: bytes, *, ttl_seconds: float | None) -> bool:
        return bool(self._redis.set(key, value, px=_ms(ttl_seconds), nx=True))


app = st.App("main.py", cache_storage=RedisCacheStorage(os.environ["REDIS_URL"]))
```

The docs recipe also implements `get_many` and `delete_prefix`, and recommends running Redis
with `maxmemory-policy allkeys-lru`.

**Migrating from `persist`:**

```python
# Before
@st.cache_data(persist="disk")
def load_data(): ...


# After: no decorator change besides removing `persist`
@st.cache_data
def load_data(): ...
```

```toml
[cache]
storage = "disk"
```

This stores every global `st.cache_data` function, not just `load_data`. See
[Per-function control](#per-function-control).

### Deprecating `persist`

1. **First release:** Ship storage support. `persist="disk"` and `persist=True` keep working:
   that function uses the built-in disk storage at `cache.diskPath`, so it now honors `ttl`,
   supports background refresh, uses a configurable folder, and is isolated per app. If a
   storage is already in use (`cache.storage = "disk"` or `st.App(cache_storage=...)`),
   `persist` has no effect, because every global `st.cache_data` function already uses that
   storage. The docs mark `persist` as deprecated.
2. **At least 3 months later:** `persist` shows a deprecation warning pointing to
   `cache.storage = "disk"`.
3. **Removal:** No date yet. GitHub code search finds about 2,400 public uses of
   `cache_data(persist`, and the compatibility shim is cheap to keep.

Combining `persist` with `scope="session"` will raise an error. That ships earlier as a
bug fix, since it leaks data between sessions today.

The new disk storage doesn't read the existing `~/.streamlit/cache/*.memo` files, so each
persisted function recomputes once after upgrading. `streamlit cache clear` removes the old
files.

### Per-function control

**Option 1: One storage per app, deprecate `persist`** ✅ PREFERRED

- Pros: Configured in one place, with no decorator parameter. Every cache feature works the
  same with every storage. Fits sharing across replicas, where apps want everything shared.
- Cons: Can't store just one function. Functions without a `ttl` that relied on a restart to
  refresh now keep their values across restarts. Every miss is also written to the storage.

**Option 2: Keep `persist` as a per-function opt-in to the app's storage**

- Pros: No deprecation, and control per function.
- Cons: Shared-cache users must add it to every function. Two settings to understand, and
  "persist" is the wrong word for a shared cache.

**Option 3: Named storages**

```python
app = st.App("main.py", cache_storages={"shared": redis_storage, "local": disk_storage})


@st.cache_data(storage="shared")
def load_data(): ...
```

- Pros: The most flexible.
- Cons: Ties app scripts to names defined in the launcher, so scripts run with
  `streamlit run` need fallbacks. More API than the use cases need.

A per-function opt-out, for example to keep a huge or cheap function out of Redis, can be
added later if users ask for it. Adding a parameter later is easier than removing one.

### Naming

- **Config section:** `[cache]` ✅ or `runner.cache*`. Storage location and namespace are
  deployment settings (principle 38), and `runner.*` is about script execution. The downside
  is that `runner.cacheBackgroundRefreshTTLMultiplier` and `runner.cacheHashSeed` stay in
  `runner`; moving them is out of scope.
- **`st.App` parameter:** `cache_storage` ✅ or `cache_data_storage`. `cache_storage` matches
  `cache.storage`; its docstring says it only applies to `st.cache_data`.
- **Module:** `streamlit.storage`. It's an extension API, which suits a submodule
  (principle 21), and leaves room for the media and upload storages from
  [#14902](https://github.com/streamlit/streamlit/pull/14902).

## Out of Scope (Future Work)

- **Media and upload storage** from [#14902](https://github.com/streamlit/streamlit/pull/14902):
  separate spec, since they have different problems, like direct-to-S3 uploads and
  streaming.
- **Storage for `st.cache_resource`:** resources aren't serializable.
- **Shipping a Redis storage in Streamlit:** it would add a dependency. A docs recipe for
  now, and maybe a separate package later.
- **Faster or immediate clears on all replicas:** for example, a configurable sync interval
  or push notifications through Redis pub/sub.
- **Async storage protocol.**
- **Memory budget for in-memory copies:** each replica still keeps its own copies.
- **Size limit for the disk storage:** entries without a `ttl` stay until they're cleared,
  so the docs recommend a `ttl` for functions called with many distinct arguments.
- **Signing or encrypting stored entries.**
- **Choosing a custom storage in `config.toml`** by import path.
- **Per-function opt-out** (see above).

## Checklist

| Item | ✅ or comment |
|---|---|
| Works on SiS, Cloud, etc? | ✅ The default is unchanged (memory). `cache.storage = "disk"` needs a writable folder; platforms with ephemeral disks, like Community Cloud and SiS, keep entries only until the container restarts. `cache_storage` works wherever `st.App` does. |
| No breaking API changes | ✅ No API is removed, and `persist` keeps working through a long deprecation. The first release still changes some behavior: `persist` with `scope="session"` raises an error, `persist` starts honoring `ttl`, persisted functions recompute once, and again after the app moves to another folder unless `cache.namespace` is set, and calls with `set` arguments miss once in both `st.cache_data` and `st.cache_resource`. |
| No new dependencies | ✅ The built-in disk storage uses only the standard library. |
| Metrics collected | Record the `cache.storage` value, whether `st.App(cache_storage=...)` is set, and `persist` usage to plan its removal. |
| Any security/legal impact? | Entries are pickles, so write access to the storage means code execution in the app. This isn't new, but shared storages can widen access, so the docs must cover access control. It also fixes the cross-session leak of `persist`, and its cross-app leak between apps at different paths. |
| Any docs changes needed? | ✅ Caching concepts page (storage and multi-replica sections, Redis recipe), `st.cache_data` docstring (`persist` deprecation, `ttl` and `max_entries` with a storage), `st.App` docstring, config docs, and the embedded skill's `performance.md`, which says background refresh can't be combined with `persist`. |
