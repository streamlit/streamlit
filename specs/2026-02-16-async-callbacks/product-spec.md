---
author: tteixeira
created: 2026-02-16
---

# Asynchronous Callbacks

## Summary

Enable callbacks that execute without triggering a script rerun, allowing surgical UI updates and state changes.

**NOTE: I'm not even sure I want this. I just think we should seriously consider it.**

## Problem

Streamlit reruns the entire script on every user interaction. This was an intentional design decision: it makes it difficult to write hard-to-reason-about spaghetti code. But it creates performance challenges: simple actions (incrementing a counter, toggling a flag) re-execute the entire script, including expensive operations.

To make up for this we've historically taken a "scalpel" approach. That is, we diagnose problems and introduce different features to Streamlit (`st.cache_*`, `st.fragment`) that solve those specific problems, one at a time. In the meantime, users just have to deal with not being able to accomplish what they would like to.

**IMPORTANT: This spec is missing a few driving examples. What are some _clear_ cases where the current approaches fail? We should ask the community!**


## User requests

Some related requests:
- [#12980](https://github.com/streamlit/streamlit/issues/12980) — Users want `chart.update(new_data)` to avoid full reruns. Althought not exactly what's being asked, async callbacks could help here.
- [#7807](https://github.com/streamlit/streamlit/issues/7807) — Requests a selectbox that queries a backend as the user types. Author notes this "would require rerunning a specific function, and not the entire Streamlit script."
- [#12799](https://github.com/streamlit/streamlit/issues/12799) — Asks for fragments that don't re-execute during full reruns unless inputs change. Async callbacks provide an alternative path to this.
- [#6152](https://github.com/streamlit/streamlit/issues/6152) — Mentions memoizing components to "reduce computational and rendering cost." Async callbacks address the rendering cost side since only the components that need to be redrawn get redrawn.
- [#8488](https://github.com/streamlit/streamlit/issues/8488) — Requests "async support for on_change and on_click callbacks."


## Proposal

Introduce `@st.callback`—a decorator that marks callbacks as "async" (meaning, the script does not automatically rerun after this callback is called).

### API Options

#### Option A: `@st.callback` decorator

```python
@st.callback
def increment():
    st.session_state.count += 1

st.button("Add one", on_click=increment)
```

**Pros**:
- Explicit and discoverable
- Clear intent—decorated functions behave differently
- Consistent with Streamlit's decorator patterns (`@st.cache_data`, `@st.fragment`)

**Cons**:
- Requires importing and applying a decorator
- Another concept to learn

#### Option B: `async def` (Python async notation)

```python
async def increment():
    st.session_state.count += 1

st.button("Add one", on_click=increment)
```

**Pros**:
- No new API to learn for users familiar with Python async
- Concise syntax

**Cons**:
- Semantic overloading—not actually using Python's asyncio
- May confuse users who expect `await` to work
- Could conflict with future true async support in Streamlit
- Linters/type checkers may flag issues

#### Option C: Naming convention (`_async` suffix)

```python
def increment_async():
    st.session_state.count += 1

st.button("Add one", on_click=increment_async)
```

**Pros**:
- No decorator or special syntax required
- Self-documenting in function name

**Cons**:
- Magic naming convention (implicit behavior)
- Easy to miss or mistype
- Harder to discover
- Inconsistent with other Streamlit patterns

#### Option D: "Don't-rerun-script" command

Instead of introducing a new type of callback, devs can use an st command to tell Streamlit "don't rerun the script after this plain old callback runs". This is similar to the `Event.stopPropagation()` Web API (in JS).

```python
def increment():
    st.session_state.count += 1
    st.stop() # Tell Streamlit not to rerun the script after this.

st.button("Add one", on_click=increment)
```

**Pros**:
- No decorator or special syntax required
- Looks "Streamlity"

**Cons**:
- Perhaps harder to discover
- Harder to understand as a reader
- Inconsistent with other Streamlit patterns
- If we introduce other special behaviors to async callbacks as described later in this doc, then we'd have to also introduce them to sync callbacks. For example: ability to mutate external variables or call st commands.

**Alternative syntax**:
- Just `return False` or some other special value. Though that might be quite hard to discover and understand.


### Recommended Approach

If we decide to do this, I'm partial to **Option A (`@st.callback`)** because:
- It follows established Streamlit patterns
- Intent is explicit and readable
- IDE support for decorators provides discoverability
- No semantic confusion with Python's async/await

Potential names/APIs:
- `@st.callback`
- `@st.async_callback`
- `@st.callback(rerun=False)`
- `@st.event_handler`
- `@st.thread`: The nice thing about this one is that it could be used for
other purposes too. For example:
  - To create a thread where you can call `st` commands without having to do
  any magic first.
  - To run a thread at a given time, or in an interval:
  `@st.thread(schedule="1m")` or `@st.thread(schedule="14:22")`

### Behavior

```python
obj = {"n": 0}
text = st.empty()
text.write(f"The number is {obj['n']}")

@st.callback
def increment():
    obj["n"] += 1                            # Mutate external state
    text.write(f"The number is {obj['n']}")  # Update UI via DeltaGenerator

st.button("Increment", on_click=increment)
```

Key behaviors:

1. **No rerun**: Callback executes; script does not rerun.
2. **State mutation**: Can mutate external Python objects and `st.session_state`.
3. **UI updates**: Can call `st` commands, including on DeltaGenerators, to update specific elements.
4. **Explicit rerun**: Can call `st.rerun()` if needed.
5. **st.stop is confined**: If `st.stop()` is called, only the current callback is stopped.
6. **Works everywhere**: Any widget with `on_click`, `on_change`, etc. Works inside fragments without triggering fragment reruns.

### Incremental Adoption

Sync and async callbacks coexist. Users can start with regular callbacks, then convert only the latency-sensitive ones to `@st.callback`. No all-or-nothing migration.

### Trade-offs

**Pros**:
- **Easier to write fast code**: Developers can surgically update only what needs updating, without fighting the rerun model.
- **Familiar programming model**: This more closely aligns with the kind of event-driven, imperative app-writing that developers are used to from other frameworks (React, Flutter, traditional GUIs).

**Cons**:
- **Harder to reason about**: Streamlit's top-to-bottom model is simple because the entire UI is a function of the current state. Async callbacks introduce imperative mutations that can make control flow harder to follow—"where did this value get set?"
- **Potential for spaghetti code**: Without discipline, apps can devolve into a tangle of callbacks mutating shared state and updating scattered UI elements, losing Streamlit's declarative simplicity.
  - That said, users do get confused with the top-to-bottom model in many situations, and end up writing horribly convoluted code. So perhaps there isn't much of a loss in understandability/readability here.

### Error Cases

| Scenario | Behavior |
|----------|----------|
| Combined with `@st.fragment` | Error |
| Exception in callback | Displayed as usual |
| Write to stale DeltaGenerator | Warning; ignored |

### Open Questions

_This section is currently empty._

## Checklist

| Item                         | ✅ or comment                                      |
|------------------------------|----------------------------------------------------|
| Works on SiS, Cloud, etc?    | Yes—purely client/runtime behavior                 |
| No breaking API changes      | ✅ Additive only                                   |
| No new dependencies          | ✅ Probably                                        |
| Metrics collected            | Track usage of `@st.callback` decorator            |
| Any security/legal impact?   | None                                               |
| Any docs changes needed?     | Yes—new API, updated concept and tutorial pages    |
