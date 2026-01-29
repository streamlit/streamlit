---
author: jrieke
created: 2026-01-06
status: Approved
---

# Binding widget state to query params & persisting widget state

## Summary

Find an API to (1) bind widget state to query params and (2) persist widget state across
conditional rendering and/or page switches. Both are related, so speccing them together.

## Problem

There are two problems here:

1. **Binding widget state to query params:** Devs often add the values of widgets
   to the URL's query parameters as an easy way to preserve or share the state of an app.
   It's hard to build this manually with `st.query_params` due to Streamlit's rerun
   model. There are several community-maintained packages for this, e.g.
   [streamlit-qs](https://github.com/Asaurus1/streamlit-qs).

   Issues:
   - #302
   - #9325

2. **Persisting widget state:** Today, a widget loses its state:
   - if it is not rendered (even temporarily, even with `key`), and
   - when switching pages (page factors into widget identity, even with the same `key`).

   See more info in [this guide](https://docs.streamlit.io/develop/concepts/architecture/widget-behavior).

   Both behaviors were deliberately chosen when we introduced session state and multipage
   apps (avoid cluttering session state, prevent stale state surprises, make pages act
   like isolated "mini-apps"; see e.g.
   [this comment](https://github.com/streamlit/streamlit/issues/5813#issuecomment-1338155093)).

   However, sometimes you want to persist widget state if the widget is not shown or the
   page is switched. Use cases include using the same widget on multiple pages, or
   preserving the state of a page while you view another page.

   Issues:
   - #6074
   - #5813

## Proposal

(Final proposal, previously discussed as option 0).

Add two separate parameters to widgets:

```python
st.widget(..., bind="query-params")
st.widget(..., persist_state=None|"page"|"session")
```

**Notes:**

- `bind` could be extended to `"localstorage"` later.
- `"page"` means persist state if not rendered but delete on page switch. `"session"`
  means persist for the entire session (i.e. if not rendered or page is switched).
- Alternative names:
  - `bind`: sync
  - `persist_state`: persist, scope, lifetime

**Pros:**

- Very explicit. Clear separation of concerns.
- Can leave out `bind` for unsupported widgets (e.g. `st.file_uploader`).

**Cons:**

- Two new parameters for almost every widget.

### Alternatives considered

<details>
<summary>Show details</summary>

#### Option 1: One parameter for both problems

Both problems affect almost all widgets. To avoid multiple new parameters, we could use
a single parameter:

```python
st.widget(..., persist=None)  # no persistence, default
st.widget(..., persist="query-params")  # binds widget state to query params
st.widget(..., persist="page")  # keep state if not rendered, delete on page switch
st.widget(..., persist="session")  # keep state for the session (even if not rendered / across pages)
st.widget(..., persist=["query-params", "session"])  # binds to query params + persists for the entire session
```

**Notes:**

- Could add `"localstorage"` later.
- Could make `"session"` and `"page"` exclusive, since `"session"` naturally means
  it's persisted across the page as well.

**Pros:**

- Just one new parameter on each widget instead of two.

**Cons:**

- Concepts are related but not exactly the same. Might be confusing, especially because
  in the list format, you can't mix and match, but for now only combine `"query-params"`
  and one of the other values.
- Would still need to add `persist` for widgets that don't support query param binding.
  Can of course leave out `"query-params"` then, but it's a bit less clean.

**Open questions:**

- Do we need a mode to persists state across page switches but _not_ while not rendered?
  Probably not.
- `"query-params"` likely should require explicit `key` (to avoid unstable/ugly URLs
  with automated keys). Should `"page"`/`"session"` require `key` too?
- If `persist=["query-params", "page"]` or `persist=["query-params", "session"]` is
  set, should we keep the query params if the widget is not rendered (and for
  `"session"` if the page is switched)? Today they would get removed if the widget is
  not rendered or the page is switched (which always nukes query params). But if we're
  keeping the widget state around, maybe it makes sense to also keep the query params,
  so you can share your app with the same state?

#### Option 2: `st.query_params.bind` but make it work nicely with widgets

Use `st.query_params.bind("session_state_key")` to bind query params to arbitrary
session state keys, no matter if widget state or not:

```python
st.widget(..., key="foo")
st.query_params.bind("foo")

st.session_state.bar = 123
st.query_params.bind("bar")
```

As a shorthand, we could make `st.query_params.bind` return the key it gets passed as a
string, then you could just do:

```python
st.widget(..., key=st.query_params.bind("foo"))
```

For state persistence, add a parameter to widgets, similar to option 0:

```python
st.widget(..., persist_state=None|"page"|"session")
```

**Notes:**

- Need to define ordering; `key=st.query_params.bind("foo")` binds before the widget runs.
  One option: bindings apply to keys created during the run (whether they already existed or not).
- Can add additional parameters to `st.query_params.bind`, e.g.:
  - `query_key: str` to use a different key in the query param than in session state/the
    widget key.
  - `format_func: Callable[[Any], str]` to format the value before it's added to the
    query param (for custom encodings / not exposing raw values).
  - A parameter to define whether query params persist across page switches.
- Note that there's also an (old) prototype from Asaurus
  [in this issue](https://github.com/streamlit/streamlit/issues/9325).

**Pros:**

- Only adds one parameter for state persistence.
- Very powerful for query param binding (arbitrary session state values, additional
  parameters).
- Small API surface for widget binding since `st.query_params` already exists.

**Cons:**

- `key=st.query_params.bind("foo")` feels a bit magical.
- Different from current prototype; potentially harder to implement.
- No way to "unbind" a widget from query params.
- No good way to show for which widgets query param binding doesn't work.

#### Other ideas we had in the past

- `st.widget(..., query_key="foo")` -> Seems redundant given that we already have `key`.
- `st.widget(..., key="?foo")` -> Bit too magical, was disliked when we discussed it in
  the past.
- Having global config options instead of per-widget parameters, but I think that might
  be confusing. I can imagine that in many cases, you just have a few
  widgets that you want to persist, so having a global config option might interfere too
  much with other widgets. It also seems confusing to have "two operating modes" for
  widgets in Streamlit – makes it a lot harder to understand code then.

</details>

### Details

Details (e.g. serialization format) are covered in the
[tech spec](https://www.notion.so/snowflake-corp/Widget-Binding-Tech-Spec-v1-2df7170bb416807b895feae457c9a790)
and [demo app](https://widget-query-params-demo.streamlit.app/).

## Checklist

| Item                       | ✅ or comment                                          |
| -------------------------- | ------------------------------------------------------ |
| Works on SiS, Cloud, etc?  | ✅ `st.query_params` already works, so should be fine. |
| No breaking API changes    | ✅                                                     |
| No new dependencies        | ✅                                                     |
| Metrics collected          | ✅ Need to track the new parameters of course.         |
| Any security/legal impact? | ✅                                                     |
| Any docs changes needed?   | ✅                                                     |
