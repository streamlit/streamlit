---
author: "@jrieke"
created: 2026-01-06
status: Draft
---

# Binding widget state to query params & persisting widget state

## Summary

Add a `persist` parameter to most widgets that enables 1) binding the widget state to
query params and 2) persisting widget state if the widget is not shown or the page is
switched.

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

### Option 1: One `persist` parameter for both problems

Both problems are related, relatively niche, and affect almost all widgets. It would be
nice to solve them together with a single new parameter, instead of adding two
parameters to each widget:

```python
st.widget(..., persist=None)  # no persistence, default
st.widget(..., persist="query-params")  # binds widget state to query params
st.widget(..., persist="page")  # persist widget state if widget is not rendered, but deletes it on page switch
st.widget(..., persist="session")  # persists widget state for the entire session (i.e. if not rendered or page is switched)
st.widget(..., persist=["query-params", "session"])  # binds to query params + persists for the entire session
```

Could make `"session"` and `"page"` exclusive, since `"session"` naturally means
it's persisted across the page as well.

**Pros:**

- Just one new parameter on each widget instead of two.
- `persist` rhymes well with the same parameter on `st.cache_data` and `st.cache_resource`.
- Can be nicely extended in the future, e.g. `persist="localstorage"`.

**Cons:**

- Concepts are related but not exactly the same. Might be confusing?

**Open questions:**

- Do we also want a way to persist across page switches, but not across the entire
  session/if the widget isn't rendered? I guess this would be a very niche case and most
  devs would just use `persist="session"`, but not sure? We could add `persist="pages"`
  or `persist="page-switch"` to cover this but not sure if we need it (Debbie says no).
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

OK new idea! Use `st.query_params.bind("session_state_key")` to bind query
params to arbitrary values in session state, no matter if widget state or not. What
bothered me about this in the past was that you have to call the `bind` function
for every widget, which seems verbose:

```python
st.widget(..., key="foo")
st.query_params.bind("foo")
```

But what if we made `st.query_params.bind` return the key it gets passed as a string,
then you could just do:

```python
st.widget(..., key=st.query_params.bind("foo"))
```

Only need to figure out how the order works then (because here it would bind the key
before it exists). Maybe we do it in a way where if you call `st.query_params.bind`,
it will bind every session state key created during that run, no matter if it already
exists or not.

And this would also allow us to add more parameters to `st.query_params.bind`, e.g.:

- `query_key: str` to use a different key in the query param than in session state/the
  widget key.
- `format_func: Callable[[Any], str]` to format the value before it's added to the
  query param. Should obviously aim to do most of the conversion ourselves, but just in
  case devs want something custom (e.g. because they don't want to expose
  the session state value itself).
- Some parameter to define if the query param is persisted across page switches.

And then in the future, we can add a `persist` or `scope` parameter to every widget to
set how it should persist its state. Would have a clear separation then + still only
one new parameter on each widget instead.

Note that there's also an (old) prototype from Asaurus
[in this issue](https://github.com/streamlit/streamlit/issues/9325).

### Option 3: Other separate APIs

#### Query params binding

Some ideas we had in the past:

- `st.widget(..., bind_query_param=True)` -> Definitely means two parameters then.
- `st.widget(..., query_key="foo")` -> Seems redundant given that we already have `key`.
- `st.widget(..., key="?foo")` -> Bit too magical, was disliked when we discussed it in
  the past.
- `st.query_params.bind("session_state_key")` -> Could still do this later on, useful if
  you want to bind arbitrary session state keys, not just widget state. But seems a bit
  annoying to do this for every widget.

#### Persisting widget state

Probably needs a parameter similar to above:

- `persist=True|False`
- `scope="page"|"app"|"session"` (where `"app"` would mean across page switches)

We've been also thinking in the past about doing this as a global config option, but I
think that might be confusing. I can imagine that in many cases, you just have a few
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
