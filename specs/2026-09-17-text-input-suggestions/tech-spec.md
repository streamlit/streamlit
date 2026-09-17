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
            "autocomplete", "type='password'",
            explanation="Password suggestions must not appear in a dropdown.",
        )
    registered = get_suggestion_source_mgr().register_source(
        autocomplete, coordinates=<element delta-path>, max_chars=max_chars
    )
    text_input_proto.suggestions_source_id = registered.source_id
    # Our dropdown replaces the browser's autofill, so turn native autofill off.
    autocomplete_token = "off"
    autocomplete_identity = _SUGGESTIONS_IDENTITY_SENTINEL  # stable, not the callable
else:
    # Existing behavior: None -> type default token; str -> explicit token.
    autocomplete_token = type_defaults.autocomplete if autocomplete is None else autocomplete
    autocomplete_identity = autocomplete  # str | None, as today
```

- **Widget identity:** `compute_and_register_element_id(...)` currently hashes
  `autocomplete=autocomplete`. Hashing a callable is unstable across reruns, so in the
  callable case we hash a fixed sentinel (`autocomplete_identity` above) instead. Result:
  swapping between two different suggestion callables does **not** remount an unkeyed widget,
  keyed widgets stay stable when the callable changes, and switching between a string token
  and a callable does remount (acceptable — different mode). This matches how `on_change` and
  `live` stay out of / normalize identity.
- The native `autocomplete` proto string field (field 10) continues to carry
  `autocomplete_token`; in suggestion mode that is `"off"`.
- Type errors: a non-callable, non-str, non-None value (or a callable that later returns
  non-strings) — the widget-construction path only guards the *parameter* type
  (`StreamlitInvalidParameterTypeError("autocomplete", ...)` if needed). Bad *return* values
  are normalized/failed-closed at call time (§3), since the callable hasn't run yet.

### 2. Protobuf changes

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
// Response for autocomplete suggestion requests. Field 7 is already taken by
// the message-level `error_reason`, so the oneof continues at 8.
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
- **`get_suggestions`** validates `source_id` belongs to `session_id` (raising a
  `SuggestionSourceError` with a frontend-safe message otherwise), invokes `func(text)`, then
  **normalizes and bounds** the result: coerce to `list[str]`, drop non-strings (or fail
  closed), truncate over-long individual strings, cap the count (e.g. ≤ 50) so a misbehaving
  source can't flood the socket, and drop suggestions longer than the widget's `max_chars`
  (captured on the registered source), since selecting one would commit a value past the
  limit the field itself enforces.
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
            # Runs on the dedicated suggestions pool, bounded per source; the
            # slot is released by the worker thread itself (see below).
            suggestions = await self._run_bounded(
                session_id, payload.source_id, payload.text
            )
        except SuggestionSourceError as err:
            return BackendOperationResponse(
                request_id=request.request_id, error_msg=str(err)
            )
        except (TimeoutError, _NoCapacityError):
            # Fail closed: an empty dropdown, no error shown to the user.
            suggestions = []
        except Exception:
            _LOGGER.exception(
                "Error computing suggestions for source %s", payload.source_id
            )
            # Fail closed: empty suggestions, generic message; traceback stays server-side.
            return BackendOperationResponse(
                request_id=request.request_id, error_msg="Failed to load suggestions."
            )
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
- **Slots are held until the thread actually exits.** The per-source semaphore slot is
  released by the worker in its own `finally`, not by the coroutine that stopped waiting, so
  a timed-out call keeps occupying its slot while it runs. Otherwise a modified client could
  vary `text` to defeat coalescing and stack up unbounded hung calls. When no slot is free the
  handler raises `_NoCapacityError` and fails closed immediately rather than queueing more
  work.
- **Timeout** (`_SUGGESTIONS_TIMEOUT_S`, e.g. 5s) bounds how long the *user* waits; the pool
  size bounds the damage a hung callable can do. Python cannot kill a running thread, so the
  residual risk is a bounded number of stuck threads per server — the accepted trade-off for
  running user code off the rerun path, and the reason the bound is a fixed pool rather than
  the shared one.
- **Coalescing**: as in `DataframeChunkHandler`, identical in-flight requests keyed by
  `(session_id, source_id, text)` share one call, so rapid keystrokes don't multiply work.

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

Active only when `element.suggestionsSourceId` is set.

#### Attach the selectbox dropdown to the existing text field

**Keep `TextInput`'s existing `<input>` (`StyledInputElement`) and attach the dropdown to it.**
The field already carries a lot that must not be re-derived: `maxChars` gating via
`useOnInputChange`, the `dirty` / live-commit state machine, stale-`setValue` handling, IME
composition, `validate` / `required` error wiring (`aria-invalid`, `aria-describedby`),
`enterKeyHint`, the password toggle, and the search clear button. Swapping it for React Aria's
`ComboBox`-owned `Input` would put RAC's input-value controller in competition with that state
machine — the failure mode `Selectbox.tsx` documents at length (`getInsertedText`,
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

- On focus and on each accepted change, **debounce** with the suggestion timer (reuse the
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
  superseded callable can arrive for text the user is still typing. Cancel/ignore in-flight
  requests on new input (the client already rejects superseded requests on cleanup), and show
  a subtle loading indicator while a request is outstanding.
- **Selection:** clicking an item or ↑/↓ + Enter/Tab sets `uiValue` — through the same
  `maxChars` gate as typed input, so a long suggestion can never commit a value the field
  itself would reject — and routes through the existing `commitWidgetValue` /
  `tryCommitOutsideForm` path so `on_change`, `live`,
  `validate`, `required`, forms, and `bind` all behave exactly as for a typed commit. `Esc`
  closes the dropdown only; per the product spec, an empty result closes it rather than showing
  Selectbox's "No results" row.
- Coexist with the existing end enhancers (error icon, search clear button, password toggle)
  and with `live` commit timers, IME composition (`isComposingRef`), and the
  stale-`setValue` handling already in the component. The native `<input autocomplete>`
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

## Security & abuse considerations

Inherits the backend-operation threat model (arbitrary/modified client over the WebSocket):

- **Unguessable, session-scoped `source_id`** (uuid4 hex), validated against the requesting
  session before the callable runs — a client can't invoke another session's source.
- **Dedicated bounded thread pool + server-side timeout** so a slow or hung callable degrades
  to "no suggestions" without stalling the event loop or consuming executor capacity that
  other backend operations need. A timeout stops the waiting, not the thread, so the pool is
  separate from the shared default executor and the worst case is a bounded number of stuck
  suggestion threads.
- **Per-source concurrency cap + request coalescing**, with slots released only when the
  worker exits, so a scripted client can't fan out unbounded lookups or stack up hung ones.
- **Result caps** (max count, max string length, `max_chars`) bound the response payload.
- **Fail closed + server-only logging**: exceptions and bad return types yield an empty
  dropdown and a generic message; tracebacks and any values are logged server-side and never
  serialized to the browser (the callable could touch secrets/DB rows).
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
