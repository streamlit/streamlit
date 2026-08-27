---
author: lukasmasuch
created: 2026-08-03
---

# Live update mode for `st.text_input`

## Summary

Add a parameter to `st.text_input` that triggers reruns while the user is typing, enabling
real-time feedback use cases like live search, instant validation, and as-you-type filtering.

## Problem

**GitHub Issue:** [#4553](https://github.com/streamlit/streamlit/issues/4553)

Users want to create apps with immediate responsiveness to text input, similar to Google's search
field or IDE autocompletion. Currently, `st.text_input` only triggers reruns when the user presses
Enter, leaves the field (blur), or clears a `type="search"` input. This limitation prevents several
common use cases:

### Use Cases

1. **Live search / autocomplete**: Filter results as the user types, showing matching options
   instantly without requiring Enter or Tab.

   ```python
   # Desired behavior: filter updates as the user types (after a short pause),
   # using the proposed live=True (see the Proposal section below)
   query = st.text_input("Search products", type="search", live=True)
   filtered = [p for p in products if query.lower() in p.lower()]
   st.write(filtered)
   ```

2. **Real-time validation**: Show validation feedback immediately (e.g., "Username taken",
   "Password too weak") without waiting for form submission.

3. **Live formatting preview**: Show formatted output (Markdown, LaTeX, code highlighting) as the
   user types.

### Current Workarounds

| Workaround                 | Limitation                                           |
| -------------------------- | ---------------------------------------------------- |
| `streamlit-keyup` component | Third-party dependency to install and trust, not built into Streamlit, doesn't automatically follow theming/styling of the native widget |
| Custom component           | Significant development overhead, maintenance burden |
| Press Enter to search      | Poor UX, not intuitive for search interfaces         |

### Prior Art

The `streamlit-keyup` custom component ([blackary/streamlit-keyup](https://github.com/blackary/streamlit-keyup))
demonstrates strong demand for this feature with 200+ stars. Its API:

```python
from st_keyup import st_keyup

# Updates on every keystroke
value = st_keyup("Search")

# With 500ms debounce
value = st_keyup("Search", debounce=500)
```

## Proposal

Add an opt-in `live` parameter to `st.text_input` that reruns in the widget's existing rerun scope
(the app, or the enclosing `@st.fragment` / `st.dialog`) after a short pause in typing. The
parameter name and value shape were chosen after weighing several alternatives (see
[Alternatives Considered](#alternatives-considered) below).

### API Design

```python
def text_input(
    self,
    label: str,
    value: str | SupportsStr | None = "",
    ...,
    *,
    live: str | bool = False,  # New parameter
    ...,
) -> str | None:
```

### Parameter: `live`

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `live` | `str \| bool` | `False` | Whether the widget commits while the user types, after a pause. |

- `False` (default): current behavior — commit on blur, Enter, or clearing a search input.
- `True`: live updates after a 300ms pause.
- Duration string (same format as `ttl` in `st.cache_data`, e.g. `"300ms"`, `"0.5s"`): live
  updates after that pause. Any zero-length duration (`"0ms"`, `"0s"`, `"0"`) commits on every
  accepted user-originated value change.
- Bare `int` / `float` (including positives like `300` or `0.3`) and `timedelta` raise a
  `StreamlitAPIException`. Negative or unparseable duration strings also raise.

The pause is a debounce (wait for quiet), not a throttle. Exact parsing, protobuf encoding, and
timer details are deferred to the tech spec.

### Behavior

| `live` value | Behavior |
| ------------ | -------- |
| `False` (default) | Commit on blur, Enter, or clearing a `type="search"` input (current behavior) |
| `True` | Commit after 300ms of inactivity following an accepted user-originated value change |
| `str` (e.g. `"300ms"`, `"0.5s"`, `"1s"`) | Same, with the given pause (same format as `ttl`) |
| zero-length duration (`"0ms"`, `"0s"`, `"0"`) | Commit on every accepted user-originated value change (no pause). **Warning:** Use sparingly — can cause excessive reruns with expensive app logic. |
| bare `int` / `float` (e.g. `300`, `0.3`) | Raises `StreamlitAPIException` — unlike `ttl` / `run_every`, bare numbers are not accepted (those APIs treat numbers as seconds; `streamlit-keyup` users would read `300` as milliseconds). Use `True`, a duration string like `"300ms"`, or `"0ms"`. |
| `timedelta` | Raises `StreamlitAPIException` in v1 (deferred; see Alternatives). |
| negative duration string (e.g. `"-1s"`) | Raises `StreamlitAPIException` — `time_to_seconds` / `pd.Timedelta` parse negatives successfully, so the implementation must reject them explicitly rather than relying on `ttl` validation. |
| invalid string (e.g. `"soon"`) | Raises `StreamlitAPIException` (`StreamlitBadTimeStringError`) — same unparseable-string path as `ttl` |

**What starts the timer:** Accepted user-originated value changes (typing, paste, cut, drop,
autofill, voice/assistive input). Programmatic updates (script-driven `value` / session-state
writes) do not start the timer. IME composition is the exception in edge case 8. Clearing a
`type="search"` input is an immediate commit path (edge case 7), not a timer start.

`live="0ms"` vs `live=False` is conceptually “zero means the opposite of off,” but it is not the
Python `0 == False` footgun: the values are a string and a bool. The duration string makes the
unit explicit.

**Rerun scope:** `live` does not invent a new rerun target. A live commit uses the same scope the
widget already uses: the full app, or the enclosing `@st.fragment` / `st.dialog`. Putting live
search UI in a fragment is the recommended way to keep typing from rerunning the rest of the app
(Principle 37).

**Rerun frequency (relation to API Principle 34):** Live updates intentionally relax Principle 34
("one rerun per interaction") — a single typing session can trigger multiple reruns. This exception
is acceptable because it is the explicit purpose of the feature and, for `True` and positive
durations, the rerun rate is *bounded* by the delay. Zero-length and very short durations remove
or nearly remove that bound. Even the 300ms default can fire mid-word for slower or assistive
typing (head-pointer, switch access, on-screen keyboard). The performance warning therefore applies
to live mode in general, with stronger wording for zero and short custom delays. The default
(`False`) fully preserves one-rerun-per-interaction behavior.

**Running / stale UI:** Live-triggered reruns use the same "Running" status and stale-element
treatment as any other widget-triggered rerun. Suppressing that flicker for live commits is out of
scope; authors who need a quieter page should keep the live input and its results in a fragment.

**Focus & caret preservation:** While the user is still editing, a live rerun must not steal focus
or jump the caret/selection — provided the same enabled widget is still rendered with the same
identity. App code that removes, rekeys, disables, or replaces the widget during the rerun can
still disrupt editing. A stale rerun response must never overwrite newer dirty edits (a live
commit clears `dirty`, so the implementation must keep uncommitted keystrokes from being clobbered
by an in-flight older run).

**Input instructions:** When `live` is not `False` and the widget is outside a form, hide the
"Press Enter to apply" hint (the value already commits after a pause). Character-count
instructions from `max_chars` still show. Inside a form, `live` is a no-op, so "Press Enter to
submit form" is unchanged.

### Recommended Usage

- `live=True` is the simplest option for most live search/validation use cases. Prefer
  `type="search"` with `live=True` for search fields. `type="search"` does **not** turn live
  updates on by itself (opt-in, Principle 26); it is orthogonal to [#10744](https://github.com/streamlit/streamlit/issues/10744),
  which shipped the search *chrome* (icon, clear control). This spec is the live *commit timing*.
- `live="0.5s"` (or `"300ms"`) when you need specific timing control — duration strings make the
  unit explicit
- Any live value other than `False` increases rerun frequency. Zero-length and very short delays
  can overload the server for apps with expensive computations (ML inference, large data loads).
  Prefer a fragment around the live UI.

Python must expose and validate `live`, and the selected delay must reach the frontend through
protobuf. Backend / protobuf / frontend design (parsing, identity hashing, debounce timer, commit
path) is deferred to a separate tech spec.

### Examples

**Example 1: Live search with default delay**

```python
import streamlit as st

st.title("Product Search")

# live=True uses a sensible default pause (300ms).
# type="search" is optional chrome; it does not enable live updates by itself.
query = st.text_input("Search products", type="search", live=True)

if query:
    products = ["Apple", "Banana", "Cherry", "Date", "Elderberry"]
    matches = [p for p in products if query.lower() in p.lower()]
    st.write(f"Found {len(matches)} results:")
    for match in matches:
        st.write(f"- {match}")
else:
    st.write("Start typing to search...")
```

**Example 2: Instant validation with custom delay**

```python
import streamlit as st
import re

# live accepts a duration string using the same format as ttl.
email = st.text_input("Email address", live="500ms")

if email:
    if re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", email):
        st.success("Valid email format")
    else:
        st.error("Please enter a valid email address")
```

### Edge Cases

1. **Interaction with `on_change`**: When `live` is not `False` and `on_change` is a callable, the
   callback runs with the updated widget state at the start of the corresponding script or fragment
   run, before the body (same as today's widget callbacks). Pending live rerun requests may
   coalesce to the latest widget state, so one callback invocation per requested live update is not
   guaranteed. Users should treat live callbacks as potentially frequent (saving to a database,
   calling APIs) rather than "once per typing session."

2. **Interaction with `on_change="ignore"`**: `on_change="ignore"` takes precedence over `live`.
   Each accepted pause still *stages* the value into widget state with rerun and callback
   suppressed (today's `setStringValue(..., triggerRerun: false)` path), including on blur, Enter,
   and search-clear. The value is then available on the next rerun triggered by another widget —
   it must not remain only in `TextInput` local React state. With `bind="query-params"`, that
   staged commit updates the URL on each pause (history replacement, same as edge case 10)
   without rerunning.

3. **Interaction with `st.form`**: Inside a form, `live` has no effect — form widgets only
   commit their value on form submission, never while typing. This is a deterministic, documented
   no-op (no warning is logged), consistent with how `st.form` already overrides the
   rerun-on-interaction behavior of every widget it contains. This is intentionally *not* treated
   like an `on_change` callback inside a form, which raises `StreamlitInvalidFormCallbackError`: a
   callback is explicit user code whose silent omission would be a surprising failure (Principle 23),
   whereas `live` is only a rerun-timing flag. Silently suppressing it is exactly how forms already
   defer every widget's interaction rerun, so raising or warning would be inconsistent with that
   established form behavior.

4. **Interaction with `max_chars`**: Both features work independently. `max_chars` is enforced
   on the frontend by the input change handler (`useOnInputChange` early-returns when the new
   value is longer than `max_chars` before the widget is marked dirty). The backend
   (`TextInputSerde.deserialize`) also truncates defensively. The live-update timer runs off that
   same change handler, so it only ever sees within-limit values and needs no extra client-side
   validation to gate it. Do not rely on a native HTML `maxlength` attribute; `TextInput` does not
   pass one to the input element (`maxLength` on `InputInstructions` is only the character-count
   display).

5. **Password inputs**: `live` works with `type="password"` — no special handling needed. Values
   still travel on the existing widget path; they are sent more often than on blur/Enter.

6. **Very fast typing**: For `live=True` or a positive duration string, the timer resets on each
   accepted value change, so only the final value (after the user pauses) triggers a rerun.
   Zero-length durations have no pause window, so every accepted change triggers a rerun (see the
   behavior table and its performance warning).

7. **Blur, Enter, or search-clear while an update is pending**: If the user stops typing and
   blurs, presses Enter, or clicks the `type="search"` clear control before the timer fires, the
   pending update should be flushed immediately (commit + rerun) instead of waiting out the
   remaining delay. Blur, Enter, and search-clear are the existing commit paths for
   `st.text_input`, so all three must flush the timer — otherwise search-clear (the headline live
   search case) would wait out the pause after an explicit clear. This ensures a rerun always
   occurs when the user leaves, submits, or clears the field, consistent with the non-live case.
   The one exception is `on_change="ignore"` (see edge case 2), which still stages the value but
   suppresses the rerun. Inside an `st.form` this flush logic does not apply at all: because
   `live` has no effect there (see edge case 3), no timer ever starts, so there is nothing to
   flush — blur, Enter, and search-clear follow the normal form rules (the value is committed
   only on form submission, with no mid-edit rerun).

8. **IME / composition input**: For input methods that build a character over multiple keystrokes
   (e.g., CJK languages, or accented characters via dead keys), the timer must not fire on
   intermediate composition states. The frontend should suspend the timer during composition and
   only (re)start it on the `compositionend` event, so live updates never flush partial/garbled
   values mid-composition. Only completed characters trigger a rerun.

9. **Interaction with `validate`**: Client-side `validate` (regex or `(regex, message)` tuple)
   already ships on `st.text_input` and gates *commits* — a value is only sent to the backend
   (and a rerun triggered) once validation passes on blur/Enter/search-clear/form submit. `live`
   only changes *when* a commit is attempted, so the two compose cleanly: each typing pause
   becomes an additional commit attempt that runs validation exactly like a blur/Enter commit
   would. If the value matches, the commit + rerun proceed; if it doesn't, the input shows its
   error state and no rerun occurs — the user keeps typing until the value is valid. Empty
   strings still bypass validation, so an empty live value commits normally. A future
   server-side callable `validate` (not shipped) would inherit the same frequency caveat as
   `on_change` (edge case 1): validators should be cheap/idempotent, and in-flight validations
   cancelled when the user types again.

10. **Interaction with `bind="query-params"`**: `bind="query-params"` already ships and syncs a
    widget's *committed* value into the URL. Because `live` moves commits from blur/Enter to
    typing pauses, a bound widget's query param updates after each pause rather than only when
    the field is left. To avoid polluting browser history with every intermediate value, these
    live URL updates should use history *replacement* (like `history.replaceState`, the same
    mechanism query-param binding already uses for widget updates) rather than pushing a new
    history entry per pause — so the Back button doesn't step through every partial query the
    user typed. A shared/reloaded URL therefore reflects the value as of the last live commit.

11. **Widget identity**: An optional `False` default is not enough for compatibility. Unkeyed
    `text_input` IDs hash kwargs passed to `compute_and_register_element_id`. `live` must be
    identity-neutral when omitted or `False` (same pattern as unset `validate`), otherwise
    upgrading Streamlit resets every existing text input's state. A non-default `live` value may
    be part of identity so that toggling live mode can reset the widget.

## Alternatives Considered

### Parameter Name Options

We chose `live` after weighing several alternatives. This section records the ranking and reasoning;
the per-candidate trade-offs follow.

> **Decision:** We use `live` as the parameter name, with the value shape `bool | str` (`True` = on
> with a default pause, a duration string like `"300ms"` for custom timing, `"0ms"` for every
> accepted input event). Bare integers, floats, and `timedelta` are intentionally **not** accepted
> in v1 (see the Behavior section).

The strongest naming precedents in the current API fall into a few groups:

| Pattern | Examples | Lesson |
| --- | --- | --- |
| Semantic name over mechanism | `run_every`, `clear_on_submit`, `enter_to_submit`, `accept_new_options` | Name the outcome, not the implementation (Principle 8) |
| Interaction behavior → compound name | `clear_on_submit`, `enter_to_submit`, `accept_multiple_files` | Interaction toggles get explicit compound names, unlike terse property flags (`disabled`, `border`, `parallel`, `lazy`) |
| Flag-or-config in one param | `show_spinner: bool \| str`, `expanded: bool \| int`, `accept_file: bool \| Literal[...]` | Precedent for "turn on + configure" in a single parameter |
| Duration values | `ttl`, `run_every`, `toast(duration=...)` | Duration strings + `timedelta`; **bare numbers are seconds, not milliseconds** |
| Mode enums | `submit_mode`, `filter_mode`, `selection_mode` | Best when values are discrete modes, not timings |

`debounce` names the frontend *technique*, which fights Principle 8 (semantic over geeky). Migration
parity with `streamlit-keyup` is real but one-time and niche; the native name is permanent and is seen
by every user, including non-web developers.

**Ranked candidates** (all use the chosen value shape `bool | str`, default `False`, unless noted):

| Rank | Name | Assessment |
| --- | --- | --- |
| **1** | **`live`** | Punchy, community-proposed ([#4899](https://github.com/streamlit/streamlit/issues/4899) / [#4920](https://github.com/streamlit/streamlit/pull/4920)), and `live=True` reads beautifully. Streamlit already ships terse behavioral flags (`parallel`, `lazy`), and `live` reads cleanly with a duration (`live="300ms"`). Only knock: slightly vague in isolation ("live *what*?"), resolved by widget context and the docstring. **Chosen.** |
| **2** | **`live_update`** | Unambiguous, matches the `clear_on_submit` / `enter_to_submit` interaction-behavior pattern, and self-evident in IDE autocomplete — the strongest alternative. Slightly more verbose, and `live_update="500ms"` reads a touch redundantly. |
| **3** | **`update_while_typing`** | Maximum self-documentation — impossible to misread, and consistent with descriptive names like `accept_multiple_files`. Knocks: verbose, durations read awkwardly, and "typing" is slightly inaccurate for paste / voice / IME input. |
| **4** | **`auto_update`** | Clear, and "update" maps onto Streamlit's rerun-as-update model while avoiding the `submit` collision that sinks `auto_submit`. Knock: `auto_*` is not an established Streamlit prefix, and it faintly evokes timer-based refresh (`run_every`), blurring "on a timer" vs "as I type". |
| **5** | **`update_delay` / `typing_delay`** (duration-only shape: `str \| timedelta \| None = None`) | Cleanest type model and most consistent with `ttl` / `run_every`. Knock: loses the one-line `=True` on-ramp (Principle 1), and `None`-means-off is less obvious than `False`. |

**`live` vs `live_update`** was the only close call. `live_update` is marginally more self-evident in
IDE autocomplete and follows the compound-name pattern Streamlit uses for interaction behaviors
(`clear_on_submit`, `enter_to_submit`). `live` wins on brevity, reads better with a duration
(`live="300ms"` vs `live_update="500ms"`), has direct community precedent
([#4899](https://github.com/streamlit/streamlit/issues/4899) / [#4920](https://github.com/streamlit/streamlit/pull/4920)),
and is in good company with existing terse behavioral flags (`parallel`, `lazy`). We chose `live`;
`live_update` remains the fallback if reviewers prefer maximum explicitness.

**Excluded names:** `keyup` (DOM jargon; also wrong for paste / voice / IME), `auto_submit` (collides
with the terminal "submit" meaning in `st.form` and `st.chat_input`'s `submit_mode`), `on_input`
(`on_*` means a callback in Streamlit), `update_on` (good as a finite enum, poor at also carrying a
duration), and `realtime` (over-promises — a 300ms-debounced server rerun isn't real-time).

**Value shape:** `run_every`, `ttl`, and `toast(duration=...)` all treat a bare number as *seconds*,
so `live=300` meaning *milliseconds* would be inconsistent (Principles 7 and 10), and `"300ms"` is
more readable than either `300` or `0.3`. Rejecting positive bare numbers is therefore intentional,
not only a `0 == False` concern — `streamlit-keyup` users who write `live=300` get a
`StreamlitAPIException` that points to `True` or `"300ms"` (Principle 23). `timedelta` is deferred
(Principle 4): every other duration API accepts it and `time_to_seconds` already handles it, but
adding it later is backwards-compatible. v1 keeps `bool | str` so the on-ramp stays `live=True`.

### Detailed Trade-offs by Candidate

Unique reasons we rejected or ranked each option. Shared ranking notes live in the table above.

#### Option 1: `debounce` (bool, integer milliseconds, or duration string) — rejected

Would have mirrored `streamlit-keyup`'s `debounce=` integer and accepted a mixed
`int | str | bool` type.

**Why not:** "Debounce" is frontend jargon (Principle 8). Bare integer milliseconds would also
collide with Streamlit's "bare number = seconds" duration convention and with `0 == False`.

#### Option 2: Dedicated on/off parameter (`keyup` / `live_update` boolean, or `update_on` string enum) — rejected as the sole surface

A boolean or enum would turn live updates on with a fixed default pause and no timing control.

**Why not:** Several `streamlit-keyup` use cases rely on tuning the delay. `update_on` as a string
enum is the most principle-aligned of this group (Principle 16) but is a poor carrier for a
duration. `live_update` remains the naming runner-up (see ranking above).

#### Option 3: `on_input` callback (separate from `on_change`) — rejected

```python
st.text_input("Search", on_input=handle_typing)  # Called per keystroke
st.text_input("Search", on_change=handle_submit)  # Called on blur/enter
```

**Why not:** Most Streamlit users rely on return values, not callbacks; a second callback does not
address delay configuration and adds API surface.

#### Option 4: Semantic rename keeping the flag-or-duration shape (`live` or `auto_submit`) — chosen (`live`)

The chosen shape (`bool | str`: `True` for the default pause, a duration string for custom timing,
`"0ms"` for every accepted input event). Bare-integer milliseconds are dropped (unlike Option 1).

**Why `live` over `auto_submit`:** `auto_submit` overloads "submit", which already has a terminal
meaning in `st.form` and `st.chat_input` (`submit_mode`). Continuous intermediate updates would
give "submit" a second sense (Principles 7 and 10) and make the in-form no-op read as a
contradiction.

## Out of Scope (Future Work)

- **`st.text_area` support**: Extend the `live` parameter to `st.text_area` with identical
  behavior. Note: Enter key inserts a newline in text_area (unlike text_input where it submits),
  so live updates would be the primary rerun trigger while typing.
- **Other widgets**: This spec does not name a cross-widget `live=` vocabulary. `st.slider` /
  `st.number_input` / similar would need their own specs if we want commit-while-interacting
  there.
- **`timedelta` values**: Accept `datetime.timedelta` later, matching `ttl` / `run_every`.
- **Throttle mode**: Rate-limiting (e.g., "at most once per 500ms while typing") as opposed to the
  debounce behavior `live` uses (waiting for a pause). Could add a `throttle` parameter if needed.
- **Cancel/abort pattern**: Mechanism to cancel in-flight computations when new input arrives.
  Users can implement this with `st.session_state` flags.
- **Silent running / stale UI**: Special-casing the run indicator or stale-element opacity for
  live-triggered reruns.
- **Announcing live results to assistive tech**: Whether apps or Streamlit should wrap
  live-updated result regions in `aria-live`. Implementation must not re-announce the whole page
  on every pause.

## Checklist

| Item                         | ✅ or comment |
| ---------------------------- | ------------- |
| Works on SiS, Cloud, etc?    | ✅ coordinated Python + protobuf + frontend; live commits use the widget's existing rerun scope |
| No breaking API changes      | ✅ new optional parameter; `live` omitted or `False` must be identity-neutral so existing unkeyed text inputs keep their state |
| No new dependencies          | ✅ |
| Metrics collected            | ✅ existing text_input metrics apply |
| Any security/legal impact?   | ✅ None |
| Any docs changes needed?     | ✅ update text_input docstring |
