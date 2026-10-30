---
author: lukasmasuch
created: 2026-10-30
---

# AppTest semantic queries and fidelity fixes

## Summary

This spec asks for approval of the remaining user-facing changes in the
[AppTest PR queue](https://issues.streamlit.app/agent_wiki_explorer?file=references/2026-07-22-app-testing-fixes.md):
strict lookups by `label` and text, a semantic `AppTest.snapshot()`, command names and
support levels from the shared element descriptions, two fixes where AppTest disagrees
with a browser, cache isolation between tests, and a typed timeout error. Everything else
in that queue is a bug fix or follows an existing widget pattern, and most of it has
shipped.

The broader testing strategy, including how AppTest relates to the agent interface and to
a public Playwright integration (`streamlit.testing.e2e`), is described in the
[app testing toolkit spec (#16041)](https://github.com/streamlit/streamlit/pull/16041).
This spec is the AppTest part of it, cut down to the decisions that block implementation,
so each section can be approved and built on its own.

| § | Change | Kind | Queue row |
| --- | --- | --- | --- |
| [1](#1-strict-label-and-text-filters-on-typed-collections) | `label=`, `text=`, `exact=` on typed collections, and `AppTestLookupError` | New API | P5.1, P5.1b ([#17625](https://github.com/streamlit/streamlit/pull/17625), blocked on this spec) |
| [2](#2-universal-get_by_label-and-get_by_text) | `get_by_label()` and `get_by_text()` | New API | P5.2 |
| [3](#3-apptestsnapshot) | `AppTest.snapshot()` | New API | P5.3 |
| [4](#4-command-names-and-support-levels) | Command names in `get()`, support levels, generated support matrix | API addition | P5.4 |
| [5](#5-raw-option-values-before-a-rerun) | Raw option values before a rerun | Behavior fix | P5.5 ([#10550](https://github.com/streamlit/streamlit/issues/10550)) |
| [6](#6-isolated-caches-per-apptest-instance) | Isolated caches per `AppTest` instance | Behavior change | P5.6 ([#9139](https://github.com/streamlit/streamlit/issues/9139)) |
| [7](#7-fragment--and-dialog-scoped-reruns) | Fragment- and dialog-scoped reruns | Behavior change | P5.7 ([#9786](https://github.com/streamlit/streamlit/issues/9786)) |
| [8](#8-timeout-error-type) | `AppTestTimeoutError` | Small API | C12 |

## Problem

[AppTest](https://docs.streamlit.io/develop/api-reference/app-testing) is Streamlit's
in-process, browserless way to test an app script with pytest, and the bundled
`developing-with-streamlit` skill tells coding agents to use it for committed app tests.
Since July 2026 the queue has fixed its crashes and most coverage gaps. What remains falls
into two groups.

**Tests can only address elements by position or key.** Indexes silently point at a
different element after an unrelated app edit, and keys require editing the app for every
element a test touches:

```python
at = AppTest.from_file("app.py").run()
at.button[2].click().run()  # Which button? Breaks when one is added above.
at.text_input[0].set_value("Ada")  # Same problem.
```

An agent that explored the running app through the
[agent interface](../2026-08-28-agent-app-interface/product-spec.md) sees labels, text,
and command names, but cannot use them in AppTest. AppTest also has no compact description
of the app to print when a lookup fails, and names elements after shared protos: `st.badge`
is `markdown`, `st.line_chart` is `vega_lite_chart`.

**AppTest still disagrees with a browser in two places, lets tests share caches, and
raises one untyped error:**

- **Raw options** ([#10550](https://github.com/streamlit/streamlit/issues/10550)). With
  `format_func`, a value staged before `.run()` is the formatted label, not the option.
  After `.run()` it is the raw option.
- **Cache isolation** ([#9139](https://github.com/streamlit/streamlit/issues/9139)). Two
  `AppTest` instances share `st.cache_data` and `st.cache_resource`, so test results
  depend on test order. Reproduced on current `develop`.
- **Scoped reruns** ([#9786](https://github.com/streamlit/streamlit/issues/9786), the
  most-requested AppTest issue). A click inside a fragment or dialog reruns the whole
  script. A dialog's buttons therefore never fire: the full rerun no longer calls the
  dialog, so the click is lost. Reproduced on current `develop`.
- **Timeout error type.** A script timeout raises a bare `RuntimeError`, unlike other
  failed AppTest actions, which raise `AppTestError`.

### Why this needs a spec

These sections add public API to `streamlit.testing.v1` or change behavior that existing
tests can observe. [#17625](https://github.com/streamlit/streamlit/pull/17625) implements
the first slice of §1 and is labeled `do-not-merge`, because no approved spec covers it.
#16041 covers this area but is still a draft and also covers a new E2E package. This spec
covers only the AppTest changes so they can be approved without waiting for that.

### Already shipped without a spec

These rows fixed bugs or followed an existing pattern (`FileUploader`, `NumberInput`,
`BlockList`), so they are context, not proposals:

- **Compatibility:** unknown proto subtypes parse
  ([#16835](https://github.com/streamlit/streamlit/pull/16835)), unsupported interactions
  raise `AppTestError` ([#16837](https://github.com/streamlit/streamlit/pull/16837)), and a
  proto-variant smoke test ([#16911](https://github.com/streamlit/streamlit/pull/16911)).
- **Fidelity:** form values apply only on submit
  ([#16972](https://github.com/streamlit/streamlit/pull/16972)), empty chat input
  ([#16857](https://github.com/streamlit/streamlit/pull/16857)), query-parameter round trip
  ([#17191](https://github.com/streamlit/streamlit/pull/17191)), and iconed expanders
  ([#17162](https://github.com/streamlit/streamlit/pull/17162)).
- **Coverage:** `at.session_state` dict methods
  ([#16897](https://github.com/streamlit/streamlit/pull/16897)), `get()` accepting
  attribute names ([#17000](https://github.com/streamlit/streamlit/pull/17000)),
  `at.space`, `at.form`, `at.form_submit_button`, callable layout collections,
  `at.progress`, `at.html`, `at.help`, `at.link_button`, `at.page_link`, `at.pagination`,
  `at.audio_input`, `at.camera_input`, chat input files, `at.data_editor`
  ([#17208](https://github.com/streamlit/streamlit/pull/17208)–[#17476](https://github.com/streamlit/streamlit/pull/17476)),
  and seedable `at.user` / `at.context`
  ([#17611](https://github.com/streamlit/streamlit/pull/17611)).
- **Docs:** the testing skill reference
  ([#17496](https://github.com/streamlit/streamlit/pull/17496),
  [#17605](https://github.com/streamlit/streamlit/pull/17605)).

## Proposal

All new API is keyword-only and additive. Existing calls (`at.button[0]`,
`at.button("save")`, `at.get("button")`, `get_by_key()`), collection names, node `type`
values, and the explicit `.run()` model keep working. Sections 5 and 7 change behavior
only where AppTest disagrees with a browser, §6 only to keep tests from sharing caches,
and each is called out in the release notes.

### 1. Strict `label=` and `text=` filters on typed collections

```python
import re

at.button(label="Save").click().run()  # -> Button
at.text_input(label="Name").set_value("Ada").run()  # -> TextInput
at.sidebar.selectbox(label="Country").select("Japan").run()
at.markdown(text=re.compile(r"Revenue: \$12M"))  # -> Markdown
at.expander(label="Details", exact=False)  # -> Expander
at.button("save", label="Save")  # key= and label= must both match
```

Every typed collection, element (`ElementList`) and block (`BlockList`) alike, is already
callable by key. The call gains keyword-only filters, and a block collection returns its
block type:

```python
def __call__(
    self,
    key: str | None = None,
    *,
    label: str | re.Pattern[str] | None = None,
    text: str | re.Pattern[str] | None = None,
    exact: bool = True,
) -> El_co: ...
```

| Rule | Behavior |
| --- | --- |
| Strictness | With `label=` or `text=`, exactly one node must match every given filter, `key` included: filters combine with AND. Zero or several raise `AppTestLookupError`, so `at.button("save", label="Save")` raises it, not `KeyError`, when the button keyed `"save"` has another label. |
| `AppTestLookupError` | A new public exception exported from `streamlit.testing.v1`. It subclasses `AppTestError` and `LookupError`, so one `except LookupError` catches both a key-only `KeyError` and a label or text miss. It does not subclass `KeyError`, because `KeyError.__str__` quotes the message. |
| Key-only calls | `at.button("save")` keeps returning the first match and raising `KeyError`. Changing that would break existing tests. A call with no `key`, `label`, or `text` raises `TypeError`, as it does today. An explicit `key=None` counts as no key and raises `TypeError` too, where today it returns the first element without a key. |
| `label=` | The command's `label` argument as the app passed it, including button text and container labels. Accepted on collections whose command takes a `label` (labeled widgets, `link_button`, `page_link`, `metric`, `expander`, `status`), and on `tabs`, where it matches each tab's entry in the `tabs` list. |
| `text=` | The body the app passed, as Markdown source (`"**Revenue**"`), not rendered text. Accepted on `markdown`, `caption`, `text`, `code`, `latex`, `title`, `header`, `subheader`, the alert collections (`error`, `warning`, `info`, `success`), `toast`, `exception` (its message), and `progress` (its `text`). |
| Normalization | Leading and trailing whitespace is trimmed, and inner whitespace runs are collapsed, on both the query and the value. Keys are compared exactly. |
| `exact=True` (default) | Whole-string, case-sensitive match. |
| `exact=False` | Case-insensitive substring. |
| Regex | `re.search` on the normalized value, so a multi-line body is searched as one line and `re.MULTILINE` anchors match only its ends. Its flags (`re.IGNORECASE`) decide case. `exact` is ignored. |
| Match-all queries | A blank string with `exact=False`, or an empty pattern, raises `AppTestError` instead of selecting whichever node is alone. |
| Unsupported filter | `at.dataframe(label=...)` raises `AppTestError` naming the collections that support the filter. |

`st.badge` has no collection of its own. AppTest stores it as `markdown` whose body is the
badge directive, so `st.badge("New")` is found with `at.markdown(text=":blue-badge[New]")`
or `at.markdown(text="New", exact=False)`, and §4 lists badges under `at.get("badge")`.

Failure messages name the query and list the candidates in that collection:

```text
AppTestLookupError: No button matches label='Delete'. Candidates: label='Save', label='Cancel'.
```

Richer errors, with the scope, the closest match, and the snapshot outline, come with §3.

**API options:**

- **Option 1: keyword filters on the existing typed calls** ✅ PREFERRED. The element type
  is written once and kept in the return type, the shortest change from `at.button("save")`,
  and the same `label` vocabulary as the commands (Standardized Vocabulary, Extend Before
  Inventing).
- **Option 2: separate methods (`at.button.by_label("Save")`).** Adds a second lookup
  method per collection for the same thing.
- **Option 3: only universal `get_by_label()`.** Returns `Node`, so type checkers lose the
  `Button` type and autocompletion. Kept as the cross-type fallback in §2.

**Decisions to approve** (the list #17625 says approval has to cover):

1. **`exact=True` by default.** Testing Library does this too. Playwright defaults to
   substring matching, but then `label="Save"` would also match "Save draft" and raise
   an ambiguity error once that button is added.
2. **`exact=False` is case-insensitive.** Testing Library and Playwright both do this,
   and both normalize whitespace as above.
3. **`text=` matches Markdown source.** AppTest does not render Markdown, and stripping
   markup in Python would only approximate the frontend renderer. The agent interface
   snapshot also keeps Markdown as source. A regex or `exact=False` covers text inside
   markup.
4. **Interim typing.** Until the per-collection typing follow-up (P5.1b), every
   collection shares one `__call__` signature, so type checkers accept
   `at.dataframe(label=...)` and the call raises at runtime. P5.1b returns
   per-collection list types so type checkers reject filters a collection does not
   support (Type Safety Without Burden). The alternative is holding #17625 until P5.1b.
   The runtime error is clear and the next slice removes the gap, so this spec
   recommends shipping the slice now.
5. **Interim errors** list candidates without scope or an outline, as shown above.

### 2. Universal `get_by_label()` and `get_by_text()`

For a lookup where the type is unknown or does not matter, such as an agent that saw a
label in a snapshot, add siblings of the existing `get_by_key()` on `AppTest` and `Block`:

```python
def get_by_label(self, label: str | re.Pattern[str], *, exact: bool = True) -> Node: ...
def get_by_text(self, text: str | re.Pattern[str], *, exact: bool = True) -> Node: ...
```

```python
at.get_by_label("Country")
at.sidebar.get_by_text("Revenue", exact=False)
```

They search every element and block in scope that §1 lets filter by `label` or `text`,
including blocks without a typed collection, such as popovers. They use the same matching
and strictness as §1 and raise `AppTestLookupError`. `get_by_key()` keeps raising
`KeyError` when nothing matches, but its error for a key that several nodes share becomes
an `AppTestLookupError` too, which is compatible because it subclasses `AppTestError`. Docs
lead with §1, because typed lookups keep the precise return type.

The draft in #16041 also has an `element_type=` parameter. This spec leaves it out: the
typed collections in §1 already express the type, and `get_by_key()` has no such
parameter (Start Minimal, Ship Fast). It can be added later without breaking anything.

### 3. `AppTest.snapshot()`

```python
doc = at.snapshot()
print(json.dumps(doc, indent=2))  # Attach to a failing test, or hand to an agent.
```

`snapshot()` returns the agent interface's snapshot document as a JSON-compatible `dict`.
It is built from the same per-command descriptions (shipped in
[#17512](https://github.com/streamlit/streamlit/pull/17512)), under the same
`schema_version`:

- `type` is the command name (`badge`, `line_chart`), `props` keys are parameter names,
  and values are in the form a request can send back. In the snapshot, an option
  widget's `value` and `options` are the formatted labels. The AppTest node's `.value`
  stays the raw option.
- It keeps `schema_version`, `status`, `page`, `pages`, `query_params`, the merged
  `tree` for the current page, the `actions` index, `support` on nodes, and
  `undescribed_types`.
- It leaves out `session_id`, which exists only over HTTP, and `observed_at`, which would
  change on every call. Both are required in an `interact` response, so AppTest
  documents its snapshot as that response without these two fields. A placeholder
  `session_id` would invite an agent to send it back, and making the fields optional
  would weaken the HTTP contract that clients rely on.
- Inside the tree, `data.url` and media URLs are left out, since no server serves them.
- The document is deterministic, so it can back a snapshot test, but docs recommend
  focused assertions, which survive unrelated edits.
- The same app in the same state produces the same `tree` and `actions` through AppTest
  and the agent interface's `interact` endpoint, checked by a parity suite. The
  exceptions are the URLs above, what a truncated table reports instead of `data.url`
  ([open question 2](#open-questions)), and `support`
  ([open question 1](#open-questions)).

Abbreviated:

```json
{
  "schema_version": 1,
  "status": "ready",
  "page": { "url_path": "", "title": "Account" },
  "pages": [{ "url_path": "", "title": "Account" }],
  "query_params": {},
  "tree": {
    "type": "root",
    "children": [
      {
        "type": "main",
        "children": [
          { "type": "title", "props": { "body": "Account" } },
          {
            "type": "selectbox",
            "key": "region",
            "props": { "label": "Region", "options": ["Europe", "AMER"] },
            "value": "Europe"
          },
          { "type": "markdown", "props": { "body": "Revenue: ¥12M" } }
        ]
      }
    ]
  },
  "actions": [{ "key": "region", "kind": "value", "type": "selectbox", "label": "Region" }]
}
```

Lookup errors render the snapshot as a short text outline:

```text
AppTestLookupError: No selectbox matches label='Country' in container key='filters'.
Closest match: selectbox 'Region' key='region'

main
  title 'Account'
  container key='filters'
    selectbox 'Region' key='region' value='Europe'
  markdown 'Revenue: ¥12M'
```

The outline is for reading pytest output only. It is not versioned, and nothing should
parse it.

AppTest marks its own sessions to record agent descriptions, as the agent interface does
for the sessions it creates, because a test can call `snapshot()` after any run. Browser
sessions do not record them. Recording also builds each table's and chart's `data`, so
the implementation measures the added cost on a large AppTest suite. If it is noticeable,
`data` is built only when `snapshot()` is called.

**Format options:**

- **Option 1: the agent interface document** ✅ PREFERRED. An agent reads one format
  whether it checks a running app or writes a test, and the keys, labels, and types it
  finds while exploring carry over to the test it commits.
- **Option 2: an AppTest-specific structure** (for example, collections keyed by type).
  A second vocabulary that drifts from the agent interface within a release.
- **Option 3: the text outline only.** Easy to read, but agents would end up parsing it.

### 4. Command names and support levels

Using the same descriptions:

- **`at.get()` accepts command names** the descriptions report, in addition to today's
  attribute and proto names: `at.get("badge")`, `at.get("line_chart")`,
  `at.get("altair_chart")`, `at.get("map")`. A node's `.type` does not change, and a
  string `at.get()` already accepts keeps today's result: `at.get("markdown")` still
  includes badges, `at.get("button")` form submit buttons, `at.get("dataframe")` data
  editors, and `at.get("tabs")` / `at.get("columns")` the tab and column blocks rather
  than the `st.tabs` / `st.columns` container, which a test reaches with
  `get_by_key()`. The narrower commands use their own names, such as
  `form_submit_button`, `data_editor`, `line_chart`, and `map`.
- **Unsupported interactions say why.** An interaction AppTest cannot perform raises
  `AppTestError` with the element's support reason and a pointer to browser testing.
  Today the error names the element type and gives the same generic advice for every
  element that is not a widget.
- **A generated support matrix** in the docs replaces the hand-written capability list.
  It has three levels:

| Level | Meaning |
| --- | --- |
| Interactive | Inspectable, and every interaction it accepts can be performed in AppTest. |
| Inspectable | Reported accurately, but some input a browser user can give, such as a chart selection, cannot be sent. |
| Browser-only | What renders may differ from what is reported, such as a custom component. Interaction requires a browser test. |

These are the agent interface's `support` values with readable names: Interactive has no
`support` field, Inspectable is `action_unsupported`, and Browser-only is
`browser_required`. The draft in #16041 calls the middle one `read_only_in_v1`, but the
shipped agent interface uses `action_unsupported`.

### 5. Raw option values before a rerun

```python
sb = at.selectbox(key="customer")  # options are dicts, format_func=lambda c: c["name"]
sb.options  # ['Ada', 'Grace'], the labels a user sees (unchanged)
sb.select_index(1)
sb.value  # today: 'Grace'; proposed: {'id': 2, 'name': 'Grace'}
at.run()
sb.value  # {'id': 2, 'name': 'Grace'} (unchanged)
```

AppTest resolves a value staged before `.run()` to the raw option, as it already does
after `.run()`. That covers `select_index()`, a formatted label passed to `set_value()`,
`select()`, `unselect()`, or `click()`, and every entry of a list or range value, on
`selectbox`, `radio`, `multiselect`, `select_slider`, `pills`, `segmented_control`, and
`menu_button`. `.options` keeps returning labels, the strings a user sees, which the
snapshot reports and `select()` accepts.

When a staged string is both an option and another option's label, the option wins, as it
already does after `.run()`. Options that share a label cannot be told apart once the
value is sent, in a browser too: the server resolves the label to the last of them. So
staging any of them, by label, by option, or with `select_index()`, raises `AppTestError`,
as the agent interface refuses it. A value that is neither an option nor a label behaves
as today.

- **Option 1: fix staged values, keep `.options`** ✅ PREFERRED. No new API, and closes
  #10550.
- **Option 2: Option 1 plus a `raw_options` property.** A new property that no issue asks
  for yet. It can be added later.
- **Option 3: `.options` returns raw options.** Breaks every test that asserts on labels,
  and differs from the snapshot.

Behavior change: `.value` read between staging and `.run()` returns the option, not its
label, and staging an option whose label another option shares raises `AppTestError`
instead of silently selecting the last of them.

### 6. Isolated caches per `AppTest` instance

Each `AppTest` instance starts with empty `st.cache_data` and `st.cache_resource` caches.
Within one instance, caches persist across `.run()` calls, as they do on one server, and
`st.cache_data.clear()` inside the app clears only that instance's caches. This is test
isolation, not browser fidelity, and it deliberately differs from production: sessions on
one server keep sharing caches by design, while a test needs a known starting state
rather than whatever an earlier test cached.

Code in the test body outside any run, such as a cached helper a test calls directly or
`st.cache_data.clear()` in a fixture, keeps using the process-wide caches, which no
instance reads. That fixture becomes harmless and unnecessary. Entries a function stores
with `persist="disk"` are isolated too: each instance keeps them in its own temporary
directory, so a test never loads a file an earlier test wrote.

- **Option 1: isolated by default** ✅ PREFERRED. Tests pass or fail regardless of order,
  which is what #9139 expects and what tests need.
- **Option 2: opt-in (`AppTest.from_file(..., isolate_caches=True)`).** Keeps the leak as
  the default, and most users would never find the parameter.
- **Option 3: document `st.cache_data.clear()` in a fixture.** This clears caches rather
  than isolating them. It also clears caches that other live `AppTest` instances still
  use, and teams must remember to do it for every cache type.

Behavior change: a suite that loads an expensive resource (a model, a connection) through
`st.cache_resource` in the app now loads it once per test instead of once per process.
Tests can mock the resource. An explicit sharing opt-in is out of scope until users ask
for it. A likely implementation moves the cache registries from module globals onto the
`Runtime`, as the abandoned [#9993](https://github.com/streamlit/streamlit/pull/9993)
tried. A tech spec decides that, including how concurrent instances behave and how
production sharing and the cache hit path stay unchanged.

### 7. Fragment- and dialog-scoped reruns

A changed widget's scope is the innermost fragment or dialog it was rendered in, as the
agent interface resolves it. When every widget a test changed before `.run()` has the
same scope, `.run()` reruns only that fragment or dialog, as a browser does. Elements
outside it keep their last output. Otherwise `.run()` is a full rerun, as today. In
detail:

- A `.run()` with no changes is a full rerun.
- Only widget interactions count as changes: `set_value()`, `click()`, `select()`, an
  upload, a form submit, and the other widget methods. Writes to `at.session_state` or
  `at.query_params` count as changes outside every fragment, since a browser never makes
  them from inside one.
- Changes in more than one scope run as a full rerun, unless any of them is in a dialog.
  A full rerun closes a dialog without running its contents and discards what the test
  sent to it. So when the changes do not all share one scope and any of them is in a
  dialog, `.run()` raises `AppTestError`. That includes a dialog widget plus one in a
  fragment nested in that dialog. The agent interface refuses the same request
  (`cross_dialog_batch`), and a browser cannot produce it.

```python
# App from #9786: a dialog whose "confirm" button sets state and calls st.rerun().
at = AppTest.from_file("app.py").run()
at.button(key="k_btn_confirmation_dialog").click().run()  # opens the dialog
at.button(key="k_btn_confirm").click().run()  # reruns only the dialog
assert at.session_state.confirm is True  # today: False
```

`st.rerun()` and `st.rerun(scope="fragment")` inside the scope behave as in a browser.

- **Option 1: scoped by default** ✅ PREFERRED. Matches the browser and fixes #9786
  without new API.
- **Option 2: opt-in (`at.run(scope="fragment")`).** The test must know where each widget
  lives, and the default stays wrong.
- **Option 3: leave it to browser tests.** AppTest is the recommended tool for app logic,
  and #9786 is its most-requested issue.

Behavior change: code outside a fragment no longer reruns when a test clicks a widget
inside it, so a test that counted those outside reruns changes. This is the largest
change in this spec. It needs a scoped-rerun model in AppTest, likely shared with the
agent interface's headless client as #16041 suggests, and a tech spec.

### 8. Timeout error type

A script timeout raises `AppTestTimeoutError`, exported from `streamlit.testing.v1`, with
today's message. It subclasses both `AppTestError` and `RuntimeError`, so
`except AppTestError` catches timeouts like other failed AppTest actions, and existing
`pytest.raises(RuntimeError)` tests keep passing. The alternatives are keeping
`RuntimeError`, which leaves the inconsistency, or raising plain `AppTestError`, which
breaks those tests.

## Rollout

Each step ships as one or more PRs of under 1,000 lines, tracked in the queue, and each
section can be approved independently. Sections 1, 2, 5, and 8 do not depend on the
agent interface.

1. §1 first slice ([#17625](https://github.com/streamlit/streamlit/pull/17625)), then the
   remaining collections and per-collection typing (P5.1b).
2. §2, §5, and §8, in any order.
3. §4, then §3, then the richer lookup errors from §3.
4. §6 and §7, each after its tech spec.

Each PR updates the testing skill reference
(`developing-with-streamlit/references/testing.md`) and the AppTest docstrings for the
behavior it ships. It adds unit tests for each rule it implements, typing tests for new
signatures, and, for §3, the parity suite against `interact`.

## Out of scope (future work)

- **Everything else in #16041:** `streamlit.testing.e2e`, the verification-strategy docs,
  widget constraint validation
  ([#16203](https://github.com/streamlit/streamlit/issues/16203)), and the
  `bind="query-params"` URL write-back
  ([#17250](https://github.com/streamlit/streamlit/issues/17250)).
- **Automatic reruns after each interaction.** Only in an AppTest v2 discussion.
- **A Testing Library-style `query` / `find` matrix.** AppTest's tree does not change
  after `.run()`, so `find_*` would imply waiting that does not exist.
- **`element_type=` on `get_by_*`, `raw_options`, a typed `at.badge` collection, and a
  shared-cache opt-in.** Add them when users ask.
- **`Block.snapshot()`** for part of the page.
- **`run_every` timers, a dialog dismiss action, and an `at.dialog` collection.** Dialog
  contents stay reachable through typed collections and the `get_by_*` methods.
- **Browser-only interactions:** data editor cell edits, chart and dataframe selections,
  and custom-component JavaScript. These belong in browser tests.

## Open questions

1. **Does `support` in `AppTest.snapshot()` describe AppTest or the agent interface?**
   AppTest can upload files to `st.file_uploader`, `st.camera_input`, and
   `st.audio_input`, which the agent interface marks `action_unsupported`. The
   recommendation is that each driver reports its own capabilities, because a client
   reads `support` to decide what it can do in that driver. The snapshot would then
   match `interact` everywhere except `support`.
2. **What do tables report in place of `data.url`?** The agent interface requires every
   truncated preview to carry `data.url` or `data.unavailable`, but AppTest has no URL:
   the full data is the element's Python `.value`. The shared schema needs a value for
   that case (#16041 open question 2). The recommendation is a new `unavailable` reason
   whose description points to the element's `.value`, so a table still satisfies the
   schema and the parity suite compares everything else in its `data`.
3. **Is a shared-cache opt-in needed when §6 ships?** This spec says no. Approvers may
   prefer to ship one with it for suites that load large models.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | ✅ AppTest runs in the test process, independent of platform. §6 isolates caches per `AppTest` instance without changing production cache sharing. |
| No breaking API changes | ✅ for the API: every addition is keyword-only, and key-only lookups keep their behavior, except that an explicit `key=None` now raises `TypeError`. §5 and §7 change behavior where AppTest disagrees with a browser, and §6 where tests shared caches. Tests that relied on the old behavior can fail. The release notes call out each one. §8 keeps `RuntimeError` compatibility. |
| No new dependencies | ✅ |
| Metrics collected | No new telemetry. Track the `feature:app-testing` issues and docs feedback. |
| Any security/legal impact? | Snapshots contain app-authored text, so docs tell agents to treat it as data, not instructions, as the agent interface does. The snapshot follows the shared rules: password values are write-only and secrets never appear. |
| Any docs changes needed? | AppTest API reference (filters, `get_by_*`, `snapshot()`, the new exceptions), a generated support matrix, release notes for §5–§7, and the bundled testing skill reference. |
