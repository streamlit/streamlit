---
author: lukasmasuch
created: 2026-07-16
---

# Streamlit app testing strategy

## Summary

Most Streamlit apps are now written by coding agents, so it matters that an agent can
verify its own changes and leave tests behind. Most of that test code will also be
written by agents and reviewed by people. This spec makes
every Streamlit app verifiable and testable for both. Two questions decide which tool to
use: should the check outlive the session, and is it about the app's logic or its
rendered UI?

| | App logic, without a browser | Rendered UI, with a browser |
|---|---|---|
| **On-the-fly verification:** during development, nothing committed | `interact` against the running app (_new, [agent interface spec](https://github.com/streamlit/streamlit/pull/16843)_) | A throwaway `streamlit.testing.e2e` script, run once against the running app (_new_) |
| **Committed tests:** in the repository, run in CI | Plain pytest for logic outside the app script (_exists_); [AppTest](https://docs.streamlit.io/develop/api-reference/app-testing) for the app script itself (_exists, improved_) | `streamlit.testing.e2e` tests (_new_) |

For most apps the left column is enough. The script decides which elements exist, their
values, and what each interaction computes, while Streamlit's own tests cover how
built-in elements render. The right column matters when an app brings its own frontend or
look, such as custom components, custom HTML/CSS, or a custom theme.

The three Streamlit parts behind that table:

1. **On-the-fly verification with `interact`.** The agent interface proposed separately
   in [Agent-accessible Streamlit apps](https://github.com/streamlit/streamlit/pull/16843)
   lets an agent drive a running app over HTTP and read it back as JSON, so it can check
   its last edit in seconds without writing a test. Because a Streamlit app is mostly
   logic, this already exercises the entire app against the real runtime. It can judge
   layout, alignment, styling, and theming only in a limited, non-visual way: it reports
   which sidebar, column, tab, or container holds each element, but not how the page
   looks.
2. **Committed logic tests with AppTest.**
   [AppTest](https://docs.streamlit.io/develop/api-reference/app-testing) has been
   Streamlit's fast, in-process, browserless way to write pytest unit tests since
   Streamlit 1.28 (2023), and most of its reported bugs are fixed. It needs tweaks rather
   than a redesign: this spec closes its remaining fidelity gaps and adds semantic
   queries and a snapshot, without breaking existing tests.
3. **Committed UI tests with `streamlit.testing.e2e`.** A new optional Playwright
   integration covers what only a browser can check: custom components, custom HTML/CSS,
   browser-only behavior, screenshot tests, and verification of layout, alignment,
   styling, and theming. It builds on Streamlit's own
   [Playwright suite](https://github.com/streamlit/streamlit/tree/develop/e2e_playwright),
   which already solves app startup, rerun detection, and traces, and extracts the
   proven parts behind a smaller public API: a Streamlit-aware facade for finding and
   operating elements, lifecycle utilities, failure artifacts, and an escape hatch to
   Playwright.

The E2E API serves both rows of the table: committed UI tests, and throwaway scripts for a
quick check of the rendered page. Underneath all three parts, plain pytest stays the first
choice for logic that does not need Streamlit at all, such as data transforms, model
calls, and validation. Extracted from the app script and tested directly, it is the fastest
and clearest test and needs nothing from Streamlit.

What connects the three parts is a **shared vocabulary**, not a shared API. Authored keys
and labels address the same element everywhere, new names follow public command names,
and AppTest and `interact` return the same snapshot document, built from the
per-command descriptions the agent interface defines. An agent can therefore carry the
keys, labels, and element types it found while exploring a running app into the test it
commits, adding `key=` where it needs a durable handle. Strict lookups and failure
artifacts are designed so it can fix a failing test without a person interpreting the
output.

**Recommendation:** build on what exists rather than adding another engine. Improve
AppTest through fixes and additive APIs, extract the public E2E layer from Streamlit's
own Playwright suite instead of publishing it as-is, align both with the agent
interface's vocabulary and snapshot, and share its implementation where that is simpler
than keeping two in sync. Do not turn AppTest into a browser emulator or make the agent
interface a test framework.

## Problem

Today, an agent or developer who wants to know whether a Streamlit app works has three
incomplete options:

- **AppTest** runs the script in-process and is fast, but it finds most elements only by
  position or authored key, cannot describe the app compactly for a failing test or an
  agent, and still disagrees with a browser on dialogs and fragment-scoped reruns. Those
  disagreements share a root cause: AppTest reuses the production script runner but
  bypasses the real session and re-implements the browser's side of the protocol, so
  every rule it copies can drift.
- **Browser testing** validates the real product, but Streamlit provides no supported way
  to start an app, wait for reruns, select elements, or collect logs. Users assemble
  Playwright infrastructure themselves, and Streamlit's own mature suite in
  `e2e_playwright/` is coupled to the repository and private DOM, so it cannot simply be
  published.
- **A running app** cannot be checked without a browser at all. An agent that just edited
  an app writes a throwaway AppTest, which may disagree with the real app, or drives a
  browser, which is slow, token-inefficient, and imprecise: not everything the app knows
  is easy to read from the DOM, such as dataframe rows outside a virtualized grid or
  chart values drawn on a canvas, and the DOM is not a stable contract either.

These gaps matter most for coding agents, which increasingly write both the app and its
tests and verify in two modes. While building, an agent wants to check its last edit
against the running app in seconds and leave nothing behind. Before handing off, it
should leave tests that CI runs and people maintain long after the session ends. The
first mode rewards speed and fidelity to the running app, the second determinism,
isolation, and readability, so no single tool serves both. In either mode an agent needs
a deterministic command, semantic element identity, a compact description of the current
UI, and failure output it can act on alone. Indexes, private CSS structure, sleeps, and
screenshots are poor machine interfaces and produce brittle tests for humans too.

Each gap maps to one part of the proposal, and each part builds on something that already
exists: `interact` on the agent interface's headless sessions, AppTest on its existing
API, and the E2E layer on Streamlit's own Playwright suite.

### AppTest today

AppTest executes the script with the production `ScriptRunner` but replaces the layers
around it. It uses a mocked `Runtime` and no `AppSession`, so a run gets widget states,
query string, and page, but never a fragment ID or client context. And it re-implements
the React frontend's side in its own `ElementTree`: merging and pruning the tree,
batching forms, resetting `clear_on_submit` forms, and choosing what to send next. Most
bugs from a July 2026 audit have been fixed through the
[AppTest PR queue](https://issues.streamlit.app/agent_wiki_explorer?file=references/2026-07-22-app-testing-fixes.md),
often by copying production logic, and the remaining gaps sit in the same two layers or
in AppTest's API:

- **Scoped reruns:** a click inside a dialog or fragment reruns the whole script, so the
  dialog branch is gone before the click is read
  ([#9786](https://github.com/streamlit/streamlit/issues/9786), the most-requested
  AppTest issue; [#9242](https://github.com/streamlit/streamlit/issues/9242) reports the
  same gap).
- **Frontend behavior:** setting a `bind="query-params"` widget does not update the query
  parameters ([#17250](https://github.com/streamlit/streamlit/issues/17250)).
- **Client context:** `st.context` is empty and `st.user` is a fixed `test@example.com`.
- **Isolation:** two AppTest instances share `st.cache_data` results
  ([#9139](https://github.com/streamlit/streamlit/issues/9139)).
- **Values:** before a rerun, `.options` and staged values use `format_func` labels
  instead of raw options ([#10550](https://github.com/streamlit/streamlit/issues/10550)).
- **Queries and naming:** elements can be found by position or key but not by `label` or
  text, there is no compact description of the app, and names are guessed from protos
  several commands share, so `st.badge` reads as `markdown` and `st.line_chart` as
  `vega_lite_chart`.
- **Coverage:** media inputs and chat attachments cannot be driven, some commands are
  inspectable only as `UnknownElement`, and the capability docs are maintained by hand.

The agent interface solves the first three for its headless sessions, running a real
`AppSession` and implementing the browser's side once, and its per-command descriptions
provide the element names. That is the strongest reason for AppTest to reuse it where
practical ([section 2](#2-close-apptests-remaining-fidelity-gaps)). Isolation, values,
and queries remain AppTest's own work: production shares caches across sessions by
design, so per-test isolation sits on top of the real runtime.

### Internal Playwright audit

Streamlit already has broad real-browser coverage: 217 Playwright test modules in
[`e2e_playwright/`](https://github.com/streamlit/streamlit/tree/develop/e2e_playwright)
at the time of this audit. The suite solves hard problems that users also have, including app
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

- Treat coding agents as the primary authors of test code and people as its reviewers:
  every API, error, and artifact must be usable by an agent without human
  interpretation, and every generated test must be an ordinary pytest file a person can
  review.
- Separate on-the-fly verification from committed tests, and connect them: the names,
  keys, and snapshot an agent sees while checking a running app are the ones it uses in
  the test it commits.
- Make the choice between browserless tests of app logic and browser tests of rendered UI
  explicit, and make clear that most Streamlit apps need only the first.
- Make AppTest reliable for the behavior it claims to support and explicit about what it
  cannot support.
- Let tests find elements and containers through stable Streamlit concepts (`key`,
  `label`, visible text, public element type) without positional selectors or DOM
  knowledge, and operate them through consistent methods across controls that behave
  alike.
- Let a user start and test a local or deployed app with Playwright in a few lines of
  pytest setup, and reuse the same facade in Streamlit's own test suite.
- Give agents one semantic snapshot, shared with the agent interface, plus compact log
  and trace artifacts.
- Have every command describe itself once, where it fills its proto, for AppTest, the
  agent interface, and the E2E facade alike.

## Non-goals

- Making AppTest reproduce CSS, layout, accessibility, browser APIs, custom-component
  JavaScript, chart rendering, or media playback.
- Replacing Playwright's browser contexts, tracing, code generator, or full browser API.
  The facade complements Playwright and exposes its `Page` and `Locator`.
- Guaranteeing that every internal E2E test uses only public helpers. Streamlit must
  still test private rendering and protocol details.
- Adding a `test_id` parameter to every command. `key` is the identity primitive and
  should be extended before another parameter is invented.
- Making browser binaries a required Streamlit dependency.
- Treating screenshots as the primary assertion format. They remain useful for visual
  regressions, not for most behavior tests or agent interaction.
- Making the agent interface a test framework. It is for checking and using a running
  app.
- Rewriting AppTest, changing its existing public API, or requiring it to reuse the
  agent interface's implementation. Improvements are fixes, tweaks, and additions, and
  shared code is used where it is simpler.

## Proposal

### 1. Publish one verification strategy

Documentation and the bundled agent skill should begin with when to use what, not with an
API reference: the two questions and the table from the [summary](#summary), followed by
the reasoning below.

**Logic versus UI.** In Streamlit, most of what an author can get wrong is logic. The
script decides which elements exist, their labels, options, and values, and what a widget
change computes, while Streamlit's own tests cover how built-in elements render. A
browserless check therefore exercises nearly everything a typical app's author wrote, and
it is faster and more reliable for an agent than driving a browser. The rendered UI
becomes the author's responsibility when the app brings its own frontend or look, such as
custom components, `st.html`, `components.html`, injected CSS, or a custom theme, or
relies on behavior that
lives only in the browser: JavaScript, keyboard and focus, real file dialogs,
accessibility, and layout a workflow depends on. Only a browser can check those, so
Playwright is the only way an agent can test UI. Snapshots mark the affected elements
with `support: browser_required`.

**On the fly versus committed.** On-the-fly verification optimizes for the next minute.
An agent drives the app it just edited through `interact`, from any language and against
the real runtime, and a script edit takes effect on the next interaction, so it can
re-check without restarting. That already covers the app's entire logic: every widget,
branch, and computed value, leaving only how the page looks to a browser. It is
deliberately not a test framework: it has no assertions, isolation, or mocking, its
sessions share caches with the rest of the server, and nothing it observes is kept.

For the rendered UI, the on-the-fly check is a throwaway script on the E2E API, pointed at
the running app with `app_fixture(url=...)`, run once, and deleted. It uses the same
finders, waits, and snapshot as a committed E2E test, so it reports Streamlit elements
rather than a generic page, and it becomes a committed test by letting the fixture start
the app itself and moving the file into the test suite.
Playwright MCP stays useful for exploring an unfamiliar page, and is the fallback until
the E2E API ships.

Committed tests optimize for every later change. They must be deterministic, isolated,
fast enough for every commit, and readable by the reviewer, which is AppTest's and E2E's
job, and neither should take the shortcuts that make on-the-fly checks fast.

The two modes connect through the shared vocabulary. The workflow the skill teaches is:

```text
edit the app
  ↓
check it on the fly        interact against the running app
                           custom UI: a throwaway streamlit.testing.e2e script
  ↓
lock the behavior in       plain pytest for logic extracted from the app script
                           an AppTest using the keys the snapshot reported
                           custom UI or support: browser_required: an E2E test
  ↓
deploy, then smoke-check   interact against the deployed app
```

For committed tests, the choice in more detail:

| Test target | Recommended tool | Browser | Typical use |
|---|---|---:|---|
| Pure Python/business logic | pytest | No | Data transforms, model calls, validation, permissions. |
| Streamlit script behavior | AppTest | No | Smoke tests, session-state branches, inputs and outputs, deterministic app logic. |
| Rendered UI and browser-only behavior | `streamlit.testing.e2e` + Playwright | Yes | Custom components and custom HTML/CSS, screenshot tests, layout, alignment, styling, and theming, accessibility, keyboard, uploads/downloads, chart and media rendering, deployed apps, dialogs until AppTest supports them, and a few critical journeys. |

AppTest tests run as pytest unit tests, but they execute the script and parts of the
runtime, so docs should not promise strict unit-test isolation or browser parity. E2E docs should state the cost (browser install and slower startup) and recommend
a small number of high-value journeys, backed by many plain unit tests and focused
AppTests.

#### What is shared with the agent interface

| Shared piece | Defined by | Used by |
|---|---|---|
| Per-command descriptions: `type`, `props`, value encoding, `support` | Agent interface spec, at each command's emit site | `interact`, AppTest queries and snapshot, E2E `ElementType` |
| Snapshot document and its `schema_version` | Agent interface spec | `interact`, `AppTest.snapshot()`, `StreamlitPage.semantic_snapshot()` |
| Headless client rules: tree merging, fragment-scoped pruning, run-chain settling, form and dialog batching, validation against the last snapshot | A shared core where practical; otherwise each driver, kept aligned by a parity suite | `interact`, AppTest |
| Widget constraint validators ([#16203](https://github.com/streamlit/streamlit/issues/16203)) | Each widget | Browser path (coerces), `interact` and AppTest (reject) |
| Typed queries, strict lookup, isolation, mocking | This spec | AppTest |
| Browser adapters, lifecycle, failure artifacts | This spec | E2E |

Sharing the vocabulary and the snapshot is required, because that is what agents see.
Sharing code is a preference: reuse the agent interface's implementation where that is
simpler than maintaining two, and keep AppTest's own where reuse would force a rewrite or
change its behavior. Either way, one parity suite runs the same scenarios through
AppTest, `interact`, and a real browser.

### 2. Close AppTest's remaining fidelity gaps

Every change is a fix, a tweak, or an addition to `streamlit.testing.v1`. No public API
is removed or renamed: collection names, node `type` values, `.value` semantics, `get()`,
and the explicit `.run()` model stay as they are. Behavior changes only where AppTest
disagrees with a browser, and each such fix is called out in release notes.

Required behavior:

- **Scoped reruns.** Interacting with a widget inside a fragment or dialog reruns only
  that scope, as in a browser, and keeps the rest of the tree
  ([#9786](https://github.com/streamlit/streamlit/issues/9786)).
- **Isolation.** A new AppTest instance starts with isolated caches, resources, session
  state, secrets, pages, and runtime globals
  ([#9139](https://github.com/streamlit/streamlit/issues/9139)). Any future shared-cache
  fixture must be explicit.
- **Values and validation.** The Python API returns the raw option value, including
  before a rerun ([#10550](https://github.com/streamlit/streamlit/issues/10550)), while
  the snapshot reports the formatted value, as the agent interface does, because that is
  what a request can send back. Options, bounds, and `max_chars` are checked by the
  widget validators from [#16203](https://github.com/streamlit/streamlit/issues/16203)
  in the mode that reports a violation instead of coercing it.
- **Frontend behavior.** Behavior the frontend implements rather than Python is
  emulated, so a test observes what a browser user would: the `clear_on_submit` reset,
  which AppTest already approximates, and the URL write-back of `bind="query-params"`
  widgets ([#17250](https://github.com/streamlit/streamlit/issues/17250)). AppTest and
  the agent interface should make the same choice
  ([open question 5](#open-questions)).
- **Client context.** `st.context` and `st.user` are seedable with the fields `interact`
  accepts: `timezone`, `locale`, and an identity.

The agent interface needs the same lifecycle and specifies it: deltas merged into the
four root containers, stale nodes pruned when a run finishes and scoped to the fragment
that ran, run chains settled before observing, dialogs and forms batched by the browser's
rules, and writes validated against the last snapshot. Fragment- and dialog-scoped reruns
are the likeliest place to reuse its implementation, since AppTest has no model for them
yet; elsewhere AppTest keeps the code that already works. How much to share is a
tech-spec decision, made rule by rule. Whatever is shared, AppTest keeps its isolated
runtime, in-process execution that tests can mock, and a Python API that returns Python
values.

### 3. Add typed semantic AppTest queries

Keep all existing `at.button[0]`, `at.button("save")`, `at.button(key="save")`, and
`at.get("button")` behavior. Every element and layout collection is already callable by
key (`at.dataframe("sales")`, `at.expander("details")`). Extend those calls with
keyword-only `label`, `text`, and `exact` filters, available only where they are
meaningful, so the element type is expressed once and preserved in the return type:

```python
import re

at.text_input(label="Your name") -> TextInput
at.button(label="Save") -> Button
at.markdown(text=re.compile("Revenue")) -> Markdown
at.container(key="filters") -> Block
```

All singular lookups are strict: zero or multiple matches raise `AppTestLookupError`, a
subclass of the existing `AppTestError`, with the query, scope, closest candidates, and
the snapshot outline. A tech prototype must verify that the filters keep overloads and
autocomplete precise for widget, display-element, and container collections.

`get_by_key()` already exists on `AppTest` and `Block`. Add `label` and `text` siblings
for cases where the type is unknown, mixed, or irrelevant:

```python
get_by_key(key: str) -> Node  # Exists.
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

- Universal methods return exactly one current node, with the same strictness as typed
  lookups, so a test never silently selects a different element after an app edit.
- `key` is exact and accepts only authored keys. A snapshot reports a generated element
  ID as the `key` of an unkeyed element, but that handle is opaque and session-scoped,
  so passing one raises an error that recommends `label=` or adding `key=` to the app.
- `label` is the command's `label`, including button text and container labels, not an
  inferred ARIA name. `text` searches normalized textual content in the protocol and does
  not claim to reproduce browser markdown rendering.
- Regular expressions opt into partial or case-insensitive matching; `exact=False`
  covers simple substrings.
- Queries can be scoped through containers. Plural selection keeps using the typed
  collections and `get()`.
- Docs lead with typed queries. Their precise return types let type checkers catch a
  wrong call before the test runs, which helps agents as much as IDE completion helps
  people, and they are the shortest migration from existing code. Universal `get_by_*`
  methods are the cross-type escape hatch.
- A Testing Library-style `query`/`find` matrix is deferred. AppTest has no DOM that
  changes after `run()`, so `find_by_*` would imply waiting behavior that does not exist.

Example:

```python
from streamlit.testing.v1 import AppTest

at = AppTest.from_file("app.py").run()

filters = at.container(key="filters")
filters.selectbox(label="Country").select("Japan").run()

assert at.markdown(text="Revenue: ¥12M").value
```

Indexes remain appropriate when order is the behavior under test, such as checking that
three tabs render in a specific order.

### 4. Share the semantic snapshot with the agent interface

`AppTest.snapshot()` returns the document `interact` returns, as a JSON-compatible
`dict`: the merged tree for the current page, the `actions` index, `support` on elements
that need more than a headless client, and `undescribed_types`. It is built from the same
per-command descriptions, so `type` is the command name, `props` keys are parameter
names, values are in the form a request can send back, and the same app in the same state
produces the same `tree` and `actions` through AppTest and `interact`.

Fields that only exist over HTTP (`session_id`, `data.url`, media URLs) are absent, since
the full data is the element's Python value. `observed_at` is omitted too, so the
document is deterministic and can back an optional snapshot test. Such tests stay the
exception; focused assertions say what the test cares about and survive unrelated edits.

Strict-query failures render the snapshot as a compact outline with the same names:

```text
AppTestLookupError: No selectbox with label "Country" in container key="filters".
Closest match: selectbox "Region" key="region"

main
  title "Account"
  container key="filters"
    selectbox "Region" key="region" value="Europe"
  button "Refresh" key="refresh"
  markdown "Revenue: ¥12M"
sidebar
  page_link "Settings"
```

The outline is for reading pytest output; it is not versioned and nothing should parse
it. Agents read the JSON document, whose stability follows the agent interface's
`schema_version` policy.

### 5. Replace silent element gaps with shared element descriptions

Every command describes itself where it fills its proto, as the agent interface spec
defines: its command name, parameters, value encoding, and a `support` reason when a
headless client cannot fully drive it. AppTest uses those descriptions for what is new:
the snapshot, unsupported-interaction errors, the generated docs matrix, and naming the
elements it has no class for. Its existing element classes keep parsing protos as they do
now, with the same collection names and node `type` values (`at.datetime_input` still
holds nodes of type `date_time_input`); the snapshot reports command names, and `get()`
accepts both.

The docs keep three readable support levels, defined only by the `support` field:

| Level | `support` | Meaning |
|---|---|---|
| Interactive | absent | Inspectable, and every interaction it accepts can be performed without a browser. |
| Inspectable | `read_only_in_v1` | Reported accurately, but some input it accepts, such as an upload, cannot be sent headlessly. |
| Browser-only | `browser_required` | What renders may differ from what is reported, such as a custom component; interaction directs the user to E2E. |

A registry keyed by proto variant cannot hold this, because several commands share one
proto and their semantics are gone once it is filled. Coverage is checked at runtime
instead. An element AppTest has no class for stays an `UnknownElement` but is named from
its description, and only an element without a description is listed in
`undescribed_types`. The existing proto-variant smoke test
([#16911](https://github.com/streamlit/streamlit/pull/16911)) becomes a kitchen-sink
sweep that asserts this list is empty, once it checks commands rather than proto
variants. The docs support matrix and the command-name table behind `at.get()`
([#17000](https://github.com/streamlit/streamlit/pull/17000)) are generated from the
descriptions.

Charts, media, custom components, and other browser-rendered features can often be
inspectable without becoming interactive, which is more maintainable than a bespoke
AppTest class for every frontend behavior.

### 6. Add an optional public Playwright integration

This is the first-party E2E API requested in
[#16906](https://github.com/streamlit/streamlit/issues/16906).

Installation:

```bash
pip install "streamlit[testing]"
playwright install chromium
```

`testing` is a developer-only optional extra, not part of Streamlit's base dependencies
or the runtime-oriented `all` extra. Browser binaries remain a separate, explicit
Playwright install.

Packaging options:

- **`streamlit[testing]` with code in `streamlit.testing.e2e` — preferred.** The facade's
  private adapters must evolve in lockstep with Streamlit's frontend, and users get one
  discoverable compatibility/version boundary. The extra installs pytest/Playwright;
  guarded imports keep them out of ordinary runtime dependencies.
- **A separate `streamlit-testing` distribution.** This could release independently, but
  introduces a frontend-adapter compatibility matrix and coordinated releases for every
  Streamlit DOM change. Reconsider only if the tooling later needs a different release
  cadence.
- **Documentation/templates only.** This adds no package surface but leaves every user
  responsible for process lifecycle, rerun detection, private selectors, and artifacts;
  it does not solve the core problem.

The namespace is `streamlit.testing.e2e` rather than `streamlit.testing.playwright`
because it names the testing purpose instead of making the driver the long-term public
concept. Documentation and types stay explicit that the implementation is Playwright.

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

    welcome = app.get_element_by_text("Welcome, ada", type="header")
    expect(welcome.locator).to_be_visible()
```

`app_fixture()` creates the pytest fixture named by the assignment, starts one app server
per test module on an ephemeral localhost port, and gives each test an isolated browser
page whose initial run is already idle. The tech spec prototypes the fixture-factory
mechanism; if inferring the name requires fragile stack-frame introspection, it falls
back to an explicit `name` parameter, such as `app_fixture("app.py", name="app")`.

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

- `get_element_by_key(key, *, type=None)` uses the exact user-provided `key`.
- `get_element_by_label(label, *, type=None)` uses element-specific label knowledge, not
  only HTML `<label>` relationships.
- `get_element_by_text(text, *, type=None)` covers display elements with meaningful
  visible text.
- `get_element(*, type)` requires exactly one rendered element of that type;
  `get_elements(*, type)` returns a collection for deliberate multi-element inspection.
- `type` is an optional discriminator and assertion, useful when labels repeat, with IDE
  completion through a generated `ElementType` `Literal`.
- Finders are strict by default, return actionable ambiguity or unsupported-query
  errors, accept strings or regular expressions, and retry like Playwright locators.
- A returned `StreamlitElement` can scope further queries when it is a layout container
  such as a sidebar, form, expander, popover, dialog, tab, column, or generic container.

`ElementType` is the set of command names the shared descriptions emit (`selectbox`,
`caption`, `altair_chart`), so any `type` an agent reads in a snapshot is one it can pass
to a finder. Where commands share a proto and render identically, such as Altair and
Vega-Lite charts, the facade still reports command names rather than coarser names of its
own; the tech spec decides how it recovers them, for example from descriptions supplied
by the server the fixture launched. The E2E registry adds only what a browser needs for
each type:

- supported query semantics (`key`, `label`, `text`);
- interaction capabilities and synchronization behavior, including interactions only a
  browser can perform, such as an upload on an element the snapshot marks
  `read_only_in_v1`; and
- the private adapter used by the current frontend implementation.

Capabilities are resolved for the rendered instance. For example, a dataframe or chart
only gains a selection capability when configured with `on_select`, which is also when
the snapshot marks it `read_only_in_v1`.

#### Capability-based interactions

`StreamlitElement` provides a compact set of user-behavior methods. Each method dispatches
to element-specific private logic and fails helpfully when the element does not support
that capability:

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

This sits between raw Playwright and one controller class per element. Common behavior
has one name, while the registry owns differences such as portals, virtualized lists,
canvas controls, BaseWeb markup, forms, and keyboard commit behavior. Element-specific
methods are added only when no shared capability is honest.

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

`rerun()` re-executes the current page in the same session; `reload()` remains the
Playwright browser-page operation and may create a new session. The lifecycle model must
distinguish full runs, fragment runs, form batching, navigation, and operations that do
not rerun, and must never synchronize with an unconditional sleep after each click.
`switch_page()` selects by exact page title by default and offers a path-based
disambiguation for apps with duplicate titles.

`semantic_snapshot()` returns the same document as `AppTest.snapshot()` and `interact`.
What only a browser can observe, such as visibility and the accessible role and name, is
kept in its own field on each node, never in `props`. That needs descriptions for the
browser session under test, which the server the fixture launched can provide; what a
deployed URL can return is a tech-spec question. Like the AppTest snapshot, it serves
diagnostics and agents, not focused assertions.

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
attributes. Users should not need any of those for normal selection, interaction,
synchronization, or assertions.

The E2E package contains a private adapter registry that can use accessible roles,
existing internal test IDs, DOM structure, browser state, or a future private frontend
test bridge as appropriate. A frontend change that breaks an adapter must update that
adapter and its cross-element conformance tests in the same Streamlit change. Dogfooding
the public API in Streamlit's E2E suite keeps the facade aligned with the frontend.

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
- the semantic snapshot and the page's accessibility snapshot;
- browser console errors;
- Streamlit server stdout/stderr; and
- app startup/config metadata with known secrets redacted.

Because a test app runs arbitrary code and can emit an inherited credential under any
name, redacting *known* secrets is not enough on its own. The fixture does not inherit
the full ambient (CI) environment by default; it passes an explicit `env` mapping, and
artifact collection treats app-produced output (logs, console, snapshots, screenshots,
traces) as potentially sensitive.

Server-startup failures and unexpected exits surface the command, exit status, URL, and
tail of the server log in the pytest error. Artifacts use predictable paths and are
reported in the terminal, so a human or agent can inspect them without CI-specific
knowledge.

Streamlit should not replace Playwright's `expect`, which already retries, checks
actionability, and produces better locator diagnostics than plain `assert`.

### 9. Design for agents as the primary test author

Agents will write most of the tests these APIs produce, so the agent is the first user of
every error, artifact, and doc page, and the reviewer is the second. There is still one
API, not a separate agent testing system:

- Teach the [section 1](#1-publish-one-verification-strategy) workflow in the bundled
  agent skill. Its testing reference
  ([#15605](https://github.com/streamlit/streamlit/pull/15605)) already routes committed
  app tests to AppTest; it gains the on-the-fly half, the decision tables, E2E setup,
  locator priority, and artifact locations, and is updated in the same PR as each
  behavior it describes.
- Default to testing app logic without a browser. Write an E2E test only when the app
  brings its own frontend (custom components, HTML, or CSS) or a snapshot marks an
  element `browser_required` or `read_only_in_v1`.
- Address elements by authored `key`, `label`, and visible text, with a public element
  type when it helps. A generated element ID is fine within one `interact` session but
  never in a committed test, so the skill tells agents to add `key=` to anything a test
  addresses. Never generate positional, CSS, XPath, or `st*` test-ID selectors unless
  implementation is the behavior under test.
- Make every failure self-correcting: a query error names the query, its scope, the
  closest valid locators, and the snapshot outline. Document both snapshots as the first
  debugging step; they are the document the agent already reads from `interact`.
- Check rendered UI on the fly with a throwaway E2E script against the running app,
  rather than a generic browser agent, so the check uses the same finders, waits, and
  snapshot as a committed test. Document Playwright MCP and codegen as optional ways to
  explore an unfamiliar page; a future `streamlit test --codegen app.py` can compose
  that tooling but must not generate a proprietary test format.
- Keep generated tests ordinary pytest files that a person can read and run without an
  agent, favoring explicit locators and focused assertions over the shortest code.

Every snapshot, from AppTest, E2E, or `interact`, and every accessibility snapshot
carries app-authored text and data that can contain indirect prompt injection. Docs tell
agents to treat all of it as data, not instructions, matching the agent interface's rule.

### 10. Dogfood the public E2E core internally

Extract, rather than copy, the reusable parts of the internal suite:

- subprocess/server lifecycle bound to loopback on ephemeral ports (set explicitly,
  rather than inheriting the internal launcher's wildcard-bind default);
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
performance measurement, and other implementation-specific coverage. The goal is shared
infrastructure and a stable public facade, not deleting every private helper.

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

This throws away a useful layer. AppTest should become more trustworthy, not disappear.

### Option C: Complementary AppTest + semantic Playwright facade ✅ PREFERRED

- **Pros:** Matches the test pyramid; uses each tool where it is strongest; preserves
  Playwright ecosystem knowledge; gives Streamlit an authoritative browser-testing path;
  supports gradual internal adoption; gives agents fast committed tests and high-fidelity
  browser tests on the same vocabulary they already use with `interact`.
- **Cons:** Users must understand two testing tools plus the agent interface; Streamlit
  maintains a browser lifecycle path and a private browser adapter registry; optional
  browser setup remains heavier.

The decision tables, shared element descriptions, and one snapshot document make the
boundary teachable.

### Option D: Publish the existing internal helpers unchanged

- **Pros:** Lowest initial extraction work; broad element coverage on day one.
- **Cons:** Commits public API to private `data-testid`s, repo conventions, duplicated
  widget wrappers, visual-test infrastructure, and circular imports. It would freeze
  frontend implementation details and still not give users a coherent setup story.

Reject. Reuse proven implementation selectively behind a smaller API.

### Option E: Build another driver

Selenium, Cypress, a testing-specific protocol client, or a jsdom/component-test runner.

- **Pros:** A protocol client is faster than a browser; component tests can isolate the
  frontend; other browser drivers have established ecosystems.
- **Cons:** Selenium/Cypress duplicate a framework Streamlit already operates; jsdom does
  not run the real browser/server app. A headless protocol client already exists as the
  agent interface, so a testing-specific one would be a third implementation of the tree
  and widget rules that still could not validate rendered behavior.

Do not create another public UI engine. AppTest reuses the agent interface's headless
core where that is simpler and otherwise keeps its own. Component tests remain
appropriate for Streamlit's own frontend, not as the primary user app-testing API.

### Other useful testing paths

- **Plain pytest** should be the default for business logic extracted from the Streamlit
  script. It is faster and clearer than either app framework.
- **ASGI/HTTP `TestClient`** is useful for custom routes on an `st.App`, health checks, or
  middleware, but does not drive the WebSocket-driven UI. Pointing one at `interact`
  would be a third way to write browserless tests, with weaker isolation than AppTest,
  and is not recommended.
- **Static type checks, linting, and accessibility audits** complement behavioral tests
  but do not exercise reruns or user workflows.
- **Visual regression and load testing** are specialized layers and should remain
  separate from this common API.

## Rollout plan

### Phase 0: Baseline and contracts

- Turn the open AppTest issues into parity scenarios (#9786, #9139, #10550, #17250),
  close #9242 in favor of #9786, and document the helper-module workaround for #9204.
- Agree on the shared contract with the agent interface: command-name types, `props`,
  value encoding, `support` reasons, and the snapshot document. This spec adds no
  element vocabulary of its own.
- Define the E2E element/capability facade contract on top of it.
- Establish the parity suite, run through AppTest, `interact`, and a real browser: full
  reruns, fragments, dialogs, forms, multipage navigation, dynamic nodes, and formatted
  widget values.
- Correct the capability docs from the coverage sweep.

### Phase 1: AppTest reliability and semantic queries

Papercut fixes continue as small PRs from the
[AppTest PR queue](https://issues.streamlit.app/agent_wiki_explorer?file=references/2026-07-22-app-testing-fixes.md),
for typed collections and interactions that follow an existing widget pattern, such as
media inputs and chat attachments. The rest of Phase 1 is architectural:

- Fix scoped reruns, dialogs, cache isolation, raw option values, and frontend emulation
  before claiming more interactive elements, reusing the agent interface's headless core
  where that is simpler than a separate fix.
- Add `label=` and `text=` filters, `get_by_label()`, `get_by_text()`, and
  `AppTestLookupError`.
- Ship `AppTest.snapshot()` only on the shared descriptions. An interim AppTest-only
  format would be a second observation format to migrate away from.
- Keep `streamlit.testing.v1` source-compatible and call out correctness fixes in release
  notes. Do not create AppTest v2 until a genuinely breaking interaction model, such as
  automatic reruns, is justified by usage.

### Phase 2: E2E developer preview (in parallel with Phase 1)

- Do not gate the preview on AppTest work. Phase 2 needs only the shared vocabulary and
  lifecycle contracts from Phase 0.
- Add the optional `testing` extra and extract the public app process/target module.
- Generate the public `ElementType` from the shared descriptions and add the browser
  capability registry, with conformance fixtures for each supported element and
  container.
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
- Add the E2E half of the workflow to the bundled agent skill (the AppTest half ships
  with Phase 1) and evaluate an optional codegen launcher.
- Add advanced external-host/iframe support if it did not fit in preview.
- Add specialized complex-widget capabilities based on demonstrated gaps, not a goal of
  creating one public controller class or unrelated method family per element.

## Out of scope (future work)

- Automatic AppTest reruns immediately after each interaction. Explicit `.run()` remains
  compatible and makes batches visible; revisit only in an AppTest v2 discussion.
- A separate public controller class or unrelated interaction API for each element.
  Shared capability handles and a few irreducibly specialized operations are in scope.
- A Streamlit-specific browser MCP server. The agent interface's planned MCP endpoint is
  the headless surface, and throwaway E2E scripts or Playwright MCP cover the browser;
  add Streamlit-specific browser tools only if a concrete gap remains.
- A pytest client for `interact`. It would be a third way to write browserless tests,
  with shared caches and no mocking; revisit only if committed tests against deployed
  apps prove to need it.
- Generating an AppTest file from a recorded `interact` session. Authored keys and the
  shared vocabulary make the mapping mechanical; build it if agents demonstrably fail to
  write the test themselves.
- Hosted browser execution as a Streamlit service.
- Visual baseline storage/review, Percy integration, or Streamlit's internal pixelmatch
  workflow.
- Load, soak, and multi-user concurrency testing.
- Full custom-component internals. Component authors test their own iframe content with
  Playwright; Streamlit tests the host boundary.

## Open questions

These need agreement with the
[agent interface spec](https://github.com/streamlit/streamlit/pull/16843), which owns the
shared pieces:

1. **Should `read_only_in_v1` lose its version?** AppTest and E2E docs will use the
   `support` values outside the agent API's v1, and an element might become drivable in
   one driver before another. A version-free reason such as `read_only` reads correctly
   in all three.
2. **How does an in-process driver satisfy `data.complete`?** The agent interface
   promises every truncated preview either a `data.url` or `data.unavailable`. AppTest
   has neither, because the full data is the element's Python value, so the shared
   schema should define that case.
3. **How much of the headless core should AppTest share?** Sharing removes duplicate
   fixes but couples AppTest to the agent interface's release and may need internal
   restructuring. The default is to decide rule by rule: share where it is simpler, with
   scoped reruns the strongest candidate, and keep AppTest's implementation where it
   already works.
4. **How does the E2E facade get descriptions for a browser session?** Command names the
   DOM cannot distinguish, and a `semantic_snapshot()` matching the shared document, both
   need the server to describe the session under test. That is straightforward for a
   server the fixture launched and open for a deployed URL.
5. **Do headless drivers emulate behavior the frontend implements?** The agent interface
   declares `clear_on_submit` and the URL write-back of `bind="query-params"` as gaps.
   AppTest already approximates `clear_on_submit`
   ([#16972](https://github.com/streamlit/streamlit/pull/16972)), and
   [#17250](https://github.com/streamlit/streamlit/issues/17250) asks it to write bound
   query parameters back. The two drivers should not disagree. The recommendation is to
   emulate both in both drivers: browser sessions are unaffected, and both then meet the
   agent interface's own criterion that an interaction matches an equivalent browser
   session. Moving the behaviors server-side for every client is the larger alternative
   the agent interface already lists.

## Checklist

| Item | ✅ or comment |
|---|---|
| Works on SiS, Cloud, etc? | AppTest remains platform-independent. E2E runs on a developer machine or CI against a local or deployed app; it is not intended to run inside Community Cloud or SiS app processes. Direct deployed URLs are in preview scope; embedded-host support is a follow-up. |
| No breaking API changes | ✅ Existing AppTest APIs, collection names, node `type` values, and the explicit `.run()` model remain. Semantic queries, the snapshot, seedable context, and E2E are additive. Correctness fixes where AppTest disagrees with a browser (scoped reruns, cache isolation, query-parameter write-back) may fail tests that relied on the old behavior; call these out in release notes. |
| No new dependencies | No new base dependency. The developer-only `streamlit[testing]` extra adds pytest-playwright/Playwright; browser binaries are installed separately. |
| Metrics collected | No telemetry from user test runs. Track labeled issues, docs feedback, optional-extra support volume, internal adoption, flake rate and runtime, and an agent benchmark of representative app changes. |
| Any security/legal impact? | Bind local servers to loopback explicitly (not the internal launcher's wildcard-bind default), use ephemeral ports, and warn that test apps execute arbitrary code. Do not inherit the full ambient/CI environment into the app process; pass an explicit `env` and treat app-produced artifacts as sensitive, since known-secret redaction cannot sanitize an arbitrary credential the app emits. For deployed URLs, apply a default-deny network policy that rejects private/link-local targets and cross-origin redirects into them, so a test- or agent-supplied URL cannot pull internal services into snapshots or artifacts. Keys and labels are visible app metadata and must not contain secrets. Legal should confirm the optional-dependency and browser-binary distribution guidance. Agent docs must cover prompt injection from app content. |
| Any docs changes needed? | Replace the stale capability list with docs generated from the coverage sweep; add a verification strategy guide (on-the-fly checks with `interact` versus committed tests, app logic versus rendered UI), an AppTest query and snapshot reference, an E2E install/API/CI guide, locator best practices, deployed-app guidance, troubleshooting and artifacts, and agent-skill guidance. |
