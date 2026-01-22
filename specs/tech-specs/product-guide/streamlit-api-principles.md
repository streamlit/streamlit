# Streamlit API Design Principles

This document outlines the design principles and conventions behind Streamlit's Python API (`st` namespace). It serves as a guide for PMs and engineers designing new commands, parameters, and features.

**Related documents:**
- [Product Guidelines](./product-guidelines.md) — High-level product philosophy
- [Spec Writing Principles](./spec-writing-principles.md) — How to write product specifications

**When to use this document:**
- Designing a new `st.*` command or parameter
- Reviewing API design in a spec or PR
- Understanding why existing APIs work the way they do
- Making decisions about naming, typing, or signatures

---

## The 40 Principles of Streamlit API Design

### 1. **Simplicity First**

The most common use case should require the fewest arguments. A user should be able to call `st.button("Click")` and have it work beautifully without reading documentation.

### 2. **Progressive Disclosure**

Start with what's essential, reveal complexity only when needed. Parameters flow from required → common → advanced, with the `*` separator marking the boundary to keyword-only arguments.

### 3. **Consistency Over Novelty**

Similar elements should have similar APIs. Once a user learns `st.selectbox`, they should intuitively understand `st.radio` and `st.multiselect`. Resist the urge to innovate on parameter names or orders.

### 4. **Sensible Defaults**

Every optional parameter should have a default that works for 80% of use cases. Users shouldn't need to specify `disabled=False` or `width="stretch"` explicitly—these should just be the natural behavior.

### 5. **Explicit Over Implicit**

Use clear, descriptive parameter names. Prefer `label_visibility="hidden"` over a cryptic `hide_label=True`. Use `Literal` types to enumerate valid options rather than accepting arbitrary strings.

### 6. **Type Safety Without Burden**

Provide precise type annotations that enable IDE autocompletion and catch errors early. Use `@overload` to narrow return types based on input, but never sacrifice usability for type purity.

### 7. **Predictable Return Types**

Users should know what to expect: display elements return `DeltaGenerator` (for chaining), widgets return their value type, and control flow commands use `NoReturn`. No surprises.

### 8. **Standardized Vocabulary**

Use consistent parameter names across the API: `label` (not `title`), `value` (not `default`), `key` (not `id`), `help` (not `tooltip`), `on_change` (not `callback`). This vocabulary is sacred.

### 9. **User-Focused Documentation**

Docstrings are for users, not implementers. Document what each parameter does and when to use it, not how it's implemented internally. Every `Literal` value deserves its own bullet point explanation.

### 10. **Graceful Evolution**

APIs age; deprecate thoughtfully. Provide 3+ months warning, clear migration paths, and helpful error messages. Never break working code without ample notice and documentation.

### 11. **Stateful by Default**

Widgets remember their values across reruns automatically. The `key` parameter bridges widgets to `st.session_state`, making state management invisible for simple apps but powerful for complex ones.

### 12. **Pythonic Idioms**

Embrace Python's native patterns: context managers for scoping (`with st.container():`), decorators for behavior modification (`@st.cache_data`), generators for streaming (`st.write_stream`). Don't invent new paradigms when Python already has elegant solutions.

### 13. **Composable Containers**

Containers return `DeltaGenerator` objects that can be used with `with` statements OR via method chaining. Both patterns should work identically: `with st.sidebar:` and `st.sidebar.write()` are equally valid.

### 14. **Fail Fast, Fail Helpfully**

Validate parameters immediately and raise clear, actionable exceptions. Users should never see cryptic errors or silent failures. Error messages should explain what went wrong AND how to fix it.

### 15. **Type Preservation**

Generic types flow through the API. When a user passes `options=["a", "b", "c"]` to `st.selectbox`, the return type is `str`. When they pass a list of custom objects, they get their object type back. The type system should help, not hinder.

### 16. **Extend Before Inventing**

Prefer adding parameters to existing commands over creating new ones. Adding `sparkline` to `st.metric` is better than a new `st.metric_with_sparkline`. Adding `accept_new_options` to `st.selectbox` is better than `st.creatable_selectbox`. Extension preserves user mental models.

### 17. **Design for Composition**

Features should work together naturally. `st.badge` doesn't need a `multiple` parameter because `st.container(horizontal=True)` handles layout. Don't duplicate functionality across commands—let users compose primitives.

### 18. **Start Minimal, Ship Fast**

Launch with the smallest useful API. You can always add `sparkline_type="bar"` later, but you can never remove it. Every parameter is a maintenance burden. When in doubt, leave it out—user feedback will tell you what's actually needed.

### 19. **Match User Expectations**

If `st.file_uploader` has `accept_multiple_files`, then `st.selectbox` should have `accept_new_options`, not `allow_custom` or `creatable`. Users learn patterns, and new features should leverage (not fight) that learning.

### 20. **Visual Features Need Visual Defaults**

If a feature is visual (like a badge color or button type), the default should look intentional, not absent. `color="blue"` is better than `color=None`. Users who don't specify should still get a polished result.

### 21. **Avoid "Clever But Too Clever"**

An API like `key="?foo"` to bind to query params is elegant but hard to discover and confusing in programmatic use. Explicit parameters like `query_key="foo"` are more verbose but clearer. When weighing options, bias toward discoverability over cleverness.

### 22. **Protect LLM-Generated Code**

With AI coding assistants generating Streamlit code, avoid deprecations of widely-used patterns. Adding `accept_multiple_files="directory"` is better than creating a new `accept_directory` param that would deprecate the existing one. LLMs learn from existing code; breaking changes break LLM outputs.

### 23. **Design for All Platforms**

Every feature needs to work (or gracefully degrade) on: local development, Community Cloud, SiS (Snowflake), notebooks, embedded iframes, and mobile. Document platform-specific behavior explicitly. `st.context.ip_address` returns `None` on SiS—that's a valid design choice.

### 24. **Consider the Frontend-Backend Split**

Some data lives in the browser (theme type, viewport size) and some on the server (config, session state). APIs like `st.context.theme.type` require frontend→backend communication on every rerun. Understand the performance implications before committing to an API shape.

### 25. **Default Null Over Default Error**

When a value can't be determined, return `None` rather than raising an exception. `st.context.ip_address` returns `None` behind a proxy rather than failing. This lets users write `if st.context.ip_address:` rather than wrapping everything in try/except.

### 26. **Leverage Markdown Everywhere**

Wherever text is displayed, support Streamlit's markdown rendering. Labels, help tooltips, captions, and body text should all accept markdown syntax including bold, italics, links, code, emoji, and Material icons. This gives users rich formatting without separate styling APIs.

```python
# Users get formatting for free
st.button("**Submit** :material/send:", help="Click to *submit* your data")
st.metric(label="Revenue :material/trending_up:", value="$1.2M")
```

### 27. **Same Name, Same Behavior**

When a parameter name appears in multiple commands, it must behave identically. If `help` shows a tooltip in `st.button`, it must show a tooltip in `st.selectbox`. If `width` accepts `"stretch"` in `st.container`, it must accept `"stretch"` everywhere. Users shouldn't need to re-learn parameters per command.

```python
# These should all work the same way
st.button("Go", help="Click me", disabled=False, width="content")
st.selectbox("Pick", options, help="Pick one", disabled=False, width="content")
st.text_input("Name", help="Enter name", disabled=False, width="content")
```

### 28. **Embrace the Python Ecosystem**

Accept the data types users already work with. If it's array-like, accept NumPy arrays, Pandas Series, lists, tuples, and sets. If it's dataframe-like, accept Pandas, Polars, PyArrow, and anything with a compatible interface. Don't force users to convert their data.

```python
# All of these should work for options:
st.selectbox("Pick", ["a", "b", "c"])           # list
st.selectbox("Pick", ("a", "b", "c"))           # tuple
st.selectbox("Pick", {"a", "b", "c"})           # set
st.selectbox("Pick", np.array(["a", "b", "c"])) # numpy
st.selectbox("Pick", pd.Series(["a", "b", "c"]))# pandas
```

### 29. **Positional Arguments Are Precious**

Only the 1-3 most essential parameters should be usable positionally. Everything else goes after the `*` separator as keyword-only. Positional slots are limited; once taken, they can never change order. Reserve them for `label`, `body`, `options`—not `disabled` or `icon`.

```python
def selectbox(
    self,
    label: str,           # Positional OK - essential
    options: Sequence,    # Positional OK - essential
    index: int = 0,       # Positional OK - very common
    *,                    # KEYWORD-ONLY BELOW
    format_func: ...,     # Keyword-only - less common
    key: ...,             # Keyword-only - advanced
    help: ...,            # Keyword-only - optional enhancement
    disabled: ...,        # Keyword-only - edge case
) -> T:
```

### 30. **Patterns Are Sacred**

When a pattern exists, follow it religiously. If callbacks use `on_change`, `args`, `kwargs` everywhere, don't introduce `callback`, `callback_args` in a new widget. If containers use `border=True`, don't use `show_border=True`. Pattern violations create cognitive load that compounds across the API.

### 31. **Prefer Enums Over Booleans**

Booleans limit future expansion. Use `Literal` types (string enums) for any parameter that might grow beyond two states. A boolean locks you into adding more booleans; an enum extends gracefully.

```python
# ❌ Bad: Boolean limits expansion
st.text_input("Password", password=True)
# What if we want "email" type later? Another boolean?

# ✅ Good: Enum allows expansion
st.text_input("Password", type="password")
st.text_input("Email", type="email")  # Easy to add later
st.text_input("Phone", type="tel")    # And again
```

Exception: `disabled=True/False` is fine because there will never be a third state.

### 32. **Minimize Migration Distance**

New features should require minimal changes to existing apps. When users upgrade, their code should mostly just work. If a feature requires significant refactoring (like early Multipage Apps did), it creates adoption friction and fragments the ecosystem between "old style" and "new style" apps.

```python
# ✅ Good: Additive feature
# Old code still works:
st.selectbox("Pick", options)
# New feature is opt-in:
st.selectbox("Pick", options, accept_new_options=True)

# ❌ Bad: Breaking change requiring refactor
# Old: st.experimental_memo  →  New: @st.cache_data (migration required)
```

### 33. **Declarative Over Imperative**

Streamlit is a declarative framework—users describe *what* they want, not *how* to build it. Command names should be nouns (`st.button`, `st.chart`, `st.container`) that declare UI elements, not verbs that describe actions. Reserve verbs for true actions (`st.rerun`, `st.stop`, `st.write`).

### 34. **Drop-In Replacement for Scripts**

Streamlit code should feel like a natural evolution of a Python script. Converting from script to app should require minimal changes—swap a variable for a slider, swap `open(file)` for `st.file_uploader()`.

```python
# Regular Python script:
your_number = 10
with open("data.csv") as f:
    process(f)

# Streamlit app (minimal changes):
your_number = st.slider("Pick a number", value=10)
f = st.file_uploader("Pick a file")
if f:
    process(f)
```

### 35. **Commands Are Non-Blocking**

Streamlit commands never block script execution. Code after an `st.text_input()` always runs, even before the user types anything. This differs from traditional `input()` which halts until the user responds. Users must learn to think in terms of "the script runs top-to-bottom on every interaction."

```python
name = st.text_input("Name")  # Does NOT block
st.write(f"Hello {name}")     # Always runs (name may be "")
```

### 36. **One Use Case, One Command**

Each command should serve a specific, well-defined use case. If you're trying to cover two distinct use cases, you probably need two commands. `st.tabs` is for paginating content within a page, not for navigation—that's what `st.navigation` is for.

### 37. **Semantic Names Over Geeky Names**

Names should be understood by typical English speakers, not just developers. Prefer human-readable terms over technical jargon.

```python
# ✅ Good: Semantic, obvious
st.title("Welcome")
st.sidebar
st.columns(3)

# ❌ Bad: Geeky, requires HTML knowledge
st.h1("Welcome")
st.aside
st.grid(cols=3)
```

### 38. **One Rerun Per Interaction**

Each user interaction should trigger at most one script rerun. Uploading 10 files at once = one rerun. Uploading 10 files one at a time = 10 reruns. Dragging a slider = one rerun when released, not continuous reruns while dragging.

### 39. **Flat Namespace, Rare Submodules**

Keep most commands in the flat `st.*` namespace—it's what makes Streamlit feel easy. Only use submodules for:
- Extension APIs developers won't use directly (`st.components.v1`)
- Peripheral APIs used around apps, not in them (`st.testing.v1`)
- Large groups (10+) of specialized commands (`st.column_config`)

### 40. **Config vs Code: Environment vs Behavior**

Use `config.toml` for settings that vary by deployment environment or apply across multiple apps. Use `st.*` commands for everything else.

```toml
# config.toml: Environment/deployment settings
[server]
port = 8501

[theme]
primaryColor = "#FF6B6B"
```

```python
# Code: App-specific behavior
st.set_page_config(page_title="My App", layout="wide")
```

---

## Table of Contents

1. [Command Categories](#command-categories)
2. [Method Signature Patterns](#method-signature-patterns)
3. [Parameter Design](#parameter-design)
4. [Return Types](#return-types)
5. [Type Annotations](#type-annotations)
6. [Naming Conventions](#naming-conventions)
7. [Documentation Standards](#documentation-standards)
8. [Deprecation Process](#deprecation-process)
9. [Implementation Patterns](#implementation-patterns)
10. [Configuration vs Code APIs](#configuration-vs-code-apis)

---

## Command Categories

Streamlit commands fall into distinct categories with different patterns:

### Display Elements (Non-interactive)

Elements that display content but don't capture user input.

| Pattern | Return Type | Examples |
|---------|-------------|----------|
| Text/Media | `DeltaGenerator` | `st.markdown`, `st.text`, `st.image`, `st.video` |
| Data | `DeltaGenerator` | `st.dataframe`, `st.table`, `st.json` |
| Charts | `DeltaGenerator` | `st.line_chart`, `st.bar_chart`, `st.plotly_chart` |
| Status | `DeltaGenerator` | `st.error`, `st.warning`, `st.success`, `st.info` |

### Input Widgets (Interactive)

Elements that capture user input and return values.

| Pattern | Return Type | Examples |
|---------|-------------|----------|
| Boolean | `bool` | `st.button`, `st.checkbox`, `st.toggle` |
| Text | `str` or `str \| None` | `st.text_input`, `st.text_area` |
| Numeric | `int`, `float`, or range tuple | `st.slider`, `st.number_input` |
| Selection | `T` (generic) | `st.selectbox`, `st.radio`, `st.multiselect` |
| Date/Time | `date`, `time`, `datetime` | `st.date_input`, `st.time_input` |
| File | `UploadedFile \| None` | `st.file_uploader`, `st.camera_input` |

### Container/Layout Elements

Elements that group other elements.

| Pattern | Return Type | Usage |
|---------|-------------|-------|
| Context Manager | `DeltaGenerator` | `st.container`, `st.expander`, `st.columns` |
| Mutable | `StatusContainer` | `st.status` |

### Decorators

Function decorators that modify behavior.

| Decorator | Purpose |
|-----------|---------|
| `@st.cache_data` | Cache data transformations |
| `@st.cache_resource` | Cache resources (models, connections) |
| `@st.fragment` | Partial reruns |
| `@st.dialog` | Modal dialogs |

### Control Flow Commands

Commands that affect script execution.

| Command | Return | Purpose |
|---------|--------|---------|
| `st.stop()` | `NoReturn` | Stop execution |
| `st.rerun()` | `NoReturn` | Trigger rerun |
| `st.switch_page()` | `NoReturn` | Navigate to page |

---

## Method Signature Patterns

### Standard Widget Signature

Most widgets follow this parameter order:

```python
def widget(
    self,
    label: str,                           # 1. Primary identifier (positional)
    # ... type-specific params ...        # 2. Type-specific (positional OK)
    key: Key | None = None,               # 3. Widget key
    help: str | None = None,              # 4. Tooltip
    on_change: WidgetCallback | None = None,  # 5. Callback
    args: WidgetArgs | None = None,       # 6. Callback args
    kwargs: WidgetKwargs | None = None,   # 7. Callback kwargs
    *,  # keyword-only arguments below:
    placeholder: str | None = None,       # 8. Visual customization
    disabled: bool = False,               # 9. State modifiers
    label_visibility: LabelVisibility = "visible",  # 10. Label control
    width: Width = "stretch",             # 11. Layout options
) -> ReturnType:
```

### Keyword-Only Separator (`*`)

Use `*` to separate positional-or-keyword parameters from keyword-only parameters:

```python
def button(
    self,
    label: str,                    # Can be positional
    key: Key | None = None,        # Can be positional
    help: str | None = None,       # Can be positional
    on_change: ...,
    args: ...,
    kwargs: ...,
    *,  # Everything after is keyword-only
    type: Literal["primary", "secondary", "tertiary"] = "secondary",
    icon: str | None = None,
    disabled: bool = False,
    width: Width = "content",
) -> bool:
```

**Rule:** Parameters that are "enhancing" or "styling" should be keyword-only. Core functional parameters can be positional.

### Display Element Signature

Simpler pattern for non-interactive elements:

```python
def element(
    self,
    body: SupportsStr,            # Primary content
    *,  # keyword-only:
    help: str | None = None,      # Optional tooltip
    width: Width = "stretch",     # Layout
) -> DeltaGenerator:
```

---

## Parameter Design

### Common Parameter Types

#### `label: str`

The primary identifier shown to users. Supports limited GitHub-flavored Markdown:

- Bold, italics, strikethrough
- Inline code, links
- Emoji and Material icons (as inline images)

#### `key: Key | None`

Widget identifier for session state. Type: `str | int`

- If `None`, auto-generated from content
- Must be unique across the app

#### `help: str | None`

Tooltip text. Supports full Markdown including the directives in `st.markdown`.

#### `disabled: bool`

Disables user interaction. Default: `False`

#### `label_visibility: LabelVisibility`

Controls label display:

- `"visible"` (default): Normal display
- `"hidden"`: Empty spacer (maintains alignment)
- `"collapsed"`: No label or spacer

#### `width: Width` / `height: Height`

Layout sizing:

```python
Width: TypeAlias = int | Literal["stretch", "content"]
Height: TypeAlias = int | Literal["stretch", "content"]
```

- `"stretch"`: Fill parent container
- `"content"`: Size to content
- `int`: Fixed pixel size

Some widgets use `WidthWithoutContent` which excludes `"content"`.

#### `icon: str | None`

Icon display. Accepts:

- Single emoji: `"🔥"`
- Material icon: `":material/thumb_up:"`
- Spinner: `"spinner"`

### Callback Parameters

Standard callback trio for widgets:

```python
on_change: WidgetCallback | None = None,  # Callable[..., None]
args: WidgetArgs | None = None,           # tuple[Any, ...] | list[Any]
kwargs: WidgetKwargs | None = None,       # dict[str, Any]
```

### Options Parameters

For selection widgets:

```python
options: OptionSequence[T]  # Generic over option type T
```

Accepts:

- Lists, tuples, sets
- Pandas Series/DataFrame columns
- NumPy arrays
- Any iterable

### Literal Types for Constrained Values

Use `Literal` for parameters with fixed choices:

```python
type: Literal["primary", "secondary", "tertiary"] = "secondary"
delta_color: Literal["normal", "inverse", "off"] = "normal"
chart_type: Literal["line", "bar", "area"] = "line"
```

### Format Strings

For formatted display (e.g., `st.metric`, `st.column_config.NumberColumn`):

```python
format: str | NumberFormat | None = None
```

Options:

- `None`: No formatting
- Named formats: `"plain"`, `"localized"`, `"percent"`, `"compact"`, `"dollar"`, `"euro"`, `"scientific"`
- printf-style: `"%.2f"`, `"%d"`
- Date formats: `"localized"`, `"distance"` (2 years ago), `"calendar"` (Tomorrow at 5:35 PM)

Named formats leverage the browser's `Intl` API for automatic localization—users don't need to handle locale differences manually.

### Extending Existing Parameters

When adding new capabilities, prefer extending parameter types over adding new parameters:

```python
# Good: Extend existing parameter to accept new values
accept_multiple_files: bool | Literal["directory"] = False

# Avoid: Adding conflicting parameters
accept_multiple_files: bool = False,
accept_directory: bool = False,  # What if both True?
```

This pattern avoids deprecations and reduces parameter explosion.

---

## Return Types

### Display Elements → `DeltaGenerator`

Returns the container for method chaining:

```python
container = st.container()
container.write("Inside container")
```

### Widgets → Value Type

Returns the current widget value:

```python
name = st.text_input("Name")  # Returns str
count = st.number_input("Count")  # Returns int | float
```

### Control Flow → `NoReturn`

Never returns (halts execution):

```python
def stop() -> NoReturn: ...
def rerun() -> NoReturn: ...
```

### Nullable Returns

Use `T | None` when:

- No value is selected (`index=None` for selectbox)
- Widget allows empty state (`value=None` for text_input)

---

## Type Annotations

### Required Annotations

Every public function must have:

- Parameter type annotations
- Return type annotation
- Type aliases for complex types

### Using `@overload` for Type Narrowing

Use `@overload` when return type depends on parameter values:

```python
@overload
def text_input(
    self,
    label: str,
    value: str = "",  # Non-None default
    ...
) -> str: ...  # Returns str

@overload
def text_input(
    self,
    label: str,
    value: SupportsStr | None = None,  # Nullable
    ...
) -> str | None: ...  # Returns str | None
```

Common overload scenarios:

- Empty options → `None` return
- `index=None` → nullable selection
- `accept_new_options=True` → `T | str` return

### Generic Types

For selection widgets with typed options:

```python
T = TypeVar("T")

def selectbox(
    self,
    label: str,
    options: OptionSequence[T],
    ...
) -> T: ...
```

### Common Type Aliases

```python
Key: TypeAlias = str | int
LabelVisibility: TypeAlias = Literal["visible", "hidden", "collapsed"]
Width: TypeAlias = int | Literal["stretch", "content"]
Height: TypeAlias = int | Literal["stretch", "content"]
WidgetCallback: TypeAlias = Callable[..., None]
WidgetArgs: TypeAlias = tuple[Any, ...] | list[Any]
WidgetKwargs: TypeAlias = dict[str, Any]
```

### Protocols for Duck Typing

Use protocols for flexible input types:

```python
class SupportsStr(Protocol):
    def __str__(self) -> str: ...

def markdown(self, body: SupportsStr, ...) -> DeltaGenerator:
    # Accepts anything with __str__
```

---

## Naming Conventions

### Command Names

| Convention | Examples |
|------------|----------|
| Noun for display | `st.text`, `st.image`, `st.chart` |
| Noun + `_input` for input | `st.text_input`, `st.number_input` |
| Noun + `_chart` for charts | `st.line_chart`, `st.bar_chart` |
| Verb for actions | `st.write`, `st.stop`, `st.rerun` |
| `set_` prefix for configuration | `st.set_page_config` |

### Parameter Names

| Convention | Examples |
|------------|----------|
| `label` for display text | Not `title`, `name`, `text` |
| `body` for content | Markdown/text content |
| `value` for initial/default value | Not `default` |
| `options` for choices | Not `items`, `choices` |
| `key` for widget identifier | Not `id`, `name` |
| `help` for tooltips | Not `tooltip`, `hint` |
| `on_X` for callbacks | `on_change`, `on_click`, `on_submit` |

### Boolean Parameters

- Use positive names: `disabled` not `enabled`
- Default to `False` when feature is additive
- Default to `True` when feature is standard behavior

### Type Literal Values

Use lowercase strings:

```python
# Good
type: Literal["primary", "secondary"]
visibility: Literal["visible", "hidden"]

# Avoid
type: Literal["Primary", "SECONDARY"]
```

---

## Documentation Standards

### Docstring Format

Use NumPy-style docstrings:

```python
def button(
    self,
    label: str,
    ...
) -> bool:
    r"""Display a button widget.

    Parameters
    ----------
    label : str
        A short label explaining to the user what this button is for.
        The label can optionally contain GitHub-flavored Markdown of the
        following types: Bold, Italics, Strikethroughs, Inline Code, Links,
        and Images.

        See the ``body`` parameter of |st.markdown|_ for additional,
        supported Markdown directives.

        .. |st.markdown| replace:: ``st.markdown``
        .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

    key : str or int
        An optional string or integer to use as the unique key for the widget.
        If this is omitted, a key will be generated for the widget
        based on its content. No two widgets may have the same key.

    Returns
    -------
    bool
        True if the button was clicked on the last run of the app,
        False otherwise.

    Examples
    --------
    **Example 1: Basic usage**

    >>> import streamlit as st
    >>>
    >>> if st.button("Say hello"):
    ...     st.write("Hello!")

    .. output::
       https://doc-button.streamlit.app/
       height: 300px

    """
```

### Documentation Requirements

1. **Brief description**: First line explains what the element does
2. **Parameters section**: All parameters documented
3. **Returns section**: Return type and meaning
4. **Examples section**: Working code examples with output links

### Parameter Documentation Patterns

For Literal types, list all values:

```python
type : "primary", "secondary", or "tertiary"
    An optional string that specifies the button type. This can be one
    of the following:

    - ``"primary"``: The button's background is the app's primary color.
    - ``"secondary"`` (default): Coordinates with app background.
    - ``"tertiary"``: Plain text without border or background.
```

For icon parameters:

```python
icon : str or None
    An optional emoji or icon to display. If ``icon`` is ``None``
    (default), no icon is displayed. If ``icon`` is a string, the
    following options are valid:

    - A single-character emoji. For example, ``icon="🔥"``.
    - An icon from the Material Symbols library in the format
      ``":material/icon_name:"``.
    - ``"spinner"``: Displays a spinner as an icon.
```

---

## Deprecation Process

### Timeline

1. **Deprecation announcement**: Warning shown for 3+ months
2. **Removal date**: Published in warning message
3. **Breaking change**: After removal date

### Implementation

Use `deprecate_func_name` for renamed functions:

```python
experimental_get_query_params = _deprecate_func_name(
    _get_query_params,
    "experimental_get_query_params",
    "2024-04-11",  # Removal date
    "Refer to our docs page for more information.",
    name_override="query_params",
)
```

### Deprecation Warning Format

```
Please replace `st.old_name` with `st.new_name`.

`st.old_name` will be removed after 2024-04-11.

[Additional migration guidance]
```

---

## Implementation Patterns

### Mixin Pattern

Elements are implemented as mixins combined in `DeltaGenerator`:

```python
class ButtonMixin:
    @gather_metrics("button")
    def button(self, ...) -> bool:
        ...

class DeltaGenerator(
    ButtonMixin,
    TextMixin,
    LayoutsMixin,
    ...
):
    ...
```

### Metrics Gathering

All public methods use `@gather_metrics`:

```python
@gather_metrics("button")
def button(self, ...) -> bool:
    ...
```

### Widget Registration

Widgets must register with the framework:

```python
widget_state = register_widget(
    element_type="button",
    element_proto=button_proto,
    ctx=ctx,
    ...
)
```

### Serialization/Deserialization

Widgets use Serde classes for state management:

```python
@dataclass
class ButtonSerde:
    def deserialize(self, ui_value: bool | None) -> bool:
        return ui_value or False
```

### Validation

Use dedicated validation functions:

```python
maybe_raise_label_warnings(label, label_visibility)
check_widget_policies(...)
validate_width(width)
```

### Protobuf Communication

Elements communicate via Protocol Buffers:

```python
button_proto = ButtonProto()
button_proto.label = label
button_proto.disabled = disabled
# ...
return self.dg._enqueue("button", button_proto)
```

---

## Configuration vs Code APIs

Some features are better expressed in configuration than code:

### When to Use Config (config.toml/secrets.toml)

| Use Config For | Examples |
|----------------|----------|
| App-wide settings | Theme colors, layout mode, page config |
| Deployment-specific | Database URLs, API keys |
| Rarely-changed values | Company branding, default language |

```toml
# config.toml
[theme]
primaryColor = "#FF6B6B"
borderRadius = "full"

[theme.light]
backgroundColor = "#FFFFFF"

[theme.dark]
backgroundColor = "#1E1E1E"
```

### When to Use Code APIs

| Use Code For | Examples |
|--------------|----------|
| Dynamic behavior | Conditional theming, runtime decisions |
| User-facing | `st.set_page_config()` for page title |
| Programmatic access | `st.context.theme.type` to read theme |

### Inheritance in Config

Config sections should support inheritance to reduce repetition:

```toml
[theme]  # Base settings for both light and dark
borderRadius = "full"
font = "Arial"

[theme.light]  # Inherits from [theme]
primaryColor = "#8B0000"

[theme.dark]  # Inherits from [theme]
primaryColor = "#FFCCCB"
```

---

## Design Checklist for New Commands

### Before Implementation

- [ ] Does this command fit an existing category?
- [ ] What are the most common use cases?
- [ ] What should the simplest call look like?
- [ ] Is there an existing similar command to model after?

### Signature Design

- [ ] First parameter is the primary data/content
- [ ] `key`, `help` in standard position
- [ ] Callbacks follow widget callback pattern
- [ ] Styling/enhancement params are keyword-only
- [ ] Defaults minimize required arguments

### Typing

- [ ] All parameters have type annotations
- [ ] Return type is annotated
- [ ] Overloads for conditional return types
- [ ] Generic types for option-based widgets

### Documentation

- [ ] NumPy-style docstring
- [ ] All parameters documented
- [ ] Return value explained
- [ ] Examples with output links
- [ ] Literal values listed individually

### Testing

- [ ] Unit tests for all code paths
- [ ] Type tests for public API
- [ ] E2E tests for UI behavior

---

## Quick Reference

### Standard Widget Parameters Order

1. `label` (positional)
2. Type-specific params (positional OK)
3. `key` (positional OK)
4. `help` (positional OK)
5. `on_change`, `args`, `kwargs`
6. `*` (keyword-only separator)
7. Visual customization (`placeholder`, `icon`)
8. State modifiers (`disabled`)
9. Label control (`label_visibility`)
10. Layout (`width`, `height`)

### Common Return Types

| Category | Return |
|----------|--------|
| Display element | `DeltaGenerator` |
| Boolean widget | `bool` |
| Text widget | `str` or `str \| None` |
| Selection widget | `T` (generic) |
| Container | `DeltaGenerator` |
| Control flow | `NoReturn` |

### Common Literal Values

| Parameter | Values |
|-----------|--------|
| `type` (button) | `"primary"`, `"secondary"`, `"tertiary"` |
| `label_visibility` | `"visible"`, `"hidden"`, `"collapsed"` |
| `width`/`height` | `"stretch"`, `"content"`, `int` |
| `gap` | `"small"`, `"medium"`, `"large"` |
| `alignment` | `"left"`, `"center"`, `"right"`, `"distribute"` |
