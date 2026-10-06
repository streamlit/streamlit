# Streamlit WCAG command inventory

Last updated: 2026-10-06. Re-audit a command when its accessible name, keyboard behavior, or role changes.

This page is the **command** inventory (`st.*`). For default theme tokens and library shell chrome (1.4.3, 1.4.11, 2.5.8), see the [theme & shell chrome inventory](accessibility-theme.md).

How Streamlit enables or blocks authors from meeting **WCAG 2.2 Level A and AA** in their apps. Conformance applies to the **app**, not the library — this page is not a claim that Streamlit itself is conformant.

Accessibility audits (US Section 508, EN 301 549, and similar) evaluate the app an author ships, not Streamlit itself. Use this inventory to see, per command, whether public Streamlit **blocks** a criterion, **meets** it already, leaves it to the **author**, or treats it as **not this surface**.

**Current documented coverage:** media, charts, maps, data, embeds, and images audited during the `alt` rollout, plus the shared chrome those commands use (accessible names for 4.1.2 and element-toolbar target size for 2.5.8). Other widgets are out of scope until audited. Shell chrome for 1.4.3, 1.4.11, and 2.5.8 is on the [theme inventory](accessibility-theme.md); other shell criteria (for example 2.4.1 and 4.1.3) are unscored.

## What we are scoring

Score **WCAG 2.2 Level A and AA**. Section 508 still points at WCAG 2.0 A+AA, and EN 301 549 at 2.1 A+AA. Conforming to 2.2 AA also covers those earlier A+AA sets: 2.2 removed 4.1.1 Parsing and treats it as always met. Do not score AAA.

These tables are not a full WCAG audit. Each command lists only the criteria in its kind's fixed set (below); other A/AA criteria were not evaluated. Where the bucket is **Author must**, conformance still depends on author content such as a useful `alt`, captions, a transcript, or non-color encodings.

In each command table, rows are ordered **Level A** (by success-criterion number), then **Level AA** (by success-criterion number).

| Bucket | Meaning |
| ------ | ------- |
| **Library blocks** | An author cannot meet the criterion with public Streamlit, no matter what they write (including other commands on the same page). Candidate for a later product spec. |
| **Author must** | The author can meet the criterion with public Streamlit (a command hook such as `alt` / `subtitles`, or other page content they control). The app still fails if they omit or write a bad alternative. |
| **Library meets** | Streamlit already provides the mechanism; the author does not need a new API for this criterion on this surface. |
| **Not this surface** | Streamlit does not own the fix or the failure for that control — an upstream library (Plotly, Mapbox, YouTube) or a third-party package owns it. Author-controlled content (chart encodings, image pixels, iframe document) falls under **Author must** instead. Do not open a Streamlit product spec for this row. |

### Criteria scored per kind

| Kind | Scored (not a full WCAG list) |
| ---- | ----------------------------- |
| Audio, video | 1.1.1, 1.2.1, 1.2.2, 1.2.3, 1.2.5, 1.4.2, 4.1.2 |
| Image, chart, map, diagram | 1.1.1, 1.4.1, 1.4.11, 2.1.1, 4.1.2 (4.1.2 only when interactive) |
| Embed (`st.iframe`, `st.pdf`) | 1.1.1 (pdf), 2.1.1, 2.4.3, 4.1.2 |
| Table, dataframe, data editor | 1.1.1 (dataframe non-text cells), 1.3.1, 2.1.1, 2.1.2, 2.4.7, 2.5.7, 3.3.2 (`data_editor`), 4.1.2 (dataframe / `data_editor`; not static `st.table`), 4.1.3 |

Skip a criterion when the command cannot fail it (for example, audio-only has no captions row; static images have no 1.2.x rows). Toolbar naming (4.1.2) for element toolbars is covered under [Shared chrome](#shared-chrome).

## Known library gaps

Recurring gaps that need a Streamlit (or package) change. Sorted Level A then Level AA, and by success-criterion number within each level. Each item is a candidate product-spec section.

Use **Library blocks** only when an author cannot meet the criterion with any public Streamlit composition. Missing convenience parameters (for example, no `transcript=` on `st.audio`) are **Author must** if the author can still place an equivalent elsewhere on the page.

### Level A

- **1.1.1 / 1.3.1 Dataframe non-text cells and canvas relationships are incomplete.** The Glide Data Grid library that renders `st.dataframe` paints a limited `grid` / `columnheader` / `gridcell` accessibility tree. Image / chart / progress cells are canvas-painted, and opening an image cell uses `ImageCellEditor` (`<img>` with no author `alt`). Nearby page text cannot associate a name with that cell.
- **2.1.1 Dataframe ⋮ column menu is mouse-only.** `st.dataframe` / `st.data_editor`. [#13332](https://github.com/streamlit/streamlit/issues/13332). Cell navigation is keyboard-operable; header sort and the column menu are not until the menu can be opened from the keyboard.
- **2.1.1 PDF scrollport and in-document links are not keyboard-operable.** `st.pdf` (`streamlit-pdf`). Zoom buttons exist, but the overflow scroll host has no `tabIndex`. The package also sets `renderAnnotationLayer={false}`, so links inside the PDF cannot be reached.

### Level AA

- **2.5.7 Dataframe column resize / reorder, fill handle, and height handle are drag-only.** The column menu offers single-pointer Autosize and Pin. Arbitrary resize/reorder, fill-down, and the container height drag (`Resizable`) have no non-dragging single-pointer equivalent. Fill-down has Ctrl/Cmd+D (`downFill`) for keyboard under 2.1.1; that does not clear 2.5.7.
- **4.1.3 Dataframe status messages.** No `aria-live` for sort, search, edit, or lazy-load feedback.

### Author convenience (not Library blocks)

- **`st.audio` has no `transcript` parameter.** Authors can still meet 1.2.1 by placing a transcript next to the player (`st.markdown` / `st.write`). A dedicated parameter would be a usability improvement, not a conformance unblock.
- **`st.video` hardcodes `<track kind="captions">`.** Authors can meet 1.2.5 with a video whose soundtrack already includes description. A `descriptions` track path would be convenience; browser support for `kind="descriptions"` is weak. YouTube audio description is the embed platform — **Not this surface**.
- **Plotly modebar Fullscreen names are not chart-specific.** The modebar button already has `name`/`title` (`"Fullscreen"` / `"Close fullscreen"`), which supplies a name and state for 4.1.2. WCAG does not require globally unique control names. Threading `alt` into the modebar label would improve distinguishability when multiple charts appear on one page — a usability follow-up, not a proven 4.1.2 library block.

## Shared chrome

**Streamlit element toolbar** ([#17211](https://github.com/streamlit/streamlit/pull/17211)): Fullscreen, Download, and related actions compose an accessible name from non-blank element `alt`, or from a single-image caption (plain text). Without that context the label stays generic (e.g. `"Fullscreen"`). Hit targets are at least `max(1.5rem, 24px)` for WCAG 2.5.8. Distinctive names still require the author to supply `alt` or caption — **Author must**.

## Media

Scored: 1.1.1, 1.2.1–1.2.3, 1.2.5, 1.4.2, 4.1.2 (see [criteria scored per kind](#criteria-scored-per-kind)). Skip criteria the command cannot fail.

### st.audio

[#16568](https://github.com/streamlit/streamlit/pull/16568). `alt` sets `aria-label` on the player. Omitted `alt` leaves the player unnamed. Native `<audio controls>`. No 1.2.2 / 1.2.3 / 1.2.5 rows (those apply to synchronized or video media, not audio-only).

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 1.1.1 Non-text Content | A | Author must | `alt` is the hook. Empty means no name. |
| 1.2.1 Audio-only (Prerecorded) | A | Author must | No `transcript` parameter, but the author can place a transcript next to the player. |
| 1.4.2 Audio Control | A | Library meets | Native `controls` exposes pause/stop/volume for keyboard and pointer (`Audio.tsx`). Autoplay uses the same player. |
| 4.1.2 Name, Role, Value | A | Author must | Name comes from `alt`. Role is the native player. |

### st.video

[#16568](https://github.com/streamlit/streamlit/pull/16568). `alt` sets `aria-label` on the native player, and the YouTube iframe `title` when set. Otherwise the YouTube title is the embed URL. Native path uses `<video controls>` and maps `subtitles` to `<track kind="captions">`.

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 1.1.1 Non-text Content | A | Author must | Same as audio. |
| 1.2.1 Audio-only and Video-only (Prerecorded) | A | Author must | For video-only files, the author can supply a text alternative on the page. |
| 1.2.2 Captions (Prerecorded) | A | Author must (native) | Native: `subtitles` → `kind="captions"` (`Video.tsx`). Author must supply tracks. YouTube: captions are the embed platform / upload — **Not this surface**; Streamlit does not apply `subtitles` to YouTube. |
| 1.2.3 Audio Description or Media Alternative (Prerecorded) | A | Author must | Synchronized video: author can provide a text alternative on the page. |
| 1.4.2 Audio Control | A | Library meets (native) | Native `controls` satisfy pause/stop. YouTube player chrome is **Not this surface** (embed). |
| 4.1.2 Name, Role, Value | A | Author must | YouTube without `alt` is named with a URL, which is a name but a poor one. That is author content. |
| 1.2.5 Audio Description (Prerecorded) | AA | Author must (native) | Native: author can ship a video whose soundtrack already includes description. A separate `kind="descriptions"` track is not available (`Video.tsx` hardcodes captions); browser support for that track kind is weak. YouTube: **Not this surface**. |

## Charts, maps, and diagrams

Scored: 1.1.1, 1.4.1, 1.4.11, 2.1.1, 4.1.2. Streamlit Toolbar naming: see [Shared chrome](#shared-chrome). Plotly modebar Fullscreen naming is an [author convenience](#author-convenience-not-library-blocks) follow-up, not a proven 4.1.2 block.

### st.altair_chart / st.vega_lite_chart

[#17041](https://github.com/streamlit/streamlit/pull/17041). `alt` → Vega-Lite `description` → `aria-label` on `role="graphics-document"`.

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 1.1.1 Non-text Content | A | Author must | `alt` enables a name. Dense charts may still need a longer text alternative. |
| 1.4.1 Use of Color | A | Author must | Author owns Vega-Lite encodings; Streamlit only themes ranges. |
| 2.1.1 Keyboard | A | Not this surface | Vega-embed actions disabled; Streamlit Toolbar replaces them. Interval/point selection is Vega’s surface when used. |
| 4.1.2 Name, Role, Value | A | Author must | Applies when `on_select` makes the chart interactive (widget role). Static chart name is under 1.1.1. Toolbar via Shared chrome. |
| 1.4.11 Non-text Contrast | AA | Author must | Plot marks needed to understand the chart are author encodings (subject to 1.4.11 exceptions). |

### st.line_chart / st.bar_chart / st.area_chart / st.scatter_chart

[#17069](https://github.com/streamlit/streamlit/pull/17069). Same Vega sink as altair/vega_lite. These commands build the Altair spec themselves. They do **not** accept `on_select` (unlike `st.altair_chart` / `st.vega_lite_chart`).

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 1.1.1 Non-text Content | A | Author must | `alt` is the chart-level name hook. |
| 1.4.1 Use of Color | A | Author must | Defaults encode series with color + legend/tooltip (`built_in_chart_utils.py`). Authors can rebuild with `st.altair_chart` non-color encodings. |
| 2.1.1 Keyboard | A | Not this surface | Same Vega-embed / Toolbar split as Altair path (no selection widget API on these commands). |
| 1.4.11 Non-text Contrast | AA | Author must | Plot marks needed to understand the chart are author encodings (subject to 1.4.11 exceptions). |

### st.echarts_chart

[#17080](https://github.com/streamlit/streamlit/pull/17080). `alt` → ECharts `aria.label.description` → `aria-label` on `role="img"`.

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 1.1.1 Non-text Content | A | Author must | `alt` overrides the generated / author description. A vague `alt` can be a regression vs the generated label. |
| 1.4.1 Use of Color | A | Author must | Author owns option encodings. |
| 2.1.1 Keyboard | A | Not this surface | Canvas / ECharts chrome; Streamlit Toolbar is separate. |
| 1.4.11 Non-text Contrast | AA | Author must | Plot marks needed to understand the chart are author encodings. Toolbox chrome contrast is ECharts (+ optional Streamlit theme) — **Not this surface**. |

### st.plotly_chart

[#17081](https://github.com/streamlit/streamlit/pull/17081). Non-blank `alt` sets `role="figure"` + `aria-label`. `role="img"` avoided so the modebar stays operable.

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 1.1.1 Non-text Content | A | Author must | `alt` is the chart-level name hook. Dense charts may still need a longer text alternative. |
| 1.4.1 Use of Color | A | Author must | Author owns figure encodings. |
| 2.1.1 Keyboard | A | Not this surface | Modebar and selection (`dragmode`) are Plotly’s surface. Streamlit wires `on_select` but does not add keyboard selection paths. |
| 4.1.2 Name, Role, Value | A | Author must | Name from `alt`; role is `figure` when named. Modebar Fullscreen already has `name`/`title`; chart-specific labeling is [author convenience](#author-convenience-not-library-blocks). Plotly does not render Streamlit `Toolbar`. |
| 1.4.11 Non-text Contrast | AA | Author must | Plot marks needed to understand the chart are author encodings. Modebar chrome is Plotly — **Not this surface**. |

### st.graphviz_chart

[#17085](https://github.com/streamlit/streamlit/pull/17085). Non-blank `alt` sets `role="figure"` + `aria-label`. `role="img"` avoided so SVG `<a>` nodes stay operable.

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 1.1.1 Non-text Content | A | Author must | `alt` is the chart-level name hook. |
| 1.4.1 Use of Color | A | Author must | Author owns DOT / styling. |
| 2.1.1 Keyboard | A | Not this surface | SVG link focus is GraphViz/browser; Streamlit keeps links in the tree. |
| 4.1.2 Name, Role, Value | A | Author must | Name from `alt`; role is `figure` when named. Toolbar via Shared chrome. |
| 1.4.11 Non-text Contrast | AA | Author must | Graph marks needed to understand the diagram are author DOT / styling (subject to 1.4.11 exceptions). |

### st.map / st.pydeck_chart

[#17086](https://github.com/streamlit/streamlit/pull/17086). Shared `DeckGlJsonChart`. Non-blank `alt` sets `role="figure"` + `aria-label`.

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 1.1.1 Non-text Content | A | Author must | `alt` is the map-level name hook. Canvas content still has no data text alternative (dense maps may need author-provided data elsewhere). |
| 1.4.1 Use of Color | A | Author must | Point/layer color is author data or pydeck layers. |
| 2.1.1 Keyboard | A | Not this surface | Pan/zoom are deck.gl / Mapbox. Streamlit mounts themed zoom buttons; no keyboard-pan shim. |
| 4.1.2 Name, Role, Value | A | Author must | Name from `alt`; role is `figure` when named. Toolbar via Shared chrome. |
| 1.4.11 Non-text Contrast | AA | Author must | Point/layer marks needed to understand the map are author data. Mapbox `NavigationControl` is restyled with theme tokens but remains upstream chrome — assess that control separately. |

### st.mermaid_chart

[#17096](https://github.com/streamlit/streamlit/pull/17096). Non-blank `alt` → `%% stAlt:`. The frontend reads that marker and sets `<img alt>`. Markdown fences inside `st.markdown` are out of scope for the Python parameter.

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 1.1.1 Non-text Content | A | Author must | `alt` (or author `accTitle`/`accDescr`) names the diagram image. |
| 1.4.1 Use of Color | A | Author must | Author owns diagram styling. |
| 2.1.1 Keyboard | A | Library meets | The diagram is a static `<img>` with no keyboard interaction; toolbar actions (Fullscreen, Download, Copy) are covered under Shared chrome. |
| 1.4.11 Non-text Contrast | AA | Author must | Diagram pixels needed to understand the content are author styling (subject to 1.4.11 exceptions). |

## Data

Scored: 1.1.1 (dataframe non-text cells), 1.3.1, 2.1.1, 2.1.2, 2.4.7, 2.5.7, 3.3.2 (`data_editor`), 4.1.2 (dataframe / `data_editor`), 4.1.3.

### st.table

[#17095](https://github.com/streamlit/streamlit/pull/17095). Non-blank `alt` sets `aria-label` on the native `<table>`. Scroll wrappers keep `aria-label="Scrollable table"`. No 1.1.1 row (a table of text is text). No 3.3.2, 4.1.2, 2.5.7, or 4.1.3 rows — static tables do not require user input, have no drag-only gestures, and emit no status messages. The [approved alt-text spec](../specs/2026-09-14-element-alt-text/product-spec.md) treats static `st.table` as outside 4.1.2 (`alt` remains a findability aid, not a required name for that criterion).

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 1.3.1 Info and Relationships | A | Author must | Native `<th scope="col">` / `scope="row"` for typical DataFrames (`Table.tsx`). Author owns header content. Known limits: MultiIndex headers are not fully expressed in table semantics. Styler captions render as a sibling `<div>`, not `<caption>` — a library HTML limit. |
| 2.1.1 Keyboard | A | Library meets | Scrollable tables get `tabIndex={0}` + `role="region"`; otherwise static text with no library-owned controls. |
| 2.1.2 No Keyboard Trap | A | Library meets | No interactive trap on a static/scrollable table. |
| 2.4.7 Focus Visible | AA | Library meets | Focusable scroll region uses normal focus styling; no known library gap for this command. |

### st.dataframe / st.data_editor

[#17125](https://github.com/streamlit/streamlit/pull/17125). Shared Glide grid. Non-blank `alt` sets `role="region"` + `aria-label` on **`stDataFrameResizable`**. Never `role="img"`. `st.dataframe` is in scope for 4.1.2 as a keyboard-navigable grid. 3.3.2 applies to `st.data_editor` (user input); read-only `st.dataframe` naming is findability via `alt` / 4.1.2.

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 1.1.1 Non-text Content | A | Library blocks | Text cells are text. Non-text cells (e.g. `ImageColumn`) are canvas-painted (`GridCellKind.Image`); opening a cell uses `ImageCellEditor`, an `<img>` with no `alt`. Nearby markdown cannot associate a name with that cell, unlike `st.audio` / `st.pdf` page-level alternatives. Same canvas limit as 1.3.1. |
| 1.3.1 Info and Relationships | A | Library blocks | The Glide Data Grid library that renders `st.dataframe` paints a limited accessibility tree; non-text cells and deeper relationships remain incomplete. Authors cannot fix the canvas tree. |
| 2.1.1 Keyboard | A | Library blocks | Cell navigation is keyboard-operable. Header sort runs from header click and from Sort in the column menu; the menu opens only from pointer (`onHeaderMenuClick`), so sort, pin, and the rest of the menu stay pointer-only ([#13332](https://github.com/streamlit/streamlit/issues/13332)). |
| 2.1.2 No Keyboard Trap | A | Library meets | Streamlit leaves Glide's focus trap off, so Tab can leave the grid. Overlay focus has no end-to-end coverage. |
| 3.3.2 Labels or Instructions | A | Author must | For `st.data_editor`, `alt` is the grid-level name hook when one is needed beyond visible headers. |
| 4.1.2 Name, Role, Value | A | Author must | Grid-level name from `alt`; Glide keeps `role="grid"` on the canvas. Toolbar via Shared chrome. |
| 2.4.7 Focus Visible | AA | Library meets | Glide `drawFocusRing` defaults true (Streamlit does not disable); menus use `:focus-visible` + theme focus ring. |
| 2.5.7 Dragging Movements | AA | Library blocks | Arbitrary column resize/reorder stay drag-only. The column menu offers single-pointer Autosize and Pin. Fill-down has Ctrl/Cmd+D (`downFill`) for keyboard under 2.1.1; a non-dragging pointer alternative is still required for 2.5.7. The container height handle (`Resizable`, on unless the grid is in a horizontal layout or content-width outside the root) is also drag-only. |
| 4.1.3 Status Messages | AA | Library blocks | No `aria-live` for sort/search/edit/lazy-load feedback. |

## Embeds

Scored: 2.1.1, 2.4.3, 4.1.2 (plus 1.1.1 for `st.pdf` viewer vs page content).

### st.iframe

[#17040](https://github.com/streamlit/streamlit/pull/17040). `alt` sets the iframe `title`. Public `tab_index` maps to `tabIndex`.

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 2.1.1 Keyboard | A | Author must | Streamlit adds no frame chrome. For `srcdoc` / authored HTML, keyboard operation inside the document is the author's. Third-party page chrome is **Not this surface**. |
| 2.4.3 Focus Order | A | Author must | Optional `tab_index` controls whether/when the frame is in the tab order (`iframe.py` / `IFrame.tsx`). Default keeps document order. Inner focus order: **Author must** for authored documents; third-party pages **Not this surface**. |
| 4.1.2 Name, Role, Value | A | Author must | The frame can be named. Fallback `"st.iframe"` fails an audit only when the author omits `alt`. |
| Inner document | — | Author must | `srcdoc` and authored pages are author content. Third-party / cross-origin document internals are **Not this surface** for a Streamlit product-spec fix, but still count toward the hosting app's accessibility. |

### st.pdf

[#17118](https://github.com/streamlit/streamlit/pull/17118) + `streamlit-pdf` 2.1.0. Non-blank `alt` → viewer `aria-label` + `role="region"`. Names the **viewer**, not PDF page content.

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 1.1.1 Non-text Content | A | Author must | PDF page content is not exposed (`streamlit-pdf` 2.1.0 sets `renderTextLayer={false}` and `renderAnnotationLayer={false}`). Authors can place a text alternative on the page, the same way as `st.audio` 1.2.1. |
| 2.1.1 Keyboard | A | Library blocks | Zoom buttons exist in the package, but the overflow scroll host is not focusable (`tabIndex` missing) — keyboard users cannot operate the scrollport. The package also sets `renderAnnotationLayer={false}`, so in-document links are not keyboard-operable. Fix lives in `streamlit-pdf`. |
| 2.4.3 Focus Order | A | Library meets | Viewer sits in DOM order; there is no `tab_index` API (unlike iframe). Page-canvas focus is **Not this surface**. |
| 4.1.2 Name, Role, Value | A | Author must | Name from `alt` on the viewer root. |

## Images

Scored: 1.1.1, 1.4.1, 1.4.11, 2.1.1, 4.1.2 (interactive / linked only).

### st.image / st.pyplot

[#17136](https://github.com/streamlit/streamlit/pull/17136) / [#17137](https://github.com/streamlit/streamlit/pull/17137). Keyword-only `alt`; decorative `alt=""` allowed; linked-image name = caption → alt → URL. Toolbar naming: see [Shared chrome](#shared-chrome).

| Criterion | Level | Bucket | Note |
| --------- | ----- | ------ | ---- |
| 1.1.1 Non-text Content | A | Author must | `alt` / decorative `""` is the hook. Omitted `alt` leaves a detectable missing attribute. Static images fall under 1.1.1, not 4.1.2. |
| 1.4.1 Use of Color | A | Author must | Meaning-via-color is author pixels / matplotlib output. |
| 2.1.1 Keyboard | A | Library meets | Static images have no keyboard-only functionality. Linked images use a native `<a>` (keyboard-operable). Toolbar actions are under Shared chrome. |
| 4.1.2 Name, Role, Value | A | Author must | Applies when interactive: `st.image(link=...)` names the anchor (caption / alt / URL). Static images: not applicable (covered by 1.1.1). |
| 1.4.11 Non-text Contrast | AA | Author must | Graphic contrast of content needed to understand the image is author pixels / matplotlib output (subject to 1.4.11 exceptions). |
