# Parallel fragments — proposed docs changes

This document contains proposed changes to the public Streamlit docs
(`streamlit/docs`, `main` branch) to cover the new `parallel` parameter on
`@st.fragment`. It is a **draft for human review** — nothing here has been
applied to the live docs.

For each affected page you'll find the page path, a short description of the
change, the **current text** (quoted with enough context to locate it), and the
**proposed text** to replace it with. New pages include full content and the
`menu.md` lines required to surface them.

All docs paths are relative to the `streamlit/docs` repo root.

---

## Feature recap (for reviewers)

`@st.fragment` now accepts a `parallel: bool` parameter (default `False`). When
`parallel=True`:

- During a **full app rerun**, the fragment is dispatched to a thread pool and
  runs concurrently with other parallel fragments and the rest of the main
  script. This is useful for independent, slow operations (database queries, API
  calls) that shouldn't block overall app throughput.
- During a **fragment rerun** (triggered by a widget interaction inside the
  fragment), execution stays sequential — the fragment runs alone, exactly like a
  non-parallel fragment. This keeps state updates deterministic.
- **API restrictions during parallel execution**: Some commands aren't safe to
  call from concurrent threads and are restricted during the initial parallel
  run. These include `st.dialog`, `st.switch_page`, and writing to containers
  created outside the fragment. They work normally during fragment reruns (after
  a widget interaction).
- **Thread safety**: Parallel fragments can run concurrently, so avoid
  unsynchronized mutations of shared mutable resources (including Session State)
  unless you coordinate access explicitly.

Parallel fragments shipped in **Streamlit 1.58.0** (see the 2026 release notes,
which already mention the feature — no change needed there).

---

## Summary of pages

| # | Page | Type of change |
|---|------|----------------|
| 1 | `content/develop/concepts/architecture/fragments.md` | Multiple edits + new section |
| 2 | `content/develop/api-reference/control-flow/fragment.md` | Minor (keywords only; content is auto-generated) |
| 3 | `content/develop/tutorials/execution-flow/fragments/run-fragments-in-parallel.md` | **New tutorial page** |
| 4 | `content/menu.md` | New tutorial menu entry |
| 5 | `content/develop/quick-references/release-notes/2026.md` | No change needed (already covered) |

> **Note on the API reference page:** `content/develop/api-reference/control-flow/fragment.md`
> renders the `st.fragment` docstring via `<Autofunction function="streamlit.fragment" />`.
> The `parallel` parameter is already documented in the library docstring
> (`lib/streamlit/runtime/fragment.py`), so the rendered page will pick it up
> automatically. The only optional change is adding `parallel` to the page's SEO
> keywords (see change 2).

---

# 1. `content/develop/concepts/architecture/fragments.md`

This is the main conceptual guide and needs the most work. There are six
distinct edits below (1a–1f).

## 1a. Add parallel fragments to the "Use cases for fragments" list

**What to change:** Add a bullet that introduces the parallel use case so the
feature is discoverable from the top of the page.

**Current text:**

```markdown
## Use cases for fragments

Fragments are versatile and applicable to a wide variety of circumstances. Here are just a few, common scenarios where fragments are useful:

- Your app has multiple visualizations and each one takes time to load, but you have a filter input that only updates one of them.
- You have a dynamic form that doesn't need to update the rest of your app (until the form is complete).
- You want to automatically update a single component or group of components to stream data.
```

**Proposed text:**

```markdown
## Use cases for fragments

Fragments are versatile and applicable to a wide variety of circumstances. Here are just a few, common scenarios where fragments are useful:

- Your app has multiple visualizations and each one takes time to load, but you have a filter input that only updates one of them.
- You have a dynamic form that doesn't need to update the rest of your app (until the form is complete).
- You want to automatically update a single component or group of components to stream data.
- Your app has several slow, independent operations (like database queries or API calls) that you want to run at the same time instead of one after another.
```

---

## 1b. Mention parallel execution in the "Fragment execution flow" section

**What to change:** Add a short paragraph at the end of the execution-flow
section explaining that, by default, fragments run inline and in order, and
pointing to the new parallel section. This sets up the contrast before the
detailed section later on.

**Current text** (end of the "Fragment execution flow" section):

```markdown
If you run the code above, the full script will run top to bottom on your app's initial load. If you flip the toggle button in your running app, the first fragment (`toggle_and_text()`) will rerun, redrawing the toggle and text area while leaving everything else unchanged. If you click the checkbox, the second fragment (`filter_and_file()`) will rerun and consequently redraw the checkbox and file uploader. Everything else remains unchanged. Finally, if you click the update button, the full script will rerun, and Streamlit will redraw everything.

![Diagram of fragment execution flow](/images/concepts/fragment_diagram.png)
```

**Proposed text:**

```markdown
If you run the code above, the full script will run top to bottom on your app's initial load. If you flip the toggle button in your running app, the first fragment (`toggle_and_text()`) will rerun, redrawing the toggle and text area while leaving everything else unchanged. If you click the checkbox, the second fragment (`filter_and_file()`) will rerun and consequently redraw the checkbox and file uploader. Everything else remains unchanged. Finally, if you click the update button, the full script will rerun, and Streamlit will redraw everything.

![Diagram of fragment execution flow](/images/concepts/fragment_diagram.png)

By default, fragments run inline on the main thread, in the order you call them, just like the rest of your script. If you have slow, independent fragments, you can opt in to running them concurrently during full-app reruns with `parallel=True`. See [Run fragments in parallel](#run-fragments-in-parallel) below.
```

---

## 1c. New section: "Run fragments in parallel"

**What to change:** Add a new top-level section. Place it after the "Automate
fragment reruns" section and before "Compare fragments to other Streamlit
features" so it sits with the other behavioral features.

**Current text** (insertion point — end of "Automate fragment reruns"):

```markdown
For a related tutorial, see [Start and stop a streaming fragment](/develop/tutorials/execution-flow/start-and-stop-fragment-auto-reruns).

## Compare fragments to other Streamlit features
```

**Proposed text** (insert the new section between those two lines):

```markdown
For a related tutorial, see [Start and stop a streaming fragment](/develop/tutorials/execution-flow/start-and-stop-fragment-auto-reruns).

## Run fragments in parallel

By default, fragments run inline on the main thread, in the order you call them. If your app has several slow, independent fragments—for example, fragments that each run a database query or call an external API—you can run them concurrently by setting `parallel=True` in the `st.fragment` decorator.

```python
import streamlit as st

@st.fragment(parallel=True)
def slow_chart():
    data = expensive_query()  # runs concurrently with the rest of the app
    st.line_chart(data)

@st.fragment(parallel=True)
def slow_table():
    data = another_expensive_query()
    st.dataframe(data)

slow_chart()
slow_table()
```

When `parallel=True`, the behavior depends on the type of rerun:

- **During a full-app rerun**, Streamlit dispatches the fragment to a thread pool. It runs concurrently with your other parallel fragments and with the rest of your main script, rather than blocking on each fragment in turn. If `slow_chart` and `slow_table` each take two seconds, running them in parallel lets your app finish in about two seconds instead of four.
- **During a fragment rerun** (when a user interacts with a widget inside the fragment), execution stays sequential. The fragment runs by itself on the main thread, exactly like a non-parallel fragment. This keeps your state updates predictable when a user is actively interacting with a fragment.

Parallel fragments are most helpful when each fragment does independent, time-consuming work. If your fragments are fast or depend on each other's results, running them in parallel adds complexity without a meaningful speedup.

<Tip>

To learn how to apply this in a complete app, see [Speed up your app with parallel fragments](/develop/tutorials/execution-flow/run-fragments-in-parallel).

</Tip>

### Restricted commands during parallel execution

Because parallel fragments run concurrently on separate threads during the initial (full-app) run, a few Streamlit commands aren't safe to call from inside them and will raise an error. These include:

- [`st.dialog`](/develop/api-reference/execution-flow/st.dialog)
- [`st.switch_page`](/develop/api-reference/navigation/st.switch_page)
- Writing to containers created outside the fragment.

These commands work normally during a fragment rerun (for example, after a user interacts with a widget inside the fragment), because fragment reruns are sequential. If you need one of these commands, call it from a non-parallel fragment or from the main body of your script.

### Thread safety and shared state

Parallel fragments can run at the same time, so they can read and write shared resources concurrently. This includes Session State, global variables, files, and external connections. To avoid race conditions:

- Prefer having each parallel fragment write to its **own** Session State keys, then read the combined results back in your main script after the fragments finish.
- Avoid having two parallel fragments mutate the same Session State key, list, or dictionary at the same time.
- If parallel fragments must share a mutable resource, coordinate access explicitly (for example, with a `threading.Lock`).

<Warning>

Fragments dispatched in parallel can run concurrently. Avoid unsynchronized mutations of shared mutable resources across fragments unless you coordinate access explicitly.

</Warning>

## Compare fragments to other Streamlit features
```

> **Reviewer note:** The docs use `<Tip>`, `<Note>`, and `<Warning>` callout
> tags elsewhere. I used `<Tip>` and `<Warning>` here; swap for `<Note>` if the
> docs team prefers. Also double-check the `st.switch_page` slug
> (`/develop/api-reference/navigation/st.switch_page`) against the live menu
> before applying.

---

## 1d. Note `parallel`/`run_every` interaction in "Automate fragment reruns"

**What to change:** Add a short note explaining how `parallel` and `run_every`
work together, since users will combine them for live, independent data feeds.

**Current text:**

```markdown
```python
@st.fragment(run_every="10s")
def auto_function():
		# This will update every 10 seconds!
		df = get_latest_updates()
		st.line_chart(df)

auto_function()
```

For a related tutorial, see [Start and stop a streaming fragment](/develop/tutorials/execution-flow/start-and-stop-fragment-auto-reruns).
```

**Proposed text:**

```markdown
```python
@st.fragment(run_every="10s")
def auto_function():
		# This will update every 10 seconds!
		df = get_latest_updates()
		st.line_chart(df)

auto_function()
```

You can combine `run_every` with `parallel=True`. The automatic reruns triggered by `run_every` are fragment reruns, so they execute sequentially (just like reruns triggered by a user). The `parallel=True` setting only changes how the fragment behaves during a full-app rerun. This combination is handy when you have several independent, auto-updating data feeds that you want to load concurrently on each full-app rerun:

```python
@st.fragment(parallel=True, run_every="5s")
def live_metrics():
    data = fetch_latest_metrics()
    st.metric("Active Users", data["users"])

live_metrics()
```

For a related tutorial, see [Start and stop a streaming fragment](/develop/tutorials/execution-flow/start-and-stop-fragment-auto-reruns).
```

---

## 1e. Add thread-safety note to "Fragment return values and interacting with the rest of your app"

**What to change:** This section already tells users to share data through
Session State. Add a note that, with `parallel=True`, that shared access can
happen concurrently and must be handled carefully.

**Current text** (end of the section, just before "## Automate fragment reruns"):

```markdown
If you need to trigger a full-script rerun from inside a fragment, call [`st.rerun`](/develop/api-reference/execution-flow/st.rerun). For a related tutorial, see [Trigger a full-script rerun from inside a fragment](/develop/tutorials/execution-flow/trigger-a-full-script-rerun-from-a-fragment).

## Automate fragment reruns
```

**Proposed text:**

```markdown
If you need to trigger a full-script rerun from inside a fragment, call [`st.rerun`](/develop/api-reference/execution-flow/st.rerun). For a related tutorial, see [Trigger a full-script rerun from inside a fragment](/develop/tutorials/execution-flow/trigger-a-full-script-rerun-from-a-fragment).

<Note>

If you run fragments in parallel (with `parallel=True`), they can read and write Session State at the same time as each other and as your main script. To keep your data consistent, have each parallel fragment write to its own Session State keys, and avoid having two parallel fragments mutate the same object concurrently. See [Run fragments in parallel](#run-fragments-in-parallel) for more on thread safety.

</Note>

## Automate fragment reruns
```

---

## 1f. Update "Limitations and unsupported behavior" for parallel restrictions

**What to change:** Add bullets describing the parallel-specific restrictions and
thread-safety responsibility.

**Current text:**

```markdown
## Limitations and unsupported behavior

- Fragments can't detect a change in input values. It is best to use Session State for dynamic input and output for fragment functions.
- Using caching and fragments on the same function is unsupported.
- Fragments can't render widgets in externally-created containers; widgets can only be in the main body of a fragment.
```

**Proposed text:**

```markdown
## Limitations and unsupported behavior

- Fragments can't detect a change in input values. It is best to use Session State for dynamic input and output for fragment functions.
- Using caching and fragments on the same function is unsupported.
- Fragments can't render widgets in externally-created containers; widgets can only be in the main body of a fragment.
- When a fragment runs in parallel (`parallel=True`), some commands are restricted during the initial full-app run because they aren't safe to call from concurrent threads. These include `st.dialog`, `st.switch_page`, and writing to containers created outside the fragment. These commands work normally during a (sequential) fragment rerun.
- Parallel fragments run concurrently, so you are responsible for thread safety. Avoid unsynchronized mutations of shared mutable resources—such as Session State, global variables, or files—across parallel fragments unless you coordinate access explicitly.
```

---

# 2. `content/develop/api-reference/control-flow/fragment.md`

**What to change:** The page body is generated from the `st.fragment` docstring
via `<Autofunction>`, so the `parallel` parameter documentation appears
automatically once the library is released — **no body change required**. The
only optional edit is adding `parallel` to the SEO `keywords` in the front
matter.

**Current text:**

```markdown
---
title: st.fragment
slug: /develop/api-reference/execution-flow/st.fragment
description: st.fragment is a decorator that allows a function to rerun independently from the rest of the script.
keywords: st.fragment, fragment, decorator, rerun, independent, execution flow, control flow, run_every, experimental_fragment
---

<Autofunction function="streamlit.fragment" oldName="streamlit.experimental_fragment" />
```

**Proposed text:**

```markdown
---
title: st.fragment
slug: /develop/api-reference/execution-flow/st.fragment
description: st.fragment is a decorator that allows a function to rerun independently from the rest of the script.
keywords: st.fragment, fragment, decorator, rerun, independent, execution flow, control flow, run_every, parallel, parallel fragments, concurrency, experimental_fragment
---

<Autofunction function="streamlit.fragment" oldName="streamlit.experimental_fragment" />
```

---

# 3. New tutorial page

**Proposed path:** `content/develop/tutorials/execution-flow/fragments/run-fragments-in-parallel.md`

**Slug:** `/develop/tutorials/execution-flow/run-fragments-in-parallel`

This new tutorial follows the structure of the existing fragment tutorials
(Applied concepts → Prerequisites → Summary → step-by-step build → Next steps).

**Full page content:**

```markdown
---
title: Speed up your app with parallel fragments
slug: /develop/tutorials/execution-flow/run-fragments-in-parallel
description: Learn how to run Streamlit fragments concurrently with parallel=True to load slow, independent operations like database queries and API calls at the same time.
keywords: parallel fragments, st.fragment, parallel, concurrency, threading, performance, slow queries, api calls, execution flow, app performance
---

# Speed up your app with parallel fragments

Streamlit lets you turn functions into [fragments](/develop/concepts/architecture/fragments), which can rerun independently from the full script. By default, fragments run one after another on the main thread. If your app has several slow, independent operations—like database queries or API calls—you can run them at the same time by setting `parallel=True` in the [`@st.fragment`](/develop/api-reference/execution-flow/st.fragment) decorator. During a full-app rerun, Streamlit dispatches each parallel fragment to a thread pool so they execute concurrently instead of blocking each other.

## Applied concepts

- Use `parallel=True` to run slow, independent fragments concurrently.
- Store each fragment's results in Session State to safely combine them.

## Prerequisites

- This tutorial requires the following version of Streamlit:

  ```text
  streamlit>=1.58.0
  ```

- You should have a clean working directory called `your-repository`.
- You should have a basic understanding of fragments and Session State.

## Summary

In this example, you'll build an app that loads data from three independent, slow sources. Without parallel fragments, the app waits for each source in turn, so the total load time is the sum of all three. By marking each source's fragment with `parallel=True`, the three loads run concurrently during a full-app rerun, and the app finishes in about the time of the slowest single source.

You'll simulate slow work with `time.sleep`, but in a real app these fragments would run database queries, call external APIs, or perform other independent, time-consuming work.

Here's a look at what you'll build:

<Collapse title="Complete code" expanded={false}>

```python
import streamlit as st
import time
import random


def slow_load(source_name, seconds):
    """Simulate a slow, independent data source."""
    time.sleep(seconds)
    return {"source": source_name, "value": random.randint(0, 100)}


st.title("Parallel data loading")


@st.fragment(parallel=True)
def load_sales():
    result = slow_load("Sales", 3)
    st.session_state.sales = result
    st.metric("Sales", result["value"])


@st.fragment(parallel=True)
def load_traffic():
    result = slow_load("Traffic", 3)
    st.session_state.traffic = result
    st.metric("Traffic", result["value"])


@st.fragment(parallel=True)
def load_inventory():
    result = slow_load("Inventory", 3)
    st.session_state.inventory = result
    st.metric("Inventory", result["value"])


start = time.time()

cols = st.columns(3)
with cols[0]:
    load_sales()
with cols[1]:
    load_traffic()
with cols[2]:
    load_inventory()

st.caption(f"Loaded in about {time.time() - start:.1f} seconds.")
```

</Collapse>

## Build the app

### Initialize your app and a slow data source

1. In `your-repository`, create a file named `app.py`.

1. In a terminal, change directories to `your-repository`, and start your app.

   ```bash
   streamlit run app.py
   ```

   Your app will be blank because you still need to add code.

1. In `app.py`, write the following:

   ```python
   import streamlit as st
   import time
   import random
   ```

   You'll use `time` to simulate slow work and `random` to generate sample values.

1. Save your `app.py` file, and view your running app.

1. In your app, select "**Always rerun**", or press the "**A**" key.

   Your preview will be blank but will automatically update as you save changes to `app.py`.

1. Return to your code.

1. Define a helper function to simulate a slow, independent data source.

   ```python
   def slow_load(source_name, seconds):
       """Simulate a slow, independent data source."""
       time.sleep(seconds)
       return {"source": source_name, "value": random.randint(0, 100)}
   ```

   In a real app, you'd replace the `time.sleep` call with a database query, an API call, or another time-consuming operation.

1. Add a title to your app.

   ```python
   st.title("Parallel data loading")
   ```

### Define parallel fragments for each data source

Each data source is independent, so each one is a good candidate for its own parallel fragment. Each fragment writes its result to its own Session State key, which keeps the fragments from interfering with each other when they run concurrently.

1. Define a fragment to load your first source.

   ```python
   @st.fragment(parallel=True)
   def load_sales():
       result = slow_load("Sales", 3)
       st.session_state.sales = result
       st.metric("Sales", result["value"])
   ```

   The `parallel=True` argument tells Streamlit to dispatch this fragment to a thread pool during a full-app rerun so it can run at the same time as your other parallel fragments.

1. Define fragments for your other two sources in the same way.

   ```python
   @st.fragment(parallel=True)
   def load_traffic():
       result = slow_load("Traffic", 3)
       st.session_state.traffic = result
       st.metric("Traffic", result["value"])


   @st.fragment(parallel=True)
   def load_inventory():
       result = slow_load("Inventory", 3)
       st.session_state.inventory = result
       st.metric("Inventory", result["value"])
   ```

   Each fragment writes to a different Session State key (`sales`, `traffic`, and `inventory`). Because parallel fragments can run concurrently, having each one write to its own key avoids race conditions.

### Call your fragments and measure the speedup

1. Record the start time, then call each fragment in its own column.

   ```python
   start = time.time()

   cols = st.columns(3)
   with cols[0]:
       load_sales()
   with cols[1]:
       load_traffic()
   with cols[2]:
       load_inventory()
   ```

   Each fragment renders its metric into its own column. Because the columns are created in the main body of the script, each fragment writes only into its own main body.

1. Display how long the load took.

   ```python
   st.caption(f"Loaded in about {time.time() - start:.1f} seconds.")
   ```

1. Save your `app.py` file, and view your running app.

   Each fragment sleeps for three seconds, but because they run in parallel, your app loads in about three seconds total instead of nine. Try changing `parallel=True` to `parallel=False` (or removing it) to see the difference: the app will take about nine seconds because the fragments run one after another.

## Next steps

Replace the `slow_load` helper with your own slow operations, such as database queries or API calls. To learn more about parallel execution, including command restrictions and thread safety, see [Run fragments in parallel](/develop/concepts/architecture/fragments#run-fragments-in-parallel).
```

> **Reviewer notes for the new tutorial:**
> - Confirm the minimum version (`streamlit>=1.58.0`) matches the actual release
>   that shipped `parallel`.
> - This tutorial has no screenshot. The other fragment tutorials include images
>   under `public/images/tutorials/`. Consider adding a screenshot/GIF and an
>   `<Image>`/`<Collapse>` "what you'll build" preview to match.
> - If the docs team maintains runnable example sources under
>   `python/api-examples-source/tutorials/execution-flow/fragments/`, add a
>   companion script there (e.g. `tutorial-fragment-parallel.py`).

---

# 4. `content/menu.md`

**What to change:** Add a menu entry for the new tutorial in the
"Execution flow" tutorials group, alongside the existing fragment tutorials.

**Current text:**

```markdown
  - category: Develop / Tutorials / Execution flow / FRAGMENTS
  - category: Develop / Tutorials / Execution flow / Rerun your app from a fragment
    url: /develop/tutorials/execution-flow/trigger-a-full-script-rerun-from-a-fragment
  - category: Develop / Tutorials / Execution flow / Create a multiple-container fragment
    url: /develop/tutorials/execution-flow/create-a-multiple-container-fragment
  - category: Develop / Tutorials / Execution flow / Start and stop a streaming fragment
    url: /develop/tutorials/execution-flow/start-and-stop-fragment-auto-reruns
```

**Proposed text:**

```markdown
  - category: Develop / Tutorials / Execution flow / FRAGMENTS
  - category: Develop / Tutorials / Execution flow / Rerun your app from a fragment
    url: /develop/tutorials/execution-flow/trigger-a-full-script-rerun-from-a-fragment
  - category: Develop / Tutorials / Execution flow / Create a multiple-container fragment
    url: /develop/tutorials/execution-flow/create-a-multiple-container-fragment
  - category: Develop / Tutorials / Execution flow / Start and stop a streaming fragment
    url: /develop/tutorials/execution-flow/start-and-stop-fragment-auto-reruns
  - category: Develop / Tutorials / Execution flow / Speed up your app with parallel fragments
    url: /develop/tutorials/execution-flow/run-fragments-in-parallel
```

---

# 5. `content/develop/quick-references/release-notes/2026.md`

**What to change:** None. The 2026 release notes already announce the feature
under version 1.58.0:

```markdown
- 🌟 Introducing `parallel=True` for [`@st.fragment`](/develop/api-reference/execution-flow/st.fragment), which lets fragments run concurrently for more responsive apps and background-style workflows ([#15214](https://github.com/streamlit/streamlit/pull/15214)).
```

No edit is required. (Listed here so reviewers know it was checked.)

---

## Open questions / follow-ups for reviewers

1. **Minimum version:** Confirm `1.58.0` is the release that introduced
   `parallel` and use it consistently in the new tutorial and any
   "Prerequisites" notes.
2. **Callout style:** I used `<Tip>`, `<Note>`, and `<Warning>`. Align with
   whatever the docs team standardizes on for these contexts.
3. **Diagram:** The execution-flow diagram (`fragment_diagram.png`) shows
   sequential fragment behavior. Consider a companion diagram showing parallel
   dispatch during a full-app rerun, and reference it from section 1c.
4. **Cross-links:** Verify all internal slugs against the live menu before
   applying (especially `st.switch_page` and `st.dialog`).
5. **Example source:** Decide whether to add a runnable example under
   `python/api-examples-source/` for the new tutorial.
