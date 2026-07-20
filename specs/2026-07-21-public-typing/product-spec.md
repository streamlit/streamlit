---
author: lukasmasuch
created: 2026-07-21
---

# Public `streamlit.typing` namespace

## Summary

Add a curated `streamlit.typing` namespace for stable imports of Streamlit-owned
types that users need when annotating app code and reusable libraries. The initial
namespace exposes user-facing value and state types such as `UploadedFile`,
`ChatInputValue`, and chart selection states without moving their implementations or
exposing Streamlit's internal type aliases wholesale.

## Problem

[`#7801`](https://github.com/streamlit/streamlit/issues/7801) asks for a supported
way to import `UploadedFile`. Today, users who want to annotate a helper around
`st.file_uploader`, `st.camera_input`, or `st.audio_input` must import an internal
module:

```python
from streamlit.runtime.uploaded_file_manager import UploadedFile


def parse_upload(file: UploadedFile) -> dict[str, str]:
    ...
```

The same problem applies to other Streamlit-defined return values. For example,
users must import `DataframeState` from `streamlit.elements.arrow`,
`ChatInputValue` from `streamlit.elements.widgets.chat`, and `StreamlitPage` from
`streamlit.navigation.page`.

These imports have three problems:

- Their paths describe Streamlit's implementation, not the user-facing API.
- Refactoring an internal module can break otherwise valid typed apps.
- Users have no documented way to distinguish supported public types from internal
  classes and aliases that happen to be importable.

The issue discussion proposed `streamlit.typing`, but the codebase contains many
possible exports. Publishing all of them would turn implementation details into a
permanent compatibility surface.

There is also an earlier implementation attempt. [`#9048`](https://github.com/streamlit/streamlit/pull/9048)
initially proposed a `streamlit.types` module containing `UploadedFile` and
`DeltaGenerator`. During review, maintainers asked to separate that public-API
decision into a dedicated change; the final merged PR contained only the unrelated
annotation improvements. No types namespace has shipped, so this spec makes the
deferred naming and scope decisions explicitly.

### Goals

- Provide stable, documented imports for Streamlit-owned types users reasonably
  name in function parameters, return annotations, and shared state helpers.
- Define a repeatable inclusion rule for adding public types in the future.
- Preserve runtime type identity so existing values work with the re-exported
  concrete classes.
- Keep the first release small enough that every export can be supported as public
  API.

### Non-goals

- Export every alias used in Streamlit's own annotations.
- Replace Python's `typing` module or third-party typing packages.
- Move type implementations into the new module.
- Make every internal annotation part of Streamlit's public compatibility contract.
- Fix the existing static-typing limitation where event-state `TypedDict` types
  describe item access but not the runtime objects' optional attribute notation.

## Proposal

### Namespace name: `streamlit.typing`

Use `streamlit.typing`, and make the same module available as `st.typing` after
`import streamlit as st`.

The ecosystem uses both `typing` and `types`, but the names usually communicate
different intent:

| Pattern | Examples | Typical contents |
|---|---|---|
| `typing` | [`numpy.typing`](https://numpy.org/doc/stable/reference/typing.html), [`matplotlib.typing`](https://github.com/matplotlib/matplotlib/blob/main/lib/matplotlib/typing.py), [`pandas.api.typing`](https://github.com/pandas-dev/pandas/blob/main/pandas/api/typing/__init__.py), [`flask.typing`](https://github.com/pallets/flask/blob/main/src/flask/typing.py) | Public aliases, protocols, schemas, and classes collected specifically for type annotations |
| `types` | [`pydantic.types`](https://docs.pydantic.dev/latest/api/types/), [`click.types`](https://github.com/pallets/click/blob/main/src/click/types.py) | Runtime domain types with construction, validation, or conversion behavior |
| Mixed precedent | [`torch.types`](https://github.com/pytorch/pytorch/blob/main/torch/types.py), [`fastapi.types`](https://github.com/fastapi/fastapi/blob/master/fastapi/types.py) | Convenience or internal aliases, with varying public-API status |

`streamlit.typing` is preferred because the namespace's purpose is explicitly to
support annotations. Some exports are concrete runtime classes, but that is also true
of `pandas.api.typing`, whose stated purpose is to expose public API classes useful for
type hinting. The name also matches the direction already discussed by maintainers in
[`#7801`](https://github.com/streamlit/streamlit/issues/7801#issuecomment-3494342153).

Do not add `streamlit.types` as an alias. There is no existing public path to preserve,
and two names would create duplicate documentation and a second permanent namespace.

### Import API

All of the following are supported:

```python
import streamlit as st
import streamlit.typing as stt
from streamlit.typing import UploadedFile

assert st.typing is stt
```

`streamlit.typing` is a regular runtime Python module, not a stub-only `.pyi` module.
This ensures imports work when annotations are evaluated at runtime and lets concrete
class exports such as `UploadedFile` preserve normal `isinstance` behavior.
`TypedDict` exports remain annotation-only and must not be used with `isinstance`.

### Inclusion rule

An initial export must satisfy all of the following:

1. It is owned by Streamlit and describes a value produced by a documented public
   API, or a documented nested state payload of that value.
2. A user may reasonably need to name it at an application or library boundary.
3. Replacing it with a simple standard-library annotation would lose meaningful
   Streamlit-specific structure or behavior.
4. Its name and user-facing contract are stable enough to support under Streamlit's
   normal deprecation policy.
5. It is not already available from a more appropriate public namespace, such as
   `streamlit.errors` or `streamlit.connections`.

This is intentionally an output-first rule. Input aliases can be added later when
there is demonstrated wrapper/library demand and their names accurately express the
public contract.

### Initial exports

The initial `streamlit.typing.__all__` contains these 11 names:

| Export | Public API relationship | Why users need to name it |
|---|---|---|
| `UploadedFile` | `st.file_uploader`, `st.camera_input`, `st.audio_input`, and file/audio fields in `st.chat_input` | It is a Streamlit-specific `BytesIO` subclass with documented file metadata and is the motivating request in `#7801`. |
| `ChatInputValue` | `st.chat_input` when file or audio input is enabled | It has a documented dict-like and attribute-based schema that is lost with `Mapping[str, Any]`. |
| `StreamlitPage` | `st.Page` and `st.navigation` | Modular multipage apps commonly build and return page collections, but `st.Page` is a factory function and cannot itself be used as the return type. |
| `DataframeState` | `st.dataframe` with selection events | It is the documented event envelope returned to app code. |
| `DataframeSelectionState` | `DataframeState["selection"]` and `selection_default` | It describes the selectable row, column, and cell payload and is also used for programmatic selection. |
| `PlotlyState` | `st.plotly_chart` with selection events | It is the documented event envelope returned to app code. |
| `PlotlySelectionState` | `PlotlyState["selection"]` | It describes Plotly point, index, box, and lasso selection data. |
| `VegaLiteState` | `st.altair_chart` and `st.vega_lite_chart` with selection events | It is the documented event envelope; its selection keys and values depend on the user-authored Vega-Lite spec. |
| `PydeckState` | `st.pydeck_chart` with selection events | It is the documented event envelope returned to app code. |
| `PydeckSelectionState` | `PydeckState["selection"]` | It describes selected indices and objects grouped by PyDeck layer. |
| `ButtonClickState` | `st.session_state[key]` for a keyed `st.column_config.ButtonColumn` | It is the documented row-and-label payload available to callbacks. |

The module re-exports the existing objects rather than creating duplicate classes or
schemas. For example:

```python
from streamlit.runtime.uploaded_file_manager import UploadedFile as _UploadedFile

UploadedFile = _UploadedFile
```

The actual implementation should use explicit imports and an explicit `__all__`.
The assignment above only illustrates the identity requirement:

```python
import streamlit as st
from streamlit.typing import UploadedFile

upload = st.file_uploader("Upload a file")
if upload is not None:
    assert isinstance(upload, UploadedFile)
```

Concrete classes in this namespace are returned by Streamlit APIs. Their presence in
`streamlit.typing` does not make their constructors part of the supported public API;
users should continue to create them through the corresponding `st.*` command.

### Keep the existing event-state names

Do not rename the outer event states to `*SelectionState`.

```python
class PlotlyState(TypedDict):
    selection: PlotlySelectionState
```

`DataframeSelectionState`, `PlotlySelectionState`, and `PydeckSelectionState`
already name the nested `.selection` payloads. Renaming `DataframeState`,
`PlotlyState`, or `PydeckState` to those names would collide with existing types and
blur the distinction between the event envelope and its selection payload.

The generic outer `*State` names are also forward-compatible with additional event
kinds. If hover, click, edit, or other events are added later, their payloads can be
added to the existing envelope without renaming the type again. `VegaLiteState` does
not need a new `VegaLiteSelectionState`: Vega-Lite selection names and payload shapes
come from the user's chart specification, so a new static schema would imply precision
that Streamlit cannot provide.

### Candidate decisions

| Candidate | Decision | Rationale |
|---|---|---|
| `UploadedFile`, `ChatInputValue` | Include | Concrete, Streamlit-owned values returned directly to users. |
| `DataframeState`, `DataframeSelectionState`, `PlotlyState`, `PlotlySelectionState`, `VegaLiteState`, `PydeckState`, `PydeckSelectionState` | Include | Documented event return types and nested payloads. Keep their current names. |
| `StreamlitPage`, `ButtonClickState` | Include | Additional user-facing values found by auditing public return and session-state contracts. |
| `Data` | Defer | A very broad, generically named union of third-party inputs. It changes as dataframe support expands and is not a Streamlit-owned value. A future public alias should have a semantic name such as `DataframeData` and dedicated demand. |
| `Width`, `WidthWithoutContent`, `Height`, `HeightWithoutContent` | Defer | Useful mainly to wrapper authors, and the negative `WithoutContent` names expose implementation constraints. Revisit with semantic names if input aliases are added. |
| `Key` | Exclude | It is exactly `str | int`; the alias adds little information or safety. |
| `MediaData`, `AtomicImage` | Defer | They are broad third-party input unions. `AtomicImage` is implementation terminology, and the aliases would need public names and compatibility guarantees before export. |
| `WidgetCallback`, `WidgetArgs`, `WidgetKwargs` | Exclude | `Callable[..., None]`, `tuple[Any, ...] | list[Any]`, and `dict[str, Any]` are easy to express and currently too imprecise to add meaningful safety. |
| `ColumnConfigMappingInput` renamed to `ColumnConfig`, with the current inner `ColumnConfig` renamed to `ColumnConfigMappingInner` | Defer | Annotating reusable column-config builders is a valid use case, but the current alias omits supported integer keys and includes the internal `ButtonColumnResult` wrapper. `ColumnConfigMappingInner` is also implementation-oriented. Design a precise public value and mapping model separately instead of freezing or renaming these internals here. |
| `DeltaGenerator` | Exclude | It is a central implementation object rather than a stable semantic value, and maintainers have explicitly called out uncertainty about its long-term public role in `#7801`. Most users do not need to name it. |
| `StatusContainer`, `ExpanderContainer`, `PopoverContainer`, `TabContainer`, `SkeletonPlaceholder` | Defer | These are documented presentation handles, but they are tightly coupled to `DeltaGenerator`. Revisit them together after the container type hierarchy is considered a stable public contract. |
| Streamlit exceptions | Exclude | They already have the appropriate public home in `streamlit.errors`. |
| Connection classes | Exclude | They already have the appropriate public home in `streamlit.connections`. |

### Examples

#### Annotate uploaded-file processing

```python
import pandas as pd
import streamlit as st
from streamlit.typing import UploadedFile


def read_upload(file: UploadedFile) -> pd.DataFrame:
    return pd.read_csv(file)


upload = st.file_uploader("Upload a CSV", type="csv")
if upload is not None:
    st.dataframe(read_upload(upload))
```

#### Annotate a dataframe-selection helper

```python
import pandas as pd
import streamlit as st
import streamlit.typing as stt


def selected_rows(event: stt.DataframeState) -> list[int]:
    # Item notation is fully described by the TypedDict schema.
    return event["selection"]["rows"]


event = st.dataframe(
    pd.DataFrame({"name": ["Ada", "Grace"]}),
    on_select="rerun",
    selection_mode="multi-row",
)
st.write(selected_rows(event))
```

#### Build typed page collections

```python
import streamlit as st
from streamlit.typing import StreamlitPage


def app_pages() -> list[StreamlitPage]:
    return [st.Page("home.py"), st.Page("reports.py")]


st.navigation(app_pages()).run()
```

### Implementation and compatibility

- Add `lib/streamlit/typing.py` with explicit re-exports and `__all__`.
- Bind that module to `typing` in `streamlit.__init__` so `st.typing` works, matching
  other Streamlit namespaces such as `st.column_config`.
- Keep all underlying definitions in their current modules. Existing internal imports
  continue to work, and the new path becomes the supported public path.
- Preserve object identity for concrete classes and `TypedDict` definitions. Do not
  create wrapper subclasses solely for the public namespace.
- Avoid importing optional visualization or dataframe packages beyond those loaded by
  a normal `import streamlit`. The selected existing types already use forward
  references or Streamlit-owned definitions where needed.
- Treat names in `streamlit.typing.__all__` as normal public API. Removing or renaming
  an export, narrowing an alias, or removing a state field requires the standard
  deprecation process. Adding an optional state field or widening accepted values can
  remain additive.
- Update internal type tests to import these user-facing types from
  `streamlit.typing`, proving that the public path—not only the implementation path—
  works with supported type checkers.

### Testing

Add coverage for:

- `import streamlit.typing`, `from streamlit import typing`, and `st.typing`.
- Exact `__all__` contents so accidental internal exports are caught.
- Identity between every public export and its underlying implementation object.
- `isinstance` for concrete return values such as `UploadedFile` and
  `ChatInputValue`.
- Mypy and ty/Pyright-style assertions that public imports match the return types of
  their corresponding `st.*` APIs.
- Typed item access for every exported state `TypedDict`.
- A wheel-level smoke test confirming `streamlit.typing` is packaged with the existing
  `py.typed` marker.

### Documentation

- Add a `streamlit.typing` API-reference page that lists only `__all__` exports and
  groups them into values, event states, and nested state payloads.
- Update the relevant command return-value documentation to link to the public type,
  especially `st.file_uploader`, `st.chat_input`, `st.navigation`, dataframe/chart
  selection APIs, and `st.column_config.ButtonColumn`.
- State that concrete classes are normally obtained from Streamlit commands rather
  than constructed directly.
- State that event-state `TypedDict` types support statically checked item notation.
  Runtime attribute notation remains supported but is not represented by `TypedDict`;
  improving that typing is future work.
- Do not describe the namespace as containing “all Streamlit types.” It is a curated
  public typing surface.

### Acceptance criteria

- Users can replace an internal `UploadedFile` import with
  `from streamlit.typing import UploadedFile` without changing behavior.
- All 11 initial exports are available through both `streamlit.typing` and
  `st.typing` and are listed in `__all__`.
- Public exports are the same runtime objects as their current definitions.
- Type-checking examples for uploaded files, chat values, pages, and all event-state
  schemas pass with the repository's supported type checkers.
- Loading `streamlit.typing` does not import additional third-party packages beyond a
  normal `import streamlit`.
- Documentation distinguishes the outer `*State` event envelope from nested
  `*SelectionState` payloads.
- No existing import path or runtime API changes.

## Out of Scope (Future Work)

- A public input-alias collection for layout, data, image, media, selection-mode, and
  callback parameters.
- A redesigned public `ColumnConfig` type.
- Public presentation/container handle types or `DeltaGenerator`.
- Protocol-based event-state types that statically support both item and attribute
  notation.
- Third-party stub packages or a mypy plugin.

## Alternatives Considered

### Name the module `streamlit.types`

**Pros:** Shorter, and concrete values like `UploadedFile` are runtime types.

**Rejected because:** The module exists to support annotations, not to collect
constructible or validating domain objects. `typing` better signals that purpose and
matches NumPy, Matplotlib, pandas, Flask, and the existing maintainer proposal.

### Export only `UploadedFile`

**Pros:** Smallest possible change and directly addresses the original issue.

**Rejected because:** The same unstable-import problem exists for a small, identifiable
set of other documented Streamlit return and state types. Applying one inclusion rule
now avoids an arbitrary one-off namespace while keeping broad input aliases out.

### Export all aliases used in public annotations

**Pros:** Wrapper authors could reuse every annotation exactly.

**Rejected because:** Many aliases are trivial, overly broad, imprecise, generically
named, or tied to implementation details. Publishing them would make future internal
refactors and improvements unnecessarily breaking.

### Export the types from `streamlit` directly

For example, support `st.UploadedFile` and `st.DataframeState`.

**Rejected because:** Streamlit's top-level namespace is optimized for commands and a
small number of primary objects. Eleven additional annotation-oriented names would add
noise, while `streamlit.typing` keeps the purpose clear and scales to future types.

### Use a stub-only `streamlit/typing.pyi`

**Pros:** No runtime imports.

**Rejected because:** The import would not exist at runtime, breaking evaluated
annotations and preventing normal identity and `isinstance` behavior for concrete
classes. A regular typed module is simpler and consistent with the ecosystem examples.

## Checklist

| Item | ✅ or comment |
|---|---|
| Works on SiS, Cloud, etc? | ✅ Pure Python import/API change with no platform-specific behavior |
| No breaking API changes | ✅ Additive; existing internal paths remain available |
| No new dependencies | ✅ |
| Metrics collected | Not applicable; importing a type namespace should not emit usage metrics |
| Any security/legal impact? | None |
| Any docs changes needed? | ✅ New API-reference page and links from affected return-value docs |
