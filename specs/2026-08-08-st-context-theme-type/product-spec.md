---
author: mayagbarnes
created: 2026-08-08
---

# Make `st.context.theme.type` correct in all situations

## Summary

`st.context.theme.type` should reliably return `"light"` or `"dark"` on the first script run of a session and
whenever appearance changes (menu, host, or OS) — without regressing multipage deep links
([#11920](https://github.com/streamlit/streamlit/issues/11920)).

This product spec owns the decision of **what `type` means** now that appearance preference and application theme
are separate. See the [tech spec](./tech-spec.md) for protocol, backend resolution, and the MPA-safe auto-rerun
design.

## Problem

### Motivation / demand

[#11920](https://github.com/streamlit/streamlit/issues/11920) is currently the **highest-upvoted open theming
issue** on the Streamlit tracker (21 👍 as of this writing — ahead of other open `feature:theming` issues).

Correctness here is also a prerequisite for any future expansion of `st.context.theme`
([#11536](https://github.com/streamlit/streamlit/issues/11536)): more fields on a still-stale object would
inherit the same first-run and appearance-change bugs. Note that #11536's direction is itself contested —
exposing the whole theme means attaching many properties to every rerun, and CSS variables on the frontend
([#4198](https://github.com/streamlit/streamlit/issues/4198)) are arguably the better answer for the underlying
use case of styling custom HTML. This spec takes no position on that; it only fixes what exists.

### Use cases

Developers use `st.context.theme.type` to adapt app content to the active theme:

```python
# 1. Contrast-aware assets (logos, hero images)
logo = "logo-on-dark.svg" if st.context.theme.type == "dark" else "logo-on-light.svg"
st.image(logo)

# 2. Chart / Plotly color schemes that match the app
fig.update_layout(
    template="plotly_dark" if st.context.theme.type == "dark" else "plotly_white"
)

# 3. Custom Markdown / HTML styling
bg = "#0e1117" if st.context.theme.type == "dark" else "#ffffff"
st.markdown(f'<div style="background:{bg}">…</div>', unsafe_allow_html=True)

# 4. Custom components / iframes that need to match Streamlit chrome
# (also relevant for future st.iframe inject_theme; see st-iframe product spec)
```

A secondary ask (seen in forum/issue comments) is matching the **user's** light/dark intent elsewhere. That may be
preference, not painted appearance — which is why the semantics choice below matters.

### Where it fails today

After [#10972](https://github.com/streamlit/streamlit/pull/10972) shipped `type`, an automatic theme-change rerun
broke multipage deep links when `[theme]` was set ([#11797](https://github.com/streamlit/streamlit/issues/11797)).
[#11870](https://github.com/streamlit/streamlit/pull/11870) removed that rerun to fix MPA. Documented tradeoff →
[#11920](https://github.com/streamlit/streamlit/issues/11920):

1. **First run with a custom theme** — `type` can reflect a cached/preset theme, not the custom theme that paints
   after `NewSession`.
2. **Settings / main-menu / host appearance change** — UI updates immediately; `type` stays stale until a later
   unrelated rerun ([#15287](https://github.com/streamlit/streamlit/issues/15287)).

### Why the meaning of `type` is newly ambiguous

The main menu separates **appearance preference** (System / Light / Dark) from **application theme** (defaults vs
custom vs custom light/dark). Before that split, preference and theme were effectively tied. Now `type` can mean
three different things (current docs describe **C** — "inferred from the background color"):

| Meaning                    | What it answers                     | Source of truth                                                                         |
| -------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| A. User/browser preference | "What did the user/system ask for?" | Menu selection / OS `prefers-color-scheme`                                              |
| B. Theme identity          | "Which application theme is active?" | The theme name/variant: Default Light, Default Dark, Custom, Custom Light, Custom Dark  |
| C. Visual appearance       | "Does the app look light or dark?"  | `base` / luminance of the rendered background                                           |

A/B/C agree for presets and well-authored dual themes. They diverge for a single custom theme whose appearance
differs from OS preference, and for pathological section colors — see the behavior matrix below.

### Related issues

| Issue                                                         | Role                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [#11920](https://github.com/streamlit/streamlit/issues/11920) | Umbrella: make `type` correct in all situations (highest-upvoted open theming issue) |
| [#11797](https://github.com/streamlit/streamlit/issues/11797) | MPA deep-link regression (closed by #11870)                                          |
| [#15287](https://github.com/streamlit/streamlit/issues/15287) | No auto-update on settings theme change (dup of #11920)                              |
| [#11536](https://github.com/streamlit/streamlit/issues/11536) | Expose all theming config options — out of scope, and its direction is contested (see #4198)  |
| [#5009](https://github.com/streamlit/streamlit/issues/5009)   | Original light/dark detection request (closed by #10972)                             |

## Proposal

### What `type` means — options for review

**Option C: Visual appearance of the active theme** ✅ PREFERRED

`type` answers "does the app look light or dark?" Resolve from the active theme/section:

1. If `backgroundColor` is a color the backend can parse — hex in 3, 4, 6, or 8 digits
   (with or without the leading `#`), a CSS named color, `rgb()`, or `hsl()` → use its
   luminance, since that is what gets painted. Alpha channels are ignored, matching the
   frontend. A value in a syntax the backend cannot parse falls through to step 2, and the
   frontend corrects it (see the [tech spec](./tech-spec.md) §4).
2. Else if `base` is `"light"` or `"dark"` → use it (it determines which preset background
   fills in):
   - **Single `[theme]`:** `base` is whatever the user set, if anything.
   - **Dual themes:** `base` is always present, because the frontend forces it from the
     section variant via `handleSectionInheritance` (e.g. `"dark"` for `[theme.dark]`) — so
     step 2 always applies unless a hex `backgroundColor` is set. Note that `base` is not a
     valid key inside `[theme.light]` / `[theme.dark]`; only `[theme]` accepts it.
3. Else `"light"` (the frontend default for single `[theme]` when `base` is unspecified).

**Sidebar-only configs:** Setting only `[theme.sidebar]` (without any main-area keys in
`[theme]`, `[theme.light]`, or `[theme.dark]`) still creates a custom theme on the FE —
the main area inherits from `lightTheme` and always paints light. The resolver detects
sidebar sections and enters the single-custom-theme path (returning `"light"` via the
fallback), which matches what is painted. Similarly, `[theme.light.sidebar]` or
`[theme.dark.sidebar]` trigger dual-theme mode on the FE (the FE's `hasThemeSectionConfigs`
recursively checks nested objects); the resolver mirrors this by entering the dual-theme
path when sidebar subsections are present.

- Pros: Matches today's docs; matches the primary "contrast my content" use case; single dark custom theme
  correctly reports `"dark"` even if OS preference is light.
- Cons: Pathological misauthored sections (dark section, light bg) report what is _seen_, not what the section is
  _named_; preference alone is not exposed on `st.context.theme`.

**Option A: User preference**

`type` ≈ menu/OS selection (`"light"` / `"dark"`; System resolved to OS).

- Pros: Simplest implementation (little/no config branching on the backend).
- Cons: Wrong for the primary use case when a single custom theme's appearance disagrees with OS preference;
  contradicts current docs; "auto" intent is lost unless we expand the type.

**Option B: Theme identity**

`type` returns a descriptive identifier of the active application theme — not a binary light/dark classification
but the theme itself. Possible values could include `"Default Light"`, `"Default Dark"`, `"Custom"`,
`"Custom Light"`, `"Custom Dark"`, etc.

- Pros: Most expressive; developers can distinguish custom themes from presets and branch on specific theme
  variants; no ambiguity from luminance thresholds; future-proof if theme types grow beyond light/dark.
- Cons: Breaks the existing `Literal["light", "dark"]` return type contract; forces developers to handle an
  open-ended set of values instead of a simple binary check; doesn't directly answer the primary use case ("should
  I use light or dark contrast for my chart/logo?"); theme identity strings may change across Streamlit versions or
  when users rename their config sections; developers still need to know whether a given theme identity implies
  light or dark appearance, so a luminance/base classification is needed _in addition_ to identity.

**Review ask:** Accept Option C (preferred), or choose A/B and adjust the tech resolver accordingly.
Implementation of correctness (first run + appearance-change rerun) proceeds either way; only resolution rules and
docstring wording change.

### Expected `type` under Option C (behavior matrix)

| Config                                               | Preference sent      | Expected `type`              |
| ---------------------------------------------------- | -------------------- | ---------------------------- |
| Presets only                                         | `"light"` / `"dark"` | Same as preference           |
| Single `[theme]` with `base = "dark"`                | `"light"`            | `"dark"`                     |
| Single `[theme]` with `#121212` bg, no `base`        | `"light"`            | `"dark"` (hex luminance)     |
| Single `[theme]` with `#fff` bg, no `base`           | `"light"`            | `"light"` (short hex → luminance) |
| Single `[theme]` with non-hex bg, no `base`          | `"light"`            | `"dark"` for `backgroundColor = "black"` — the painted value. Named colours, `rgb()` and `hsl()` are parsed on the backend, so this is correct on the first run with no extra rerun |
| `[theme.light]` + `[theme.dark]`, both well-authored | `"dark"`             | `"dark"` (section bg or forced variant base) |
| `[theme.dark]` with light hex bg (pathological)      | `"dark"`             | `"light"` (what is painted)  |
| Only `[theme.sidebar]` set (no main-area config)     | `"dark"`             | `"light"` (main area = lightTheme) |
| Host dark theme (SiS/Cloud) overriding config        | `"dark"` (host)      | `"dark"` (host wins)         |

### User-facing behavior (reliability)

Independent of A/B/C, once fixed:

1. **First script run** — `type` is correct for that run (including `[theme]` / `[theme.light]` / `[theme.dark]`).
   - *Caveat:* In the few cases where the backend cannot determine the appearance itself — an embedding host
     (SiS/Cloud) that pushes its own theme after the app connects, or a `backgroundColor` in a CSS syntax the
     backend cannot parse — the first run may briefly hold the other value. The backend reports what the script
     saw, the client notices the disagreement, and one immediate auto-rerun corrects it; see the
     [tech spec](./tech-spec.md) §4. Apps that only render from `type` see a flicker at worst; apps with side
     effects on their first run would perform them with the earlier value.
2. **Appearance change** (menu System/Light/Dark, host theme message, OS change while on System) — for apps that
   read `st.context.theme`, the app reruns and `type` updates without a manual rerun. Apps that never read it are
   **not charged per theme change**: `type` is read by roughly 0.6% of apps, so the correction is gated on actual
   use rather than charged to everyone. Precisely, a no-read app pays **at most one** correction per session — on
   the first appearance change after load, and only if no other rerun happened first — then none thereafter. Not
   zero, because the first `NewSession` is sent before any user code can declare a read; see the
   [tech spec](./tech-spec.md) access gate.
3. **MPA deep links** — non-default page + `[theme]` still lands on that page (no #11797 regression).
4. **CSS overrides** — injected CSS backgrounds remain out of scope for `type`.
5. **Host theme vs config.toml** — runtime host themes (`SET_CUSTOM_THEME_CONFIG`) replace config.toml on the
   frontend (no merge, last-write-wins). Pre-load host customizations (`LIGHT_THEME`/`DARK_THEME`) merge into
   presets only but do not propagate into config.toml custom themes. `type` always reflects what is painted —
   including after the user switches between a host theme and a config.toml theme in the settings menu.

### API surface

No new public parameters or commands:

```text
st.context.theme.type → Literal["light", "dark"] | None
```

`None` is only expected when there is no script-run context (e.g. imported helper code outside a run). In a normal
app script after connect, `type` should be `"light"` or `"dark"` — including on the first run once this fix lands.
Prefer guarding with `if st.context.theme.type == "dark":` rather than treating `None` as a third theme mode.

A separate public preference field (e.g. `st.context.theme.preference` → `"light"` | `"dark"` | `"auto"`) would
let A and C coexist. That is **out of scope** for #11920 and belongs with
[#11536](https://github.com/streamlit/streamlit/issues/11536).

## Out of scope

- Exposing all theming config options on `st.context.theme`
  ([#11536](https://github.com/streamlit/streamlit/issues/11536)) — intentionally deferred until this correctness
  path is solid; this work is a prerequisite, not a substitute.
- Public `st.context.theme.preference` (or equivalent).
- Making CSS-injected backgrounds affect `type`.
- Programmatic theme setters at runtime ([#14172](https://github.com/streamlit/streamlit/issues/14172)).

## Checklist

| Item                       | ✅ or comment                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | Yes — host theme messages update `type`; re-enables the hostframe E2E skipped since #11870 |
| No breaking API changes    | Attribute name/shape unchanged; semantics clarified and made reliable                                 |
| No new dependencies        | Yes — backend color parsing uses `PIL.ImageColor`, already a runtime dependency               |
| Metrics collected          | Existing `context.theme` metrics remain; no new public API                                            |
| Any security/legal impact? | No                                                                                                    |
| Any docs changes needed?   | Yes — docstring/docs must match the chosen A/B/C meaning and drop stale first-load / settings caveats |

## Open questions

These are sign-off gates on the **implementation** PR, not blockers for agreeing the direction
here. Merging this spec settles the meaning of `type` (Option C) and the preferred approach;
these four still need an explicit answer before the implementation lands:

1. **Adoption vs. cost.** `st.context.theme.type` is read by roughly **0.6% of apps**. The tech spec's access
   gate keeps the other 99.4% free of extra reruns, and its scope decision offers a lighter variant that drops
   the backend resolver at the price of a visibly wrong first paint. Which variant do we want?
2. **Public preference later?** Should a follow-up add `st.context.theme.preference` so preference and
   appearance can both be queried? (Reviewer feedback so far: preference and theme identity are not useful on
   the backend, so probably not.)
3. **System + OS change:** When the selection is System and the OS flips light↔dark, the app reruns so `type`
   keeps up. Is an automatic rerun on an OS-level change what we want, given the script re-executes without
   the user touching anything?
4. **SiS / embedded hosts:** Any host-specific constraints on sending preference, or on auto-rerunning in
   response to `SET_CUSTOM_THEME_CONFIG`, beyond what the hostframe E2E covers?
