---
author: lukasmasuch
created: 2026-10-16
---

# Shared storage for `st.cache_data`

## Summary

This spec describes how `st.cache_data` uses one pluggable storage from many replicas
without slowing reruns. Streamlit owns the entry format, the key layout, expiry, and
invalidation; a storage only stores bytes. Each replica keeps in-memory copies, small
marker keys in the storage propagate clears, and optional leases stop replicas from
computing the same cold key. User-facing behavior is in the
[product spec](./product-spec.md).

A prototype with multi-process tests and a benchmark validated the design (see
[Validation](#validation)).

## Problem

### Current architecture

`DataCaches.get_cache()` asks the runtime's `CacheStorageManager` to `create()` one internal
`CacheStorage` per function, passing a `CacheStorageContext` with `ttl_seconds`,
`max_entries`, and `persist`. The default `LocalDiskCacheStorageManager` returns an
`InMemoryCacheStorageWrapper` around a `LocalDiskCacheStorage`, and the disk layer does
nothing unless `persist == "disk"`.

The wrapper enforces `ttl` and `max_entries` only in memory. On a memory miss it reads from
disk and puts the value back into memory with a new TTL
(`runtime/caching/storage/in_memory_cache_storage_wrapper.py`):

```python
def get(self, key: str) -> bytes:
    try:
        entry_bytes = self._read_from_mem_cache(key)
    except CacheStorageKeyNotFoundError:
        entry_bytes = self._persist_storage.get(key)
        self._write_to_mem_cache(key, entry_bytes)
    return entry_bytes
```

### Why exposing the current protocol isn't enough

[#14902](https://github.com/streamlit/streamlit/pull/14902) proposes exposing
`CacheStorageManager` as it is. Every implementation would then have to enforce `ttl` and
`max_entries` and interpret `persist` itself, which is exactly where the built-in disk layer
fails today. The protocol also has no answer for:

- **Invalidation across replicas:** replica B's in-memory copy survives a `clear()` on
  replica A.
- **Expiry across replicas and restarts:** `CachedResult.stored_at` comes from
  `time.monotonic()`, which means nothing in another process.
- **Duplicate computes:** several replicas compute the same cold key at the same time.
- **Format changes:** entries are raw pickles of `CachedResult` with no version, and a
  failed unpickle raises `CacheError` in the app.

### Key issues found

Running the key derivation in separate processes and storages found three issues:

- **Sets of strings get a different key in every process.** `set` and `frozenset` arguments
  are hashed through `__reduce__`, whose element order follows Python's per-process string
  hash randomization. Runs with different `PYTHONHASHSEED` values produced different value
  keys. Strings, dicts, enums, small and sampled-large DataFrames, NumPy arrays, and
  function keys were stable.
- **Different apps share function keys.** Every app script and page runs as module
  `__main__`, and `_make_function_key` hashes only the module, qualified name, and source.
  Two apps in different folders with the same `load_data()` produced the same function key.
- **Session-scoped caches with `persist` leak between sessions.** The storage context has no
  session ID, and disk files are named `{function_key}-{value_key}.memo`. A second session
  read the first session's value from disk, and `clear_session()` deleted every session's
  files.

## Proposal

### Architecture

```
DataCache (per function)              unchanged: hashing, per-key locks, replay
   │ read / write / clear by value key
   ▼
SharedCacheLayer (per process)        new: envelope, key layout, expiry,
   │  ├─ in-memory copies (LRU)            invalidation markers, leases,
   │  └─ marker tokens per function        background writes, failure handling
   ▼
CacheStorage (user-provided or DiskCacheStorage)   stores bytes
```

With the default `cache.storage = "memory"`, the current in-memory path is kept as is, so
apps that don't configure a storage see no change or overhead. `scope="session"` caches
always use that in-memory path. `CacheStorageManager` and `CacheStorageContext` stay
internal; `CacheStorageContext.persist` goes away together with the `persist` shim.

### Public protocol

```python
class CacheStorage(Protocol):
    """Byte storage for st.cache_data entries.

    Implementations must be thread-safe. A storage shared by several replicas must also
    be safe to use from several processes and hosts.
    """

    def get(self, key: str) -> bytes | None:
        """Return the stored value, or None if it is missing or expired."""

    def set(self, key: str, value: bytes, *, ttl_seconds: float | None) -> None:
        """Store a value. ``ttl_seconds`` is a hint for reclaiming space; None means keep."""

    def delete(self, key: str) -> None:
        """Delete the key if it exists."""
```

Optional methods have defaults on the protocol. Streamlit treats a `NotImplementedError` as
"not supported", which follows the existing `CacheStorageManager.clear_all()` convention:

| Method | Used for | Default |
|---|---|---|
| `get_many(keys) -> list[bytes \| None]` | Reading a function's markers in one round trip | Calls `get` for each key |
| `add(key, value, *, ttl_seconds) -> bool` | Set-if-absent, for leases and creating markers | Not supported: no leases |
| `delete_prefix(prefix) -> None` | Reclaiming space after clears | Not supported: relies on the storage's own eviction |

Keys contain only lowercase letters, digits, `.`, `_`, `-`, and `/` (as separator), and stay
under 250 characters. A storage can map them to file paths or add its own prefix.

Correctness never depends on the storage: it may drop any key at any time, and the
`ttl_seconds` hint only helps it reclaim space.

### Entry envelope

Streamlit wraps each pickled `CachedResult` in a fixed-size header:

| Field | Purpose |
|---|---|
| Magic bytes and format version | Reject entries in another format |
| `created_at` (wall clock) | Freshness for background refresh |
| `expires_at` (wall clock, or none) | Hard expiry, checked on every read from memory or storage |
| Payload length and CRC32 | Detect truncated or corrupted entries, for example on network volumes |

Wall-clock timestamps let every replica, and a restarted process, agree on when an entry
goes stale and when it expires. This assumes NTP-synced clocks.

### Key layout

```
{namespace}/v{format}/d/{global_token}/{function_key}/{function_token}/{value_key}  entry
{namespace}/v{format}/m/global                                                    global token
{namespace}/v{format}/m/{function_key}/epoch                                      function token
{namespace}/v{format}/m/{function_key}/inval                                      per-key-clear marker
{entry_key}.lease                                                                 lease
```

- `namespace`: `cache.namespace`, which defaults to a short hash of the main script's
  absolute path. This fixes the cross-app collision. Replicas with different checkout paths
  just miss each other's entries, which is safe.
- `format`: Bumped whenever the envelope, `CachedResult`, or key derivation changes, for
  example with the [#16559](https://github.com/streamlit/streamlit/issues/16559) fix. Old
  entries then become unreachable instead of being misread.
- Tokens: Random 16-character hex strings stored in the marker keys.

### Read path

1. Compute the value key, as today.
2. If this function's tokens were last read more than one second ago, read its three
   markers with a single `get_many`. Other threads keep using the previous tokens during the
   read. A missing marker gets a new random token, created with `add` (or `set` without
   `add`).
3. Look up the full key in the in-memory copies. On a hit that hasn't expired, unpickle and
   return, with no storage I/O.
4. On a miss, `get` the key from the storage, decode it, check `expires_at`, and keep it in
   memory with its original `expires_at`. Then unpickle it.
5. If the envelope is invalid or unpickling fails, delete the key and treat it as a miss.

### Write path

1. Compute under the existing per-key lock. If the storage supports `add`, take the lease
   first (TTL 30 s). The holder renews the lease every 10 s while it computes, so long
   computations keep it and a crashed holder blocks others for at most 30 s.
2. If another replica holds the lease, poll the storage with backoff (10 ms up to 200 ms)
   until the value appears or the lease is gone. The poll loop runs the run's yield check
   from [cancellable cache waits](../2026-10-07-cancellable-cache-wait/tech-spec.md), so an
   abandoned run stops waiting.
3. Keep the result in memory right away, and write it to the storage on a bounded
   background executor. The rerun that computed the value doesn't wait for the upload. If
   the executor is full, the write is skipped. The lease is released after the write.
4. Writes are dropped if a local clear happened during the compute, using the existing
   invalidation tokens.

### Clears

| Call | Storage writes | Other replicas, at their next token read |
|---|---|---|
| `st.cache_data.clear()` | New global token | Drop all in-memory copies |
| `my_func.clear()` | New function token | Drop that function's copies |
| `my_func.clear(*args)` | Delete the entry and write a new `inval` marker | Drop that function's copies, and fetch its other keys from storage again |

- Because tokens are part of every entry key, a clear is a single write. Old entries become
  unreachable without scanning keys, and a compute that finishes after the clear lands under
  the old token where nobody reads it. Old entries are deleted in the background with
  `delete_prefix` if supported, and otherwise by the storage's own eviction.
- The replica that clears updates its own tokens immediately. Other replicas see the clear
  within one token read interval (one second).
- Markers are always overwritten with new random values and never read and modified, so
  concurrent clears can't undo each other. If the storage evicts a marker, a new random
  token replaces it. That can cause misses, but it never makes cleared entries reachable
  again.
- `streamlit cache clear` deletes the whole `cache.diskPath` folder, as it does today. Without
  a script it can't derive the namespace.

### Background refresh across replicas

- Freshness comes from the envelope's `created_at`, so restarts and other replicas see the
  same staleness. This removes the current `refresh_mode="background"` and `persist` error.
- On a stale hit, the stale value is returned and a refresh is scheduled on the existing
  pool, with the existing per-key cooldown.
- The refresh first takes the lease, and skips if another replica holds it. Before
  computing, it reads the storage again; if another replica has already written a fresh
  entry, it adopts that entry instead.
- With `add` support, that gives one refresh per key per TTL across all replicas.

### Failure handling

- Every storage call is guarded:
  - A failed read is a miss.
  - A failed write is skipped.
  - A failed marker read keeps the current tokens and retries after the next interval. If a
    replica has never read the markers, it uses random local tokens, so it never serves
    entries it can't validate.
- A warning is logged at most once per minute for each kind of failure.
- Storage calls never hold `DataCaches`' global lock. Token reads only block threads asking
  for the same function's tokens for the first time.

### Built-in `DiskCacheStorage`

- **Layout:** Each `/`-separated key segment becomes a directory under `diskPath`. Each file
  starts with an 8-byte expiry, and `get` treats expired files as missing.
- **Atomic writes:** A value is written to a temp file in the same directory, then
  `os.replace`d into place. Readers see the old or the new file, never a partial one. This
  holds on local disks and on NFS/EFS.
- **`add`:** Writes a temp file, then `os.link`s it to the target. Hard-link creation fails
  if the target exists, which makes it an atomic create-with-content, also on NFS. Expired
  holders are replaced on a best-effort basis.
- **`delete_prefix`:** `shutil.rmtree` of the token directory.
- **Sweeping:** At most every 10 minutes per process, a sweep deletes expired files and temp
  files older than an hour. It tolerates other replicas sweeping at the same time.
- **Permissions:** Files use the process umask. The docs recommend a folder that only the
  app's user can write to.

### Redis recipe (docs only)

Each method is one Redis command: `GET`, `SET PX`, `DEL`, `MGET` for `get_many`,
`SET NX PX` for `add`, and `SCAN` plus `UNLINK` for `delete_prefix`. The docs recommend
`maxmemory-policy allkeys-lru`, which evicts entries left behind by clears. For a stricter
lease release, use a compare-and-delete Lua script.

### Integration

- **Runtime setup:** `create_default_cache_storage_manager()` reads `cache.storage`,
  `cache.diskPath`, and `cache.namespace`. `st.App.__init__` accepts `cache_storage`, which
  `st.App._create_runtime()` passes into `RuntimeConfig` in place of the default.
- **`persist` shim:** If no app-level storage is configured, `persist="disk"` and
  `persist=True` route that function through a `SharedCacheLayer` over
  `DiskCacheStorage(cache.diskPath)`. If a storage is configured, `persist` has no effect.
- **CLI:** `streamlit cache clear` deletes `cache.diskPath`, which also removes the old
  `.memo` files.
- **AppTest:** Keeps using `MemoryCacheStorageManager`.
- **Stats:** In-memory copies keep reporting through the existing `cache_memory_bytes`
  stats.

### Performance

On a hit, the hot path gains a monotonic clock read, one comparison of the tokens'
timestamp, and one expiry comparison, with no storage I/O. Each replica does one small
marker read per second for each function in use.

The prototype benchmark measured one cached call per rerun, returning a 9.6 MB pickled
DataFrame:

| Storage | Without in-memory copies | With them |
|---|---|---|
| Memory only (today) | 2.1 ms | – |
| Local disk | 2.7 ms | 1.3 ms |
| Redis, simulated 0.5 ms round trip and 10 Gbit/s | 12 ms | 1.2 ms |
| Redis, simulated 1 ms round trip and 1 Gbit/s | 85 ms | 1.8 ms |

Local disk without in-memory copies looks cheap only because the OS page cache served the
file from RAM; a network volume behaves more like the Redis rows. With in-memory copies,
every storage costs about the same as memory-only today, where the remaining cost is the
unpickle that `st.cache_data` already does on every hit.

### Guarantees and limits

**Guarantees:**

- A replica never serves an entry past its `expires_at`.
- A clear is immediate on the replica that made it, and reaches every other replica within
  one second.
- Cleared entries never become reachable again, even if the storage evicts markers.
- A torn or corrupted entry is never served.
- A storage failure never fails a script run.

**Limits:**

- A compute that started before a clear on another replica can still be written after it,
  because the protocol has no compare-and-set. Within one replica, the existing
  invalidation tokens prevent this.
- Each replica keeps its own in-memory copies, so a shared storage doesn't lower memory
  use.
- Storage calls are synchronous, so an async cached function blocks its event loop for the
  transfer time on a miss.
- Leases are best-effort. A race at expiry can lead to computing twice, but never to wrong
  data.

## Validation

A prototype in `work-tmp/shared_cache_prototype/` implemented the shared layer, the disk
storage, and the Redis recipe, with tests running against a shared directory and against
fakeredis's TCP server. It didn't implement lease renewal or the disk sweep. All 29 tests
passed:

- **Sharing:** A value computed on one replica was reused by another. 1,000 hits between
  token reads made zero storage calls, and the next interval cost one `get_many`.
- **Clears:** Each kind of clear reached other replicas within the interval. After a per-key
  clear, other keys were fetched from storage again, not recomputed.
- **Expiry:** A replica that loaded an entry 50 s after it was written still expired it at
  60 s.
- **Leases:** A cold key that 4 threads requested at once was computed once with `add`, and
  at most 4 times without it.
- **Bad entries:** Corrupted entries and entries pickled from a missing class were
  recomputed.
- **Evicted markers:** Deleting the function token never made cleared entries reachable
  again.
- **Background refresh:** With 3 replicas, the value refreshed once, and the others adopted
  the result.
- **Multi-process:** 4 OS processes did 1,600 reads of 256 KB values while clearing, with
  zero wrong or torn values. They needed 52 computes in total, about the minimum the clears
  force. A cold key requested by 4 processes at once was computed once, on disk and on
  Redis.
- **Outage:** With a storage that raised on every call, the app kept caching in memory.

The fakeredis server stood in for a real Redis server, and the Redis rows of the benchmark
use simulated network delays.

## Alternatives Considered

- **Expose the current `CacheStorageManager`
  ([#14902](https://github.com/streamlit/streamlit/pull/14902)):** Rejected. Every storage
  would have to implement caching semantics, with no answer for sharing across replicas
  (see [Problem](#problem)).
- **No in-memory copies (always read the storage):** Rejected. The benchmark shows 12–85 ms
  per cached call per rerun for a 10 MB value over the network.
- **In-memory copies with a short TTL instead of markers:** Rejected. Copies are either stale
  for the whole TTL, or large values are fetched again every TTL. Markers cost one small read
  per function per second.
- **Version key per entry (ETag-style revalidation):** Rejected for now. It tracks per-key
  clears precisely, but costs one round trip per key per interval instead of one per
  function.
- **Push invalidation (Redis pub/sub or client-side caching):** Deferred. It's instant, but
  specific to the backend, and a disk can't push. It could become an optional protocol
  method later.
- **Clear by deleting keys with a prefix:** Rejected. That's an O(N) scan on Redis, and a
  compute that finishes after the delete repopulates the cleared function. Tokens avoid
  both.
- **One metadata record per function (read-modify-write):** Rejected. Concurrent clears can
  overwrite each other without compare-and-set.
- **Require distributed locks:** Rejected. That would make simple storages harder to write,
  so leases are optional.
- **Select custom storages in `config.toml` by import path:** Deferred. Config can't pass
  credentials or objects, and `st.App` already covers custom storages.

## Implementation plan

1. **Bug fix:** Raise `StreamlitIncompatibleParametersError` for `persist` combined with
   `scope="session"`.
2. **Bug fix:** Hash `set` and `frozenset` arguments independently of element order, for
   example by sorting element digests. Calls with set arguments miss once after upgrading.
3. **Shared layer and disk storage:**
   - The envelope, key layout, tokens, in-memory copies, leases with renewal, background
     writes, failure handling, and disk sweep.
   - `cache.storage`, `cache.diskPath`, `cache.namespace`, the `persist` shim, background
     refresh with `persist`, and the CLI change.
   - Unit tests ported from the prototype scenarios, plus a multi-process disk test.
4. **Public API:**
   - `streamlit.storage` with `CacheStorage` and `DiskCacheStorage`, and
     `st.App(cache_storage=...)`.
   - Typing tests, docs including the Redis recipe, and an update to the embedded skill's
     `performance.md`.
5. **Deprecation warning:** Add a `persist` deprecation warning at least 3 months after
   steps 3 and 4 ship.

Steps 1 and 2 are independent bug fixes. An e2e smoke test runs an app with
`cache.storage = "disk"`; the replica behavior is covered by unit and multi-process tests.
