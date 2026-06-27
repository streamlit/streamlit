---
author: github-name
created: 2026-06-27
status: exploration
---

# Exploration: declarative data & reactivity layering (and how it relates to event-scoped reruns)

> **This is an exploration / RFC, not a spec.** It does not propose shipping anything by itself and
> does **not** modify the event-scoped fragment reruns spec
> (`specs/2026-06-23-event-scoped-fragment-reruns/`) or Lukas's declarative session state spec
> ([PR #14128](https://github.com/streamlit/streamlit/pull/14128),
> `specs/2026-02-25-session-state-class/`). Its purpose is to map how those efforts relate to a
> possible *declarative data layer*, and to record the design reasoning — especially whether state and
> data belong under one decorator.

## Why this exists

Two recurring asks point at the same missing capability:

1. **Event-based / automatic partial updates.** "Change one filter, update only the dependent
   charts/dataframes" — the criticism behind users moving to NiceGUI/Reflex, and the thing Power BI /
   Tableau do automatically. (See the matching issues: #10603, #12799, #10045, #12395, #12980, #9052.)
2. **Let AI agents reason about an app's data.** Agents that generate, answer questions about, or
   safely modify an app benefit enormously from a machine-readable description of its data.

Both are served by the same thing BI tools have and Streamlit doesn't: a **declared, introspectable
data model**. Power BI/Tableau get automatic propagation precisely *because* they own a semantic model
(tables, relationships, fields/measures) and a constrained visual vocabulary, so the engine can infer
the dependency graph and recompute minimally. Streamlit is code-first and general-purpose, so it has
no such model — which is the strength (arbitrary Python) and the reason automation isn't free.

This doc explores a *Streamlit-idiomatic* version of that model and how it layers on top of the
execution primitive we're already speccing.

## The three layers

These are **distinct concerns that nest cleanly** rather than competing features:

| Layer | Concern | Proposal / status | Primitive |
|---|---|---|---|
| **Execution** | "Rerun exactly these fragments, not the whole app" | Event-scoped fragment reruns — `specs/2026-06-23-event-scoped-fragment-reruns/` (active) | `st.rerun(target=...)` + addressable `@st.fragment` |
| **State** | "Declare typed, persistent per-session inputs/state I write" | Declarative session state — [PR #14128](https://github.com/streamlit/streamlit/pull/14128) (Lukas, draft) | `@st.session_state` class |
| **Data** | "Declare derived/queried data the UI reads (and let agents reason about it)" | *This exploration* | a data decorator (working name `@st.data`) |

Natural flow: a **state** object holds the inputs → **data** derives from those inputs → reading a
data value inside a fragment subscribes that fragment → a change resolves to **execution** (targeted
fragment reruns). In other words, the data layer is the *automatic* layer that **compiles down to the
targeted-rerun primitive** — same queue, same engine, the data layer just computes which fragments to
rerun. (The `depends_on` and "automatic dependency inference" items we deferred from the reruns spec
live here.)

## The data layer (`@st.data`) — sketch

**Plain Streamlit (no warehouse): a lightweight reactive dataset.** Declare derived data that records
its inputs by reading them; reading it in a fragment subscribes that fragment, so a change reruns only
dependents:

```python
@st.data                                  # working name
def sales():
    return query(st.session_state.region)  # framework records: sales depends on `region`

@st.fragment
def chart():
    st.line_chart(sales())                  # reading sales() subscribes this fragment
```

This is conceptually Shiny's `reactive.calc` / Reflex's computed vars, adapted and **opt-in** — the
key difference from tracking the opaque `session_state` dict is that `@st.data` gives the framework an
*explicit, named, introspectable* node to hang dependencies on.

**Streamlit-in-Snowflake + Snowflake: the same decorator becomes a full semantic model.** Snowflake
already ships the target abstraction — **semantic views**: native schema-level objects defining
logical tables, relationships, dimensions, facts, **metrics**, synonyms, and verified queries over
physical tables ([overview](https://docs.snowflake.com/en/user-guide/views-semantic/overview),
[YAML spec](https://docs.snowflake.com/en/user-guide/views-semantic/semantic-view-yaml-spec)), and
**Cortex Analyst** answers natural-language questions against them with governed SQL
([Cortex Analyst](https://docs.snowflake.com/En/user-guide/snowflake-cortex/cortex-analyst)).
Snowflake's launch blog explicitly names Streamlit apps as a consumer surface
([blog](https://www.snowflake.com/en/blog/engineering/native-semantic-views-ai-bi/)). So when
`@st.data` is backed by Snowflake, it can upgrade to a semantic view and unlock three things at once:

1. **Query-granular automatic propagation** — filters push down to governed SQL; the warehouse
   recomputes only affected metrics (the Power BI/Tableau behavior, at scale).
2. **A governed semantic layer** — metrics/relationships defined once, RBAC on the view, portable via
   the Open Semantic Interchange standard.
3. **Agent reasoning for free** — Cortex Analyst reasons over the semantic view (not raw schema),
   directly serving the "agents reason about the data" ask.

This is a **progressive-upgrade** design (one API, richer behavior when a capable backend is present),
mirroring how `st.connection` adapts to its backend. The plain-Python path must remain first-class —
the Snowflake upgrade is a bonus, never a requirement.

**Likely-realistic first step:** *consume* an existing Snowflake semantic view and expose its
metrics/dimensions as a typed `@st.data` object, rather than *generating* a semantic view from Python.
Consuming leverages Snowflake's governance/OSI instead of turning Streamlit into a modeling tool.

## Should state + data + semantic models be one decorator? (product-guidelines analysis)

**Recommendation: keep `@st.session_state` and the data decorator separate (two consistent siblings),
and treat the semantic model as a *backend of the data layer*, not as session state.** Do **not** fold
everything into one decorator. Reasoning against the
[Streamlit API design principles](../AGENTS.md):

| Principle | Verdict | Why |
|---|---|---|
| **#20 One Use Case, One Command** | **Separate** | State = *writable*, persistent inputs you mutate (`state.count += 1`). Data = *derived/read-mostly*, recomputed/queried values. Different mutability + lifecycle = two use cases = two commands. |
| **#8 Semantic Names / #7 Standardized Vocabulary** | **Separate** | `@st.session_state` says "state"; `@st.data` says "data." Overloading one name to mean both muddies both. |
| **#5 Consistency Over Novelty / #11 Patterns Are Sacred** | **Separate but consistent** | Make `@st.data` a deliberate sibling of `@st.session_state` (same class/decorator idiom, same `key`/vocabulary) so learning one teaches the other. |
| **#18 Extend Before Inventing** | **Separate** | They extend *different* existing primitives: `@st.session_state` extends `session_state`; the data layer extends caching/`st.connection`/the semantic layer. |
| **#19 Design for Composition** | **Separate, composable** | Cleanest when `@st.data` *reads* state. Composition beats a mega-decorator that does both. |
| **#35 Avoid "Clever But Too Clever"** | **Separate** | A unified decorator would need a mode flag to distinguish "state" vs "derived data" — an overloaded, magical API. |
| **#1 Simplicity / #2 Progressive Disclosure** | **Separate** | One overloaded decorator looks simpler but conflates two semantics; two focused entry points each stay simple. |

The counter-case is Reflex, whose single `State` class holds vars (state), computed vars (derived), and
event handlers. It's elegant but is exactly the heavier, "more concepts" model that Streamlit's
principles (and its drop-in-script identity) deliberately avoid. Under Streamlit's guidelines, the
**two-sibling** shape wins: `@st.session_state` for inputs, `@st.data` for derived/queryable data, with
the Snowflake **semantic model as a backend of `@st.data`** (semantic = data, not state).

So the family is **two decorators, not one and not three.**

## Open questions

- **New decorator vs. extending caching.** Is the reactive data layer a *new* `@st.data`, or an
  *extension of `@st.cache_data`* (which already memoizes derived data)? `@st.cache_data` is about
  caching; reactivity + semantic-model backing is a different concern (#20) — but #18 says prefer
  extension. Needs a dedicated decision. (Naming `@st.data` is a working placeholder either way.)
- **Consume vs. generate Snowflake semantic views.** Start by consuming existing views (lighter,
  governed) — confirm whether generating is ever in scope.
- **Per-session memory & determinism.** A server-held reactive/data graph per session has a real cost
  (the same one Reflex pays); partial recompute must still equal a full-rerun result.
- **Governance.** Semantic views carry RBAC and are OSI-portable; a Streamlit data layer must respect
  that, not route around it.
- **Define the agent use cases.** "Reason about the data" can mean generate apps, answer questions
  about displayed data, or safely edit the app — each implies different metadata, and some may be
  served more cheaply (e.g., element-tree / AppTest introspection) without a full data model. Nail
  these down before sizing the abstraction.
- **Vocabulary coherence** across `@st.fragment(addressable=...)`, `@st.session_state`, and `@st.data`
  (keys, decorator-on-class/function idioms, no surprise magic).

## Non-goals / out of scope

- Modifying the event-scoped reruns spec or Lukas's session-state spec (this doc is purely
  exploratory and additive in intent).
- Turning Streamlit into a BI tool or a data-modeling tool — the plain-Python path stays first-class
  and Snowflake-optional.
- A full Reflex-style unified `State` paradigm.

## References

- Streamlit API design principles — `specs/AGENTS.md`.
- Event-scoped fragment reruns spec — `specs/2026-06-23-event-scoped-fragment-reruns/product-spec.md`.
- Declarative session state — [PR #14128](https://github.com/streamlit/streamlit/pull/14128),
  `specs/2026-02-25-session-state-class/product-spec.md` (renderer:
  `https://issues.streamlit.app/spec_renderer?pr=14128`).
- Snowflake semantic views — [overview](https://docs.snowflake.com/en/user-guide/views-semantic/overview),
  [YAML spec](https://docs.snowflake.com/en/user-guide/views-semantic/semantic-view-yaml-spec).
- Snowflake Cortex Analyst — [docs](https://docs.snowflake.com/En/user-guide/snowflake-cortex/cortex-analyst).
- Snowflake native semantic views announcement — [blog](https://www.snowflake.com/en/blog/engineering/native-semantic-views-ai-bi/).
- Related demand: #10603, #12799, #10045, #12395, #12980, #9052 (partial/event-driven updates);
  #10089, #9455 (session-state ergonomics, via Lukas's spec).
