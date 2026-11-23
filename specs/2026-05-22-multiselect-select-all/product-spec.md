---
author: lukasmasuch
created: 2026-05-22
---

# Multiselect `select_all` Parameter

## Summary

Add a keyword-only `select_all` parameter to `st.multiselect` that allows users to control the "Select all" and "Select X matches" dropdown options. The parameter accepts `True` (always show), `False` (never show), or an integer threshold (show only when the number of currently selectable options is at or below the threshold). Integer thresholds use that selectable count — unselected option entries, narrowed by search when a query is active — not the total unfiltered `len(options)`.

This spec also **approves** a default keyboard change that ships with the parameter: when no dropdown item is focused, Enter commits the first visible row. That includes activating the bulk-action row when it is shown. With `accept_new_options`, a unique typed value still creates with a single Enter; a typed prefix that matches existing options does not.

## Spec status

The `select_all` API was merged in [#15300](https://github.com/streamlit/streamlit/pull/15300). **Keyboard / Enter below is an approved amendment by the spec author (`lukasmasuch`, 2026-08-28).** It is intended to land in the same implementation PR ([#16673](https://github.com/streamlit/streamlit/pull/16673)). It does not need a separate spec PR, and it is not an implementation-only deviation.

Approved shipped defaults for apps that never pass `select_all`:

1. Unfocused Enter commits the first visible row (replaces the RAC no-op).
2. When the bulk-action row is shown, that row is first, so a single Enter bulk-selects. Opt-out: `select_all=False`.
3. `accept_new_options=True`: Enter creates the typed value only when no existing option matches. A typed prefix of matching options is **not** created; there is no parameter to restore that RAC leftover. Migration: ArrowDown or click "Add: …". That removal is intentional (Alternative 7).

## Problem

### Current Behavior

`st.multiselect` shows a "Select all" option at the top of the dropdown when there are 2 or more selectable (unselected) options. When the user is typing a search query, this becomes "Select X matches" to select all filtered results.

This feature was added in PR [#13015](https://github.com/streamlit/streamlit/pull/13015). PR [#15301](https://github.com/streamlit/streamlit/pull/15301) later hid both bulk actions when the widget has 1000 or more **total** options, to prevent browser freezes. That gate is a hardcoded frontend constant of 1000. There is still no public API to disable "Select all" for smaller lists, enable it for larger lists, or choose a different threshold.

The 1000-option gate is static: it uses `len(options)`, not the number of currently selectable or filtered options. Filtering a 1000+ option widget down to a handful of matches still does not show "Select X matches". Today's comparison is also strict (`len(options) < 1000`), so a widget with **exactly** 1000 options hides the bulk action.

The widget was later migrated from BaseWeb to React Aria Components (PR [#16175](https://github.com/streamlit/streamlit/pull/16175)). "Select all" / "Select X matches" remain custom bulk-action rows at the top of the dropdown with the same visibility rules, labels, 2+ selectable minimum, and `max_selections` behavior. After that migration, unfocused Enter is a no-op for ordinary options (`focusedKey` stays null) except a leftover create-on-Enter path for `accept_new_options`. This spec **approves** replacing that with first-row Enter; see Keyboard / Enter.

### User Pain Points

1. **No way to disable "Select all" for typical lists:** Apps with fewer than 1000 options still always show "Select all". Some workflows require deliberate individual selections (for example picking 2–3 clients from ~500), and the shortcut undermines that. Because the bulk-action row is the first dropdown item, search-then-Enter activates "Select X matches" rather than adding the first match. Users still resort to workarounds (below).

2. **No way to enable "Select all" for large lists:** Apps with 1000+ options cannot opt back in, even when bulk-select is intentional and the list is not large enough to freeze the browser.

3. **Cluttered UI with Many Selections:** For use cases like plotting, selecting 1000+ options creates unusable visualizations with cluttered charts and excessive rendering time.

The freeze in [#15299](https://github.com/streamlit/streamlit/issues/15299) is from **applying** a huge bulk selection — serializing every selected value, rendering a tag per selection, and sending it to the backend — not from displaying the option list in the dropdown. Hiding the bulk action at 1000+ total options already mitigates clicking "Select all" on 100k+ options. Selecting that many values would still be expensive (`select_all=True` would re-expose it).

### User Requests

**Primary GitHub Issues:**

- [#16537](https://github.com/streamlit/streamlit/issues/16537) — Allow disabling "Select All" / "Select N matches"; search-then-Enter currently bulk-selects instead of adding the first match (open tracking issue)
- [#14918](https://github.com/streamlit/streamlit/issues/14918) — Option to enable/disable the select all option on `st.multiselect` (closed when this spec was drafted; disabling for lists under 1000 is still unresolved)
- [#15299](https://github.com/streamlit/streamlit/issues/15299) — Multi Select "Select all" performance bottleneck on large datasets (addressed by the hardcoded 1000 threshold)

**User Workarounds:**

Users currently resort to hacky workarounds like detecting "Select all" and forcing a clear:

```python
selected = st.multiselect(label, options=options, key=key)

# Workaround: treat "Select all" as "Clear all"
if len(options) > 1 and len(selected) == len(options):
    del st.session_state[key]
    st.rerun()
```

### Scope Clarification

The GitHub issue title (#14918) mentions both `st.multiselect` and `st.selectbox`, but `st.selectbox` is a single-select widget that does not have a "Select all" feature. This spec applies only to `st.multiselect`.

## Proposal

### API Design

Add a new keyword-only `select_all` parameter to `st.multiselect` (after `*`, like `max_selections` and `filter_mode`):

```python
st.multiselect(
    label,
    options,
    ...,
    *,
    select_all: bool | int = 1000,
)
```

> **Implementation note:** In Python, `bool` is a subclass of `int` (`True == 1`, `False == 0`). Check `isinstance(value, bool)` before `isinstance(value, int)` so `True` is not treated as threshold `1` and `False` as threshold `0`. The parameter replaces the hardcoded frontend bulk-action gate (currently 1000).

### Parameter: `select_all`

- **Type:** `bool | int`
- **Default:** `1000`

**Selectable options** are the count used by integer thresholds. They are unselected **option entries** from `options`, matched by value — not total `len(options)`, and not `len(options) - len(selected)`. Custom chips from `accept_new_options=True` appear in `selected` but are not in `options`, so they must not change the threshold:

- No search: option entries whose value is not in the selected set
- Search active: those option entries that also match the query (the same count used to label "Select X matches")

- **Values:**

| Value | Behavior |
|-------|----------|
| `True` | Always show "Select all" (subject to the 2+ selectable options minimum) |
| `False` | Never show "Select all" |
| `0` | Never show "Select all" (same as `False`) |
| Integer > 0 | Show "Select all" only when there are 2 or more selectable options AND that selectable count is at or below the threshold (`<=`). Hide when the selectable count is **above** the threshold. |

> **Note:** The 2+ selectable options requirement is an underlying constraint that applies to all modes, including `select_all=True`. A "Select all" option with only one selectable item provides no value over simply clicking that item. A threshold of `1` therefore never shows the bulk action (same as `False` / `0`); `2` is the smallest meaningful threshold.

### Examples

**Example 1: Disable "Select all" entirely**

```python
import streamlit as st

# Prevent bulk-select; search-then-Enter adds the first match instead of
# "Select X matches"
clients = [f"Client {i}" for i in range(500)]
selected = st.multiselect(
    "Clients",
    clients,
    select_all=False,
)
```

**Example 2: Use a custom threshold**

```python
import streamlit as st

# Show "Select all" only for small datasets
items = get_items_from_database()  # Could be 10 or 10,000 items
selected = st.multiselect(
    "Select items",
    items,
    select_all=50,  # Only show for 50 or fewer selectable options
)
```

**Example 3: Always enable "Select all"**

```python
import streamlit as st

# Override the default threshold to always show, including 1000+ option lists
options = [f"Item {i}" for i in range(1001)]
selected = st.multiselect(
    "Pick items",
    options,
    select_all=True,
)
```

### Behavior Details

**Threshold evaluation:**

The threshold is evaluated dynamically against the number of currently selectable option entries (`<= select_all`). Hide the bulk-action row while that count is **above** the threshold so Enter cannot bulk-select a huge unfiltered or weakly filtered list. Show "Select X matches" once a search leaves at most `select_all` unselected hits. The row may also appear as the user deselects options and the remaining selectable count falls to the threshold, or disappear as they select more.

The threshold is a **per-click add bound**, not a cap on the resulting `len(selected)`. Already-selected tags are already rendered; the freeze in [#15299](https://github.com/streamlit/streamlit/issues/15299) came from selecting a huge remaining list in one action. Bounding the resulting total would hide "select remaining" on large lists even when the add is small (for example 600 selected + 900 remaining).

This is a change from today's hardcoded gate, which uses total `len(options)` only and a strict `< 1000` comparison. With `select_all=1000`:

| Situation | Today | Proposed |
|-----------|-------|----------|
| 1000 options, none selected (unfiltered) | Hidden (`len(options) < 1000` is false) | Shown (`1000 <= 1000`) |
| 1500 options, 600 already selected (900 selectable, unfiltered) | Hidden (`len(options)` is 1500) | Shown (900 selectable `<= 1000`) |
| 10,000 options, search narrows to 1000 or fewer unselected hits | Hidden (gate uses total options) | Shown ("Select X matches") |

The filtered 1000+ → "Select X matches" change is the intended win. The first two rows are the unfiltered deltas implementers should not guess.

**Interaction with "Select X matches":**

Both "Select all" and "Select X matches" are controlled by the same parameter. When `select_all=False`, neither option appears. When `select_all=100`, "Select X matches" only appears when the selectable filtered match count is at or below 100.

**Keyboard / Enter (approved default-behavior change):**

This section **replaces** the earlier "unfocused Enter creates the typed value" wording that landed on `develop` with the spec in #15300. The spec author (`lukasmasuch`) approved this amendment on 2026-08-28 to ship in the `select_all` implementation PR ([#16673](https://github.com/streamlit/streamlit/pull/16673)). It is a product decision, not an implementation-only deviation, and does not need a separate spec PR.

**Rule:** When no dropdown item is keyboard-focused, Enter commits the first visible row (the highlighted Enter target). Users do not need ArrowDown first. If a row is already focused (including hover, which focuses in React Aria), Enter activates that focused row.

| Situation | Today on `develop` (RAC) | Approved |
|-----------|--------------------------|----------|
| Dropdown open, nothing focused, bulk row visible, Enter | No-op | Activates "Select all" / "Select X matches" |
| Search, bulk hidden, Enter | No-op unless ArrowDown first | Selects the first matching option ([#16537](https://github.com/streamlit/streamlit/issues/16537)) |
| `accept_new_options=True`, query matches existing options, Enter | Creates the typed prefix | Commits the first listed row (bulk if shown, else first match). Create via ArrowDown or click on "Add: …" |
| `accept_new_options=True`, query matches no existing option, Enter | Creates the typed value | Creates the typed value ("Add: …" is last in the list, so it is first only when nothing else matches) |

When the bulk-action row is visible, unfocused Enter activates it. That is the intended default, including for apps that never pass `select_all`. `select_all=False` is the opt-out of bulk-select-on-Enter (the first row is then the first match).

**Migration (`accept_new_options`):** Creating a typed prefix that also matches existing options with a single unfocused Enter is removed. Unique custom values still create with one Enter. To add a matching prefix, ArrowDown or click "Add: …". No `select_all` value restores prefix create-on-Enter; that leftover RAC path was rejected (Alternative 7).

Alternatives 7–8 (restore prefix create-on-Enter, or skip the bulk row on unfocused Enter) were rejected.

**Interaction with `max_selections`:**

The `select_all` threshold is evaluated against unselected option entries, independent of `max_selections`. If `max_selections=5` and `select_all=True`, "Select all" still appears with today's label, but only selects up to 5 options. Relabeling that row (for example to "Select 5") is out of scope; the existing truncation behavior remains unchanged.

For threshold evaluation, `max_selections` does not change the selectable count. This keeps the threshold calculation simple and predictable.

When `max_selections` is already reached (i.e., `len(selected) >= max_selections`), "Select all" is hidden since no additional selections can be made.

**Edge cases:**

| Scenario | Behavior |
|----------|----------|
| `select_all=0` | Same as `select_all=False` |
| `select_all=1` | Same as `False` / `0`: the 2+ selectable minimum means a threshold of `1` never shows the bulk action. `2` is the smallest meaningful threshold. (`True == 1` in Python is handled by checking `bool` first; `st.json(expanded=0)` documents the analogous `0` ≡ `False` overlap.) |
| `select_all < 0` (any negative integer) | Raises `StreamlitValueError`. Follow `st.navigation(expanded=...)`: "When using an int, `select_all` must be a non-negative integer." |
| `select_all` above the int32 proto max (`2**31 - 1`) | Clamped to `2**31 - 1`. A threshold that large already means "always show" for realistic lists. |
| Single option remaining | "Select all" never shown (requires 2+ selectable options, even with `select_all=True`) |
| All options selected | "Select all" not shown (no selectable option entries) |
| `max_selections` reached | "Select all" not shown (no additional selections can be made) |

### Default Value Rationale

The default of `1000` was chosen because:

1. **Matches current behavior for typical unfiltered lists:** PR [#15301](https://github.com/streamlit/streamlit/pull/15301) already hides bulk actions at 1000+ total options. Defaulting to `1000` keeps that performance gate, with the two unfiltered deltas in the table above (exact-1000 boundary, and remaining-selectable vs total-options).
2. **Performance safety:** The threshold limits how many new values a single bulk click can add, which is what froze the browser in [#15299](https://github.com/streamlit/streamlit/issues/15299). It does not cap the widget's total selection size.
3. **Reasonable UX:** Users rarely need to select more than 1000 items at once; beyond that, server-side filtering or pagination is usually more appropriate

> **Note:** Set `select_all=True` to show "Select all" even for lists of 1000+ options. Set `select_all=False` to hide it for smaller lists.

## Alternatives Considered

### Alternative 1: Boolean-only parameter

```python
st.multiselect(..., select_all=True)  # Default True
```

**Pros:** Simpler API

**Cons:**
- Default `True` would regress the existing 1000-option performance gate
- No middle ground for "enable for small lists only"

### Alternative 2: Different default (e.g., `True` or a higher threshold)

**Decision:** A threshold default of `1000` matches the existing hardcoded gate for typical unfiltered lists and addresses both use cases—users who want "Select all" for small lists get it automatically, while users with large datasets are protected from performance issues.

### Alternative 3: Separate parameter names

| Name | Pros | Cons |
|------|------|------|
| `select_all` (chosen) | Clear, matches feature name | - |
| `enable_select_all` | Explicit about enabling/disabling | Verbose, less natural with threshold values |
| `show_select_all` | More explicit about visibility | Verbose |
| `allow_select_all` | Matches [#16537](https://github.com/streamlit/streamlit/issues/16537) | Boolean-only feel; awkward with integer thresholds |
| `select_all_threshold` | Clear about threshold behavior | Doesn't work well with `False` |
| `bulk_select` | Avoids "all" confusion | Less intuitive |

**Selected: `select_all`** — Directly names the feature being controlled.

### Alternative 4: Automatic threshold based on client performance

The frontend could measure device capabilities and auto-adjust the threshold.

**Decision:** Too complex and unpredictable. An explicit parameter gives developers control.

### Alternative 5: `"auto"` sentinel instead of baking `1000` into the default

```python
select_all: bool | int | Literal["auto"] = "auto"
```

**Decision:** Rejected. An integer default of `1000` is explicit and matches the shipped gate. A later change to that gate would be a documented default change either way. Streamlit uses string sentinels like `width="stretch"` for layout, not for numeric performance thresholds.

### Alternative 6: Reuse `max_selections` instead of an integer threshold

`max_selections` already limits how many values can be selected. Two variants:

1. Drop the integer form of `select_all`. Show "Select all" only when the selectable count is at or below `max_selections` (and never, or always, when `max_selections` is unset).
2. Replace the integer with a `"max_selections"` sentinel (`select_all: bool | Literal["max_selections"]`). `True` always shows; `"max_selections"` shows only when the selectable count is at or below `max_selections`.

**Decision:** Rejected. `max_selections` is a product cap ("the user may pick at most N"); the `select_all` integer is a performance/visibility gate on one bulk click. Most apps leave `max_selections` unset, so variant 1 would either always show "Select all" (regressing the freeze) or never show it. Variant 2 still needs a default integer for those apps, which is the current design. The two also compose independently: `max_selections=5` on a 10k list still shows "Select all" today and truncates to 5; gating visibility on `max_selections` would hide that shortcut. Apps that want no bulk-select already use `select_all=False` without imposing a selection cap.

### Alternative 7: Keep unfocused create-on-Enter for `accept_new_options`

When `accept_new_options=True` and no dropdown item is focused, Enter could still create the typed value even if existing options match the query (`"py"` + Enter → `"py"`, not `python` / "Select 2 matches").

**Decision:** Rejected. **Approved shipped behavior** is first-row Enter. This is a breaking interaction change for creatable multiselects, not an API break: a query that matches existing options adds those matches (or the first match when bulk is hidden), not a typed prefix. Unique custom values still create with a single Enter because "Add: …" is then first. Values that also match existing options can be created via ArrowDown or click on "Add: …". There is no opt-out parameter; restoring the leftover RAC path would reintroduce the prefix-create gotcha.

### Alternative 8: Unfocused Enter skips the bulk-action row

Unfocused Enter could skip bulk-action rows and, when `accept_new_options` is set, prefer the "Add: …" row so bulk-select and create-on-Enter stay opt-in via ArrowDown or click.

**Decision:** Rejected. First-row Enter is the approved keyboard model. Bulk-select with Enter is correct when the bulk row is shown; `select_all=False` is the opt-out. Preferring "Add: …" over matching options would recreate the prefix-create gotcha Alternative 7 removes.

## Out of Scope (Future Work)

- **Custom "Select all" label:** Users might want to customize "Select all" to "Add all to cart" etc.
- **Relabel "Select all" when `max_selections` truncates the selection:** Keep today's "Select all" label even when only `max_selections` items will be selected (for example `max_selections=5`).
- **"Select none" / "Clear all" option:** A separate dropdown option to deselect everything. The widget already has a clear-all button on the trigger; this would be a dropdown counterpart.
- **Confirmation dialog for large selections:** Warn users before selecting many options
- **Server-side selection for very large datasets:** Would require architectural changes to stream selections

## Checklist

| Item                         | ✅ or comment |
|------------------------------|---------------|
| Works on SiS, Cloud, etc?    | ✅ Yes, full-stack change (Python + proto + frontend) |
| No breaking API changes      | ✅ Yes, new optional parameter. Approved **interaction** deltas (not API breaks): the unfiltered threshold table, and unfocused Enter committing the first visible row (including bulk when shown). Matching-prefix create-on-Enter is intentionally removed; unique custom values still create with a single Enter. See Keyboard / Enter and Alternative 7. |
| No new dependencies          | ✅ Yes |
| Metrics collected            | ✅ Track `select_all` parameter usage |
| Any security/legal impact?   | ✅ No impact |
| Any docs changes needed?     | ✅ Yes, document new parameter |
