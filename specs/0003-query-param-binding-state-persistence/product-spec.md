---
author: "@jrieke"
created: 2026-01-06
status: Draft
---

# Binding widget state to query params & persisting widget state

## Summary

Find an API to bind widget state to query params and persist widget state if the widget
is not shown or the page is switched. These problems are slightly related, so speccing
them out together.

## Problem

There are two problems here:

1. **Binding widget state to query params:** Devs often add the values of widgets
   to the URL's query parameters as an easy way to preserve or share the state of an app.
   It's possible to build this manually with `st.query_params` but it's
   annoying due to Streamlit's rerun model. There are several community-maintained
   packages for this, e.g. [streamlit-qs](https://github.com/Asaurus1/streamlit-qs).

   Issues:

   - #302
   - #9325

2. **Persisting widget state:** Today, a widget loses its state:

   - if it is not rendered (even if that's temporary and even if `key` is set), and
   - when the page is switched (even if the new page contains the same widget with
     the same `key`; this is because the page factors into the widget's identity).

   See more info in [this guide](https://docs.streamlit.io/develop/concepts/architecture/widget-behavior).

   Both behaviors were deliberately chosen when we introduced session state and
   multipage apps to avoid cluttering session state, to prevent old widget states from
   causing confusion, and to make pages act like isolated "mini-apps" (see e.g.
   [this comment](https://github.com/streamlit/streamlit/issues/5813#issuecomment-1338155093)).

   However, sometimes you want to persist widget state if the widget is not shown or the
   page is switched. Use cases include using the same widget on multiple pages, or
   preserving the state of a page while you view another page.

   Issues:

   - #6074
   - #5813

## Proposal

### Option 0: Two separate parameters

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

### Option 1: One parameter for both problems

Both problems are related, relatively niche, and affect almost all widgets. To avoid
adding too many parameters, we could solve them with a single parameter:

```python
st.widget(..., persist=None)  # no persistence, default
st.widget(..., persist="query-params")  # binds widget state to query params
st.widget(..., persist="page")  # persist widget state if widget is not rendered, but deletes it on page switch
st.widget(..., persist="session")  # persists widget state for the entire session (i.e. if not rendered or page is switched)
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

- Do we also want a way to persist across page switches, but not across the entire
  session/if the widget isn't rendered? I guess this would be a very niche case and most
  devs would just use `persist="session"`, but not sure? -> Probably not needed.
- At least `"query-params"` should only work when `key` is set, otherwise it might
  create long, ugly, and unstable URLs (plus, would add a lot of implementation time).
  Should the same be true for `"session"` or can we make this work without setting `key`?
- If `persist=["query-params", "page"]` or `persist=["query-params", "session"]` is
  set, should we keep the query params if the widget is not rendered (and for
  `"session"` if the page is switched)? Today they would get removed if the widget is
  not rendered or the page is switched (which always nukes query params). But if we're
  keeping the widget state around, maybe it makes sense to also keep the query params,
  so you can share your app with the same state?

### Option 2: `st.query_params.bind` but make it work nicely with widgets

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
st.widget(..., persist=None|"page"|"session")
```

**Notes:**

- Need to figure out how the order works; if we do `key=st.query_params.bind("foo")`,
  it would bind the key before it exists. Maybe we do it in a way where it binds every
  session state key created during that run, no matter if it already exists or not.
- Can add additional parameters to `st.query_params.bind`, e.g.:
  - `query_key: str` to use a different key in the query param than in session state/the
    widget key.
  - `format_func: Callable[[Any], str]` to format the value before it's added to the
    query param. Should obviously aim to do most of the conversion ourselves, but just in
    case devs want something custom (e.g. because they don't want to expose
    the session state value itself).
  - Some parameter to define if the query param is persisted across page switches.
- Note that there's also an (old) prototype from Asaurus
  [in this issue](https://github.com/streamlit/streamlit/issues/9325).

**Pros:**

- Only adds one parameter for state persistence.
- Very powerful for query param binding (arbitrary session state vablues, additional
  parameters).
- Small API surface for widget binding since `st.query_params` already exists.

**Cons:**

- `key=st.query_params.bind("foo")` feels a bit magical.
- Very different from current prototype and potentially harder to implement.
- No way to "unbind" a widget from query params.
- No good way to show for which widgets query param binding doesn't work. 

### Other ideas we had in the past

- `st.widget(..., query_key="foo")` -> Seems redundant given that we already have `key`.
- `st.widget(..., key="?foo")` -> Bit too magical, was disliked when we discussed it in
  the past.
- Having global config options instead of per-widget parameters, but I think that might
  be confusing. I can imagine that in many cases, you just have a few
  widgets that you want to persist, so having a global config option might interfere too
  much with other widgets. It also seems confusing to have "two operating modes" for
  widgets in Streamlit – makes it a lot harder to understand code then.

### Details

A lot of details (e.g. how to serialize different widget values for query params)
are already covered in the [tech spec](https://www.notion.so/snowflake-corp/Widget-Binding-Tech-Spec-v1-2df7170bb416807b895feae457c9a790)
and [demo app](https://widget-query-params-demo.streamlit.app/),
so will not repeat them here.

## Checklist

| Item                       | ✅ or comment                                          |
| -------------------------- | ------------------------------------------------------ |
| Works on SiS, Cloud, etc?  | ✅ `st.query_params` already works, so should be fine. |
| No breaking API changes    | ✅                                                     |
| No new dependencies        | ✅                                                     |
| Metrics collected          | ✅ Need to track the new parameters of course.         |
| Any security/legal impact? | ✅                                                     |
| Any docs changes needed?   | ✅                                                     |
