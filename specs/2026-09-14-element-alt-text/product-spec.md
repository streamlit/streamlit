---
author: mayagbarnes
created: 2026-09-14
---

# Alt text for images, charts, media, and data elements

## Summary

Add a keyword-only `alt` parameter to the 18 display commands with no author-facing way to
supply an accessible name: images, media players, charts, maps, dataframes, and tables.
Authors write a short plain-text description and Streamlit maps it to whichever attribute
is correct for that element.

Three of the 18 have a partial mechanism today, none of it a parameter: `st.mermaid_chart`
honors `accTitle` / `accDescr` directives written into the diagram source, and `st.altair_chart` /
`st.vega_lite_chart` surface a `description` set inside the Vega spec. The other 15 have
nothing.

```python
st.image("q3-revenue.png", alt="Bar chart showing Q3 revenue up 15% year over year")
st.dataframe(df, alt="Top 20 customers by revenue")
st.bar_chart(df, alt="Revenue by product line, highest for Enterprise")
```

`alt` is never displayed. It is independent of widget `label`, image `caption`, and
`help`, and it is additive and opt-in: omitting it leaves an app's pixels unchanged. One
accessibility-tree change lands with no author action, fixing a current defect: `st.image`'s index
`alt` goes away. See the [Checklist](#checklist).

This closes [#8563](https://github.com/streamlit/streamlit/issues/8563), our most-upvoted
open issue. It also ratifies the `alt` name proposed for `st.audio` and `st.video` in
[#16568](https://github.com/streamlit/streamlit/pull/16568).

## Outstanding decisions

1. **[The parameter name](#the-parameter-name)** — **recommend `alt`**, on all 18 commands.
   Effectively permanent once shipped, and `alt_text` has peer precedent, so worth an explicit call.
2. **[What an image gets with no `alt`](#what-an-image-gets-with-no-alt)** — **recommend emitting no
   `alt` attribute.** All three candidate answers are non-conforming for a typical call, so the
   choice is which failure we prefer: one a scanner keeps flagging, or one nothing can detect.
3. **[Lenient or strict list pairing on `st.image`](#api)** — **recommend lenient**: a short `alt`
   list leaves later images unlabelled rather than raising. That diverges from `caption` on the same
   command, which raises — an intra-command inconsistency of the kind principle 11 guards against,
   while principle 23 argues for raising. Reasonable to land either way.

Three smaller choices are made inline rather than listed, and are called out where they occur:
`alt` overwrites an author's Vega-spec `description` when both are set; `alt=""` means decorative
on images and warns everywhere else; and `alt` takes plain text rather than markdown, the one
deliberate exception to how markdown is handled elsewhere.

## Problem

Streamlit apps are often the UI for internal tools, public dashboards, and government or
healthcare workflows that must meet [WCAG 2.1](https://www.w3.org/TR/WCAG21/) Level AA,
Section 508 in the US, or EN 301 549 for European public-sector procurement. The latter
two incorporate WCAG AA by reference, so one target covers all three. [SC 1.1.1 Non-text
Content](https://www.w3.org/TR/WCAG21/#non-text-content) (Level A) requires a text
alternative for non-text content. Streamlit offers authors no parameter for one on any of
the 18 commands, and no mechanism at all on 15 of them — see the Summary for the three
partial exceptions, none of which is discoverable from a command signature.

### User requests

- [#8563](https://github.com/streamlit/streamlit/issues/8563) — the ask itself. 272 👍, our
  most-upvoted open issue
- [#16148](https://github.com/streamlit/streamlit/issues/16148) — Fullscreen buttons announce
  without element context. Adjacent but [out of scope](#out-of-scope-future-work)
- [#12873](https://github.com/streamlit/streamlit/issues/12873) — decorative Streamlit _chrome_.
  Complementary: that is our UI, this is the author API for content
- [#8399](https://github.com/streamlit/streamlit/issues/8399) — broader web accessibility.
  Alt text is one slice
- [#10119](https://github.com/streamlit/streamlit/issues/10119) — a longer _visible_ description
  in fullscreen. Different audience, and it contests the `description` name — see
  [Out of Scope](#out-of-scope-future-work)

Three prior attempts went unmerged, and the reasons matter for this one.
[#10734](https://github.com/streamlit/streamlit/pull/10734) stalled on where the string
should land — the problem this spec exists to settle.
[#15316](https://github.com/streamlit/streamlit/pull/15316) went stale without review.
[#16568](https://github.com/streamlit/streamlit/pull/16568) is the cautionary one: it was
**approved and then closed unmerged** on 2026-09-12. An agreed design is not
sufficient: the phases need owners, or this becomes the fourth attempt.

### What the community asked for

The #8563 thread is short, but it did useful work on four points:

- **Should** `caption` **become the alt text when** `alt` **is omitted?** [hey-aw asked
  for that](https://github.com/streamlit/streamlit/issues/8563#issuecomment-2123267665);
  [moniquesch pushed
  back](https://github.com/streamlit/streamlit/issues/8563#issuecomment-2247804748) — "The
  caption and the alt text are for different purposes... we need to be able to use both
  effectively." We follow their reasoning; see [Caption vs. `alt`](#caption-vs-alt)
- **Should a missing** `alt` **warn?** Also asked by hey-aw. We decline for v1 — it would
  fire on every existing app on upgrade — and list it in [Out of
  Scope](#out-of-scope-future-work) as a revisit rather than a dismissal
- **Which name?** [jrieke narrowed
  it](https://github.com/streamlit/streamlit/issues/8563#issuecomment-3774340477) to
  `alt`/`alt_text` vs. `accessible_description`, pending accessibility guidance. [The parameter-name
  decision](#the-parameter-name) closes it
- **LLM-generated alt text** — raised as an aside in the issue body ("even though this
  might be a cool LLM application 😉") and not pursued by anyone since

### What authors get today

| Element                                                              | Today                                                                                                                                                                                  |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `st.image`                                                           | `<img alt="0">` — the array index. A screen reader announces "0, image". **Worse than no alt.** For a *linked* image, caption already names the link, so the two are not fully independent today                                                                                         |
| `st.pyplot`                                                          | Renders through the image path, so it inherits the index bug                                                                                                                           |
| `st.audio` / `st.video`                                              | No accessible name. YouTube embeds fall back to the raw URL as the iframe `title`, and they still will after phase 1 — an iframe must have a title, so `alt` replaces it only when set |
| `st.line_chart`, `st.bar_chart`, `st.area_chart`, `st.scatter_chart` | Per-datapoint labels from Vega, but no chart-level name and no way to set one — these commands build the spec themselves                                                               |
| `st.altair_chart`, `st.vega_lite_chart`                              | Same, except an author who hand-writes `description` into the spec does get a chart-level name                                                                                         |
| Plotly, graphviz                                                     | Nothing — an unlabeled region                                                                                                                                                          |
| `st.map`, `st.pydeck_chart`                                          | Nothing, and no text alternative of any kind behind the canvas                                                                                                                         |
| `st.dataframe` / `st.data_editor`                                    | Cells are navigable, but nothing says what the data _is_                                                                                                                               |
| `st.table`                                                           | Correct table semantics. No author-facing name, and when scrollable a hardcoded `aria-label="Scrollable table"` the author cannot change                                               |
| `st.mermaid_chart`                                                   | A generic `"Mermaid flowchart"` unless the author writes diagram directives                                                                                                            |

Workarounds are all poor. A heading above the chart is visible to everyone and not
programmatically tied to it; CSS injection depends on private DOM; a custom component
discards everything Streamlit provides.

### Use cases

1. **Compliance** — a public-sector dashboard must pass an audit, and its images and
   charts fail 1.1.1 with no author-side remedy
2. **Screen-reader users** — a blind analyst needs to know a chart is "Monthly revenue by
   region, 2024", not an unlabeled graphic
3. **Decorative images** — a divider should be skipped, not announced as `"0"`
4. **Finding an element** — naming a dataframe lets a screen-reader user locate it among other
   page content

### Where `alt` does not apply

The commands that get it are listed under [Commands in scope](#commands-in-scope). This
section is the converse — why the parameter stops there.

`alt` fills the gap for **non-text display elements that have no** `label` — and only
those. Widgets, `st.metric`, expanders, and tabs are already named through `label`, so
adding `alt` there would duplicate `label` for no gain — "Start Minimal" (principle 4), since every
parameter is a maintenance burden. Text elements _are_ the text alternative and need nothing. `alt` is invisible, which
is what distinguishes it from `caption` (visible, `st.image` only) and `help` (a tooltip).

`st.data_editor` is the one input command in scope: it accepts edits but has no `label`,
so `alt` is the smallest available fix. A visible `label` for grids is a separate, larger
feature.

## Proposal

### The parameter name

Four candidates. Two came from the maintainer discussion in #8563, and one has direct peer
precedent.

**Option 1:** `alt` ✅ PREFERRED

```python
st.image("chart.png", alt="Line chart of monthly revenue")
```

- Pros: Short; the term authors and WCAG both use ("alt text"); familiar from HTML, React,
  and markdown `![alt](url)`; one name across all 18 commands
- Cons: HTML `alt` exists only on `<img>`, so using it for charts and tables is a slight
  stretch

**Option 2:** `alt_text`

```python
st.image("chart.png", alt_text="Line chart of monthly revenue")
```

- Pros: Explicit for authors who do not know HTML. Named by jrieke alongside `alt`, and it
  is what both prior attempts used
  ([#10734](https://github.com/streamlit/streamlit/pull/10734),
  [#15316](https://github.com/streamlit/streamlit/pull/15316)). **Gradio ships exactly this** on
  its [Image component](https://www.gradio.app/docs/gradio/image), the closest peer precedent we
  have — though note it resolves the _other_ decision the opposite way ("If not provided, the image
  is treated as decorative", i.e. Option 3), and has no multi-image case, so it says nothing about
  the list behavior
- Cons: Longer, and redundant against the phrase itself — "alt" already means "alt text",
  so `alt_text` reads as "alt text text". Still image-flavored, so it does not solve
  Option 1's objection

**Option 3:** `accessible_description`

- Pros: Plain English, and the direction the original internal proposal leaned
- Cons: Actively misleading. Assistive technology treats a short **name** and a long
  **description** as different things, announcing the first immediately and unskippably
  and the second last and deferrably. What we are adding is a name.
  Note that principle 8 (Semantic Names Over Geeky Names) actually favours this option — its own
  bad examples are HTML-derived names like `st.h1`. The counter is principle 7: `alt` is the term
  authors and WCAG already use, so it is the standardized vocabulary rather than the geeky one

**Option 4:** `alt` **on** `st.image`**,** `aria_label` **elsewhere**

- Pros: Technically accurate per element
- Cons: Leaks the implementation into the API and forces authors to know which attribute
  we use. Two names for one concept cuts against principles 7 and 5

**Recommendation: Option 1.** `alt_text` is the closest call — a competitor ships it and both
prior Streamlit attempts used it — but `alt` is shorter, is the noun authors actually say,
and matches markdown's own attribute. The name is effectively permanent once shipped
(principles 4 and 25), which is why it is worth settling once here rather than per PR.

**Why no markdown:** principle 24 covers text that *is displayed*, so `alt` sits outside it rather than departing from it. `alt`
takes plain text, because it is not a display surface — markdown would be announced
literally, so `**bold**` reads as "asterisk asterisk bold". This matches how markdown's
own `![alt](url)` behaves.

### Why `alt` stays short

`alt` holds **one short sentence**. The reason that matters is worth reviewers' attention,
because it is the constraint authors are most likely to break. Assistive technology
reads an accessible name before the content it names, and no spec constrains how much of it is
read or whether a user can interrupt — that is platform and AT configuration. We have not tested
it. What we can say without a source is the design intent: `alt` occupies the _name_ slot, names
are meant to identify rather than explain, and a 40-word name is not identifying anything. So the docs say "roughly one
sentence; put longer context in `caption` or nearby markdown."

**The case for deferring is "Start Minimal" (principle 4), not a standards preference.** A
second parameter on 18 commands, plus a description region per element, for a use case we
have not yet observed. That reason stands on its own.

Recording what the standards actually say, because earlier drafts of this section leaned on
them in ways they do not support:
[ARIA15](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA15) is titled "Using
`aria-describedby` to provide descriptions of images" — it _sanctions_ the exact mechanism a
future `description` parameter would use. Its example points at visible text and it notes an
advantage there ("available to all, including sighted people who do not have assistive
technology"), but that is a preference about the _target_, not a rule against the mechanism.
So WCAG does not argue against `description`; we are simply not building it yet.

Authors are not blocked meanwhile, though the workaround below is a workaround rather than a
conformant technique — [G74](https://www.w3.org/WAI/WCAG21/Techniques/general/G74) requires
the short alt to _point to_ the longer text, which this does not do:

```python
st.line_chart(df, alt="Monthly revenue by region, 2024")
st.caption("Revenue grew through Q1-Q3, peaking in September, then fell 12% in Q4.")
```

Adding a `description` parameter later stays purely additive.

**Known gap:** nothing enforces brevity. An author can write 200 words and get exactly the
problem above. Docs are the only defense in v1; if that proves insufficient, a length
warning is additive and can follow.

### API

Keyword-only, optional, appended after each command's existing keyword-only parameters:

```python
alt: str | None = None  # 17 commands
alt: str | Sequence[str] | None = None  # st.image only
```

**Why `st.image` differs.** One call can render many images — it accepts a list, tuple, set, or
4-D array — so a single string cannot describe them all. A list applies **in sequence**:
`alt=["a", "b"]` with three images labels the first two and leaves the third with no
`alt`, landing it in the [no-`alt` behavior](#what-an-image-gets-with-no-alt). More values
than images raises, since that is unambiguously a mistake.

This is deliberately more lenient than `st.image`'s own `caption`, which raises on any
mismatch (`Cannot pair 2 captions with 3 images`). Two reasons: a missing `alt` is already
a defined, meaningful state, so a short list is coherent input rather than malformed; and
`st.radio`'s `captions` already works this way, applying in sequence with no length check.
The cost is real and worth naming — **a miscount becomes invisible.** Write two when you
meant three and the third image is silently unlabeled, which is the exact failure this
feature exists to fix. A reviewer could reasonably prefer `caption`'s strictness for that
reason.

`st.pyplot` takes a single string: one figure, one image.

| Value                                     | Meaning                                                                                                                                                                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `None` (default)                          | Not provided. Nothing is emitted and nothing changes, except for images — see [What an image gets with no `alt`](#what-an-image-gets-with-no-alt)                                                                          |
| Non-empty string                          | The description. Plain text. Leading and trailing whitespace is stripped — note this is new behavior, not inherited: `to_str` returns strings unchanged, and `label` does not strip either                                                                                                                                                                            |
| Whitespace-only                           | Treated as `""`, after stripping. Same handling as an empty string below                                                                                                                                                                |
| `""` on `st.image`                        | Decorative — the standard WCAG pattern, and a [sufficient technique](https://www.w3.org/WAI/WCAG21/Techniques/html/H67)                                                                                                                 |
| `""` anywhere else, including `st.pyplot` | Logs a warning and is then ignored, no attribute emitted. The warning mirrors `maybe_raise_label_warnings`, though the analogy stops there — an empty `label` is warned about but still forwarded. `st.pyplot` is excluded from the decorative reading because a plot is author data, so "decorative" is never a truthful claim about one           |
| `[""]` inside an `st.image` list          | Decorative for that one image; the same rule applied per element                                                                                                                                                                        |
| Non-string                                | Coerced with `to_str`, as `label` does, then stripped. Note this lets an author recreate the bug: `alt=0` becomes `"0"`, the F30 pattern we are removing. Author-chosen rather than Streamlit-imposed, so not validated, but worth a docstring warning |
| List shorter than the images              | Trailing images get no `alt` — see the note below                                                                                                                                                                       |
| List longer than the images               | Raises, mirroring the existing caption/image mismatch error                                                                                                                                                                             |

Two limits of positional pairing, both inherited from `caption` rather than introduced here:
`st.image` accepts a `set`, whose iteration order is arbitrary, so a list of `alt` values cannot be
reliably paired with one — pass a list or tuple if you are labelling. And a list of the right length
in the wrong order mislabels every image rather than leaving any unlabelled, which no validation can
detect. Both are worth a docstring note, since a wrong name is worse than a missing one.

### Commands in scope

| Group                  | Commands                                                                                                      | Where `alt` ends up                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Images                 | `st.image`, `st.pyplot`                                                                                       | The image's HTML `alt` attribute                                                                                                                                                       |
| Diagrams | `st.mermaid_chart` | Same — the diagram renders as an image. It has no proto of its own, so the wiring route is settled in phase 4 |
| Media                  | `st.audio`, `st.video`                                                                                        | An accessible label on the player; the frame title for YouTube embeds                                                                                                                  |
| Simple and Vega charts | `st.line_chart`, `st.bar_chart`, `st.area_chart`, `st.scatter_chart`, `st.altair_chart`, `st.vega_lite_chart` | Vega's own chart-description field. Where an author already set `description` in an Altair or Vega-Lite spec, `alt` wins — it is the documented parameter — and the override is logged |
| Other charts           | `st.plotly_chart`, `st.graphviz_chart`                                                                        | An accessible label on the chart                                                                                                                                                       |
| Maps                   | `st.map`, `st.pydeck_chart`                                                                                   | An accessible label on the map                                                                                                                                                         |
| Data grids             | `st.dataframe`, `st.data_editor`                                                                              | An accessible label on the grid                                                                                                                                                        |
| Tables | `st.table` | An accessible label on the `<table>` itself. The existing `"Scrollable table"` label stays put — it describes the scroll affordance, not the content, so the two do not compete |

Authors write one parameter and Streamlit picks the attribute; nobody needs to know which
one.

### Caption vs. `alt`

Independent, and neither becomes the other's value. One existing exception worth knowing: for a
**linked** image, `ImageList.tsx` already uses the caption as the anchor's `aria-label`, so a linked
captioned image is named by its caption today while the `<img>` still carries the index. Phase 6 has
to settle what that announces once `alt` exists. `st.image` is the only command
with both.

|          | `caption`                                                   | `alt`                                                      |
| -------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| Visible  | Yes                                                         | No                                                         |
| Purpose  | Context beside the image ("Figure 1: Monthly active users") | What the image shows ("Line chart rising from 12k to 48k") |
| Markdown | Yes                                                         | No                                                         |

When both are set, each does its own job.

**A caption changes nothing about the image's own** `alt`**.** With no `alt`, the image gets
no attribute whether or not it is captioned, per [What an image gets with no
`alt`](#what-an-image-gets-with-no-alt). Marking a captioned image decorative instead
would assert it is "not intended for the user" — a claim only the author can make — and
the [W3C decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/) branch
that would justify it requires the image be redundant to _real text nearby_, which
contradicts this spec's own position that a caption is not a description of the image.

Worth noting because it is sometimes read the other way: moniquesch's #8563 comment
proposes using caption **and** a non-empty alt together, which is what the table above
describes — not the decorative treatment.

### What an image gets with no `alt`

**Two of the three answers are named WCAG failures; the third makes a claim we cannot make on the
author's behalf.** That is what makes this a decision rather than a lookup.

- [F30](https://www.w3.org/WAI/WCAG21/Techniques/failures/F30) fails a _placeholder_:
  "placeholder text such as ' ' or 'spacer' or 'image' or 'picture'", and "programming
  references that do not convey the information or function... such as 'picture 1',
  'picture 2' or '0001', '0002'".
- [F65](https://www.w3.org/WAI/WCAG21/Techniques/failures/F65) fails an _omission_: no
  `alt`, with no `aria-label`, `aria-labelledby`, or `title` standing in for it.

[H67](https://www.w3.org/WAI/WCAG21/Techniques/html/H67) is often cited as the escape hatch —
`alt=""` with no `title` is a _sufficient_ technique for 1.1.1, telling assistive tech the image
"can be safely ignored." But it is sufficient **only for a genuinely decorative image**: that is
the branch of 1.1.1 it sits under, and the only case its own description illustrates. Streamlit
cannot know whether an image is decorative, and most `st.image` calls are content.

So the honest position is that **all three options below are non-conforming for a typical
call.** They differ in how the non-conformance behaves:

**Option 1: emit no** `alt` **attribute** ✅ PREFERRED

- Pros: The failure is **detectable**. A scanner flags a missing `alt` and keeps flagging it until
  someone fixes it, which is the honest state — nobody has described the image
- Cons: An F65 failure by name. And
  [WebAIM](https://webaim.org/techniques/alttext/) holds that every image should carry an `alt`
  attribute even when empty. One mechanism it gives — a missing attribute sending screen readers to
  the filename or URL — is weak for us, since our media URLs are opaque hashes and that fallback is
  noise either way; but that answers one argument, not WebAIM's general rule

**Option 2: a generic** `"Image"`

- Pros: Tells the user an image is present
- Cons: An F30 failure by name, and the worse kind — it converts a detectable gap into a hidden
  one. Scanners see a populated `alt` and pass an image that conveys nothing

**Option 3: mark it decorative (`alt=""`)**

- Pros: Quiet, no scanner noise, and the only option that _can_ conform — but only for images that
  really are decorative
- Cons: For a content image it asserts something false on the author's behalf, and unlike the other
  two, nothing can detect it. Most Streamlit images are content

**Recommendation: Option 1**, on the grounds that a detectable failure gets fixed and an
undetectable one does not. The strongest argument against is worth stating plainly: a public-sector
dashboard chasing an audit may score _worse_ on an automated scan after this change, because
today's `alt="0"` populates the attribute while Option 1 leaves it absent. That is exactly use
case 1, so it deserves an answer rather than a footnote.

What F30 does settle is the _classification_ of today's `alt="0"` — it is squarely F30's
numbered-placeholder pattern. Which failure is worse is our own judgment: neither F30 nor F65 ranks
itself against the other, and neither discusses scanner detectability.

**This decision does not reach `st.mermaid_chart`.** Adding `alt` there prepends to a precedence
chain that already exists — `alt`, then the author's `accTitle` / `accDescr`, then Streamlit's
type-based fallback — so nothing has to be removed. Unlike `st.image`, where wiring `alt` forces a
replacement for `alt={index}`, mermaid's fallback is untouched by the parameter.

One rule to settle in that phase: `getAltText` currently *concatenates* `accTitle` and `accDescr`
rather than choosing between them, so `alt` should **replace** both when set rather than joining
them — matching how it overrides a Vega `description`.

Whether that fallback should exist at all is a question for the broader accessibility effort, not
this spec: it defaults to `"Mermaid diagram"`, which is close to F30's examples, but it was a
deliberate choice in the merged [mermaid spec](../2026-05-02-mermaid-chart/product-spec.md) and
markdown fences share it without getting a parameter.

This is the only change to an image's own `alt`; every other command is untouched when `alt` is
omitted. No author could have relied on `"0"`, so treat it as an accessibility bugfix rather than
an API break.

### Examples

```python
st.image("sunrise.jpg", alt="Sunrise over a mountain ridge")
st.image("divider.svg", alt="")  # decorative — st.image only

# caption is visible context; alt describes the visual. Never the same string.
st.image(
    "chart.png",
    caption="Figure 1: Monthly active users, 2024",
    alt="Line chart of monthly active users rising from 12k in January to 48k in December",
)

# one alt per image; a short list leaves the rest unlabeled (caption would raise)
st.image(["cat.png", "dog.png"], alt=["Orange tabby on a windowsill", "Black labrador"])

st.pyplot(fig, alt="Histogram of response times, right-skewed with a long tail past 2s")
st.audio("earnings.mp3", alt="Q2 2026 earnings call recording")
st.video("demo.mp4", alt="Product walkthrough, 3 minutes", subtitles="captions.vtt")
st.bar_chart(df, alt="Revenue by product line, highest for Enterprise")
st.map(df, alt="Delivery hubs across the Pacific Northwest")
st.dataframe(df, alt="Top 20 customers by revenue")
st.table(summary, alt="Quarterly KPI summary")
```

### Docs guidance

Per-command docstrings plus a short accessibility page. The points worth making, because
they are the mistakes authors will actually make: write `alt` as a replacement for the
visual, not a label for it; keep it to about a sentence and put longer context in
`caption` or nearby markdown; do not open with "Image of…", since assistive tech already
announces the role; never make `caption` and `alt` identical; describe a chart's takeaway
rather than its data points; name a dataframe rather than pasting it; and remember
`subtitles` is still what satisfies WCAG
1.2 for video — `alt` only names the player.

### Conformance scope

`alt` closes **SC 1.1.1 Non-text Content** (Level A) for images, charts, maps, and
diagrams _when an author provides it_, and **SC 4.1.2 Name, Role, Value** (Level A) for
the interactive case, `st.data_editor`.

It closes **neither** for `st.dataframe` or `st.table`: 1.1.1 covers non-text content and a table of
text is text, while 4.1.2 is scoped to interface components rather than static output. Naming a grid
aids findability; it is not a conformance fix. Nor does any of this make an app AA-conformant, so
release notes should say "add alt text to your images and charts" — not "Streamlit is now
accessible", and certainly not "accessible media".

Still unmet, and not this project:

- **SC 1.2.1 / 1.2.3** (Level A) — audio needs a transcript. A short name is not a text
  alternative, so `st.audio` cannot reach Level A through `alt` at all
- **SC 1.2.5** (AA) — subtitle tracks are hardcoded as captions, so authors cannot supply
  audio description. This also means `subtitles` currently over-claims
- **Full dataset access in grids** — the dataframe does expose a real, navigable table to
  assistive tech, but it is virtualized, so only the rendered window is present. `alt`
  names the grid; it does not make every row reachable. `st.table` remains the
  whole-dataset option

Choosing Streamlit's overall conformance target belongs to the broader accessibility effort, not
here. One framing from it drives the ordering below: where **Streamlit hardcodes something no author
can override**, that is a defect rather than an enhancement, and fixing it helps every existing app
instead of only the ones that adopt a new parameter.

### Rollout

Six phases, ordered by how much is unresolved rather than by user value. Each ships on its
own.

| Phase | Commands                                                            | Why here                                                                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `st.audio`, `st.video`                                              | Nothing unresolved, and the code exists — though only in [#16568](https://github.com/streamlit/streamlit/pull/16568), which was approved and then closed, so no proto in the tree carries `alt` yet. Reopening it lands 2 of the 18 first and fixes the parameter name in the codebase |
| 2     | The six simple and Vega charts                                      | Vega already supports a chart-level description natively, so this is the least work for the most commands. Cheap to confirm before committing to the order: setting `description` in an Altair spec reaches assistive tech today  |
| 3     | `st.plotly_chart`, `st.graphviz_chart`, `st.map`, `st.pydeck_chart` | All four need the same new wiring; decide once, apply four times                                                                                                                                                                  |
| 4     | `st.table`, `st.mermaid_chart`                                      | `st.table` is natively nameable. Mermaid is not as easy as it looks — no proto of its own, and its name is derived on the frontend, so this phase picks a wiring route                                                            |
| 5     | `st.dataframe`, `st.data_editor`                                    | One component covers both                                                                                                                                                                                                         |
| 6     | `st.image`, `st.pyplot`                                             | The headline ask, and the only structurally involved phase                                                                                                                                                                        |

Note that #16568 describes itself as the first slice of a "17-element" project while this spec
counts 18. The gap is unexplained — `st.mermaid_chart` predates that PR by two months, so it is not
the difference. Worth reconciling against the original element list rather than assuming.

The phases are very unevenly sized: 1 and 2 are close to free, and **phase 6 carries most of the
risk and most of the user-visible value.** The `st.image` index alt is a defect rather than new API, so it needs no API
sign-off and could ship ahead of the parameter, benefiting every existing app whether or
not its author adopts `alt`.

One implementation note worth stating once so it is not rediscovered per phase: **`alt` belongs in
the element-ID parameter hash but must be excluded from `key_as_main_identity`.** Excluding it
entirely would make two otherwise-identical selection-enabled grids collide as duplicate IDs;
including it in the keyed identity would reset a user's selection when an author edits a
description. `st.audio` and `st.video` are not an exception to that rule so much as a different mechanism: their
`id` is not an identity that keys state, it is the dedup key for the one-shot autoplay flag
(`Audio.tsx` reads `preventAutoplay` from it). So `alt` stays out of it entirely, as #16568 does.
That leaves a tension worth naming rather than hiding: because the same field also raises
`StreamlitDuplicateElementId`, excluding `alt` means two autoplaying players differing only in
their description still collide — and neither command accepts `key`, so an author cannot
differentiate them. That collision pre-dates this spec; the real fix is separating autoplay dedup
from element identity, which is out of scope here. Note also that these
IDs exist only where `on_select` is set, so the four simple chart commands and `st.map` are
unaffected.

Each phase gets Python and frontend unit tests plus an e2e test asserting the _computed_
accessible name rather than the presence of an attribute. Automated tests confirm a name
exists, not that it is useful — so each phase also wants a manual spot-check with a real screen
reader. That a short name actually helps is the one claim here we cannot verify automatically.

Two limits worth stating rather than implying the check is comprehensive: **NVDA is
Windows-only**, so someone with a Windows machine has to own that half, and JAWS — still
common in the enterprise and government settings this feature targets — is licensed and
unlikely to be covered at all.

## Out of Scope (Future Work)

- **`st.logo`** — app chrome rather than author content, with three wrapper variants and a second
  mapping needed for emoji logos: one command for a disproportionate share of the design. Its one
  real defect is separable and needs no API — an emoji logo in a single-page app has **no accessible
  name at all**, worth its own issue
- **`alt` on `st.write` and magic** — both dispatch to the explicit commands
- **A** `description` **parameter for long descriptions** — deferred on "Start Minimal" grounds
  ([why](#why-alt-stays-short)). Note the name is contested:
  [#10119](https://github.com/streamlit/streamlit/issues/10119) wants a *visible* description on the
  same command for a different audience, so whoever picks it up settles that first
- **Transcripts and audio-description tracks** — WCAG 1.2.x, the largest remaining media
  gap, and worth doing soon
- **Warnings when** `alt` **is missing** — [requested in
  #8563](https://github.com/streamlit/streamlit/issues/8563#issuecomment-2123267665) and
  the one community ask we decline. Revisit as opt-in config if audits demand it
- **Visible titles or** `label` **on charts and dataframes** — a layout and typography
  feature
- **LLM-generated alt text** — unreliable, costly, and surprising in a library that
  otherwise makes no model calls
- **Auto-generated dimension fallbacks** ("150 rows × 8 columns") — duplicates information
  the grid already exposes, while occupying the slot the author's description should fill
- **Images Streamlit renders that authors cannot reach** — `st.column_config.ImageColumn`,
  `st.chat_message(avatar=…)`, camera input, uploaded-file thumbnails. Author-supplied
  content rendered by our chrome, so #12873 does not cover it either
- `**st.iframe(title=…)**` — HTML uses `title`; already in the iframe spec
- `**st.pdf` / `st.html` / custom components\*\* — authors control the inner content
- **Decorative chrome** — [#12873](https://github.com/streamlit/streamlit/issues/12873)
- **A fully accessible dataframe canvas, and map viewport announcements** — separate and
  much larger projects, neither with an issue of its own yet
- **Dataframe ⋮ menu keyboard access** —
  [#13332](https://github.com/streamlit/streamlit/issues/13332), a grid-a11y concern
  rather than a naming one
- **Naming element toolbar buttons** ([#16148](https://github.com/streamlit/streamlit/issues/16148))
  — every `"Fullscreen"` and `"Download as PNG"` is identical, so a page of charts is a list of
  indistinguishable buttons. A natural follow-up that could use `alt` as context, but it is
  Streamlit chrome rather than author content, which is the same reason `st.logo` is out. It also
  does not depend on this project: composing from an image's existing `caption` would close the
  original report on its own

## Alternatives Considered

**Reuse** `caption` **as** `alt` **when** `alt` **is omitted.** Rejected — see
[Caption vs. `alt`](#caption-vs-alt).

**Require** `alt`**.** Fails "Minimize Migration Distance" (principle 26).

**Add** `label` **/** `label_visibility` **to charts instead.** Worth doing eventually as
a visible chart title, but it does not replace `alt`: authors want a short visible title
_and_ a longer assistive-tech-only description, and a hidden-by-default `label` would be a
different parameter wearing a sacred name.

**Inject a visually hidden heading before each chart.** Would alter the document's heading
outline. A description does not.

Which ARIA role each element uses, and the DOM node the name attaches to, are
implementation choices rather than API ones and are settled during each phase.

## Checklist

| Item                       | ✅ or comment                                                                                                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅ Attribute mapping only, with no server or runtime dependency and no platform-specific code. Note that screen-reader _behavior_ does vary by platform, and none of this has been tested with one yet — see [Rollout](#rollout)                                     |
| No breaking API changes    | ⚠️ Additive keyword-only parameter, but one intentional accessibility-tree change lands with no author action, fixing a current defect: `st.image`'s index alt is removed ([why](#what-an-image-gets-with-no-alt)) |
| No new dependencies        | ✅                                                                                                                                                                                                                                                                   |
| Metrics collected          | ⚠️ Existing per-command metrics, which is enough to ship. Tracking the share of calls that set `alt` would measure adoption, but it is not proposed here and needs its own call                                                                                      |
| Any security/legal impact? | ✅ Author-provided plain text rendered into attributes by React, which escapes them. No markdown or HTML pipeline. Legal upside: unblocks apps with procurement accessibility requirements                                                                           |
| Any docs changes needed?   | ✅ Per-command API reference plus a short accessibility guide — see [Docs guidance](#docs-guidance)                                                                                                                                                                  |
