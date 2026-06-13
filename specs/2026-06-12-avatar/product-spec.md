---
author: lukasmasuch
created: 2026-06-12
---

# `st.avatar`

## Summary

Add a native `st.avatar` command that displays a circular avatar (an image, Material
icon, or emoji) with an optional label and caption beside it. Avatars are a ubiquitous UI
primitive for representing people and entities—user profiles, contact lists, team rosters,
comment authors, and chat participants.

## Problem

Streamlit has no native way to render the single most common identity primitive on the
web: a circular avatar. Users routinely build profile pages, member directories, team
sections, leaderboards, and activity feeds, and today they have to hack it together. This
has been requested directly in
[#12475](https://github.com/streamlit/streamlit/issues/12475) (`st.avatar` to show a
standalone avatar image).

**Current workarounds:**

- `st.image(url, width=48)` renders a *square* image. Making it circular requires injecting
  CSS (`border-radius: 50%`) with `st.markdown(..., unsafe_allow_html=True)`, which is
  brittle and breaks across theme/layout changes.
- Hand-rolled `st.markdown` HTML blocks combining an `<img>` with name/role text, which
  don't respect the theme, don't size consistently, and are hard to align.
- The community [`streamlit-extras` avatar](https://arnaudmiribel.github.io/streamlit-extras/extras/avatar/)
  component, which proves the demand but pulls in an extra dependency and renders inside an
  iframe (extra height, no theme inheritance, layout quirks).

Notably, Streamlit *already* renders circular avatars internally for `st.chat_message`, but
that capability is locked inside the chat element and can't be used standalone.

**Use cases:**

- **User profile / account header** — show the signed-in user's picture, name, and role.
- **Member directories & team pages** — a grid or row of avatars with names and titles.
- **Comment / activity feeds** — author avatar next to each entry.
- **Tables of people** — avatar + name in a "person" cell (composed alongside other elements).
- **Leaderboards** — avatar + display name + rank/score.

## Proposal

### API

```python
st.avatar(
    image: str | Image | None = None,
    *,
    label: str | None = None,
    caption: str | None = None,
    size: Literal["small", "medium", "large"] | int = "medium",
    border: bool = False,
    on_click: Literal["ignore", "rerun"] | Callable[[], None] = "ignore",
    key: str | None = None,
) -> DeltaGenerator | bool
```

By default (`on_click="ignore"`) `st.avatar` behaves like a display element and returns
a `DeltaGenerator`. When made clickable (`on_click="rerun"` or a callback), it returns a
`bool`: `True` on the rerun where it was clicked and `False` otherwise, matching
`st.button`. This clickable-by-opt-in design is chosen over a display-only element—see
[Interactivity](#interactivity) for the trade-offs.

The simplest call is a single positional argument:

```python
st.avatar("https://avatars.githubusercontent.com/u/1673013")
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `image` | `str \| Image \| None` | `None` | The avatar content. Accepts the same image inputs as `st.image` (URL, local path, `PIL.Image`, NumPy array, bytes/`BytesIO`), **plus** a single emoji (e.g. `"🦖"`) or a Material icon (e.g. `":material/person:"`)—matching `st.chat_message`'s `avatar`. If `None`, falls back to initials derived from `label`, or a generic person icon when no label is given. |
| `label` | `str \| None` | `None` | Primary text shown to the right of the avatar (typically a name). Supports markdown. |
| `caption` | `str \| None` | `None` | Secondary text shown below the label (typically a role or status). Supports markdown and renders in the muted caption style used elsewhere in Streamlit. |
| `size` | `"small" \| "medium" \| "large" \| int` | `"medium"` | Diameter of the circular avatar image only. Semantic sizes map to rem-based values (`small` ≈ 1.5rem, `medium` ≈ 2.5rem, `large` ≈ 4rem; exact values TBD with design) so they scale with the root font size. An `int` sets a custom diameter in pixels and must be a positive value; non-positive values raise a `StreamlitAPIError` (Fail Fast). No upper bound is enforced, but very large values are clamped to the element's container width at render time. |
| `border` | `bool` | `False` | If `True`, draws a subtle border around the avatar (useful for light images on light backgrounds). |
| `on_click` | `"ignore" \| "rerun" \| Callable[[], None]` | `"ignore"` | Click behavior. `"ignore"` disables click interaction (avatar is purely decorative). `"rerun"` triggers a rerun when clicked. A callable runs as a callback before the rerun. Follows the `st.button` click pattern (a click action), not the `on_change` value-change pattern. |
| `key` | `str \| None` | `None` | Unique key for the element. Required when multiple clickable avatars would otherwise share identical parameters. |

### Return value

`st.avatar` returns a `DeltaGenerator` when `on_click="ignore"`, matching display elements
like `st.image` and `st.logo`. When `on_click="rerun"` or a callback is provided,
`st.avatar` returns a `bool`: `True` only on the rerun triggered by a click, and `False`
otherwise.

### Content types

`image` is intentionally flexible and mirrors how avatars are already specified in
`st.chat_message`:

```python
st.avatar("https://.../photo.png")     # remote image
st.avatar("profile.jpg")               # local file path
st.avatar(pil_image)                   # PIL.Image, numpy array, or bytes
st.avatar(":material/person:")         # Material icon
st.avatar("🦖")                         # emoji
st.avatar(None, label="Jane Doe")      # initials avatar → "JD"
```

This keeps a single, consistent mental model: the thing you'd pass as a chat avatar is the
thing you pass to `st.avatar`.

### Behavior

- The avatar always renders as a circle, cropping non-square images to a centered square
  (`object-fit: cover`).
- `size` controls only the circular avatar image; it does not scale the label, caption,
  spacing, or other surrounding element layout.
- When `label` and/or `caption` are provided, they render in a row to the right of the
  avatar, vertically centered against it. With no text, only the circle is shown.
- `label` and `caption` are each constrained to a single line and truncate with an ellipsis
  when they overflow; the full text is shown on hover.
- Emoji and icon avatars render centered on a themed neutral background; initials avatars
  show 1–2 uppercase letters derived from `label`. Initials are derived from the
  *plain-text* form of `label` (markdown syntax, links, emoji, and Material icons are
  stripped first): the first letter of the first two whitespace-separated words, or the
  first two letters of a single word. If no letters remain after stripping, the generic
  person icon is shown instead.
- The element sizes to its content (the circle plus any text). Place avatars side by side
  with `st.container(horizontal=True)`—no `multiple`/grouping parameter is needed
  (composition over configuration).
- `label` and `caption` support Streamlit markdown, with the same restrictions used across
  other labels.

### Interactivity

The main open design question is whether `st.avatar` should support click interaction,
because enabling clicks changes it from a display element into a widget (conditional return
type, requires `key`). Two options:

**Option 1: Clickable widget** ✅ PREFERRED

Add `on_click: Literal["ignore", "rerun"] | Callable[[], None] = "ignore"` plus `key`, and
return `DeltaGenerator` for the display-only case and `bool` for the clickable case.

```python
if st.avatar("profile.jpg", label="Jane Smith", on_click="rerun", key="profile"):
    st.write("Profile clicked!")
```

A clickable avatar should be keyboard-accessible: expose it as a button (`role="button"`,
focusable, activatable with Enter/Space) with an `aria-label` derived from `label`.

- Pros: Enables clickable profiles (open a dialog, navigate to a detail view) directly;
  `on_click="ignore"` keeps the common display-only case a one-liner.
- Cons: Mixed return type (display vs. widget); adds `key`/callback surface to the API.

**Option 2: Display-only in v1**

Ship `st.avatar` as a pure display element (returns `DeltaGenerator`), matching `st.image`
and `st.logo`. Users who need a clickable avatar compose with existing primitives, e.g.
wrap it in a container or pair it with a nearby `st.button`.

- Pros: Simplest, smallest API; consistent return type with sibling display elements;
  avoids widget machinery (`key`, state, callbacks) for the 80% case.
- Cons: No built-in click handling; clickable-profile patterns need a workaround until a
  fast-follow adds it.

**Recommendation:** Ship Option 1 (clickable). It covers more avatar use cases, including
interactive profile chips, user pickers, and navigation to detail views, while keeping the
display-only case ergonomic via the `on_click="ignore"` default.

### Examples

**Avatar with label and caption:**

```python
import streamlit as st

st.avatar(
    "https://avatars.githubusercontent.com/u/1673013",
    label="Adrien Treuille",
    caption="Co-founder",
)
```

**A row of team members:**

```python
import streamlit as st

with st.container(horizontal=True):
    st.avatar("https://avatars.githubusercontent.com/u/1673013", label="Adrien", caption="Co-founder")
    st.avatar("https://avatars.githubusercontent.com/u/690814", label="Thiago", caption="Co-founder")
    st.avatar("https://avatars.githubusercontent.com/u/47222480", label="Amanda", caption="Co-founder")
```

**Different sizes:**

```python
import streamlit as st

st.avatar("profile.jpg", size="small", label="Small")
st.avatar("profile.jpg", size="medium", label="Medium")
st.avatar("profile.jpg", size="large", label="Large")
st.avatar("profile.jpg", size=96, label="Custom (96px)")
```

**Icon, emoji, and initials avatars (no photo needed):**

```python
import streamlit as st

st.avatar(":material/person:", label="System", caption="Automated")
st.avatar("🦖", label="Rex", caption="Mascot")
st.avatar(None, label="Jane Doe", caption="No photo on file")  # renders "JD"
```

**Icon-only avatars in a row, with a border:**

```python
import streamlit as st

with st.container(horizontal=True):
    st.avatar("https://avatars.githubusercontent.com/u/1673013", size=40, border=True)
    st.avatar("https://avatars.githubusercontent.com/u/690814", size=40, border=True)
    st.avatar("🦖", size=40, border=True)
```

**Clickable avatar (open a profile dialog):**

```python
import streamlit as st

if st.avatar("profile.jpg", label="Jane Smith", caption="Engineer", on_click="rerun", key="profile"):
    show_profile_dialog("jane")
```

## Alternatives Considered

### Alternative 1: Extend `st.image` with a `shape="circle"` parameter

Rather than a new command, add `shape: Literal["rectangle", "rounded", "circle"]` (and
maybe `caption` placement tweaks) to `st.image`.

- Pros: Reuses `st.image`'s mature image handling; no new command (Extend Before Inventing).
- Cons: `st.image` has no concept of a `label`/`caption`-beside-image layout, no emoji/icon
  shortcut, and isn't semantically discoverable ("avatar" is a clear noun users search for).
  Avatars are a distinct, common-enough use case to warrant their own command
  (One Use Case, One Command). `st.image` and `st.avatar` can still share rendering
  internals.

**Rejected because** the layout (circle + adjacent text), the emoji/icon/initials inputs,
and discoverability justify a dedicated command, even though it reuses `st.image`'s
plumbing.

### Alternative 2: Use `width` instead of a dedicated `size`

Reuse the standard `width: "content" | "stretch" | int` parameter to control the circle.

- Pros: Maximizes parameter consistency across the API.
- Cons: An avatar is square and defined by a single diameter; `"stretch"` is meaningless for
  a circle, and conflating the element's container width with the circle's diameter is
  confusing. A semantic `size` (`small`/`medium`/`large`/int) mirrors `st.logo` and reads
  better for avatars.

**Rejected** in favor of `size`; a `width` parameter for the overall element can be added
later if needed (see Out of Scope).

## Out of Scope (Future Work)

- **Status indicator** — an online/offline dot or small badge overlaid on the avatar.
- **Avatar groups / stacking** — overlapping avatars with a `+N` overflow (e.g. "shared with").
- **Shape variants** — `shape="square" | "rounded"` for non-circular avatars.
- **Overall `width` parameter** — controlling the element's container width independently of `size`.
- **Disabled state and help tooltip** — button-like widget affordances that can be added
  later if the clickable use case needs them.
- **Custom background / ring color** — theming for icon/initials avatars beyond the default.

## Checklist

| Item                       | ✅ or comment                                                       |
|----------------------------|---------------------------------------------------------------------|
| Works on SiS, Cloud, etc?  | ✅ Reuses existing image/icon rendering and the standard widget path |
| No breaking API changes    | ✅ New, additive command                                            |
| No new dependencies        | ✅ Reuses `st.image`/`st.chat_message` rendering internals          |
| Metrics collected          | ✅ `st.avatar` via `gather_metrics`                                 |
| Any security/legal impact? | ✅ Same image-handling surface as `st.image`; clicks use the existing widget/callback path |
| Any docs changes needed?   | ✅ New command page + mention alongside `st.image` / `st.logo`      |
