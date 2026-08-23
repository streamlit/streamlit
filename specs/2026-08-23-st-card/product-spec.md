---
author: lukasmasuch
created: 2026-08-23
---

# `st.card` layout container

## Summary

Add `st.card`, an opinionated, theme-aware container for grouping related content in a
recognizable card surface. A card can include an optional full-bleed header image and a
consistent header with a label, icon, description, and help tooltip, while its body accepts
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
    image_alt: str | None = None,
    icon: str | None = None,
    description: str | None = None,
    help: str | None = None,
    key: Key | None = None,
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
| `image_alt` | Optional alternative text for the header image. It must be provided when `image` is set without `label`. |
| `icon` | Optional emoji or Material icon displayed before the label, following existing Streamlit icon behavior. |
| `description` | Optional secondary text displayed below the label. It supports inline Markdown and describes the card. |
| `help` | Optional Markdown tooltip displayed beside the label. |
| `key` | Optional identifier that follows `st.container` behavior, including adding an `st-key-<key>` CSS class. |
| `width` | Uses the same values and behavior as `st.container`. |
| `height` | Uses the same values and behavior as `st.container`. |

`label` is the only positional parameter. Although card designs commonly call this value
a "title," Streamlit's standard public API term is `label`, as used by `st.expander`,
`st.popover`, and `st.status`.

`icon`, `description`, and `help` require `label`. `image_alt` requires `image`. Passing
an unsupported combination raises a clear exception. `st.card()` remains valid for a
body-only card. A media-only card requires a nonempty alternative description:
`st.card(image=..., image_alt=...)`.

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
2. **Header:** the optional icon, label, help tooltip, and description.
3. **Body:** arbitrary elements added to the returned container.

Omitted regions consume no space. A body to which no elements are added is omitted, so
media-only and header-only cards do not render an empty padded footer. A nonempty body
keeps normal Streamlit element spacing and padding. Actions, badges, charts, and other
content are composed in the body rather than passed through card-specific parameters.

The label uses a dedicated card-title style, visually similar to a subheader but without
an anchor. It stays on one line so repeated cards remain compact. The complete label
remains the card's accessible name and is available on hover when the visible text is
truncated. The description also stays on one line and ellipsizes so the header height
remains consistent across cards.

The card is exposed as an accessible named group when it has a label. In that case, the
header image is decorative by default because the label names the card. Authors can
provide `image_alt` when the image conveys additional meaning, such as a chart, screenshot,
or logo. When an image is set without a label, a nonempty `image_alt` is required and the
image is exposed with that alternative text.

### Header image

The image fills the card's available width, preserves its natural aspect ratio, and is not
cropped. It meets the card's top and side edges and follows the card's rounded top corners.
It does not show the `st.image` toolbar or a separate image caption.

Preserving the image avoids silently removing content from screenshots, logos, charts,
and other non-photographic media. Authors who need aligned media regions should provide
images with the same aspect ratio. Configurable cropping or image height can be added
later if usage shows that preprocessing images is too burdensome.

### Surface style

Cards always use one opinionated, theme-aware surface style:

- a subtle outline using the theme's standard border color;
- the standard Streamlit corner radius;
- a filled surface using `secondaryBackgroundColor`; and
- a subtle low-elevation shadow in light mode only.

The background follows the theme-aware color swap proposed for
[`st.container(background=True)` in #14683](https://github.com/streamlit/streamlit/pull/14683).
Cards invert the app/sidebar theme pairing so child widgets stay readable on the filled
surface:

- The card surface uses `secondaryBackgroundColor`.
- Children that normally use `backgroundColor` use `secondaryBackgroundColor`, and the
  reverse.
- Nested cards swap again; a card in the sidebar uses `backgroundColor` as its surface.

Applying this through a nested theme context lets Streamlit buttons, inputs, charts, and
other theme-aware children adapt to the card surface.

For example, an app can create white cards on a gray page through its existing theme:

```toml
[theme]
backgroundColor = "#f0f2f6"
secondaryBackgroundColor = "#ffffff"
```

Third-party components that do not consume Streamlit's theme context may not adapt
automatically.

The exact spacing and design tokens should be finalized in the design system, but the
public contract is an outlined, filled card that is visually distinguishable without
app-level styling. Dark mode uses the outline and tonal background difference instead of
a shadow, which would provide little visible separation on a dark surface. There are no
`border`, `background`, or `shadow` parameters and no card-specific theme option in the
initial API.

This keeps `st.card` recognizable across apps and avoids turning it into a second,
partially overlapping `st.container` styling API. The card reuses the background behavior
from #14683 but does not expose it as a card parameter. General container fills, custom
card variants, and configurable elevation remain separate follow-ups for
[#10531](https://github.com/streamlit/streamlit/issues/10531),
[#12418](https://github.com/streamlit/streamlit/issues/12418), and
[#12301](https://github.com/streamlit/streamlit/issues/12301).

### Design direction: a static expander

Cards should reuse the visual language of
[`st.expander`](https://docs.streamlit.io/develop/api-reference/layout/st.expander),
including its border, radius, header typography, icon placement, and spacing, without
expander interaction. They omit the chevron, hover-as-toggle treatment, pointer cursor,
and open/close behavior. Prototype this against the filled surface above; the public
contract is a static, outlined, filled card, not a new expander type. The card adds its
full-bleed media region and keeps the body permanently visible.

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
    description="Valais, Switzerland",
    help="Photo from the alpine image collection",
):
    st.write("A classic pyramidal peak in the Alps.")
    st.link_button("View route", "https://example.com/matterhorn")
```

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
        with st.card(name, image=image, description=country, height="stretch"):
            st.write("Trail conditions and trip details.")
            st.button("Open", key=name, width="stretch")
```

## Alternatives considered

### Option A: Opinionated `st.card` container — preferred

- **Pros:** Discoverable; concise; gives cards a consistent structure; enables full-bleed
  media without CSS; leaves arbitrary body content composable.
- **Cons:** Adds a command that overlaps with `st.container`; authors cannot customize the
  initial surface style.

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
  multiple layout commands. The card can reuse the theme-aware background behavior from
  #14683 without exposing general styling controls.

### `label` vs. `title`

**`label` is preferred** because Streamlit's API principles explicitly standardize
user-facing element text on `label`, and other titled containers (`st.expander`,
`st.popover`, and `st.status`) follow that convention.

`title` is a reasonable alternative: it is conventional card terminology, appears in the
existing issue and internal proposal, and is used by `st.dialog`. However, a new command
should follow the shared vocabulary unless its semantics require a different term. The
visible text can still be documented as the card title.

### `description` vs. `caption`

**`description` is preferred** because the command also accepts `image`. On `st.image`,
`caption` describes the image, so using it for supporting card text would make the same
parameter name mean two different things in closely related APIs. `description`
unambiguously refers to the card and follows common card terminology.

`caption` is shorter and is used for secondary option text in `st.radio`, but that command
does not also accept an image. Avoiding the image-caption ambiguity outweighs the shorter
name here.

### Natural image ratio vs. fixed media ratio

The preferred behavior preserves the image's natural ratio. A fixed ratio with
`object-fit: cover` would align card headers automatically, but it can crop important
content and would require additional crop-position or image-height controls. Those
controls should be considered only after observing real card usage.

## Out of scope and follow-ups

- Custom border visibility, background colors, shadow controls, or card variants.
- A `theme.cardBackgroundColor` option or other card-specific theme controls; cards use
  the existing primary/secondary theme color swap instead.
- `image_height`, `aspect_ratio`, crop mode, and focal-point controls.
- Multiple header images, image carousels, and video header media.
- Image or avatar inputs for `icon`; the initial API supports emoji and Material icons.
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
- Add card usage to command metrics. No label, image, image alternative text, description,
  or body content is included in telemetry.
- Add Python validation and typing coverage for image inputs, `image_alt`,
  label-dependent header fields, `key`, and width and height values.
- Add frontend and E2E coverage for full-bleed images, image alternative text, ellipsis,
  missing and empty regions, content-width image cards, fixed and stretch heights, light
  and dark themes, nested layout contexts, and narrow viewports. Include charts and inputs
  in cards in the main app, sidebar, and another card to verify the expected theme swaps.
  Verify that the shadow renders in light mode and is absent in dark mode.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | ✅ Uses existing image and container input patterns with no platform-specific behavior |
| No breaking API changes | ✅ New command |
| No new dependencies | ✅ No new dependency is required by the product design |
| Metrics collected | ✅ Command usage only |
| Any security/legal impact? | ✅ Same remote-image and Markdown considerations as existing elements |
| Any docs changes needed? | ✅ Layout API reference, card/gallery examples, and bundled agent guidance |
