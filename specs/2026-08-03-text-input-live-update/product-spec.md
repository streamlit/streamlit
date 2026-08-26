---
author: lukasmasuch
created: 2026-08-03
---

# Live update mode for `st.text_input`

## Summary

Add a parameter to `st.text_input` that triggers reruns while the user is typing, enabling
real-time feedback use cases like live search, instant validation, and character-by-character
filtering.

## Problem

**GitHub Issue:** [#4553](https://github.com/streamlit/streamlit/issues/4553)

Users want to create apps with immediate responsiveness to text input, similar to Google's search
field or IDE autocompletion. Currently, `st.text_input` only triggers reruns when the user presses
Enter or leaves the field (blur). This limitation prevents several common use cases:

### Use Cases

1. **Live search / autocomplete**: Filter results as the user types, showing matching options
   instantly without requiring Enter or Tab.

   ```python
   # Desired behavior: Filter updates as the user types (after a short pause)
   query = st.text_input("Search products")
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

Add an opt-in `live` parameter to `st.text_input` that reruns the app while the user types, after a
short pause in typing. The parameter name and value shape were chosen after weighing several
alternatives (see [Alternatives Considered](#alternatives-considered) below).

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
| `live` | `str \| bool` | `False` | Enables live updates while the user types. When `True`, reruns after a sensible default pause (300ms). When a duration string (e.g. `"300ms"`, `"0.5s"`), reruns after that pause, using the same format as `ttl` in `st.cache_data`; `"0ms"` reruns on every keystroke. When `False` (default), reruns occur only on blur or Enter. A bare integer or a negative/unparseable duration raises a `StreamlitAPIException`. |

The public parameter is `live`; internally the frontend implements the pause with a debounce timer.

### Behavior

| `live` value | Behavior |
| ------------ | -------- |
| `False` (default) | Rerun on blur or Enter (current behavior) |
| `True` | Rerun after 300ms of typing inactivity (sensible default) |
| `str` (e.g. `"300ms"`, `"0.5s"`, `"1s"`) | Rerun after the given pause in typing (same format as `ttl`) |
| `"0ms"` (or any zero-length duration string) | Rerun on every keystroke (no pause). **Warning:** Use sparingly - can cause excessive reruns with expensive app logic. |
| bare `int` / `float` (e.g. `300`) | Raises `StreamlitAPIException` - bare numbers are ambiguous (ms vs seconds, and `0 == False`); use `True` for the default, a duration string like `"300ms"` for custom timing, or `"0ms"` for every keystroke |
| negative duration string (e.g. `"-1s"`) | Raises `StreamlitAPIException` - negative delays are invalid |
| invalid string (e.g. `"soon"`) | Raises `StreamlitAPIException` (`StreamlitBadTimeStringError`) - same validation as `ttl` |

**Rerun frequency (relation to API Principle 34):** Live updates intentionally relax Principle 34
("one rerun per interaction") — a single typing session can trigger multiple reruns. This exception
is acceptable because it is the explicit purpose of the feature and the rerun rate is *bounded* by
the delay: reruns fire at most once per period of typing inactivity (e.g., `live="300ms"` triggers at
most roughly once per 300ms pause, not once per keystroke). `live="0ms"` is the only value that
removes this bound (one rerun per keystroke) and therefore carries the performance warning above. The
default (`False`) fully preserves one-rerun-per-interaction behavior, so existing apps are unaffected.

### Recommended Usage

- `live=True` is the simplest option for most live search/validation use cases
- `live="0.5s"` (or `"300ms"`) when you need specific timing control — duration strings make the unit
  explicit
- `live="0ms"` should be used sparingly - triggers a rerun on every keystroke which can overload the
  server for apps with expensive computations (ML inference, large data loads)

The backend/frontend design (value parsing, debounce timer, commit path) is deferred to a separate
tech spec.

### Examples

**Example 1: Live search with default delay**

```python
import streamlit as st

st.title("Product Search")

# live=True uses a sensible default pause (300ms)
query = st.text_input("Search products", live=True)

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

1. **Interaction with `on_change`**: When both `live` and `on_change` are set, the callback
   fires after each live-update rerun. **Important:** Unlike the current blur-only behavior where
   `on_change` fires at most once per complete interaction, with `live` the callback may fire
   multiple times during a single typing session. Users should be aware of this frequency increase
   when adding `live` to widgets that already have `on_change` callbacks performing write
   operations (e.g., saving to database, calling APIs).

2. **Interaction with `on_change="ignore"`**: If the proposed `on_change="ignore"` mode (from
   `specs/2026-04-14-on-change-modes/`) is combined with `live`, `on_change="ignore"` takes
   precedence and prevents any reruns — including the live-update timer firing *and* the blur-triggered
   rerun described in edge case 7. The widget value is still updated in frontend state and will be
   available on the next rerun triggered by another widget.

3. **Interaction with `st.form`**: Inside a form, `live` has no effect — form widgets only
   commit their value on form submission, never while typing. This is a deterministic, documented
   no-op (no warning is logged), consistent with how `st.form` already overrides the
   rerun-on-interaction behavior of every widget it contains.

4. **Interaction with `max_chars`**: Both features work independently. `max_chars` is enforced
   on the frontend — the native `maxlength` attribute prevents typing past the limit, and the
   input's change handler also drops any value longer than `max_chars` before the widget is
   marked dirty. The live-update timer runs off that same change handler, so it only ever fires with
   within-limit values and needs no extra client-side validation to gate it.

5. **Password inputs**: `live` works with `type="password"` - no special handling needed.

6. **Very fast typing**: For `live=True` or a positive duration string, the timer resets on each
   keystroke, so only the final value (after the user pauses) triggers a rerun. `live="0ms"` is the
   exception: there is no pause window, so every keystroke triggers a rerun (see the behavior table
   and its performance warning).

7. **Blur or Enter while an update is pending**: If the user stops typing and either blurs the field
   or presses Enter before the timer fires, the pending update should be flushed immediately
   (commit + rerun) instead of waiting out the remaining delay. Blur and Enter are the two existing
   commit paths for `st.text_input`, so both must flush the timer — otherwise Enter would appear to
   "hang" until the timer elapses. This ensures a rerun always occurs when the user leaves or submits
   the field, providing consistent behavior with the non-live case. The one exception is
   `on_change="ignore"` (see edge case 2), which suppresses this blur/Enter-triggered rerun as well —
   the value is only synced to frontend state.

8. **IME / composition input**: For input methods that build a character over multiple keystrokes
   (e.g., CJK languages, or accented characters via dead keys), the timer must not fire on
   intermediate composition states. The frontend should suspend the timer during composition and
   only (re)start it on the `compositionend` event, so live updates never flush partial/garbled
   values mid-composition. Only completed characters trigger a rerun.

9. **Interaction with `validate`**: The proposed `validate` parameter (from
   `specs/2025-12-03-text-input-validation/`) gates *commits* — a value is only sent to the backend
   (and a rerun triggered) once validation passes on blur/Enter/form submit. `live` only changes
   *when* a commit is attempted, so the two compose cleanly: each typing pause becomes an
   additional commit attempt that runs validation exactly like a blur/Enter commit would.
   - **Client-side regex**: validated instantly in the browser on each pause. If the value
     matches, the commit + rerun proceed; if it doesn't, the input shows its error state and no
     rerun occurs — the user keeps typing until the value is valid. This makes live
     validation feedback (a headline use case) work without any extra machinery.
   - **Server-side callable**: each pause that produces a *valid-so-far* value fires a
     validation request. This inherits the same frequency caveat as `on_change` (edge case 1): a
     live server-side validator can run many times per typing session, so validators should be
     cheap/idempotent. In-flight validations are cancelled and superseded when the user types again
     (matching the validation spec's "concurrent validation" edge case).
   - Empty strings still bypass validation (per the validation spec), so an empty live value
     commits normally.

10. **Interaction with `bind="query-params"`**: The proposed `bind="query-params"` (from
    `specs/2026-01-06-query-param-binding-state-persistence/`) syncs a widget's *committed* value
    into the URL. Because `live` moves commits from blur/Enter to typing pauses, a bound
    widget's query param updates after each pause rather than only when the field is left.
    To avoid polluting browser history with every intermediate value, these live URL updates
    should use history *replacement* (like `history.replaceState`, the same mechanism query-param
    binding already uses for widget updates) rather than pushing a new history entry per pause — so
    the Back button doesn't step through every partial query the user typed. A shared/reloaded URL
    therefore reflects the value as of the last live commit.

## Alternatives Considered

### Parameter Name Options

We chose `live` after weighing several alternatives. This section records the ranking and reasoning;
the per-candidate trade-offs follow.

> **Decision:** We use `live` as the parameter name, with the value shape `bool | str` (`True` = on
> with a default pause, a duration string like `"300ms"` for custom timing, `"0ms"` for every
> keystroke). Bare-integer milliseconds are intentionally **not** accepted (see the Behavior section
> in the Proposal).

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

**Ranked candidates** (all use the value shape `bool | str`, optionally `| timedelta`, default `False`,
unless noted):

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

**Value shape — dropping bare integers:** `run_every`, `ttl`, and `toast(duration=...)` all treat a
bare number as *seconds*, so `live=300` meaning *milliseconds* would be inconsistent, and `"300ms"` is
more readable than either `300` or `0.3`. Using `bool | str` also avoids the `0 == False` ambiguity
entirely, while `"0ms"` remains the explicit "every keystroke" opt-in. A bare integer (for example a
`streamlit-keyup` user's habitual `live=300`) raises a `StreamlitAPIException` that points to `True` or
a duration string like `"300ms"` (Principle 23).

### Detailed Trade-offs by Candidate

The subsections below capture the full pros/cons weighed for each candidate, including the ones we
rejected.

#### Option 1: `debounce` (bool, integer in milliseconds, or duration string)

```python
st.text_input("Search", debounce=True)  # Rerun with sensible default (300ms)
st.text_input("Search", debounce=300)  # Rerun after 300ms of inactivity
st.text_input("Search", debounce="0.5s")  # Same, using a duration string
st.text_input("Search", debounce="0ms")  # Rerun on every keystroke (no debounce)
st.text_input("Name")  # Default: rerun on blur/enter only
```

The parameter accepts a `bool` (on/off with a sensible default), an `int` (delay in milliseconds),
or a duration string. Duration strings reuse the exact same parsing as `ttl` in
`st.cache_data`/`st.cache_resource` (see `streamlit.time_util.time_to_seconds`, backed by
`pandas.Timedelta`), so `"300ms"`, `"0.5s"`, and `"1s"` are all valid and behave consistently with
the rest of the API.

**Pros:**
- Familiar to web developers (standard term in JavaScript/frontend)
- Simple `debounce=True` for most use cases, an explicit ms int or duration string when needed
- Mirrors `streamlit-keyup` API (which uses an integer `debounce`) for easy migration
- Duration strings make the unit explicit (`"300ms"` reads unambiguously, unlike a bare `300`) and
  are consistent with `ttl` in `st.cache_data`/`st.cache_resource`, so users already know the format
- Allows fine-grained control over debounce timing when needed

**Cons:**
- Term "debounce" may be unfamiliar to data scientists — a direct conflict with API Principle 8
  (semantic names over geeky names). This is the main reason we did **not** choose it, despite the
  migration parity with `streamlit-keyup` (which already popularized `debounce` among the exact users
  we are targeting).
- The `int | str | bool` type overloads a single parameter as both an on/off switch (`True`/`False`)
  and a delay (numeric ms or duration string), which is in tension with API Principle 16 (prefer
  enums over booleans). It mirrors the existing `st.json(expanded=...)` and `st.navigation(expanded=...)`
  APIs (the `bool | int` "flag or number" shape) and the `ttl` parameter (the duration-string shape),
  so the pattern is not novel — but the bare-`int` half is the part we ultimately dropped (see the
  chosen values above).
- **The `debounce=0` vs `debounce=False` footgun.** Because `0 == False` in Python, a bare integer `0`
  is ambiguous with `False` even though they mean the *opposite* thing (`False` = off; every-keystroke
  = the *most* aggressive setting). The `debounce` proposal mitigated this by raising a
  `StreamlitAPIException` on bare `0`/negative ints and steering users to `False` or `"0ms"`. The
  chosen `live` design avoids the footgun structurally by not accepting bare integers at all.

#### Option 2: Dedicated on/off parameter (`keyup`/`live_update` boolean, or `update_on` string enum)

```python
# Using keyup=True (boolean)
st.text_input("Search", keyup=True)

# Using live_update=True (boolean)
st.text_input("Search", live_update=True)

# Using update_on="input" (string enum)
st.text_input("Search", update_on="input")
```

These would use a sensible default debounce (e.g., 200-300ms) without exposing configuration.
Note that `keyup` and `live_update` are booleans, whereas `update_on` is a **string enum** — not a
boolean — so it is grouped here as the "on/off" alternative but sits closest to Principle 16 (prefer
enums over booleans) and Principle 9 (matches the existing `on_change` / `on_click` vocabulary), and
could later grow to carry timing/mode values (e.g. `update_on="blur"` vs `"input"`).

**Pros:**
- `keyup` mirrors the `streamlit-keyup` component name, familiar to existing users
- `live_update` is self-documenting, clear intent
- `update_on` follows existing `on_change`, `on_click` naming patterns and, as a string enum, is the
  most future-proof of the three (can add new modes without adding more booleans)
- Simpler API - no need to understand milliseconds

**Cons:**
- No control over the delay (may not suit all use cases), which is the main reason we prefer the
  flag-or-duration shape — several `streamlit-keyup` use cases rely on tuning the delay
- `keyup` is a technical DOM event name, less semantic
- `update_on="input"` vs `"change"` distinction may be confusing (HTML semantics)

#### Option 3: `on_input` callback (separate from `on_change`)

```python
st.text_input("Search", on_input=handle_typing)  # Called per keystroke
st.text_input("Search", on_change=handle_submit)  # Called on blur/enter
```

**Pros:**
- Consistent with callback pattern
- Can have both behaviors simultaneously

**Cons:**
- Callbacks are less common in Streamlit (most users rely on return values)
- Doesn't address the delay requirement
- Adds API complexity

#### Option 4: Semantic rename keeping the flag-or-duration shape (`live` or `auto_submit`) — chosen (`live`)

The flag-or-duration shape (`bool | str`: `True` for the default pause, a duration string like
`"300ms"` for custom timing, `"0ms"` for every keystroke) — only the parameter name changes from the
`debounce` jargon to a more semantic term. Bare-integer milliseconds are dropped (unlike Option 1),
which removes the `0 == False` footgun. Unlike Option 2's boolean-only `live_update`, this keeps full
timing control.

```python
# Using live (chosen)
st.text_input("Search", live=True)  # On, sensible default delay (300ms)
st.text_input("Search", live="300ms")  # Custom delay
st.text_input("Search", live="0ms")  # Every keystroke

# Using auto_submit (rejected)
st.text_input("Search", auto_submit=True)
st.text_input("Search", auto_submit="300ms")
```

**Pros:**
- Semantic and understandable to data scientists without a web background (Principle 8), unlike the
  `debounce` jargon
- Keeps the full flag-or-duration flexibility of Option 1, so no timing use case is lost (the main
  advantage over Option 2)
- `live=True` / `auto_submit=True` reads naturally for the common on/off case
- `auto_submit` has an intuitive mental model: a `text_input` already "submits" its value on
  Enter/blur, so `auto_submit=True` reads as "submit automatically while typing"

**Cons:**
- Loses the `streamlit-keyup` migration parity that motivates `debounce` (those users already know
  `debounce`). Bare-integer milliseconds are not accepted, so migrating users must switch
  `debounce=500` → `live="500ms"` — guided by the exception message on a bare integer (Principle 23).
- `live` alone is somewhat vague about *what* is going live (resolved by widget context and the
  docstring).
- `auto_submit` overloads "submit", which already carries a distinct, **terminal** meaning in
  `st.form` (submit button) and `st.chat_input` (`submit_mode`). Using it for continuous,
  intermediate updates introduces a second, conflicting sense of "submit" across the text widgets
  (Principles 7 and 10: standardized vocabulary, same name / same behavior). It also makes the
  in-form no-op (edge case 3) read as a contradiction ("I set `auto_submit=True`, why does it never
  submit?"), whereas `live` describes typing responsiveness and degrades more gracefully inside a
  form. This is why we chose `live` over `auto_submit`.

## Out of Scope (Future Work)

- **`st.text_area` support**: Extend the `live` parameter to `st.text_area` with identical
  behavior. Note: Enter key inserts a newline in text_area (unlike text_input where it submits),
  so live updates would be the primary rerun trigger while typing.
- **Throttle mode**: Rate-limiting (e.g., "at most once per 500ms while typing") as opposed to the
  debounce behavior `live` uses (waiting for a pause). Could add a `throttle` parameter if needed.
- **Cancel/abort pattern**: Mechanism to cancel in-flight computations when new input arrives.
  Users can implement this with `st.session_state` flags.

## Checklist

| Item                         | ✅ or comment |
| ---------------------------- | ------------- |
| Works on SiS, Cloud, etc?    | ✅ frontend-only live-update logic |
| No breaking API changes      | ✅ new optional parameter with False default |
| No new dependencies          | ✅ |
| Metrics collected            | ✅ existing text_input metrics apply |
| Any security/legal impact?   | ✅ None |
| Any docs changes needed?     | ✅ update text_input docstring |
