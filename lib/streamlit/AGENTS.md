# Streamlit Lib Python Guide

Tips and guidelines specific to the development of the Streamlit Python library,
not applicable to scripts and e2e tests.

## FIPS Compatibility

- Production code must remain compatible with Python/OpenSSL environments running in FIPS mode.
- For non-security hashing, use `streamlit.util.create_fast_hasher` (incremental hashing) or `calc_hash` (one-shot string/bytes hashing) instead of calling `hashlib` directly.
  - Direct use of `hashlib.md5`, `sha1`, `blake2b`, `blake2s`, and `hashlib.new` is banned by lint (ruff `TID251`).
  - The shared `streamlit.util` helpers are the only sanctioned direct callers, guarded with `# noqa: TID251`.
- FIPS-approved constructors (e.g. `hashlib.sha256`) remain allowed for genuine security needs.
- Update `lib/tests/streamlit/fips_test.py` when changing hashing behavior.

## Logging

If something needs to be logged, please use our logger - that returns a default
Python logger - with an appropriate logging level:

```python
from streamlit.logger import get_logger

_LOGGER: Final = get_logger(__name__)
```

## Metrics

- Use `gather_metrics` only for public `st.*` APIs. Never use it for internal methods or functions.

## Streamlit Backend Performance Hot Paths

Changes to these high-fan-out internals can affect every command, message, session, or rerun. Keep work in them minimal, and add or extend performance coverage when modifying these areas:

- **Element creation and enqueueing** (`delta_generator.py`, element-ID calculation, public-command metrics): Avoid extra validation, hashing, protobuf copies, or context work per `st.*` call.
- **ForwardMsg hashing, caching, and serialization** (`runtime/forward_msg_cache.py`, protobuf transport): Messages can be serialized for hashing and again for transport. Avoid extra copies or passes over large payloads, including on cache hits.
- **Delta queueing and WebSocket flushing** (`runtime/forward_msg_queue.py`, `runtime.py`, WebSocket handlers): Preserve delta coalescing, bounded queues, and event-loop responsiveness; message count and flush cadence directly affect throughput and backpressure.
- **Script reruns and session/widget state** (`script_runner.py`, `runtime/state/session_state.py`): Avoid additional full-state scans, expensive equality checks, unstable widget IDs, or cleanup work repeated for every rerun and session.
- **`st.cache_data` and `st.cache_resource`** (`runtime/caching/`): Hits still hash arguments; `st.cache_data` also copies and unpickles results. Be careful with large keys/results, serialization, validation, replayed messages, and lock scope.
- **Dataframe/Arrow and streaming paths** (`dataframe_util.py`, `elements/arrow.py`, `elements/write.py`): Avoid dataframe conversions and copies, repeated Arrow serialization, per-cell styling work, and many tiny streaming updates that repeatedly rebuild growing payloads.

## Embedded agent skills

User-facing skills ship under `lib/streamlit/.agents/skills/` (for example, `developing-with-streamlit`). Keep them current as features land; follow `lib/streamlit/.agents/skills/AGENTS.md`.

## Unit Tests

We use the unit tests to cover internal behavior that can work without the web / backend
counterpart and the e2e tests to test the entire system. We aim for high unit test
coverage (95% or higher) of our Python code in `lib/streamlit`.

- Under `lib/tests/streamlit`, add a new test file
- Preferably in the mirrored directory structure as the non-test files.
- Naming: `my_example_test.py`
- Anti-regression checks: Where practical, go beyond the happy path by covering a plausible failure mode or edge case (invalid input, boundary condition, absent side effect). Do **not** add assertions that are logically implied by an earlier assertion — e.g., if you assert `x is True`, asserting `x is not False` is a tautology and adds no value. See `lib/tests/AGENTS.md` for detailed guidance and examples.
- Coverage exclusions: Use `# pragma: no cover` for code that cannot reasonably be tested, such as import fallbacks for optional dependencies, "should never happen" defensive checks, or platform-specific unreachable paths. Include a brief reason, e.g., `# pragma: no cover - optional dep` or `# pragma: no cover - defensive`.

### Typing Tests

We have typing tests in `lib/tests/streamlit/typing` for our public API to catch
typing errors in parameters or return types by using mypy, ty, and `assert_type`.

- **These are NOT pytest tests** — they are checked by mypy and ty, never executed at runtime.
- All assertions and imports go inside `if TYPE_CHECKING:` blocks.
- Do **not** use `def test_*()` functions or `import streamlit as st`.
- Import from Mixin classes directly (e.g. `LayoutsMixin().expander`).
- Always include `from __future__ import annotations` at the top.
- Overloads discriminated on `bool` need an explicit fallback overload for
  non-literal values, because mypy does not expand `bool` into
  `Literal[True] | Literal[False]`. String-`Literal` discriminators do not
  need that fallback; mypy expands union arguments, so assert the union
  result directly. Cover both the literal cases and the non-literal case.
- Check other typing tests in the `lib/tests/streamlit/typing` directory for inspiration
  (e.g. `radio_types.py`, `file_uploader_types.py`).
- Intentional invalid calls need a suppression for each checker that reports an
  error: `# type: ignore[...]` (mypy) and `# ty: ignore[...]` (ty). Place each
  suppression where its checker reports the diagnostic; use the same line when
  possible. Add a checker's comment only when that checker actually errors —
  ty's `unused-ignore-comment` rule is disabled, so a superfluous suppression
  is silently kept.
- A valid call whose asserted type mypy accepts but ty rejects may use
  `# ty: ignore[type-assertion-failure]`. Add a short note saying what ty infers
  instead, so the suppression can be removed once ty catches up.
- For dict-like return values backed by `AttributeDictionary` /
  `ReadOnlyAttributeDictionary` subclasses (e.g. dataframe/chart selection
  state, `ButtonColumn` click state, `st.data_editor` edit state), assert both
  attribute and bracket access (e.g. `state.selection.rows` and
  `state["selection"]["rows"]`, or `edit_state.edited_rows` and
  `edit_state["edited_rows"]`). Use a separate `TypedDict` (`*Input`) for
  values users assign (e.g. `selection_default`), not the returned
  attribute-dictionary class.

## Docstrings for Public API

All public-facing API methods (`st.*` namespace) use **NumPy-style docstrings (Numpydoc)** with
reStructuredText directives. Follow these guidelines:

- **Follow existing patterns**: Match the style of docstrings for similar parameters or functions
  in the codebase to ensure consistency.
- **Raw docstrings vs escaping**: If you need to include a backslash in the docstring, prefer a raw docstring (`r"""..."""`) over escaping.
- **Sections**: Always include `Parameters` and `Examples` sections. Include a `Returns` section
  only when the function returns a value that users need to understand and use in their
  application logic (e.g., widgets like `st.button` return `bool`). Display elements that return
  `DeltaGenerator` (e.g., `st.markdown`, `st.metric`) omit the `Returns` section since it's an
  implementation detail. Use `.. note::` for important caveats.
- **Parameter descriptions**: Start with the type (e.g., `label : str`), then describe purpose
  and behavior. Explicitly state defaults in prose, e.g., `"If this is ``None`` (default), ..."`.
  The first line is a noun phrase giving the definition. The remainder of the description should
  be in complete sentences.
- **Inline code**: Use double backticks (` `` `) for code literals, parameter values, and
  `None`/`True`/`False`.
- **Literal options**: List multi-option parameters (e.g., `type : "primary", "secondary"`) with
  bullet points describing each option.
- **Cross-references**: Link to `st.markdown` for Markdown capabilities using RST substitution
  (see existing docstrings for the pattern).
- **Examples**: Use `.. code-block:: python` for examples. Where possible, make the examples fully
  executable (beginning with import statements), label the filename, and end with `.. output::` directive
  and a URL with a reasonable name (e.g., `https://doc-<example-description>.streamlit.app/`). The output
  directive should include a height of at least 200px. Adjust the height to avoid scrolling where reasonable.
  Try to keep examples shorter than 600px. Always include a full empty line after an RST directive.

  ```
  .. code-block:: python
     :filename: streamlit_app.py

     import streamlit as st
  ```

  ```
  .. output::
     https://doc-example.streamlit.app
     height: 200px

  ```

## Exception handling

User-facing API errors raised from `st.*` commands belong in
`streamlit.errors`. Prefer existing reusable exception types over raising a
generic `StreamlitAPIException` with a one-off message.

- `StreamlitAPIException`: base for malformed user interaction with the Streamlit
  API. Prefer a more specific subclass when one fits.
- `StreamlitValueError(parameter, valid_values, *, detail=None)`: use when a
  parameter receives an invalid value from a known set of options or an
  accepted range. `valid_values` is the user-facing list of supported values:
  Literal / enum-like options, or a short range description (for example
  `"a positive duration"`). `parameter` is appended in uncaught-exception
  telemetry (`StreamlitValueError:<parameter>`); optional `detail` appears in
  the error message only. Example:
  `raise StreamlitValueError("type", ["'primary'", "'secondary'", "'tertiary'"])`.
- `StreamlitMissingRequiredParameterError(parameter, *, detail=None)`:
  use when a required parameter is missing, `None`, or empty, including an
  empty sequence. `parameter` is appended in uncaught-exception telemetry
  (`StreamlitMissingRequiredParameterError:<parameter>`). Example:
  `raise StreamlitMissingRequiredParameterError("label")`.
- `StreamlitIncompatibleParametersError(first_use, second_use, *other_uses, *, explanation=None)`: use
  when two or more parameter uses cannot be combined. Pass `parameter=value`
  when the conflict depends on a value (`wrap=False`), or the bare parameter
  name when merely providing it conflicts (`on_change`). These strings appear
  only in the displayed error; uncaught-exception telemetry records only the
  exception type. Optional `explanation` is appended when the generic
  "cannot be used together" message needs more context. Example:
  `raise StreamlitIncompatibleParametersError("wrap=False", "horizontal=False")`.
- `StreamlitInvalidParameterTypeError(parameter, provided_type, expected_types)`:
  use when a parameter has an unsupported type. `parameter` is appended in
  uncaught-exception telemetry (`StreamlitInvalidParameterTypeError:<parameter>`).
  Pass concise type names as strings; for example,
  `raise StreamlitInvalidParameterTypeError("step", "str", ["int", "timedelta"])`.
- Prefer other shared validators/errors when they already exist for the
  parameter, including:
  - `StreamlitInvalidWidthError` / `StreamlitInvalidHeightError`
    (layout sizing helpers)
  - `StreamlitInvalidColorError`
  - `StreamlitValueBelowMinError` / `StreamlitValueAboveMaxError` (numeric /
    date/time bounds)
  - `StreamlitInvalidRangeError` (`min_value` must be less than `max_value`,
    including when they are equal)
  - `StreamlitInvalidURLError(url, protocols)` (`st.logo(link=)`, page-config
    menu items). Pass the allowed schemes, for example `["http", "https"]`.
  - `StreamlitInvalidFormCallbackError` (form callback policy)
  - `StreamlitInvalidLayoutContextError` (command used in a disallowed layout,
    form, dialog, or fragment context — including opening a second dialog in the
    same run, writing to a container across a parallel-fragment boundary, or
    `st.rerun(scope="fragment")` outside a fragment rerun)
  - `StreamlitDuplicateElementKey` (duplicate user `key`, including `st.form`)
  - `StreamlitWidgetAlreadyInstantiatedError` (session state assigned after the
    widget with that key is instantiated this run)
  - `StreamlitDefaultNotInOptionsError` (default value not in widget `options`;
    `st.tabs` `default` and integer `index` use `StreamlitValueError` because
    this message is worded for option values, not tab labels or indices)
  - `StreamlitPageNotFoundError` (missing page path, `st.Page` file, `switch_page`,
    `page_link`)
  - `BidiComponentError` (base for CCv2 bidi errors; keep the unprefixed
    specialized subclasses — no `Streamlit` prefix)

Reserve bare `StreamlitAPIException` for one-off cases that no shared type
covers and that users are expected to hit uncommonly (serialization failures
and similar).

## Theming and Layout

- **Theming and layout calculations must be done in the frontend, not the Python backend.**
- Do not use `get_option("theme.primaryColor")` or similar theme options in backend code. This is unreliable because themes can be configured in multiple ways and the backend may not have access to the actual active theme.
- Pixel-based or rem-based calculations (sizing, spacing, responsive layouts) must be handled on the frontend side where the rendering context is available.
- The backend should pass semantic data to the frontend; let the frontend handle all visual presentation logic.
