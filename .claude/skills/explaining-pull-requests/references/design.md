# Visual system

Read this before changing anything visual.

The report is a Streamlit artifact that a maintainer may link from a public PR
thread, so it uses Streamlit's own light theme tokens rather than inventing a
palette — same surfaces, same brand red, same neutral greys as the app the PR
changes. The structure is long-form editorial: one column, generous whitespace,
proportional type.

Every contrast figure below is computed (WCAG 2.1 relative luminance) against the
card surface `#fafafa`, not estimated. If you add a colour, compute its ratio.

## Narrow first — this is the constraint that breaks layouts

Two of the three ways this gets read are narrow: on a phone, and inside the wiki
explorer's iframe. So:

- **One column, always.** No side-by-side grids. A two-up figure pair that looks
  elegant at 1080px is two illegible thumbnails at 380px, so figures stack.
- **720px measure**, not 1080. One column of prose wants a short line.
- **Tables: two columns maximum.** Anything wider is unreadable narrow. Use the
  `.kv` list (stacked label/value rows) instead — it degrades gracefully because
  it was never depending on horizontal room.
- **44px minimum tap target** on quiz options and buttons.
- **The tab strip scrolls sideways** rather than wrapping — wrapping turns four
  PRs into a four-line block that pushes the content off screen.
- `--pad` drops from `1.5rem` to `1.1rem` under 560px; body from 16.5px to 16px.

Because figures stack, a before/after pair can end up a screen apart. Label each
with `.ba` ("Before · develop" / "After · this PR") instead of trusting reading
order to carry which is which.

## Length is a design constraint

`scripts/finalize.py` fails above **550 words of prose per PR**, excluding the
quiz — roughly two minutes of reading. The report has to be dramatically faster
than the diff or it's just more to review. Whitespace and visuals are free; prose
is not.

The allowance covers the four-beat `.brief` and up to five points under *what
isn't obvious* — it is not headroom for prose elsewhere. **"What isn't obvious" is
the section readers value most**, so when you're over budget, trim the brief and
the watch-out list before you trim points.

The corollary is that the PR-comment pitch is **clipboard-only**, never also
rendered. Rendering it doubles every claim in a second register, and in the
original version of this report that was the single largest source of bloat.

## What gets no space at all

**CI status.** Nothing merges without green checks, so reporting them is noise.
The allowance is one 7px dot in the PR header (`.ci.ok` / `.ci.no`). Never a
table, a stat tile, or a section.

## Palette

From `frontend/lib/src/theme/primitives/colors.ts`, so the report and the app
agree. Measured contrast against `--card` `#fafafa`:

| Token | Hex | Streamlit name | vs card | Use |
|---|---|---|---|---|
| `--bg` | `#ffffff` | white | — | page |
| `--card` | `#fafafa` | gray10 | — | brief, viz, quiz, `.kv` |
| `--card-2` | `#f0f2f6` | gray20 | — | quiz header/footer, stat tiles, `.lbl` |
| `--rule` | `#e6eaf1` | gray30 | — | hairlines |
| `--fg` | `#262730` | gray90 | 14.22 | body prose |
| `--muted` | `#555867` | gray80 | 6.76 | secondary prose, `.pt` paragraphs |
| `--faint` | `#6e7284` | — | 4.57 | small labels, captions, axis ticks |
| `--accent` | `#ff4b4b` | red70 | **3.16** | brand red. Borders, dots, active tab, hero chip |
| `--accent-deep` | `#bd4043` | red90 | 5.06 | kickers, `.brief` labels, links, buttons, `code` |
| `--ok` | `#177233` | green100 | 5.76 | quiz correct, cleared stamp |
| `--amber` | `#b04a00` | — | 5.26 | accepted trade-off |
| `--red` | `#7d353b` | red100 | 8.23 | worse, open, unverified, quiz wrong |
| `--blue` | `#0068c9` | — | 5.26 | stale / informational |

**The one rule that will bite you: `--accent` is 3.16:1.** That clears the 3:1
floor for non-text things — borders, chart marks, the status dot, large display
type — and **fails** the 4.5:1 floor for body and small text. Brand red at 12px is
the mistake this palette is shaped to prevent, so anything small that must be red
uses `--accent-deep`. On `--card-2` the accent measures 2.95:1, below even the 3:1
mark floor, so it must not be the only signal on a stat tile or quiz footer.

`--ok` is deliberately **not** the brand accent. Red means wrong everywhere, so a
red "correct" state fights the reader; the quiz needs a green regardless of what
the brand colour is. `--faint` is a custom grey rather than gray70 (`#808495`)
because gray70 measures 3.56:1 — fine for a border, not for a caption someone has
to read.

Headings wear `--fg`, not red. Weight and size carry them; colour would be
redundant and would spend the accent's scarcity on decoration.

## Data marks

| Token | Hex | vs card | Role |
|---|---|---|---|
| `--viz-acc` | `#ff4b4b` | 3.16 | the cohort in question |
| `--viz-base` | `#555867` | 6.76 | context / baseline |
| `--viz-axis` | `#d5dae5` | — | axis rules, dumbbell track (rule-only, not a mark) |

Both marks clear the 3:1 floor against the card, and they are **2.14:1 apart from
each other**, which is the check people forget: two marks can each pass against
the background and still be indistinguishable from one another in greyscale or to
a reader with achromatopsia. A light grey is not available here — on a near-white
surface any grey pale enough to read as "de-emphasised" (gray60 `#a3a8b8` is
2.27:1) fails the mark floor, so de-emphasis is carried by a *dark* neutral beside
a saturated red.

That pairing is fixed. A hue must never mean one thing in one chart and something
else in the next.

### Form follows the data's job

| The data | Form | Never |
|---|---|---|
| Two headline numbers | `.statpair` stat tiles — the number *is* the chart | a two-bar chart |
| A paired before/after across items | `.db` dumbbell, gap is the point | grouped bars |
| One value against a limit | a meter with a same-ramp track | a two-slice pie |

Two rules `finalize.py` enforces: **declare the scale** (a bar whose track has no
labelled maximum implies a scale nobody stated), and **don't let ink imply a
verdict the data doesn't support** — 6.45% vs 6.90% is inside the noise, so it gets
stat tiles and a stated delta, not two nearly-equal bars in accusing colours. The
`.delta` bars that broke both are retired, and using them is a hard failure.

Direct-label every value. That keeps identity off colour alone, which is also the
accessibility answer for a report with no tooltip layer.

## Type

System sans throughout (`-apple-system` / `Segoe UI` / `Source Sans Pro`), matching
the app, with the display face the same stack at weight 700 and tighter tracking.
No webfont link: the report is opened from disk and from inside a sandboxed iframe,
and a blocked font request would leave the whole thing in a fallback nobody chose.

Mono is the system mono stack, used for chips, kickers, labels, captions, axis
ticks and code. Uppercase mono kickers at ~0.62rem with `.22em` tracking are the
workhorse label; they hold the technical register that keeps the polish from
reading as marketing.

## Components

- **`figure`** — full width, `--card-2` backing, mono caption. Note the backing is
  neutral rather than white: roughly half the baselines in this repo are
  dark-theme shots, and a white frame around a dark screenshot reads as a
  rendering bug.
- **`.ba`** — the before/after label on a stacked pair.
- **`.brief`** — the four-beat preamble (problem / why / approach / how), above the
  visual. One sentence per beat.
- **`.lbl`** — the PR's own `impact:*` / `change:*` labels in the header. The
  repo's review vocabulary, free to include, and it tells a reviewer what kind of
  change this is before they read a word.
- **`.viz`** — the picture for a PR with no UI: `.statpair` or the `.db` dumbbell
  with a labelled axis. `finalize.py` accepts either in place of an image.
- **`.pt`** — a numbered point: sub-head plus one muted paragraph. Two to five per
  PR; the section readers value most. The number badge is a `::before` on
  `data-n`, so no extra markup.
- **`.kv`** — stacked label/value rows. Use instead of any table wider than two
  columns.
- **`.chip`** — at most three per PR. One may be `.hero`.

## Motion and texture

No grain overlay, no glow. Both are dark-surface devices; on white, a glow reads
as a smudge and grain as a print artefact. The stamp keeps its slight rotation and
fade, and options animate on grading. No scroll-triggered reveals — this is read
under time pressure, and content that animates in on scroll actively slows
reading.

## Keep colour meaning stable

The reader learns the code once: **`--ok`** correct or resolved, **`--blue`** stale
or informational, **`--amber`** an accepted trade-off, **`--red`** worse, open, or
unverified, and **`--accent`** brand emphasis that never carries meaning on its
own. Never colour a number red just because it's the headline. A
worse-than-baseline number shown in `--red` while the surrounding story is
positive is the single most credibility-building detail available.
