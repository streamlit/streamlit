---
author: lukasmasuch
created: 2026-08-23
---

# `st.card` layout container

## Summary

Add `st.card`, an opinionated, theme-aware container for grouping related content in a
recognizable card surface. A card can include an optional full-bleed header image and a
consistent header with a label, icon, caption, and help tooltip, while its body accepts
arbitrary Streamlit elements.

## Problem

Cards are a common building block for dashboards, galleries, catalogs, profiles, and BI
apps. They help users scan repeated groups of related information and understand a page's
visual hierarchy.

App authors can approximate a card with `st.container(border=True)`, but creating a
polished card still requires repetitive element composition and fragile CSS:

- Images cannot extend to the top and side edges of a bordered container.
- Titles, icons, captions, and spacing vary between cards unless every app recreates the
  same structure.
- Private DOM selectors are commonly used for full-bleed media, background fills, and
  shadows. These workarounds can break between Streamlit releases.
- Side-by-side cards are difficult to keep visually consistent.

For example, the closest built-in composition still renders a padded image, heading
anchor, and independently spaced header elements:

```python
with st.container(border=True):
    st.image("mountain.jpg", width="stretch")
    st.subheader("Matterhorn")
    st.caption("Valais, Switzerland")
    st.write("A classic pyramidal peak in the Alps.")
```

### User requests

- [#16379](https://github.com/streamlit/streamlit/issues/16379) requests a first-class
  `st.card` container with an optional full-width image, title, help, and arbitrary body
  content.
- [#12418](https://github.com/streamlit/streamlit/issues/12418) requests a less visually
  busy way to distinguish dashboard cells, proposing either cards or filled containers.
- [#10531](https://github.com/streamlit/streamlit/issues/10531) requests container
  background colors, particularly for card-like dashboard layouts.
- [#12301](https://github.com/streamlit/streamlit/issues/12301) requests container shadows
  for a card-like appearance.
- [#4175](https://github.com/streamlit/streamlit/issues/4175) previously requested bordered
  containers to group related elements. `st.container(border=True)` addressed the basic
  grouping need but not structured cards or full-bleed media.
- The companion [`st.grid` proposal in #15188](https://github.com/streamlit/streamlit/pull/15188)
  defines a responsive layout for repeated cards, galleries, metrics, and dashboard
  panels.

### Use cases

1. **Galleries and catalogs:** Repeat an image, title, metadata, and actions for apps,
   datasets, products, destinations, or documents.
2. **Dashboard tiles:** Group a chart, metric, table, or filter beneath a consistent title
   and help tooltip.
3. **Entity summaries:** Present a person, organization, invoice, model, or other record
   with an icon, short description, key facts, and a details action.

### Goals

- Make a polished card possible without custom CSS.
- Provide a consistent visual structure while keeping body content fully composable.
- Work well in columns and the proposed `st.grid` layout, including equal outer heights.
- Keep the initial API small and consistent with existing Streamlit parameters.

### Non-goals

- Provide a general-purpose styling API for containers.
- Make the whole card interactive or selectable.
- Automatically align internal sections across cards with different structures.
- Replace `st.metric` or other specialized elements.

## Proposal

### API

```python
st.card(
    label: str | None = None,
    *,
    image: ImageInput | None = None,
    icon: str | None = None,
    caption: str | None = None,
    help: str | None = None,
    key: Key | None = None,
    background: bool | Literal["auto"] = "auto",
    shadow: bool = False,
    width: "stretch" | "content" | int = "stretch",
    height: "content" | "stretch" | int = "content",
) -> DeltaGenerator
```

`ImageInput` represents the single-image inputs accepted by `st.image`: a URL or local
path, SVG string, `Path`, bytes, `BytesIO`, PIL image, or NumPy array. Lists of images are
not accepted.

| Parameter | Behavior |
| --- | --- |
| `label` | Optional card title. It supports the inline Markdown accepted by other Streamlit labels. It is displayed on one line and ellipsized when necessary. |
| `image` | Optional header image rendered full width against the top and side edges of the card. |
| `icon` | Optional emoji, Material icon, or `"spinner"` displayed before the label, following existing Streamlit icon behavior. |
| `caption` | Optional secondary text displayed below the label. It supports inline Markdown and describes the card rather than the header image. |
| `help` | Optional Markdown tooltip displayed beside the label. |
| `key` | Optional identifier that follows `st.container` behavior, including adding an `st-key-<key>` CSS class. |
| `background` | Whether to use a filled card surface. `"auto"` enables it in dark mode and disables it in light mode. |
| `shadow` | Whether to add subtle elevation in light mode. Shadows are not rendered in dark mode. |
| `width` | Uses the same values and behavior as `st.container`. |
| `height` | Uses the same values and behavior as `st.container`. |

`label` is the only positional parameter. Although card designs commonly call this value
a "title," Streamlit's standard public API term is `label`, as used by `st.expander`,
`st.popover`, and `st.status`.

`icon`, `caption`, and `help` require `label`. Passing an unsupported combination raises a
clear exception. `st.card()` and `st.card(image=...)` remain valid for body-only and
media-only cards.

Empty and whitespace-only `label` values are treated as absent for these validation rules.
A blank label does not enable label-dependent fields.

The command returns a container, supporting both context-manager and object notation:

```python
with st.card("Revenue"):
    st.metric("Q3 revenue", "$1.2M", "8.4%")

revenue_card = st.card("Revenue")
revenue_card.metric("Q3 revenue", "$1.2M", "8.4%")
```

### Structure and behavior

A card has up to three regions in this order:

1. **Media:** the optional full-bleed header image.
2. **Header:** the optional icon, label, help tooltip, and caption.
3. **Body:** arbitrary elements added to the returned container.

Omitted regions consume no space. A body to which no elements are added is omitted, so
media-only and header-only cards do not render an empty padded footer. A nonempty body
keeps normal Streamlit element spacing and padding. Actions, badges, charts, and other
content are composed in the body rather than passed through card-specific parameters.

The label uses a dedicated card-title style, visually similar to a subheader but without
an anchor. It stays on one line so repeated cards remain compact. The complete label
remains the card's accessible name and is available on hover when the visible text is
truncated. The caption also stays on one line and ellipsizes so the header height
remains consistent across cards. Its complete text is exposed as the card's accessible
description and is available on hover when truncated.

The card is exposed as an accessible named group when it has a label. Header images are
decorative in the initial API, including on media-only cards. The docstring should
recommend providing a descriptive `label` and, when useful, `help` so the card has an
accessible name and additional context. Authors should not rely on the header image alone
to convey information required to understand or operate the app.

### Header image

The image fills the card's available width, preserves its natural aspect ratio, and is not
cropped. It meets the card's top and side edges and follows the card's rounded top corners.
It does not show the `st.image` toolbar or a separate image caption.

Preserving the image avoids silently removing content from screenshots, logos, charts,
and other non-photographic media. Authors who need aligned media regions should provide
images with the same aspect ratio. Configurable cropping or image height can be added
later if usage shows that preprocessing images is too burdensome.

### Surface style

Cards always have a subtle outline using the theme's standard border color and the
standard Streamlit corner radius. `background` and `shadow` provide two constrained,
theme-aware adjustments:

| Value | Light mode | Dark mode |
| --- | --- | --- |
| `background="auto"` (default) | Transparent | Filled |
| `background=True` | Filled | Filled |
| `background=False` | Transparent | Transparent |
| `shadow=True` | Subtle low-elevation shadow | No shadow |
| `shadow=False` (default) | No shadow | No shadow |

`"auto"` is resolved from the active theme's light or dark base, not by measuring the
surface color. This makes the default resemble an outlined expander in light mode while
adding tonal separation where shadows are ineffective in dark mode.

When background is enabled, it follows the theme-aware color swap proposed for
[`st.container(background=True)` in #14683](https://github.com/streamlit/streamlit/pull/14683).
Cards invert the app/sidebar theme pairing so child widgets stay readable on the filled
surface:

- The card surface uses `secondaryBackgroundColor`.
- Children that normally use `backgroundColor` use `secondaryBackgroundColor`, and the
  reverse.
- Nested cards swap again; a card in the sidebar uses `backgroundColor` as its surface.

This pairing lets Streamlit buttons, inputs, charts, and other theme-aware children adapt
to the card surface.

When background is disabled, the card surface is transparent and descendants inherit the
surrounding theme unchanged.

For example, with `background=True`, an app can create white cards on a gray page through
its existing theme:

```toml
[theme]
backgroundColor = "#f0f2f6"
secondaryBackgroundColor = "#ffffff"
```

Third-party components that do not consume Streamlit's theme context may not adapt
automatically.

The exact spacing and design tokens should be finalized in the design system, but the
public contract is an outlined card with adaptive fill and optional light-mode elevation.
Dark mode never renders a shadow because it provides little visible separation on a dark
surface. The outline remains visible for every combination. There is no `border`
parameter or card-specific theme option in the initial API.

This keeps `st.card` recognizable across apps and avoids turning it into a second,
partially overlapping `st.container` styling API. The parameters choose among a small
set of designed card surfaces; they do not accept arbitrary colors or shadow levels.
General container fills, custom card variants, and configurable elevation remain separate
follow-ups for
[#10531](https://github.com/streamlit/streamlit/issues/10531),
[#12418](https://github.com/streamlit/streamlit/issues/12418), and
[#12301](https://github.com/streamlit/streamlit/issues/12301).

### Design direction: a static expander

Cards should reuse the visual language of
[`st.expander`](https://docs.streamlit.io/develop/api-reference/layout/st.expander),
including its border, radius, header typography, icon placement, and spacing, without
expander interaction. They omit the chevron, do not toggle on header hover, do not use a
pointer cursor, and have no open/close behavior. Prototype this against the adaptive
surface above; the public contract is a static, outlined card, not a new expander type.
The card adds its full-bleed media region and keeps the body permanently visible.

This would make the card feel native to Streamlit and reduce the number of distinct
container styles. The design must still look clearly static; copying interactive expander
cues would create a false expectation that the card can be opened or collapsed.

### Sizing and layout

`width` and `height` match `st.container`:

- `width="stretch"` fills the parent width. `"content"` and integer pixel widths remain
  constrained by the parent.
- With `width="content"`, the header and body determine the card width and the header image
  scales to the resolved width. For a media-only card, the image's intrinsic width
  determines the card width. In both cases, the parent width remains the upper bound.
- `height="content"` grows with the card content.
- `height="stretch"` fills the available parent height when the parent defines one. This
  allows cards in the same row or grid to have equal outer heights.
- An integer height creates a fixed-height card. The whole card scrolls when its content
  overflows, matching `st.container`; the image and header are not pinned.

Equal outer height does not imply internal section alignment. Cards align their body
starts when they use images with the same aspect ratio and the same header fields.

### Examples

#### Image card

```python
import streamlit as st

with st.card(
    "Matterhorn",
    image="matterhorn.jpg",
    icon=":material/landscape:",
    caption="Valais, Switzerland",
    help="Photo from the alpine image collection",
    shadow=True,
):
    st.write("A classic pyramidal peak in the Alps.")
    st.link_button("View route", "https://example.com/matterhorn")
```

The shadow appears in light mode. In dark mode, the card uses its default filled
background and outline without a shadow. Pass `background=True` to keep the filled surface
in both modes, or `background=False` to keep it transparent in both.

#### Gallery with equal card heights

```python
import streamlit as st

destinations = [
    ("Matterhorn", "matterhorn.jpg", "Switzerland"),
    ("Kirkjufell", "kirkjufell.jpg", "Iceland"),
    ("Denali", "denali.jpg", "United States"),
]

for column, (name, image, country) in zip(st.columns(3), destinations):
    with column:
        with st.card(name, image=image, caption=country, height="stretch"):
            st.write("Trail conditions and trip details.")
            st.button("Open", key=name, width="stretch")
```

## Alternatives considered

### Option A: Opinionated `st.card` container — preferred

- **Pros:** Discoverable; concise; gives cards a consistent structure; enables full-bleed
  media without CSS; leaves arbitrary body content composable.
- **Cons:** Adds a command that overlaps with `st.container`; the two surface parameters
  increase the initial API.

### Option B: Extend `st.container`

For example, `st.container(label=..., image=..., border=True)`.

- **Pros:** Avoids a new command and keeps all grouping primitives in one API.
- **Cons:** Makes a general container responsible for card-specific header structure;
  reduces discoverability; creates unclear interactions with horizontal layout,
  alignment, gaps, and autoscroll.

### Option C: Add styling parameters to containers

For example, `st.container(background="secondary", shadow="small")`.

- **Pros:** More flexible and can reproduce many card styles.
- **Cons:** Does not solve full-bleed media or consistent headers; expands styling across
  multiple layout commands. The card's `background` and `shadow` controls are deliberately
  narrower than a general container styling API.

### Adaptive surface vs. a fixed card style

**Adaptive background with optional shadow is preferred.** The prototype showed that a
transparent outlined card is sufficient in light mode, while dark mode benefits from a
filled surface because shadows provide little separation. The `"auto"` default captures
that behavior without app code, while explicit booleans cover dashboards that need a
consistent surface across themes.

A fixed filled-and-shadowed design would keep the API smaller, but it looked unnecessarily
heavy in light mode and ineffective in dark mode. Arbitrary colors or shadow sizes would
offer more control but would reintroduce child-theme and visual-consistency problems.

### `label` vs. `title`

**`label` is preferred** because Streamlit's API principles explicitly standardize
user-facing element text on `label`, and other titled containers (`st.expander`,
`st.popover`, and `st.status`) follow that convention.

`title` is a reasonable alternative: it is conventional card terminology, appears in the
existing issue and internal proposal, and is used by `st.dialog`. However, a new command
should follow the shared vocabulary unless its semantics require a different term. The
visible text can still be documented as the card title.

### `caption` vs. `description`

**`caption` is preferred** because the slot has the same short, muted visual treatment as
`st.caption`, and it matches existing Streamlit vocabulary for secondary text.

The drawback is that `st.image(caption=...)` captions an image, so
`st.card(image=..., caption=...)` could be read the same way. The card docstring must state
that `caption` describes the card and appears below its label, not below the image.
`description` avoids this ambiguity, but introduces new vocabulary and suggests longer
text than this single-line slot supports. Longer descriptions belong in the card body.

### Natural image ratio vs. fixed media ratio

The preferred behavior preserves the image's natural ratio. A fixed ratio with
`object-fit: cover` would align card headers automatically, but it can crop important
content and would require additional crop-position or image-height controls. Those
controls should be considered only after observing real card usage.

## Out of scope and follow-ups

- Custom border visibility, arbitrary background colors, shadow sizes, or card variants.
- A `theme.cardBackgroundColor` option or other card-specific theme controls; cards use
  the existing primary/secondary theme color swap instead.
- `image_height`, `aspect_ratio`, crop mode, and focal-point controls.
- Multiple header images, image carousels, and video header media.
- Alternative text for header images. Header media is decorative in v1; an `image_alt`
  parameter can be added if real-world card usage shows a need for meaningful header
  imagery.
- Image or avatar inputs for `icon`; the initial API supports emoji, Material icons, and
  `"spinner"`.
- Built-in footer or action parameters. Use buttons and horizontal containers in the body.
- Clickable or selectable cards. Track this separately with
  [#10678](https://github.com/streamlit/streamlit/issues/10678).
- Automatic grid creation or cross-card internal alignment; grid layout is covered by
  [#15188](https://github.com/streamlit/streamlit/pull/15188).

## Design references

- [Material Design 3 cards](https://m3.material.io/components/cards/overview)
- [Component Gallery card anatomy](https://component.gallery/components/card/)
- [Streamlit design-system exploration](https://www.figma.com/design/svukmRMf0N9yQzdv8f7sgO/Streamlit-Open-Source-design-system?node-id=3924-321050)
- Dashboard background comparison in
  [#12418](https://github.com/streamlit/streamlit/issues/12418)

## Documentation and measurement

- Add `st.card` to the layout API reference with body-only, image-card, and gallery
  examples.
- Update the bundled `developing-with-streamlit` skill and dashboard templates that
  currently teach card-like layouts with bordered containers or custom CSS.
- Document that header images preserve their aspect ratio and that equal-ratio images are
  needed for aligned gallery headers.
- Add card usage to command metrics. No label, image, caption, or body content is included
  in telemetry.
- Add Python validation and typing coverage for image inputs, label-dependent header
  fields, `key`, `background`, `shadow`, and width and height values.
- Add frontend and E2E coverage for full-bleed decorative images, ellipsis, missing and
  empty regions, content-width image cards, fixed and stretch heights, light and dark
  themes, every background/shadow mode, nested layout contexts, and narrow viewports.
  Include charts and inputs in cards in the main app, sidebar, and another card to verify
  the expected theme swaps. Verify that `shadow=True` renders elevation in light mode and
  no shadow in dark mode.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | ✅ Uses existing image and container input patterns with no platform-specific behavior |
| No breaking API changes | ✅ New command |
| No new dependencies | ✅ No new dependency is required by the product design |
| Metrics collected | ✅ Command usage only |
| Any security/legal impact? | ✅ Same remote-image and Markdown considerations as existing elements |
| Any docs changes needed? | ✅ Layout API reference, card/gallery examples, and bundled agent guidance |
