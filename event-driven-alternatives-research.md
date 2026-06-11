# Event-Driven Alternatives to Streamlit — Research & Analysis

> Research input for the concurrency-roadmap / execution-model exploration. The goal is to
> understand the event-driven / reactive Python UI frameworks that position themselves as an
> "upgrade" to Streamlit, explain *how* their execution models differ, and assess honestly what
> that means for Streamlit as a BI dashboard tool. Streamlit's full-script rerun model is a
> deliberate trade-off with real strengths (simplicity, time-to-prototype); this document tries
> to be balanced, not a takedown.

---

## Executive summary

- **NiceGUI is confirmed as the event-based "upgrade" that the community recommends over Streamlit.**
  Its own README states the maintainers "like Streamlit but find it does *too much magic* when it
  comes to state handling," which is the explicit origin story of the project
  ([README](https://github.com/zauberzeug/nicegui/blob/main/README.md),
  [issue #1 comment](https://github.com/zauberzeug/nicegui/issues/1#issuecomment-847413651)).
  Third-party round-ups corroborate that NiceGUI "was developed explicitly as an alternative to
  Streamlit" and, unlike Streamlit, "doesn't rerun the entire script after every user interaction"
  ([anvil.works](https://anvil.works/articles/top-python-web-app)). **Reflex** ("the framework
  Streamlit users move to," [reflex.dev/migration/streamlit](https://reflex.dev/migration/streamlit))
  and, more briefly, **Taipy / Shiny / Solara / Mesop / Gradio** come up alongside it in the same
  comparisons.

- **The core execution-model difference is "what re-runs on an interaction."** Streamlit re-executes
  the *entire script top-to-bottom* on every widget interaction
  ([docs](https://docs.streamlit.io/develop/concepts/architecture/run-your-app)). The event-based
  alternatives instead run a *single Python event handler* (NiceGUI, Gradio) or mutate a *persistent
  state object* and re-render only the components that read the changed data (Reflex, Shiny). Updates
  reach the browser as targeted DOM/state diffs over a persistent WebSocket, not as a re-rendered
  page.

- **For BI dashboards the rerun model genuinely hurts in specific, predictable ways** — redundant
  recomputation when one filter changes (the *whole* query layer re-executes unless you cache it
  yourself), no first-class server-push for live data (you poll), and a per-interaction full
  re-execution cost that grows with app size. Streamlit's mitigations (`@st.cache_data`,
  `@st.fragment`, `st.session_state`, callbacks, `run_every`) are real and often sufficient, but they
  are *opt-in guards bolted onto a rerun model*, not a dependency graph — so "update only the dependent
  charts" remains a workaround rather than a default.

- **The anchor BI use case — "a filter change updates only its dependent charts/dataframes" — is a
  first-class, low-effort pattern in Reflex and Shiny, a low-effort explicit pattern in NiceGUI and
  Gradio, and a workaround in Streamlit.** Streamlit can *approximate* it (cache the query layer,
  isolate regions in fragments), but a filter living in one fragment cannot natively trigger partial
  updates of *other independent* fragments without a full rerun, and even a cached app still
  re-executes top-to-bottom.

- **Matching GitHub demand is real and specific.** Open issues map almost one-to-one onto the
  capabilities these frameworks already ship: rerun a fragment from anywhere (#10603, 25 👍),
  selective fragment rerun / execution control (#12799, 12 👍), fragment-to-fragment communication
  without a full rerun (#10045, 12 👍), easier cross-filtering (#12395, 7 👍) and a filter-bar widget
  (#12396, 19 👍), real-time chart updates without rerunning the script (#12980), websocket
  server-push without polling (#11665), and the anchor issue **#9052 "Rerun upon events dispatched by
  third-party libraries" (11 👍)** which explicitly frames Streamlit's React-like model against
  event-driven sources and proposes a `useSyncExternalStore`-style first-party solution.

- **Bottom line:** Streamlit remains the fastest way to get *a* dashboard in front of someone, and its
  model is genuinely simpler to reason about. But for *production BI* (heavy interdependent queries,
  live data, many concurrent viewers), the rerun model is the limiting factor, and the competitive
  field has matured enough that "just use fragments + caching" is no longer a complete answer. The
  highest-leverage gaps to consider are (1) cross-fragment / dependency-driven partial updates and (2)
  first-class server-push.

---

## Methodology & sources

**Frameworks** were researched from primary sources: official docs and migration/architecture pages
for each framework, plus the frameworks' own source/README where the execution model is described.
Vendor "vs Streamlit" pages (Reflex's, Taipy's) are used for *their own* model only — they are biased
on the Streamlit side, so all Streamlit-side claims are corroborated against Streamlit's own docs and
the source in this repository (`lib/streamlit/runtime/fragment.py`, caching, session state).

**Issues** were gathered with the GitHub CLI/API against `streamlit/streamlit`. Full-text issue search
was unreliable in this environment (it returned PRs and mis-scored reactions), so the open-issue list
was paged in full (`gh issue list --state open --limit 600`) and filtered locally on
execution-model / reactivity / BI keywords; the resulting candidates were then read in full (body +
all comments + reaction counts) via `gh api repos/streamlit/streamlit/issues/<n>` and
`.../comments`. The anchor issue **#9052** was read end-to-end.

**Key URLs**

- NiceGUI: [README](https://github.com/zauberzeug/nicegui/blob/main/README.md) ·
  ["too much magic" issue #1](https://github.com/zauberzeug/nicegui/issues/1#issuecomment-847413651) ·
  [LLM reference / architecture](https://nicegui.io/llms.txt) ·
  [binding internals](https://github.com/zauberzeug/nicegui/blob/main/website/documentation/content/section_binding_properties.py) ·
  [discussion #594 (why not Streamlit's model)](https://github.com/zauberzeug/nicegui/discussions/594) ·
  [production discussion #395](https://github.com/zauberzeug/nicegui/discussions/395)
- Reflex: [migration/streamlit](https://reflex.dev/migration/streamlit) ·
  [state overview](https://reflex.dev/docs/state/overview) ·
  [reflex vs streamlit](https://reflex.dev/blog/reflex-streamlit/) ·
  [select.md (computed-var pattern)](https://github.com/reflex-dev/reflex/blob/main/docs/library/forms/select.md)
- Gradio: [events](https://www.gradio.app/guides/blocks-and-event-listeners) ·
  [gr.on](https://www.gradio.app/docs/gradio/on) ·
  [state](https://www.gradio.app/guides/state-in-blocks)
- Shiny for Python: [why Shiny](https://posit.co/blog/why-shiny-for-python) ·
  [reactive foundations](https://shiny.posit.co/py/docs/reactive-foundations.html) ·
  [reactive.calc](https://shiny.posit.co/py/api/core/reactive.calc.html) ·
  [Shiny's execution algorithm](https://gshotwell.github.io/shiny-algorithm)
- Mesop: [core concepts](https://mesop-dev.github.io/mesop/getting-started/core-concepts/) ·
  [architecture](https://mesop-dev.github.io/mesop/internal/architecture/) ·
  [interactivity](https://mesop-dev.github.io/mesop/guides/interactivity/)
- Solara: [state management / reactivity](https://solara.dev/documentation/getting_started/fundamentals/state-management) · [reactive API](https://solara.dev/documentation/api/utilities/reactive)
- Taipy: [callbacks / actions](https://docs.taipy.io/en/release-3.1/manuals/gui/callbacks/)
- Streamlit: [run model](https://docs.streamlit.io/develop/concepts/architecture/run-your-app) ·
  [fragments](https://docs.streamlit.io/develop/api-reference/execution-flow/st.fragment) ·
  [caching](https://docs.streamlit.io/develop/concepts/architecture/caching) ·
  [session state](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.session_state) ·
  [st.rerun](https://docs.streamlit.io/develop/api-reference/execution-flow/st.rerun) ·
  repo source `lib/streamlit/runtime/fragment.py`
- Community framing: [anvil.works round-up](https://anvil.works/articles/top-python-web-app) ·
  [bitdoze Streamlit vs NiceGUI](https://www.bitdoze.com/streamlit-vs-nicegui/)

---

## Execution-model deep-dive

### Streamlit — full-script rerun, with opt-in reactivity guards

**How it runs.** A Streamlit app is a Python script. On the first connection, and again on *every*
widget interaction, the server runs the **entire script from top to bottom** in a fresh `ScriptRunner`
execution; the produced element tree is diffed and streamed to the browser as `ForwardMsg`s over the
WebSocket ([run model docs](https://docs.streamlit.io/develop/concepts/architecture/run-your-app)).
The mental model is "your script *is* the view function, re-evaluated each time." This is what makes
Streamlit so easy to learn: there are no callbacks to wire, no component graph to reason about — you
write straight-line Python and it just re-runs.

What persists across reruns is deliberately narrow:

- **`st.session_state`** — a per-session dict that survives reruns; this is the only place mutable
  Python state lives between runs
  ([docs](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.session_state)).
- **Caches** — `@st.cache_data` (memoizes serializable return values, keyed by a hash of the function
  + arguments) and `@st.cache_resource` (single shared object, e.g. a DB connection / model)
  ([caching docs](https://docs.streamlit.io/develop/concepts/architecture/caching)). Crucially, a
  cache *avoids recomputing the cached function*, but **the script still re-executes top-to-bottom**;
  cache hits just return early.

**Mechanisms it offers to approximate reactivity / event handling:**

- **Widget callbacks (`on_click` / `on_change`)** — run a Python function *before* the rerun proceeds.
  They are genuinely event-handler-shaped, but they do **not** avoid the rerun; they run, then the
  whole script re-executes anyway.
- **`@st.fragment`** — the closest thing to partial reruns. A function decorated with `@st.fragment`
  is registered in a per-session `FragmentStorage` keyed by a hash of its module/name/position
  (`lib/streamlit/runtime/fragment.py`, `_fragment` → `fragment_id = calc_hash(...)`). When a widget
  *inside* the fragment changes, Streamlit performs a **fragment-scoped rerun**: it sets
  `ctx.fragment_ids_this_run` and re-executes only the registered fragment function(s) instead of the
  whole script. This is real partial execution and is the main lever for BI-style isolation
  ([fragment docs](https://docs.streamlit.io/develop/api-reference/execution-flow/st.fragment)).
- **`@st.fragment(run_every=...)`** — schedules periodic fragment reruns. In the source this enqueues
  an `auto_rerun` `ForwardMsg` carrying an `interval` and the `fragment_id` (`fragment.py`,
  `msg.auto_rerun.interval = time_to_seconds(run_every)`). Importantly this is a **client-scheduled
  timer that asks the server to rerun the fragment** — it is polling, not server-push. Streamlit has
  no API for the *server* to spontaneously push a UI change to the browser absent a client-initiated
  rerun.
- **`st.rerun()` / `st.rerun(scope="fragment")`** — programmatically trigger a (full or
  fragment-scoped) rerun ([st.rerun docs](https://docs.streamlit.io/develop/api-reference/execution-flow/st.rerun)).

**Honest assessment — solution vs workaround.**

- Genuine solutions: `session_state` (correct primitive for persistence); `cache_resource` (correct
  primitive for shared heavy objects); fragments for isolating an *interactive region* that owns its
  own widgets.
- Partial / workaround: `cache_data` solves *recompute* but not *re-execute* — the script body still
  runs every time, so unrelated rendering, imports, and un-cached work still happen on each
  interaction. Fragments isolate reruns **only along the boundary you draw**, and a widget in one
  fragment cannot natively trigger an update of *another independent* fragment without a full rerun
  (see #10603 / #10045 / #12799 below — this is an explicit, upvoted gap, with a maintainer-provided
  *workaround* rather than a first-class API). There is no dependency graph: Streamlit does not know
  that "chart B reads filter A," so it cannot minimally re-render B; you express that relationship by
  *structuring reruns and caches yourself.*

### NiceGUI — backend-first event handlers + WebSocket outbox (the anchor alternative)

**How it runs.** NiceGUI is **backend-first**: a Python/FastAPI backend, a Vue 3 / Quasar frontend,
and a persistent **socket.io WebSocket** between them
([README](https://github.com/zauberzeug/nicegui/blob/main/README.md),
[architecture notes](https://nicegui.io/llms.txt)). You build the UI once by constructing element
objects (`ui.label`, `ui.select`, `ui.button`, …). After the page loads, the WebSocket stays open.
Every UI event (click, change, …) is sent to the backend and **invokes a Python handler**; any element
changes the handler makes are accumulated in an **"outbox" and sent in batches to the client over the
WebSocket** ([architecture](https://nicegui.io/llms.txt) — *"Outbox: UI updates are accumulated and
sent in batches to the client"*). The script is **not** re-executed — NiceGUI re-runs the page-builder
function only once per client connection.

**How it enables event-based execution (what you write):**

- **Event handlers**: `ui.button('Go', on_click=handler)`,
  `ui.select(options, on_change=lambda e: ...)`. The handler imperatively mutates elements:
  `label.set_text(...)`, `chart.options = ...; chart.update()`. As the maintainers explain in
  [discussion #594](https://github.com/zauberzeug/nicegui/discussions/594): *"interactions like click
  and select send the information to the backend so a Python function can be called … via `.update()`
  we send the whole state of the element (and all its children) to the frontend."*
- **Data binding**: `label.bind_text_from(obj, 'prop')`, `input.bind_value(model, 'field')` keep UI in
  sync with plain Python objects with no callback. Internally there are two flavors: **bindable
  properties** that detect writes and propagate immediately, and **"active links"** checked by a
  `refresh_loop()` running **every 0.1 s** (`binding_refresh_interval`)
  ([binding internals](https://github.com/zauberzeug/nicegui/blob/main/website/documentation/content/section_binding_properties.py)).
- **`@ui.refreshable`**: decorate a UI-building function; calling `my_section.refresh()` clears and
  rebuilds **only that subtree** ([refreshable docs](https://nicegui.io/llms.txt)). `ui.state()`
  provides React-style local state inside a refreshable.
- **`ui.timer(interval, cb)`**: server-side timer for periodic updates, and `app.storage.*` scopes
  state per-client / per-tab / per-user / global.

**Trade-offs.** You must think in element references and explicit updates — *which* element to mutate
and when to `.update()` — which is more boilerplate and a different mental model than "just print
things." The whole app runs on **one shared asyncio event loop**: any blocking call (`time.sleep`,
`requests.get`, heavy CPU) **freezes every user's UI**, so you must use async I/O or
`asyncio.to_thread()` ([architecture](https://nicegui.io/llms.txt)). The reactivity story is
acknowledged as somewhat opaque — "different methods and decorators for different types of UI updating,
so it can be difficult to know how to get the UI to update"
([anvil.works](https://anvil.works/articles/top-python-web-app)). Deployment is a normal FastAPI/uvicorn
app (more control, slightly more setup than `streamlit run`).

### Gradio — declarative event listeners wiring inputs → fn → outputs

**How it runs.** Gradio's high-level `Interface` and low-level `Blocks` API let you lay out components
and attach **event listeners** that map specific component interactions to Python functions. The
canonical pattern is
`component.event_name(fn=function, inputs=[...], outputs=[...])`: when the event fires, Gradio calls
`fn` with the *current values of the input components* and writes the returned values into the *output
components* ([events guide](https://www.gradio.app/guides/blocks-and-event-listeners)). Only the listed
output components update; the rest of the page is untouched. `gr.on(triggers=[...], fn=..., ...)` binds
one function to several triggers (and creates a single API endpoint), and events can be chained with
`.then()` / `.success()` / `.failure()` ([gr.on docs](https://www.gradio.app/docs/gradio/on)).

**How it enables event-based execution (what you write):** You declare, per interaction, exactly which
inputs feed the function and which outputs it updates. State that must persist within a session lives
in **`gr.State`** components that you pass as *both* an input and an output and return updated
([state docs](https://www.gradio.app/guides/state-in-blocks)). There is no dependency inference — the
wiring is explicit and local to each listener.

**Trade-offs.** Gradio is heavily oriented toward **ML model demos** (predict-style `inputs → fn →
outputs`), which makes single-shot interactions delightful but multi-widget interdependent dashboards
more verbose: each cross-update is another listener, and shared state must be threaded through
`gr.State` in and out of every function. It does avoid full-script reruns (only the wired function
runs), but it lacks a reactive graph — Gradio is explicitly categorized as **event-handling, not
graph-based**, in [Shiny's execution-algorithm write-up](https://gshotwell.github.io/shiny-algorithm).

### Reflex (formerly Pynecone) — persistent State class + compiled React, reactive diffs

**How it runs.** You define application state in a Python class inheriting from `rx.State`, with
**vars** (fields) and **event handlers** (methods). UI components are Python function calls that
reference state vars (e.g. `rx.text(State.count)`). Reflex **compiles the UI to a React/Next.js
frontend**; at runtime, all state lives on the server (one instance per user session) and all event
handlers execute on the server. *"Reflex uses websockets to send events to the server, and to send
state updates back to the client"* ([state overview](https://reflex.dev/docs/state/overview)). When an
event handler mutates a var, Reflex **re-renders only the components that read that var** and pushes
the diff over the WebSocket ([migration page](https://reflex.dev/migration/streamlit):
*"Only the components affected by a change re-render. A slider change won't re-run your database
query."*).

**How it enables event-based execution (what you write):** Subscriptions are implicit-by-reference —
a component that renders `State.x` is automatically a subscriber to `x`. Derived data uses
**computed vars** (`@rx.var`) that recompute only when their inputs change; the docs give the exact BI
pattern: `rx.select(..., on_change=State.set_selected)` plus
`@rx.var def filtered_rows(self): return [r for r in self.all_rows if r.category == self.selected]`,
where *"Reflex's version only re-renders the table, not the entire page"*
([select.md](https://github.com/reflex-dev/reflex/blob/main/docs/library/forms/select.md)). Long jobs
use **async background event handlers** that stream partial results back as they progress
([reflex vs streamlit](https://reflex.dev/blog/reflex-streamlit/)).

**Trade-offs.** More concepts to learn — state classes, event handlers, computed vars, async flows —
and a compile step (the docs themselves list "more concepts to learn" and "memory footprint per user"
as cons, [reflex vs streamlit](https://reflex.dev/blog/reflex-streamlit/)). Per-session server-side
state means a real memory cost per concurrent user. It is a *full-stack web framework*, so the
floor of complexity is higher than Streamlit's "paste a script."

**Reflex vs NiceGUI in one line.** Reflex = *declarative, reference-based subscription* (you read a
var; Reflex figures out the re-render) over a *compiled React* frontend. NiceGUI = *imperative event
handlers* that *explicitly mutate elements* (`.update()` / `.refresh()`) over a *templated Vue*
frontend with a single shared event loop. Reflex hides more web plumbing and infers more; NiceGUI
keeps "normal Python callbacks" and exposes FastAPI directly
([discussion #395](https://github.com/zauberzeug/nicegui/discussions/395):
*"NiceGUI encourages the use of standard Python (callbacks, if-statements); Pynecone uses explicit
State classes."*).

### Secondary frameworks (brief)

- **Shiny for Python** — the most *formal* reactive model. You write **`@reactive.calc`** (lazy, cached
  derived values), **`@reactive.effect`** (eager side effects), `reactive.value` (state), and
  `@render.*` outputs; `@reactive.event` gates execution to specific triggers. Shiny **infers a
  dependency graph** and "minimally re-renders" only the outputs whose inputs changed, **without
  explicit callbacks** ([why Shiny](https://posit.co/blog/why-shiny-for-python),
  [reactive foundations](https://shiny.posit.co/py/docs/reactive-foundations.html)). The author's
  taxonomy is blunt: *"Streamlit: re-render everything everywhere all the time; Dash/Gradio/Solara:
  event-handling; Shiny: build a computation graph and minimally re-execute"*
  ([algorithm write-up](https://gshotwell.github.io/shiny-algorithm)). This is the cleanest answer to
  the anchor use case of any framework here.
- **Solara** — React-style **hooks + reactive variables** (`solara.reactive`, `use_reactive`); reading
  a reactive value in a component subscribes it, and only components that read a changed value
  re-render ([state-management docs](https://solara.dev/documentation/getting_started/fundamentals/state-management),
  [reactive API](https://solara.dev/documentation/api/utilities/reactive)).
  Classified as event-handling/component-reactive rather than full-graph.
- **Mesop** (used at Google) — **immutable `@me.stateclass` + event handlers**, but its rendering is
  actually closer to Streamlit than the others: an event handler mutates state, then Mesop **re-runs
  the component functions to produce a new component tree, diffs it, and sends the diff** (it can even
  stream multiple render loops via Server-Sent Events for generator handlers)
  ([architecture](https://mesop-dev.github.io/mesop/internal/architecture/),
  [interactivity](https://mesop-dev.github.io/mesop/guides/interactivity/)). So Mesop keeps the
  "re-run and diff" simplicity but adds typed session state and SSE streaming — a useful midpoint.
- **Taipy** — **event-driven callbacks** (`on_change`, `on_action`) with an explicit state object and a
  separate data/task pipeline layer aimed at BI; partial UI updates happen by mutating `state.x` in a
  callback, and only bound controls refresh ([callbacks docs](https://docs.taipy.io/en/release-3.1/manuals/gui/callbacks/)).
  Its "vs Streamlit" page is vendor-biased but the callback model itself is the citable part.

---

## Execution-model comparison table

| Dimension | **Streamlit** | **NiceGUI** | **Gradio** | **Reflex** | Shiny (py) | Mesop |
|---|---|---|---|---|---|---|
| State persistence between interactions | `st.session_state` dict; caches | Plain Python objects + `app.storage.*` | `gr.State` (threaded in/out of fns) | `rx.State` class (server, per session) | `reactive.value` (server) | `@me.stateclass` (per session) |
| What re-runs on an interaction | **Whole script top-to-bottom** (or one fragment if widget is inside a fragment) | **One event handler** | **One wired function** (`inputs→fn→outputs`) | **One event handler**; re-renders only affected components | Only invalidated reactive nodes / outputs | Event handler, then component functions re-run + diff |
| How updates reach browser | Element-tree diff over WS, after a (re)run the *client* initiated | Element diffs batched in **outbox** over persistent WS | Output-component values over WS | **State diff** over WS to compiled React | Minimal output re-render over WS | Component-tree diff over WS/SSE |
| Server push (no user action) | **No first-class push**; `run_every` is client-polled timer | **Yes** — `ui.timer`, async tasks, `.update()` any time | Limited (generators/`every=`); mainly request-driven | **Yes** — async background handlers stream to UI | Yes (`invalidate_later`, reactive triggers) | Yes (generator handlers + SSE) |
| Partial re-render of dependents | Only within an explicit fragment boundary; cross-fragment needs full rerun/workaround | Explicit `.refresh()` / `.update()` / bindings | Explicit `outputs=[...]` list per listener | **Automatic** (components subscribe by reading vars) | **Automatic** (inferred dependency graph) | Whole tree re-run + diff (auto-minimized payload) |
| Boilerplate to opt into reactivity | Low to write, but caches/fragments/`session_state` needed to *scale* | Medium (element refs, explicit updates) | Medium (wire every listener's inputs/outputs) | Medium–high (state classes, computed vars) | Medium (reactive decorators) | Medium (state class + handlers) |
| Learning curve | **Lowest** | Easy–medium | Easy (demo-shaped) | Steeper (full-stack concepts) | Medium | Medium |

---

## BI dashboard suitability

A BI dashboard typically means: many interdependent filters, large datasets, cross-filtering, expensive
queries that should not re-run on every interaction, frequent/streaming updates, and many concurrent
viewers. Assessed on those dimensions:

| Dimension | **Streamlit** | **NiceGUI** | **Gradio** | **Reflex** |
|---|---|---|---|---|
| Avoid redundant recompute when one filter changes | Whole script re-executes; you must wrap the query layer in `@st.cache_data` and/or isolate in a fragment. Cache avoids *recompute* but not *re-execution* | Only the handler runs; recompute only what the handler touches | Only the wired function runs; recompute only what it computes | **Automatic** — only computed vars / components that read the changed var recompute |
| Server-pushed / live-updating data | No native push; `run_every` polling or 3rd-party autorefresh | **Native** (`ui.timer`, async push, broadcast) | Limited (`every=`, generators) | **Native** (async background events stream) |
| Per-session memory & concurrency under many viewers | Light per-session state, but each interaction re-executes the script (CPU cost scales with app size × users) | Single shared event loop — efficient, but one blocking call stalls *all* users | Reasonable; demo-oriented | Full server-side state per session (heavier per user), but cheap per interaction |
| Cross-filtering / interdependent widgets | Awkward — must centralize selections in `session_state` and can't easily update a chart "above" the one selected (see #12395) | Explicit but workable via bindings/refresh | Verbose — one listener per cross-update | **Cleanest** — components subscribe to shared vars; computed vars derive filtered data |
| Time-to-first-dashboard | **Fastest** | Fast | Fast (for demo-shaped UIs) | Slower to start, better long-term |
| Long-term maintainability at scale | Degrades — reruns + cache/fragment bookkeeping grow | Good (real app structure) | Mixed (listener sprawl) | **Good** (organized state classes) |

**Verdict per framework**

- **Streamlit** — *Best for the first 80% of a dashboard, fastest to ship, hardest to scale.* Strong
  when datasets and queries are modest or cacheable and viewers are few. It genuinely *hurts* when (a)
  one filter change forces an expensive query layer to re-evaluate (cache helps recompute, not
  re-execution and not flicker/latency of a full rerun), (b) you need live/streaming data pushed
  without a user action, and (c) cross-filtering requires updating widgets "upstream" of the
  selection.
- **NiceGUI** — *Best for live/operational dashboards (monitoring, control panels, IoT).* Native
  server-push and explicit partial updates make streaming/real-time natural; the single shared event
  loop is the main scaling caveat (must keep handlers async/off-thread).
- **Gradio** — *Best for ML-result panels and single-interaction tools,* weaker for many interdependent
  filters because every cross-update is hand-wired and shared state is threaded through `gr.State`.
- **Reflex** — *Best for production BI that must scale and ship as a real web app.* Dependency-tracked
  partial re-render and async background streaming are exactly the BI primitives Streamlit lacks; the
  cost is per-session server memory and a steeper learning curve.
- **Secondary**: **Shiny** is arguably the *strongest pure fit* for the reactivity dimension (inferred
  graph, minimal re-render, no manual callbacks); **Taipy** targets BI explicitly with callbacks + a
  data/task layer; **Mesop**/**Solara** sit between Streamlit and Reflex.

Where Streamlit is **well-suited**: rapid internal dashboards, analytics prototypes, one-off
explorations, demos, and apps where caching the heavy bits is sufficient and viewers are limited.
Where the rerun model **genuinely hurts**: high-frequency/streaming data, large numbers of concurrent
viewers running expensive scripts, and dense cross-filtered dashboards with many interdependent inputs.

---

## Worked use case: filter selector → dependent charts/dataframes only

**Scenario.** A dashboard has a filter selector (region/date/category) driving multiple downstream
charts and dataframes. Changing the filter should recompute and update **only the dependent
charts/dataframes** — not the whole app, not unrelated sections.

### Streamlit — what actually happens today

A filter change reruns the **entire script**. Every line re-executes; every chart re-renders; every
query re-runs *unless* guarded by caching. The realistic approaches and their limits:

```python
import streamlit as st

@st.cache_data  # avoids RECOMPUTE, not re-execution
def load(region: str):
    return run_expensive_query(region)   # only re-runs when `region` changes

region = st.selectbox("Region", REGIONS, key="region")  # value held in session_state
df = load(region)        # cache hit if region unchanged → no recompute...
st.dataframe(df)         # ...but this line, and everything below, still re-executes every run
st.line_chart(df, x="date", y="sales")
st.bar_chart(df, x="product", y="sales")
```

- `@st.cache_data` means a filter change that *doesn't* change `region` won't re-query — but the script
  body (rendering, layout, any un-cached work) **still runs top-to-bottom every interaction**
  ([caching docs](https://docs.streamlit.io/develop/concepts/architecture/caching)).
- `st.session_state` correctly holds the filter value across reruns, but it does not stop the rerun.
- **Fragments** isolate an interactive region. A selector + its charts inside one `@st.fragment` lets a
  change re-run *only that fragment* (`ctx.fragment_ids_this_run` in `lib/streamlit/runtime/fragment.py`):

```python
@st.fragment
def regional_panel():
    region = st.selectbox("Region", REGIONS)   # change → only this fragment reruns
    df = load(region)
    st.line_chart(df, ...); st.bar_chart(df, ...)

regional_panel()
```

  This solves "update only this panel." What it does **not** solve: a filter inside fragment A cannot
  natively trigger a partial update of an *independent* fragment B — you'd need a full rerun (or the
  maintainer's `rerunable_fragment` workaround from #10603). And the fragment boundary is *static* —
  Streamlit still doesn't know "chart B depends on filter A"; you encode that by where you draw the
  fragment.

**Net:** Streamlit can get to "only this region of the page updates" with caching + a fragment, but
"only the dependent components, wherever they are, recompute" is **not** a first-class pattern. It's a
manual composition of cache keys, fragment boundaries, and `session_state`.

### NiceGUI — explicit, low effort

```python
from nicegui import ui

state = {"region": REGIONS[0]}

@ui.refreshable
def charts():
    df = load(state["region"])
    ui.plotly(make_line(df)); ui.plotly(make_bar(df))   # only this subtree rebuilds

ui.select(REGIONS, value=state["region"],
          on_change=lambda e: (state.update(region=e.value), charts.refresh()))
charts()
```

The `on_change` handler updates state and calls `charts.refresh()` — **only the bound chart subtree
rebuilds**, no script rerun ([refreshable docs](https://nicegui.io/llms.txt)). Mental model: "which
section do I refresh?" Effort: one handler + one `@ui.refreshable`.

### Reflex — first-class, automatic

```python
import reflex as rx

class S(rx.State):
    region: str = REGIONS[0]
    @rx.var
    def df(self) -> list[dict]:
        return load(self.region)          # recomputes only when `region` changes

def page():
    return rx.vstack(
        rx.select(REGIONS, value=S.region, on_change=S.set_region),
        rx.recharts.line_chart(...S.df...),   # subscribes to S.df → re-renders on change
        rx.data_table(data=S.df),             # also subscribes; nothing else re-renders
    )
```

Changing the selector mutates `region`; the computed `df` recomputes; **only components that read `df`
re-render** ([select.md](https://github.com/reflex-dev/reflex/blob/main/docs/library/forms/select.md)).
No fragment boundaries, no cache decorators, no rerun. This is the pattern Streamlit users are asking
for in #12395.

### Gradio — explicit wiring per dependent output

```python
import gradio as gr

def update(region):
    df = load(region)
    return line_fig(df), bar_fig(df), df   # returns each dependent output

with gr.Blocks() as demo:
    region = gr.Dropdown(REGIONS, value=REGIONS[0])
    line = gr.Plot(); bar = gr.Plot(); table = gr.Dataframe()
    region.change(fn=update, inputs=region, outputs=[line, bar, table])  # only these update
```

Only the components listed in `outputs` update ([events guide](https://www.gradio.app/guides/blocks-and-event-listeners)).
Effort scales with the number of dependent outputs and cross-links (each is another listener/return
value), but no full rerun.

### Verdict

- **First-class, low/zero effort:** **Reflex** and **Shiny** — components subscribe to data by reading
  it; the framework recomputes and re-renders only dependents automatically.
- **First-class but explicit:** **NiceGUI** (`@ui.refreshable` + handler) and **Gradio**
  (`outputs=[...]` per listener) — you say *which* parts update, but partial dependent updates are the
  default behavior, not a workaround.
- **Workaround:** **Streamlit** — achievable via `cache_data` + `@st.fragment` + `session_state`, but
  with real limits (no cross-fragment partial updates without a full rerun; the script always
  re-executes top-to-bottom). The gap for the *specific* "update only dependents, anywhere" pattern is
  **large** and is precisely what the upvoted issues below request.

---

## Matching Streamlit issues

Every issue below was read in full (body + comments + reactions). Reaction counts are 👍 on the
opening post. Grouped by theme, with the alternative-framework capability each maps to.

### Theme 1 — Partial / selective rerun & cross-fragment updates (the anchor gap)

- **#10603 — "Rerun fragment from anywhere, not just from within itself" (open, 👍25, the highest-voted
  here).** Users want to trigger a specific fragment's rerun from another fragment or the main app to
  reflect dependencies without a full app rerun. A Streamlit maintainer (`sfc-gh-tteixeira`) posts a
  **workaround** (`rerunable_fragment` wrapping the fragment in an `st.empty()` container), and a
  community member extends it with internal script-request hacks — confirming this is *not* first-class
  today. → **Reflex/Shiny** auto-subscription; **NiceGUI** `.refresh()` from any handler.
- **#12799 — "Fragments are awesome but must be more: Selective Rerun and Execution Control" (open,
  👍12).** Two asks: (1) trigger reruns of specific fragments from anywhere; (2) *prevent* a fragment
  from re-executing during a full rerun unless its inputs change. This is literally a request for a
  dependency-aware re-execution model. → **Shiny** `@reactive.calc` invalidation; **Reflex** computed
  vars.
- **#10045 — "Fragment to fragment (co-fragment) communication instead of rerunning entire app" (open,
  👍12).** User has nested fragments and wants one to update another (e.g. a form updating a preview)
  without a full rerun; proposes `@st.fragment(key=..., keys_to_update=[...])`. → **NiceGUI** explicit
  cross-element updates; **Reflex** shared-state subscription.
- **#9981 — "[PoC] Run fragment callbacks in fragment context" / #14064 — "Preserve non-fragment widget
  state during `run_every` fragment auto-reruns" / #14968 — "Allow `st.rerun(scope=fragment)` from
  parallel fragments."** Internal/edge-case work that shows the fragment model is being pushed toward
  finer-grained control — and that the seams (state preservation, cross-fragment triggers) are exactly
  where it strains.
- Historical: **#7613 "[Prototype] Partial rerun prototype" (closed)** and the fragment line itself
  (#8122/#8126 implement fragment, #9019 de-experimentalize, #8979 `rerun(scope="fragment")`) — i.e.
  fragments *are* Streamlit's own answer to partial rerun; these issues show the demand predates and
  outpaces the current capability.

### Theme 2 — Event-driven execution from external/non-widget sources (server-push)

- **#9052 — "Rerun upon events dispatched by third-party libraries" (open, 👍11). [ANCHOR ISSUE]** Asks
  for a first-class way to rerun in response to events from outside the framework (e.g. a Firestore
  `on_snapshot` callback firing on a background thread). The author explicitly diagnoses the root
  cause: *"Streamlit's execution model is like React's … this model can't handle event sources outside
  the framework by design,"* and proposes a first-party analog to React's
  [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) to bridge
  event-driven libraries into the rerun model. The only comment is the prioritization bot. → This is
  the exact thing **NiceGUI** (`ui.timer`/async push), **Reflex** (async background events), and
  **Shiny** (`reactive` triggers/`invalidate_later`) do natively.
- **#11665 — "Websocket Notify component to allow for Push-Notifications without polling" (open, 👍5).**
  Wants the *server* to trigger a render when a message arrives on a websocket, instead of polling with
  `streamlit-autorefresh`; explicitly notes polling "results in a lot of wasted computation … doesn't
  scale well with more session-threads." → **NiceGUI** outbox/broadcast; **Reflex** websocket push.
- **#12980 — "Support real-time chart updates without rerunning the entire script" (open, 👍5).**
  IoT/live-log/financial dashboards; asks for `chart.update(new_data)` style incremental updates,
  citing Dash `dcc.Interval` / Bokeh Server. A commenter points to `@st.fragment` — i.e. the current
  best answer is "use a fragment," which doesn't fully solve incremental chart updates. → **NiceGUI**
  `chart.options=...; chart.update()`; **Reflex** state diff.
- **#14524 — "Rerun-resilient streaming (`st.write_stream` that survives widget interactions)" (open).**
  Documents that a rerun *kills* an in-progress stream because the script thread is interrupted —
  proposes moving iteration off the script thread. A direct symptom of the rerun model conflicting with
  long-running/streaming work. → **Reflex/Mesop** async/generator streaming handlers.
- **#12306 — "Native Real-Time Collaboration - st.collaborate()" (open, 👍4).** Multi-user shared
  sessions with state sync. Notable for the maintainer reply (`sfc-gh-jrieke`) pushing back on the
  "#1 most requested" claim — included for balance: not all "Streamlit can't do X" requests are
  high-signal, and demand should be weighed, not assumed.

### Theme 3 — BI dashboard ergonomics: cross-filtering & avoiding recompute

- **#12395 — "Easier cross-filtering between charts/dataframes" (open, 👍7).** The cleanest statement of
  the BI pain point, written by a Streamlit team member: selecting in one chart should filter others;
  notes you must "save all selections centrally in `st.session_state`," that it's "not easy to update a
  visualization that is *above* the one where data was selected, due to Streamlit's rerun model," and
  that "the entire page will rerun on every selection, making this potentially slow." → **Reflex/Shiny**
  shared-state/graph; this is the anchor use case verbatim.
- **#12396 — "`st.filter_bar` widget to filter dataframes" (open, 👍19).** A high-demand request for a
  schema-aware filter widget (`filtered_df = st.filter_bar(df)`), with a note to support unevaluated
  dataframes (push-down). Maps to the *filter selector* half of the anchor scenario and to
  **Taipy**'s BI-oriented filtering. Related current work: #15110, #14953 (`st.multiselect` filter
  ergonomics).
- **#14690 — "[spec] Background refresh for `st.cache_data` and `st.cache_resource`" (open).** Spec to
  refresh cached values in the background so live data updates without a foreground recompute. Maps to
  the "avoid redundant recompute + freshen data" dimension that reactive frameworks get from
  dependency invalidation. Related: **#11050** "initialize cache and orchestrate its refreshment,"
  **#13992/#14558** cache observability/size.
- **#9503 — "Streamlit app autorefresh or autoreload" (open, 14 comments).** Although filed as a deploy
  bug, the long comment thread reflects persistent confusion/demand around auto-refresh behavior — i.e.
  users *expect* a live-update story.

### Theme 4 — Event hooks on display elements (closing the callback gap)

- **#10190 — "Click (not selection) events for dataframes, charts, and maps"**, **#10212 — "Dataframe
  row click events"**, **#9370 — "Callback on `st.metric` click event"**, **#14559 — "`st.data_editor`
  `on_change` provides no context about what changed."** These ask for richer, lower-latency event
  hooks on *display* elements — the kind of granular DOM events that NiceGUI/Gradio/Reflex expose by
  default. They're smaller in scope but show the same directional demand: *event handlers on more
  things, without round-tripping a whole rerun.*

### Theme 5 — Concurrency / scaling under load

- **#13064 — "Support running Streamlit with free-threading."** Removing the GIL constraint would
  directly help the "many concurrent viewers each re-executing a script" cost that the rerun model
  imposes. Related infra: server load-testing framework (#14439/#14470), `st.App` ASGI entry point
  (#13449), parallel fragments work (#14443 et al.) — Streamlit's own moves toward better concurrency
  and partial execution.

**Demand-signal summary (👍 on opening post):** #10603 (25), #12396 (19), #12799 (12), #10045 (12),
#9052 (11), #12395 (7), #11665 (5), #12980 (5), #12306 (4). The cluster with the most votes is precisely
**cross-fragment / partial dependent updates and filter ergonomics** — the anchor use case.

---

## Takeaways for Streamlit

1. **The most-requested, highest-leverage gap is dependency-aware partial updates** — "update only the
   components that depend on what changed, wherever they are." Issues #10603 (25 👍), #12799, #10045,
   #12395 all circle this, and the maintainer workaround on #10603 confirms it's not first-class.
   Reflex and Shiny make this the *default*; NiceGUI/Gradio make it a one-line explicit pattern.
   Closing this — e.g. cross-fragment rerun triggers, a fragment "skip if inputs unchanged" mode, or a
   light reactive-binding layer over `session_state` — would neutralize the single most cited reason
   users move to event-driven frameworks. The in-flight **parallel fragments** work is a meaningful
   step but does not yet give cross-fragment dependency-driven updates.

2. **Server-push is the second clear gap.** #9052 (the anchor, with its `useSyncExternalStore`
   analogy), #11665, #12980, and #14524 all want the *server* to drive a UI update from a background
   event/stream without a client-initiated rerun. `run_every` is client-polled and acknowledged as
   wasteful at scale. A first-party "external event source → targeted update" primitive (even scoped to
   a fragment) would address a whole class of live-dashboard and LLM-streaming requests.

3. **Caching solves recompute, not re-execution — and users feel the difference.** The honest framing
   (also made on Reflex's pages, but corroborated by Streamlit's own caching docs and #12395/#14690) is
   that `@st.cache_data` avoids redundant *computation* while the script still runs top-to-bottom. For
   dense BI dashboards that top-to-bottom cost (and the resulting flicker/latency) is the felt problem.
   Reactive frameworks avoid it structurally.

4. **Don't over-rotate: the rerun model is still Streamlit's moat for time-to-prototype.** Every
   alternative trades simplicity for control — NiceGUI's shared event loop foot-guns, Reflex's
   per-session memory and learning curve, Gradio's listener sprawl, Shiny's reactive concepts. The
   maintainer pushback on #12306 is a healthy reminder that not every "Streamlit can't do X" issue is
   high-signal. The strategic question is **how much reactivity to add without losing the
   "paste a script and run it" property** — the most credible direction is *opt-in* reactive/partial
   primitives (richer fragments + a binding/derived-value layer + a server-push hook) layered on top of
   the rerun model, rather than abandoning it.

5. **For BI specifically, the competitive picture has tightened.** "Use fragments + caching" is no
   longer a complete answer next to Reflex's dependency tracking, NiceGUI's live updates, and Shiny's
   reactive graph. If BI dashboards (interdependent filters, large/streaming data, many viewers) are a
   target segment, the cross-fragment-update and server-push gaps above are the ones worth prioritizing
   on the execution-model roadmap.
