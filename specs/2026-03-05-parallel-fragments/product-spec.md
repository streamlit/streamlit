---
author: sfc-gh-lwilby
created: 2026-03-05
---

# Parallel Fragments

## Summary

Extend `@st.fragment` with a `parallel: bool = False` parameter so that fragment functions
run in separate threads during a full app run. Independent sections of a dashboard execute
concurrently instead of sequentially, reducing total page load time from the sum of all
section times to the maximum of any single section. Content appears progressively as each
fragment completes.

**Demo app:** [parallel-fragments.streamlit.app](https://parallel-fragments.streamlit.app/)

## Problem

### Current Behavior

Streamlit executes the entire script top-to-bottom on every run. `@st.fragment` allows
sections to rerun independently when their widgets change, but during the initial full-app
run, all fragments still execute sequentially on the script runner thread:

```python
@st.fragment
def sales_dashboard():
    data = fetch_sales_data()  # 2 seconds
    st.line_chart(data)

@st.fragment
def inventory_status():
    data = fetch_inventory()   # 2 seconds
    st.dataframe(data)

@st.fragment
def ml_predictions():
    preds = run_model()        # 2 seconds
    st.bar_chart(preds)

sales_dashboard()    # runs first  (0-2s)
inventory_status()   # runs second (2-4s)
ml_predictions()     # runs third  (4-6s)
# Total: 6 seconds — each section appears as it completes, but the last
# section doesn't appear until 6s even though all loads are independent
```

Each fragment waits for the previous one to finish. The user sees a blank page for 6
seconds (or content appearing section-by-section over 6 seconds), even though the three
data loads are completely independent.

**Current workarounds:** Users manually spawn threads with `threading.Thread` and call
the internal `add_script_run_ctx()` API to propagate Streamlit's context. This is fragile,
undocumented, and error-prone — context can be lost, exceptions aren't handled correctly,
and the script may finish before threads complete (causing stale or missing output).

### Why This Matters

The sequential execution model is a fundamental bottleneck for dashboards and multi-section
apps. Real-world apps often have 3-10 independent sections, each making database queries or
API calls. Total load time scales linearly with the number of sections. With parallel
execution, all sections start loading simultaneously and appear within the time of the
slowest section, not the sum.

[#8490](https://github.com/streamlit/streamlit/issues/8490) (104 reactions) is the
strongest community signal — users want native threading support without resorting to the
internal `add_script_run_ctx` workaround. That workaround is fragile: context can be lost,
exceptions aren't handled correctly, and threads can outlive the script run — causing stale
output to bleed into the next run's UI
([#9904](https://github.com/streamlit/streamlit/issues/9904)).

## Proposal

### API

Add a `parallel` parameter to `@st.fragment`:

```python
@overload
def fragment(
    func: F,
    *,
    run_every: int | float | timedelta | str | None = None,
    parallel: bool = False,
) -> F: ...

@overload
def fragment(
    func: None = None,
    *,
    run_every: int | float | timedelta | str | None = None,
    parallel: bool = False,
) -> Callable[[F], F]: ...
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `func` | `callable` | `None` | The function to turn into a fragment. |
| `run_every` | `int \| float \| timedelta \| str \| None` | `None` | Time interval between automatic fragment reruns. |
| `parallel` | `bool` | `False` | If `True`, the fragment runs in a separate thread during full app runs. Content renders progressively as the thread completes. |

### Examples

**Basic usage:**

```python
@st.fragment(parallel=True)
def sales_dashboard():
    data = fetch_sales_data()  # 2s I/O
    st.line_chart(data)

@st.fragment(parallel=True)
def inventory_status():
    data = fetch_inventory()   # 2s I/O
    st.dataframe(data)

sales_dashboard()   # dispatched to thread, main thread continues
inventory_status()  # dispatched to thread, main thread continues
# Both run concurrently — total ~2s instead of 4s
```

**Mixed parallel and sequential fragments:**

```python
st.title("Dashboard")

@st.fragment(parallel=True)
def slow_section():
    data = fetch_from_slow_api()  # 3s
    st.bar_chart(data)

@st.fragment
def fast_section():
    st.metric("Users online", get_user_count())

slow_section()    # dispatched to thread
fast_section()    # runs inline (not parallel) — renders immediately
st.write("Footer renders immediately")
# fast_section and footer are visible while slow_section is still loading
```

**Combining with `run_every`:**

```python
@st.fragment(parallel=True, run_every="30s")
def live_metrics():
    data = fetch_live_data()  # slow query
    st.metric("Revenue", data.revenue)
```

`parallel=True` means the fragment runs in a thread during the initial full-app run.
Periodic `run_every` reruns execute sequentially on the script runner thread for MVP
(see Execution model).

**Composing with async support (future):**

```python
@st.fragment(parallel=True)
async def async_dashboard():
    # asyncio.gather runs all three fetches concurrently on this thread's event loop
    sales, inventory, predictions = await asyncio.gather(
        fetch_sales_async(),
        fetch_inventory_async(),
        fetch_predictions_async(),
    )
    st.line_chart(sales)
    st.dataframe(inventory)
    st.bar_chart(predictions)
```

`parallel=True` gives concurrency *between* fragments (each gets its own thread).
`async def` with `asyncio.gather` gives concurrency *within* a fragment (multiple I/O
calls overlap on one thread via the event loop). They compose: the fragment runs in its
own thread with a working event loop, and multiple async calls within it run concurrently.

### Key decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| API surface | `@st.fragment(parallel=True)` — boolean parameter | Simpler than an enum; the only viable third mode (`"background"`) is better as a separate API. |
| Execution scope (MVP) | Parallel during full-app runs only; fragment reruns stay sequential | Delivers core value (page load speedup) without expanding scope. Parallel reruns are a small follow-up. |
| Return value | `None` (call returns immediately) | Thread hasn't completed yet; matches STEP spec. |
| Session state | Shared, single-operation atomicity via `RLock` | Multi-op sequences (e.g. `+=`) are the user's responsibility — standard Python threading. |
| `st.stop()` / `st.rerun(scope="app")` | Stop/rerun the entire run; cancel all other parallel fragment threads in the run via cooperative cancellation | Consistent with regular fragment behavior — preserves the "drop-in upgrade" goal. |
| `st.rerun(scope="fragment")` | Local to the calling fragment's thread | Same as regular fragments; other fragments unaffected. |
| `@st.dialog` | Prohibited during parallel execution; dialogs gated behind user interactions work normally | Non-deterministic dialog ordering during parallel runs violates principle #33. Dialogs triggered by user actions (button click, row selection) only execute during sequential fragment reruns, so they are unaffected. |
| `st.switch_page` | Prohibited during parallel execution; page navigation from sequential fragment reruns works normally | Navigating aborts all other parallel fragment threads and races on the destination page. Navigation triggered by user actions only executes during sequential fragment reruns, so there is no conflict. |
| Nesting | Regular and parallel fragments can nest inside parallel fragments | Thread count bounded by call sites, not depth. Outer waits for inner parallel fragments. |
| Loading UX (initial) | No built-in loading indicator; container is reserved but empty until the thread produces output | Keeps `parallel=True` as a pure execution modifier — no UI side effects. Users can add their own loading UX (e.g., `st.spinner`, a future `st.skeleton` context manager) as needed. |
| Loading UX (rerun) | Stale ghosting of previous content | Existing fragment rerun behavior — no change. |
| Error handling | Error renders inline in the failing fragment's container | Other fragments continue normally. |
| Concurrency limit | Thread pool with configurable `max_workers`; sensible default | Prevents resource exhaustion in loops; transparent for the common case of a few fragments. |
| GIL / free-threaded Python | MVP targets standard Python; opportunistic no-GIL changes only | I/O-bound workloads (the primary use case) already get real parallelism under the GIL. |

Each decision is discussed in detail in the sections below.

<details>
<summary>Also considered: execution enum instead of parallel boolean</summary>

#### `execution: Literal["sequential", "parallel"]` instead of `parallel: bool`

An alternative API using a string enum for the execution mode:

```python
@st.fragment(execution="parallel")
def sales_dashboard():
    ...
```

Both options extend `@st.fragment` with a new keyword argument (satisfying API principle
#16: Extend Before Inventing). The question is whether the parameter should be a boolean
or a string enum.

**Comparison:**

| Aspect | `parallel: bool` | `execution: Literal[...]` |
|--------|-------------------|---------------------------|
| Readability | Clear and direct — `parallel=True` says exactly what it does | More verbose but self-documenting — parameter name says *what dimension*, value says *how* |
| Discoverability | Autocomplete shows `True`/`False` — simple | Requires knowing valid string values |
| Extensibility | Closed — a third mode requires a new parameter or breaking change | Open — adding new values is non-breaking |
| API principle #31 | Passes *if* genuinely two-state | Full pass — enum from the start |
| Precedent | `disabled=True` on widgets | `label_visibility`, `scope` on `st.rerun` |

**Why we chose the boolean:**

The enum's advantage is extensibility, but the candidate future values don't hold up:

| Value | Meaning | Why not |
|-------|---------|---------|
| `"background"` | Thread outlives the script run, computation spans reruns | There is community evidence for this pattern ([#10578](https://github.com/streamlit/streamlit/issues/10578), yuzeliao-oai Dec 2025). However, background tasks are arguably a different *concept* from fragments — they run headless computation rather than rendering UI sections. A separate `st.background_task()` API may be more appropriate than overloading the fragment decorator. See ideas-overview.md §5 for full analysis. |
| ~~`"lazy"`~~ | ~~Only execute when visible~~ | Already achievable with conditionals — the dynamic tabs/expander `on_change="rerun"` + `.open` pattern lets the container control whether the fragment body runs. Redundant as a fragment execution mode. |
| ~~`"deferred"`~~ | ~~Execute after main script completes~~ | No value — code that should run last can just be placed at the bottom of the script. |

The only candidate with real evidence is `"background"`, but it's likely better served by
a separate API (`st.background_task()`) because background tasks and fragments have
different purposes, lifetimes, and mental models. If background tasks do end up as a
fragment mode, migrating from `parallel: bool` to an enum at that point is a manageable
one-time cost. The boolean is simpler for what we know today.

</details>

<details>
<summary>Also considered: @st.parallel_fragment — new decorator</summary>

#### `@st.parallel_fragment` instead of `@st.fragment(parallel=True)`

A separate decorator for parallel fragments:

```python
@st.parallel_fragment
def sales_dashboard():
    data = fetch_sales_data()
    st.line_chart(data)
```

**Why not:**

| API Principle | Verdict | Reasoning |
|---------------|:-------:|-----------|
| #3 Consistency Over Novelty | **Fail** | Introduces a new flow control primitive alongside `@st.fragment`. Users must learn when to use which. |
| #16 Extend Before Inventing | **Fail** | The principle says: "Adding `accept_new_options` to `st.selectbox` is better than `st.creatable_selectbox`." Same logic: adding `parallel=True` to `@st.fragment` is better than `@st.parallel_fragment`. |
| #30 Patterns Are Sacred | **Fail** | `@st.fragment(run_every=...)` established the pattern of parameterizing fragment behavior via kwargs. A new decorator breaks this pattern. |
| #39 Flat Namespace | Mild concern | Adds another decorator to the `st` namespace. |

Parallel fragments share the same lifecycle, storage, and rerun mechanics as regular
fragments. They're fragments with a threading modifier, not a fundamentally different
concept. A separate decorator implies a larger conceptual difference than actually exists.

</details>

<details>
<summary>Also considered: async def on @st.fragment — no new API surface</summary>

#### `async def` as a signal for parallel execution

From Thiago's original STEP spec — use `async def` on fragment functions to indicate they
should run in parallel:

```python
@st.fragment
async def sales_dashboard():
    data = fetch_sales_data()
    st.line_chart(data)
```

**Why not:**

| API Principle | Verdict | Reasoning |
|---------------|:-------:|-----------|
| #5 Explicit Over Implicit | **Fail** | Parallelization is inferred from the function signature rather than stated explicitly. Reading `@st.fragment` on an `async def` gives no indication this means "run in a thread." |
| #12 Pythonic Idioms | **Fail** | `async def` in Python means coroutine — `await`, event loops, cooperative multitasking. Using it for thread-based parallelism is a misuse of the keyword. |
| #21 Avoid "Too Clever" | **Fail** | Same as the "key='?foo' for query params" anti-pattern from the design guide. Clever but hard to discover and confusing. |
| #27 Same Name, Same Behavior | **Fail** | **Disqualifying.** The async support spec (Lukas) uses `async def` on `@st.fragment` to mean "this fragment uses `await`." Same syntax, different behavior depending on which feature shipped. These two features must coexist: `@st.fragment(parallel=True) async def f()` = runs in a thread AND uses `await` internally. |

The `async def` conflict with the async support plan is the strongest reason to reject
this option. Both features are planned — `async def` must be reserved for its standard
Python meaning (coroutines), and parallel execution must be signaled explicitly via a
parameter.

</details>

### Behavior

#### Execution model

- During a **full app run**, parallel fragments are dispatched to a **thread pool** at their
  call site. The main thread continues executing the rest of the script immediately. If the
  number of parallel fragments exceeds the pool's `max_workers`, excess fragments queue and
  execute as workers become available.
- During **fragment-only reruns** (widget interaction, `run_every`, `st.rerun(scope="fragment")`),
  fragments execute sequentially on the script runner thread, same as today. Parallelizing
  fragment reruns is a follow-up — it reuses the same threading infrastructure built for
  full-app runs, and extending the fragment rerun loop to dispatch in parallel is a small,
  localized change once that infrastructure exists.
- A **barrier** before `scriptFinished` joins all worker threads. The run is not considered
  complete until all parallel fragments finish.

**Concurrency limit:** The thread pool bounds the number of simultaneously running parallel
fragments. The default `max_workers` should be chosen to work well for typical Streamlit
deployments without configuration (exact value to be determined during prototyping). For
advanced users or constrained environments, a configuration option will allow overriding
the default. This prevents resource exhaustion when parallel fragments are used in loops
while being transparent for the common case of a small number of fragments.

**Also considered — no concurrency limit:** An alternative is to spawn a new thread per
parallel fragment with no cap, leaving resource management entirely to the developer (same
as `threading.Thread` in a loop). This is consistent with how Streamlit handles other
features — there are no caps on widget count, column count, or fragment count. However,
parallel fragments are the first Streamlit feature where each call site creates an OS-level
resource (thread stack, context-switching overhead) rather than a lightweight UI element.
For the anticipated primary use case — a bounded number of dashboard sections — the
distinction is irrelevant. But for more sophisticated usage (e.g., parallel fragments in
data-driven loops), users would typically reach for a `ThreadPoolExecutor` anyway. Providing
a thread pool by default means Streamlit handles this correctly out of the box, and the
configurable `max_workers` gives advanced users the same control they'd have with their own
pool.

#### Progressive rendering

When a parallel fragment is dispatched, its container is reserved at the call site in the
script's top-to-bottom order. The main thread continues past the call site immediately, so
non-fragment content and subsequent fragments render without waiting. Content fills into
each fragment's container as its thread completes — fast fragments appear first.

**Initial load (no previous content):** While a parallel fragment's thread is running, the
reserved container is empty. Content below the fragment is not blocked — it renders
normally. Once the thread produces its first output, the fragment's actual content appears
in the reserved container. There is no built-in loading indicator; `parallel=True` is a
pure execution modifier that does not introduce UI side effects. Users who want loading
feedback can wrap their fragment body with `st.spinner` or a similar loading primitive.

**Reruns (previous content exists):** When a parallel fragment reruns (widget interaction,
`run_every`, `st.rerun(scope="fragment")`), the existing behavior applies: the previous
content remains visible but is dimmed (stale ghosting) while the thread re-executes. Once
the new content arrives, it replaces the stale elements.

Widgets in already-rendered sections are interactive while other sections are still loading.

#### Capabilities

Everything allowed in a regular fragment is allowed in a parallel fragment: widgets,
`st.form`, `st.rerun()`, session state, nested fragments, `st.empty()`, caching
(`@st.cache_data`, `@st.cache_resource`), etc.

**Goal:** `parallel=True` is a drop-in upgrade — add the parameter and existing fragment
code works unchanged.

Fragments can be nested inside parallel fragments, including other parallel fragments. A
regular `@st.fragment` nested inside a parallel fragment runs on the outer's thread, same as
nesting regular fragments today. A `@st.fragment(parallel=True)` nested inside another
parallel fragment spawns a new thread from the outer's thread — the outer fragment waits for
all its inner parallel fragments before completing. Thread count is bounded by the number of
parallel fragment call sites in the code, not by nesting depth.

#### Restrictions

**Dialogs:** `@st.dialog` is prohibited during parallel execution (the threaded run during a
full-app run). If `@st.dialog` is called during this phase, a `StreamlitAPIException` is
raised. During parallel execution, multiple threads run simultaneously and which thread
reaches a dialog first depends on thread scheduling — this is non-deterministic for the same
code and state, violating API design principle #33 (Deterministic Output).

In practice, this restriction does not affect the common pattern of opening a dialog from a
user interaction (button click, row selection) inside a parallel fragment. Dialogs gated
behind a user interaction do not execute during the initial parallel run (the interaction
hasn't happened yet), and the subsequent fragment rerun triggered by the interaction is
sequential — only the interacted fragment reruns, so there is no race:

```python
@st.fragment(parallel=True)
def dashboard_card():
    data = fetch_data()          # benefits from parallel execution
    st.metric("Revenue", data.revenue)
    if st.button("Details"):
        details_dialog(data)     # only runs on user click → sequential rerun, safe
```

The runtime can distinguish parallel and sequential execution contexts because the fragment
already knows whether it is executing as part of a full-app run or a fragment rerun.

**Page navigation:** `st.switch_page` is prohibited during parallel execution for the same
reason. Navigating mutates query params and requests a rerun with a new page hash —
effectively aborting all other parallel fragment threads in the run to redirect to a different page. If
multiple fragments attempted to navigate simultaneously, the destination page would be
non-deterministic. During sequential fragment reruns (e.g., a button click that navigates
to a detail page), `st.switch_page` works normally — only one fragment is executing.

#### Session state

`st.session_state` is shared across all parallel fragments with single-operation atomicity
(individual reads and writes are thread-safe via `SafeSessionState`'s `RLock`).

Multi-operation sequences (e.g., read-modify-write like `+=`) are **not atomic** — this is
standard Python threading behavior and the user's responsibility.

#### Error handling

If one parallel fragment raises an exception, the error renders inline in that fragment's
container. Other fragments continue executing normally.

#### `st.stop()` and `st.rerun()`

These commands behave consistently with regular fragments — `parallel=True` does not change
their semantics:

- **`st.stop()`** stops the entire app run. The calling fragment's thread terminates, all
  other parallel fragment threads in the run are cancelled via cooperative cancellation, and
  the run ends. Content from fragments that already completed remains visible (same as
  calling `st.stop()` partway through a sequential script).
- **`st.rerun(scope="app")`** triggers a full app rerun. All other in-flight parallel
  fragment threads in the run are cancelled (their work is discarded since the rerun will
  re-execute everything), and the run restarts from the top of the script.
- **`st.rerun(scope="fragment")`** reruns only the calling fragment. The exception is local
  to that fragment's thread — other fragments are unaffected.

Cooperative cancellation means threads are not killed instantly. A thread blocked on
a long I/O call (e.g., a slow database query) will not terminate until that call returns and
the thread reaches its next yield point. This is inherent to Python threading — the barrier
waits for the blocked thread to finish. This limitation should be documented for users.

#### Return values

The return value of a parallel fragment is `None` (the call returns immediately before the
thread completes). This matches the STEP spec's decision.

### Performance expectations

| Workload | With GIL (standard Python) | Without GIL (free-threaded Python) |
|----------|---------------------------|-------------------------------------|
| **I/O-bound** (HTTP requests, database queries, file reads) | Real parallelism — the GIL is released during I/O waits, so threads run concurrently. | Same — I/O already releases the GIL, so behavior is unchanged. |
| **CPU-bound** (data transformation, computation) | No parallelism — threads cannot run Python bytecode simultaneously. | Real parallelism — threads run Python bytecode concurrently. |

Most Streamlit workloads are I/O-bound: fetching data from APIs, querying databases,
reading files. All of these operations release the GIL while waiting on an external
resource (network socket, disk), so parallel fragments provide real concurrency on
standard Python today. This is the primary use case.

**Free-threaded Python (PEP 703):** Python 3.13 introduced an experimental free-threaded
build (`--disable-gil`). Python 3.14 makes it officially supported (Phase II). On
free-threaded builds, the GIL caveat for CPU-bound work disappears entirely — threads can
run Python bytecode simultaneously, so CPU-heavy transforms inside parallel fragments
genuinely parallelize.

This makes the threading approach future-proof: the `@st.fragment(parallel=True)` API
designed for I/O concurrency today automatically upgrades to full parallelism on
free-threaded builds without any API changes.

**Scoping for this feature:** The MVP targets standard (GIL-enabled) Python. Free-threaded
Python support is a goal but not a gate — we will make opportunistic changes where they
don't expand scope (e.g., ensuring locks are correct under no-GIL), but we won't block
shipping on full free-threaded certification. Since the dominant Streamlit use case is
I/O-bound, the feature delivers its core value on standard Python.

### Forward compatibility

The parallel fragments design should not preclude future work in these areas:

- **Cross-fragment communication**
  ([#10045](https://github.com/streamlit/streamlit/issues/10045),
  [#12799](https://github.com/streamlit/streamlit/issues/12799)) — triggering specific
  fragment reruns from other fragments or from the main script. The fragment rerun dispatch
  path and cancellation mechanism should be general enough to support new trigger sources
  beyond the current "own widget only" path.
- **Parallel fragment reruns** — extending `parallel=True` to apply during fragment-only
  reruns (`run_every`, widget interactions), not just full-app runs. The threading
  infrastructure built for the MVP should be reusable for this with minimal changes.
- **Writing to outside containers**
  ([PR #13621](https://github.com/streamlit/streamlit/pull/13621)) — allowing fragments
  to write into containers created outside their scope. When multiple parallel fragments
  share an outside container, their cursor positions conflict. The threading and context
  isolation design should accommodate future cursor synchronization without requiring
  rearchitecture.
- **Background tasks / cross-rerun computation**
  ([#10578](https://github.com/streamlit/streamlit/issues/10578)) — long-running
  computation that outlives a single script run, continuing across reruns while the app
  remains interactive. This was considered as a potential `execution="background"` mode on
  `@st.fragment` (see [API alternatives above](#also-considered-execution-enum-instead-of-parallel-boolean))
  but is better served by a separate API (`st.background_task()`) because background tasks
  have a fundamentally different lifetime, purpose, and mental model from fragments. The
  boolean `parallel` parameter leaves room for this without overloading the fragment
  decorator.

---

## Addenda

### Existing work

- [PR #13139](https://github.com/streamlit/streamlit/pull/13139) — Lukas's parallel
  fragments prototype. Working proof-of-concept covering DG isolation
  (`contextvars.copy_context()`), thread-safe `ForwardMsgQueue`, and the progressive
  rendering barrier. Primary starting point for implementation.
- [PR #12668](https://github.com/streamlit/streamlit/pull/12668) — Thiago's threading
  improvements. `StreamlitThread` with auto-context propagation and `join()` before script
  done. Complementary generic threading infrastructure.
- [Thiago's STEP spec](https://github.com/streamlit/streamlit-enhancement-proposals/pull/2)
  (Oct 2025) — Original proposal for parallel fragments.

<details>
<summary>Why threads instead of async for inter-fragment concurrency?</summary>

### Could `async def` fragments achieve the same concurrency as `parallel=True`?

In theory, yes. If the script runner had an event loop and dispatched `async def` fragments
as concurrent tasks, multiple fragments could overlap their I/O at `await` points — same
concurrency, single thread, no GIL concerns:

```python
@st.fragment
async def sales_dashboard():
    data = await fetch_sales_async()  # yields to event loop
    st.line_chart(data)

@st.fragment
async def inventory_status():
    data = await fetch_inventory_async()  # yields to event loop
    st.dataframe(data)

# Both fetches in-flight simultaneously via the event loop — same 2s result
```

**Threading is the better choice for Streamlit's audience for practical reasons:**

1. **Works with synchronous code unchanged.** Users write `requests.get()`,
   `pd.read_sql()`, `snowflake.connector.execute()` — all blocking, synchronous calls.
   With `parallel=True`, this code works as-is in a thread. With async, users must switch
   to async libraries (aiohttp, asyncpg, etc.) and rewrite their data fetching.

2. **Blocking code in async fragments breaks everything.** A `time.sleep(2)` or
   `requests.get()` inside an `async def` fragment blocks the *entire event loop* — no
   other fragment can make progress until it returns. Users would need to deeply understand
   the async mental model to avoid this. With threads, blocking code is fine — it only
   blocks that fragment's thread.

3. **CPU-bound work.** Async never helps CPU-bound computation (everything runs on one
   thread, `await` only yields at I/O boundaries). Threads benefit on free-threaded Python
   (PEP 703).

4. **Bigger architectural change.** The script runner would need to become an async
   function on an event loop. Interleaving synchronous `st.write()` calls between
   fragment dispatches with async coroutine scheduling is non-trivial. Threads are more
   localized — spawn at the call site, join at the barrier.

**In short:** async could achieve the same I/O concurrency, but threading works with the
synchronous Python code Streamlit users already write. The async approach requires users
to learn async Python and adopt async libraries — a much higher adoption barrier for
Streamlit's target audience.

The two approaches compose rather than compete: `parallel=True` provides inter-fragment
concurrency via threads (works with sync code), while future `async def` support provides
intra-fragment concurrency via the event loop (for users who have async libraries).

</details>

<details>
<summary>Parallel fragments and long-running blocking calls</summary>

### Do parallel fragments make long-running blocking calls responsive?

No. Parallel fragments solve the bottleneck where independent sections wait for each
other — total page load drops from the sum of all sections to the maximum of any single
section. But they do not change the general responsiveness characteristics of a Streamlit
script during long-running blocking calls.

Streamlit uses a cooperative execution model: every `st.*` command acts as a yield point
where the runtime checks for pending rerun or stop requests. Between yield points (e.g.,
during a long `requests.get()` or `cursor.execute()`), the executing thread is blocked in
external code and Streamlit has no opportunity to intervene. This applies equally to the
main script thread and to parallel fragment threads — it is not something parallel fragments
introduce or change.

Users may expect `parallel=True` to make everything responsive, but it specifically
addresses the *between-section* bottleneck. For general script responsiveness during
long-running operations, `st.yield_point()` is the complementary solution — an explicit
yield point that users can insert in loops or between operations to let Streamlit check for
pending requests, improving responsiveness in code that makes multiple sequential blocking
calls.

</details>

<details>
<summary>Parallel fragments and indivisible long-running operations</summary>

### Does parallel=True prevent a slow operation from blocking the app?

No. Parallel fragments are bounded to the script run — a barrier joins all threads before
the run is considered complete. If one parallel fragment contains an indivisible long-running
operation (e.g., a 30-second model training call or a single slow database query that cannot
be split), that thread holds the barrier open for its entire duration. The app cannot start
a new rerun until all parallel fragment threads finish or are cancelled, and cancellation is
cooperative — a thread blocked in external code won't see the cancellation signal until the
blocking call returns.

When a rerun is triggered (e.g., a widget click), the runtime signals all other parallel fragment threads in the run
to cancel via cooperative cancellation. But a thread blocked in external code (e.g.,
mid-way through a 30-second query) won't see the cancellation signal until the blocking
call returns and the thread reaches its next yield point. The rerun waits for that thread
to exit before proceeding.

The complementary solution is `st.background_task()` — moving the long-running work
*outside* the script run entirely. A background task runs in its own managed thread with no
`ScriptRunContext`, producing data rather than UI. The script run stays fast (it just checks
whether the task has completed and renders accordingly), and the task continues independently
across reruns. See [Forward compatibility](#forward-compatibility) for the API-level
rationale for keeping this as a separate API rather than a fragment mode.

</details>
