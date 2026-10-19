---
author: lukasmasuch
created: 2026-08-02
---

# Memory-bounded caching for `st.cache_data` — tech spec

## Summary

Describes the implementation of the [`max_size` product spec](./product-spec.md) for
`st.cache_data`: a per-function `max_size` parameter and a process-wide budget that
defaults to 4 GB of serialized cache (`"0"` disables it), both evicting LRU by serialized
byte size. The work has three parts: (1) teach the internal `TTLCache` to evict by size,
(2) plumb `max_size` through the `st.cache_data` → storage layers, and
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
        max_count: float = math.inf,  # NEW; size mode only: secondary entry-count cap
        on_remove: Callable[[K], None] | None = None,  # NEW; see Part 3
    ) -> None:
        ...
        self._getsizeof = getsizeof or (lambda _v: 1)
        self._currsize = 0  # running sum of entry sizes
        self._sizes: dict[K, int] = {}  # per-key size, so removals adjust the total
```

In count mode, `maxsize` stays the entry cap and `max_count` is unused. In size mode,
`maxsize` is the byte cap and `max_count` carries `max_entries`.

Key changes (all localized to `TTLCache`):

- `__setitem__` in **count mode** (`getsizeof=None`, including `TTLCleanupCache`) is
  unchanged: it keeps the `maxsize < 1` guard and overwrites an existing key in place,
  without releasing or reporting the old value.
  `ResourceCache.write_background_refresh_result` depends on this: it stores the new
  resource first and then calls `on_release` on the replaced one itself.
- `__setitem__` in **size mode** (order matters — avoid double-subtract / self-eviction on
  overwrite):
  1. Compute `size = self._getsizeof(value)` and reap expired entries.
  2. If `key` already exists, drop it first through an internal helper that removes it
     from `_data` / `_expirations` / `_sizes` and subtracts its size, so `popitem()` cannot
     pick it as the victim and subtract its size twice. The helper does not call `popitem`,
     `expire`, or `on_remove`: the key is being replaced, not removed.
  3. Evict: `while self._data and (self._currsize + size > self._maxsize or
     len(self._data) + 1 > self._max_count): self.popitem()`.
  4. Store the new value, record `self._sizes[key] = size`, and add to `self._currsize`.
- `popitem` / `expire` / `__delitem__` / `pop`: subtract the removed key's size from
  `self._currsize`, drop it from `self._sizes`, and call `on_remove(key)` once per entry
  they actually remove. In `__delitem__`, do this before the expired-entry `KeyError` is
  raised, since the entry is already removed at that point. `pop` of an
  expired-but-not-reaped key removes nothing (it returns the default and leaves the key
  for `expire`), so it neither subtracts nor calls `on_remove`.
- `clear()`: reset `_currsize` to 0 and empty `_sizes`, since it wipes `_data` directly
  without going through `popitem`. It does not call `on_remove`; the wrapper's `clear()`
  drops its budget entries in one call (Part 3).
- `currsize` returns the running byte total in size mode and the entry count in count
  mode. `__len__` stays the entry count in both modes.
- **Always keep ≥1 entry (size mode only)**: the eviction loop is guarded by `self._data`
  being non-empty (`while self._data and ...`), and size mode skips today's
  `if self._maxsize < 1: raise ValueError("value too large")`, so a lone oversized entry is
  stored rather than rejected.

`TTLCleanupCache` (used by `cache_resource`) subclasses `TTLCache` but keeps
`getsizeof=None` (count mode) and passes no `on_remove`, so resource caching keeps today's
overwrite and release behavior. Its `clear()` drains via `popitem`, which already
subtracts, so it stays correct without extra accounting.

**Concurrency:** `TTLCache` is documented as not thread-safe; callers hold
`InMemoryCacheStorageWrapper._mem_cache_lock`. `_currsize`/`_sizes` are mutated only under
that lock, so no new locking is required for the per-function cap.

### Part 2 — plumb `max_size` through `st.cache_data`

Parsing: add a `to_bytes(value: int | str | None) -> int | None` helper (new
`lib/streamlit/byte_util.py`, mirroring `time_util.time_to_seconds`):

- **Accepted forms**: an `int` (bytes), or a case-insensitive string with a unit suffix
  (`B`/`KB`/`MB`/`GB`/`TB`). The number may be fractional (`"1.5GB"`, truncated to whole
  bytes) and may be separated from the unit by whitespace (`"500 MB"`).
- **Binary units**: 1 KB = 1024 bytes, with `KiB`/`MiB`/`GiB`/`TiB` accepted as aliases.
  This matches Docker `--memory` (`k`/`m`/`g` are base-1024) and common developer intuition,
  even though IEC defines `KB` as 1000 bytes.
- **Invalid values**: for the `max_size` parameter, a `bool` (an `int` subclass, so `True`
  would otherwise mean 1 byte) or a `float` raises
  `StreamlitInvalidParameterTypeError(parameter="max_size", ...)` with `int` and `str` as
  the expected types. An unknown unit or a value `<= 0` raises
  `StreamlitValueError(parameter="max_size", ...)` describing a positive byte count or a
  unit string. Config parsing reports a config error instead (see below).

Plumbing path (all additive):

1. `CacheDataAPI.__call__` / `_decorator`: add `max_size: int | str | None = None`; parse
   via `to_bytes`; validate; pass down.
2. `CachedDataFuncInfo`: store `max_size_bytes: int | None`; include it in
   `get_function_cache(...)`.
3. `DataCaches.get_cache(...)`: add `max_size_bytes`; include it in the "params changed →
   recreate cache" equality check (alongside `ttl`, `max_entries`, `persist`,
   `refresh_mode`), matching the existing pattern.
4. `CacheStorageContext`: append `max_size_bytes: int | None = None` after `persist`
   (frozen public dataclass; a defaulted last field keeps existing positional
   construction working). A custom `CacheStorageManager` that does not wrap its storage in
   `InMemoryCacheStorageWrapper` ignores both `max_size` and the global budget. Streamlit
   cannot tell whether a custom storage enforces the limits, so it does not warn; such a
   manager should warn from its own `check_context` when `max_size_bytes` is set, the way
   `LocalDiskCacheStorageManager` warns about `ttl` combined with `persist="disk"`.
5. `InMemoryCacheStorageWrapper.__init__`: when `context.max_size_bytes` is set, build the
   `TTLCache` with `maxsize=max_size_bytes` **and** `getsizeof=len` (bytes). When
   `max_entries` is *also* set it becomes `max_count`, so the cache has both a count cap
   and a byte cap — see below.

**Supporting both `max_size` and `max_entries` simultaneously.** A single `TTLCache` has
one `maxsize` axis. Two clean options:

- **Option 1 (recommended): dual limits inside `TTLCache`.** Give `TTLCache` an optional
  secondary `max_count` alongside the size-based `maxsize`; the eviction loop pops while
  *either* limit is exceeded. Minimal surface area, one data structure, one lock.
- **Option 2: nest two caches.** Keep count and size caches layered. Rejected: duplicated
  LRU state, two locks, easy to desync.

The oversized-entry warning (product spec [Behavior](./product-spec.md#behavior)) is
logged with `_LOGGER.warning` from `InMemoryCacheStorageWrapper._write_to_mem_cache` when
`len(value)` exceeds `max_size_bytes` or the global budget, throttled to once per storage
instance via a boolean flag.

### Part 3 — global default budget (cross-cache LRU)

A per-function cap can't bound *total* `cache_data` memory, so the global budget
(`config: server.maxCacheDataSize`) needs process-wide accounting and a global victim
selection. Design:

- **Central registry**: a process-global `GlobalCacheBudget` singleton tracks
  `(storage_id, key) -> size` in access order and a running total. `storage_id` is unique
  per wrapper instance, assigned from a process-wide counter when the wrapper is built. It
  cannot be `function_key`: `DataCaches` keys caches by session id and then function key,
  so session-scoped caches and a cache replaced after a decorator-parameter change share
  a `function_key` across different storages. `id(storage)` is also unsafe, since ids can
  be reused after garbage collection. `InMemoryCacheStorageWrapper` reports writes under
  its existing lock; a write to a registered key replaces its size. Reads only record
  recency, without taking the global lock (see [Performance](#performance)).
- **Removal callback**: reporting only the wrapper's public `set`/`get`/`delete` is not
  enough. `TTLCache.__setitem__` / `expire()` can drop entries via internal `popitem` (the
  same path `max_entries` / `max_size` / TTL use today) without going through the
  wrapper's public `delete`. Those drops must also notify the budget, or they leave
  phantom bytes in the global total and force premature cross-cache eviction. The wrapper
  passes `on_remove` (Part 1) to its own `TTLCache`, so every entry actually removed from
  memory — explicit or internal — is reported exactly once, and removing an unregistered
  key is a no-op in the budget. The wrapper's `delete` does not decrement on its own:
  `pop(key, None)` on an expired-but-not-reaped key removes nothing, and the later
  `expire` reports that key. Because `on_remove` is a constructor argument of the
  `st.cache_data` mem cache, not a hook in the base `TTLCache` methods, `TTLCleanupCache`
  entries never reach the budget.
- **Eviction (memory-only)**: on a write that pushes the global total over the budget, pick
  the globally least-recently-used `(storage_id, key)` and remove it from that
  storage's **in-memory** front cache only, repeating until under budget. Do **not** call
  the storage's public `delete` — that also wipes `_persist_storage` and would destroy
  `persist="disk"` entries, diverging from today's `max_entries` behavior (`TTLCache`
  `popitem` only drops the mem layer) and from the product rule that size bounds memory
  only (disk stays unbounded). Use a dedicated memory-only eviction path (e.g.
  `_evict_from_mem_cache(key)` that pops from `_mem_cache`) so disk-backed entries can
  reload on the next miss. The entry currently being inserted is never a victim, so the
  loop stops when the total is under budget *or* when only that
  entry remains — a lone entry larger than the whole budget is retained and the budget is
  temporarily exceeded, matching the product spec's "oversized single entry" rule.
  Leaving ≥1 entry per non-empty storage is *not* guaranteed globally: the budget can
  shrink some other function's cache to zero, which is acceptable and identical to a
  normal miss on next access.
- **Ordering structure**: an `OrderedDict[(storage_id, key), size]` keyed by access order
  gives O(1) LRU bump (`move_to_end`) and O(1) oldest-pop, the same primitive `TTLCache`
  already uses.
- **Eviction warning**: the first time `GlobalCacheBudget` picks a victim, it logs the
  product spec's one-time budget warning with `_LOGGER.warning` after releasing the global
  lock, throttled by a process-wide flag.
- **Concurrency**: the global structure has its own lock. Lock order is a storage's
  `_mem_cache_lock` first, then the global lock — never the reverse. The global critical
  section only updates the registry and picks victims; it never calls into a storage.
  Picking a victim removes its registry entry and subtracts its bytes in that same
  critical section, so two writers cannot pick the same entry and the total moves once.
  Cross-cache victims are evicted after the writer has released both locks. For each
  victim, the writer takes that storage's `_mem_cache_lock`, checks under the global lock
  that `(storage_id, key)` is still unregistered, releases the global lock, and then pops
  the key. Every write re-registers its key, so a victim rewritten since selection is
  registered again: the writer keeps that fresh value, and the rewrite already enforced the
  budget for its own bytes. A victim that was removed in the meantime, or whose storage was
  dropped, is skipped. Holding the victim's `_mem_cache_lock` from the check to the pop
  keeps a rewrite from slipping in between, and the pop's `on_remove` finds no registry
  entry, so nothing is subtracted twice. Unpickling in `DataCache.read_result` stays
  outside both locks. Lock ordering is the riskiest part of this change and gets dedicated
  tests.
- **Dropping caches**: every path that drops a storage must remove its entries from the
  budget, not only the wrapper's `clear()`. In production, `st.cache_data.clear()` calls
  `DataCaches.clear_all()` → `LocalDiskCacheStorageManager.clear_all()`, which deletes the
  disk folder without calling any wrapper `clear()`; `clear_session()` and decorator-param
  changes call `storage.close()`. So `DataCaches.clear_all()` unregisters every storage, the
  wrapper's `close()` unregisters its own, and the registry holds only weak references to
  storages so a replaced cache is not pinned. The budget counts only reports from
  registered storages, and (un)registration happens under the global lock. This matters
  because the synchronous miss path calls `DataCache.write_result` without checking
  `mark_detached()`: a write that finishes on a dropped cache must not re-add bytes after
  the drop. A disk-to-memory promotion (memory miss, disk hit) counts as a budget write, and
  each removal decrements the total exactly once (either victim selection or the
  `on_remove` callback, never both).

#### Performance

Today a cache hit contends only on its own storage's `_mem_cache_lock`, and the budget keeps
it that way. A hit appends `(storage_id, key)` to a bounded recency buffer
(`collections.deque(maxlen=...)`, whose `append` is thread-safe) instead of taking the
global lock. Writes, which already pay for pickling, take the global lock, drain the buffer
into the `OrderedDict`, and then pick victims. Hints for keys that are no longer tracked are
skipped. A full buffer drops its oldest hints, which only makes the recency order
approximate; the byte total stays exact. When the budget is disabled (`"0"`), neither path
touches the global structure.

Acceptance bar: with the budget enabled and the app under budget, median and p99 cache-hit
latency stay within 5% of the budget-disabled baseline at 1 and 50 concurrent sessions. If
the implementation misses that bar, see the sweep fallback below.

**Alternative considered — approximate/lazy global enforcement.** Instead of exact global
LRU, periodically (e.g. every N writes or on a timer) sum per-cache `currsize` values and,
if over budget, evict from the largest cache. Simpler and lock-light, but less precise, can
overshoot the budget between sweeps, and trims a large hot cache while a small cold one
survives. That breaks the product spec's promise to evict globally least-recently-used
entries across functions, so exact global LRU is the v1 design. Switching to the sweep
(for example, because the exact design misses the [Performance](#performance) acceptance
bar) requires updating the product spec first.

### Config option

```python
# config.py
_create_option(
    "server.maxCacheDataSize",
    description="""
        Maximum combined serialized size of all @st.cache_data in-memory caches.
        Requires an explicit unit string like "4gb"/"500mb" (or "0" to disable).
        When exceeded, Streamlit evicts least-recently-used cached entries across
        functions until the total fits. This bounds serialized cache size, not
        process RSS.
    """,
    default_val="4gb",
    type_=str,
)
```

Parsed once at startup via the same `to_bytes` helper, with a config-specific rule
layered on top (see below).

**Config contract (resolved):** Existing `server.*` size caps (`server.maxUploadSize`,
`server.maxMessageSize`) use `type_=int` in **megabytes**. Reusing that pattern here would
clash with the `max_size` parameter's unit-string UX (`"500MB"`) and with the recommended
default (`"4gb"`). Accepting bare ints as **bytes** would be a worse footgun: a user who
writes `maxCacheDataSize = 500` (or `1`) almost certainly expects MB-scale behavior from
the other `server.*` size options, not 500 bytes.

Therefore `server.maxCacheDataSize` **requires an explicit unit for any non-zero
value**. Accepted forms:

- Unit string: `"4gb"`, `"500mb"`, `"1024KB"`, … (same `to_bytes` grammar as `max_size`)
- Disable sentinel only: `0` or `"0"` (unbounded / legacy behavior; handled before the
  `> 0` validation that `to_bytes` otherwise enforces)

Bare non-zero integers (`500`, `1`, …) and unit-less numeric strings (`"500"`) are
**rejected** with a clear config error pointing at the unit requirement. Because the
option is `type_=str`, document that values in `config.toml` are written as strings
(`maxCacheDataSize = "4gb"`, `maxCacheDataSize = "0"`). The Python `max_size`
parameter still accepts int-as-bytes — that is a different surface (call-site API, not
`server.*` config) and is unaffected.

### Metrics

- `max_size` adoption needs no new instrumentation: the `cache_data` decorator is wrapped in
  `gather_metrics`, which already records the parameters each decorator call uses.
- Global-budget evictions are counted in a new `CounterStat` family exposed next to
  `cache_memory_bytes` on `/_stcore/metrics`, so operators can see whether the default
  budget evicts and the 4 GB value can be tuned from real eviction rates.

## Testing

- `ttl_cache_test.py`: size-mode eviction, running-total correctness across
  set/overwrite/delete/pop/expire/clear (including overwrite of the sole/LRU entry — no
  double-subtract / self-eviction, and deleting an expired entry), keep-≥1-oversized-entry,
  dual count+size limits, `on_remove` called once per actual removal (not for an overwrite
  or for `pop` of an expired-but-not-reaped key), and count mode unchanged (regression):
  `maxsize < 1` still raises on write, and a `TTLCleanupCache` overwrite stays in place
  without calling `on_release`.
- `in_memory_cache_storage_wrapper_test.py`: `max_size_bytes` wiring, once-per-storage
  oversized warning (for `max_size` and the global budget), coexistence with
  `max_entries`/`ttl`/`persist`; memory-only eviction leaves `persist="disk"` entries
  reloadable on miss; internal TTL/`max_size` `popitem` paths notify `GlobalCacheBudget`
  (no phantom bytes); deleting an expired-but-not-reaped key decrements the budget once.
- `cache_data_api` tests: parameter parsing/validation (`"500MB"`, `"1.5 GB"`, int bytes,
  bad unit, `bool`, `float`, `<= 0`), cache-recreation on `max_size` change.
- Config parsing: the default resolves to 4 GB; unit strings accepted; `0`/`"0"` disables;
  bare non-zero ints / unit-less strings rejected.
- Global budget: cross-cache eviction picks the global LRU victim via the memory-only
  path; concurrency/lock-order stress test (many caches, concurrent read/write/delete and
  cache replacement) with no deadlock; budget respected under churn; total returns to zero
  after each production drop path (`DataCaches.clear_all()` with
  `LocalDiskCacheStorageManager`, `clear_session()`, replacement via `close()`), stays at
  zero when a write completes on a detached cache after `st.cache_data.clear()`, and counts
  disk-to-memory promotions; the eviction counter increments once per evicted entry; a
  deterministic test that rewrites a victim's key between selection and eviction keeps the
  new value and moves the total once; storages that share a `function_key` (session-scoped
  caches, a replaced cache) are tracked separately. Tests reset the `GlobalCacheBudget`
  singleton between cases.
- Performance: the cache-hit latency benchmark from [Performance](#performance) (budget
  enabled vs. disabled, 1 and 50 concurrent sessions, app under budget), checked against
  its acceptance bar.
- Global-budget warning (Option D): the one-time warning emitted when the global budget
  first starts evicting fires once per process (throttled), is logged with the copy from
  the product spec's [Behavior](./product-spec.md#behavior) section, and does not fire when
  the budget is disabled (`0`) or never exceeded.
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
