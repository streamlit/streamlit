# Streamlit Specs Guide

This directory contains product and tech specs for Streamlit features.

Key files:

- `YYYY-MM-DD-template/product-spec.md` — Template for product specs
- `YYYY-MM-DD-template/tech-spec.md` — Template for tech specs
- `README.md` — Full process documentation

## When to Write a Spec

**Product spec** — focuses on _what_ and _why_: user-facing problem, proposed API, design
mockups, and behavior. Write one when:

- Proposing a new user-facing feature or significant API change
- The _what_ and _why_ need alignment before implementation begins
- Design mockups or UX decisions need sign-off

**Tech spec** — focuses on _how_: internal architecture, proto changes, frontend/backend
design, state management, and alternatives considered. Write one when:

- The feature is non-user-facing but architecturally significant
- The _how_ needs alignment before implementation (e.g., proto design, state management)
- Multiple implementation paths exist with meaningful trade-offs to document

**Does not require a spec:**

- Bug fixes, DevOps improvements, small non-controversial enhancements

A single spec directory can contain both a `product-spec.md` and a `tech-spec.md` if the
feature warrants both. The directory can also include other assets relevant to the spec
(e.g., design mockups, diagrams, supporting documents).

## Creating a Spec

1. Copy `specs/YYYY-MM-DD-template/` → `specs/YYYY-MM-DD-feature-name/`
2. Fill in `product-spec.md` and/or `tech-spec.md` following the template
3. Create PR titled `[spec] Feature name` (keep in Draft until ready for review)

## Spec Guidelines

### Problem First, Solution Second

Never start with what you want to build. Start with **why**:

- Link GitHub issues
- Show concrete user pain points and current workarounds
- Include use cases

### Present Options, Not Edicts

For non-trivial APIs, show 2-3 options with tradeoffs:

```markdown
**Option 1: New parameter** ✅ PREFERRED
- Pros: Clear, explicit
- Cons: New param on every widget

**Option 2: Extend existing parameter**
- Pros: No new params
- Cons: Overloads existing meaning
```

### Start Minimal, Document Out-of-Scope

Ship the smallest useful API. Explicitly list what you're NOT including:

```markdown
## Out of Scope (Future Work)
- `sparkline_type` parameter — can add later based on user feedback
- Clickable cards — only 3 upvotes, revisit if demand grows
```

### Show Code, Not Just Words

Every API needs concrete examples showing simplest usage first, then progressive complexity.

### Specify the Behavioral Contract

A correct signature is not a complete spec. For any interactive or stateful feature,
document its behavioral contract:

- **State**: identity, scope, source of truth, initialization, reset, persistence when not
  rendered, and cleanup
- **Interaction**: whether values are persistent or one-rerun triggers; rerun and callback
  ordering, coalescing, and cancellation
- **Defaults**: default values and precedence rules
- **UI states**: loading, empty, error, disabled, and retry
- **Accessibility**: keyboard, focus, screen-reader naming, reduced motion
- **Security & privacy**: what data crosses to the frontend; trust boundaries
- **Performance**: limits and scaling behavior
- **Compatibility**: behavioral compatibility and platform degradation

See principles #39–#46 and the Product Principles section below for the rationale behind
each of these.

### Keep It Concise

Specs should cover the most important aspects without redundancy. Avoid repeating the same
information in multiple sections. If something is explained once, reference it rather than
restating it. Reviewers' time is valuable—make every sentence count.

## Reference Existing Specs

**Always review existing specs before writing a new one.** Study specs in `specs/` to match
the established style and structure.

---

# Principles of Streamlit API Design

These principles guide the design of Streamlit's public API. Follow them when proposing
new features or modifying existing commands.

They fall into two groups. Principles 1–38 mostly govern API *shape*—naming, types,
defaults, and composition. Principles 39–46, plus the Product Principles that follow,
govern *behavioral contracts* and product quality—how state, interactions, reruns,
compatibility, failures, accessibility, and security behave. A spec isn't done when the
signature looks right; it's done when the behavioral contract is specified too.

## 1. Simplicity First

The most common use case should require the fewest arguments. A user should be able to
call `st.button("Click")` and have it work beautifully without reading documentation.

## 2. Progressive Disclosure

Start with what's essential, reveal complexity only when needed. Parameters flow from
required to common to advanced, with the `*` separator marking the boundary to
keyword-only arguments.

## 3. Sensible Defaults

Every optional parameter should have a default that works for 80% of use cases. Users
shouldn't need to specify `disabled=False` or `width="stretch"` explicitly.

Defaults may be context-aware: use `None` to mean "Streamlit derives the value" (as in
`lazy=None`, `wrap=None`, `hide_index=None`, `resolution=None`) rather than forcing a
choice up front. When a default is derived, keep a deterministic precedence—an explicit
user value always wins, then a type/context default, then the base default—and let users
both accept the derived value (`None`) and force it off (`""`), as `st.text_input` does
for `icon`, `placeholder`, and `validate` on typed inputs.

## 4. Start Minimal, Ship Fast

Launch with the smallest useful API. You can always add `sparkline_type="bar"` later,
but you can never remove it. Every parameter is a maintenance burden. When in doubt,
leave it out—user feedback will tell you what's actually needed.

## 5. Consistency Over Novelty

Similar elements should have similar APIs. Once a user learns `st.selectbox`, they
should intuitively understand `st.radio` and `st.multiselect`. Resist the urge to
innovate on parameter names or orders.

## 6. Explicit Over Implicit

Use clear, descriptive parameter names. Prefer `selection_mode="multi-row"` over a
cryptic `multi=True`. Use `Literal` types to enumerate valid options rather than
accepting arbitrary strings.

## 7. Standardized Vocabulary

Use consistent parameter names across the API:

- `label` (not `title`)
- `key` (not `id`)
- `help` (not `tooltip`)
- `on_change` (not `callback`)

This vocabulary is sacred, and it's broader than these four names. Widgets share a
canonical chrome—`label`, `key`, `help`, `disabled`, `label_visibility` (`"visible" |
"hidden" | "collapsed"`), and `on_change`/`on_click` with `args`/`kwargs`—and a single
sizing system: `width`/`height` accept `"stretch"`, `"content"`, or a pixel count (this
replaced the older `use_container_width` boolean). Reuse `border`, `icon`, and `type` with
their established meanings rather than inventing synonyms.

## 8. Semantic Names Over Geeky Names

Names should be understood by typical English speakers, not just developers. Prefer
human-readable terms over technical jargon.

```python
# Good: Semantic, obvious
st.title("Welcome")
st.sidebar
st.columns(3)

# Bad: Geeky, requires HTML knowledge
st.h1("Welcome")
st.aside
st.grid(cols=3)
```

## 9. Match User Expectations

If `st.file_uploader` has `accept_multiple_files`, then `st.selectbox` should have
`accept_new_options`, not `allow_custom` or `creatable`. Users learn patterns, and new
features should leverage (not fight) that learning.

## 10. Same Name, Same Behavior

When a parameter name appears in multiple commands, it must behave identically. If
`help` shows a tooltip in `st.button`, it must show a tooltip in `st.selectbox`. If
`disabled` accepts a boolean in one widget, every other `disabled` parameter should
also accept a boolean with the same semantics. Users shouldn't need to re-learn
parameters per command.

```python
# These should all work the same way
st.button("Go", help="Click me", disabled=False)
st.selectbox("Pick", options, help="Pick one", disabled=False)
st.text_input("Name", help="Enter name", disabled=False)
```

## 11. Patterns Are Sacred

When a pattern exists, follow it religiously. If callbacks use `on_change`, `args`,
`kwargs` everywhere, don't introduce `callback`, `callback_args` in a new widget. If
containers use `border=True`, don't use `show_border=True`. Pattern violations create
cognitive load that compounds across the API.

## 12. Type Safety Without Burden

Provide precise type annotations that enable IDE autocompletion and catch errors early.
Use `@overload` to narrow return types based on input, but never sacrifice usability for
type purity.

## 13. Predictable Return Types

Users should know what to expect: display elements return `DeltaGenerator` (for
chaining), widgets return their value type, and control flow commands use `NoReturn`.

Some commands return specialized handles instead—stateful containers (`st.expander` and
`st.status` return objects with extra properties like `.open`), placeholders, or structured
event state. When they do, the handle must expose meaningful operations and have a stable,
documented public type, not an incidental internal class (see #45).

## 14. Type Preservation

Generic types flow through the API. When a user passes `options=["a", "b", "c"]` to
`st.selectbox`, the return type is `str`. When they pass a list of custom objects, they
get their object type back. The type system should help, not hinder.

## 15. Default Null Over Default Error

When a value can't be determined, return `None` rather than raising an exception.
`st.context.ip_address` returns `None` behind a proxy rather than failing. This lets
users write `if st.context.ip_address:` rather than wrapping everything in try/except.

## 16. Prefer Enums Over Booleans

Booleans limit future expansion. Use `Literal` types (string enums) for any parameter
that might grow beyond two states. A boolean locks you into adding more booleans; an
enum extends gracefully.

```python
# Bad: Boolean limits expansion
st.text_input("Password", password=True)
# What if we want "email" type later? Another boolean?

# Good: Enum allows expansion
st.text_input("Password", type="password")
st.text_input("Email", type="email")  # Easy to add later
st.text_input("Phone", type="phone")  # And again
```

Exception: `disabled=True/False` is fine because there will never be a third state.
`bool | None` is also fine when there are exactly two explicit choices plus an
automatic/derived default, with `None` meaning "derive" (see #3). The canonical enum in
Streamlit is the interaction protocol `"ignore" | "rerun" | callable`, shared by
`on_select`, container `on_change`, and `on_dismiss` (see #40).

Note the semantic-naming rule (#8) still applies to enum values: when that type ships, the
public value is `type="phone"`, even though it maps to an HTML `<input type="tel">` (see the
text-input-types product spec).

## 17. Positional Arguments Are Precious

Only the 1-3 most essential parameters should be usable positionally. Everything else
goes after the `*` separator as keyword-only. Positional slots are limited; once taken,
they can never change order. Reserve them for `label`, `body`, `options`—not `disabled`
or `icon`.

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

## 18. Extend Before Inventing

Prefer adding parameters to existing commands over creating new ones. Adding `sparkline`
to `st.metric` is better than a new `st.metric_with_sparkline`. Adding
`accept_new_options` to `st.selectbox` is better than `st.creatable_selectbox`.
Extension preserves user mental models.

## 19. Design for Composition

Features should work together naturally. `st.badge` doesn't need a `multiple` parameter
because `st.container(horizontal=True)` handles layout. Don't duplicate functionality
across commands—let users compose primitives.

## 20. One Use Case, One Command

Each command should serve a specific, well-defined use case. If you're trying to cover
two distinct use cases, you probably need two commands. `st.tabs` is for paginating
content within a page, not for navigation—that's what `st.navigation` is for.

## 21. Flat Namespace, Rare Submodules

Keep most commands in the flat `st.*` namespace—it's what makes Streamlit feel easy.
Only use submodules for:

- Extension APIs developers won't use directly (`st.components.v1`)
- Peripheral APIs used around apps, not in them (`st.testing.v1`)
- Large groups (10+) of specialized commands (`st.column_config`)

## 22. User-Focused Documentation

Docstrings are for users, not implementers. Document what each parameter does and when
to use it, not how it's implemented internally. Every `Literal` value deserves its own
bullet point explanation.

## 23. Fail Fast, Fail Helpfully

Validate parameters immediately and raise clear, actionable exceptions. Users should
never see cryptic errors or silent failures. Error messages should explain what went
wrong AND how to fix it.

## 24. Leverage Markdown Everywhere

Wherever text is displayed, support Streamlit's markdown rendering. Labels, help
tooltips, captions, and body text should all accept markdown syntax including bold,
italics, links, code, emoji, and Material icons. This gives users rich formatting
without separate styling APIs.

```python
# Users get formatting for free
st.button("**Submit** :material/send:", help="Click to *submit* your data")
st.metric(label="Revenue :material/trending_up:", value="$1.2M")
```

## 25. Graceful Evolution

APIs age; deprecate thoughtfully. Provide 3+ months warning, clear migration paths, and
helpful error messages. Never break working code without ample notice and documentation.

## 26. Minimize Migration Distance

New features should require minimal changes to existing apps. When users upgrade, their
code should mostly just work. If a feature requires significant refactoring (like early
Multipage Apps did), it creates adoption friction and fragments the ecosystem between
"old style" and "new style" apps.

Migration distance includes runtime behavior, not just code changes: a new parameter's
default should preserve today's behavior so upgrades are silent (see #42).

```python
# Good: Additive feature
# Old code still works:
st.selectbox("Pick", options)
# New feature is opt-in:
st.selectbox("Pick", options, accept_new_options=True)

# Bad: Breaking change requiring refactor
# Old: st.experimental_memo  ->  New: @st.cache_data (migration required)
```

## 27. Pythonic Idioms

Embrace Python's native patterns: context managers for scoping (`with st.container():`),
decorators for behavior modification (`@st.cache_data`), generators for streaming
(`st.write_stream`). Don't invent new paradigms when Python already has elegant
solutions.

## 28. Composable Containers

Containers return `DeltaGenerator` objects that can be used with `with` statements OR
via method chaining. Both patterns should work identically: `with st.sidebar:` and
`st.sidebar.write()` are equally valid.

## 29. Embrace the Python Ecosystem

Accept the data types users already work with. If it's array-like, accept NumPy arrays,
Pandas Series, lists, tuples, and sets. If it's dataframe-like, accept Pandas, Polars,
PyArrow, and anything with a compatible interface. Don't force users to convert their
data.

```python
# All of these should work for options:
st.selectbox("Pick", ["a", "b", "c"])  # list
st.selectbox("Pick", ("a", "b", "c"))  # tuple
st.selectbox("Pick", {"a", "b", "c"})  # set
st.selectbox("Pick", np.array(["a", "b", "c"]))  # numpy
st.selectbox("Pick", pd.Series(["a", "b", "c"]))  # pandas
```

Beyond data types, prefer established Python, web, and platform standards over bespoke
Streamlit dialects, and lean on native affordances when they come for free: `type="email"`
sets the HTML input type so mobile keyboards and autofill work automatically, `st.App`
follows the ASGI/Starlette shape, and new format syntax is added compatibly alongside the
old rather than forcing a migration.

## 30. Drop-In Replacement for Scripts

Streamlit code should feel like a natural evolution of a Python script. Converting from
script to app should require minimal changes—swap a variable for a slider, swap
`open(file)` for `st.file_uploader()`.

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

## 31. Declarative Over Imperative

Streamlit is a declarative framework—users describe *what* they want, not *how* to build
it. Command names should be nouns (`st.button`, `st.chart`, `st.container`) that declare
UI elements, not verbs that describe actions. Reserve verbs for true actions (`st.rerun`,
`st.stop`, `st.write`).

## 32. Commands Are Non-Blocking

Input widgets never block script execution. Code after an `st.text_input()` always runs,
even before the user types anything. This differs from traditional `input()` which halts
until the user responds. Users must learn to think in terms of "the script runs
top-to-bottom on every interaction."

```python
name = st.text_input("Name")  # Does NOT block
st.write(f"Hello {name}")  # Always runs (name may be "")
```

This applies to widgets inside a script run. A few launcher commands are deliberately
blocking—`App.run()` starts a server and blocks until stopped—but those run outside the
script-execution model.

## 33. Deterministic Output

Given the same code and state, the UI should be identical. Streamlit reruns the entire
script on each interaction, so commands must produce consistent output when called with
the same arguments and session state. Avoid hidden state, random defaults, or
time-dependent behavior that would make reruns unpredictable.

```python
# Good: Deterministic - same inputs produce same UI
st.selectbox("Pick", ["a", "b", "c"], index=0)

# Bad: Non-deterministic - UI changes on each rerun
st.selectbox("Pick", ["a", "b", "c"], index=random.randint(0, 2))
```

Note: The UI *can* change based on `st.session_state` or widget values—that's expected.
The principle is that the *same* state should always produce the *same* output.

## 34. One Rerun Per Interaction

Each user interaction should trigger at most one script rerun. Uploading 10 files at
once = one rerun. Uploading 10 files one at a time = 10 reruns. Dragging a slider = one
rerun when released, not continuous reruns while dragging. (Exception: explicit
`st.rerun()` calls in code can trigger additional reruns.)

## 35. Avoid "Clever But Too Clever"

An API like `key="?foo"` to bind to query params is elegant but hard to discover and
confusing in programmatic use. Explicit parameters like `bind="query-params"` are more
verbose but clearer. When weighing options, bias toward discoverability over cleverness.

## 36. Design for All Platforms

Every feature needs to work (or gracefully degrade) on: local development, Community
Cloud, SiS (SPCS), embedded iframes, and mobile. Document platform-specific behavior
explicitly. `st.context.ip_address` returns `None` on SiS—that's a valid design choice.

## 37. Consider the Frontend-Backend Split

Some data lives in the browser (theme type, viewport size) and some on the server
(config, session state). APIs like `st.context.theme.type` require frontend-to-backend
communication on every rerun. Understand the performance implications before committing
to an API shape.

## 38. Config vs Code: Environment vs Behavior

Use `config.toml` for settings that vary by deployment environment or apply across
multiple apps. Use `st.*` commands for everything else.

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

There is also a third channel: credentials and secrets. API keys, connection credentials,
and auth settings belong in `secrets.toml` / `st.secrets` (and `st.login` / `st.user`),
never in source code or casual public parameters. Explicit launcher or embedding
configuration is a justified exception to "environment settings live in config"—e.g.
`App.run(config=...)` for self-contained launchers—as long as ownership and precedence are
documented.

## 39. State Has Identity, Scope, and a Lifecycle

Every stateful thing—widget values, event payloads, cached results, connections, and
background resources—must define its identity, source of truth, scope, and lifecycle.
Identity comes from `key`, not position: an explicit `key` is what lets a widget survive
remounts, be addressed programmatically, and expose a `st-key-<key>` CSS hook. Scope is
explicit and layered: a rerun (`st.rerun(scope="app" | "fragment")`), a page or session
(`persist_state="page" | "session"`), or a session vs. global process
(`st.cache_resource(scope="session" | "global")`). Widgets return their value for script
flow *and*, when given a `key`, mirror it in `st.session_state[key]` (some, like buttons,
are read-only there). Specify initialization, reset, persistence-when-not-rendered, and
cleanup (e.g. `on_release`) rather than leaving them implicit.

## 40. Interaction Semantics Are Part of the API

An interactive command's signature is only half its contract. Also specify: whether its
value is persistent state or a one-rerun trigger (a button's click is only `True` on the
run it triggered); when a frontend change becomes visible to Python; whether the
interaction reruns and at what scope; and callback ordering, coalescing, and cancellation.
Streamlit has a shared interaction protocol for event and selection surfaces—
`"ignore" | "rerun" | callable`—used consistently by `on_select` (charts, dataframe),
container `on_change`, and `on_dismiss` (dialogs). Value widgets use `on_change` with
`args`/`kwargs`; action widgets use `on_click`. Callbacks run at the start of a rerun,
before the script body.

## 41. Re-evaluate, Don't Mutate

Streamlit updates the UI by re-running code, not by mutating live elements. Don't expose
imperative element handles or `.update(data)`-style setters; instead, let a targeted rerun
re-evaluate a region from current state (as event-scoped fragment reruns do). The narrow
exceptions are container chrome and placeholders—`st.status.update()` adjusts a container's
own label and state, and an `st.empty()` placeholder holds a single, replaceable child—not
the rendered data of arbitrary elements. Data that must cross a scope boundary lives in
`st.session_state`, because a fragment-scoped rerun doesn't re-execute the surrounding
script. This keeps the UI a pure function of state (see #31, #33) and rules out
partial-mutation APIs that would break determinism.

## 42. Behavioral Compatibility Is API Compatibility

An additive signature is not automatically backward compatible. Compatibility also covers
defaults, rerun scope and count, state persistence, callback ordering, side effects, focus
and scroll behavior, and visual layout. A new parameter's default must reproduce today's
behavior—`filter_mode="fuzzy"`, `resolution=None`, `parallel=False`, `submit_mode="submit"`,
`refresh_mode="foreground"`, and container `on_change="ignore"` were all chosen so existing
apps behave identically after an upgrade. When a change alters behavior by design (e.g.,
Markdown Mermaid fences), call it out explicitly and provide an escape hatch.

## 43. Never Give Misleading Partial Results

When a command can't deliver complete semantics, disable the operation, fail helpfully, or
expose best-effort behavior explicitly—never silently operate on partial data while
presenting it as complete. Lazy dataframes disable search rather than search only the
loaded chunks; camera input returns the resolution actually captured; cross-origin iframes
fall back to a fixed height when they can't be measured. Document what a feature does *not*
do—platform limits, hardware variance, threading caveats—as clearly as what it does.

## 44. Contain Failures

One failing part must not take down the rest. A broken diagram, a raising fragment, or a
failed background cache refresh should render an inline, isolated error while siblings keep
working. User-provided hooks—error handlers, callbacks, background refreshers—must never
break the core path: if a handler raises, fall back to default behavior. And control-flow
signals like `st.stop()` and `st.rerun()` are not errors; never route them through error
handling.

## 45. Values That Cross Boundaries Get Public, Structured Types

When a documented command produces a Streamlit-owned value that users reasonably pass
across functions or module boundaries, give it a stable, importable public type via
`streamlit.typing`—but curate that surface; don't publish every internal alias. Multi-part
results (dataframe and chart selections, `st.data_editor` edits, button-column clicks)
should be returned as structured objects that support both attribute and bracket access
(`event.selection.rows` and `event["selection"]["rows"]`), read-only where assignment is
meaningless. Prefer structured state over positional tuples so results stay self-describing
and extensible.

## 46. Secure by Default

Dangerous capabilities are off until explicitly enabled, and privilege expansion is named,
not silent. Raw HTML and JavaScript require `unsafe_allow_html=True` /
`unsafe_allow_javascript=True`; auth tokens and PII metrics aren't exposed unless
configured; Streamlit never automatically copies secrets into `st.session_state` or the
browser. Credentials are their own channel—`secrets.toml` / `st.secrets` / `st.login` /
`st.user`—not casual public parameters (see #38). And client-side conveniences (regex
validation, the `client.disableDataExport` config) are never trust boundaries: enforce
anything security-relevant on the server.

---

# Product Principles

These complement the API principles above. Where the API principles shape the *interface*,
these describe product qualities every feature should meet regardless of its API shape.

## 1. Accessibility Is First-Class

Keyboard operation, visible focus, accessible names and descriptions, screen-reader
announcements, reduced-motion behavior, and adequate contrast are default requirements—not
follow-ups. Labels are mandatory even when hidden: use `label_visibility="collapsed"`,
never an empty `label` (Streamlit warns today and may raise in the future). Decorative
elements set `aria-hidden`; loading states announce via ARIA and honor
`prefers-reduced-motion`; and layout features like text truncation must not strip content
from the accessibility tree.

## 2. Stay Inside the Visual System

Prefer Streamlit's shared visual vocabulary—theme tokens, `:material/...:` icons, and named
variants like `type="compact"` or `type="primary"`—over custom CSS or overloaded boolean
chrome. When more than the border changes, use `type="compact"`, not `border=False`.
Features should look and feel native and adapt to light and dark themes automatically.

## 3. Design for Developers, Viewers, and Hosts Separately

Three audiences have different needs. Developer-only diagnostics and assistance (full
tracebacks, the install-skills nudge) can be rich locally but must never leak into deployed
or embedded apps. Deployment and environment controls belong to hosts (config and secrets);
app behavior belongs to authors (`st.*`); polished, responsive interaction belongs to
viewers. Scope each capability to the right audience and platform.

## 4. Responsiveness and Continuity

Perceived performance is a feature. Paint stable UI early, reserve layout during loading
(skeletons, fixed-width controls), progressively reveal results, and bound background work.
Reruns must not silently discard user context—focus, scroll position, expanded tabs,
drafts, or selections—and automatic behavior should yield to deliberate user action (for
example, autoscroll pauses when the user scrolls up).
