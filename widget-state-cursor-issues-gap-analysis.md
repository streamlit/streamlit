# Widget State, `st.empty`, and Cursor/Delta-Path Issues — Gap Analysis

**Author:** Cloud research agent
**Date:** 2026-06-04
**Repo:** `streamlit/streamlit` (`develop`)
**Scope:** State management, widget lifecycle, container lifecycle, and cursor/delta-path
issues. Purely visual/CSS layout issues (width, spacing, sticky, shadow, flex, etc.) are
explicitly excluded.

---

## 1. Executive Summary

Streamlit has a long tail of user-reported issues that all trace back to a small number of
architectural facts:

1. A widget's **identity** is derived from its position in the render tree (delta path)
   plus its parameters, and its **state is transient** — it is deleted when the widget is
   not rendered in a run.
2. **Containers and layout blocks remount** (and reset their frontend-only state) when their
   delta path shifts because something above them appeared/disappeared.
3. **Cursors / delta paths** can become stale or accumulate when elements are rewritten in
   the same run (`st.empty`), when fragments write to containers outside their scope, or
   when transient elements (spinners) and containers interleave.

I triaged **334 unique issues** gathered across the `feature:st.empty`, `feature:state`,
`feature:st.container`, `area:widgets`, `feature:st.fragment`, `feature:st.tabs`,
`feature:st.expander`, and `feature:callbacks` labels, plus keyword searches
(`DuplicateWidgetID`, `delta path`, `stale widget`, `widget state`, `cursor`,
`st.empty clear`). After excluding pure-CSS/layout and unrelated requests, I read the full
body and **all comments** of **~70 on-theme issues** and grouped them into **10 themes**.

**Coverage assessment against the four projects** (Dynamic/Stateful Containers — shipped;
Widget state persistence / `persist_state` — spec in review; Outside container writes —
prototype + cursor tech spec in review; Parallel fragments — shipped):

| Status | Themes |
|---|---|
| **Largely solved** | T2 (layout-container remount reset), T3 (tab/expander control & lazy exec), T9 (query-param binding), several fragment-disappearance bugs in T6 |
| **Partially solved** | T1 (widget-not-rendered persistence), T4 (widget identity vs. dynamic defaults), T6 (fragment + outside-container cursor), T8 (mid-run/stale clearing) |
| **Not solved / gap** | T1 auto-without-key, **T5 (`st.empty` widget-state cleanup / `DuplicateWidgetID`)**, T4 dynamic-default regression, T7 (container reuse / stored DG cursor corruption), T10 (custom-component state sync, fragment interruption, explicit reset API) |

**The single largest unaddressed gap is Theme 5: `st.empty()` (and container rewrites) do
not clean up backend widget IDs**, producing `DuplicateWidgetID` errors. The flagship issue
[#5044](https://github.com/streamlit/streamlit/issues/5044) (21 👍, 21 comments, open since
2022) is **not** covered by any of the four projects. The Outside-Container-Writes cursor
tech spec ([#15413](https://github.com/streamlit/streamlit/pull/15413)) touches the same
cursor machinery but is scoped to fragments, not `st.empty`.

A second important gap is the **fallout of the widget-identity change** (key-only identity,
[#11277](https://github.com/streamlit/streamlit/issues/11277)): it fixed "widget resets when
a parameter changes," but created a new, actively-painful class of reports
([#12880](https://github.com/streamlit/streamlit/issues/12880),
[#12629](https://github.com/streamlit/streamlit/issues/12629)) where a dynamic `value=` /
`index=` is now silently ignored when `key=` is set, with users pinning old versions.

---

## 2. Methodology

### Gathering

Issues were collected with the GitHub GraphQL API (the REST/`gh search` label filter
returned 0 for `feature:st.empty` due to an index quirk; GraphQL `repository.label.issues`
worked correctly). For each label I paginated all OPEN+CLOSED issues capturing
number, title, state, createdAt, reaction count, comment count, and labels:

```
labels = [feature:st.empty (5), feature:state (46), feature:st.container (41),
          area:widgets (134), feature:st.fragment (47), feature:st.tabs (39),
          feature:st.expander (32), feature:callbacks (14)]
→ 334 unique issues
```

Keyword issue searches (`DuplicateWidgetID`, `delta path`, `stale widget`,
`widget state reset`, `st.empty clear`) were used to catch unlabeled/cross-cutting items.

### Filtering & grouping

I scored issues by on-theme keywords in the title and always retained anything labeled
`feature:st.empty`, `feature:state`, or `feature:st.container`. I excluded pure visual/CSS
requests (e.g. "Flex layout", "Add shadow around `st.container`", "Sticky containers",
"height argument") and new-widget feature requests unrelated to state lifecycle (stepper,
breadcrumbs, markdown editor, etc.). This produced a focused set of ~70 issues whose full
body + every comment I read. Issues were then grouped by **underlying problem**, not by the
surface error string.

### Project context read

- Dynamic/Stateful Containers — `specs/2026-01-14-dynamic-tabs-expander/product-spec.md`,
  `specs/2026-02-26-layout-container-state-persistence/tech-spec.md`; PRs #13851, #13910,
  #14330, #14332, #14356.
- Widget state persistence — `specs/2026-01-06-query-param-binding-state-persistence/product-spec.md`
  (covers both query-param binding and `persist_state`).
- Outside container writes — PRs #13621 (prototype), #15398 (feature), #15413 (cursor tech
  spec), #15406 (diagnosis), #15387 (`st.empty().container()` same-run fix).
- Parallel fragments — `specs/2026-03-05-parallel-fragments/tech-spec.md`; PRs #15214,
  #15251 (API restrictions including external container writes).

---

## 3. The Four Projects (reference)

| # | Project | Status | What it does (relevant to this analysis) |
|---|---|---|---|
| **P1** | Dynamic/Stateful Containers | Shipped (Feb 2026) | `on_change="ignore"/"rerun"/callback`, `.open` attribute, programmatic control via `session_state` for `st.tabs`/`st.expander`/`st.popover`; **lazy execution**. Plus **layout-container state persistence**: a stable `Block.id` for keyed passive containers so selected tab / expanded / open survive a remount, restored from the frontend `WidgetStateManager.elementStates` store. Requires explicit `key=`. |
| **P2** | Widget state persistence (`persist_state`) | Tech spec in review | New per-widget `persist_state=None\|"page"\|"session"` to keep widget state when the widget is **not rendered** and/or across **page switches**. |
| **P3** | Outside container writes | Prototype + cursor tech spec in review | Let `@st.fragment` write **widgets** to containers declared outside the fragment without duplication; cursor tech spec (#15413) adds **implicit wrapper containers** (one `RunningCursor` per `(fragment_id, container_id)`) to isolate and reset fragment writes, fixing cursor accumulation. |
| **P4** | Parallel fragments | Shipped (May 2026) | `@st.fragment(parallel=True)`; **API restrictions** that *block* external container writes and other structural side-effects during concurrent execution (thread safety). |

---

## 4. Theme Analysis

Demand signal is reported as 👍 reactions / comments on the primary issue(s). "State" =
open/closed.

### T1 — Widget state lost when the widget is not rendered (or page switches)

**Issues:** [#6074](https://github.com/streamlit/streamlit/issues/6074) (43👍/15c, open,
primary), [#5813](https://github.com/streamlit/streamlit/issues/5813) (8👍/9c, open),
[#4458](https://github.com/streamlit/streamlit/issues/4458) (34👍/11c, closed→#6074),
[#6350](https://github.com/streamlit/streamlit/issues/6350) (closed→#6074),
[#3890](https://github.com/streamlit/streamlit/issues/3890),
[#3873](https://github.com/streamlit/streamlit/issues/3873),
[#1735], [#1041] (sidebar checkbox loses state on slow load).

**User need:** Devs set `key=` expecting the value to persist, but it's deleted the moment
the widget isn't rendered (a hidden tab, a collapsed branch, another page). The recurring
quote: *"passing `key` is an explicit attempt to save the widget state… except it doesn't."*
Workarounds everywhere use "shadow keys" or `st.session_state.update(st.session_state)`.

**Demand:** Very high and long-standing (43+34 👍 across the two main threads; team confirms
"a thread about *why am I losing my widget state* every other day").

**Assessment — PARTIALLY SOLVED (P2).** This is the explicit target of the `persist_state`
spec (P2), which lists #6074 and #5813 as its driving issues. It directly addresses the need
with `persist_state="page"` / `"session"`. **Gap until P2 ships** (still a tech spec); and
the spec keeps `persist_state` opt-in per widget, so the common ask for *default* persistence
(many commenters want `persist=True` by default) is intentionally not met.

---

### T2 — Layout containers remount and reset frontend state when something above them changes

**Issues:** [#8239](https://github.com/streamlit/streamlit/issues/8239) (99👍/10c, the
canonical request), [#6257](https://github.com/streamlit/streamlit/issues/6257) (10👍/15c —
component in tab 2 jumps back to tab 1), [#2360](https://github.com/streamlit/streamlit/issues/2360)
(14c — expander resets when elements added above), [#2241](https://github.com/streamlit/streamlit/issues/2241)
(→#2360), [#4651](https://github.com/streamlit/streamlit/issues/4651) (expander loses values
unless expanded), [#12554](https://github.com/streamlit/streamlit/issues/12554),
[#11160](https://github.com/streamlit/streamlit/issues/11160),
[#7040](https://github.com/streamlit/streamlit/issues/7040) (ghost tabs),
[#14943](https://github.com/streamlit/streamlit/issues/14943) (popover reopens — fixed by
#14945).

**User need:** A conditional `st.write`/spinner above `st.tabs` toggles → delta path of the
tabs shifts → React remounts → active tab/expander/popover resets. `MathCatsAnd`'s minimal
repro in #6257 nailed the root cause: *any* content difference before the container triggers
it.

**Demand:** Very high (#8239 at 99 👍 is one of the most-reacted state issues).

**Assessment — LARGELY SOLVED (P1, layout-container state persistence).** PRs #14330/#14332/
#14356 give keyed tabs/expander/popover a stable `Block.id` and restore selected-tab /
expanded / open state across remounts from `elementStates`. The team posted the resolution
directly on #8239. **Remaining gaps:**
- **Requires explicit `key=`.** Without a key the reset still happens. This is tracked as the
  explicit follow-up [#14492](https://github.com/streamlit/streamlit/issues/14492)
  ("persist automatically") — **not solved**.
- **Tab identity is label-based.** Stored state is keyed by the active tab *label*, so
  renaming a tab (e.g. adding a ✔/badge on completion — exactly the use cases in
  [#7435](https://github.com/streamlit/streamlit/issues/7435) and
  [#12342](https://github.com/streamlit/streamlit/issues/12342)) loses the selection. See T4'.
- Widgets *inside* a collapsed expander still lose value (that's T1, not remount).

---

### T3 — Can't read or control tab/expander/popover open state; everything runs eagerly

**Issues:** [#6004](https://github.com/streamlit/streamlit/issues/6004) (**244👍/49c** — by
far the highest-demand issue in this analysis), [#2399](https://github.com/streamlit/streamlit/issues/2399)
(102👍/44c — expander expanded/collapsed state), [#6370](https://github.com/streamlit/streamlit/issues/6370)
(can't close expander after user opens it), [#14528](https://github.com/streamlit/streamlit/issues/14528)
(`.update()` for the three containers), [#4321] (run expander content only when expanded).

**User need:** Know which tab is active / whether an expander is open, control it
programmatically, and avoid executing hidden/expensive content.

**Demand:** Extremely high (#6004 + #2399 ≈ 346 👍 combined).

**Assessment — LARGELY SOLVED (P1, dynamic containers).** The shipped `on_change` parameter,
`.open` attribute, lazy execution, and `session_state`-based programmatic control are exactly
this. **Remaining gap:** the `.update(open=…)` imperative method (#14528) is listed only as a
*potential future extension* in the product spec and has **not** shipped — partial.

---

### T4 — Widget resets when a parameter changes (identity tied to all args)

**Issues:** [#11277](https://github.com/streamlit/streamlit/issues/11277) (29👍/11c, closed —
"persist widget identity when key is set, even if parameters change"),
[#1259](https://github.com/streamlit/streamlit/issues/1259) (selectbox state lost when
options change, closed→fixed), [#4318](https://github.com/streamlit/streamlit/issues/4318)
(disabling a widget resets it), [#5125](https://github.com/streamlit/streamlit/issues/5125),
[#3285](https://github.com/streamlit/streamlit/issues/3285),
[#3716](https://github.com/streamlit/streamlit/issues/3716).

**User need:** Changing `disabled=`, `options=`, `index=` etc. shouldn't wipe the user's
selection.

**Assessment — SOLVED, but introduced a regression (see T4').** The widget-identity change
(key-only identity, shipped progressively in ~v1.50) closed #11277 and #1259: when `key=` is
set, the identity is based on the key, so parameter changes no longer reset the widget.
`data_editor` is the one remaining exception (tracked in #7749).

---

### T4' — *Regression:* dynamic `value=` / `index=` silently ignored when `key=` is set

**Issues:** [#12880](https://github.com/streamlit/streamlit/issues/12880) (5👍/9c, open),
[#12629](https://github.com/streamlit/streamlit/issues/12629) (12👍/9c, open),
[#9082](https://github.com/streamlit/streamlit/issues/9082) (open).

**User need:** Set a widget's default from a database value / query param / another widget,
*while* also having a `key`. After the identity change this no longer works — the default is
treated as a one-time seed and ignored on rerun. Multiple users report pinning v1.49 and
"this broke my app badly."

**Demand:** Moderate and growing; notable because these are **regressions** from a shipped
change, not pre-existing gaps.

**Assessment — NOT SOLVED (gap created by T4's fix).** None of the four projects address it.
The official guidance is "use a callback or set `st.session_state[key]` before the widget,"
which users find verbose and non-obvious. There is no first-class API to say "this is a
controlled widget; honor my dynamic default." This is a real, actively-painful gap that the
team is "keeping open to collect feedback" on. **Recommendation candidate.**

---

### T5 — `st.empty()` / container rewrites don't clean up backend widget IDs → `DuplicateWidgetID`, ghost elements

**Issues:** [#5044](https://github.com/streamlit/streamlit/issues/5044) (**21👍/21c, open,
confirmed, P3** — the flagship), [#12069](https://github.com/streamlit/streamlit/issues/12069)
(3👍/5c, open — `st.empty` does not clear removed elements),
[#2395](https://github.com/streamlit/streamlit/issues/2395) (`widget.empty()` clears only at
end of script), [#1924](https://github.com/streamlit/streamlit/issues/1924)
(`DuplicateWidgetID` when toggling a widget with a button — resolved via new state model +
callbacks), [#5715](https://github.com/streamlit/streamlit/issues/5715) (misleading error
message — fixed), [#14280](https://github.com/streamlit/streamlit/issues/14280)
(`container.empty()` + `st.rerun()` loop leaves stale/greyed elements),
[#4652](https://github.com/streamlit/streamlit/issues/4652) (empty container shows greyed
duplicate while running).

**User need:** Clear a placeholder and re-draw widgets in it (chat UIs, config-driven
dynamic forms, streaming partial→final renders). Today re-creating a widget with the same key
after `.empty()` raises `DuplicateWidgetID`, because **the backend never removes the old
widget IDs from `widget_ids_this_run`** — it's all within one script run. Workarounds:
unique key suffixes, `time.sleep()` after empty, nest a `container()` inside the `empty()`.
None are reliable (see `MathCatsAnd`'s gist showing inconsistent column clearing).

The maintainer root-cause (raethlein, #5044) is explicit: *"we'd need to associate
`script_run_context.widget_ids_this_run` with a delta path (e.g. of `st.empty`)… so we can
remove the id(s) before registering the new widgets."* A PoC exists (PR #10186) but was never
merged. For #12069, the same-run child-inheritance variant has a candidate fix in PR #15387
(open).

**Demand:** High and chronic (open since 2022; steady stream of "any update?" and "every
workaround failed" comments; blocks dataframe row-selection inside `st.empty`).

**Assessment — NOT SOLVED. This is the biggest gap.**
- P1/P2 are about *persisting* state, not *cleaning it up*; they don't touch this.
- P3's cursor tech spec (#15413) reworks cursor/`RunningCursor` management — the *same*
  machinery — but is scoped to **fragments writing to outside containers**, not to `st.empty`
  rewrites. It could be a foundation, but `st.empty` widget-ID cleanup is explicitly out of
  its scope.
- P4 only *restricts* writes during parallel execution.
- PR #15387 fixes the narrow same-run stale-children case for `st.empty().container()`
  (#12069); PR #10186 (the `DuplicateWidgetID` fix for #5044) is an unmerged PoC.

**Recommendation candidate (highest priority).** The needed work — a delta-path → widget-id
mapping so overwritten/cleared paths drop their widget IDs before re-registration — is
well-understood and partially prototyped, and would also enable mid-run clearing (T8).

---

### T6 — Fragments + containers: cursor/delta-path corruption, disappearing elements, duplication

**Issues:** [#12762](https://github.com/streamlit/streamlit/issues/12762) (3👍, closed
"expected" — key ignored / duplication when a fragment writes to an outside container),
[#12514](https://github.com/streamlit/streamlit/issues/12514) (5👍, open — fragments inside a
container disappear on rerender; `ClearStaleNodeVisitor` clears them),
[#13634](https://github.com/streamlit/streamlit/issues/13634) (2👍/14c — first widget above a
fragment disappears when the fragment calls a cached function; mostly fixed in 1.53),
[#9372](https://github.com/streamlit/streamlit/issues/9372) (custom component content
disappears in fragment+container — fixed PR #9381),
[#9188](https://github.com/streamlit/streamlit/issues/9188) (fragment elements disappear —
fixed #9381/#9389), [#9313](https://github.com/streamlit/streamlit/issues/9313) (12👍 — wrong
fragment value, fixed 1.38 #9246), [#10719](https://github.com/streamlit/streamlit/issues/10719)
(nested periodic fragments → `StreamlitDuplicateElementId`, open),
[#13024](https://github.com/streamlit/streamlit/issues/13024) (fragment wraps content in an
implicit container → layout/behavior surprises, open),
[#8494](https://github.com/streamlit/streamlit/issues/8494) (35👍 — "Could not find fragment
with id," largely fixed), [#11660](https://github.com/streamlit/streamlit/issues/11660)
(13👍 — "fragment does not exist anymore" after server restart/reconnect, open).

**User need:** Use `@st.fragment` to update a shared/outside container (the "shared output
area" pattern), nest fragments, or run periodic fragments — without elements duplicating or
vanishing.

**Demand:** Broad (many medium-sized issues; #8494 at 35👍).

**Assessment — PARTIALLY SOLVED.**
- **Writing widgets to outside containers** (#12762) is the explicit target of P3. The
  prototype (#13621/#15398) removes `check_fragment_path_policy()` and fixes element-level
  stale clearing; the cursor tech spec (#15413) adds implicit wrapper containers to stop
  cursor accumulation. **Still in review / prototype**, with known crashes on buttons in
  top-level outside containers (#15406) — so currently a partial/in-flight fix.
- **Disappearing-element bugs** (#9372, #9188, #9313, much of #13634) were genuinely fixed by
  past fragment-cursor work (#9246, #9381, #9389) — solved.
- **Remaining gaps:** nested periodic fragment duplicate IDs (#10719) and the
  fragment-as-implicit-container design (#13024) are acknowledged by the team as needing a
  deeper redesign (remove the wrapping container / track fragments via the React VDOM) and
  are **not** in any of the four projects' current scope. #12514 (stale clearing of nested
  fragments in containers) overlaps P3's cursor work but isn't confirmed covered.

---

### T7 — Reusing/storing a container (DeltaGenerator) across runs → stale cursor / "Bad `setIn` index"

**Issues:** [#6969](https://github.com/streamlit/streamlit/issues/6969) (7👍/10c, open —
storing `st.container` in `session_state`; "Bad message format / Bad `setIn` index"; recurs
across many versions incl. LangChain `StreamlitCallbackHandler`),
[#5880](https://github.com/streamlit/streamlit/issues/5880) (writing to an empty container
captured in a callback closure — closed "expected"), [#5402] (same `setIn` error from
`cache_data` in a thread).

**User need:** Capture a container once and write into it later (callbacks, background
threads, streaming handlers). The captured cursor/delta path goes stale when the tree
changes, crashing the connection.

**Demand:** Moderate but persistent and high-impact (full "Bad message format" crash; multiple
users downgrade).

**Assessment — NOT SOLVED.** None of the four projects cover storing/reusing a DG across runs.
P3's per-fragment wrapper cursors are conceptually related (isolating cursor state) but don't
make a stored container's delta path stable across runs. At minimum the team agreed a clear
warning is warranted (storing elements in session state is unsupported). **Gap.**

---

### T8 — No way to clear stale elements mid-run; stale (greyed) elements linger while running

**Issues:** [#14280](https://github.com/streamlit/streamlit/issues/14280) (`container.empty()`
in an `st.rerun()` polling loop never clears — stale nodes only removed at end of run),
[#12069](https://github.com/streamlit/streamlit/issues/12069) (same-run rewrite leaves
children), [#4652](https://github.com/streamlit/streamlit/issues/4652) (greyed duplicate
visible while app is running), plus the referenced feature request #10126 (`st.close()`/
`st.end()` to discard stale elements mid-run) and #6063 (clean-slate rendering).

**User need:** During long/streaming runs, remove no-longer-emitted elements *immediately*
rather than at the end of the script run; an explicit "clear remaining stale elements" API.

**Assessment — PARTIALLY SOLVED / mostly gap.** PR #15387 fixes the specific same-run
`st.empty().container()` child-inheritance case (#12069). But the general behavior — stale
nodes (rendered greyed) are only garbage-collected by `clearStaleNodes` at the end of a run,
so `st.rerun()` loops and long streams show lingering ghosts — is **not** addressed by any of
the four projects. A first-class mid-run clear (#10126) does not exist. Closely coupled to T5.

---

### T9 — Binding widget state to the URL / query params

**Issues:** [#14670](https://github.com/streamlit/streamlit/issues/14670) (7👍 — set widget
state with `bind="query-params"`, resolved by #14744), [#302] (bookmarkable apps via query
params), [#13609](https://github.com/streamlit/streamlit/issues/13609) (bind to
localStorage).

**Assessment — LARGELY SOLVED (P2, query-param half).** The query-param-binding work
(PRs #13681, #13951, #14202, #14374, #14744) ships `bind="query-params"` and fixes the
related reset bug (#14670). **Gap:** `bind="localstorage"` (#13609) is noted as a future
extension only.

---

### T10 — Adjacent needs not owned by any of the four projects

These are clearly in the "widget state / lifecycle" family but fall outside all four projects.

- **Custom component value not updating via `session_state`**
  ([#5690](https://github.com/streamlit/streamlit/issues/5690), 7👍/8c, open): setting a
  component's `session_state` key in a callback doesn't update the frontend component. This is
  a custom-components (v1/v2) concern — **not solved**, out of scope of all four projects.
- **Fragment cannot be interrupted** ([#11030](https://github.com/streamlit/streamlit/issues/11030),
  2👍/6c, open): a button click during a long fragment loop is queued, not preemptive; users
  must hand-roll iterative `st.rerun(scope="fragment")` loops. Control-flow concern — **not
  solved** (P4 adds parallelism but not interruption).
- **`st.rerun(scope="fragment")` from parallel fragments during full-app runs**
  ([#14968](https://github.com/streamlit/streamlit/issues/14968), 3👍, open): a P4 follow-up
  enhancement — not yet covered.
- **No explicit "reset widget" API** ([#5442](https://github.com/streamlit/streamlit/issues/5442),
  [#3841](https://github.com/streamlit/streamlit/issues/3841)): deleting a widget's
  `session_state` key does not reset it ("expected" per team). Users repeatedly expect
  `del st.session_state[key]` or `.clear()` to reset widgets. **Not solved** — could be folded
  into the T1/T5 cleanup work.
- **`st.stop()` desyncs session-state→widget propagation**
  ([#4247](https://github.com/streamlit/streamlit/issues/4247)): obscure edge case — not
  solved.
- **Session loss on websocket reconnect** ([#4297](https://github.com/streamlit/streamlit/issues/4297),
  [#4925](https://github.com/streamlit/streamlit/issues/4925)): largely addressed by the older
  session-manager work (~v1.19); reconnect still surfaces fragment "does not exist anymore"
  spam (#11660).
- **Race: input not saved when a blocking action precedes it**
  ([#7862](https://github.com/streamlit/streamlit/issues/7862)): button event processed before
  text_area event — not solved (workaround: `key`).

---

## 5. Gap Summary Table

| Theme | Demand (👍) | Status | Project(s) | Remaining gap |
|---|---|---|---|---|
| **T1** Widget state lost when not rendered / on page switch | #6074:43, #4458:34, #5813:8 | Partial | **P2** (`persist_state`) | P2 still a spec; opt-in only (no default persistence); page-vs-session semantics TBD |
| **T2** Layout container remount resets tab/expander/popover | #8239:99, #6257:10 | Largely solved | **P1** (layout state persistence) | Requires `key=`; auto-without-key is #14492 (open); see T4' for label-based tab identity |
| **T3** Read/control open state + lazy execution | #6004:244, #2399:102 | Largely solved | **P1** (dynamic containers) | `.update(open=…)` (#14528) not shipped |
| **T4** Widget resets when a parameter changes | #11277:29 | Solved | (widget-identity change) | `data_editor` still excepted (#7749) |
| **T4'** Dynamic `value=`/`index=` ignored when `key=` set (regression) | #12629:12, #12880:5 | **Not solved** | none | No first-class "controlled default" API; users pin old versions |
| **T5** `st.empty`/container rewrite leaves widget IDs → `DuplicateWidgetID`/ghosts | **#5044:21**, #12069 | **Not solved** | none (P3 cursor work adjacent) | Need delta-path→widget-id cleanup; PoC #10186 unmerged; #15387 fixes only narrow #12069 case |
| **T6** Fragment + container cursor corruption / vanish / duplication | #8494:35, #9313:12 | Partial | **P3** (+ past fixes) | P3 in review with known crashes (#15406); nested periodic dup IDs (#10719) & fragment implicit-container redesign (#13024) uncovered |
| **T7** Reusing/storing a DG across runs → stale cursor / "Bad setIn index" | #6969:7 | **Not solved** | none | No stable cross-run cursor for stored containers; needs at least a warning |
| **T8** No mid-run stale clearing; ghosts linger during long runs | #14280, #12069 | Partial | (#15387 narrow) | No `st.close()`/clean-slate API (#10126/#6063); end-of-run-only GC |
| **T9** Bind widget state to query params | #14670:7 | Largely solved | **P2** (query-param half) | `bind="localstorage"` (#13609) future only |
| **T10** Component state sync (#5690), fragment interrupt (#11030), reset API (#5442) | small–moderate | **Not solved** | none | Out of scope of all four projects |

---

## 6. Recommendations (prioritized)

1. **Fix `st.empty` / container-rewrite widget-state cleanup (T5).** *Highest priority.*
   This is the oldest, highest-confirmed, most-worked-around gap (#5044 open since 2022), and
   no project owns it. Implement a delta-path → widget-id association so that when a delta
   path is overwritten/cleared (`st.empty`, container rewrite) its widget IDs are removed from
   `widget_ids_this_run` before re-registration. The maintainer-described approach and PoC
   (#10186) already exist. This also unblocks mid-run clearing (T8) and an explicit reset
   story (T10). Consider sequencing it on top of, or jointly with, the P3 cursor refactor
   (#15413) since both rework `RunningCursor`/cursor ownership.

2. **Resolve the dynamic-default regression (T4').** Because this is fallout from a *shipped*
   change (#11277) and is actively breaking apps (#12880/#12629, users pinning versions),
   provide a first-class way to update a keyed widget's default on rerun (e.g. an explicit
   "controlled value" mode, or honoring `value=`/`index=` changes when the developer opts in)
   plus a warning when both `key=` and a changing `value=` are passed. Low API surface, high
   pain relief.

3. **Land Outside-Container-Writes cursor work and close the residual fragment gaps (T6).**
   Finish P3 (#15398 + #15413), including the button-in-outside-container crash (#15406).
   Then explicitly scope the two acknowledged-but-uncovered items: nested periodic fragment
   duplicate IDs (#10719) and removing the fragment implicit wrapper container / tracking
   fragments via the React VDOM (#13024).

4. **Ship `persist_state` (T1) and the auto/no-key layout persistence (T2 → #14492).** P2 is
   the right answer for the single highest-demand state complaint; prioritize getting it from
   spec to release. In parallel, investigate stabilizing identity for *keyless* layout
   containers so the remount reset (#8239 class) is fixed without forcing `key=`.

5. **Make tab identity key-based, not label-based (T2'/#12342/#7435).** So that renaming a
   tab or adding a badge/✔ doesn't drop the active selection. Small extension of the shipped
   layout-persistence store (store an index/stable id, not the label).

6. **Add guardrails for stored/reused containers (T7) and an explicit reset/mid-run-clear API
   (T8/T10).** At minimum, warn when a DeltaGenerator/container is stored in `session_state`
   (#6969). Longer term, an `st.empty`-level or container-level "clear now" that also clears
   widget state (ties back to #1) would address #10126, #5442, #3841, and #14280 together.

7. **Track the out-of-scope adjacencies (T10) explicitly.** Custom-component `session_state`
   sync (#5690) belongs to the components-v2 roadmap; fragment interruption (#11030) and
   `st.rerun(scope="fragment")` from parallel fragments (#14968) belong to a fragment
   control-flow effort. They are real, recurring, and currently owned by no project.

---

## 7. Appendix — Issues reviewed (body + all comments)

`st.empty`/cleanup/duplication: 5044, 12069, 2395, 1924, 5715, 5880.
Widget state/identity: 6074, 11277, 5813, 6350, 1259, 4458, 5690, 14670, 4318, 12880, 3716.
Tabs/expander/popover state: 8239, 6004, 2399, 2360, 2378, 12554, 7435, 11160, 6257, 9249,
12342, 14528, 7040, 9158, 14943, 14492, 2241, 4651, 5604.
Fragment lifecycle/cursor: 10805, 11266, 11109, 9313, 12762, 12514, 13024, 13634, 9372,
11030, 14968, 10719, 8494, 11660, 9188, 8833, 9087, 10103.
Container lifecycle/delta path: 14280, 14672, 13658, 4652, 6969.
Session-state edge cases: 4297, 4247, 9082, 12629, 3890, 4925, 3873, 7862, 5442, 3841, 8715,
5125, 1080, 3285.

(Triaged from 334 label-collected issues plus keyword searches; pure-CSS/layout and unrelated
new-widget requests excluded. #10186, #13788, #14064 referenced above are PRs, not issues.)
