---
author: lukasmasuch
created: 2026-10-15
---

# Text alignment for button-like elements

## Summary

Add a keyword-only `text_alignment` parameter to every button-like element, meaning every
command that renders a single labeled button: `st.button`, `st.download_button`,
`st.link_button`, `st.form_submit_button`, `st.popover`, `st.menu_button`, and
`st.page_link`. It aligns the content (icon, label, keyboard shortcut, and chevron) to the
`"left"`, `"center"`, or `"right"` of the element. Each command's default keeps its current
look: `"center"` for buttons and popover or menu triggers, and `"left"` for
`st.page_link`. The name reuses the existing `text_alignment` parameter of text elements
instead of introducing new alignment vocabulary.

```python
st.button(
    "Dashboard", icon=":material/dashboard:", width="stretch", text_alignment="left"
)
```

## Problem

Button content is always centered, and `st.page_link` content is always left-aligned.
This is invisible for content-width elements. But as soon as an element is wider than
its content (`width="stretch"`, a pixel width, or a label that wraps onto multiple
lines), users can't change the alignment.

### User requests

- [#10770](https://github.com/streamlit/streamlit/issues/10770) (Planned, papercut,
  7 👍): left-aligned buttons look better, especially next to `st.navigation` in the
  sidebar. A would-be contributor asked maintainers to decide the name (`align` vs
  `text_alignment`) and the scope (`st.button` only vs the whole button family).
- [#6677](https://github.com/streamlit/streamlit/issues/6677) (closed as duplicate):
  a text-align option for full-width buttons. The author's mockups show a sidebar menu
  made of left-aligned buttons and right-aligned sub-entries.

### Current workarounds

- **Injected CSS** (`st.html` or `st.markdown(..., unsafe_allow_html=True)`) that targets
  private class names and test IDs. The content is centered at three nested levels (the
  button and two label wrappers), so the selectors are deep and break when the internal
  DOM changes.
- **`st.page_link`** renders a left-aligned row, but only navigates to pages. It can't
  run a callback, download a file, submit a form, or open a popover.
- **Custom components**, which add friction for a purely visual tweak.

### Use cases

1. **Sidebar action menus.** A stack of full-width tertiary or secondary buttons with
   icons that reads like a navigation list, matching the left-aligned `st.navigation`
   and `st.page_link` rows around it.
2. **List rows.** Full-width buttons that act as selectable list items (chat history,
   saved queries, files), where long labels should start at the left edge and wrap or
   truncate there.
3. **Previous / next navigation.** Two stretched buttons side by side: "← Back"
   left-aligned and "Next →" right-aligned, like the pager at the bottom of a docs page.

## Proposal

### API

Add one keyword-only parameter, placed right after `width` (as in `st.title` and
`st.header`, where `text_alignment` follows `width`):

```python
st.button(
    label,
    key=None,
    help=None,
    on_click=None,
    args=None,
    kwargs=None,
    *,
    # ... existing keyword-only parameters ...
    width: Width = "content",
    text_alignment: Literal["left", "center", "right"] = "center",  # NEW
    # ... existing keyword-only parameters ...
)
```

The same parameter and values are added to every other button-like element (see
[Scope](#scope)).

| Value | Behavior |
| --- | --- |
| `"center"` | Content is centered. This is today's look and the default for buttons and popover or menu triggers. |
| `"left"` | Content starts at the left inner edge. This is today's look and the default for `st.page_link`. |
| `"right"` | Content ends at the right inner edge. |

```
text_alignment="left"     [ ⚙  Settings                    ]
text_alignment="center"   [           ⚙  Settings          ]
text_alignment="right"    [                    ⚙  Settings ]
```

Any other value raises `StreamlitValueError("text_alignment", ["'left'", "'center'",
"'right'"])`.

### Scope

The parameter covers every button-like element. These commands share the same content
model (a label with an optional icon) and often sit next to each other in the same
sidebar or toolbar, where they need to line up. Adding the parameter to all of them at
once means a user who learns `text_alignment` on one can use it on all of them.

| Command | Default | Notes |
| --- | --- | --- |
| `st.button`, `st.download_button`, `st.link_button`, `st.form_submit_button` | `"center"` | |
| `st.popover`, `st.menu_button` | `"center"` | Aligns the trigger button. The chevron moves with the label. |
| `st.page_link` | `"left"` | Keeps its navigation-row look. `"center"` and `"right"` become possible. |

This is the button family that received `wrap` in the
[horizontal wrap control spec](../2026-07-23-horizontal-wrap-control/product-spec.md),
plus `st.page_link`, which already shares `icon_position` with the buttons. Elements
that merely contain buttons are not button-like in this sense: `st.pills` and
`st.segmented_control` are option groups, `ButtonColumn` renders cells inside a
dataframe, and internal controls such as the file uploader's "Browse files" button have
no user-set label (see [Out of scope](#out-of-scope-future-work)).

### Parameter name

The name is the main decision in this spec. Each candidate is compared against the
alignment vocabulary that the public API already uses.

#### Existing alignment vocabulary

| Parameter | Used by | What it aligns | Values |
| --- | --- | --- | --- |
| `text_alignment` | `st.markdown`, `st.caption`, `st.text`, `st.title`, `st.header`, `st.subheader` | Text and inline content inside the element | `"left"` (default), `"center"`, `"right"`, `"justify"` |
| `horizontal_alignment` | `st.container` | Child elements along the horizontal axis | `"left"` (default), `"center"`, `"right"`, `"distribute"` |
| `vertical_alignment` | `st.container`, `st.columns` | Child elements along the vertical axis | `"top"` (default), `"center"`, `"bottom"`, plus `"distribute"` on `st.container` only |
| `alignment` | `st.column_config.*Column` | Cell content in a dataframe column | `"left"`, `"center"`, `"right"`, `None` |
| `icon_position` | `st.button`, `st.download_button`, `st.link_button`, `st.form_submit_button`, `st.page_link` | Which side of the label the icon is on | `"left"` (default), `"right"` |
| `position` | `@st.dialog`, `st.navigation` | Placement of the element itself | Per command |

These names follow three rules:

- **Alignment parameters are nouns ending in `_alignment`**, qualified by what they
  align (`text_`) or by axis (`horizontal_`, `vertical_`). A bare `alignment` exists only
  inside `st.column_config`. No public parameter is called `align`.
- **Content alignment and layout alignment use different names.** `text_alignment`
  aligns the content of a single element, while axis-qualified names arrange the child
  elements of layout containers. Aligning a button's content is the first kind.
- **`*_position` places an element or a sub-part of one** (`icon_position`), not its
  content.

#### Candidates

**`text_alignment`** ✅ PREFERRED

- **Same meaning as today.** Text elements document `text_alignment` as "the horizontal
  alignment of the text within the element", which is exactly what this parameter
  does. Users who know `st.markdown(..., text_alignment="center")` will try the same
  name on a button, and so will coding agents that already know the text-element API.
  This follows the guidance on consistency, matching user expectations, and
  respecting existing patterns.
- **Can't be read as moving the button.** It scopes the alignment to the element's
  content. Positioning a button inside its container stays the job of
  `st.container(horizontal_alignment=...)`.
- **Already proposed by users.** It is the CSS `text-align` mental model, and it came up
  in the discussions on both [#6677](https://github.com/streamlit/streamlit/issues/6677)
  and [#10770](https://github.com/streamlit/streamlit/issues/10770).
- Con: the content includes more than text (the icon, shortcut, and chevron). This is
  acceptable because `text_alignment` already means "all content" on headings:
  `st.title("Sales", icon=":material/bar_chart:", text_alignment="center")` moves the
  separate `icon` parameter along with the text.
- Con: the default differs by command (`"center"` on buttons, `"left"` on text elements
  and `st.page_link`). Each default keeps the element's current look, and defaults
  already vary by command (for example, `width` defaults to `"content"` on buttons and
  `"stretch"` on text elements).
- Con: it accepts a subset of the values (no `"justify"`, see
  [Values](#values)). There is precedent: `vertical_alignment` on `st.columns` omits
  `"distribute"`, which `st.container` supports.

**`label_alignment`**, the strongest alternative

- Pro: it pairs with the button's first parameter, `label`, following the
  `<parameter>_<modifier>` pattern of `label_visibility` and `icon_position`.
- Pro: it could extend to every widget. A future `st.text_input(...,
  label_alignment="center")` that centers the caption above the input would have the
  same meaning: horizontal alignment of the widget's label within the widget's width.
  This is a different request from label *position* (for example
  [#7589](https://github.com/streamlit/streamlit/issues/7589), moving the label to the
  left of the input), which would need its own parameter.
- Con: it describes only part of what moves. The icon, shortcut, and chevron are
  separate from `label`, so `label_alignment` would also move content that isn't the
  label.
- Con: tying the name to the parameter splits one concept into several names. Text
  elements call their content `body` but use `text_alignment`, and a future `st.metric`
  alignment would need to move `label`, `value`, and `delta` together. With
  `label_alignment` on buttons, "align this element's content" would have a different
  name on each element type. With `text_alignment`, it has one name everywhere.
- Con: it is new vocabulary. Users and coding agents who know `text_alignment` from
  text elements would guess wrong on buttons.

The resulting rule is that `text_alignment` aligns all of an element's content, and a
part-specific name like `label_alignment` stays free for widgets where only the label
should move (such as the caption above an input). On a button, the label is not the only
part that moves, so the whole-content name fits better.

**`align`** ❌

- Pro: it is the shortest name and the one suggested in
  [#10770](https://github.com/streamlit/streamlit/issues/10770).
- Con: it is ambiguous. `st.button("Save", align="right")` reads as "put the button on the
  right", which is the most common button-layout question and is already solved by
  `st.container(horizontal_alignment="right")`.
- Con: it is a verb, while every existing alignment parameter is an `*_alignment` noun.

**`alignment`** ❌

- Pro: it is short, and `st.column_config` already uses it for content alignment
  within cells.
- Con: without a qualifier, it doesn't say what is aligned, so it has the same
  ambiguity as `align`. `st.button("Save", alignment="right")` still reads as
  positioning the button. In `st.column_config`, the column provides that context. A
  standalone element doesn't, which is why every top-level alignment parameter is
  qualified (`text_`, `horizontal_`, `vertical_`).
- Minor: on `ButtonColumn`, `alignment` positions the button within its cell rather
  than its content. This is a weak argument, because column config parameters already
  differ in detail from their widget counterparts.

**`horizontal_alignment`** ❌

- Pro: structurally accurate, since a button's content is a horizontal row.
- Con: on `st.container` it arranges child elements and accepts `"distribute"`. Reusing
  it on a leaf widget blurs the line between element layout and content alignment, and
  it invites a meaningless `vertical_alignment` counterpart.

**`content_alignment`** ❌

- Pro: an accurate description (icon, label, and shortcut).
- Con: it is new public vocabulary for the concept `text_alignment` already names, and
  "content" usually means a container's child elements in Streamlit's layout API.

**`justify`** / **`justify_content`** ❌

- Con: CSS flexbox jargon, which goes against the preference for plain names over
  technical ones. It also collides with `text_alignment="justify"`.

**Recommendation:** `text_alignment`. The broader naming system stays consistent:
`text_alignment` aligns content inside a single element (text elements and button-like
elements today, other elements like `st.metric` later if requested), and
`horizontal_alignment` / `vertical_alignment` arrange multiple items. For example,
aligning the options of `st.pills` and `st.segmented_control`
([#12645](https://github.com/streamlit/streamlit/issues/12645)) arranges several items,
so it would map to `horizontal_alignment`, not `text_alignment`.

### Values

- **`"left"`, `"center"`, `"right"` only.** `"justify"` differs from `"left"` only when a
  label wraps, and justifying the two or three words of a wrapped button label produces
  wide, broken-looking gaps. It can be added later without a breaking change.
- **`"right"` has the weakest use case** (the previous/next pager). It stays because
  users who know `text_alignment` from text elements expect the full left, center, and
  right set, and supporting it adds almost no cost.
- **Explicit per-command defaults that keep today's look, not `None` or auto.** The
  default is `"center"` on buttons and triggers and `"left"` on `st.page_link`. An
  explicit default documents today's behavior, and layout can't reliably infer the
  author's intent (see [Alternatives considered](#alternatives-considered)). Text
  elements also use an explicit default.
- **`"left"` / `"right"`, not `"start"` / `"end"`**, to match the existing
  `text_alignment` values.

### Behavior

- **Content moves as one group.** The icon, label, keyboard shortcut, and (for
  `st.popover` and `st.menu_button`) the chevron stay together and align as a unit.
  `icon_position` still decides which side of the label the icon is on. Button padding
  is unchanged, so content aligns to the inner padding edge.
- **The chevron stays next to the label.** `"left"` doesn't pin the `st.popover` /
  `st.menu_button` chevron to the far edge. That would make the trigger look like an
  `st.selectbox` and mix two alignments under one value.
- **The effect needs spare horizontal space.** The alignment is visible with
  `width="stretch"`, a pixel width, or a label that wraps onto multiple lines, where each
  line follows the alignment. With the default `width="content"` and a single-line label,
  nothing changes visually. Like text elements, Streamlit doesn't warn in this case, and
  the docstring carries the same note as the text elements' `text_alignment`.
- **Truncated labels.** With `wrap=False`, a label that is too long is truncated with an
  ellipsis and fills the available width, so alignment has no visible effect. A label
  that fits aligns normally.
- **Works with every `type`.** With `"tertiary"` (no padding or background),
  `width="stretch"` and `text_alignment="left"` give a full-width, left-aligned clickable
  row (use case 1).
- **Only the trigger changes.** For `st.popover` and `st.menu_button`, the parameter
  aligns the trigger button. The popover body and the menu options are unaffected (menu
  options are already left-aligned).
- **`st.page_link` moves only its content.** Its icon and label move together. The hover
  and current-page highlights already span the link's full width and are unchanged.
  Page links keep their labels on one line, so `"center"` and `"right"` only show a
  difference with `width="stretch"` or a pixel width.
- **Independent of container alignment.** `st.container(horizontal_alignment=...)`
  positions the button, and `text_alignment` aligns the content inside it. Both can be
  combined.
- **Unchanged:** the clickable area, hover, focus, and disabled styles, the `help`
  tooltip, return values, callbacks, and form, download, link, page navigation, and
  popover behavior.
- **Not part of widget identity.** Like `wrap`, and unlike `width` and `icon_position`,
  `text_alignment` is excluded from the element ID. Changing it at runtime doesn't reset
  the widget. This includes a keyed stateful `st.popover`, whose ID hashes its other
  arguments even when a key is set.

### Examples

**Sidebar action menu:**

```python
import streamlit as st

with st.sidebar:
    st.button(
        "Dashboard",
        icon=":material/dashboard:",
        type="tertiary",
        width="stretch",
        text_alignment="left",
    )
    st.button(
        "Reports",
        icon=":material/description:",
        type="tertiary",
        width="stretch",
        text_alignment="left",
    )
    with st.popover(
        "Account",
        icon=":material/person:",
        type="tertiary",
        width="stretch",
        text_alignment="left",
    ):
        st.button("Sign out")
    # Page links are left-aligned by default.
    st.page_link("settings.py", label="Settings", icon=":material/settings:")
```

**List rows with long labels:**

```python
import streamlit as st

chats = [
    "Quarterly revenue analysis for the EMEA region",
    "Fix the login redirect bug",
]
for chat in chats:
    st.button(chat, key=chat, width="stretch", text_alignment="left")
```

**Previous / next navigation:**

```python
import streamlit as st

back, forward = st.columns(2)
back.button(
    "Back", icon=":material/arrow_back:", width="stretch", text_alignment="left"
)
forward.button(
    "Next",
    icon=":material/arrow_forward:",
    icon_position="right",
    width="stretch",
    text_alignment="right",
)
```

### Implementation notes

- **Protobuf.** Add a field to `Button`, `DownloadButton`, `LinkButton`, `MenuButton`,
  `PageLink`, and `Block.Popover`, reusing the existing `TextAlignmentConfig` message. The
  element-level `Element.text_alignment_config` already exists, but it is not enough
  here. Blocks don't have it, so `st.popover` needs its own field either way. It also
  only sets CSS `text-align` on the element wrapper, which doesn't reach the button's
  inner flex layout.
- **Frontend.** Map the value to `justify-content` (for the single-row group) and
  `text-align` (for wrapped lines) where each element centers its content today. For
  regular buttons, that's the full-width shared label row. For popover and menu-button
  triggers, it's the button itself, because their label containers shrink to their
  content. `st.page_link` renders its own link row, which already sets
  `justify-content`. Map the value there too. When the field is unset, fall back to each
  element's current alignment (`"center"` for buttons, `"left"` for page links), so
  older backends render unchanged.
- **Backend.** Add a button-specific `Literal["left", "center", "right"]` type alias and
  validator. Don't reuse `validate_text_alignment`, which accepts `"justify"`.
- **Tests and AppTest.** Add typing tests for all seven commands, and unit tests that
  changing `text_alignment` doesn't change the element ID of an unkeyed `st.button` or
  a keyed stateful `st.popover`. Expose `text_alignment` on the AppTest `Button`,
  `DownloadButton`, `LinkButton`, `MenuButton`, and `PageLink` nodes.
  `st.form_submit_button` uses the `Button` node, and `st.popover` has no typed node.
  Add E2E snapshots for each value with a stretched button, a wrapped label,
  `icon_position="right"`, a keyboard shortcut, a popover or menu-button chevron, and a
  stretched page link.

## Alternatives considered

### Option A: Explicit `text_alignment` parameter ✅ PREFERRED

This is the proposal above. The author states the intent, and a button renders the same
way in every layout.

### Option B: Automatic left alignment in specific layouts, with no parameter

Streamlit would left-align button content when the layout suggests a menu, for example
a stretched button placed directly in `st.sidebar`, or several stretched buttons stacked
on top of each other. Right alignment would not be offered.

- Pro: no new parameter on seven commands that already have many.
- Pro: it fixes the main request (sidebar menus) with no code changes, including in
  existing apps.
- Pro: there is precedent. With `wrap=None`, Streamlit already decides based on layout
  (labels don't wrap in horizontal containers and columns).
- Con: **layout doesn't reveal intent.** The same layouts hold both menus and calls to
  action. A lone full-width "Run analysis" button or a form's submit button in the
  sidebar, or stacked "Save" and "Cancel" buttons in a dialog, should stay centered. A
  list of tertiary navigation buttons should be left-aligned. Any rule based on sidebar
  placement or stacking gets one of these wrong. The automatic `wrap` mode is
  different: it prevents rows of mismatched heights, a functional problem that the
  layout does reveal.
- Con: **there's no override.** When the rule picks wrongly, users are back to CSS hacks,
  so this ends up needing Option C anyway.
- Con: **it's hard to predict and explain.** Moving a button into an `st.container`, or
  adding a second button, would change how the first one looks. Whether buttons count
  as stacked depends on their siblings, which can change between reruns. For example, a
  button that appears conditionally would flip its neighbor's alignment.
- Con: **it changes existing apps.** Every stretched sidebar button, and every wrapped
  label, would look different after upgrading.
- Con: **it misses the other use cases.** List rows in the main area and the
  previous/next pager aren't in the sidebar.

### Option C: Parameter with an automatic default

`text_alignment: Literal["left", "center", "right"] | None = None`, where `None` lets
Streamlit choose left in menu-like layouts and center elsewhere, like `wrap=None`.

- Pro: it handles the common sidebar case with no code and keeps an explicit override.
- Con: it inherits Option B's problems with intent, predictability, and upgrade changes,
  softened only by the override. It is also harder to document, since the default
  depends on where the button is placed.

**Recommendation:** Option A for v1. It doesn't block Option C: the default could later
change from `"center"` to an automatic `None`. That change is API-compatible, but it
restyles apps that omit the parameter, so it needs the same scrutiny as Option B.
Revisit this if feedback shows that authors set the same alignment in the same layout
almost every time (for example, tertiary stretched buttons in the sidebar). That would
support a narrow automatic rule that is very unlikely to pick wrongly.

## Out of scope (future work)

- **`"justify"`.** Add it if justified, wrapped button labels are ever requested.
- **Option groups (`st.pills` and `st.segmented_control`).** Each option renders as a
  button, but the request for these widgets
  ([#12645](https://github.com/streamlit/streamlit/issues/12645)) is to arrange the
  options, which needs its own parameter (see [Parameter name](#parameter-name)).
  Aligning the text inside each option hasn't been requested.
- **`st.column_config.ButtonColumn`.** Cell buttons are sized to their content, so
  aligning the content inside them would have no visible effect. The column's
  `alignment` already positions them within the cell.
- **Split layouts inside one button**, such as the label on the left with the shortcut
  or chevron pinned to the right edge.
- **An app-wide default** (for example, a theme option for button alignment). The
  parameter is per call. Revisit this if users repeat it across many buttons.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | ✅ Frontend-only styling with no platform-specific behavior. |
| No breaking API changes | ✅ A new optional keyword-only parameter. Each command's default preserves today's rendering. |
| No new dependencies | ✅ |
| Metrics collected | ✅ Covered by the existing `gather_metrics` tracking on each command, which records that the keyword was passed. No dedicated tracking of the value. |
| Any security/legal impact? | ✅ None. |
| Any docs changes needed? | ✅ Docstrings for all seven commands, with the same width note as the text elements' `text_alignment`. Add one line to the `Text alignment` section of the embedded skill's `references/design.md` noting that button-like elements also accept `text_alignment` (default `"center"`, or `"left"` for `st.page_link`). |
