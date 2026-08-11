---
name: explaining-pull-requests
description: Turns a pull request into one short, visual, self-contained HTML report that catches a reader up on most of a PR in a fraction of the time reading the diff would take — leading with real before/after Playwright baselines, naming only the non-obvious parts, and ending with a quiz that proves it landed. Also prepares a PR-comment pitch for getting review attention. Use when someone wants to understand, explain, socialise, or get sign-off on a PR: "write up this PR", "explain what this branch does", "catch me up on #16385", "make something I can post on the PR", "quiz me before I approve", "PR report", "PR explainer", "review packet", "this PR went cold and I don't remember it". Also use for triaging a stale community PR. Prefer this over an ad-hoc markdown summary — the HTML report is the expected output.
---

# Explaining pull requests

**This report competes with reading the code.** If it isn't dramatically faster
than the diff, it has negative value — it's just one more thing to review. So the
target is most of the PR in a fraction of the time, and every instruction below
exists to protect that ratio.

Three consequences worth internalising before you start:

- **A picture does the work of a thousand words, so spend your effort there.** The
  visual is the payload, not decoration. This repo makes that unusually cheap:
  `e2e_playwright/__snapshots__/` holds committed baselines, so a PR that changes
  rendering ships its own before/after pictures.
- **Length is a cost, not a signal of care.** `scripts/finalize.py` enforces a
  word budget and fails the build above it. Cut prose, not visuals.
- **Only include what changes what the reader does.** Completeness is the enemy.
  The diff is already complete; the report's job is selection.

Explicitly out of scope: **CI status.** Nothing merges without green checks, so
reporting them is noise. A single dot in the header at most — never a table, a
stat tile, or a section.

## Output shape

Per PR, in this order and nothing else:

1. **The brief** — four beats, one sentence each: *problem*, *why now*,
   *approach* (including what was rejected), *how* (the mechanism). This comes
   before the picture, because a screenshot means far more once the reader knows
   what problem it solves. Orientation, not explanation.
2. **The visual** — full width, straight after the brief.
3. **Two stat chips** — files, and one number specific to this PR.
4. **What isn't obvious** — two to five items. **This is the section readers value
   most**, and the irreplaceable content. When you're over budget, trim the brief
   and the watch-out list before you trim these.
5. **Watch out for** — only when something real is open or undecided.
6. **Quiz** — four to six questions.

The PR-comment pitch is **clipboard-only**, behind the copy button. Do not also
render it as prose — that duplication is the biggest source of bloat.

Several PRs in one report is normal ("do these three"): tabs, one per PR.

## Workflow

### 1. Gather

```bash
uv run python .claude/skills/explaining-pull-requests/scripts/pr_facts.py <pr-ref> --out work-tmp/pr-report/facts
```

Accepts a URL, `owner/repo#123`, or a bare number. Writes `meta.json`, `diff.txt`,
`diffstat.txt`, `commits.txt`, `reviews.md`, `surface.json` and `visuals.json` per
PR.

`surface.json` classifies the changed files the way a reviewer reads them —
baselines, e2e tests, protos, elements, runtime, theme, type tests, and an
`external_risk_surface` bucket — plus any **added proto fields**. Use it for the
stat chip and as the starting point for step 3.

The script also asserts that its file count matches GitHub's. A fresh worktree has
no `origin/develop` ref, so a local `git merge-base` returns nothing and a diff
silently expands to the whole repo — a 3-file PR reads as 870. If that assertion
fails, stop: every conclusion downstream would be fiction.

For reading surrounding code, fetch **both** the PR head and the base:

```bash
git fetch origin pull/<N>/head:pr-<N>
git fetch origin develop:refs/remotes/origin/develop
```

### 1b. Has it already landed? (ask this first for any stale PR)

```bash
uv run python .claude/skills/explaining-pull-requests/scripts/superseded.py origin/develop pr-<N>
```

For a PR that has gone quiet — common on community contributions — the
highest-value thing you can discover is that its content already merged via
someone else's PR. Then the honest report is "close it", and everything else you'd
write is wasted. Check before investing in the rest.

This has its own script because the check is easy to get exactly backwards, and
backwards is worse than skipping it: it sends the reader off to salvage code that
is already on `develop`. `git diff A B` reports what changing *from A to B* would
do, so in `git diff --numstat <base> <head>` the first column is lines the **head**
has that the base lacks and the second is lines the **base** has that the head
lacks. Read them the wrong way round and "develop already has this test" becomes
"this test is all that's left".

So when you write a supersession claim, name the direction in words the reader can
check — "develop has 22 test lines this branch lacks", not "22 lines of test
remain". And note that a non-empty `git diff` does **not** mean not-superseded: a
branch whose only surplus is reworded docstrings is fully superseded. The script
separates comment-only surplus from executable surplus for exactly that reason.

### 2. Get the visual — this is the main event

**Tier 1: committed baselines.** Nearly always the best option available, and free.

```bash
uv run python .claude/skills/explaining-pull-requests/scripts/snapshot_pairs.py origin/develop pr-<N> \
    --out work-tmp/pr-report/<N>/snapshots
```

Pulls the *merge base* blob and the head blob straight out of git, so no test run
is needed. It also does the selecting, which is the whole problem: a single feature
PR can churn 50+ baselines across three engines, and a report showing all of them
is worse than one showing none. It keeps chromium, treats `[dark_theme-chromium]`
and `[light_theme-chromium]` as distinct states rather than duplicates, ranks by
the share of pixels that actually differ, and interleaves changed states with
newly added ones so a PR whose point is four new states doesn't rank them last.

Read the percentage as **extent, not importance**: a label shifting one pixel
repaints every glyph edge and scores in double digits. If a staged pair looks
identical to you, caption it as the subtle shift it is.

If `manifest.json` reports baselines it didn't stage, and the report reads as
though it covers every visual change, **say how many it left out**.

**Tier 2: images the author already attached.** The repo's PR template has a
literal `## Screenshot or video (only for visual changes)` heading, so authors are
prompted and the hit rate is high. `visuals.json` has them.

**Tier 3: capture it.** If the PR touches UI and tiers 1–2 came up empty, run the
app and drive it to the changed state. Follow
[debugging-streamlit](../debugging-streamlit/SKILL.md) — `make debug <app.py>` plus
a throwaway Playwright script in `work-tmp/debug/`, reusing
`e2e_playwright.shared.app_utils` and `wait_for_app_loaded`. Worth the time; this
is the highest-value thing you can do.

Note that empty tier 1 on a UI PR is itself a finding: either the change doesn't
alter rendering, or **the baselines were never regenerated**. Say which, and if
it's the latter, that belongs under *watch out for*.

Prefer **before/after pairs** and **multiple states** over one hero shot. A reader
understands a change from the contrast far faster than from a caption. A GIF only
when the change *is* motion — otherwise a labelled filmstrip.

**Tier 4: no UI exists** (runtime, server, caching, protobuf, config). Do not
fabricate a mockup, and do not fall back to prose. **Draw the numbers instead**,
with the form matched to the data's job — `references/design.md` has the table and
`finalize.py` enforces it:

- Two headline numbers → `.statpair` **stat tiles**. The number is the chart. A
  two-bar chart of `6.45%` vs `6.90%` makes a 0.45pp gap look like a verdict; stat
  tiles with the delta stated say what's true, including "inside noise".
- A paired before/after across items → the `.db` **dumbbell**, where the gap is
  the point, on an axis with **labelled ticks**. A bar whose track has no declared
  maximum implies a scale nobody stated.

Never invent an image. A stated absence is fine; a fabricated screenshot is a lie
the reader cannot detect.

### 3. Find what isn't obvious

Read the diff, then read the code it calls into. You're hunting for a small number
of specific things, because these are what the diff cannot tell the reader. In this
codebase they are usually one of:

- **Widget identity.** Widget IDs are computed from the element type plus its
  parameters, so adding or reordering a widget's proto fields can change the
  computed ID and silently reset user state on the next rerun. Appears nowhere in
  the diff, and it's the failure a reviewer most wants flagged.
- **proto3 scalar defaults.** A new field defaults to `false` / `0` / `""`, so an
  older frontend — or a host pinned to an earlier version — keeps the previous
  behaviour even though the diff reads as an unconditional change. Check
  `surface.json`'s `proto_added_fields`, then find where the frontend reads it.
- **Derived theme tokens.** Changing one token ripples to elements the diff never
  names; commit `39676223bc` exists because derived `codeBackgroundColor` and
  `dataframeHeaderBackgroundColor` were wrong. If `frontend/lib/src/theme/` is
  touched, work out the blast radius rather than describing the token.
- **Embedded and host-config behaviour.** Routing, auth, websocket lifecycle, CSP,
  cross-origin, static asset paths. If `external_risk_surface` in `surface.json`
  is non-empty, cross-reference
  [assessing-external-test-risk](../assessing-external-test-risk/SKILL.md).
- **Public API ripple.** A signature change in `lib/streamlit/elements/` pulls in
  type tests under `lib/tests/streamlit/typing/`, a docstring that becomes
  docs.streamlit.io, and `@gather_metrics`, whose metric name is externally
  visible.
- **Two things that look like one.** Two guards at different scopes, two config
  options at different precedence, hide-versus-dismiss. When the diff has a
  near-duplicate pair, one is load-bearing in a way the names hide. Say which.

Two to five of these, one short paragraph each. If you find eight, you're
including things that don't change what the reader does — keep the ones that do.
This section earns the largest share of the budget.

### 4. Watch out for

Only when it's real, and one line each:

- A user-facing change with **no e2e coverage**, or baselines that weren't
  regenerated. `surface.json` tells you both.
- **External-test risk** the author didn't assess.
- An open decision the reader is being asked to make.
- Something the author couldn't verify. Worth surfacing because "CI is green"
  doesn't cover it.
- `impact:users` with a title that won't survive the changelog generator.
- A figure quoted from the PR description rather than recomputed — give its age.
- A review finding that is **stale**: filed against an older commit, describing
  behaviour that no longer exists. Check with
  `git log -S'<distinctive string>' --format='%h %ad %s'` rather than trusting the
  comment. Worth a line because it stops the reader re-litigating settled work.

Omit this section entirely when there's nothing in it. An empty "no known risks"
block is pure bloat.

### 5. Build

Copy `assets/template.html` and fill it in. The CSS and JS are complete — don't
re-derive them. `references/design.md` has the palette with measured contrast and
the narrow-viewport rules; read it before changing anything visual.

Two things there that are easy to get wrong: the brand red `#ff4b4b` measures
3.16:1 on the card surface, so it may **never** be small text (use `--accent-deep`);
and figures sit on a neutral backing rather than white, because half the baselines
in this repo are dark-theme shots.

**Assume a narrow viewport.** The template is single-column and fluid, with no
side-by-side grids. Keep tables to two columns — anything wider is unreadable at
380px, so use the `.kv` list instead.

### 6. Quiz

Four to six questions. They test *consequences*, so ask what would change the
reader's decision, and skip anything answerable from the diff's line numbers. The
material is what you found in step 3 — that's why that step matters.

Phrase each as a scenario with a concrete outcome ("a developer does X under
condition Y — what happens?"). A scenario forces a mental simulation; a
definitional question only invites recognition.

Four options. The best distractor is what a smart reader who skimmed would pick,
and the explanation should say why it was tempting — that's where the learning is.
Gating behaviour is already implemented: 100% to clear, incomplete attempts aren't
graded, reset re-arms.

### 7. Finalize

```bash
uv run python .claude/skills/explaining-pull-requests/scripts/finalize.py <report.html>
```

Inlines local images as base64, enforces the word budget, and validates the quiz —
that each answer key agrees with the letter its explanation names, that options are
well-formed, that counts are right. A mis-keyed quiz is worse than none: it teaches
the wrong answer and stamps it "cleared". Failures are hard failures.

Inlining is required, not a convenience: the report is viewed through an iframe
with no base URL, so a relative `<img src>` resolves to nothing.

If it fails on length, cut prose. Do not cut visuals, and do not raise the budget
to make the error go away — the budget *is* the feature.

### 8. Show it, then offer to share it

Open it locally: `open work-tmp/pr-report/<N>.html`. Point at the one thing most
worth looking at first.

To put it in front of reviewers, upload it alongside the PR's other artifacts
following [sharing-pr-agent-artifacts](../sharing-pr-agent-artifacts/SKILL.md) —
`agent-wiki/pull-requests/<N>/report.html`, which serves at
`https://issues.streamlit.app/agent_wiki_explorer?file=pull-requests/<N>/report.html`.
The explorer renders HTML in a sandboxed iframe, so the quiz works there.

Then **stop and ask before posting anything.** Write the pitch to a file and offer
`gh pr comment <N> --body-file <path>`; never post it unprompted. The wiki is a
public repo and the PR thread is public, so the report must contain nothing you
wouldn't put in a GitHub comment.

Finally, say what you haven't verified: you validated the report's structure, not
its appearance — you can't see the rendered page. Offer to fix what a human
notices. And if any figure came from a PR description rather than being recomputed,
give its age, because stale numbers presented as current are the one way this
report can actively mislead.

## Related skills

- [debugging-streamlit](../debugging-streamlit/SKILL.md): running the app and
  capturing screenshots when no baseline exists
- [sharing-pr-agent-artifacts](../sharing-pr-agent-artifacts/SKILL.md): hosting the
  finished report so it can be linked from the PR
- [assessing-external-test-risk](../assessing-external-test-risk/SKILL.md): whether
  a change needs external e2e coverage
- [addressing-pr-review-comments](../addressing-pr-review-comments/SKILL.md): for
  acting on feedback rather than explaining the PR
