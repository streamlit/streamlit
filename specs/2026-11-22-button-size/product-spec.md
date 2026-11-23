---
author: mayagbarnes
created: 2026-11-22
---

# Button `size` parameter

## Summary

Add a keyword-only `size` preset to `st.button`, `st.download_button`,
`st.form_submit_button`, `st.link_button`, `st.popover`, and `st.menu_button`. Buttons can then
be compact in dense layouts such as toolbars, dashboards, and card headers, or prominent as
calls to action. The values are `"xxsmall"`, `"xsmall"`, `"small"`, `"medium"`, and `"large"`.
They set the button's minimum height and padding. When `size` is omitted, buttons look exactly
as they do today. `st.pills`, `st.segmented_control`, and `st.page_link` follow later (see
[Scope](#scope-across-the-button-family)).

## Problem

**GitHub issue:** [#8822](https://github.com/streamlit/streamlit/issues/8822)

Every Streamlit button is 2.5rem tall. That works for form actions but is too dominant in
places where buttons are secondary: toolbars above a chart, action rows in a card, table
row actions, and BI-style dashboards. The issue reporter avoids `st.button` because it
"looks too big". At the other end, a primary call to action sometimes needs more presence
than the default.

### Current workarounds

- Injecting CSS against Streamlit's DOM (for example `.st-key-<key> button { min-height: ... }`).
  This breaks when the DOM changes and doesn't follow theme tokens ($53).
- Using `type="tertiary"` or an icon-only button to look lighter. That changes the visual
  weight but not the height, so rows stay tall.

### Goals

- One supported, theme-aware way to make a button shorter or taller.
- No change for existing apps.
- A scale that the other button-like commands and future containers, such as a card, can
  reuse.

### Non-goals

- Changing the label font size (see [Behavior](#behavior)).
- A global theme option for the default button height (see
  [Alternatives considered](#alternatives-considered)).
- Sizing the built-in buttons of other widgets (file uploader, camera input, audio input,
  chat input) or app chrome.

## Proposal

### API

```python
st.button(label, *, size: Literal["xxsmall", "xsmall", "small", "medium", "large"] | None = None, ...)
st.download_button(label, data, *, size=..., ...)
st.form_submit_button(label, *, size=..., ...)
st.link_button(label, url, *, size=..., ...)
st.popover(label, *, size=..., ...)
st.menu_button(label, options, *, size=..., ...)
```

For `st.popover` and `st.menu_button`, `size` applies to the button that opens the popover or
menu.

`None` (default) means "not set": the button is `"medium"` unless its container derives a
different default (see [Container defaults](#container-defaults)). An explicit value, including
`"medium"`, always wins ($3).

| `size`      | Minimum height | Horizontal padding | Vertical padding | Line height |
| ----------- | -------------- | ------------------ | ---------------- | ----------- |
| `"xxsmall"` | 1.5rem         | narrower           | none             | tighter     |
| `"xsmall"`  | 1.75rem        | narrower           | none             | tighter     |
| `"small"`   | 2rem           | same as default    | smaller          | default     |
| `"medium"`  | 2.5rem         | default            | default          | default     |
| `"large"`   | 3rem           | wider              | larger           | default     |

Padding columns are relative to the `"medium"` default. The tighter line height is what keeps
a single-line label inside 1.5rem: the default line height of 1.6 on a 1rem font is already
taller than 24px.

Design confirmed these minimum heights. Exact padding stays a theme token and can change
without an API change.

### Examples

```python
# A compact toolbar above a chart.
with st.container(horizontal=True, vertical_alignment="center"):
    st.button("Refresh", icon=":material/refresh:", size="xsmall")
    st.download_button("Export", data=csv, file_name="data.csv", size="xsmall")
    st.link_button("Docs", "https://docs.streamlit.io", size="xsmall")

# A prominent call to action.
st.button("Get started", type="primary", size="large")

# A compact popover trigger next to compact buttons.
with st.container(horizontal=True, vertical_alignment="center"):
    st.button("Refresh", size="xsmall")
    with st.popover("Filters", size="xsmall"):
        st.checkbox("Only active")

# A compact submit button.
with st.form("search"):
    q = st.text_input("Query")
    st.form_submit_button("Search", size="small")
```

### Behavior

- **Minimum height, not fixed height.** The values are minimum heights. A label that wraps
  onto several lines makes the button taller, exactly as it does today.
- **Font size is unchanged.** Only height and padding change, so text stays legible at every
  size and matches surrounding text.
- **Button types.** `"primary"`, `"secondary"`, and `"tertiary"` all take the height.
  Tertiary buttons keep their zero padding, so only the minimum height changes for them.
- **Icons and shortcuts.** Icons keep their default 1rem size, which fits inside the
  1.5rem minimum height, so only the padding around them changes. The `shortcut` hint keeps
  its small font and tight line height, so it also fits at every size. At `"xxsmall"` and
  `"xsmall"` there is no vertical padding, so the icon and label define the content height.
- **Mixed rows.** Toolbars often mix sized buttons with controls that stay at 2.5rem, such
  as a collapsed-label `st.selectbox`. Use `vertical_alignment="center"` on the horizontal
  container so they line up, as in the examples above.
- **State and identity.** `size` is part of the element ID, like `width`, for `st.button`,
  `st.download_button`, `st.form_submit_button`, `st.link_button`, and `st.menu_button`. Two
  unkeyed buttons with the same label that differ only in `size` are separate elements, so a
  compact toolbar action and a regular one don't collide. When a `key` is passed, identity
  comes from the key alone, so changing `size` on a keyed button never resets it. `st.popover`
  leaves `size` out of its ID, because its open state would otherwise reset when `size`
  changes.
- **Relationship to existing sizing.** Public `size` has its own minimum-height and padding
  map. It is separate from the internal button padding presets, which also set a font size
  for some internal variants and don't change the minimum height. `size` set to
  `"medium"`, or omitted, reproduces today's rendering, including wrapped labels.
- **Reruns.** None of the interaction behavior changes.
- **Placement.** `size` behaves the same in forms, fragments, dialogs, the sidebar, columns,
  and horizontal containers. It does not change container layout beyond the button's own
  height.
- **Failures.** An unsupported value (including a non-string) raises `StreamlitValueError`
  that lists the valid values, before the element is registered. Commands that don't
  support `size`, such as `st.page_link`, reject the keyword with the usual `TypeError`.
- **Accessibility.** The elements, accessible names, keyboard behavior, and focus ring are
  unchanged. See [Accessibility floor](#accessibility-floor) for target size.
- **Data exposure and cost.** The backend adds one optional enum field to the button
  protos and leaves it unset when `size` is `None`. `"medium"` and unset add no CSS.
- **Compatibility.** Existing apps are unaffected. Older frontends ignore the new field. In
  AppTest, `size` is available through the element's `proto`. The agent API treats `size`
  as presentation-only and leaves it out of its description.

### Container defaults

Because `None` means "not set", a container can supply a default for the buttons inside it
without overriding an author's explicit choice. The `st.card` spec lists a compact density
(about 2rem) for header buttons as a follow-up. That change would apply to buttons whose `size`
is `None` and leave explicit values, including `"medium"`, alone. This spec adds no container
default. It only keeps the contract that makes one possible without a breaking change.

### Accessibility floor

At the default 16px root font size, `"xxsmall"` is 24 CSS px tall, which meets WCAG 2.2
SC 2.5.8 (Target Size, Minimum) for height. For width, primary and secondary buttons have
0.5rem of horizontal padding on each side, so an icon-only `"xxsmall"` button is at least
32px wide (16px of padding plus the 1rem icon). Both axes stay at or above 24px, matching the
`st.card` spec's "click targets stay at least 24 by 24 pixels".

Tertiary buttons keep their zero padding, so an icon-only tertiary button can be narrower
than 24px, as it already can today. A smaller `theme.baseFontSize` would also put `"xxsmall"`
below 24px. `"xxsmall"` is the smallest size in the scale, and the scale will not go smaller.
The docstring should recommend `"xxsmall"` and `"xsmall"` for dense desktop toolbars, because
touch targets should be larger.

### Scope across the button family

| Command                                                                      | `size`                     |
| ---------------------------------------------------------------------------- | -------------------------- |
| `st.button`, `st.download_button`, `st.form_submit_button`, `st.link_button` | Yes                        |
| `st.popover`, `st.menu_button`                                               | Yes, on the trigger button |
| `st.pills`, `st.segmented_control`, `st.page_link`                           | Follow-ups                 |

Toolbars and card headers mix buttons with popover and menu triggers, so all six share one
parameter, one set of values, and one set of heights.

`st.pills`, `st.segmented_control`, and `st.page_link` have a different default height, so
the same value names would not mean the same heights on them. Each needs its own decision
about what `"medium"` means, and gets its own follow-up.

### Why `size`, and why these names

**Parameter name.** `size` and `height` both describe the intent.

| Name     | Verdict         | Rationale                                                                                                                                                                                                             |
| -------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `size`   | **Recommended** | The parameter changes padding on both axes, not only height. Named presets are common in UI libraries. It leaves room to tune the preset without renaming. |
| `height` | Not recommended | `$7` has elements size themselves with `width` and `height`, which take a number or `"content"`/`"stretch"` ($45). `height` would promise a fixed height, but wrapped labels grow, and it would suggest an integer pixel value, which is not supported. |

**Value names.** `st.space(size=...)` and gap parameters use `"xxsmall"` through
`"xxlarge"` as a spacing scale where `"small"` is 0.75rem and `"large"` is 4.25rem. On
buttons, `"small"` is 2rem and `"large"` is 3rem. Only `"medium"` is the same.

This departs from $10 and $45 deliberately: a button `size` is a control preset, like
`type`, not a spacing length. Named size presets are common in UI libraries, for example
MUI's `small`, `medium`, and `large`. `st.logo`, `st.space`, and buttons each use `size` for
their own scale, which is why the docstring lists the button heights explicitly so the values
are never read as spacing. If reviewers prefer a name that can't be confused with `st.space`, the
alternative is a different set of names, such as `"compact"`, `"medium"`, and `"large"`,
which gives up the extra steps (see below).

**Number of values.** The issue proposed three (`compact`, `default`, `large`). The scale
has five, as confirmed with design. Buttons are used heavily in dashboards and other dense
parts of app layouts, and later in containers such as a card, so several compact steps cover
a broader range of use cases than a single "compact" value. `"xxsmall"` and `"xsmall"` are
only 0.25rem apart, so whether both are needed at launch is an open question below.

## Alternatives considered

### Option A: Per-button `size` parameter — preferred

- Pros: Explicit, discoverable in the docstring, works per button, and fits mixed rows.
- Cons: A new parameter on every button command.

### Option B: Theme option for the default button height

- Pros: One setting for the whole app.
- Cons: Can't mix sizes in one app, such as a compact toolbar and a large call to action,
  which is the main use case. It also changes every existing button for apps that set it.
  A theme option can be added later without conflicting with the parameter.

### Option C: Container-level `button_size` on `st.container`

- Pros: Size a whole toolbar at once.
- Cons: A button's size is no longer visible at its call site ($6), and it needs new rules
  for nested containers and non-button children.

### Option D: `height` with `"content"`, `"stretch"`, or an integer

- Pros: Reuses the size grammar ($45).
- Cons: Promises a fixed height that wrapping labels break, and an integer would invite
  heights below the accessibility floor. See [Why `size`](#why-size-and-why-these-names).

### Option E: Fewer values (`"compact"`, `"medium"`, `"large"`)

- Pros: Smaller surface, easier to teach.
- Cons: Gives up the extra compact steps that dashboards and future card layouts need.
  Rejected for now, because design chose the wider scale.

## Out of scope (future work)

- `size` on `st.pills`, `st.segmented_control`, and `st.page_link` (follow-ups), and on
  `st.feedback`.
- A theme option for the default button height.
- Card header actions, which are sized in their own change.
- Merging the internal button padding presets with the public size. This is an internal
  refactor with no user-visible effect.
- A container default for `size`, such as the `st.card` compact density. See
  [Container defaults](#container-defaults).
- Integer or `"content"`/`"stretch"` values.

## Open questions

1. Are the `size` name and its overlap with `st.space` acceptable, as described in
   [Why `size`](#why-size-and-why-these-names)?
2. Are both `"xxsmall"` and `"xsmall"` needed at launch, or should the first release ship
   four values and add `"xxsmall"` on request? Design confirmed five.

## Checklist

| Item                       | ✅ or comment                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅ Theme-based CSS only                                                                               |
| No breaking API changes    | ✅ New keyword-only parameter. The default renders as before                                          |
| No new dependencies        | ✅                                                                                                    |
| Metrics collected          | `gather_metrics` records keyword names, but string values only by length, so `size` values can't be told apart. Record the value for this closed enum if usage should be measured |
| Any security/legal impact? | ✅ No. Closed set of validated values                                                                 |
| Any docs changes needed?   | ✅ Docstrings, API reference, and the `layouts.md` note in the bundled `developing-with-streamlit` skill |
