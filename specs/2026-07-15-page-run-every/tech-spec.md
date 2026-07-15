---
author: lukasmasuch
created: 2026-07-15
---

# Tech spec: page-level `run_every` in `st.set_page_config`

## Summary

Implement page-level auto-rerun by **reusing the existing fragment `run_every`
machinery** end-to-end. The backend enqueues an `AutoRerun` `ForwardMsg` with an *empty*
`fragment_id` to mean "rerun the whole page," and the frontend's existing auto-rerun timer
logic fires a **full** rerun (no `fragmentId`) instead of a fragment-scoped one. No new
proto message and no new server-side scheduling are required.

See the [product spec](./product-spec.md) for motivation, API, and behavior.

## Problem

Fragment `run_every` already provides periodic, frontend-timer-driven reruns
([`lib/streamlit/runtime/fragment.py`](../../lib/streamlit/runtime/fragment.py),
[`frontend/app/src/App.tsx`](../../frontend/app/src/App.tsx)), but the timer callback is
hard-coded to a fragment scope, and the frontend `handleAutoRerun` explicitly *ignores*
auto-rerun messages without a fragment id:

```ts
// App.tsx (current behavior):
// handleAutoRerun bails on an empty fragment id ...
if (!fragmentId) {
  LOG.warn("Ignoring auto-rerun message without a fragment id.")
  return
}
// ... and the timer callback always sends a fragment-scoped rerun:
setInterval(
  () => this.widgetMgr.sendUpdateWidgetsMessage(fragmentId, true),
  interval * 1000
)
```

We need to (a) let `st.set_page_config` request an interval, and (b) let the frontend
treat an app-scoped auto-rerun as a full rerun.

## Proposal

### 1. Protobuf — reuse `AutoRerun`, empty `fragment_id` = app scope

No schema change is required. Today
[`AutoRerun`](../../proto/streamlit/proto/AutoRerun.proto) carries `interval` and
`fragment_id`. We define **empty/absent `fragment_id`** as "app-scoped auto-rerun." Only a
comment update:

```proto
message AutoRerun {
  // The interval of reruns in seconds.
  float interval = 1;

  // The fragment ID to rerun. If empty, the entire page is rerun (used by
  // st.set_page_config(run_every=...)).
  string fragment_id = 2;
}
```

Because it's a comment-only change, no `make protobuf` recompile is strictly required, but
we'll run it to be safe.

### 2. Backend — `st.set_page_config(run_every=...)`

In [`lib/streamlit/commands/page_config.py`](../../lib/streamlit/commands/page_config.py):

- Add the keyword-only `run_every: int | float | timedelta | str | None = None`
  parameter (with a `*` separator before it).
- Reuse the exact enqueue pattern from `fragment.py`, but with no `fragment_id`:

```python
from streamlit.time_util import time_to_seconds

if run_every is not None:
    auto_rerun_msg = ForwardProto()
    auto_rerun_msg.auto_rerun.interval = time_to_seconds(
        run_every, coerce_none_to_inf=False
    )
    # fragment_id left empty -> app-scoped (full-page) auto-rerun.
    ctx.enqueue(auto_rerun_msg)
```

Notes:

- `time_to_seconds(..., coerce_none_to_inf=False)` is the same helper fragment `run_every`
  uses; invalid strings raise `StreamlitBadTimeStringError` (fail fast, consistent errors).
- `run_every` is a **separate `ForwardMsg`** from `page_config_changed`, not a field on the
  `PageConfig` proto. This decouples the auto-rerun signal from the additive page-chrome
  merge and lets us reuse the frontend timer wholesale. It also means `run_every` is
  resolved per-run as "last call wins" rather than participating in the visual additive
  inherit — matching fragment semantics where `None` = no auto-rerun (product spec →
  Behavior → Resolution / disabling).
- If `ctx` is `None` (bare-mode / `AppTest` without a runtime), we return early exactly as
  the existing command does.

### 3. Frontend — app-scoped auto-rerun timer

In [`frontend/app/src/App.tsx`](../../frontend/app/src/App.tsx), generalize
`handleAutoRerun` and the `autoRerunIntervals` map to support an app-level entry:

- Use a stable sentinel key for the app-level timer (e.g. the empty string `""` or a
  dedicated `APP_AUTO_RERUN_KEY`), so it lives alongside per-fragment timers in the same
  `Map` and benefits from the same "same interval → don't reset" logic.
- When `fragmentId` is empty, the timer callback fires a **full** rerun:

```ts
const isAppScope = !fragmentId
const key = isAppScope ? APP_AUTO_RERUN_KEY : fragmentId

if (this.autoRerunIntervals.get(key)?.interval === interval) return
this.clearAutoRerunInterval(key)

const timer = setInterval(() => {
  // undefined fragmentId -> full app rerun; true -> is_auto_rerun
  this.widgetMgr.sendUpdateWidgetsMessage(
    isAppScope ? undefined : fragmentId,
    true
  )
}, interval * 1000)

this.autoRerunIntervals.set(key, { timer, interval })
```

- **Cleanup is already handled.** `cleanupAutoReruns()` (called from `handleNewSession` on
  every full rerun and from `onPageChange`) clears *all* timers including the app-level
  entry, so navigation and normal reruns re-establish the timer from the fresh run's
  `AutoRerun` message. This gives correct per-page scoping and the "last call wins /
  disable via `None`" behavior for free: if a run doesn't enqueue an app-scoped
  `AutoRerun`, no app-level timer is re-created.
- `sendUpdateWidgetsMessage(undefined, true)` sets `isAutoRerun=true` on the rerun, so the
  existing "couldn't find fragment" suppression and any auto-rerun-specific handling in
  [`script_runner.py`](../../lib/streamlit/runtime/scriptrunner/script_runner.py) continue
  to apply. A full rerun ignores the fragment-not-found path entirely.

### 4. Backwards compatibility & edge cases

- **Multiple `set_page_config` calls in one run.** Each call with a non-`None` `run_every`
  enqueues an `AutoRerun`; messages are processed in order, so the last enqueued interval
  wins. A call that omits `run_every` (default `None`) enqueues nothing. Because
  `handleNewSession` clears all timers at the start of every full rerun and the timer is
  re-armed only if the run enqueues an `AutoRerun`, a run that never arms leaves
  auto-rerun off. This yields the "disable by not arming" behavior in the product spec
  (e.g. toggling off passes `None`, the run arms nothing, and auto-refresh stops).
- **Interaction with fragment `run_every`.** Independent timers keyed separately; both fire
  as configured. A page-level auto-rerun (full rerun) naturally supersedes in-flight
  fragment timers because `handleNewSession` clears and re-registers everything.
- **`AppTest`.** Because the signal is a `ForwardMsg`, `AppTest` can assert that an
  `auto_rerun` message with an empty `fragment_id` and the expected `interval` was enqueued
  (mirrors existing fragment `run_every` unit tests in
  [`fragment_test.py`](../../lib/tests/streamlit/runtime/fragment_test.py)).

### Testing

- **Python unit tests** (`page_config_test.py`): interval parsing for `int`/`float`/`str`/
  `timedelta`, `None` enqueues nothing, invalid string raises `StreamlitBadTimeStringError`,
  empty `fragment_id` on the enqueued `AutoRerun`, and last-call-wins across multiple calls.
- **Typing test** (`set_page_config_types.py`): assert the accepted `run_every` union type.
- **Frontend unit tests** (`App.test.tsx`): app-scoped `handleAutoRerun` starts a timer
  that calls `sendUpdateWidgetsMessage(undefined, true)`; same-interval re-registration
  doesn't reset; `cleanupAutoReruns`/page change clears it.
- **E2E** (`e2e_playwright/st_set_page_config*`): a page with `run_every` reruns on its own
  after N seconds (e.g. an incrementing counter in session state) and stops on navigation.

## Alternatives Considered

**Add `run_every` as a field on the `PageConfig` proto (part of `page_config_changed`).**
Rejected: it would entangle the auto-rerun signal with the additive page-chrome merge in
`handlePageConfigChanged`, require new frontend plumbing to translate it into a timer, and
duplicate logic that `AutoRerun` already implements. Reusing `AutoRerun` is smaller and
consistent with fragments.

**New dedicated proto message (e.g. `PageAutoRerun`).** Rejected: `AutoRerun` already
models exactly this (an interval + optional target). An empty `fragment_id` is a clean,
backward-compatible way to express app scope, and it keeps one code path on the frontend.

**Server-side scheduler (backend timer that re-triggers the run).** Rejected: it would tie
up server resources and a session thread between ticks — the exact anti-pattern this
feature replaces. The frontend-timer approach (identical to fragment `run_every` and
`streamlit-autorefresh`) keeps the server idle between reruns and degrades gracefully when
the browser tab is backgrounded.

**Separate `st.autorefresh()` command.** A product-level alternative (see product spec →
API location options); rejected there in favor of extending `set_page_config` per
[#10485](https://github.com/streamlit/streamlit/issues/10485).
