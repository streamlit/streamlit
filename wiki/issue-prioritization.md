# Issue Prioritization

How to assign a priority to a bug or issue. Prioritization is one part of triage
(alongside choosing `type:*`, `feature:*`, and `area:*` labels).

The `priority:P0`–`priority:P3` GitHub labels are the canonical registry of
priority levels; this doc defines what each level means and what action it
implies. (`priority:P4` is deprecated — treat a low-impact but valid bug as P3,
or "Won't Fix" if it shouldn't be fixed at all.)

> For the purposes of these definitions, "users" means either "developers" or
> "viewers". For example, an issue that impacts most Streamlit developers who use
> a certain version would qualify as affecting "most users".

## P0

- A primary Streamlit user journey is effectively broken for nearly all users:
  - Install or upgrade Streamlit with pip, conda, pipenv, or poetry
  - Call `streamlit run` and view the app in a local browser
  - Run `streamlit hello` and view the app in a local browser
  - Make changes to an app locally and see the app auto-rerun
  - Use any non-experimental `st` command in an app
  - Author, install, or use a custom component
  - Create, update, or view an app in a core hosting platform (Community Cloud or
    Streamlit in Snowflake / SiS) — e.g. a Community Cloud "critical incident"
  - Deploy an app to a cloud platform with Docker and view the app from a browser
- A high-risk security or compliance issue, even if not immediately user-visible

**Action:** Must be addressed ASAP with a hotfix.

## P1

- Streamlit behavior blocks most users from doing something *without* a workaround
- A new or high-profile feature is visibly broken in a common scenario
- Streamlit behavior causes a "major incident" for an internal hosting partner
  (Community Cloud or SiS)
- A non-blocking but noticeable regression (>5% of users will notice) in a
  primary user journey or Streamlit behavior, including:
  - Performance regression
  - Visual or design issue
  - Behavior change that breaks backwards compatibility

**Action:** If found pre-release, we will not release. If found after release, we
should fix within 2 weeks and will assess a hotfix.

## P2

- Streamlit behavior blocks many users from doing something — but there is a
  workaround
- Something is visibly broken in an `experimental_` feature
- Streamlit behavior blocks many users from doing something with an officially
  supported dependency version — one Streamlit tests against (see the pinned
  minimums in
  [`scripts/assets/min-constraints-gen.txt`](../scripts/assets/min-constraints-gen.txt)) —
  or based on a judgment call
- A less noticeable regression (visual/design or performance) or confusing
  behavior

**Action:** If it's a regression and/or has a straightforward and low-risk fix,
we should try to fix it in the next release. Otherwise, assess case by case.

## P3

- Streamlit blocks users in specific situations (e.g. use of an outside
  dependency)
- Small stylistic changes
- Scenarios that have very specific situations and are difficult to reproduce

P3 is the lowest active priority. If an issue isn't worth fixing at all, it's a
"Won't Fix" (see below) rather than a lower priority. Upvotes/comments on GitHub
can indicate enough visibility to move an issue up to P2.

**Action:** Can be fixed opportunistically but should not be especially
prioritized by core engineers. We may also accept an outside contribution, or fix
it as a papercut.

## Won't Fix

- Issues caused by explicitly unsupported scenarios, such as an older browser
  version or a Python version that has been declared unsupported
- Low-visibility behavior change that may break backwards compatibility in some
  rare edge case, but benefits the majority of users

**Action:** In most cases we won't spend any time on it.

## For agents: reasoning about priority

**How to choose a level**

1. **Evaluate top-down (P0 → P3) and assign the highest level whose criteria are
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
     common container/layout combo = broad; an `experimental_` feature or a niche
     dependency = narrow)
   - 👍 reactions and comment volume on the issue.
   - Whether it's a regression, and how recent/widely-used the affected version
     is.
   - Whether a documented workaround exists.
4. **P3 is the lowest active priority.** Assign P3 to a valid but low-impact bug
   (specific situations, small stylistic issues, hard to reproduce). If it
   shouldn't be fixed at all, it's a "Won't Fix" rather than a priority.
   Meaningful visibility (reactions/comments) can justify moving up to P2. Do not
   use `priority:P4`; it is deprecated.
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
  breaks a common, non-experimental widget-in-container combination (and the
  broader class of BaseWeb overlays inside popovers) with no reliable workaround.
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
