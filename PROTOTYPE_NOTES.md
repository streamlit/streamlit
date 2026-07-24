# Prototype: async-aware `@st.cache_data` and `@st.cache_resource`

This prototype makes Streamlit's cache decorators understand coroutine functions.
Decorating an `async def` now caches the **awaited result** (an inert value) instead
of trying to cache/pickle the coroutine object. Related feature request:
[#8308](https://github.com/streamlit/streamlit/issues/8308).

## Target usage

```python
import asyncio
import streamlit as st

@st.cache_data
async def load_config() -> dict:
    await asyncio.sleep(0)
    return {"env": "prod"}

async def main():
    config = await load_config()   # first run: body runs; later runs: cached
    st.write(config)

asyncio.run(main())
```

The same works for `@st.cache_resource`.

## Confirmed pre-existing failure modes

Before this change (reproduced against `develop`):

- `@st.cache_data` on an `async def` raised `UnserializableReturnValueError` — the
  decorator tried to pickle the returned **coroutine object**, which is unpicklable.
- `@st.cache_resource` on an `async def` cached the **coroutine object** itself and
  re-awaited it on the next access, raising
  `RuntimeError: cannot reuse already awaited coroutine`.

## Approach

All changes are in the shared caching layer; the two decorators required only
docstring updates.

- **Detection.** `CachedFuncInfo.__init__` records
  `self.is_async = inspect.iscoroutinefunction(func)` once, at decoration time.
- **Dispatch.** `CachedFunc.__call__` branches on `is_async`. For a coroutine
  function it returns the coroutine produced by `_get_or_create_cached_value_async(...)`
  (cast to `R`). Because an `async def func() -> T` has type
  `Callable[..., Coroutine[Any, Any, T]]`, the wrapper's return type `R` already *is*
  the coroutine type, so the public signature (`-> R`) and the `await load_config()`
  usage type-check without changing the decorators' return annotations. The sync path
  is untouched.
- **Async lookup/compute.** `_get_or_create_cached_value_async` mirrors the sync
  `_get_or_create_cached_value`: it computes the same value key, reads the cache, and on
  a hit replays messages and returns the cached value. On a miss it awaits
  `_handle_cache_miss_async`, which mirrors the sync miss path (double-checked locking
  via the existing per-key `compute_value_lock`) but `await`s the underlying coroutine
  before storing the awaited result.
- **Shared store logic.** The "write the computed value back, handle background-mode
  display rules, translate serialization errors" tail of `_handle_cache_miss` was
  extracted into `_store_computed_value`, now called by both the sync and async miss
  paths. This keeps `ttl`, `max_entries`, `show_spinner`, `hash_funcs`, and the
  `cache_data`/`cache_resource` storage & serialization rules identical for async
  results — they flow through exactly the same code as sync results.

## What worked cleanly

- The value key, storage, serialization, spinner, message replay, and error handling
  are all reused as-is. The only genuinely new logic is "await the coroutine, then store
  its result," so the diff is small and the async path stays faithful to the sync one.
- Typing fell out nicely: since an `async def`'s type already encodes the coroutine as
  `R`, awaiting the decorated call type-checks with no changes to the decorator return
  types or the public API overloads.
- Cross-thread deduplication (the reason the sync path holds `compute_value_lock`) is
  preserved for free by reusing that same lock.

## Tricky bits / surprises

- **`R` is the coroutine type, not the awaited value.** The cache actually stores the
  awaited value (`dict`), but the wrapper's generic `R` is the *coroutine* type. Inside
  `_handle_cache_miss_async` the awaited value is therefore cast to `Any` before being
  stored. This is type-unsound at the seam but is invisible to users and keeps the
  public typing correct.
- **Threading lock across an `await` (documented limitation, not fixed).**
  `_handle_cache_miss_async` holds the per-key `threading.Lock` (`compute_value_lock`)
  across the `await`, exactly as the sync path holds it across the compute. For the
  target usage (`asyncio.run(main())` with sequential awaits) and for cross-thread
  concurrency this is correct. **However**, two *concurrent awaits of the same key on a
  cache miss within a single event loop* (e.g. `asyncio.gather(load(), load())`)
  **deadlock**: the first coroutine holds the OS-level lock and suspends at the `await`,
  and the second coroutine's blocking `lock.acquire()` freezes the only thread, so the
  event loop can never resume the first. This was confirmed empirically. Per the
  prototype scope ("match the existing behavior, don't invent new locking semantics"),
  the existing threading machinery is reused rather than replaced with an async-aware
  dedup layer. Sequential repeated awaits (the tested case) run the body exactly once
  and do not deadlock.

## Out of scope (intentionally not implemented)

- **Persistent / per-session event loops.** The prototype assumes the caller drives the
  coroutine (`asyncio.run`, `await`), and does not manage any loop itself.
- **Caching live, loop-bound async clients** (e.g. `openai.AsyncOpenAI()`), per-loop
  keying, or cross-session binding safety. Only inert awaited results are cached. The
  `cache_resource` docstring keeps a warning about event-loop-bound objects.
- **Background refresh of async entries.** `refresh_mode="background"` recomputes off
  the script thread by calling `func(...)` synchronously, which for a coroutine function
  produces an un-awaited coroutine. The async path deliberately does not trigger a
  background refresh; async caches use the foreground path only.
- **Async detection beyond `inspect.iscoroutinefunction`.** Callables whose `__call__`
  is async, or `functools.partial` wrapping a coroutine function, are not detected.

## Tests

`lib/tests/streamlit/runtime/caching/async_cache_test.py` covers, for both decorators
where shared:

- first await runs the body, second await is a cache hit;
- the body runs exactly once across repeated (sequential) awaits with the same args;
- different args produce different cache entries;
- calling the decorated coroutine function returns an awaitable;
- the two pre-existing errors (unpicklable-coroutine, coroutine-reuse) no longer occur;
- `cache_resource` returns the identical object; `cache_data` returns equal copies;
- existing options still apply to async functions (underscore args excluded from the
  key, `max_entries` eviction);
- the sync path is unchanged (returns a value, not an awaitable).

## Recommendation

The approach is **viable for a production implementation**. It is small, reuses the
entire existing cache pipeline, keeps the sync path untouched, and gives users the
expected "cache the awaited result" behavior with correct typing. The one item that must
be addressed before production is the **same-event-loop concurrent-miss deadlock**: the
per-key `threading.Lock` should not be held across an `await`. A production version
should replace it on the async path with an async-aware, per-key single-flight primitive
(e.g. a per-key `asyncio.Future`/`asyncio.Lock`, or compute the value without holding the
OS lock across the await and rely on a store-time single-flight check), while still using
the threading lock for cross-thread dedup. Background-refresh support for async functions
and explicit guidance against caching loop-bound clients would round out the feature.
