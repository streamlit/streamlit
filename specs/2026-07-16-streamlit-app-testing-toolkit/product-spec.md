---
author: lukasmasuch
created: 2026-07-16
---

# Streamlit app testing toolkit

## Summary

Provide two complementary, first-party ways to test a Streamlit app:

1. **AppTest** remains the fast, browserless option for app logic, session state, and
   basic widget workflows. We first fix its runtime fidelity, then add strict semantic
   lookup through its existing typed collections, universal cross-tree queries, and a
   compact semantic snapshot for debugging and AI agents.
2. **`streamlit.testing.e2e`** becomes an optional pytest integration built on
   Playwright for real-browser behavior, rendering, custom components, accessibility,
   media, charts, and critical user journeys. It exposes a Streamlit-aware semantic
   facade for finding and operating elements, stable lifecycle utilities, useful failure
   artifacts, and an escape hatch to Playwright's native browser APIs.

The two layers share a **testability vocabulary**, not an artificially identical API:
public Streamlit element types, labels, keys, containers, and interaction capabilities.
The E2E implementation owns the private DOM knowledge needed to translate that vocabulary
into Playwright locators and actions. Streamlit's own E2E suite should use the public
facade wherever possible, while implementation-specific rendering tests can keep private
helpers.

**Recommendation:** invest in both existing approaches, with clearer boundaries. Do not
build a third UI-testing engine, do not turn AppTest into a browser emulator, and do not
publish `e2e_playwright/shared` as-is.

## Problem

Streamlit users currently face an unhelpful choice:

- AppTest is fast and Python-native, but can disagree with a real app and requires
  positional queries for most elements.
- Browser testing can validate the real product, but Streamlit provides no supported
  way to start the app, wait for reruns, select elements, collect logs, or test a
  deployed/embedded app. Users must assemble and maintain that infrastructure.
- The mature Playwright infrastructure in `e2e_playwright/` is coupled to Streamlit's
  repository layout and private DOM details, so copying it is not a viable public API.

This is especially costly for AI coding agents. An agent can edit an app quickly, but it
needs a deterministic command, semantic element identity, a compact description of the
current UI, and actionable failure artifacts to validate its work reliably. Indexes,
private CSS structure, sleeps, and screenshots alone are poor machine interfaces and
produce brittle tests for humans too.

### AppTest audit

AppTest directly runs a `ScriptRunner`, converts emitted protobuf deltas into a Python
`ElementTree`, synthesizes `WidgetState` messages, and creates a new local runner for
subsequent runs. It does not run Streamlit's React frontend or reproduce all frontend
tree, widget, fragment, and actionability behavior.

As of this spec (July 2026, Streamlit 1.58) — all counts below are point-in-time
snapshots that will drift as the codebase evolves:

- There are **13 open issues** with the
  [`feature:app-testing`](https://github.com/streamlit/streamlit/issues?q=is%3Aissue%20state%3Aopen%20label%3Afeature%3Aapp-testing)
  label, with 75 total thumbs-up reactions. Five are confirmed bugs.
- The highest-signal issue is
  [#9786](https://github.com/streamlit/streamlit/issues/9786) (24 thumbs-up), where a
  dialog interaction works in a browser but not in AppTest.
- `parse_tree_from_messages` explicitly dispatches 31 of the 55 current `Element.proto`
  variants. Other variants fall through to `UnknownElement`, which has no `key`, assumes
  a generic `value`, and cannot simulate interactions.
- `Block.proto` has 12 block variants, while AppTest has specialized handling for four.
  Generic `Block.key` always returns `None`, causing
  [#13163](https://github.com/streamlit/streamlit/issues/13163).
- The public API exposes 48 typed element/container collections, but most retrieval is
  still based on position (`at.button[0]`). Only widgets support lookup by `key`, through
  a callable `WidgetList`.
- The capability list is maintained manually. The current cheat sheet still labels its
  limitation list "As of Streamlit 1.28" and lists several elements that the current
  implementation has since added. Users cannot easily tell whether an element is fully
  interactive, only inspectable through its proto, or unsupported.

The open issues cluster around architectural seams, rather than isolated missing
wrappers:

| Problem area | Open issues | What it tells us |
|---|---|---|
| Rerun, tree, and widget-state fidelity | [#9128](https://github.com/streamlit/streamlit/issues/9128), [#9814](https://github.com/streamlit/streamlit/issues/9814), [#12566](https://github.com/streamlit/streamlit/issues/12566) | AppTest can retain stale nodes or serialize widget state that a real frontend has removed. |
| Fragments and dialogs | [#9204](https://github.com/streamlit/streamlit/issues/9204), [#9242](https://github.com/streamlit/streamlit/issues/9242), [#9786](https://github.com/streamlit/streamlit/issues/9786) | Treating every interaction as a fresh full-script run cannot model newer execution scopes reliably. |
| App and test isolation | [#9139](https://github.com/streamlit/streamlit/issues/9139) | Cache/runtime ownership is surprising across tests. |
| Interaction/value parity | [#10550](https://github.com/streamlit/streamlit/issues/10550), [#12844](https://github.com/streamlit/streamlit/issues/12844) | A test can observe the formatted value instead of the app value, or mutate a disabled widget that a user cannot. |
| Paths and multipage apps | [#8154](https://github.com/streamlit/streamlit/issues/8154), [#8429](https://github.com/streamlit/streamlit/issues/8429), [#13909](https://github.com/streamlit/streamlit/issues/13909) | `streamlit run` and AppTest do not consistently resolve the same app root, imports, and pages. |
| Stable selection and scoping | [#13163](https://github.com/streamlit/streamlit/issues/13163) | Dynamic layouts make delta-path/index selection especially brittle. |

Adding more element wrapper classes without fixing these foundations would increase the
maintenance surface without making AppTest trustworthy.

### Internal Playwright audit

Streamlit already has broad real-browser coverage: 217 Playwright test modules at the
time of this audit. The suite solves hard problems that users also have, including app
process lifecycle, ephemeral ports, app-idle detection, screenshots and traces, external
URLs, iframe hosts, browser state, file uploads, dataframes, charts, and visual tests.

However, the current code is an internal framework, not a releasable library:

- `e2e_playwright/conftest.py` infers an app script from the test filename, assumes a
  Streamlit source checkout, and owns many CI-specific fixtures and policies.
- `shared/app_target.py` imports readiness behavior back from that `conftest.py`, so the
  abstraction is not independently packageable.
- `shared/app_utils.py` has 52 `get`/`click`/`select`/`wait`/`expect` helper entry points.
  It is a useful mine of proven behavior, but exporting all of it would commit Streamlit
  to a separate public method for every widget instead of a small set of consistent
  cross-widget capabilities.
- 170 of the 217 E2E modules import `shared.app_utils`. There are approximately 2,105
  `get_by_test_id` calls versus 343 `get_by_role` calls in test modules. Those internal
  `st*` test IDs are useful when testing implementation details but are not the
  user-facing semantic contract Playwright recommends for application tests.
- Complex helpers often know private DOM structure, portals, virtualized controls, and
  implementation test IDs. Minor frontend refactors can break them even when user
  behavior is unchanged.

The public product should extract lifecycle, readiness, stable app identity, artifacts,
and the proven private logic needed for semantic selection and common interaction
families. It should not expose repository conventions, internal selectors, screenshot-
baseline machinery, performance reporting, or the whole set of element-specific helpers.

### Prior art and lessons

- [Testing Library queries](https://testing-library.com/docs/queries/about/) make strict,
  semantic selection the default and distinguish current lookup from async lookup. The
  principle is valuable, but its full `get`/`query`/`find` matrix assumes a DOM and should
  not be copied blindly into synchronous AppTest.
- [Playwright locators](https://playwright.dev/python/docs/locators) prioritize roles,
  labels, and visible text, are strict when an action requires one element, and retry
  against the current DOM. Streamlit should preserve those semantics while adding a
  higher-level facade that hides Streamlit's private and sometimes non-standard DOM.
- [Playwright's pytest plugin](https://playwright.dev/python/docs/intro) already provides
  isolated browser contexts, browser selection, and standard failure artifacts.
  Streamlit should compose with it.
- [NiceGUI testing](https://nicegui.io/documentation/section_testing) explicitly offers
  a fast simulated `user` fixture and a slower real-browser `screen` fixture, and
  recommends the simulated tier whenever browser behavior is not needed. This is strong
  precedent for teaching two complementary layers instead of declaring one universal
  test API.
- [Shiny for Python](https://shiny.posit.co/py/docs/end-to-end-testing.html) exposes app
  startup plus Playwright and also maintains typed controllers for many UI components.
  This demonstrates the value of framework-aware interactions, while its large
  per-component surface motivates grouping Streamlit controls by shared capabilities.
- [Dash testing](https://dash.plotly.com/testing) similarly combines pytest fixtures,
  server startup, a browser driver, and an escape hatch to the underlying driver. Its
  docs explicitly keep its custom browser API minimal rather than comprehensive.
- [Playwright MCP](https://github.com/microsoft/playwright-mcp) uses accessibility
  snapshots as a token-efficient interface for agents. Good accessibility semantics and
  the Streamlit facade help this existing ecosystem without making DOM details a public
  contract or creating another browser automation protocol.

## Goals

- Give users an explicit, documented choice between fast browserless tests and
  full-fidelity browser tests.
- Make the common test read like user behavior, without positional selectors or private
  DOM knowledge.
- Make AppTest reliable for the behavior it claims to support and explicit about the
  behavior it cannot support.
- Let a user start and test a local Streamlit app with Playwright using a few lines of
  pytest setup; also support a directly deployed app.
- Let users find all supported elements and containers through stable Streamlit concepts
  such as `key`, `label`, visible text, and public element type, without DOM knowledge.
- Provide consistent interaction methods across controls with the same user behavior,
  including option selection, value entry, clicks, uploads, and container operations.
- Reuse the public E2E lifecycle, selection, and interaction facade in Streamlit's own
  test suite.
- Give AI agents semantic snapshots and actionable text/log/trace artifacts that are
  compact enough to inspect and stable enough to act on.
- Ensure new Streamlit elements declare their AppTest and browser-test capabilities as
  part of implementation, rather than silently falling through a generic class.

## Non-goals

- Making AppTest reproduce CSS, layout, accessibility, browser APIs, custom-component
  JavaScript, chart rendering, or media playback.
- Replacing Playwright's browser contexts, tracing, code generator, or full browser API.
  The Streamlit facade complements Playwright and exposes its `Page` and `Locator` when
  advanced browser behavior is needed.
- Guaranteeing that every internal E2E test can use only public helpers. Streamlit must
  still test private rendering and protocol details.
- Adding a `test_id` parameter to every Streamlit command. Existing `key` is the explicit
  identity primitive and should be extended before another parameter is invented.
- Making browser binaries a required Streamlit dependency.
- Treating screenshots as the primary assertion format. They remain useful for visual
  regressions, not for most behavior tests or agent interaction.

## Proposal

### 1. Publish one testing strategy with three levels

Documentation should begin with a decision table, not with an API reference:

| Test target | Recommended tool | Browser | Typical use |
|---|---|---:|---|
| Pure Python/business logic | pytest | No | Data transforms, model calls, validation, permissions. |
| Streamlit script behavior | AppTest | No | Smoke tests, session-state branches, basic inputs and outputs, deterministic app logic. |
| User-visible app behavior | `streamlit.testing.e2e` + Playwright | Yes | Critical journeys, fragments/dialogs, navigation, accessibility, custom components, charts/media, uploads/downloads, layout, and deployed apps. |

AppTest is not a "unit test" in the strict sense: it executes a Streamlit script and
parts of its runtime. Calling it a **browserless app test** avoids promising unit-test
isolation or browser parity. E2E docs should state the cost (browser install and slower
startup) and recommend a small number of high-value journeys, backed by many plain unit
tests and focused AppTests.

The real browser is the source of truth for user-visible behavior: rendering,
accessibility, browser APIs, frontend state, and complete user journeys. This does not
make E2E the default for every test. Documentation should recommend plain pytest or
AppTest whenever the behavior under test does not depend on a browser, reserving E2E for
the smallest valuable set of browser-dependent and critical-path scenarios.

### 2. Stabilize AppTest before broadening its query API

AppTest's first milestone is fidelity, not new syntax.

Required behavior:

- An AppTest instance owns one isolated app session across its runs. Tree staleness,
  widget cleanup, trigger reset, forms, callbacks, fragment-scoped interactions, and
  dialogs follow the same externally observable lifecycle as a browser session.
- A new AppTest instance starts with isolated caches, resources, session state, secrets,
  pages, and runtime globals by default. Any future shared-cache test fixture must be
  explicit.
- `from_file` resolves the app root, `sys.path`, config, pages, and relative assets like
  `streamlit run` does. Multipage tests start from the entrypoint and navigate to a page;
  a page file is not misidentified as an independent app entrypoint.
- Widget interactions use the same serialize/deserialize path as production. AppTest
  returns the Python option value, not only its formatted label, and rejects interactions
  that a browser would reject (for example, changing a disabled input).
- Every successful run produces the current tree. Nodes omitted by a completed full or
  fragment run are pruned with the same scope rules as the frontend.
- Unsupported interaction raises a dedicated, actionable error that recommends the E2E
  layer. It must not silently mutate state in a way a user cannot.

The implementation may use a longer-lived in-memory runtime/client or a more faithful
protocol-tree model. That is a tech-spec decision. The product requirement is parity for
the supported lifecycle, verified by running the same scenarios against AppTest and a
real browser.

### 3. Add typed semantic AppTest queries

Keep all existing `at.button[0]`, `at.button("save")`, `at.button(key="save")`, and
`at.get("button")` behavior for compatibility. Extend the existing typed collections so
the element type is expressed once and preserved in the return type:

```python
import re

at.text_input(label="Your name") -> TextInput
at.button(label="Save") -> Button
at.markdown(text=re.compile("Revenue")) -> Markdown
at.container(key="filters") -> Block
```

Positional arguments to callable widget collections retain their existing `key`
semantics. New `label`, `text`, and `exact` filters are keyword-only and are available
only where they are meaningful for that typed collection. All singular typed lookups
are strict: zero or multiple matches raise `AppTestLookupError` with the query, scope,
closest candidates, and a compact semantic tree.

The callable spelling is preferred because widgets already support `at.widget(key)` and
it minimizes migration distance. A tech prototype must verify overloads, autocomplete,
and compatibility for widget, display-element, and container collections. If adding a
callable to non-widget collections proves ambiguous, use the same filters through a
typed `.get(...)` method; do not fall back to a universal-only API.

Also add universal queries to `AppTest` and `Block` for cases where the type is unknown,
mixed, or intentionally irrelevant:

```python
get_by_key(key: str) -> Node
get_by_label(
    label: str | Pattern[str],
    *,
    element_type: ElementType | None = None,
    exact: bool = True,
) -> Node
get_by_text(
    text: str | Pattern[str],
    *,
    element_type: ElementType | None = None,
    exact: bool = True,
) -> Node
```

Semantics:

- Each universal method returns exactly one current node and has the same strict failure
  behavior as typed lookup. Strictness prevents a test from silently selecting a
  different element after an app edit.
- `key` is exact and works for widgets, display elements, and containers whenever the
  corresponding command accepts `key`.
- `label` is the command's user-facing `label` (including button text and container
  labels), not an inferred ARIA accessible name.
- `text` searches normalized user-visible textual content represented in the protocol.
  It does not claim to reproduce browser markdown rendering or accessibility naming.
- A regular expression is the preferred way to opt into partial/case-insensitive
  matching. `exact=False` is available for simple substring cases.
- Typed and universal queries can be scoped through containers. Plural selection
  continues to use the typed collections and existing `get()` API in v1.
- Documentation leads with typed queries because they preserve IDE completion, precise
  return types, and the shortest migration from existing AppTest code. Universal
  `get_by_*` methods are the cross-type escape hatch, not the only semantic API.
- A full Testing Library-style `query`/`find` matrix is deferred. AppTest has no DOM that
  changes independently after `run()`, so `find_by_*` would imply waiting behavior that
  does not exist.

Example:

```python
from streamlit.testing.v1 import AppTest

at = AppTest.from_file("app.py").run()

filters = at.container(key="filters")
filters.selectbox(label="Country").select("Japan").run()

assert at.markdown(text="Revenue: ¥12M").value
```

Indexes remain appropriate when order is the behavior under test, such as checking that
three tabs are rendered in a specific order. Documentation should otherwise lead with
semantic queries.

### 4. Add an AppTest semantic snapshot

`AppTest.snapshot()` returns deterministic, compact text containing the visible logical
tree, types, semantic labels/text, values safe to represent, disabled state, user keys,
and container nesting. It excludes protobuf dumps, generated element IDs, and delta paths
unless `include_debug=True`.

Example:

```text
main
  heading "Account" level=1
  container key="filters"
    selectbox "Country" key="country" value="Japan"
  button "Refresh" key="refresh" enabled
  markdown "Revenue: ¥12M"
sidebar
  link "Settings"
```

This snapshot serves three purposes:

- failure diagnostics for strict queries;
- optional text snapshot tests for stable app semantics; and
- a low-token observation format for AI agents.

Snapshot format is versioned and documented. It is not byte-stable across major
Streamlit versions, and tests should prefer focused assertions over whole-app snapshots.

### 5. Replace silent element gaps with a generated capability registry

Every `Element.proto` and `Block.proto` variant must register one of these support levels:

- **Interactive:** semantic inspection plus production-equivalent AppTest interactions;
- **Inspectable:** type, key, public attributes, and meaningful value/data are available,
  but browser-only interaction is not simulated; or
- **Browser-only:** the node is present with type/key and an explicit explanation, and
  interaction directs the user to E2E testing.

The registry generates the docs support matrix and is checked in CI whenever the proto
unions change. `UnknownElement` remains a forward-compatibility fallback, but it emits a
clear unsupported capability instead of pretending a generic `value` is sufficient.

Charts, media, custom components, and other browser-rendered features can often be
inspectable without becoming interactive. This is more useful and maintainable than
writing a bespoke AppTest class for every frontend behavior.

### 6. Add an optional public Playwright integration

Installation:

```bash
pip install "streamlit[testing]"
playwright install chromium
```

`testing` is a developer-only optional extra and is not included in Streamlit's base
dependencies or runtime-oriented `all` extra. Browser binaries remain a separate,
explicit Playwright install.

Packaging options:

- **`streamlit[testing]` with code in `streamlit.testing.e2e` — preferred.** The facade's
  private adapters must evolve in lockstep with Streamlit's frontend, and users get one
  discoverable compatibility/version boundary. The extra installs pytest/Playwright;
  guarded imports keep them out of ordinary Streamlit runtime dependencies.
- **A separate `streamlit-testing` distribution.** This could release independently, but
  introduces a frontend-adapter compatibility matrix and coordinated releases for every
  Streamlit DOM change. Reconsider only if the tooling later needs a substantially
  different release cadence.
- **Documentation/templates only.** This adds no package surface but leaves every user
  responsible for process lifecycle, rerun detection, private selectors, and artifacts;
  it does not solve the core problem.

The namespace is `streamlit.testing.e2e`, rather than
`streamlit.testing.playwright`, because it names the testing purpose instead of making
the underlying driver the long-term public concept. Documentation and types remain
explicit that the initial and expected implementation is Playwright.

Proposed API:

```python
from playwright.sync_api import expect
from streamlit.testing.e2e import StreamlitPage, app_fixture

app = app_fixture("app.py")


def test_sign_in(app: StreamlitPage):
    app.get_element_by_label("Username", type="text_input").set_value("ada")
    app.get_element_by_label("Password", type="text_input").set_value(
        "correct horse battery staple"
    )
    app.get_element_by_label("Sign in", type="button").click()

    welcome = app.get_element_by_text("Welcome, ada", type="heading")
    expect(welcome.locator).to_be_visible()
```

`app_fixture()` creates the pytest fixture named by the assignment, starts one app server
per test module on an ephemeral localhost port, and provides an isolated browser page per
test. The page is opened and the initial Streamlit run is idle before the test begins.
The exact fixture-factory mechanism should be prototyped in a tech spec; the product
requirement is the one-declaration/one-test-argument experience above. If inferring the
name from the assignment target proves to require fragile stack-frame introspection, the
tech spec should fall back to an explicit `name` parameter (for example,
`app_fixture("app.py", name="app")`), which is more predictable at the cost of one
argument.

#### Semantic element selection

`StreamlitPage` exposes strict, retrying finders that understand Streamlit elements and
layout containers:

```python
country = app.get_element_by_key("country", type="selectbox")
country = app.get_element_by_label("Country", type="selectbox")
chart = app.get_element_by_key("revenue-chart", type="vega_lite_chart")
only_chart = app.get_element(type="vega_lite_chart")
metrics = app.get_elements(type="metric")

filters = app.get_element_by_key("filters", type="container")
country = filters.get_element_by_label("Country", type="selectbox")
```

- `get_element_by_key(key, *, type=None)` uses the exact user-provided Streamlit `key`.
- `get_element_by_label(label, *, type=None)` uses element-specific label knowledge;
  it is not limited to HTML `<label>` relationships.
- `get_element_by_text(text, *, type=None)` covers display elements with meaningful
  visible text.
- `get_element(*, type)` requires exactly one rendered element of that type, while
  `get_elements(*, type)` returns a collection for deliberate multi-element inspection.
- `type` is an optional discriminator and assertion. It is useful when labels repeat and
  gives IDE completion through a generated `ElementType` `Literal`.
- Finders are strict by default and return an actionable ambiguity or unsupported-query
  error. They accept strings or regular expressions and retry like Playwright locators.
- A returned `StreamlitElement` can scope further queries when it represents a layout
  container such as a sidebar, form, expander, popover, dialog, tab, column, or generic
  container.

`ElementType` is a deliberate public testing taxonomy generated from a central registry,
not directly from proto field names or React components. It follows `st.*` command names
where the rendered result can distinguish them. Commands that share an indistinguishable
renderer use one canonical type; for example, Altair and Vega-Lite output may share
`"vega_lite_chart"`. Each registry entry declares:

- its public type and category (`widget`, `display`, or `container`);
- supported query semantics (`key`, `label`, `text`);
- interaction capabilities and synchronization behavior; and
- the private adapter used by the current frontend implementation.

Category is descriptive, while capabilities are resolved for the rendered instance.
For example, a dataframe or chart only gains a selection capability when configured with
`on_select`; this mirrors Streamlit's distinction between display elements, always-
interactive widgets, conditionally interactive elements, and layout containers.

#### Capability-based interactions

`StreamlitElement` provides a compact set of user-behavior methods. Each method dispatches
to element-specific private logic and fails helpfully when the selected element does not
support that capability:

```python
app.get_element_by_label("Country").select_option("Japan")
app.get_element_by_label("Metrics").select_option(["Revenue", "Margin"])
app.get_element_by_label("Threshold").set_value(0.8)
app.get_element_by_label("Include archived").set_value(True)
app.get_element_by_label("Refresh").click()
app.get_element_by_label("Upload data").upload_files("data.csv")
```

Initial capability families are:

| Capability | Representative elements | Public methods |
|---|---|---|
| Trigger | button, form submit button, download button | `click()` |
| Option selection | selectbox, multiselect, radio, pills, segmented control | `select_option()` |
| Value entry | text input, text area, number input, slider, date/time input, color picker, checkbox, toggle | `set_value()` |
| Upload | file uploader, camera input, audio input | `upload_files()` or a media-specific method where necessary |
| Container operation | expander, popover, dialog, tabs, form | `open()`, `close()`, `select_tab()`, `submit()` as applicable |
| Data/chart selection | dataframe, data editor, selectable charts | Deferred until a small, coherent semantic API is validated |

This is intentionally between raw Playwright and one controller class per Streamlit
element. Common behavior has one name, while the registry owns differences such as
portals, virtualized lists, canvas controls, BaseWeb markup, forms, and keyboard commit
behavior. Element-specific methods are added only when no shared capability is honest.

`StreamlitElement.locator` exposes the resolved Playwright `Locator` for standard
`expect` assertions and advanced actions. `StreamlitPage.page` exposes the underlying
`Page`, and `dom` exposes the current `Page` or `FrameLocator`. Code that traverses
further with CSS/XPath or internal test IDs is outside Streamlit's compatibility promise.

#### Reruns, navigation, and synchronization

Semantic actions default to `wait="auto"`. Before performing an action, the facade
subscribes to Streamlit's private lifecycle signals and then waits for the applicable
outcome:

- a full app rerun or fragment rerun reaches idle;
- a form input is committed without waiting for a rerun;
- a page navigation reaches the requested page and its run becomes idle; or
- an interaction such as a download/backend operation reaches its own completion state.

Advanced tests can override this with `wait="none"`, `"rerun"`, `"fragment"`, or
`"navigation"`. Lifecycle utilities cover operations that are not tied to one element:

```python
app.wait_until_ready()
app.wait_for_idle()
app.rerun()
app.switch_page("Reports")
assert app.current_page.title == "Reports"

with app.expect_run(scope="fragment"):
    app.get_element_by_key("live-filter").set_value("active", wait="none")
```

`rerun()` means re-executing the current Streamlit page in the same session; `reload()`
remains the Playwright browser-page operation and may create a new session. The lifecycle
model must distinguish full runs, fragment runs, form batching, navigation, and operations
that do not rerun. It must not implement synchronization as an unconditional sleep after
each click. `switch_page()` selects by exact page title by default and offers a path-based
disambiguation for apps with duplicate titles.

`semantic_snapshot()` returns a compact description of the Streamlit element/container
tree enriched with public types, keys, labels, values, capabilities, and accessibility
semantics where available. This is useful for diagnostics and agents, not a replacement
for focused assertions.

Advanced fixture configuration is progressively disclosed:

```python
# Start a local app with controlled environment/config.
app = app_fixture(
    "src/dashboard/app.py",
    env={"APP_ENV": "test"},
    config={"server.headless": True},
    timeout=30,
)

# Test an already deployed app without starting a local process.
app = app_fixture(url="https://example.streamlit.app")
```

Support for an external host page and iframe selector should reuse the existing
`AppTarget` design after the direct local/deployed API is validated. It may ship in the
preview if extraction is low-risk, but is not a GA blocker.

### 7. Keep the DOM private behind versioned adapters

The public compatibility contract is the behavior of the Streamlit testing API, not DOM
markup, CSS classes, test IDs, protobuf fields, delta paths, element IDs, or lifecycle
attributes. Users should not need any of those details for normal selection, interaction,
synchronization, or assertions.

The E2E package contains a private adapter registry that can use accessible roles,
existing internal test IDs, DOM structure, browser state, or a future private frontend
test bridge as appropriate. A frontend change that breaks an adapter must update that
adapter and its cross-element conformance tests in the same Streamlit change. Dogfooding
the public API in Streamlit's E2E suite is what keeps the facade aligned with the current
frontend.

Accessibility remains a product requirement and an important implementation strategy,
but it is not the only selector mechanism and does not make Streamlit's DOM public.
Portals, canvas-backed elements, virtualized controls, and Streamlit-managed iframes are
resolved by the facade. Custom-component content remains an explicit frame boundary;
component authors own semantics inside their frame.

The local fixture tests the installed Streamlit version and therefore has a lockstep
adapter. During preview, testing an independently deployed app is supported only for a
documented compatibility range; incompatible or undetectable versions produce a clear
warning or error rather than silently falling back to brittle selectors. A tech spec
should determine whether version negotiation needs a private frontend bridge.

### 8. Make failures useful without custom assertions

On failure, the pytest integration collects:

- the standard Playwright trace and screenshot;
- the current semantic/accessibility snapshot;
- browser console errors;
- Streamlit server stdout/stderr; and
- app startup/config metadata with known secrets redacted.

Server-startup failures and unexpected exits surface the command, exit status, URL, and
tail of the server log in the pytest error. Artifacts use predictable paths and are
reported in the terminal, so a human or agent can inspect them without CI-specific
knowledge.

Streamlit should not replace Playwright's `expect`. It already retries, checks
actionability, and produces better locator diagnostics than plain `assert` against the
DOM.

### 9. Optimize explicitly for AI agents

The human API above is also the agent API. Add the following agent-facing guidance and
tools without creating a separate testing system:

- Include the testing decision table, install commands, semantic locator priority, and
  artifact locations in Streamlit's bundled agent skill.
- Prefer `get_element_by_label`, `get_element_by_key`, and `get_element_by_text`, with a
  public element type when it improves clarity. Never generate positional, CSS, XPath,
  or internal `st*` test-ID selectors unless implementation is the behavior under test.
- Document `AppTest.snapshot()` and `StreamlitPage.semantic_snapshot()` as the first
  debugging step. Both are structured text, but only the browser snapshot represents
  actual accessibility semantics.
- Provide an agent-friendly `repr` for query errors with valid replacement locators.
- Document Playwright codegen and Playwright MCP as optional ways to explore a running
  app. A future `streamlit test --codegen app.py` convenience can compose existing
  Playwright tooling; it should not generate a proprietary test format.
- Keep generated tests ordinary pytest files that a human can read, edit, and run
  without an agent.

For security, docs for browser agents must warn that content from an external app or its
data sources is untrusted input. Accessibility snapshots can carry indirect prompt
injection just like page text or screenshots.

### 10. Dogfood the public E2E core internally

Extract, rather than copy, the reusable parts of the internal suite:

- subprocess/server lifecycle and ephemeral ports;
- local/direct-external app targets;
- initial-load and idle detection;
- semantic element/container selection and capability dispatch;
- backend log capture; and
- failure artifact hooks.

The extracted module must not import `e2e_playwright.conftest` or assume paired
`*_test.py`/app filenames. Internal `conftest.py` should consume the public core and add
repo-only conveniences on top.

New internal app-behavior tests should use the public fixture and semantic facade.
Existing tests migrate opportunistically, starting with the common helpers. Private
helpers remain for dataframe cell coordinates, visual baselines, protocol assertions,
performance measurement, and other implementation-specific coverage. The realistic goal
is shared infrastructure and a stable public facade, not deleting every private helper.

## Options considered

### Option A: Improve only AppTest

- **Pros:** Fast, no browser installation, Python-native, easiest CI setup.
- **Cons:** Cannot validate frontend rendering, browser-only state, accessibility,
  custom-component JavaScript, real file/download behavior, or the actual user journey.
  Reimplementing those semantics would duplicate the frontend and recreate current
  parity bugs at a larger scale.

This is insufficient on its own.

### Option B: Deprecate AppTest and use Playwright for everything

- **Pros:** One engine and the highest behavior fidelity.
- **Cons:** Browser startup is too expensive for large state/branch matrices; mocking
  Python dependencies is harder across a subprocess; users lose a valuable fast smoke
  test; simple app logic tests become unnecessarily operational.

This throws away a useful layer. AppTest should become narrower and more trustworthy,
not disappear.

### Option C: Complementary AppTest + semantic Playwright facade ✅ PREFERRED

- **Pros:** Matches the test pyramid; uses each tool where it is strongest; preserves
  Playwright ecosystem knowledge; gives Streamlit an authoritative browser-testing path;
  supports gradual internal adoption; provides agents with both fast feedback and high-
  fidelity verification.
- **Cons:** Users must understand two tools; Streamlit maintains two lifecycle paths and
  a private browser adapter registry; optional browser setup remains heavier.

The decision guide, explicit capability registries, shared key/type vocabulary, and
semantic snapshots make the boundary teachable.

### Option D: Publish the existing internal helpers unchanged

- **Pros:** Lowest initial extraction work; broad element coverage on day one.
- **Cons:** Commits public API to private `data-testid`s, repo conventions, duplicated
  widget wrappers, visual-test infrastructure, and circular imports. It would freeze
  frontend implementation details and still not give users a coherent setup story.

Reject. Reuse proven implementation selectively behind a smaller API.

### Option E: Build another driver (Selenium, Cypress, custom WebSocket client, or jsdom/component-test runner)

- **Pros:** A custom protocol client could be faster; component tests can isolate the
  frontend; other browser drivers have established ecosystems.
- **Cons:** Selenium/Cypress duplicate a framework Streamlit already operates; jsdom does
  not run the real browser/server app; a custom WebSocket client is effectively a second
  AppTest and still cannot validate rendered behavior.

Do not create another public UI engine. A protocol client may be an internal technique
for repairing AppTest. Component tests remain appropriate for Streamlit's own frontend,
not as the primary user app-testing API.

### Other useful testing paths

- **Plain pytest** should be the default for business logic extracted from the Streamlit
  script. It is faster and clearer than either app framework.
- **ASGI/HTTP `TestClient`** is useful for custom routes on an `st.App`, health checks, or
  middleware. It cannot test the WebSocket-driven UI without implementing a Streamlit
  client and is therefore not an AppTest/E2E replacement.
- **Static type checks, linting, and accessibility audits** complement behavioral tests
  but do not exercise reruns or user workflows.
- **Visual regression and load testing** are specialized layers and should remain
  separate from this common API.

## Rollout plan

### Phase 0: Baseline and contracts

- Turn each open labeled AppTest issue into a minimal regression/parity scenario, or
  document why the report is not reproducible/current.
- Define the AppTest capability registry and E2E element/capability facade contract.
- Establish representative AppTest-vs-browser parity tests for full reruns, fragments,
  dialogs, forms, multipage navigation, dynamic nodes, and formatted widget values.
- Correct current capability docs from the generated registry.

### Phase 1: AppTest reliability and semantic queries

- Fix session/tree/state/path/cache behavior before claiming additional interactive
  elements.
- Add universal block/element keys, typed and universal semantic queries, semantic
  snapshots, and actionable unsupported-interaction errors.
- Keep `streamlit.testing.v1.AppTest` source-compatible. Correctness fixes may cause tests
  that relied on impossible interactions (such as changing disabled widgets) to fail;
  call these out prominently in release notes.
- Do not create AppTest v2 until a genuinely breaking interaction model (for example,
  automatic reruns) is justified by usage.

### Phase 2: E2E developer preview (in parallel with Phase 1)

- Do not gate the preview on resolving all AppTest issues. Phase 2 requires the shared
  vocabulary and lifecycle contracts from Phase 0, while AppTest fidelity work continues
  independently in Phase 1.
- Add the optional `testing` extra and extract the public app process/target module.
- Define the public `ElementType` and capability registry, with conformance fixtures for
  each supported element and container.
- Ship local app and direct external URL support, Chromium setup docs, semantic
  key/label/text finders, the initial capability-based actions, lifecycle/navigation
  utilities, semantic snapshots, and failure artifacts.
- Add a short migration example from raw `pytest-playwright` and from copied internal
  helpers.
- Mark `streamlit.testing.e2e` as preview while fixture scope, process reuse, external
  modes, and artifact defaults are validated.

### Phase 3: Internal adoption and ecosystem feedback

- Make the public E2E lifecycle/target and semantic facade the default for new internal
  app-behavior tests.
- Migrate the highest-use shared helpers behind capability adapters and track the
  remaining justified private selectors/helpers.
- Validate Windows, macOS, Linux, Chromium, Firefox, and WebKit through the standard
  Playwright matrix. Chromium remains the recommended fast default for users.
- Publish examples for local CI, GitHub Actions, deployed apps, multipage apps, auth
  state, components, uploads/downloads, and visual assertions.

### Phase 4: GA and agent ergonomics

- Stabilize the E2E namespace after at least three Streamlit releases of preview use and
  internal dogfooding.
- Update the bundled Streamlit agent skill and evaluate an optional codegen launcher.
- Add advanced external-host/iframe support if it did not fit in preview.
- Add specialized complex-widget capabilities based on demonstrated gaps, not a goal of
  creating one public controller class or unrelated method family per element.

## Success criteria

- By GA, all 13 currently open labeled AppTest issues have a regression test and are
  either fixed, closed as invalid/outdated, or represented as an explicit documented
  browser-only limitation. This is an overall program-health criterion, not an E2E
  developer-preview launch gate.
- 100% of current and new Element/Block proto variants have a declared capability level;
  docs are generated from it.
- No supported AppTest interaction in the parity suite produces a different Python value,
  active-node set, or rerun scope from the browser reference scenario.
- Every built-in element/container in the E2E registry has conformance coverage for its
  declared query semantics, capabilities, and synchronization behavior.
- At least 80% of new internal app-behavior E2E tests use the public lifecycle and
  semantic facade; direct private selectors are reserved for implementation coverage.
- Public E2E tests need no sleep for normal app reruns and produce a trace, semantic
  snapshot, and server-log tail on failure.
- Internal flake rate and median runtime do not regress materially after migration.
- In a maintained benchmark of at least 20 representative app changes, a coding agent
  can choose the correct layer, author a non-positional test, run it, and diagnose a
  failure from artifacts in at least 90% of tasks.
- Documentation no longer leads with index-based examples and does not expose private
  DOM structure, CSS selectors, lifecycle attributes, or `st*` test IDs.

## Out of scope (future work)

- Automatic AppTest reruns immediately after each interaction. Explicit `.run()` remains
  compatible and makes batches visible; revisit only in an AppTest v2 discussion.
- A separate public controller class or unrelated interaction API for each Streamlit
  element. Shared capability handles and a few irreducibly specialized operations are in
  scope.
- A Streamlit-specific browser MCP server. Playwright MCP can consume the public semantic
  snapshot and the facade's generated guidance; add Streamlit-specific tools only if a
  concrete gap remains.
- Hosted browser execution as a Streamlit service.
- Visual baseline storage/review, Percy integration, or Streamlit's internal pixelmatch
  workflow.
- Load, soak, and multi-user concurrency testing.
- Full custom-component internals. Component authors test their own iframe content with
  Playwright; Streamlit tests the host boundary.

## Checklist

| Item | ✅ or comment |
|---|---|
| Works on SiS, Cloud, etc? | AppTest remains platform-independent. E2E runs in a developer machine/CI against a local or deployed app; it is not intended to run inside Community Cloud or SiS app processes. Direct deployed URLs are in preview scope; embedded-host support is advanced/follow-up. |
| No breaking API changes | ✅ Existing AppTest APIs remain. Semantic queries and E2E are additive. Some incorrect AppTests may fail after production-parity checks are enforced; document these correctness changes. |
| No new dependencies | No new base dependency. The developer-only `streamlit[testing]` extra adds pytest-playwright/Playwright; browser binaries are installed separately. |
| Metrics collected | No telemetry should be emitted by user test runs. Measure labeled issues, docs feedback, optional-extra support volume, internal adoption/flake/runtime, and the agent benchmark. |
| Any security/legal impact? | Bind local servers to loopback, use ephemeral ports, redact known secrets from logs/artifacts, and warn that test apps execute arbitrary code. User-provided keys and labels are already visible app metadata and must not contain secrets. Playwright is already an internal dependency, but legal should confirm optional dependency and browser-binary distribution guidance. Browser-agent docs must cover untrusted-page prompt injection. |
| Any docs changes needed? | Replace the stale capability list with generated docs; add a testing strategy guide, AppTest semantic-query/snapshot reference, E2E install/API/CI guide, locator best practices, deployed-app guidance, troubleshooting/artifacts, and agent-skill guidance. |
