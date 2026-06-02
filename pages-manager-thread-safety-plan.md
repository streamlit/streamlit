# PagesManager Thread Safety Implementation Plan

## Background

This is a post-release hardening item for the parallel fragments feature. The goal is to make `PagesManager` thread-safe by:

1. Adding an internal `threading.Lock`
2. Replacing the separate `set_pages()` + `get_page_script()` pair with an atomic `set_pages_and_resolve()` method
3. Lock-protecting `get_pages()` to return a dict copy

### Why This Change Is Needed

With parallel fragments (`@st.fragment(parallel=True)`), multiple threads can concurrently access `PagesManager` methods. The tech spec ([`specs/2026-03-05-parallel-fragments/tech-spec.md`](specs/2026-03-05-parallel-fragments/tech-spec.md)) identifies this as a thread safety concern:

> **`PagesManager`** has no internal locking today. `st.navigation` performs a compound write-then-read (`set_pages()` followed by `get_page_script()`), and `st.switch_page` reads pages then writes the current page hash. With concurrent callers these could interleave.

This primarily benefits **free-threaded Python (PEP 703)** where the GIL is absent and dict reads during concurrent mutation are unsafe. Under the current GIL, dict reads are bytecode-atomic, but compound check-then-modify operations are still not atomic.

**Reference:** Tech spec section "Externally thread-safe objects > `PagesManager`" (lines 737-803)

---

## Current State

### Current PagesManager API

**File:** `lib/streamlit/runtime/pages_manager.py`

```python
class PagesManager:
    uses_pages_directory: bool | None = None  # Class-level attribute

    def __init__(self, main_script_path, script_cache=None, **kwargs):
        self._main_script_path = main_script_path
        self._main_script_hash = calc_hash(main_script_path)
        self._script_cache = script_cache
        self._intended_page_script_hash: PageHash | None = None
        self._intended_page_name: PageName | None = None
        self._current_page_script_hash: PageHash = ""
        self._pages: dict[PageHash, PageInfo] | None = None

    # Properties (read-only)
    @property main_script_path
    @property main_script_parent
    @property main_script_hash
    @property current_page_script_hash
    @property intended_page_name
    @property intended_page_script_hash

    # Methods
    def set_current_page_script_hash(self, page_script_hash: PageHash) -> None
    def get_main_page(self) -> PageInfo
    def set_script_intent(self, page_script_hash: PageHash, page_name: PageName) -> None
    def get_initial_active_script(self, page_script_hash: PageHash) -> PageInfo | None
    def get_pages(self) -> dict[PageHash, PageInfo]
    def set_pages(self, pages: dict[PageHash, PageInfo]) -> None
    def get_page_script(self, fallback_page_hash: PageHash = "") -> PageInfo | None
    def get_page_script_byte_code(self, script_path: str) -> Any
```

### Current Call Sites

| File | Method Called | Line | Usage Pattern | Thread Context |
|------|---------------|------|---------------|----------------|
| `lib/streamlit/commands/navigation.py` | `set_pages()` | 463 | Compound: `set_pages()` then `get_page_script()` | Main script thread |
| `lib/streamlit/commands/navigation.py` | `get_page_script()` | 464 | Part of compound operation above | Main script thread |
| `lib/streamlit/commands/execution_control.py` | `get_pages()` | 315 | Standalone read: `.values()` iteration | Main script thread (blocked in parallel fragments) |
| `lib/streamlit/elements/widgets/button.py` | `get_pages()` | 1586 | Standalone read: iteration | Main script thread or parallel worker |
| `lib/streamlit/runtime/app_session.py` | `get_pages()` | 525 | Standalone read: filter iteration | Event loop thread |
| `lib/streamlit/runtime/app_session.py` | `get_pages()` | 802 | Standalone read: populate message | Event loop thread |
| `lib/streamlit/runtime/context_util.py` | `get_pages()` | 28 | Standalone read: `.values()` iteration | Any thread |
| `lib/streamlit/runtime/context_util.py` | `get_pages()` | 41 | Standalone read: `.get()` lookup | Any thread |
| `lib/streamlit/runtime/scriptrunner/script_runner.py` | `get_pages()` | 636 | Standalone read: event parameter | Script runner thread |
| `lib/streamlit/watcher/local_sources_watcher.py` | `get_pages()` | 85 | Standalone read: `.values()` iteration | Watcher thread |

### Thread Safety Concerns

1. **Compound `set_pages()` + `get_page_script()` in `st.navigation`:** These two calls must execute atomically. Thread A could call `set_pages()`, then Thread B could call `set_pages()` with different pages, causing Thread A's subsequent `get_page_script()` to resolve against the wrong page registry.

2. **`get_pages()` iteration during concurrent mutation:** Under free-threaded Python (PEP 703), iterating a dict while another thread mutates it is unsafe. Even under the GIL, callers may hold references to the returned dict and be surprised when it changes.

3. **Class-level `uses_pages_directory`:** This is currently a class attribute that could be modified by any instance. Should be moved to an instance attribute.

---

## Files Changed

| File | Change Summary |
|------|----------------|
| `lib/streamlit/runtime/pages_manager.py` | Add `threading.Lock`, new `set_pages_and_resolve()`, modify `get_pages()` to return copy, make `get_page_script()` private, move `uses_pages_directory` to instance |
| `lib/streamlit/commands/navigation.py` | Replace `set_pages()` + `get_page_script()` with `set_pages_and_resolve()` |
| `lib/tests/streamlit/runtime/pages_manager_test.py` | Add thread safety tests, update existing tests for new API |

**No changes required for these files (existing usage patterns remain valid):**
- `lib/streamlit/commands/execution_control.py` — `get_pages()` returns a copy, iteration is safe
- `lib/streamlit/elements/widgets/button.py` — `get_pages()` returns a copy, iteration is safe
- `lib/streamlit/runtime/app_session.py` — `get_pages()` returns a copy, iteration is safe
- `lib/streamlit/runtime/context_util.py` — `get_pages()` returns a copy, iteration is safe
- `lib/streamlit/runtime/scriptrunner/script_runner.py` — `get_pages()` returns a copy, no change needed
- `lib/streamlit/watcher/local_sources_watcher.py` — `get_pages()` returns a copy, iteration is safe

---

## Detailed Changes

### 1. `lib/streamlit/runtime/pages_manager.py`

#### Add lock and move class attribute to instance

**Before:**

```python
class PagesManager:
    uses_pages_directory: bool | None = None

    def __init__(
        self,
        main_script_path: ScriptPath,
        script_cache: ScriptCache | None = None,
        **kwargs: Any,
    ) -> None:
        self._main_script_path = main_script_path
        self._main_script_hash: PageHash = calc_hash(main_script_path)
        self._script_cache = script_cache
        self._intended_page_script_hash: PageHash | None = None
        self._intended_page_name: PageName | None = None
        self._current_page_script_hash: PageHash = ""
        self._pages: dict[PageHash, PageInfo] | None = None
        if PagesManager.uses_pages_directory is None:
            PagesManager.uses_pages_directory = Path(
                self.main_script_parent / "pages"
            ).exists()
```

**After:**

```python
import threading

class PagesManager:
    def __init__(
        self,
        main_script_path: ScriptPath,
        script_cache: ScriptCache | None = None,
        **kwargs: Any,
    ) -> None:
        self._lock = threading.Lock()
        self._main_script_path = main_script_path
        self._main_script_hash: PageHash = calc_hash(main_script_path)
        self._script_cache = script_cache
        self._intended_page_script_hash: PageHash | None = None
        self._intended_page_name: PageName | None = None
        self._current_page_script_hash: PageHash = ""
        self._pages: dict[PageHash, PageInfo] | None = None
        self._uses_pages_directory: bool = Path(
            self.main_script_parent / "pages"
        ).exists()

    @property
    def uses_pages_directory(self) -> bool:
        """Return whether the app uses a pages directory (MPA v1 pattern)."""
        return self._uses_pages_directory
```

#### Add new atomic `set_pages_and_resolve()` method

**Add after `get_pages()` method:**

```python
def set_pages_and_resolve(
    self,
    pages: dict[PageHash, PageInfo],
    fallback_page_hash: PageHash = "",
) -> PageInfo | None:
    """Atomically set the page registry and resolve the current page.

    This replaces the separate set_pages() + get_page_script() calls,
    ensuring the page resolution sees the pages that were just set,
    even under concurrent access.

    Parameters
    ----------
    pages : dict[PageHash, PageInfo]
        The page registry to set.
    fallback_page_hash : PageHash
        The fallback page hash to use if the intended page is not found.

    Returns
    -------
    PageInfo | None
        The resolved page info, or None if no matching page is found.
    """
    with self._lock:
        self._pages = pages
        return self._resolve_page_script(fallback_page_hash)
```

#### Modify `get_pages()` to return a dict copy

**Before:**

```python
def get_pages(self) -> dict[PageHash, PageInfo]:
    return self._pages or {
        self.main_script_hash: {
            "page_script_hash": self.intended_page_script_hash or "",
            "page_name": self.intended_page_name or "",
            "icon": "",
            "script_path": self.main_script_path,
        }
    }
```

**After:**

```python
def get_pages(self) -> dict[PageHash, PageInfo]:
    """Return a snapshot of the current page registry.

    Lock-protected for free-threaded Python (PEP 703) where
    iterating a dict during concurrent mutation is unsafe.
    Returns a shallow copy so callers can safely iterate.
    """
    with self._lock:
        if self._pages is not None:
            return dict(self._pages)
        return {
            self.main_script_hash: {
                "page_script_hash": self.intended_page_script_hash or "",
                "page_name": self.intended_page_name or "",
                "icon": "",
                "script_path": self.main_script_path,
            }
        }
```

#### Make `get_page_script()` private as `_resolve_page_script()`

**Before:**

```python
def get_page_script(self, fallback_page_hash: PageHash = "") -> PageInfo | None:
    if self._pages is None:
        return None

    if self.intended_page_script_hash:
        return self._pages.get(
            self.intended_page_script_hash,
            self._pages.get(fallback_page_hash, None),
        )
    if self.intended_page_name:
        return next(
            filter(
                lambda p: p and (p["url_pathname"] == self.intended_page_name),
                self._pages.values(),
            ),
            None,
        )

    return self._pages.get(fallback_page_hash, None)
```

**After:**

```python
def _resolve_page_script(self, fallback_page_hash: PageHash = "") -> PageInfo | None:
    """Internal resolver — caller must hold self._lock.

    Resolves the page script based on intended_page_script_hash or
    intended_page_name, falling back to fallback_page_hash if needed.
    """
    if self._pages is None:
        return None

    if self.intended_page_script_hash:
        return self._pages.get(
            self.intended_page_script_hash,
            self._pages.get(fallback_page_hash, None),
        )
    if self.intended_page_name:
        return next(
            filter(
                lambda p: p and (p["url_pathname"] == self.intended_page_name),
                self._pages.values(),
            ),
            None,
        )

    return self._pages.get(fallback_page_hash, None)
```

#### Remove public `set_pages()` method

**Before:**

```python
def set_pages(self, pages: dict[PageHash, PageInfo]) -> None:
    self._pages = pages
```

**After:**

Remove this method entirely. All callers should use `set_pages_and_resolve()` instead.

If backward compatibility is needed for tests, keep it as a private method:

```python
def _set_pages(self, pages: dict[PageHash, PageInfo]) -> None:
    """Internal method for setting pages. Use set_pages_and_resolve() instead."""
    with self._lock:
        self._pages = pages
```

#### Keep `set_current_page_script_hash()` unchanged

This method is a standalone write that doesn't participate in compound operations with `get_pages()` or `set_pages_and_resolve()`. The tech spec notes:

> `set_current_page_script_hash()` — No lock needed — standalone write, not read by `set_pages_and_resolve()` or any compound operation.

```python
def set_current_page_script_hash(self, page_script_hash: PageHash) -> None:
    self._current_page_script_hash = page_script_hash
```

---

### 2. `lib/streamlit/commands/navigation.py`

#### Replace compound `set_pages()` + `get_page_script()` with atomic call

**Before (lines 462-466):**

```python
# Inform our page manager about the set of pages we have
ctx.pages_manager.set_pages(pagehash_to_pageinfo)
found_page = ctx.pages_manager.get_page_script(
    fallback_page_hash=default_page._script_hash
)
```

**After:**

```python
# Inform our page manager about the set of pages we have and resolve the current page
found_page = ctx.pages_manager.set_pages_and_resolve(
    pagehash_to_pageinfo,
    fallback_page_hash=default_page._script_hash,
)
```

---

### 3. `lib/tests/streamlit/runtime/pages_manager_test.py`

#### Update existing tests to use new API

**Before (tests using `set_pages()` + `get_page_script()`):**

```python
def test_get_page_script_valid_hash(self):
    """Ensure the page script is provided with valid page hash specified"""
    self.pages_manager.set_script_intent("page_hash", "")
    self.pages_manager.set_pages({"page_hash": {"page_script_hash": "page_hash"}})

    page_script = self.pages_manager.get_page_script(
        self.pages_manager.main_script_hash
    )
    assert page_script["page_script_hash"] == "page_hash"
```

**After:**

```python
def test_set_pages_and_resolve_valid_hash(self):
    """Ensure the page script is provided with valid page hash specified."""
    self.pages_manager.set_script_intent("page_hash", "")
    page_script = self.pages_manager.set_pages_and_resolve(
        {"page_hash": {"page_script_hash": "page_hash"}},
        fallback_page_hash=self.pages_manager.main_script_hash,
    )
    assert page_script is not None
    assert page_script["page_script_hash"] == "page_hash"
```

#### Add thread safety tests

```python
import threading
import time

def test_get_pages_returns_copy():
    """Ensure get_pages() returns a copy, not the internal dict."""
    pages_manager = PagesManager("main_script_path")
    pages_manager.set_pages_and_resolve(
        {"hash1": {"page_script_hash": "hash1", "script_path": "/path1"}},
    )

    pages = pages_manager.get_pages()
    pages["hash2"] = {"page_script_hash": "hash2", "script_path": "/path2"}

    # Internal dict should not be modified
    assert "hash2" not in pages_manager.get_pages()


def test_get_pages_snapshot_isolation():
    """Ensure get_pages() snapshot is not affected by concurrent mutations."""
    pages_manager = PagesManager("main_script_path")
    pages_manager.set_pages_and_resolve(
        {"hash1": {"page_script_hash": "hash1", "script_path": "/path1"}},
    )

    # Get a snapshot
    snapshot = pages_manager.get_pages()

    # Mutate the original
    pages_manager.set_pages_and_resolve(
        {"hash2": {"page_script_hash": "hash2", "script_path": "/path2"}},
    )

    # Snapshot should still have old data
    assert "hash1" in snapshot
    assert "hash2" not in snapshot


def test_set_pages_and_resolve_atomicity():
    """Ensure set_pages_and_resolve() is atomic under concurrent access."""
    pages_manager = PagesManager("main_script_path")
    results = []
    errors = []

    pages_a = {"hash_a": {"page_script_hash": "hash_a", "url_pathname": "page_a"}}
    pages_b = {"hash_b": {"page_script_hash": "hash_b", "url_pathname": "page_b"}}

    def writer_a():
        for _ in range(100):
            pages_manager.set_script_intent("", "page_a")
            result = pages_manager.set_pages_and_resolve(pages_a)
            if result is not None:
                results.append(("a", result.get("page_script_hash")))

    def writer_b():
        for _ in range(100):
            pages_manager.set_script_intent("", "page_b")
            result = pages_manager.set_pages_and_resolve(pages_b)
            if result is not None:
                results.append(("b", result.get("page_script_hash")))

    thread_a = threading.Thread(target=writer_a)
    thread_b = threading.Thread(target=writer_b)

    thread_a.start()
    thread_b.start()
    thread_a.join()
    thread_b.join()

    # Each result should match its writer (atomicity check)
    for writer, hash_value in results:
        if writer == "a":
            assert hash_value == "hash_a", f"Writer A got {hash_value}"
        else:
            assert hash_value == "hash_b", f"Writer B got {hash_value}"


def test_concurrent_get_pages_does_not_raise():
    """Ensure concurrent get_pages() calls do not raise during iteration."""
    pages_manager = PagesManager("main_script_path")
    pages = {f"hash{i}": {"page_script_hash": f"hash{i}"} for i in range(100)}
    pages_manager.set_pages_and_resolve(pages)

    errors = []

    def reader():
        try:
            for _ in range(100):
                for page_hash, page_info in pages_manager.get_pages().items():
                    _ = page_info.get("page_script_hash")
        except Exception as e:
            errors.append(e)

    def writer():
        for i in range(100):
            new_pages = {f"hash{i}": {"page_script_hash": f"hash{i}"}}
            pages_manager.set_pages_and_resolve(new_pages)

    threads = [threading.Thread(target=reader) for _ in range(5)]
    threads.append(threading.Thread(target=writer))

    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 0, f"Errors during concurrent access: {errors}"


def test_uses_pages_directory_is_instance_attribute():
    """Ensure uses_pages_directory is an instance attribute, not class-level."""
    pm1 = PagesManager("path1")
    pm2 = PagesManager("path2")

    # Each instance should have its own attribute
    assert hasattr(pm1, "_uses_pages_directory")
    assert hasattr(pm2, "_uses_pages_directory")

    # The property should be accessible
    _ = pm1.uses_pages_directory
    _ = pm2.uses_pages_directory
```

---

## Design Decisions

### 1. Single Lock vs Per-Field Locks

**Decision:** Use a single `threading.Lock` for all mutable state.

**Rationale:** `PagesManager` has few mutable fields (`_pages`, `_current_page_script_hash`) and operations are fast (dict assignment, dict copy). A single lock is simpler, avoids deadlock risks from lock ordering, and has negligible performance impact given the low contention expected. The tech spec does not prescribe per-field locking for `PagesManager`.

### 2. Atomic `set_pages_and_resolve()` vs Lock-Protected Separate Methods

**Decision:** Replace `set_pages()` + `get_page_script()` with atomic `set_pages_and_resolve()`.

**Rationale:** The tech spec explicitly prescribes this approach:

> Add `threading.Lock` internally and refactor the API to eliminate exposed get/set pairs that are unsafe to call independently under concurrency.

Keeping `set_pages()` and `get_page_script()` as separate lock-protected methods would still allow callers to interleave calls from different threads. The atomic method ensures the write-then-read is indivisible.

### 3. Dict Copy vs Snapshot Object

**Decision:** `get_pages()` returns `dict(self._pages)` (shallow copy).

**Rationale:** A shallow copy is sufficient because:
- The dict values (`PageInfo` dicts) are not mutated after creation
- Callers only need to iterate or look up pages, not modify them
- A shallow copy is fast and idiomatic Python
- The tech spec prescribes: "Lock-protected for free-threaded Python (PEP 703) where iterating a dict during concurrent mutation is unsafe."

A frozen/immutable snapshot object would add complexity without clear benefit.

### 4. `set_current_page_script_hash()` Without Lock

**Decision:** Keep `set_current_page_script_hash()` without lock protection.

**Rationale:** The tech spec explicitly states:

> `set_current_page_script_hash()` — No lock needed — standalone write, not read by `set_pages_and_resolve()` or any compound operation.

This is a simple attribute assignment that doesn't participate in any compound operation. Under both GIL and free-threaded Python, a single attribute assignment is atomic enough for this use case.

### 5. Moving `uses_pages_directory` to Instance Attribute

**Decision:** Move from class attribute to instance attribute.

**Rationale:** The tech spec notes:

> The class-level `uses_pages_directory` flag is moved to an instance attribute (`self._uses_pages_directory`) since it is session-scoped state, not process-wide.

A class attribute is shared across all instances and could cause unexpected behavior if multiple sessions have different directory structures.

---

## Test Plan

### Unit Tests (add to `lib/tests/streamlit/runtime/pages_manager_test.py`)

| Test Name | Description |
|-----------|-------------|
| `test_set_pages_and_resolve_valid_hash` | Verify atomic set+resolve returns correct page when intended hash matches |
| `test_set_pages_and_resolve_invalid_hash` | Verify atomic set+resolve returns fallback when intended hash doesn't match |
| `test_set_pages_and_resolve_valid_name` | Verify atomic set+resolve returns correct page when intended name matches |
| `test_set_pages_and_resolve_invalid_name` | Verify atomic set+resolve returns None when intended name doesn't match |
| `test_set_pages_and_resolve_fallback` | Verify atomic set+resolve returns fallback page when no intent is set |
| `test_get_pages_returns_copy` | Verify mutations to returned dict don't affect internal state |
| `test_get_pages_snapshot_isolation` | Verify snapshot is not affected by subsequent writes |
| `test_get_pages_default_when_none` | Verify default page info returned when `_pages` is None |
| `test_set_pages_and_resolve_atomicity` | Verify concurrent writers get consistent results |
| `test_concurrent_get_pages_does_not_raise` | Verify concurrent reads during writes don't raise |
| `test_uses_pages_directory_is_instance_attribute` | Verify attribute is per-instance, not class-level |
| `test_set_current_page_script_hash_basic` | Verify simple write still works |

### Integration Considerations

- **No E2E tests needed:** The thread safety changes are internal implementation details. Existing E2E tests for `st.navigation` and `st.switch_page` will exercise the new code paths.
- **Existing tests:** Update tests in `lib/tests/streamlit/navigation/page_test.py`, `lib/tests/streamlit/runtime/fragment_test.py`, and `lib/tests/streamlit/runtime/scriptrunner_utils/script_run_context_test.py` that call `set_pages()` to use the new API or the internal `_set_pages()` method.

---

## Scope Boundaries

### This PR DOES:
- Add `threading.Lock` to `PagesManager`
- Add new atomic `set_pages_and_resolve()` method
- Modify `get_pages()` to return a dict copy
- Make `get_page_script()` private as `_resolve_page_script()`
- Remove or make private the `set_pages()` method
- Move `uses_pages_directory` from class attribute to instance attribute
- Update `navigation.py` to use the new atomic method
- Add thread safety unit tests

### This PR does NOT:
- Add locks to `SafeSessionState` (already thread-safe)
- Add locks to `FragmentStorage` (covered in separate task)
- Add locks to `SharedRunState` / shared sets (covered in separate task)
- Change `ScriptRunContext` structure (covered in separate task)
- Add locks to `ForwardMsgQueue` (already safe via event loop serialization)
- Change any frontend code
- Add new public API methods to `st.*` namespace
- Change the behavior of `st.navigation` or `st.switch_page` from the user's perspective

---

## Open Questions

None. The tech spec provides clear guidance on the implementation approach.

---

## References

- Tech spec: `specs/2026-03-05-parallel-fragments/tech-spec.md` (lines 737-803)
- Current implementation: `lib/streamlit/runtime/pages_manager.py`
- Primary caller: `lib/streamlit/commands/navigation.py`
