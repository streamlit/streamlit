# Implementation Plan: `persist_state` for widgets

## Goal

Add a new keyword-only widget parameter `persist_state=None | "page" | "session"` that
preserves a widget's value when the widget is not rendered (`"page"`) or even across page
switches (`"session"`). The feature reuses the existing `bind="query-params"`
capture/re-inject machinery in `SessionState._remove_stale_widgets`, but **without** any
URL/query-param involvement — persistence is a purely server-side state decision.

- `None` (default): current behavior — a widget loses its value when not rendered or on
  page switch.
- `"page"`: keep the value while not rendered on the **same page**; drop it on page switch.
- `"session"`: keep the value for the whole session (not rendered and across pages).

No proto changes are required. The feature is additive and opt-in.

## Source-of-truth behavior recap (from existing code)

`bind="query-params"` already preserves stale keyed widgets by:

1. In `SessionState.register_widget`, recording the bound widget id in
   `_query_param_bound_widget_ids` (a durable snapshot that survives MPA transitions).
2. In `SessionState._remove_stale_widgets`, capturing the live value of each stale, bound,
   keyed widget into a `{user_key: value}` dict **before** cleanup, removing stale entries,
   then re-adding the captured values to `_old_state` keyed by **user key**.
3. On the next registration, the value resolves through `_getitem(widget_id, user_key)`,
   whose final fallback is `_old_state[user_key]`. Because `user_key in self` becomes
   `True`, the default-seed branch is skipped and the preserved value is returned.

`persist_state` plugs into exactly the same three points, but the capture condition becomes
an **OR**: preserve if `query-param-bound` **OR** `session-persisted` **OR**
(`page-persisted` **AND** the widget's recorded page hash equals the current
`ctx.page_script_hash`). Storing the captured value under the **user key** (not the widget
id) is what makes `"session"` survive a page switch, because the widget id changes per page
while the user key is stable.

Key existing references:

- `WidgetMetadata` / `BindOption` — [lib/streamlit/runtime/state/common.py](lib/streamlit/runtime/state/common.py)
- `_query_param_bound_widget_ids`, `register_widget`, `_remove_stale_widgets` —
  [lib/streamlit/runtime/state/session_state.py](lib/streamlit/runtime/state/session_state.py)
- `register_widget` (validation + metadata construction) —
  [lib/streamlit/runtime/state/widgets.py](lib/streamlit/runtime/state/widgets.py)
- `ScriptRunContext.page_script_hash` —
  [lib/streamlit/runtime/scriptrunner_utils/script_run_context.py](lib/streamlit/runtime/scriptrunner_utils/script_run_context.py) (line 228)

---

## Phase 1 — Core state changes

### 1.1 `lib/streamlit/runtime/state/common.py`

Add the option type alias next to `BindOption` (line 56) and a `persist_state` field on
`WidgetMetadata`.

Type alias (after `BindOption`):

```python
# Type for the persist_state parameter on widgets.
# "page" keeps the widget value while it is not rendered on the same page.
# "session" keeps it for the whole session, including across page switches.
PersistStateOption: TypeAlias = Literal["page", "session"] | None
```

New `WidgetMetadata` field (add near `bind`, around line 155, keeping it grouped with the
other persistence-related fields):

```python
    # Optional binding for the widget's value to external state (e.g. query params)
    bind: BindOption = None

    # Optional server-side persistence of the widget's value when it is not
    # rendered. "page" keeps the value while on the same page; "session" keeps it
    # for the whole session, including across page switches. None disables it.
    persist_state: PersistStateOption = None
```

`WidgetMetadata` is `@dataclass(frozen=True)` — a new field with a default keeps all current
constructors valid.

### 1.2 `lib/streamlit/runtime/state/__init__.py`

Export the new alias so element files can import it the same way they import `BindOption`.

```python
from streamlit.runtime.state.common import (
    BindOption,
    PersistStateOption,
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
)
```

Add `"PersistStateOption"` to `__all__`.

### 1.3 `lib/streamlit/errors.py`

Add an exception class mirroring `StreamlitInvalidBindValueError` (line 307):

```python
class StreamlitInvalidPersistStateError(LocalizableStreamlitException):
    """Exception raised when an invalid value is specified for the persist_state parameter."""

    def __init__(self, persist_state_value: Any) -> None:
        super().__init__(
            'Invalid `persist_state` value: "{persist_state_value}". '
            'Supported values are: `"page"`, `"session"`, or `None`.',
            persist_state_value=persist_state_value,
        )
```

### 1.4 `lib/streamlit/runtime/state/session_state.py`

**(a) New `SessionState` fields** (after `_query_param_bound_widget_ids`, line 442):

```python
    # Widget IDs that registered with persist_state, mapped to their scope.
    # Like _query_param_bound_widget_ids, this is a durable snapshot that
    # survives MPA page-transition sequencing.
    _persisted_widget_ids: dict[str, Literal["page", "session"]] = field(
        default_factory=dict
    )

    # For persist_state="page" widgets: the page script hash at registration
    # time. Used to drop the value when the user navigates to a different page.
    _persisted_widget_pages: dict[str, str] = field(default_factory=dict)
```

`Literal` is already imported via `typing`? Check: `session_state.py` imports from `typing`
`Any, Final, TypeAlias, cast`. Add `Literal` to that import. (Alternatively import the
`Literal["page", "session"]` alias indirectly; simplest is to add `Literal`.)

**(b) `clear()`** (line 463) — also clear the new dicts:

```python
        self._query_param_bound_widget_ids.clear()
        self._persisted_widget_ids.clear()
        self._persisted_widget_pages.clear()
```

**(c) `register_widget`** (line 998) — track/untrack persistence right after the existing
query-param binding block (after line 1026). This mirrors the bind add/discard logic:

```python
        # Track persist_state registrations (server-side only, no URL involved).
        if metadata.persist_state is not None and user_key is not None:
            self._persisted_widget_ids[widget_id] = metadata.persist_state
            if metadata.persist_state == "page":
                ctx = get_script_run_ctx()
                self._persisted_widget_pages[widget_id] = (
                    ctx.page_script_hash if ctx is not None else ""
                )
            else:
                self._persisted_widget_pages.pop(widget_id, None)
        elif metadata.persist_state is None and user_key is not None:
            # Widget stopped persisting — drop any stale tracking.
            self._persisted_widget_ids.pop(widget_id, None)
            self._persisted_widget_pages.pop(widget_id, None)
```

No changes are needed to the default-seed block or the bound URL-restore block: for a
`persist_state`-only widget, the preserved value lives in `_old_state[user_key]` (re-added
during cleanup), so `user_key in self` is already `True` and `self[widget_id]` resolves to
it. The widget therefore returns the persisted value with no extra restore code.

**(d) `_remove_stale_widgets`** (line 906) — generalize the capture condition and add the
growth-control pruning.

Add a small local predicate after `wid_key_map` is computed (line 917):

```python
        def _should_preserve(widget_id: str) -> bool:
            """True if a stale keyed widget's value should be carried forward."""
            if widget_id in self._query_param_bound_widget_ids:
                return True
            scope = self._persisted_widget_ids.get(widget_id)
            if scope == "session":
                return True
            if scope == "page":
                return (
                    self._persisted_widget_pages.get(widget_id)
                    == ctx.page_script_hash
                )
            return False
```

Change the capture loop condition (currently `key in self._query_param_bound_widget_ids`,
line 922) to use the predicate:

```python
        bound_preserved: dict[str, Any] = {}
        for key in self._old_state:
            if (
                is_element_id(key)
                and _should_preserve(key)
                and key in wid_key_map
                and _is_stale_widget(
                    self._new_widget_state.widget_metadata.get(key),
                    active_widget_ids,
                    ctx.fragment_ids_this_run,
                )
            ):
                user_key = wid_key_map[key]
                try:
                    bound_preserved[user_key] = self._getitem(key, user_key)
                except KeyError:
                    bound_preserved[user_key] = self._old_state[key]
```

The remaining body (remove stale entries from `_new_widget_state` / `_old_state`, re-add
`bound_preserved`, query-param `remove_stale_bindings`) is unchanged. The re-add uses
`_old_state.update(bound_preserved)` exactly as today and works for `persist_state` because
nothing about it is query-param-specific.

Add pruning for the two new dicts next to the existing
`_query_param_bound_widget_ids.intersection_update(...)` (line 972):

```python
        self._query_param_bound_widget_ids.intersection_update(wid_key_map.keys())
        self._persisted_widget_ids = {
            wid: scope
            for wid, scope in self._persisted_widget_ids.items()
            if wid in wid_key_map
        }
        self._persisted_widget_pages = {
            wid: page_hash
            for wid, page_hash in self._persisted_widget_pages.items()
            if wid in wid_key_map
        }
```

Note: `wid_key_map` is `KeyIdMapper.id_key_mapping`, which retains old widget ids across
page switches (entries are only removed on explicit delete or `clear()`), so `"session"`
widgets are not pruned merely because they were not rendered on the current page.

### 1.5 `lib/streamlit/runtime/state/widgets.py`

**(a) Signature** — add a keyword-only `persist_state` parameter to `register_widget`
(after `bind`, line 54), import the alias and the new error:

```python
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidBindValueError,
    StreamlitInvalidPersistStateError,
)
from streamlit.runtime.state.common import (
    BindOption,
    PersistStateOption,
    ...
)
```

```python
    bind: BindOption = None,
    persist_state: PersistStateOption = None,
```

**(b) Validation** — after the `bind` validation block (line 157):

```python
    # Validate persist_state value and key requirement.
    if persist_state is not None:
        if persist_state not in ("page", "session"):
            raise StreamlitInvalidPersistStateError(persist_state)
        if user_key_from_element_id(element_id) is None:
            raise StreamlitAPIException(
                "When using persist_state, the widget must have a unique 'key' "
                "parameter specified so its value can be preserved across reruns "
                "and page switches."
            )
```

**(c) Metadata construction** — pass it through (after `bind=bind`, line 171):

```python
        bind=bind,
        persist_state=persist_state,
```

**(d) Docstring** — add a `persist_state : "page", "session", or None` entry to the
`Parameters` section.

---

## Phase 2 — Widget wiring

Each affected widget already threads `bind: BindOption` through its overloads, public
method, private `_<widget>` method, and the final `register_widget(...)` call. `persist_state`
must be added at every one of those sites, plus the import and the public docstring.

### Mechanical recipe (apply to each file)

1. Import: extend the existing `from streamlit.runtime.state import (... BindOption ...)`
   to also import `PersistStateOption`.
2. For **every** occurrence of `bind: BindOption = None,` (overloads, public, private),
   add the line `persist_state: PersistStateOption = None,` immediately after it.
   (Note: in private methods the parameter is keyword-only; in `pagination._pagination`
   the signature is `bind: BindOption,` with no default — match that and use
   `persist_state: PersistStateOption,`.)
3. For **every** call that forwards `bind=bind,` (public method → private `_<widget>`, and
   private → `register_widget`), add `persist_state=persist_state,` right after it.
4. Add a `persist_state` paragraph to the public method docstring (one shared wording,
   below).

### Files and occurrence counts (current `bind: BindOption` / `bind=bind` counts)

- [lib/streamlit/elements/widgets/slider.py](lib/streamlit/elements/widgets/slider.py) — 11 signatures, 2 forwards (`st.slider`)
- [lib/streamlit/elements/widgets/selectbox.py](lib/streamlit/elements/widgets/selectbox.py) — 8 signatures, 2 forwards (`st.selectbox`)
- [lib/streamlit/elements/widgets/select_slider.py](lib/streamlit/elements/widgets/select_slider.py) — 4 signatures, 2 forwards (`st.select_slider`)
- [lib/streamlit/elements/widgets/radio.py](lib/streamlit/elements/widgets/radio.py) — 5 signatures, 2 forwards (`st.radio`)
- [lib/streamlit/elements/widgets/multiselect.py](lib/streamlit/elements/widgets/multiselect.py) — 5 signatures, 2 forwards (`st.multiselect`)
- [lib/streamlit/elements/widgets/checkbox.py](lib/streamlit/elements/widgets/checkbox.py) — 3 signatures, 3 forwards (`st.checkbox`, `st.toggle`)
- [lib/streamlit/elements/widgets/color_picker.py](lib/streamlit/elements/widgets/color_picker.py) — 2 signatures, 2 forwards (`st.color_picker`)
- [lib/streamlit/elements/widgets/number_input.py](lib/streamlit/elements/widgets/number_input.py) — 7 signatures, 2 forwards (`st.number_input`)
- [lib/streamlit/elements/widgets/text_widgets.py](lib/streamlit/elements/widgets/text_widgets.py) — 8 signatures, 4 forwards (`st.text_input`, `st.text_area`)
- [lib/streamlit/elements/widgets/time_widgets.py](lib/streamlit/elements/widgets/time_widgets.py) — 13 signatures, 6 forwards (`st.time_input`, `st.date_input`)
- [lib/streamlit/elements/widgets/button_group.py](lib/streamlit/elements/widgets/button_group.py) — 12 signatures, 4 forwards (`st.pills`, `st.segmented_control`)
- [lib/streamlit/elements/widgets/pagination.py](lib/streamlit/elements/widgets/pagination.py) — 2 signatures, 2 forwards (`st.pagination`)

Total: the same 12 element files that currently support `bind`. No new widgets gain support
in this PR — `persist_state` is offered wherever `bind` already is, keeping the two
parameters symmetric.

### Shared docstring wording (place after the `bind` paragraph)

```
        persist_state : "page", "session", or None
            How long to preserve the widget's value when it isn't rendered.
            If this is ``None`` (default), the value is lost when the widget
            stops being rendered or the user switches pages. If this is
            ``"page"``, the value is preserved while the widget isn't rendered
            on the same page, but is cleared when the user switches pages. If
            this is ``"session"``, the value is preserved for the entire
            session, including across page switches. This requires ``key`` to
            be set.
```

### Example call site (slider, around line 1068)

Before:

```python
        widget_state = register_widget(
            slider_proto.id,
            ...
            value_type="double_array_value",
            bind=bind,
            clearable=False,
        )
```

After:

```python
        widget_state = register_widget(
            slider_proto.id,
            ...
            value_type="double_array_value",
            bind=bind,
            persist_state=persist_state,
            clearable=False,
        )
```

---

## Phase 3 — Tests

### 3.1 State unit tests — [lib/tests/streamlit/runtime/state/session_state_test.py](lib/tests/streamlit/runtime/state/session_state_test.py)

Mirror the existing bound-preservation tests (around lines 2025–2123). The file already has
a `MockScriptRunCtx` and `_create_test_widget_metadata` helper; extend the helper (or add a
parallel one) to accept `persist_state` and a page hash. New tests:

- `test_persist_state_session_preserves_stale_keyed_value` — register a widget with
  `persist_state="session"`, set a non-default value, compact, `_remove_stale_widgets(set())`;
  assert `_old_state["my_widget"]` holds the value and the widget id is gone.
- `test_persist_state_page_preserves_value_on_same_page` — `persist_state="page"` with the
  widget's page hash equal to `ctx.page_script_hash`; assert preserved.
- `test_persist_state_page_drops_value_on_page_switch` — `persist_state="page"` with a
  recorded page hash different from `ctx.page_script_hash`; assert the value is **not**
  preserved (`"my_widget" not in _old_state`).
- `test_persist_state_none_does_not_preserve` — control case: `persist_state=None`
  unrendered widget loses its value (anti-regression mirror of
  `test_does_not_preserve_unbound_widget_value`).
- `test_register_widget_tracks_persisted_ids` — assert `_persisted_widget_ids` /
  `_persisted_widget_pages` are populated on registration and cleared when re-registered
  with `persist_state=None`.
- `test_prunes_unmapped_persisted_widget_ids` — mirror `test_prunes_unmapped_bound_widget_ids`:
  a persisted id without a key mapping is pruned by `_remove_stale_widgets`.
- `test_persist_state_and_bind_combined_preserves` — widget with both `bind="query-params"`
  and `persist_state="session"`; assert preservation still works (OR logic).

### 3.2 `register_widget` validation tests — [lib/tests/streamlit/runtime/state/widgets_test.py](lib/tests/streamlit/runtime/state/widgets_test.py)

- `test_register_widget_persist_state_requires_key` — calling `register_widget` with a
  keyless element id and `persist_state="session"` raises `StreamlitAPIException`.
- `test_register_widget_invalid_persist_state_raises` — `persist_state="forever"` raises
  `StreamlitInvalidPersistStateError`.
- `test_register_widget_persist_state_none_is_noop` — `persist_state=None` does not touch
  the persisted-id tracking.

### 3.3 Element-level tests (per-widget passthrough)

Add a focused test to a representative subset of existing element test files to confirm the
parameter reaches `WidgetMetadata` and that validation fires. Use `AppTest` or the existing
delta-based harness in each file:

- [lib/tests/streamlit/elements/slider_test.py](lib/tests/streamlit/elements/slider_test.py)
- [lib/tests/streamlit/elements/selectbox_test.py](lib/tests/streamlit/elements/selectbox_test.py)
- [lib/tests/streamlit/elements/checkbox_test.py](lib/tests/streamlit/elements/checkbox_test.py)

Test names (per file): `test_persist_state_passed_to_metadata` and
`test_persist_state_without_key_raises`.

### 3.4 Typing tests — [lib/tests/streamlit/typing/](lib/tests/streamlit/typing/)

Add `persist_state="session"` usage (inside `TYPE_CHECKING`) to a few existing typing files
to confirm the parameter type-checks and does not change the return type, e.g.
`slider_types.py`, `selectbox_types.py`, `checkbox_types.py`.

---

## Phase 4 — E2E tests

Add a Playwright test that exercises both scopes. Because `"page"` vs `"session"` only
diverge across page switches, the app should be a multipage app.

### App: `e2e_playwright/widget_state_persistence.py`

Structure using `st.navigation` / `st.Page` (follow `e2e_playwright/multipage_apps/`):

- A shared sidebar with a checkbox `st.checkbox("Show widgets", key="show")` to toggle
  conditional rendering on the current page.
- **Page 1**:
  - `st.text_input("Page-scoped", key="page_text", persist_state="page")`
  - `st.text_input("Session-scoped", key="session_text", persist_state="session")`
  - `st.text_input("Not persisted", key="plain_text")`
  - Render all three only when `show` is `True`; always `st.write` their current
    `st.session_state` values (guarded) so the test can assert them.
- **Page 2**: render the same three keys (same `key=` values) plus markers proving which
  values survived the page switch.

### Test: `e2e_playwright/widget_state_persistence_test.py`

Scenarios:

1. **Not-rendered, same page**: type values, toggle `show` off then on; assert
   `page_text`, `session_text`, and `plain_text` (plain also survives within the same page
   render cycle if still keyed — assert per actual semantics) reflect persistence:
   `page_text` and `session_text` keep their values; `plain_text` resets.
2. **Page switch**: type values on Page 1, navigate to Page 2; assert `session_text`
   retains its value and `page_text` is reset to default. Navigate back and re-assert.
3. **No URL involvement**: assert the query string stays clean (no params added), proving
   the feature is server-side only.

Run via `make run-e2e-test widget_state_persistence_test.py`.

---

## Suggested PR split

Two PRs (recommended), to keep review surface manageable and decouple core-logic review
from mechanical fan-out:

- **PR 1 — Core state + validation + state/unit tests.** Phases 1 and 3.1–3.2. This is the
  substantive, reviewable logic (`common.py`, `__init__.py`, `errors.py`,
  `session_state.py`, `widgets.py`) plus its direct unit tests. The feature is dormant
  because no element exposes the parameter yet, so it can land safely on its own.
- **PR 2 — Widget wiring + element/typing/E2E tests.** Phases 2, 3.3–3.4, and 4. Large but
  mostly mechanical (12 element files following one recipe) plus the end-to-end coverage.

If a single PR is preferred, land it as one but structure the commits along the same
boundary (core, then per-batch widget wiring, then tests) so reviewers can read it
incrementally.

A 3-way split (core / widget wiring / tests) is **not** recommended because shipping widget
wiring without its tests would leave a user-facing parameter untested between PRs.

---

## Risks and edge cases

- **Page-hash availability at registration.** `persist_state="page"` records
  `ctx.page_script_hash` at registration; if `ctx` is `None` (bare-script execution) it
  records `""`. This matches how `_handle_query_param_binding` already falls back to `""`.
- **Key-mapper retention.** `"session"` persistence depends on
  `KeyIdMapper.id_key_mapping` retaining old widget ids across page switches; it does,
  since entries are only dropped on explicit delete/`clear()`. The new pruning in
  `_remove_stale_widgets` intersects against this map, so persisted ids are not pruned
  merely for being unrendered on the current page.
- **Interaction with `bind`.** Both can be set together; the capture condition is an OR, so
  a widget that is both bound and persisted is preserved. The query-param re-injection path
  is unchanged.
- **Fragments.** The existing `_is_stale_widget` fragment carve-out is reused unchanged, so
  persisted widgets outside a running fragment continue to be treated as non-stale.
- **No metrics in this plan.** The product spec checklist mentions tracking the new
  parameter; `bind` is not currently special-cased in
  [lib/streamlit/runtime/metrics_util.py](lib/streamlit/runtime/metrics_util.py), so
  `persist_state` follows the same (no special handling) approach. Add telemetry later if
  desired.
