---
author: lukasmasuch
created: 2026-09-17
---

# Autocomplete suggestions for `st.text_input`

## Summary

`st.text_input` offers no suggestions as the user types, so apps that need a field backed by a
large or frequently changing list have to fall back on `st.selectbox` (which needs every option
loaded up front) or a third-party component.

This adds autocomplete to `st.text_input`: pass a function to the existing `autocomplete`
parameter, and Streamlit calls it as the user types and offers the strings it returns in a
dropdown. The user can still type anything — suggestions only help them get there faster — and
fetching them doesn't rerun the app, so hints stay responsive no matter how heavy the rest of
the script is. Passing a string keeps its current meaning (browser autofill).

## Problem

**GitHub issue:** [#7807](https://github.com/streamlit/streamlit/issues/7807) — "Typeahead/autocomplete (async) `st.selectbox` / `st.text_input` widget"

Users want a text field that proposes completions from a **backend** source as they type:
product names from a database, ticker symbols from an API, addresses from a geocoder, prior
search queries. What these share is that the candidate set is too large, too dynamic, or too
expensive to materialize up front, so it has to be queried from the current text.

Nothing in Streamlit does this today. `st.selectbox` / `st.multiselect` filter a **static**
`options` list that is shipped to the browser in full and filtered client-side (see
[selectbox filter mode](../2026-03-25-selectbox-filter-mode/product-spec.md)); there is no way
to feed them options from a server query keyed on the input. `st.text_input` takes free text
but offers no suggestions at all.

### Use cases

1. **Database-backed typeahead** — suggest matches from a 100k-row table without loading it
   into memory.
2. **API-driven completion** — address/place lookup, ticker symbols, user mentions.
3. **Recent or contextual hints** — offer prior queries while still allowing free text.

### Current workarounds

| Workaround | Limitation |
| --- | --- |
| `st.selectbox` with a large `options` list | Every option is serialized to the browser; no server query, so it's slow and memory-heavy for large or dynamic sets, and can't return the exact typed text unless `accept_new_options=True` |
| Third-party components (`streamlit-searchbox`, `streamlit-keyup` + a manual list) | An external dependency to install and trust, doesn't follow native theming, extra maintenance |
| [`st.text_input(..., live=True)`](../2026-08-03-text-input-live-update/product-spec.md) plus your own list of matches below the field | Each typing pause reruns the whole app or fragment just to recompute hints, so hint latency is tied to full script execution. The matches are ordinary elements rather than an input dropdown: no keyboard navigation, no inline completion, and the page flickers |

That last row is why this belongs in the widget rather than in a recipe. Fetching hints is a
lightweight, high-frequency, read-only lookup, so it should not cost a script rerun.

## Proposal

Extend `autocomplete` so it also accepts a function. Suggestions are fetched over the same
"backend operation" channel that already serves lazy dataframe loading and, in
[#16303](https://github.com/streamlit/streamlit/pull/16303), server-side validation — no
script rerun (see the [tech spec](./tech-spec.md) for the mechanism).

```python
import streamlit as st


def suggest_products(text: str) -> list[str]:
    if not text:
        return []
    return db.query("SELECT name FROM products WHERE name ILIKE ? LIMIT 10", f"{text}%")


product = st.text_input("Product", autocomplete=suggest_products)
```

### Parameter: `autocomplete`

```python
autocomplete: str | Callable[[str], Sequence[str]] | None = None
```

| Value | Meaning |
| --- | --- |
| `None` (default) | Native autofill token derived from `type` — current behavior (`"email"` for `type="email"`, `"off"` for `"search"`, and so on). |
| `str` | Explicit native `<input autocomplete>` token, e.g. `"email"` or `"off"` — current behavior. |
| `Callable[[str], Sequence[str]]` | **New.** Server-side suggestion source, called with the current text; the returned strings are shown in a dropdown. Return a collection of strings — a bare `str` satisfies `Sequence[str]` but is rejected rather than split into characters. |

`Sequence[str]` rather than `Iterable[str]` is deliberate: it's the same shape the deferred
static-list form would take, so the two stay interchangeable. The runtime is more forgiving
than the annotation — it walks whatever the source returns, bounded — but a source that wants
to stream should materialize its own page instead.

The return type of `st.text_input` is unchanged (`str | None`). Suggestions only *propose*
values; the widget's value is always the text in the field, whether typed or chosen.

### Behavior

All of the following applies only when `autocomplete` is a callable.

- **When it's called:** while the field is focused, after a 300ms pause in typing. It receives
  the current text verbatim — on focus that means whatever is already in the field, and `""`
  only when the field is empty, which is a source's chance to offer default or recent
  suggestions; return `[]` to show nothing.

  The pause is deliberately generous, and independent of `live`, because each lookup can cost a
  database query or an API call. A large-scale typing study measured a mean inter-key interval
  of 239ms
  ([Dhakal et al., CHI 2018](https://userinterfaces.aalto.fi/136Mkeystrokes/resources/chi-18-analysis.pdf)),
  so a shorter delay would routinely fire *between* keystrokes and bill the app for suggestions
  nobody sees. It is longer than `live`'s 250ms default on purpose: a live rerun updates the
  results the user came for, while a suggestion lookup only draws hints.
- **Nothing is requested mid-IME-composition.** One request is scheduled once the composition
  ends, so typing CJK or using dead keys doesn't fire lookups on half-formed text.
- **The dropdown:** non-empty results open a list below the input; an empty result closes it,
  as does blurring the field or pressing `Esc`. Streamlit caps how many suggestions it returns
  and how long each may be, so an oversized result set can't flood the browser (limits in the
  tech spec). An over-long suggestion is dropped rather than shortened — offering a trimmed
  string would let the user commit something the source never returned.
- **Choosing a suggestion:** click one, or highlight it with ↑/↓ and press Enter or Tab.
  Opening the list highlights nothing, and only ↑/↓ arms a row for Enter or Tab (hovering
  highlights visually but doesn't arm it, and pointer selection is a click). So until the user
  arrows, Enter and Tab do exactly what they do today — a search field must never silently turn
  "Enter to search" into "accept the first hint". Choosing fills the field and **commits** the
  value —
  the same commit that typing the value and blurring performs, not a replayed Enter keystroke.
  So outside a form it reruns the app in the widget's normal scope and fires `on_change`;
  inside a form it fills and stages the value without submitting; with `on_change="ignore"` it
  stages without a rerun. While a row is *armed* — which only ↑/↓ does, as distinct from the
  hover highlight — Enter selects instead of submitting a form, and Tab selects and then moves
  focus as Tab normally would. `Esc` closes the list
  without changing the value and goes no further, so it doesn't also close a surrounding
  `st.dialog`, and the next Enter or Tab behaves exactly as it does today.
- **Free text is always allowed.** Unlike `st.selectbox`, the user is never forced to pick a
  suggestion; typing and committing an unlisted value behaves like a normal text input. This is
  autocomplete, not a constrained select.
- **Requests are asynchronous.** A newer keystroke supersedes an in-flight request and stale
  responses are dropped, so the list always reflects the current text. While a request is
  outstanding the field is marked busy and shows a small spinner. Since both an empty result
  and a failure close the list, that state is also announced to assistive tech, so a
  screen-reader user can tell "still loading" from "nothing found" without watching the
  spinner.
- **Failures fail closed.** If the function raises, times out, or returns an unexpected type,
  the dropdown shows nothing and the field stays fully usable for free text. Nothing is
  surfaced to the user as an error — a missing hint is not worth interrupting them for. The
  cause is logged **server-side only** and never sent to the browser, since the function may
  touch secrets or database rows.
- **The function must be safe to call from a worker thread.** It runs off the script thread,
  and Streamlit may call it concurrently — several lookups can be in flight, and two widgets
  can share one function — so it should be reentrant and avoid thread-affine database clients
  and mutable closed-over state.
- **The function runs outside a script run**, so it must be a fast, read-only lookup. Having no
  script context means it can do *less* than a callback: `st.*` display commands and
  `st.session_state` both **raise** there rather than quietly half-working, and the lookup then
  fails closed like any other error. Session state raises by design: off the script thread it
  would otherwise resolve to a store shared by every session, where one user's write becomes
  another user's read. App logic belongs in `on_change` or the normal rerun. See [Caching and
  passing in context](#caching-and-passing-in-context) for how to work with that.
- **Browser autofill is suppressed** for the field so the browser's own dropdown doesn't compete
  with Streamlit's. `autocomplete="off"` doesn't achieve that on its own — Chrome ignores it for
  fields it reads as name, address, or email, which is exactly what this feature is for — so the
  native attribute is set to a token no browser recognizes.

### Caching and passing in context

Two things follow from the function running off the script thread, and both are load-bearing
for the headline use case.

**Caching works, and is the main way to make an expensive source cheap.** A function decorated
with `@st.cache_data` or `@st.cache_resource` can be called normally, so a repeated prefix
doesn't re-hit the database, and `@st.cache_resource` is the natural place to keep the
connection or client — a thread-safe one or a connection pool, since a cached resource is
shared and lookups can run concurrently. This is not a special case:
`st.cache_data(refresh_mode="background")`
already recomputes cached functions off the script thread the same way. The one limitation is
`scope="session"`, which needs a session to resolve and raises when there isn't one — the
lookup then fails closed to an empty dropdown. Use the default `scope="global"`.

**Pass session values in at registration time.** The function is re-registered on every rerun,
on the script thread, where session state *is* available — so read it there and bind it with
`functools.partial`. Bind by **keyword**, so the current text stays the first positional
argument. For a cached source this is a requirement rather than a style preference: a global
cache is shared across sessions and its key is built from the call arguments alone, so any
value that changes the result — a tenant, a category, a set of credentials — must arrive as an
argument. Close over it instead and one user's cached suggestions answer another user's
lookup.

```python
import functools
import streamlit as st


@st.cache_data(ttl="10m")  # default scope="global"
def search_products(text: str, *, category: str) -> list[str]:
    return db.query(
        "SELECT name FROM products WHERE category = ? AND name ILIKE ? LIMIT 10",
        category,
        f"{text}%",
    )


category = st.selectbox("Category", ["Fruit", "Dairy"])

product = st.text_input(
    "Product",
    # Reads session/widget state now, on the script thread, and binds it.
    autocomplete=functools.partial(search_products, category=category),
)
```

Note that `text` is untrusted input — it comes from the browser — so keep queries
parameterized, as above, rather than interpolating it into SQL or a URL.

### Design

**No mockups exist yet — the four calls at the end of this section are what design needs to
sign off on.** Everything else is inherited.

**Keep the existing text field and attach the dropdown from `st.selectbox` to it**, rather than
designing anything new. The field itself doesn't change — same icon, placeholder, error state,
character counter, and search clear button — it just gains a suggestion list underneath. That
list is the popover, virtualized option list, and item styling that `st.selectbox` already
uses, so reusing it settles most of the UI by construction:

| Concern | Inherited from the selectbox dropdown |
| --- | --- |
| Placement and sizing | Popover anchored below the field and matched to its width, flipping/shifting near viewport and sidebar edges |
| Long lists | Virtualized list capped at `min(maxDropdownHeight, 70vh)` with internal scrolling, so a large result set costs nothing extra |
| Item look and keyboard nav | Themed rows with the rounded highlight pill; ↑/↓/Enter/Esc and the combobox/listbox ARIA roles come from React Aria |
| Theming | Existing theme tokens, so it tracks custom themes automatically |

That leaves four narrower calls. Each has a proposed answer below, so what's left is a design
pass on visual polish rather than a redesign.

- **Loading affordance** — *proposed.* Selectbox needs none because its filtering is instant.
  Here, show a small spinner in the field's existing end enhancers (beside the error icon and
  clear button) rather than inside the list, so the list never shifts or steals focus, and mark
  the field busy for assistive tech.
- **Empty results** — *proposed.* Selectbox shows a "No results" row. For typeahead that would
  flash on every keystroke that hasn't matched yet, so close the dropdown instead and let the
  announcement above carry the information.
- **No chevron** — *proposed.* Selectbox shows an open button because it has a browsable closed
  set. A text input has none, so there's nothing to browse and no open button: the list appears
  only when the source returns something — on focus if it offers defaults, otherwise as the
  user types.
- **Mobile** — *proposed.* Inherit selectbox's behavior, with one exception: its heuristic of
  suppressing the on-screen keyboard for short option lists must not apply here, since typing
  is the point.

Match highlighting is deliberately *not* on the list: the server decides what matches, so the
browser doesn't know which substring to emphasize (unlike selectbox's client-side filter).

### Interaction with existing parameters

| Parameter | Behavior with a callable `autocomplete` |
| --- | --- |
| `live` | Independent: `live` controls when a committed value reruns the app, `autocomplete` controls the hint dropdown, and each has its own debounce. Choosing a suggestion is a commit, so it follows the widget's normal rerun rules. |
| `on_change`, `on_change="ignore"` | Unchanged, and only ever triggered by a commit. Showing suggestions never fires `on_change`; with `"ignore"`, a chosen suggestion is staged without a rerun. |
| `st.form` | The dropdown works and a selection fills the field, but as with every form widget the *widget value* only reaches the script on submit, and selecting doesn't submit. The typed text does still reach the suggestion source on every debounce — suggestions are a server lookup, not a local filter, inside a form as anywhere else. A source that depends on another field in the same form sees that field's value from the last run, since forms don't rerun until submit. |
| `validate`, `required` | Unchanged, applied at commit time. A chosen suggestion is validated like a typed one. |
| `type` | `"default"` and `"search"` are the natural fits; `"email"`, `"url"`, and `"phone"` are allowed too, at the cost of the browser's own autofill for that field. `type="password"` raises `StreamlitIncompatibleParametersError` — proposing or persisting secrets in a dropdown is a footgun. (A *string* `autocomplete` with `type="password"`, e.g. `"new-password"`, is unaffected.) |
| `bind="query-params"` | Unchanged; a committed suggestion syncs to the URL like any committed value. |
| `max_chars` | Enforced on input as today, so the function only ever sees within-limit text, and suggestions longer than the limit are dropped rather than shortened (see the dropdown bullet above). |
| `disabled` | No suggestions are requested. |

### Examples

**Search field inside a fragment** — keeps typing from rerunning the rest of the app:

```python
import streamlit as st


@st.fragment
def city_search():
    city = st.text_input("City", type="search", autocomplete=suggest_cities)
    if city:
        st.map(geocode(city))


city_search()
```

**Depending on another widget** — the function can't read session state, so bind the value at
registration. A plain closure is enough here because the function isn't cached:

```python
category = st.selectbox("Category", categories)


def suggest_in_category(text: str) -> list[str]:
    return db.search(text, category=category)


product = st.text_input("Product", autocomplete=suggest_in_category)
```

**Existing string form, unchanged** — `st.text_input("Full name", autocomplete="name")` still
just configures browser autofill.

## Alternatives Considered

### Overloading `autocomplete` vs. adding a parameter

| Option | Assessment |
| --- | --- |
| **Overload `autocomplete` (`str \| Callable \| None`)** ✅ chosen | Keeps everything about how a field completes under the one parameter users already reach for (and the word in the issue title), with no new API surface. The value type disambiguates cleanly. |
| A new `suggestions` parameter next to `autocomplete` | Avoids two behaviors on one name, but leaves users asking "do I set one, the other, or both?" and splits a single concept across two knobs (Principle 18: extend before inventing). Rejected. |
| A new `st.searchbox` / `st.autocomplete` command | Would duplicate `type`, `validate`, `live`, `bind`, and form behavior, and fragment the text-input mental model. Rejected. |

The honest tension: a **string** configures browser behavior while a **callable** configures
Streamlit behavior, which stretches Principle 10 ("same name, same behavior"). Both still
answer the same question — how should this field complete? — and the types make the intent
explicit, so the smaller API surface wins.

An `on_*` name (`on_search`, `on_input`) was rejected outright: in Streamlit `on_*` means a
fire-and-forget callback, but this function's **return value** is the entire point.

### What the function returns

Plain strings (`Sequence[str]`) is the whole v1 contract — it matches what
[#7807](https://github.com/streamlit/streamlit/issues/7807) asks for and keeps the feature
small. A structured return (label/value pairs, icons, secondary text) is deliberately deferred:
it can be layered on later without breaking the string form (Principle 4).

Producing suggestions via a rerun (`live=True` plus a hand-rolled list) was rejected as the
native mechanism for the reasons in [Current workarounds](#current-workarounds).

## Out of Scope (Future Work)

- **Static candidate list:** let `autocomplete` also accept a `Sequence[str]`, filtered in the
  browser with no server round trip. A natural extension (the callable already returns
  `Sequence[str]`), deferred to keep v1 on the backend case the issue asks for.
- **`st.text_area` support:** multi-line and token-level completion need their own design.
- **`st.selectbox` / `st.multiselect` async options** (the other half of
  [#7807](https://github.com/streamlit/streamlit/issues/7807)): a *constrained* server-queried
  select is a different widget contract, since the value must be one of the options.
- **Rich suggestion items:** label/value pairs, icons, secondary text, grouping, highlighted
  match ranges.
- **`autocomplete_min_chars`:** a minimum length before querying. Sources can already
  early-return `[]` for short input.
- **Async / coroutine functions:** v1 runs a synchronous callable in a worker thread.
- **Built-in caching and a configurable debounce.** Users can wrap their function in
  `@st.cache_data` in the meantime — the global default only, since `scope="session"` needs a
  script run context the function doesn't have.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | ✅ Uses the existing backend-operation channel over the WebSocket (as lazy dataframes and server-side validation do); the browser never calls out directly |
| No breaking API changes | ✅ Additive overload of an existing parameter; `None` and `str` behavior unchanged; the callable is not part of widget identity, so swapping it won't reset a keyed widget |
| No new dependencies | ✅ Reuses the existing backend-operation infrastructure and native UI primitives |
| Metrics collected | ✅ Track which `autocomplete` mode is used (callable, string, unset) via the existing text_input metrics |
| Any security/legal impact? | ⚠️ A user function runs off the rerun path, so it must mirror the lazy-dataframe and validation safeguards: unguessable session-scoped source id, session validation, debounce, timeout, result caps, per-session rate budget, fail-closed, server-only error logging, and no reachable session state. See the tech spec |
| Any docs changes needed? | ✅ Update the `st.text_input` docstring and the embedded `developing-with-streamlit` skill |
