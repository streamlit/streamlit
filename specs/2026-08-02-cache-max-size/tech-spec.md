---
author: lukasmasuch
created: 2026-08-02
---

# Memory-bounded caching for `st.cache_data` — tech spec

## Summary

Implements the [`max_size` product spec](./product-spec.md): a per-function `max_size`
parameter and an optional process-wide default budget for `st.cache_data`, both evicting
LRU by serialized byte size. The work has three parts: (1) teach the internal `TTLCache`
to evict by size, (2) plumb `max_size` through the `st.cache_data` → storage layers, and
(3) add a cross-cache global budget with global LRU eviction. `st.cache_resource` is
untouched.

## Problem

The internal `TTLCache` (`lib/streamlit/runtime/caching/ttl_cache.py`, introduced in
[#16014](https://github.com/streamlit/streamlit/pull/16014)) only supports **count-based**
sizing:

```python
# TTLCache.__setitem__ today
if key not in self._data:
    while len(self._data) + 1 > self._maxsize:  # each entry counts as 1
        self.popitem()
```

`InMemoryCacheStorageWrapper` constructs it with `maxsize=max_entries`. There is no notion
of per-entry size and no coordination between the independent `TTLCache` instances that
back different `@st.cache_data` functions. We need both to bound memory.

## Proposal

### Part 1 — size-aware `TTLCache`

Extend `TTLCache` with an optional size function and a running total, restoring the
capability `cachetools.Cache` provided before #16014 (so behavior is well-understood):

```python
class TTLCache(MutableMapping[K, V]):
    def __init__(
        self,
        maxsize: float,
        ttl: float,
        timer: Callable[[], float] = time.monotonic,
        getsizeof: Callable[[V], int] | None = None,  # NEW; None => count mode (size 1)
    ) -> None:
        ...
        self._getsizeof = getsizeof or (lambda _v: 1)
        self._currsize = 0            # running sum of entry sizes
        self._sizes: dict[K, int] = {}  # per-key size, so removals adjust the total
```

Key changes (all localized to `TTLCache`):

- `__setitem__`: compute `size = self._getsizeof(value)`; after reaping expired entries,
  `while self._data and self._currsize + size > self._maxsize: self.popitem()`; then store
  value, record `self._sizes[key] = size`, and add to `self._currsize`. On overwrite,
  subtract the old size first.
- `popitem` / `expire` / `__delitem__` / `pop`: subtract the removed key's size from
  `self._currsize` and drop it from `self._sizes`.
- `currsize` property returns bytes (in size mode) instead of `len(self)`.
- **Always keep ≥1 entry**: the eviction loop is guarded by `self._data` being non-empty
  (`while self._data and ...`), so a lone oversized entry is stored rather than rejected.
  This replaces today's `if self._maxsize < 1: raise ValueError("value too large")`, which
  we must not raise for a legitimate single large result.

`TTLCleanupCache` (used by `cache_resource`) subclasses `TTLCache` but will keep
`getsizeof=None` (count mode) — no behavior change for resources.

**Concurrency:** `TTLCache` is documented as not thread-safe; callers hold
`InMemoryCacheStorageWrapper._mem_cache_lock`. `_currsize`/`_sizes` are mutated only under
that lock, so no new locking is required for the per-function cap.

### Part 2 — plumb `max_size` through `st.cache_data`

Parsing: add a `to_bytes(value: int | str | None) -> int | None` helper (new
`lib/streamlit/byte_util.py`, mirroring `time_util.time_to_seconds`). It accepts an int
(bytes) or a case-insensitive string with a unit suffix (`KB`/`MB`/`GB`/`TB`, and raw
`B`), using base-1024 (`KiB`==`KB` accepted as aliases). This uses the binary convention
(1 KB = 1024 bytes), matching Docker, Kubernetes, and common developer usage, even though it
technically inverts the IEC standard (`KB` = 1000, `KiB` = 1024). Invalid unit or `<= 0` →
`StreamlitAPIException`.

Plumbing path (all additive):

1. `CacheDataAPI.__call__` / `_decorator`: add `max_size: int | str | None = None`; parse
   via `to_bytes`; validate; pass down.
2. `CachedDataFuncInfo`: store `max_size_bytes: int | None`; include it in
   `get_function_cache(...)`.
3. `DataCaches.get_cache(...)`: add `max_size_bytes`; include it in the "params changed →
   recreate cache" equality check (alongside `ttl`, `max_entries`, `persist`,
   `refresh_mode`), matching the existing pattern.
4. `CacheStorageContext`: add `max_size_bytes: int | None = None` (frozen dataclass, new
   optional field → backward compatible for third-party storage managers).
5. `InMemoryCacheStorageWrapper.__init__`: when `context.max_size_bytes` is set, build the
   `TTLCache` with `maxsize=max_size_bytes` **and** `getsizeof=len` (bytes). When
   `max_entries` is *also* set we need both a count cap and a byte cap — see below.

**Supporting both `max_size` and `max_entries` simultaneously.** A single `TTLCache` has
one `maxsize` axis. Two clean options:

- **Option 1 (recommended): dual limits inside `TTLCache`.** Give `TTLCache` an optional
  secondary `max_count` alongside the size-based `maxsize`; the eviction loop pops while
  *either* limit is exceeded. Minimal surface area, one data structure, one lock.
- **Option 2: nest two caches.** Keep count and size caches layered. Rejected: duplicated
  LRU state, two locks, easy to desync.

The "single large entry" warning (product spec) is emitted from
`InMemoryCacheStorageWrapper._write_to_mem_cache` when `len(value) > max_size_bytes`,
throttled to once per storage instance via a boolean flag.

### Part 3 — global default budget (cross-cache LRU)

A per-function cap can't bound *total* `cache_data` memory, so the global budget
(`config: server.maxCachedDataSize`) needs process-wide accounting and a global victim
selection. Design:

- **Central registry**: a process-global `GlobalCacheBudget` singleton tracks
  `(storage, key) -> size` and a running total, plus a monotonically increasing access
  tick recorded on every read/write. `InMemoryCacheStorageWrapper` reports writes, reads
  (recency bump), and deletions to it under its existing lock.
- **Eviction**: on a write that pushes the global total over the budget, pop the
  globally-oldest `(storage, key)` (smallest access tick) and delete it from its owning
  storage, repeating until under budget. The entry currently being inserted is never a
  victim, so the loop stops when the total is under budget *or* when only that entry remains
  — a lone entry larger than the whole budget is retained and the budget is temporarily
  exceeded, matching the product spec's "oversized single entry" rule. Leaving ≥1 entry per
  non-empty storage is *not* guaranteed globally: the budget can shrink some other
  function's cache to zero, which is acceptable and identical to a normal miss on next
  access.
- **Ordering structure**: an `OrderedDict[(storage_id, key), size]` keyed by access order
  gives O(1) LRU bump (`move_to_end`) and O(1) oldest-pop, the same primitive `TTLCache`
  already uses.
- **Concurrency**: the global structure has its own lock, always acquired **after** a
  storage's `_mem_cache_lock` is released (or via a lock-ordering discipline) to avoid
  deadlock between the per-cache and global locks. Cross-cache eviction calls back into a
  *different* storage's public `delete`, which takes that storage's own lock — so the
  global lock must not be held while calling into a storage. Detailed lock ordering is the
  riskiest part of this change and gets dedicated tests.
- **Cache clearing**: `st.cache_data.clear()` and per-function `.clear()` must also report to
  the `GlobalCacheBudget` so the running total and LRU ordering are decremented for every
  dropped entry; otherwise the budget would leak phantom bytes after a clear and evict live
  entries prematurely.

**Alternative considered — approximate/lazy global enforcement.** Instead of exact global
LRU, periodically (e.g. every N writes or on a timer) sum per-cache `currsize` values and,
if over budget, evict from the largest cache. Simpler and lock-light, but less precise and
can overshoot the budget between sweeps. Viable as a v1 if the exact global LRU proves too
invasive; the product behavior ("evict oldest across caches") is best served by the exact
design, so we start there and fall back only if needed.

### Config option

```python
# config.py
_create_option(
    "server.maxCachedDataSize",
    description="""
        Maximum combined serialized size of all @st.cache_data in-memory caches.
        Accepts a number of bytes or a string like "1gb"/"500mb". When exceeded,
        Streamlit evicts least-recently-used cached entries across functions until
        the total fits. Set to 0 to disable the global limit (unbounded, legacy
        behavior). This bounds serialized cache size, not process RSS.
    """,
    default_val=...,  # see product-spec "Default-value options"; likely "1gb" or 0
    type_=str,
)
```

Parsed once at startup via the same `to_bytes` helper.

**Config type note:** `type_=str` is a deliberate departure from the existing size caps
(`server.maxUploadSize`, `server.maxMessageSize`), which use `type_=int` in **megabytes**. A
string is needed so the value carries an explicit unit (`"1gb"`, `"500mb"`) and stays
consistent with the `max_size` parameter. The parser accepts either a unit string or a bare
integer number of bytes, and `0` / `"0"` is a sentinel meaning "disabled" (handled before
the `> 0` validation that `to_bytes` otherwise enforces). Because the option is `type_=str`,
document that the disable value is written as a string in `config.toml`
(`maxCachedDataSize = "0"`). This intentional inconsistency with the int-MB configs is called
out in the option description.

## Testing

- `ttl_cache_test.py`: size-mode eviction, running-total correctness across
  set/overwrite/delete/pop/expire, keep-≥1-oversized-entry, dual count+size limits,
  count-mode unchanged (regression).
- `in_memory_cache_storage_wrapper_test.py`: `max_size_bytes` wiring, once-per-storage
  oversized warning, coexistence with `max_entries`/`ttl`/`persist`.
- `cache_data_api` tests: parameter parsing/validation (`"500MB"`, int bytes, bad unit,
  `<= 0`), cache-recreation on `max_size` change.
- Global budget: cross-cache eviction picks the global LRU victim; concurrency/lock-order
  stress test (many caches, concurrent read/write) with no deadlock; budget respected
  under churn.
- Global-budget warning (Option D): the one-time warning emitted when the global budget
  first starts evicting fires once per process (throttled), carries the expected copy, and
  does not fire when the budget is disabled (`0`) or never exceeded.
- Type tests in `lib/tests/streamlit/typing/` for the new `max_size` overloads.
- E2E: a `cache_data` app with `max_size` that evicts under load (public-API coverage).

## Alternatives Considered

- **Reuse `pympler.asizeof` for `cache_data` too** (instead of `len(bytes)`): unnecessary —
  the pickled length is exact and free. `asizeof` is slow and would regress every write.
- **Store size in the pickled `CachedResult`**: the wrapper already has the pickled bytes
  at write time; `len()` is simpler and avoids format changes / stale sizes.
- **Bound RSS directly**: no portable, cheap way to attribute process RSS to individual
  cache entries; serialized size is the honest, cheap proxy (documented as such).
- **`getsizeof=` / `evict=` callables now**: deferred to the product spec's out-of-scope
  list; they mainly exist to extend to `cache_resource`, which we're not solving yet.
