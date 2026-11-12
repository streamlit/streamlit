---
author: mayagbarnes
created: 2026-09-14
---

# Alt text for images, charts, media, and data elements

## Summary

Add a keyword-only `alt` parameter to the 21 display commands with no author-facing way to
supply an accessible name: images, media players, charts, maps, dataframes, tables, PDFs, and
iframes. Authors provide a short, plain-text accessible name, and Streamlit maps it to whichever
attribute is correct for that element.

Four of the 21 expose something today, but none of it is a parameter and none of it is discoverable
from a command signature: `st.mermaid_chart` honors `accTitle` / `accDescr` directives written into
the diagram source, `st.altair_chart` and `st.vega_lite_chart` surface a `description` set inside the
Vega spec, and `st.echarts_chart` generates an `aria-label` from the data by default — see [Commands in
scope](#commands-in-scope) for what each command exposes today. `st.iframe` hardcodes
`title="st.iframe"`, which is a name only in the sense that every embed on the page shares one.

```python
st.image("q3-revenue.png", alt="Bar chart showing Q3 revenue up 15% year over year")
st.dataframe(df, alt="Top 20 customers by revenue")
st.bar_chart(df, alt="Revenue by product line, highest for Enterprise")
```

`alt` is never displayed, and it is independent of widget `label` and `help`. For a linked image it
composes with `caption` under a [documented rule](#caption-vs-alt) so the link gets one name. It is
additive and opt-in: omitting it leaves an app's pixels unchanged. One
accessibility-tree change lands with no author action, fixing a current defect: `st.image` and
`st.pyplot` stop emitting the positional index as `alt`. See the [Checklist](#checklist).

This specifies the `alt` API for [#8563](https://github.com/streamlit/streamlit/issues/8563), our
most-upvoted open issue, and for [#16607](https://github.com/streamlit/streamlit/issues/16607) on
`st.iframe`; the implementation PRs will close them. It also ratifies the `alt` name proposed for `st.audio` and `st.video` in
[#16568](https://github.com/streamlit/streamlit/pull/16568).

## Outstanding decisions

1. **[The parameter name](#the-parameter-name)** — **recommend `alt`**, on all 21 commands.
   Effectively permanent once shipped, and `alt_text` has peer precedent, so worth an explicit call.
   That includes `st.iframe`, whose HTML attribute is `title`: one Python name still maps to the
   correct attribute per element, rather than exposing `title` only there.
2. **[What an image gets with no `alt`](#what-an-image-gets-with-no-alt)** — **recommend emitting no
   `alt` attribute.** All three candidate answers are non-conforming for a typical call, so the
   choice is which failure we prefer: one a scanner keeps flagging, or one nothing can detect.
3. **[What `alt=""` means](#what-alt-means)** — **recommend decorative on `st.image` and `st.pyplot`**,
   the only two commands whose name today is the positional index, and "not provided" on the other
   nineteen, `st.mermaid_chart` included since it has a fallback name to lose. This is the
   one place the parameter does not behave identically everywhere, which principle 10 cautions
   against, and changing it after release would break apps that relied on either reading — so it
   wants an explicit call rather than an inline note.
4. **[Whether `st.echarts_chart` is in scope](#commands-in-scope)** — **recommend keeping it.** It
   landed 2026-09-05, after the original inventory was drawn, and it is the only command where `alt`
   replaces a name the library already generates rather than filling an empty slot — so it is the one
   addition that could make a command worse if an author writes a vague description. The alternative
   is to declare it out of scope and add `alt` in a follow-up, which would ship a brand-new chart
   command inconsistent with its siblings — cheap to reverse now, awkward to reverse after release.

Three smaller choices are made inline rather than listed:

- `alt` overwrites an author's Vega-spec `description` when both are set
- A list on `st.image` needs exactly one entry per image, matching `caption` — see [API](#api). It sits
  here rather than above because it is the reversible one: relaxing strict to lenient later would not
  break existing calls, where tightening lenient to strict would break them
- `alt` takes plain text rather than markdown, the one deliberate exception to how markdown is handled
  elsewhere

## Problem

Streamlit apps are often the UI for internal tools, public dashboards, and government or
healthcare workflows that must meet [WCAG 2.1](https://www.w3.org/TR/WCAG21/) Level AA,
Section 508 in the US, or EN 301 549 for European public-sector procurement. The latter
two lean on WCAG by reference — Section 508 on 2.0 AA, and EN 301 549 on WCAG plus requirements of its
own — so targeting WCAG 2.1 AA covers most of what all three ask for. [SC 1.1.1 Non-text
Content](https://www.w3.org/TR/WCAG21/#non-text-content) (Level A) requires a text
alternative for non-text content. Streamlit offers authors no parameter for one on any of
the 21 commands, and no mechanism at all on 17 of them — see the Summary for the four
partial exceptions, none of which is discoverable from a command signature.

### User requests

- [#8563](https://github.com/streamlit/streamlit/issues/8563) — the ask itself. 272 👍, our
  most-upvoted open issue
- [#16607](https://github.com/streamlit/streamlit/issues/16607) — `st.iframe` hardcodes
  `title="st.iframe"`, so every embed on a page has the same accessible name. In scope here;
  the Python parameter is `alt`, mapped to the iframe `title`
- [#16148](https://github.com/streamlit/streamlit/issues/16148) — Fullscreen buttons announce
  without element context. Adjacent; a [fast follow-up](#out-of-scope-future-work) once `alt`
  exists to compose into those names
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

The #8563 thread is short but settled useful ground, and each point is taken up where it belongs:
whether `caption` should become the alt text ([asked](https://github.com/streamlit/streamlit/issues/8563#issuecomment-2123267665),
[pushed back on](https://github.com/streamlit/streamlit/issues/8563#issuecomment-2247804748) — see
[Caption vs. `alt`](#caption-vs-alt)); whether a missing `alt` should warn (declined for v1, in [Out of
Scope](#out-of-scope-future-work)); which name to use
([narrowed](https://github.com/streamlit/streamlit/issues/8563#issuecomment-3774340477) to
`alt`/`alt_text` vs `accessible_description` — see [The parameter name](#the-parameter-name)); and
LLM-generated alt text, raised as an aside and not pursued since.

### What authors get today

No parameter on any of them, and nothing discoverable from a command signature. `st.image` is worse
than silent: it emits the positional array
index as the `alt` — `alt="0"`, `alt="1"` and so on — so a screen reader announces "0, image". Per-command
detail is in [Commands in scope](#commands-in-scope).

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
those. That includes embeds (`st.iframe`, `st.pdf`) whose accessible name is not a visible
label. Widgets, `st.metric`, expanders, and tabs are already named through `label`, so
adding `alt` there would duplicate `label` for no gain — "Start Minimal" (principle 4), since every
parameter is a maintenance burden. Text elements _are_ the text alternative and need nothing. `alt` is invisible, which
is what distinguishes it from `caption` (visible, `st.image` only) and `help` (a tooltip).

Several display commands also become widgets through `on_select` — `st.dataframe`, `st.plotly_chart`,
`st.pydeck_chart` and the Vega charts — so `alt` names those interactive paths too, and SC 4.1.2
applies to them as much as to `st.data_editor`. `st.data_editor` is the one command that is an input
without `on_select`: it accepts edits but has no `label`,
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
  and markdown `![alt](url)`; one name across all 21 commands
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
  Note that principle 8 (Semantic Names Over Geeky Names) actually favors this option — its own
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

**Why no markdown:** `alt` takes plain text. Principle 24 covers text that *is displayed*, so `alt`
sits outside it rather than departing from it — markdown in an accessible name is announced
literally, so `**bold**` reads as "asterisk asterisk bold". This matches markdown's own
`![alt](url)`.

### Why `alt` stays short

`alt` is an accessible **name**, not a description: roughly one sentence that identifies the
element. Assistive technology reads that name before the content it names, so a 40-word name is
not identifying anything — it is delaying the thing the reader asked for. Longer context belongs in
`caption` or nearby markdown.

How much of a name gets read, and whether a user can interrupt, is platform and AT configuration
rather than anything a spec constrains — so the one-sentence guidance is design intent, not a limit
we can source.

**The case for deferring is "Start Minimal" (principle 4), not a standards preference.** A
second parameter on 21 commands, plus a description region per element, for a use case we
have not yet observed. That reason stands on its own.

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

Keyword-only, optional, appended after each command's existing keyword-only parameters — with one
signature exception: `st.pyplot` ends in `**kwargs` forwarded to Matplotlib's `savefig`, so `alt`
must be declared explicitly before it or the call never reaches the proto.

```python
alt: str | None = None  # all commands except st.image
alt: str | Sequence[str | None] | None = None  # st.image only
```

**Why `st.image` differs.** One call can render many images, so a list pairs positionally — one
entry per image, exactly as `caption` does. `st.pyplot` takes a single string: one figure, one image.
The table below is the full contract.

Matching `caption`'s strictness is the point: two list-valued parameters on one command behaving
differently is the inconsistency principle 11 exists to prevent. Leniency also buys nothing here,
because `caption` already accepts `None` per entry, so a deliberate gap is expressible either way —
all a short list would add is tolerance for a **miscount**, which silently leaves an image
unlabeled, the exact failure this feature exists to fix. Strict pairing separates "I skipped this
one" from "I lost count". The lenient alternative is a reasonable landing too, and
relaxing to it later would not break existing calls.

| Value | Behavior |
| --- | --- |
| `None` (default) | Not provided. Each element keeps its existing fallback. `st.image` and `st.pyplot` are the exception: they emit no `alt` attribute — see [What an image gets with no `alt`](#what-an-image-gets-with-no-alt) |
| Non-empty string | The accessible name. Plain text, leading and trailing whitespace stripped |
| `""` on `st.image` or `st.pyplot` | Decorative — `alt=""`, a [sufficient technique](https://www.w3.org/WAI/WCAG21/Techniques/html/H67) for 1.1.1 |
| `""` on every other command | Treated as not provided, keeping that element's existing fallback, and logged so the author sees the dual meaning |
| Whitespace-only | Treated as not provided, logged the same way. Never decorative |
| Non-string | Coerced with `to_str`, as `label` does, then stripped |
| `None` inside an `st.image` list | That image gets no `alt` — how you label some images and not others |
| `""` as an entry in an `st.image` list | Decorative for that one image |
| A single string with several images | Raises |
| List length ≠ number of images | Raises |
| A sequence-valued `alt` paired with a `set` of images | Raises |

`None` and `""` mean different things here, so they have to stay distinguishable all the way to the
DOM. A plain proto3 `string` cannot carry that difference — unset and empty are the same on the wire —
so wherever `alt` travels in a proto it needs a presence-preserving field (`optional string alt`) —
and mermaid, which has no proto of its own, needs whatever route phase 4 picks to preserve the same
distinction. Both cases want a test rather than each phase inventing its own sentinel.

One failure no validation can catch: a list of the right length in the wrong order mislabels every
image. That is the one failure this feature can still introduce, and a docstring warning is the only
defense.

### What `alt=""` means

An empty string is the standard WCAG way to say "decorative", so it needs a meaning on 21 commands
where only two have nothing to lose by it.

**Option A: decorative on `st.image` and `st.pyplot`, "not provided" everywhere else** ✅ PREFERRED

- Pros: These are the only two commands whose accessible name today is the positional index, so an
  empty `alt` destroys nothing and a figure genuinely can be decorative. Everywhere else `""` keeps a
  name the element already has rather than deleting it — a YouTube iframe keeps its URL-derived
  `title`, `st.iframe` keeps `"st.iframe"`, and `st.mermaid_chart` keeps the author's `accTitle` /
  `accDescr` or its type-derived fallback, which is exactly why mermaid is **not** in the decorative
  group despite rendering an `<img>`. An iframe must have a title, so emptying one is never a
  decorative signal we can honor
- Cons: One value with two meanings, which principle 10 cautions against. Nothing in the signature
  tells an author which group a command is in, so the empty case is logged

**Option B: decorative everywhere, a logged no-op where there is no attribute**

- Pros: One meaning everywhere, satisfying principle 10 literally
- Cons: "Decorative" becomes a claim Streamlit cannot act on for nineteen commands, and honoring it
  would mean suppressing a fallback that is currently the element's only name — an author emptying a
  YouTube or `st.iframe` title to signal "decorative" would get a nameless iframe, which is an
  outright failure

**Recommendation: Option A**, on the grounds that the alternative's one-meaning consistency is
nominal — it reads the same everywhere and behaves the same nowhere, because there is nothing to
empty. Worth an explicit call rather than an inline note because reversing it after release would
break apps relying on either reading.

Whitespace-only is never decorative under either option. The check runs before stripping, so
`alt=" "` cannot become `alt=""`:
`alt=" "` is almost always a mistake — an empty f-string, a stripped variable — and asserting "not
intended for the user" on it is precisely the undetectable failure this spec rejects elsewhere.

### Commands in scope

| Commands | Today | Where `alt` ends up |
| --- | --- | --- |
| `st.image` | `<img alt="0">` — the array index, announced as "0, image". **Worse than no alt.** For a *linked* image the caption already names the anchor, so the two are not fully independent today | The image's HTML `alt` attribute |
| `st.pyplot` | Renders through the image path — the same `ImageList` proto — so it inherits the index bug, and its fix | Same |
| `st.mermaid_chart` | A name derived from the diagram type — `"Mermaid flowchart"`, falling back to `"Mermaid diagram"` for an unrecognized type — unless the author writes diagram directives | Same, since the diagram renders as an image. It has no proto of its own, so phase 4 picks the wiring route — and a mermaid fence written directly inside `st.markdown`, which the [mermaid spec](../2026-05-02-mermaid-chart/product-spec.md) treats as the primary interface, **cannot be named by `alt` at all**. Where `alt` is set it replaces the author's `accTitle` / `accDescr` rather than joining them |
| `st.audio`, `st.video` | No accessible name. `st.video`'s YouTube embeds fall back to the raw URL as the iframe `title`; `st.audio` has no iframe path | An accessible label on the player, and the frame title for YouTube embeds — which `alt` replaces only when set, since an iframe must have a title |
| `st.line_chart`, `st.bar_chart`, `st.area_chart`, `st.scatter_chart` | Per-datapoint labels from Vega, but no chart-level name and no way to set one — these commands build the spec themselves | Vega's own chart-description field |
| `st.altair_chart`, `st.vega_lite_chart` | Same, except an author who hand-writes `description` into the spec does get a chart-level name | Same. Where the author already set `description`, `alt` wins as the documented parameter, and Streamlit logs the override |
| `st.echarts_chart` | The only command that names itself by default: ECharts sets `role="img"` and generates an `aria-label` from the data whenever `aria.enabled` is on, which Streamlit injects when the author's option dict omits it. The generated label is conditional — an empty series can yield `role="img"` with no label, which Streamlit then strips — and an author can already write `aria.label.description` into the option dict, the same escape hatch Vega's `description` offers | ECharts' `aria.label.description`. `alt` overrides both the generated label and an author-set one, and Streamlit logs the override |
| `st.plotly_chart`, `st.graphviz_chart` | Nothing — an unlabeled region | An accessible label on the chart |
| `st.map`, `st.pydeck_chart` | Nothing, and no text alternative of any kind behind the canvas | An accessible label on the map |
| `st.dataframe`, `st.data_editor` | Cells are navigable, but nothing says what the data _is_ | An accessible label on the grid |
| `st.table` | Correct table semantics. No author-facing name, and when scrollable a hardcoded `aria-label="Scrollable table"` the author cannot change | An accessible label on the `<table>` itself. The `"Scrollable table"` label stays put — it describes the scroll affordance, not the content, so the two do not compete |
| `st.iframe` | Hardcoded `title="st.iframe"` on every embed (`IFrame.tsx`). No author-facing parameter. [#16607](https://github.com/streamlit/streamlit/issues/16607). The [iframe spec](../2026-03-13-st-iframe/product-spec.md) listed a `title` parameter as future work; this spec supersedes that with `alt` | The iframe's HTML `title` attribute. `alt` replaces `"st.iframe"` only when set. Deprecated `st.components.v1.iframe` / `.html` share that component and are **not** getting the parameter |
| `st.pdf` | The viewer is `streamlit-pdf`, a Components v2 mount (shadow root, not Streamlit's `<iframe>`). `pdf_viewer` today takes `file`, `height`, and `key` only | Forwarded through `st.pdf` into `streamlit-pdf` as `aria-label` on the viewer root. Extra kwargs would `TypeError` on current `streamlit-pdf`, so this phase needs a matching package release and a version bump of the extra |

### Caption vs. `alt`

Two parameters, two jobs: `caption` is visible context beside the image ("Figure 1: Monthly active
users") and takes markdown; `alt` is the invisible description of what the image shows ("Line chart
rising from 12k to 48k") and takes plain text. Neither becomes the other's value, and **a caption
changes nothing about the image's own `alt`** — an uncaptioned and a captioned image both get no
attribute when `alt` is omitted. Marking a captioned image decorative instead would assert it is
"not intended for the user", a claim only the author can make, and the [W3C decision
tree](https://www.w3.org/WAI/tutorials/images/decision-tree/) branch that would justify it requires
the image be redundant to _real text nearby_ — which contradicts this spec's own position that a
caption is not a description.

One interaction does need a decision, and it is narrower than it looks: it applies only to
`st.image(one_image, link=…)`, since `link` reaches the renderer only for a single image. There,
`ImageList.tsx` already names the anchor by the caption, else the raw link URL, so a linked image is
named today while the `<img>` carries the index. **The anchor should be named by `caption`, else a
non-empty `alt`, else the URL** — putting `alt` ahead of the URL so an authored description outranks
a raw link. `caption` stays first because it is the visible text a sighted user associates with that
link, and an accessible name that omits the visible label is its own problem. But `caption` accepts
markdown and `ImageList.tsx` currently copies the raw source into `aria-label`, so a caption of
`**Revenue**` would name the link with its asterisks: the anchor must take the caption's rendered
plain text, not its source. Two consequences worth recording rather than rediscovering: an uncaptioned linked
image must still leave the anchor named. Today the blocked-link path is named only
incidentally: `ImageList.tsx` sets the anchor's `aria-label` to `undefined` there and the child
`<img alt="0">` names the control instead, while a non-blocked link still falls back to the URL.
Dropping the index `alt` therefore leaves **the blocked-link case shipping a focusable `href` with no
accessible name — an SC 4.1.2 regression** unless the anchor gets a non-empty name of its own or
stops existing. **Recommend the latter, and completely:** `ImageList.tsx` already renders that anchor
with `preventDefault` and an `href` pointing at a placeholder, so it does nothing when activated. Not
rendering the wrapper at all when the link is blocked removes the nameless control rather than merely
hiding it from the tab order, and needs no new user-facing string either. Settling it here is what keeps phase 0 free of a product
call.

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

F30 does settle the _classification_ of today's `alt="0"` as its numbered-placeholder pattern. Which
failure is worse is our own judgment: neither F30 nor F65 ranks itself against the other, and neither
discusses scanner detectability.

The removal reaches `st.pyplot` too, since it renders through the same image path. No other command
changes behavior when `alt` is omitted. The index label is not a supported author-facing API, but Streamlit removing it does intentionally
change the DOM and the accessibility tree — a bugfix rather than an API break.

### Examples

```python
st.image("sunrise.jpg", alt="Sunrise over a mountain ridge")
st.image("divider.svg", alt="")  # decorative — st.image / st.pyplot only

# caption is visible context; alt describes the visual. Never the same string.
st.image(
    "chart.png",
    caption="Figure 1: Monthly active users, 2024",
    alt="Line chart of monthly active users rising from 12k in January to 48k in December",
)

# exactly one alt per image, as with caption; use None to skip one on purpose
st.image(["cat.png", "dog.png"], alt=["Orange tabby on a windowsill", "Black labrador"])
st.image(["logo.png", "chart.png"], alt=[None, "Revenue by quarter, up 12%"])

st.pyplot(fig, alt="Histogram of response times, right-skewed with a long tail past 2s")
st.audio("earnings.mp3", alt="Q2 2026 earnings call recording")
st.video("demo.mp4", alt="Product walkthrough, 3 minutes", subtitles="captions.vtt")
st.bar_chart(df, alt="Revenue by product line, highest for Enterprise")
st.map(df, alt="Delivery hubs across the Pacific Northwest")
st.dataframe(df, alt="Top 20 customers by revenue")
st.table(summary, alt="Quarterly KPI summary")
st.iframe("https://docs.streamlit.io", alt="Streamlit documentation")
st.pdf("report.pdf", alt="Q3 2026 financial report")
```

### Docs guidance

Per-command docstrings plus a short accessibility page. The points worth making, because
they are the mistakes authors will actually make: write `alt` as a replacement for the
visual, not a label for it; keep it to about a sentence and put longer context in
`caption` or nearby markdown; do not open with "Image of…", since assistive tech already
announces the role; never make `caption` and `alt` identical; describe a chart's takeaway
rather than its data points; name a dataframe rather than pasting it; note that on
`st.echarts_chart` your `alt` *replaces* a generated description, so a vague one is a regression
rather than an improvement there; and remember that
`subtitles`, not `alt`, is what addresses SC 1.2.2 for video — `alt` only names the player.

### Conformance scope

`alt` **enables** authors to meet **SC 1.1.1 Non-text Content** (Level A) for images, charts, maps
and diagrams, and its descriptive-identification requirement for `st.audio` and `st.video` — where a
name identifies the media but captions and transcripts are what actually satisfy 1.2.x. It also
enables **SC 4.1.2 Name, Role, Value** (Level A) for the interactive cases —
`st.data_editor`, and `st.dataframe`, `st.plotly_chart`, `st.pydeck_chart` and the Vega charts
whenever `on_select` makes them widgets — and for `st.iframe`, whose name is the frame `title`.
`st.pdf` is named as an embedded viewer under the same 4.1.2 rule. It does not close either on its own: 1.1.1 requires the text to serve the
visual's equivalent purpose, so a complex chart or map may still need a longer description or the
underlying data. Shipping the parameter removes the blocker; whether a given app conforms depends
on what its author writes.

It closes **1.1.1 for neither** `st.dataframe` nor `st.table`, since that criterion covers non-text
content and a table of text is text — naming a grid aids findability rather than supplying a text
alternative. For 4.1.2 the two part company: `st.table` is static output and sits outside
it, while `st.dataframe` is a keyboard-navigable, sortable grid whether or not `on_select` is set, so
naming it addresses that criterion's *name* portion — role and value remain the grid's own problem. Nor does any of this make an app AA-conformant, so
release notes should say "add alt text to your images and charts" — not "Streamlit is now
accessible", and certainly not "accessible media".

Three things stay unmet and are not this project: audio transcripts (SC 1.2.1 / 1.2.3), audio
description (SC 1.2.5 — subtitle tracks are hardcoded as captions), and full dataset access in a
virtualized grid. All three are in [Out of Scope](#out-of-scope-future-work).

### Rollout

Seven phases, ordered by how much is unresolved rather than by user value. Each ships on its own,
and phase 0 needs no API decision at all.

| Phase | Commands                                                            | Why here                                                                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `st.image`, `st.pyplot` — remove the index `alt`, and stop rendering the wrapper anchor for a blocked image link | Needs no new API, and helps every existing app whether or not its author adopts `alt`. **Sequencing is a maintainer call:** shipping this before phase 6 leaves images with no accessible name *and* no parameter to supply one until the parameter lands, so it may be better released alongside phase 6 than ahead of it |
| 1     | `st.audio`, `st.video`, `st.iframe`                                 | Nothing unresolved. Audio/video code exists in [#16568](https://github.com/streamlit/streamlit/pull/16568), which was approved and then closed, so no proto in the tree carries `alt` yet. `st.iframe` is the same pattern as YouTube's frame `title` — one proto field onto an attribute the component already sets. Reopening #16568 plus the iframe field lands 3 of the 21 first |
| 2     | The six simple and Vega charts, plus `st.echarts_chart`             | Each library already supports a chart-level description natively — Vega's `description`, ECharts' `aria.label.description` — so this is the least work for the most commands. Confirmed rather than assumed: Streamlit renders through **vega-embed** (`useVegaEmbed.ts`), which applies `role="graphics-document"` and maps the view description to `aria-label`, fed from `spec.description` — so an Altair `description` reaches assistive tech today. `st.echarts_chart`'s scope is [decision 4](#outstanding-decisions) |
| 3     | `st.plotly_chart`, `st.graphviz_chart`, `st.map`, `st.pydeck_chart` | All four need the same new wiring; decide once, apply four times                                                                                                                                                                  |
| 4     | `st.table`, `st.mermaid_chart`, `st.pdf`                            | `st.table` is natively nameable. Mermaid has no proto of its own, so this phase picks a wiring route. `st.pdf` is a thin wrapper around `streamlit-pdf`; the Python parameter is in this repo, the accessible-name sink is in that package |
| 5     | `st.dataframe`, `st.data_editor`                                    | One component covers both. The name must attach without hiding the canvas's existing cell-level `alt` — see the identity and DOM constraints below                                                                                |
| 6     | `st.image`, `st.pyplot`                                             | The headline ask, and the only structurally involved phase                                                                                                                                                                        |

#16568 describes itself as the first slice of a "17-element" project, which reconciles as follows.
The original list held 18 commands, one of which was `st.bokeh_chart`; that command was removed in
[#15636](https://github.com/streamlit/streamlit/pull/15636) on 2026-06-19, two months before #16568
opened, leaving the 17 it counted. This spec adds `st.mermaid_chart`, which renders as an image and
meets the same scope rule, and `st.echarts_chart`, which landed 2026-09-05, plus `st.iframe` and
`st.pdf`. **The reconciled count is 21.**

The phases are very unevenly sized: 1 and 2 are close to free, and **phase 6 carries most of the
risk and most of the user-visible value**, which is the argument for splitting phase 0 out of it.

Three constraints carry across every phase.

**Element identity.** For commands that already call `compute_and_register_element_id`, pass `alt`
into that call as a normal kwarg. Do **not** add `alt` to any `key_as_main_identity` set, and do not
start computing an ID on a command that has none today solely to hash `alt`.
`disabled` is the only parameter we consistently omit from the hash, because it is expected to
change between reruns; `alt` is expected to stay stable for a given chart, image, dataframe, or
embed, so it does not differ from most other parameters. Two consequences:

- Unkeyed: `alt` participates in the ID. Two otherwise-identical elements with different `alt`
  values are distinct, and changing `alt` remounts an unkeyed element — the same as changing
  `width`. Two unkeyed `st.plotly_chart(fig)` calls with the same or omitted `alt` still raise
  `StreamlitDuplicateElementId`; `key` is the remedy when the author wants two identical charts.
- Keyed, with `key_as_main_identity=True` or a set that does not include `alt`: changing `alt` does
  not remount or reset widget state.

`alt` is still never written into a chart spec that is hashed into an ID. For the Vega commands that
means carrying `alt` as its own proto field and applying it to the view after the element ID is
computed, rather than writing it into the spec JSON — *and* passing the string into
`compute_and_register_element_id` as a kwarg, which is a separate input from that spec hash.

**ECharts silence.** An author's `alt` names an ECharts chart even when the option dict sets
`aria: {enabled: false}`, the same precedence by which `alt` beats a Vega `description`; that option
requests silence only when `alt` is omitted.

**DOM node.** Attach `alt` to the element's own accessible name. Do not put it on a wrapper in a way
that hides names or keyboard access already provided by inner content. The concrete case is
`st.dataframe` / `st.data_editor`: Glide Data Grid exposes cell values through the canvas `alt` in
addition to the painted grid, and that alternative must stay in the accessibility tree and remain
navigable. Author `alt` names the grid as a whole (what the data *is*); it must not overwrite or
`aria-hidden` the canvas's cell-level alternative. The same rule applies anywhere a command already
names substructure — a labelled iframe inside a media player, a table inside a scroll region. Role
and exact attribute remain per-phase implementation choices; which node they land on is a sign-off
gate, not a free choice.

These three constraints are sign-off gates on the implementation PRs rather than blockers for
agreeing the direction here.

Each phase gets Python and frontend unit tests plus an e2e test asserting the _computed_ accessible
name rather than the presence of an attribute. Automated tests confirm a name exists, not that it is
useful, so each phase also wants a manual spot-check with a real screen reader — VoiceOver first,
since it needs no license. That a short name actually helps is the one claim here we cannot verify
automatically.

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
- **Mermaid diagrams written as a markdown fence** — `st.markdown` has no parameter to carry `alt`, so
  only `st.mermaid_chart` calls can be named. Closing that needs a decision about naming fenced
  content generally, which is larger than this spec
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
- **`st.html` / custom components / deprecated `st.components.v1.iframe`** — authors control
  the inner content of `st.html` and custom components. `st.components.v1.iframe` and
  `st.components.v1.html` share the hardcoded `"st.iframe"` title with `st.iframe` but are
  deprecated, so they do not get the parameter ([#16607](https://github.com/streamlit/streamlit/issues/16607#issuecomment-5375781603))
- **Decorative chrome** — [#12873](https://github.com/streamlit/streamlit/issues/12873)
- **A fully accessible dataframe canvas, and map viewport announcements** — separate and
  much larger projects, neither with an issue of its own yet
- **Dataframe ⋮ menu keyboard access** —
  [#13332](https://github.com/streamlit/streamlit/issues/13332), a grid-a11y concern
  rather than a naming one
- **Naming element toolbar buttons** ([#16148](https://github.com/streamlit/streamlit/issues/16148))
  — every `"Fullscreen"` and `"Download as PNG"` is identical, so a page of charts is a list of
  indistinguishable buttons. Reasonable **fast follow-up**: compose `alt` (else `caption` on
  `st.image`) into those button names so "Fullscreen" becomes "Fullscreen: Revenue by product
  line". Still Streamlit chrome rather than a new author parameter, which is why it is not a
  phase here — but unlike `st.logo`, it now has a string to compose from once this ships. The
  original report can still be closed with `caption` alone; using `alt` is the better default
  once it exists

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

Which ARIA role each element uses is an implementation choice settled during each phase. Which
DOM node the name attaches to is not free: see the [DOM-node constraint](#rollout).

## Checklist

| Item                       | ✅ or comment                                                                                                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅ Attribute mapping only, with no server or runtime dependency and no platform-specific code. Note that screen-reader _behavior_ does vary by platform, and none of this has been tested with one yet — see [Rollout](#rollout)                                     |
| No breaking API changes    | ⚠️ Additive keyword-only parameter, but one intentional accessibility-tree change lands with no author action, fixing a current defect: `st.image` and `st.pyplot` stop emitting the index as `alt` ([why](#what-an-image-gets-with-no-alt)) |
| No new dependencies        | ✅                                                                                                                                                                                                                                                                   |
| Metrics collected          | ⚠️ Existing per-command metrics, which is enough to ship. Tracking the share of calls that set `alt` would measure adoption, but it is not proposed here and needs its own call                                                                                      |
| Any security/legal impact? | ✅ Author-provided plain text landing in attributes, with no markdown or HTML pipeline. React escaping covers only React attribute sinks, so the SVG-rendering commands must take `alt` as a prop rather than interpolating it into a string — worth an adversarial-text test per phase. Legal upside: unblocks apps with procurement accessibility requirements                                                                           |
| Any docs changes needed?   | ✅ Per-command API reference plus a short accessibility guide — see [Docs guidance](#docs-guidance)                                                                                                                                                                  |
