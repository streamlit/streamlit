# Issue Prioritization

How to assign a priority to a bug or issue. Prioritization is one part of triage
(alongside choosing `type:*`, `feature:*`, and `area:*` labels).

The `priority:P0`–`priority:P4` GitHub labels are the canonical registry of
priority levels; this doc defines what each level means and what action it
implies.

> For the purposes of these definitions, "users" means either "developers" or
> "viewers". For example, an issue that impacts most Streamlit developers who use
> a certain version would qualify as affecting "most users".

## Quick mental model

A fast way to place an issue, using the classic urgency/importance split:

- **P0** — critical: must fix ASAP (drop everything, hotfix).
- **P1** — urgent *and* important: should fix ASAP (patch within ~1 week).
- **P2** — important: should fix soon (within ~2 weeks / the next release).
- **P3** — worth fixing, but not urgent: fix opportunistically, no committed ETA.
- **P4** — not worth fixing yet: valid, but wait for more user signal before
  investing.

The sections below give the detailed criteria and the action each level implies.
The levels overlap by design — assign the highest one whose criteria are met.

## P0

_Critical — must fix ASAP._

- A primary Streamlit user journey is effectively broken for nearly all users:
  - Install or upgrade Streamlit with pip, conda, pipenv, or poetry
  - Call `streamlit run` and view the app in a local browser
  - Run `streamlit hello` and view the app in a local browser
  - Make changes to an app locally and see the app auto-rerun
  - Use any `st` command in an app
  - Author, install, or use a custom component
  - Create, update, or view an app in a core hosting platform (Community Cloud or
    Streamlit in Snowflake / SiS) — e.g. a Community Cloud "critical incident"
  - Deploy an app to a cloud platform with Docker and view the app from a browser
- A high-risk security or compliance issue, even if not immediately user-visible

**Action:** Fix immediately (drop everything else) and roll out a hotfix/patch.

## P1

_Urgent and important — should fix ASAP._

- Streamlit behavior blocks most users from doing something *without* a workaround
- A new or high-profile feature is visibly broken in a common scenario
- Streamlit behavior causes a "major incident" for an internal hosting partner
  (Community Cloud or SiS)
- A non-blocking but noticeable regression (>5% of users will notice) in a
  primary user journey or Streamlit behavior, including:
  - Performance regression
  - Visual or design issue
  - Behavior change that breaks backwards compatibility

**Action:** If found pre-release, we will not release. Otherwise fix ASAP and
release via a patch (within ~1 week).

## P2

_Important — should fix._

- Streamlit behavior blocks many users from doing something — but there is a
  workaround
- Streamlit behavior blocks many users from doing something with an officially
  supported dependency version — one Streamlit tests against (see the pinned
  minimums in
  [`scripts/assets/min-constraints-gen.txt`](../scripts/assets/min-constraints-gen.txt)) —
  or based on a judgment call
- A less noticeable regression (visual/design or performance) or confusing
  behavior

**Action:** Fix with some urgency — within ~2 weeks, ideally in the next release.
If it isn't a regression and the fix isn't straightforward and low-risk, assess
case by case.

## P3

_Worth fixing, but not urgent._

- Streamlit blocks users in specific situations (e.g. use of an outside
  dependency)
- Small stylistic changes
- Scenarios that have very specific situations and are difficult to reproduce

A P3 issue is valid and worth fixing, just without urgency or a committed ETA. If
it isn't worth fixing until more people hit it, it's a P4 instead (see below).
Upvotes and comments on GitHub can indicate enough visibility to move an issue up
to P2.

**Action:** Fix opportunistically at some point; not especially prioritized by
core engineers. We may accept an outside contribution, or fix it as a papercut.

## P4

_Not worth fixing yet — wait for more signal._

- A valid but low-impact issue that doesn't currently justify a fix: a rare edge
  case, a very niche scenario, or a minor papercut with little demand
- Behavior that some may consider a bug but that we don't plan to change now — for
  example, an explicitly unsupported scenario (an older browser or an unsupported
  Python version), or a change that would only help a rare edge case while the
  current behavior benefits the majority

The difference from P3 is demand, not validity: P3 is worth fixing without
urgency, while P4 waits for additional user signal (👍 reactions, comments,
repeated reports) before we invest. Enough signal can promote a P4 up to P3 or P2.

**Action:** Acknowledge the issue as a valid, unexpected behavior, but don't
schedule a fix. Keep it open to gather engagement, and revisit if user signal
grows.

## For agents: reasoning about priority

**How to choose a level**

1. **Evaluate top-down (P0 → P4) and assign the highest level whose criteria are
   met.** The levels overlap by design; the distinguishing factors are *scope*
   (how many users), *whether a workaround exists*, and *whether it's a
   regression*. Do not stop at the first partial match — a bug with a workaround
   can still be P1 if the scope is large enough.
2. **Regressions bias upward.** A regression in a primary user journey or common
   scenario is at least P1. A less noticeable regression is at least P2. Treat
   `type:regression` as a strong signal.
3. **For the fuzzy quantifiers ("nearly all" / "most" / "many" / "specific
   situations"), use the available signals**, since you usually can't measure
   reach directly:
   - How common is the affected API or journey? (a core `st` command and a
     common container/layout combo = broad; a niche dependency or a rare
     interaction = narrow)
   - 👍 reactions and comment volume on the issue.
   - Whether it's a regression, and how recent/widely-used the affected version
     is.
   - Whether a documented workaround exists.
4. **Distinguish P3 from P4 by demand, not validity.** Both are valid bugs.
   Assign P3 when it's worth fixing but not urgent (specific situations, small
   stylistic issues, hard to reproduce). Assign P4 when it's valid but not worth
   fixing until more users hit it — acknowledge it and wait for additional signal.
   Meaningful visibility (reactions/comments) can promote either upward (P4 → P3,
   or up to P2).
5. **Some criteria reference a hosting partner's incident severity** — a
   "critical incident" (→ P0) or "major incident" (→ P1) on Community Cloud or
   Streamlit in Snowflake (SiS). This context usually isn't available on a GitHub
   issue; when it isn't, disregard it and rely on the other criteria.
6. **Measure reach by the broken behavior, not the affected surface.** Estimate
   how many users actually *hit and notice the regression*, not how many use the
   widget or code path it lives in. A bug on a default code path can still be low
   impact if only a narrow interaction is degraded while the common path keeps
   working. Ask: "In normal use, would a typical user notice something is wrong?"
   — if only a power-user pattern is affected, it usually falls below the P1
   ">5% will notice" bar.

## Examples

Real, recently-triaged issues and the priority the team assigned. Use these to
calibrate; the "why" shows the deciding criterion.

- **P0** — [#15959](https://github.com/streamlit/streamlit/issues/15959):
  `st.multiselect` options render below `st.popover`. A regression that visibly
  breaks a common widget-in-container combination (and the broader class of
  BaseWeb overlays inside popovers) with no reliable workaround.
- **P1** — [#15859](https://github.com/streamlit/streamlit/issues/15859):
  `st.date_input` calendar renders behind `st.dialog` (regression in 1.59.0). A
  high-profile widget is visibly broken in a common scenario; regression, limited
  workaround.
- **P2** — [#15863](https://github.com/streamlit/streamlit/issues/15863):
  `st.selectbox` with ~16k options freezes on open (performance regression). A
  noticeable regression, but it only bites with very large option lists — a
  subset of users — so it drops below P1.
- **P2** — [#15599](https://github.com/streamlit/streamlit/issues/15599):
  `st.selectbox` dropdown renders behind `st.dialog`. Same "overlay behind a
  container" family as the P1 example above — the priority difference reflects the
  team's assessment of reach/severity, not the bug class. Similar-looking bugs can
  land at different priorities.
- **P2** — [#16003](https://github.com/streamlit/streamlit/issues/16003):
  `st.selectbox` fuzzy search only matches contiguous substrings since 1.59.0.
  Hits the *default* `filter_mode`, but only *non-contiguous* queries regress —
  ordinary "type the start of the option" search still works, so the common
  journey is intact and only a subset notices. Default-path reach ≠ regression
  reach → P2, not P1.
- **P3** — [#15921](https://github.com/streamlit/streamlit/issues/15921):
  Keyboard focus indicator moves twice on the file-uploader control on Windows.
  Real but minor, specific to one control + platform, low reach.
