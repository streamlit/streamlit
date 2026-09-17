---
author: lukasmasuch
created: 2026-09-17
---

# Autocomplete suggestions for `st.text_input` — technical design

## Summary

Implements the callable form of `autocomplete` from the [product spec](./product-spec.md),
where suggestions are produced on the server as the user types. It reuses the existing
**backend-operation** channel (`BackendOperationRequest` / `BackendOperationResponse`,
`BackendOperationDispatcher`, `BackendOperationClient`) and mirrors the session-scoped source
lifecycle of lazy `st.dataframe` loading (`DataframeSourceManager` + `DataframeChunkHandler`)
and the server-side validation added in [#16303](https://github.com/streamlit/streamlit/pull/16303).
The string and `None` forms of `autocomplete` are unchanged.

## Problem

A suggestion callable is arbitrary user Python that must run:

- **Per keystroke (debounced)**, at high frequency, while the field is focused.
- **Without a script rerun** — a rerun per pause is too heavy for hints and has no
  input-dropdown UX (see the product spec's [current workarounds](./product-spec.md#current-workarounds)).
- **Safely** — off the rerun path, so it needs the same guardrails the other
  backend operations already established: an unguessable, session-scoped id; validation that
  the request belongs to the requesting session; a worker thread so a slow lookup can't block
  the event loop; a timeout; caps on result size; fail-closed error handling; and server-only
  error logging.

The backend-operation channel exists and already contemplates this: both
`backend_operation_handler.py` and `BackendOperationClient.ts` list "autocompletion" as an
intended payload type. This design adds that payload and its handler.

## Proposal

### 1. Python API surface (`lib/streamlit/elements/widgets/text_widgets.py`)

Widen the `autocomplete` annotation on both `text_input` overloads, the public method, and
`_text_input`:

```python
autocomplete: str | Callable[[str], Sequence[str]] | None = None
```

`_text_input` branches on the runtime type. The important detail is that `autocomplete` is
currently consumed in two places — the widget-identity hash and the proto's native
`autocomplete` string field — and both must be adjusted:

```python
if callable(autocomplete):
    # Backend suggestion mode.
    if type == "password":
        raise StreamlitIncompatibleParametersError(
            "autocomplete",
            "type='password'",
            explanation="Password suggestions must not appear in a dropdown.",
        )
    registered = get_suggestion_source_mgr().register_source(
        autocomplete, coordinates=ctx.current_delta_path, max_chars=max_chars
    )
    text_input_proto.suggestions_source_id = registered.source_id
    # Our dropdown replaces the browser's autofill, so turn native autofill off.
    autocomplete_token = "off"
    autocomplete_identity = _SUGGESTIONS_IDENTITY_SENTINEL  # stable, not the callable
else:
    # Existing behavior: None -> type default token; str -> explicit token.
    autocomplete_token = (
        type_defaults.autocomplete if autocomplete is None else autocomplete
    )
    autocomplete_identity = autocomplete  # str | None, as today
```

- **Widget identity:** `compute_and_register_element_id(...)` is passed
  `autocomplete=autocomplete`, but it only reaches the hash for **unkeyed** widgets: with a
  user `key`, `key_as_main_identity={"max_chars", "validate"}` restricts the hash to those two
  kwargs, so `autocomplete` is already out of a keyed widget's id today. Either way a callable
  cannot be hashed (it isn't a `SAFE_VALUES` and a fresh lambda each run would be unstable),
  so the callable case hashes a fixed sentinel (`autocomplete_identity` above). The resulting
  behavior, stated per case so session state stays predictable:
  - **Keyed:** the id never depends on `autocomplete`, so changing the callable — or switching
    between a string token and a callable — keeps the value.
  - **Unkeyed:** swapping one suggestion callable for another keeps the value (both hash to
    the sentinel), while switching between a string token and a callable changes the id and
    resets it. That's acceptable: it's a different mode, and it matches how any other unkeyed
    argument change behaves.
- The native `autocomplete` proto string field (field 10) continues to carry
  `autocomplete_token`; in suggestion mode that is `"off"`.
- Type errors: a non-callable, non-str, non-None value (or a callable that later returns
  non-strings) — the widget-construction path only guards the *parameter* type
  (`StreamlitInvalidParameterTypeError("autocomplete", ...)` if needed). Bad *return* values
  are normalized/failed-closed at call time (§3), since the callable hasn't run yet.

### 2. Protobuf changes

The field numbers below are illustrative and must be re-derived when the work starts:
[#16303](https://github.com/streamlit/streamlit/pull/16303) is still open and already claims
the next free number in all three messages (`widget_validation` at 7 in the request oneof and
8 in the response oneof, plus a new `TextInput` field for `validate_callable_id`). Whichever
lands second takes the next unused number in each message.

**`proto/streamlit/proto/TextInput.proto`** — add one field to `TextInput` (the existing
`string autocomplete = 10` native token stays as-is):

```proto
// Session-scoped id of a registered server-side suggestion source. Unset when
// `autocomplete` is not a callable. When set, the native `autocomplete` field
// is "off" so browser autofill does not compete with the suggestion dropdown.
optional string suggestions_source_id = 21;
// Next: 22
```

**`proto/streamlit/proto/BackMsg.proto`** — new request payload in the
`BackendOperationRequest.payload` oneof:

```proto
// Autocomplete suggestion request for st.text_input.
SuggestionsRequestPayload suggestions = 7;

message SuggestionsRequestPayload {
  // Session-scoped id of the registered suggestion source.
  string source_id = 1;
  // Current text in the input to complete.
  string text = 2;
}
```

**`proto/streamlit/proto/ForwardMsg.proto`** — new response payload in the
`BackendOperationResponse.payload` oneof:

```proto
// Response for autocomplete suggestion requests. Numbering is per message, not
// per oneof, so the message-level `error_reason = 7` is already taken here.
SuggestionsResponsePayload suggestions = 8;

message SuggestionsResponsePayload {
  // Echoes the requested source id so the frontend can match the response.
  string source_id = 1;
  // Echoes the requested text so the frontend can drop responses that no
  // longer match the current input.
  string text = 2;
  // The suggested completion strings (already capped/truncated by the server).
  repeated string suggestions = 3;
}
```

Run `make protobuf` after editing.

### 3. Session-scoped `SuggestionSourceManager` (`lib/streamlit/runtime/suggestion_source_manager.py`)

A near-copy of `DataframeSourceManager`'s structure — the lifecycle requirements are
identical, so the shared skeleton (per-session coordinate map, unguessable `source_id`,
lock-guarded map access, session validation, orphan pruning, fragment-aware
`clear_session_refs`) should be factored/reused rather than reinvented:

```python
@dataclass(frozen=True)
class RegisteredSuggestionSource:
    func: Callable[[str], Sequence[str]]
    source_id: str
    session_id: str
    coordinates: str
    fragment_id: str | None
    max_chars: int | None


class SuggestionSourceManager:
    def register_source(
        self, func, coordinates, max_chars
    ) -> RegisteredSuggestionSource: ...
    def get_suggestions(self, session_id, source_id, text) -> list[str]: ...
    def clear_session_refs(self, session_id=None, *, fragment_ids=None) -> None: ...
    def remove_orphaned_sources(self) -> None: ...
    def clear_all_for_session(self, session_id) -> None: ...
```

- **`coordinates`**: the element's delta-path within the session (the same notion
  `DataframeSourceManager` uses). Re-registering at the same coordinates on the next run
  replaces the previous source with a fresh `source_id`, so stale in-flight responses are
  ignored by the frontend.
- **`get_suggestions`** resolves `source_id` for `session_id`, then bounds its inputs and
  outputs around the call. Distinguish two lookup failures, because they are not equally
  exceptional:
  - **Unknown or superseded `source_id` is routine, so fail closed silently.** Every rerun
    mints a fresh id and `remove_orphaned_sources` prunes the old one, so an in-flight lookup
    against a retired id is expected — especially under `live`, where the rerun usually lands
    before the 300ms lookup is even sent. Return an empty list with no `error_msg`.
  - **A `source_id` belonging to a *different* session** is anomalous, not a race. Raise
    `SuggestionSourceError`, which the handler reports via `error_msg`.

  This split matters because `BackendOperationClient.onResponse` rejects the pending promise
  whenever `errorMsg` is set. Routing the routine case through `error_msg` would turn an
  ordinary rotation race into a visible error while the user is mid-word.
  - **`text` is untrusted, and oversized requests are rejected rather than truncated.** It
    arrives from the client, so `max_chars` on the real input proves nothing about it — a
    modified client can send an arbitrarily long string straight into user Python. Reject any
    request whose `text` exceeds the source's `max_chars`, or a fixed ceiling (e.g. 4096
    characters) when `max_chars` is unset, and fail closed to an empty list. Rejecting rather
    than truncating keeps the public contract honest: the callable always receives the current
    text verbatim, so suggestions can never be computed from a silent prefix while the response
    echoes the full text and passes the frontend's match check. The ceiling is the only
    suggestion-specific input limit; the field itself stays unbounded. Document for users that
    `text` is untrusted input: the example query is parameterized on purpose, and interpolating
    it into SQL or a URL would be an injection bug.
  - **One return-value contract, and it fails closed.** Accept the result only if it is a
    finite, non-`str` collection of `str`. A bare `str` is itself a `Sequence[str]`, so
    accepting one would silently turn `"apple"` into five one-character suggestions; reject it
    along with any other unexpected type instead of showing a partial list.
  - **Caps, applied by dropping — never by rewriting.** Drop any suggestion longer than the
    source's `max_chars`, or longer than a fixed ceiling when `max_chars` is unset, and cap the
    count (e.g. ≤ 50) so a misbehaving source can't flood the socket. Shortening a suggestion
    to fit would be worse than dropping it: the user would be offered, and could commit, a
    string the source never returned. So there is one rule for over-long suggestions — they
    don't appear — and a suggestion's text is always exactly what the callable returned.
- **Synchronization**: the maps are written from the script thread (registration, rerun
  cleanup) and the server thread (shutdown) while being read from suggestion worker threads,
  so — like `DataframeSourceManager` — every shared-map access is guarded by a
  `threading.Lock`, and `get_suggestions` captures the immutable
  `RegisteredSuggestionSource` under that lock and releases it before invoking the callable.
  Without this, a rerun replacing or pruning a source can race an in-flight lookup and make a
  valid request fail or run against stale state.
- **Lifecycle wiring** mirrors media files / dataframe sources:
  `clear_session_refs` at the start of a full rerun (fragment-aware for fragment reruns),
  `remove_orphaned_sources` after a script finishes, `clear_all_for_session` on shutdown.
  Add the manager to `Runtime` (next to `dataframe_source_mgr`) and invoke the cleanup hooks
  from the same places `DataframeSourceManager`'s are.

### 4. Backend operation handler (`lib/streamlit/runtime/suggestions_handler.py`)

A `BackendOperationHandler` mirroring `DataframeChunkHandler`:

```python
class SuggestionsHandler(BackendOperationHandler):
    def __init__(
        self, get_source_mgr: Callable[[], SuggestionSourceManager]
    ) -> None: ...

    async def handle(self, request, session_id) -> BackendOperationResponse:
        payload = request.suggestions
        try:
            # Runs on the dedicated suggestions pool, bounded per source and
            # globally; permits are released by the worker itself (see below).
            suggestions = await self._run_bounded(
                session_id, payload.source_id, payload.text
            )
        except SuggestionSourceError as err:
            return BackendOperationResponse(
                request_id=request.request_id, error_msg=str(err)
            )
        except (TimeoutError, _NoCapacityError):
            # Fail closed: an empty dropdown, nothing surfaced to the client.
            suggestions = []
        except Exception:
            _LOGGER.exception(
                "Error computing suggestions for source %s", payload.source_id
            )
            # Also fail closed. The traceback stays server-side.
            suggestions = []
        resp = BackendOperationResponse(request_id=request.request_id)
        resp.suggestions.CopyFrom(
            SuggestionsResponsePayload(
                source_id=payload.source_id,
                text=payload.text,
                suggestions=suggestions,
            )
        )
        return resp
```

`_run_bounded` is where the safety properties live, and it differs from
`DataframeChunkHandler` in one important way: that handler runs Streamlit's own bounded
serialization code, while this one runs an arbitrary user callable that may never return.

- **A dedicated, bounded thread pool** — a module-level `ThreadPoolExecutor` reserved for
  suggestion sources, not `asyncio.to_thread`'s default executor. This matters because a
  timeout can only stop *awaiting* a synchronous call; the thread itself runs to completion.
  On the shared default executor, hung sources would therefore accumulate and starve the
  lazy-dataframe and deferred-file operations that depend on the same capacity.
- **Admission is bounded globally, not just per source.** A `ThreadPoolExecutor` caps running
  workers but queues everything else without limit, and an app can register arbitrarily many
  sources — so per-source semaphores alone let a client fill the pool with hung workers and
  pile up a backlog that later executes long-stale lookups. Gate every submission on a
  non-blocking global permit as well as the per-source one, so the executor's queue stays
  shallow by construction.
- **Permits are held until the thread actually exits.** Once a worker is submitted, both
  permits are released by that worker in its own `finally`, not by the coroutine that stopped
  waiting, so a timed-out call keeps occupying its capacity while it runs. Otherwise a
  modified client could vary `text` to defeat coalescing and stack up unbounded hung calls.
- **Admission is all-or-nothing.** Acquiring one permit and failing to get the other must
  release what was already taken — no worker runs in that case, so nothing else will. Without
  that, ordinary contention would leak a permit per failed admission and permanently disable
  suggestions. Acquire both under one guard that unwinds on any failure, including a failure
  to submit, and raise `_NoCapacityError` so the handler fails closed immediately rather than
  queueing more work.
- **The permits must be thread-safe primitives.** Because the worker releases them from its own
  thread, they cannot be the `asyncio.Semaphore` that `DataframeChunkHandler` uses — asyncio
  primitives are not thread-safe. Use `threading.BoundedSemaphore` (bounded so a double release
  raises instead of silently inflating capacity), or else marshal every release back to the
  loop with `loop.call_soon_threadsafe`. The former is simpler and is what this design assumes.
- **Timeout** (`_SUGGESTIONS_TIMEOUT_S`, e.g. 5s) bounds how long the *user* waits; the pool
  size bounds the damage a hung callable can do. Python cannot kill a running thread, so the
  residual risk is a bounded number of stuck threads per server — the accepted trade-off for
  running user code off the rerun path, and the reason the bound is a fixed pool rather than
  the shared one.
- **Coalescing**: as in `DataframeChunkHandler`, identical in-flight requests keyed by
  `(session_id, source_id, text)` share one call, so rapid keystrokes don't multiply work.
- **Cached sources are an expected, supported case.** `@st.cache_data` / `@st.cache_resource`
  at the default `scope="global"` pass `session_id=None` and never call
  `get_session_id_or_throw`, so they resolve fine off the script thread — the same property
  `cache_data(refresh_mode="background")` already relies on. `scope="session"` does call it and
  raises `StreamlitAPIException` (`error_id="session-scoped-cache-outside-app-thread"`). That
  lands in the generic fail-closed branch, so the log line must name the cause: a
  session-scoped cache is the most likely way an otherwise working source starts silently
  returning nothing, and a bare "error computing suggestions" would send the developer hunting.
- **Rate, not just concurrency.** Everything above bounds how much runs *at once*, which a
  modified client can still walk around: vary `text` to defeat coalescing and re-fire as
  permits recycle, and a fast billable source gets called far more often than the 300ms
  browser debounce implies. Add a per-session budget (a token bucket keyed on session, not on
  the rotating `source_id`) and fail closed when it's exhausted. This is the one limit that
  reflects the feature's actual cost model: the expensive resource is the user's database or
  API quota, not the server's threads.

> **Implementation note.** None of this bounded-execution machinery is suggestion-specific, and
> #16303's `validate` callable has exactly the same hang risk. If both land, prefer lifting the
> pool, permits, admission, and timeout into shared backend-operation infrastructure over
> duplicating the lifecycle — but only if that genuinely leaves both handlers simpler.

Register it in `AppSession._create_backend_operation_dispatcher`:

```python
dispatcher.register(
    "suggestions",
    SuggestionsHandler(lambda: runtime.get_instance().suggestion_source_mgr),
)
```

The existing `_handle_backend_operation_request` already validates `request.session_id ==
self.id` before dispatch, and the dispatcher already wraps handler exceptions — no changes
needed there.

### 5. Frontend client (`frontend/lib/src/BackendOperationClient.ts`)

Add `"suggestions"` to the `request<T>` payload-field union, a `requestSuggestions(payload,
timeoutMs?)` helper (short timeout, e.g. the default 30s or less), and extend
`extractResponsePayload` to return `response.suggestions`.

### 6. Frontend widget (`frontend/lib/src/components/widgets/TextInput/TextInput.tsx`)

Suggestions are active only when `element.suggestionsSourceId` is set — but that has to be a
**structural** split, not an `if` inside one component. Hooks can't be called conditionally, so
putting `useComboBoxState` / `useComboBox` directly in `TextInput` would run the combobox
machinery for every `st.text_input` in every app, including the overwhelming majority with no
suggestion source. Extract the field into a presentational component and have `TextInput`
choose between two wrappers: the plain one, and a `TextInputWithSuggestions` that owns the
combobox hooks, the request lifecycle, and the popover. Everything in this section lives in
that second wrapper.

#### Attach the selectbox dropdown to the existing text field

**Keep `TextInput`'s existing `<input>` (`StyledInputElement`) and attach the dropdown to it.**
The field already carries a lot that must not be re-derived: `maxChars` gating via
`useOnInputChange`, the `dirty` / live-commit state machine, stale-`setValue` handling, IME
composition, `validate` / `required` error wiring (`aria-invalid`, `aria-describedby`),
`enterKeyHint`, the password toggle, and the search clear button. Swapping it for React Aria's
`ComboBox`-owned `Input` would put RAC's input-value controller in competition with that state
machine — the failure mode `shared/Dropdown/Selectbox.tsx` documents at length (`getInsertedText`,
revert-on-blur, deferred `onChange` after close).

So we reuse the **dropdown**, not the widget. Note that `Selectbox` is a full widget (it renders
its own `WidgetLabel`, `StyledInput`, chevron, clear button, and `className="stSelectbox"`), so
`TextInput` can't render `<Selectbox>`; sharing happens one level down. Two ways to do that:

1. **Recommended — `useComboBox` hooks on our own input.** `react-aria` and `react-stately` are
   already dependencies (and the codebase already uses react-aria hooks, e.g. `useFocusWithin`
   in `Tooltip`). `useComboBoxState` + `useComboBox` take an `inputRef`, `listBoxRef`, and
   `popoverRef` we own, and hand back `inputProps` to merge onto the existing
   `StyledInputElement` plus `listBoxProps` for the list. They supply `role="combobox"`,
   `aria-expanded`, `aria-controls`, `aria-activedescendant`, and ↑/↓/Enter/Esc behavior, so the
   ARIA contract isn't hand-rolled. Pass `allowsCustomValue` and a controlled
   `inputValue={uiValue}`; the server already filtered, so no client filter is applied (the same
   reason Selectbox passes `PASS_THROUGH_FILTER`).
   - **Merging handlers is the real work.** Use `mergeProps` to combine `inputProps` with
     TextInput's `onChange` / `onKeyDown` / `onBlur` / composition handlers, with one explicit
     precedence rule: when the dropdown is open **and** an option is highlighted, the combobox
     owns Enter and ↑/↓; otherwise TextInput's existing Enter behavior (commit, or form submit)
     runs unchanged.
   - **Ctrl/Cmd+A must keep selecting the typed text.** React Aria binds Mod+A to "select all
     options" while the list is open and calls `preventDefault()`, which would break native
     select-all in the field. Carry over `Multiselect`'s `onKeyDownCapture` exception —
     `stopPropagation()` *without* `preventDefault()` — which fixed exactly this regression in
     [#16650](https://github.com/streamlit/streamlit/pull/16650).
   - **Cost:** the shared styles in `Selectbox.styled.ts` are bound to RAC component types
     (`styled(Popover)`, `styled(ListBox)`, `styled(ListBoxItem)`), so their style objects need
     extracting into shared functions both call sites can consume. That's a pure refactor with no
     visual change, and it is what makes the two dropdowns provably identical.
2. **Alternative — standalone RAC `ListBox` + `Popover` beside the input.** RAC's `ListBox` works
   outside a `ComboBox`, so this reuses `Selectbox.styled.ts` verbatim with no refactor. The
   catch is that combobox ARIA and keyboard wiring between our input and that listbox
   (`aria-activedescendant`, highlight movement, Enter-to-select) becomes ours to write and
   maintain. Cheaper to start, riskier for accessibility.

Prefer option 1: a style extraction is easier to get right and review than retrofitted ARIA.

Either way, reuse Selectbox's `useFloatingOverlay` configuration for visual parity
(`placement: "bottom-start"`, `matchTriggerWidth`, and the sidebar `flipOptions` /
`shiftOptions` boundary handling), keep the `Virtualizer` + `ListLayout` row sizing at
`theme.sizes.dropdownItemHeight`, and do **not** carry over Selectbox's `inputReadOnly` mobile
heuristic — it suppresses the on-screen keyboard for short option lists, but typing is the whole
point here. Because we render the listbox ourselves rather than relying on RAC `ComboBox`'s
collection discovery, the constraint that forces Selectbox to avoid `FloatingPortal` does not
apply, so portaling through `FLOATING_OVERLAY_PORTAL_ID` stays available if dialog stacking
needs it.

#### Request lifecycle

- On focus, on each accepted change, and whenever `suggestionsSourceId` changes while the
  field is focused, **debounce** with the suggestion timer (reuse the
  `useDebouncedCallback` already in this component), then call
  `backendOperationClient.requestSuggestions({ sourceId, text })`. The delay is a constant
  `300ms`, independent of `live` in both directions: the callable is often a database or API
  query, so the pause must be long enough to skip the gaps between keystrokes (mean inter-key
  interval is ~239ms), and conversely a long `live` pause chosen to throttle expensive reruns
  must not be inherited here and make hints sluggish. See the product spec for the full
  rationale. Keep the value in one named constant so the future "configurable debounce"
  follow-up has a single place to hook into.
- **Race handling:** drop a response unless **both** its echoed `sourceId` matches the
  element's current `suggestionsSourceId` **and** its echoed `text` matches the current
  `uiValue`. Checking the text alone is not enough: each rerun re-registers the source with a
  fresh `source_id` without remounting the (stable-identity) widget, so a response from the
  superseded callable can arrive for text the user is still typing.

  Implement this by ignoring superseded responses, not by cancelling them:
  `BackendOperationClient` has no per-request cancel API — its `cleanup()` rejects *every*
  pending request and only runs on disconnect or session reset. Keep a request generation ref,
  bump it on each new request, and discard any resolution that isn't the current generation.
  Rejections from superseded requests must be swallowed so a stale lookup can't surface an
  unhandled promise rejection.
- **Source rotation must re-request, not just discard.** Because every rerun mints a fresh
  `source_id`, the check above would otherwise silently blank the dropdown — and `live` makes
  that the common case rather than a corner case, since its 250ms default is shorter than the
  300ms suggestion debounce, so the rerun typically lands before the lookup is even sent.
  When `suggestionsSourceId` changes, re-request for the current text against the new id.
  - **The re-request shares the same 300ms rate limit as typing**, as a trailing throttle. It
    must not simply restart the debounce (that re-imposes the very delay rotation is trying to
    avoid), and it must not fire immediately per rotation either: `live="0ms"` remints the id
    on *every* keystroke, which would otherwise turn each keystroke into a lookup and defeat
    the debounce entirely. One lookup per interval, whatever mix of typing and rotation
    triggered it.
  - **The visible list stays live during the swap** — no flicker, no inert window. Committing
    a slightly stale suggestion is not a correctness problem here: free text is always allowed,
    so choosing a row the user can see is equivalent to typing that same string, and it still
    passes through the normal `maxChars` / `validate` / `required` gates on commit. This is the
    one place where being a free-text field, rather than a constrained select, makes the racy
    case harmless.
  - **If the replacement request fails, is superseded, or returns nothing, close the list.**
    Otherwise a rotation whose follow-up never produces a response would strand the previous
    results on screen indefinitely.
- **IME:** don't request while `isComposingRef` is set; schedule exactly one request after
  `compositionend`, so composing CJK text doesn't fire lookups on half-formed input.
- **Selection:** clicking an item, or ↑/↓ then Enter or Tab, sets `uiValue` — through the same
  `maxChars` gate as typed input, so a long suggestion can never commit a value the field
  itself would reject — and routes through the existing `commitWidgetValue` /
  `tryCommitOutsideForm` path so `on_change`, `live`, `validate`, `required`, forms, and `bind`
  all behave exactly as for a typed commit. Note this is the *commit* path, not a synthetic
  Enter: inside a form, selecting must fill and stage the value without submitting. Tab selects
  and then moves focus as usual. `Esc` closes the dropdown only; per the product spec, an empty
  result closes it rather than showing Selectbox's "No results" row.
- **Pointer selection must not trip the blur commit.** `handleBlur` commits whenever focus
  leaves `elementRef`, and the popover renders outside that subtree — so a plain click on a
  suggestion would blur first and commit the half-typed text, rerunning with the wrong value
  before the selection is ever applied. Suppress the focus change on pointer-down the way the
  component already does for its own end enhancers (`preventFocusLoss`, the module-level
  `e.preventDefault()` used by the password toggle and clear button) so focus never leaves the
  input and the click resolves as a selection.
- Coexist with the existing end enhancers (error icon, search clear button), the `live` commit
  timers, and the stale-`setValue` handling already in the component. The native
  `<input autocomplete>`
  attribute is already `"off"` in this mode (set by the backend), so the browser's autofill
  dropdown won't overlap.

Wire `BackendOperationClient` into `TextInput` the same way it reaches other widgets
(via context/props from `App.tsx`, which already owns the client and routes
`BackendOperationResponse` ForwardMsgs to `client.onResponse`).

### 7. AppTest (`lib/streamlit/testing/v1`)

Expose the suggestion source so tests can drive it without a browser: on the
`TextInput` element wrapper, add a way to call the registered callable (e.g.
`ti.get_suggestions("ap")`) that resolves the `source_id` through the session's
`SuggestionSourceManager` and returns the normalized list. This mirrors how #16303 surfaces
server-side validation to AppTest.

### 8. Test coverage for the implementation PR

The riskiest behavior here is invisible in the happy path, so name it up front rather than
discovering it in review:

| Layer | What to cover |
| --- | --- |
| Python unit (manager / handler) | Permits released on timeout **and** on failed admission or failed submit (the leak that disables suggestions); bare-`str` and other bad return types rejected; oversized inbound `text` rejected rather than truncated; over-long suggestions dropped, never shortened; count cap; unknown/superseded `source_id` fails closed while a wrong-session id raises; source cleanup across full vs fragment reruns |
| Python unit (`text_widgets`) | Callable vs string vs `None` dispatch; native token forced to `"off"`; `type="password"` raises; unkeyed identity stable across two different callables; keyed identity unaffected |
| Typing (`lib/tests/streamlit/typing/text_input_types.py`) | The widened `autocomplete` overload still returns `str` / `str \| None` |
| Frontend unit | Debounce and its shared rate limit across typing and source rotation; stale responses discarded by generation and by `sourceId`; rejected superseded requests swallowed; pointer-down not committing via blur; Ctrl/Cmd+A still selecting text; IME composition; combobox keyboard selection and commit-not-submit inside a form |
| E2E (`e2e_playwright/st_text_input_test.py`) | Keyboard and mouse selection, failing source degrading to no dropdown, behavior inside a form, inside a fragment, with `live`, with `max_chars`, and when disabled |

## Security & abuse considerations

Inherits the backend-operation threat model (arbitrary/modified client over the WebSocket):

- **Unguessable, session-scoped `source_id`** (uuid4 hex), validated against the requesting
  session before the callable runs — a client can't invoke another session's source.
- **Dedicated bounded thread pool + server-side timeout** so a slow or hung callable degrades
  to "no suggestions" without stalling the event loop or consuming executor capacity that
  other backend operations need. A timeout stops the waiting, not the thread, so the pool is
  separate from the shared default executor and the worst case is a bounded number of stuck
  suggestion threads.
- **Global and per-source concurrency caps + request coalescing**, with permits released only
  when the worker exits, so a scripted client can't fan out unbounded lookups, stack up hung
  ones, or grow a queue behind them by spreading requests across many sources.
- **Input and result caps**: an oversized client-supplied `text` is rejected before it reaches
  user Python, and max count / max string length / `max_chars` bound the response payload.
- **A per-session rate budget**, because the caps above bound concurrency but not *rate*: a
  modified client can vary `text` to defeat coalescing and re-fire as permits recycle, calling
  a billable database or API far more often than the browser's 300ms debounce suggests. The
  budget is keyed on the session rather than the rotating `source_id`.
- **Fail closed + server-only logging**: exceptions, timeouts, and bad return types yield an
  empty suggestion list and **no** `error_msg` — surfacing one would reject the request in
  `BackendOperationClient` and show the user an error for what is only a missing hint. An
  unknown or superseded `source_id` takes the same silent path, since source rotation makes it
  routine. `error_msg` stays reserved for a `source_id` belonging to a different session.
  Tracebacks and values are logged server-side and never serialized to the browser (the
  callable could touch secrets/DB rows).
- **Session state is not reachable from the callable, and writing to it leaks across
  sessions.** Off the script thread `get_session_state()` resolves to the process-global mock
  rather than the caller's session, so a read sees nothing and a write lands in a store shared
  by every session and never cleaned up. The public contract says neither is supported;
  raising on access there (Principle 23) is worth considering over silently resolving to the
  shared mock.
- **`type="password"` disallowed** with a callable `autocomplete`; and in suggestion mode the
  native autofill token is forced to `"off"` so the browser never stores/proposes values.
- **No new browser→internet path**: all lookups go through the existing authenticated
  WebSocket, so it works uniformly on local, Cloud, and SiS (Principle 36).

## Alternatives Considered

- **Drive suggestions with a script rerun (`live` + hand-rolled list).** Rejected as the
  native mechanism: full app/fragment rerun per pause, no input-dropdown affordance, hint
  latency coupled to script execution. (Users can still do this manually today; the point of
  the feature is to make it unnecessary.)
- **Native HTML `<datalist>`.** Its rendering/behavior is inconsistent across browsers and
  can't be themed to match Streamlit; a custom combobox is used instead.
- **A separate `suggestions` parameter or a new `st.searchbox` command.** Rejected in favor of
  overloading `autocomplete` (see the product spec's alternatives); a new command would also
  duplicate `type`, `validate`, `live`, `bind`, and form behavior.
- **Send the whole candidate set to the browser (selectbox-style) instead of querying.**
  Defeats the purpose for large/dynamic sets — the exact limitation this feature removes.
- **New top-level BackMsg/ForwardMsg types instead of a backend-operation payload.** Rejected:
  the generic backend-operation channel already exists for precisely this (no rerun, request/
  response correlation, session validation, dispatcher) and already names "autocompletion".
