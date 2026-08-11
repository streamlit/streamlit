---
author: mayagbarnes
created: 2026-08-08
---

# Make `st.context.theme.type` correct — tech design

## Summary

Fix `st.context.theme.type` by having the client send a resolved appearance preference
(`"light"` | `"dark"`) on every rerun, and having the backend resolve the effective type
from that preference plus `config.toml` **before** the script runs — plus an MPA-safe
auto-rerun when appearance changes via menu, host, or OS.

See the [product spec](./product-spec.md) for the A/B/C semantics decision and
user-facing behavior. This tech spec is written against **Option C** (visual appearance);
if product picks A or B, adjust §2 only.

## Problem

### Current data path

```text
FE getThemeColorScheme()  →  ContextInfo.color_scheme  →  st.context.theme.type
```

`color_scheme` is inferred from the active frontend theme’s background luminance
([`App.getThemeColorScheme`](../../frontend/app/src/App.tsx)) and sent inside
`BackMsg.rerun_script`. Custom theme config arrives later in `NewSession.custom_theme`
via [`_populate_theme_msg`](../../lib/streamlit/runtime/app_session.py). There is no
backend resolution of `type` today.

### Chicken-and-egg on first run

1. Client sends first `BackMsg` with `color_scheme` from a cached/preset theme.
2. Server runs the script (Python already has that `color_scheme`).
3. Server sends `NewSession` with custom theme from `config.toml`.
4. FE applies custom theme via `processThemeInput` → UI is correct; Python is stale.

The only entity that has **both** preference **and** `config.toml` at first-run time is
the backend. True first-execution correctness requires backend resolution (or a slower
pre-session handshake — rejected below).

### Why the old auto-rerun broke MPA

[#10972](https://github.com/streamlit/streamlit/pull/10972) added:

```tsx
if (prevProps.theme.activeTheme.name !== this.props.theme.activeTheme.name) {
  this.sendRerunBackMsg()
}
```

Theme **name** changes for system-internal reasons — page navigation / connect /
reconnect → `NewSession` → `processThemeInput` remaps `"Light"` → `"Custom Theme"` →
extra `rerun_script` → page context not preserved → deep link bounces to the default
page ([#11797](https://github.com/streamlit/streamlit/issues/11797)). [#11870](https://github.com/streamlit/streamlit/pull/11870)
removed that path. **Do not restore** name-based `componentDidUpdate` reruns.

## Proposal

### High-level flow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend

    FE->>FE: Resolve System to OS light/dark
    FE->>BE: BackMsg.rerun with theme_preference
    BE->>BE: resolve_theme_type(preference, config.toml)
    BE->>BE: Set context_info.color_scheme before ScriptRunner
    BE->>BE: Script runs; st.context.theme.type is correct
    BE->>FE: NewSession.custom_theme for UI paint
```

Preference selects which theme **branch/section** is active. Under Option C, `type` is
then derived from that theme’s `base` / background (preference `"light"` + single dark
custom theme → `type` `"dark"`).

**Implementation order:** proto → backend resolver (+ unit tests) → FE preference on
every BackMsg → FE auto-rerun hooks. Do not start auto-rerun work until the BE resolver
is tested in isolation.

### 1. Proto

In [`ClientState.proto`](../../proto/streamlit/proto/ClientState.proto), add to
`ContextInfo`:

```protobuf
// Resolved appearance from the client: "light" or "dark".
// System menu selection must be resolved to OS preference before send.
optional string theme_preference = 7;

// True when a host-provided custom theme (SET_CUSTOM_THEME_CONFIG) is active.
// When set, the backend skips config.toml resolution and uses theme_preference
// directly — the host theme overrides config and only the FE knows its appearance.
optional bool host_theme_active = 8;
```

Keep `color_scheme` as what Python exposes via `st.context.theme.type`. When
`theme_preference` is present, the backend overwrites `color_scheme` before the script
run. When `host_theme_active` is true, the backend returns `theme_preference` directly
(config.toml is irrelevant — the FE is painting the host theme, not the config theme).
**Old clients without fields 7-8 keep working:** the backend leaves `color_scheme` as
sent, so existing deployed frontends against a new backend do not regress.

### 2. Backend resolver

Add `lib/streamlit/runtime/theme_type.py` (sketch under Option C):

```python
def resolve_theme_type(
    preference: Literal["light", "dark"],
) -> Literal["light", "dark"]:
    theme = config.get_options_for_section("theme")
    light = config.get_options_for_section("theme.light")
    dark = config.get_options_for_section("theme.dark")

    if not _has_any_theme_config(theme, light, dark):
        return preference  # presets only

    if _has_section_content(light) or _has_section_content(dark):
        section = dark if preference == "dark" else light
        merged = _merge_for_dual_theme(theme, section)
        # fallback = preference (which equals the section variant name, e.g.
        # "dark" for [theme.dark]) — mirrors the FE behavior where selecting
        # the dark section implies dark appearance when no explicit base/bg.
        return _type_from_bg_or_base(merged, fallback=preference)

    # Single custom theme — if neither bg nor base is set, FE defaults to
    # light preset (no base → inherits from lightTheme).
    return _type_from_bg_or_base(theme, fallback="light")


def _merge_for_dual_theme(parent: dict, section: dict) -> dict:
    """Merge parent [theme] into a light/dark section for type resolution.

    Section values override parent (mirrors frontend handleSectionInheritance).
    Parent's `base` is explicitly DROPPED — the FE never inherits `base` from
    [theme] into a section. If the section explicitly sets `base`, that is kept.
    If neither section nor parent provides `base`, the caller's `fallback`
    parameter (= section variant name) provides the final answer.

    This ensures:
    - [theme] base="light" + [theme.dark] primaryColor="..." (no base in
      section) → parent base dropped → no base in merged → fallback "dark"
      (= preference = section variant). Correct.
    - [theme.dark] backgroundColor="#ffffff" (pathological) → parent base
      dropped → bg luminance → "light" (what is painted). Correct.
    - [theme.dark] base="dark" → section's explicit base is kept. Correct.
    """
    # Filter None values — get_options_for_section includes all registered keys
    # even when unset. Only non-None values represent user-provided config.
    parent_set = {k: v for k, v in parent.items() if v is not None}
    section_set = {k: v for k, v in section.items() if v is not None}
    merged = {**parent_set, **section_set}
    if "base" not in section_set:
        merged.pop("base", None)
    return merged


def _type_from_bg_or_base(opts: dict, *, fallback: str) -> str:
    bg = opts.get("backgroundColor")
    if _is_six_digit_hex(bg):
        return "light" if _hex_luminance(bg) > 0.5 else "dark"
    base = opts.get("base")
    if base in ("light", "dark"):
        return base
    return fallback
```

**`_hex_luminance` must match the frontend formula exactly:** Use WCAG relative luminance
(sRGB linearization + BT.709 coefficients) with threshold `> 0.5`, identical to the
frontend's `hasLightBackgroundColor` / color2k `getLuminance`. A divergent Python
implementation would disagree with painted appearance for near-threshold hex backgrounds.
Add a cross-check unit test comparing Python `_hex_luminance` against known FE outputs
for boundary colors (e.g. `#7f7f7f`, `#808080`).

**`_has_section_content`** returns True when the section has at least one option with a
non-None value. `get_options_for_section` returns all registered option keys for the
section (even when the user didn't write that TOML header), so checking truthiness of
the dict is insufficient — filter None values:

```python
def _has_section_content(section: dict) -> bool:
    return any(v is not None for v in section.values())
```

A bare `[theme.dark]` header with no keys underneath has all-None values → returns
False. This matches the FE's behavior, which also requires at least one key to trigger
dual-theme mode.

| Config shape | How to get `type` (Option C) |
|--------------|------------------------------|
| No custom theme (presets) | Return `preference` |
| Single `[theme]` only | `_type_from_bg_or_base` with `fallback="light"` (FE default) |
| `[theme.light]` and/or `[theme.dark]` | Pick section from `preference`, drop parent `base`, then `_type_from_bg_or_base` with `fallback=preference` (= section variant name) |

Wire in [`app_session.request_rerun`](../../lib/streamlit/runtime/app_session.py) after
copying client `context_info` into `RerunData`. **Resolution targets the cached
`_client_state` copy** so that server-initiated reruns (e.g. run-on-save) also use the
resolved value:

```python
if client_state.HasField("context_info"):
    self._client_state.context_info.CopyFrom(client_state.context_info)
    ctx = self._client_state.context_info
    if ctx.HasField("theme_preference"):
        if ctx.host_theme_active:
            # Host theme overrides config.toml — FE already resolved appearance.
            ctx.color_scheme = ctx.theme_preference
        else:
            ctx.color_scheme = resolve_theme_type(ctx.theme_preference)
```

**Critical — required wiring change:** Today `request_rerun` builds
`RerunData(context_info=client_state.context_info)` from the incoming parameter (not
`self._client_state`). This must be changed: after resolving `color_scheme` on
`self._client_state.context_info` (snippet above), `_create_rerun_data` (or equivalent)
must pass `self._client_state.context_info` into `RerunData` so the resolved value
reaches the script. Without this change, the script still sees the unresolved
`color_scheme` from the raw BackMsg.

Applies to **full-script and fragment** reruns alike.

**Required unit test:** Assert that when two distinct `client_state` BackMsg objects arrive
(simulating a preference change), the `RerunData.context_info.color_scheme` exposed to
the script equals the BE-resolved value (from `self._client_state`), not the raw value
from the incoming parameter.

If product picks **Option A**, this collapses to
`color_scheme = theme_preference`. If **Option B** (theme identity), return a
descriptive string like `"Default Light"`, `"Custom"`, or `"Custom Dark"` instead of
a binary light/dark classification — requires changing the return type and downstream
`st.context.theme.type` contract.

### 3. Frontend: send preference on every rerun

In [`App.sendRerunBackMsg`](../../frontend/app/src/App.tsx) / `contextInfo`:

```ts
themePreference: this.getResolvedThemePreference(), // "light" | "dark"
hostThemeActive: this.isHostThemePainted(),
```

`isHostThemePainted()` returns `true` only when the host-imported theme is what is
currently rendered — i.e. the theme installed by `handleThemeMessage` has not been
replaced by a menu selection, config.toml theme, or embed override:

```ts
private isHostThemePainted(): boolean {
  if (this.hostThemePreference == null) return false
  if (this.hasEmbedThemeOverride()) return false
  // The active custom theme name must still be the host-imported one
  return this.props.theme.activeTheme.name === this.hostImportedThemeName
}
```

`hostImportedThemeName` is set in `handleThemeMessage` alongside `hostThemePreference`.
This avoids a sticky flag: if the user picks a different theme from the menu (which calls
`setAndSendTheme`), the active theme name changes and `isHostThemePainted()` returns
false — no need to explicitly clear `hostThemePreference` in every non-host path.

`hasEmbedThemeOverride()` returns `true` when embed query params (`embed_options=light_theme`
or `embed_options=dark_theme`) are present — these already exist in the codebase and force
a preset theme regardless of host or menu selection. When an embed override is active, the
FE paints the preset variant (not the host custom theme), so config.toml resolution on the
BE remains correct and `hostThemeActive` must be false.

**Source of truth** (do not reverse-engineer from active custom theme name after
`processThemeInput`):

1. Existing embed query options `embed_options=light_theme` /
   `embed_options=dark_theme` (already used by host embedding — not a new protocol)
   if present.
2. Host-provided custom theme (`SET_CUSTOM_THEME_CONFIG` / `handleThemeMessage`) →
   resolve appearance from `themeInfo.backgroundColor` luminance. Store as
   `hostThemePreference` (and `hostImportedThemeName`) on the App instance in
   `handleThemeMessage` after applying the theme. This covers SiS / Cloud hosts that
   push themes without going through the menu or embed queries.
3. Else tracked `ThemeSelection` (`Light` / `Dark` / `System`), with
   `System` → `getSystemThemePreference()`.
4. `getCachedThemeSelection()` only for initial hydrate.

`getResolvedThemePreference()` checks these in order: embed query → host override →
menu/OS selection.

Maintain `lastRerunAppearance` on the App instance (see §4 for semantics); update it
with painted luminance whenever a rerun BackMsg is sent. Keep sending `colorScheme` for
back-compat if useful; BE overwrites when `theme_preference` is present.

**Backward compatibility:** New backend + old frontend (no `theme_preference`) leaves
`color_scheme` untouched — existing deployed clients do not regress. New frontend +
old backend ignores the unknown field until both sides are upgraded; once both are
new, BE overwrites `color_scheme` from preference + config.

**Host theme vs config.toml precedence:** Two distinct host mechanisms exist:

1. **Pre-load** (`window.__streamlit.LIGHT_THEME` / `DARK_THEME`): merges host colors
   into the preset Light/Dark themes via `getMergedLightTheme()`. These merged presets
   appear in the theme picker. However, `createTheme` for config.toml custom themes
   inherits from the **static** `lightTheme`/`darkTheme` (never the merged ones), so
   pre-load host colors do NOT propagate into config.toml custom themes. When no custom
   `[theme]` is configured (presets only), the resolver returns `preference` — correct,
   since hosts customize within the same dark/light family.

2. **Runtime** (`SET_CUSTOM_THEME_CONFIG` postMessage): creates a standalone custom
   theme via `setImportedTheme` → `createTheme(name, proto)`. No merge with config.toml
   — last-write-wins. In practice the host theme arrives after `NewSession` so it
   replaces config.toml entirely. When `host_theme_active` is true, config.toml colors
   are not painted — BE must not resolve from them.

**Known limitation — host theme first-run race:** If the host sends its theme *after*
the FE's first BackMsg (rare — hosts typically send during iframe init handshake before
WebSocket connects), the first script run resolves from config.toml (potentially wrong).
The auto-rerun in §4 corrects this within milliseconds once the host theme arrives and
luminance changes. This is acceptable because: (a) the race is uncommon in practice, (b)
the correction is immediate and invisible to users, and (c) solving it fully would
require a new protocol where the host pushes theme to the server, not just the iframe.

### 4. MPA-safe auto-rerun on appearance change

#### Design: unified `componentDidUpdate` appearance-diff with suppression flag

All three trigger sources (menu toggle, host message, OS preference change) produce
the same observable: `props.theme.activeTheme` changes its visual appearance in
`App.tsx`. A single `componentDidUpdate` check handles all three. The only path to
suppress is `processThemeInput` (called during `handleNewSession`).

#### Implementation

**1. Instance fields:**

```tsx
private lastRerunAppearance: "light" | "dark" | null = null
private skipNextThemeUpdate: boolean = false
private pendingThemeRerun: boolean = false
private hostThemePreference: "light" | "dark" | null = null
private hostImportedThemeName: string | null = null
```

- `lastRerunAppearance` — tracks the **painted appearance** (luminance) at the time
  of the last `sendRerunBackMsg`. Used as a dedup guard: prevents firing another
  auto-rerun when the visual state hasn't changed since the last rerun. This is
  intentionally distinct from what `themePreference` (menu/OS) was *sent* in the
  BackMsg — the trigger/dedup dimension is what the user *sees*, not what they
  *selected*, because a preference change that doesn't flip painted luminance (e.g.
  toggling Light→Dark with a single dark custom theme) doesn't require a rerun (the
  backend resolver returns the same `type` either way).
- `skipNextThemeUpdate` — set by `processThemeInput` when it applies a server-sent
  custom theme. Consumed (cleared) by the next `componentDidUpdate` to prevent that
  render from triggering an auto-rerun.
- `pendingThemeRerun` — set when a theme change arrives while the script is running
  or a rerun is already requested. Ensures the rerun fires once the script becomes
  idle, rather than being silently dropped.

**2. In `processThemeInput`, after the hash-check early return (~line 1738), before
`this.setState`:**

```tsx
this.skipNextThemeUpdate = true
this.hostThemePreference = null  // config.toml theme replaces host theme
this.hostImportedThemeName = null
```

`skipNextThemeUpdate` only set when the theme actually changes (hash differs), so it
will not stick around to suppress a later legitimate change. Clearing
`hostThemePreference` and `hostImportedThemeName` ensures `isHostThemePainted()` returns
false on the next BackMsg — the BE resumes config.toml resolution since the FE is now
painting the config theme, not the host theme. If the host later sends another
`SET_CUSTOM_THEME_CONFIG`, `handleThemeMessage` re-sets both fields and the flag flips
back to true.

Note: even without this explicit clear, `isHostThemePainted()` would return false because
the active theme name changed to the config.toml theme. The clear is belt-and-suspenders
to avoid stale state.

**3. In `componentDidUpdate`, appended after the existing `scriptRunState` handling:**

```tsx
// --- Theme appearance diff ---
const prevAppearance = hasLightBackgroundColor(prevProps.theme.activeTheme.emotion)
  ? "light" : "dark"
const currAppearance = hasLightBackgroundColor(this.props.theme.activeTheme.emotion)
  ? "light" : "dark"

if (prevAppearance !== currAppearance && !this.skipNextThemeUpdate) {
  this.maybeRerunForThemeChange()
}
if (this.skipNextThemeUpdate) {
  this.skipNextThemeUpdate = false
}

// --- Drain pending theme rerun when script becomes idle ---
if (
  this.pendingThemeRerun &&
  this.state.scriptRunState === ScriptRunState.NOT_RUNNING
) {
  this.pendingThemeRerun = false
  this.maybeRerunForThemeChange()
}
```

**4. New method `maybeRerunForThemeChange`:**

```tsx
private maybeRerunForThemeChange = (): void => {
  const currentAppearance = hasLightBackgroundColor(
    this.props.theme.activeTheme.emotion
  ) ? "light" : "dark"

  if (currentAppearance === this.lastRerunAppearance) return
  if (!this.isServerConnected()) return
  if (
    this.state.scriptRunState === ScriptRunState.RUNNING ||
    this.state.scriptRunState === ScriptRunState.RERUN_REQUESTED
  ) {
    this.pendingThemeRerun = true
    return
  }

  this.pendingThemeRerun = false
  this.widgetMgr.sendUpdateWidgetsMessage(undefined)
}
```

MPA safety: `sendUpdateWidgetsMessage(undefined)` passes no `pageScriptHash`, so
`sendRerunBackMsg` falls through to `this.state.currentPageScriptHash` (the current
page).

**5. In `sendRerunBackMsg`, after the BackMsg is sent (~line 2243):**

```tsx
this.lastRerunAppearance = hasLightBackgroundColor(
  this.props.theme.activeTheme.emotion
) ? "light" : "dark"
```

#### Why `skipNextThemeUpdate` works across the React render boundary

1. `processThemeInput` sets `skipNextThemeUpdate = true` synchronously.
2. It calls `setAndSendTheme` → `this.props.theme.setTheme()` → triggers React state
   update (batched).
3. React schedules a re-render; `processThemeInput` returns; `handleNewSession`
   continues.
4. React flushes the batched state update → re-renders `ThemedApp` → new
   `activeTheme` prop flows to `App`.
5. `componentDidUpdate` fires for the new render — `skipNextThemeUpdate` is still
   `true`.
6. Flag is consumed and cleared.

#### Why this does not regress MPA (failure mode analysis)

| Old failure mode (PR #10972) | How this proposal avoids it |
|---|---|
| Fired on `processThemeInput` (preset → custom name change) | `skipNextThemeUpdate` suppresses the resulting `componentDidUpdate` |
| Fired on page navigation (new `NewSession` → theme reapplication) | Page nav → `handleNewSession` → `processThemeInput` → flag set → suppressed |
| Fired on reconnection | Same: reconnection → `handleNewSession` → `processThemeInput` → suppressed |
| Used theme NAME comparison (fragile, changes for internal reasons) | Uses resolved PREFERENCE (luminance "light"/"dark") — only changes on actual appearance flip |
| `sendRerunBackMsg()` without page context lost current page | `sendUpdateWidgetsMessage(undefined)` → `sendRerunBackMsg` uses `this.state.currentPageScriptHash` |
| Theme change while script running was silently dropped | `pendingThemeRerun` records the intent; `componentDidUpdate` drains it once `scriptRunState` → `NOT_RUNNING` |
| Infinite loops (theme change → rerun → NewSession → theme change → ...) | `lastRerunAppearance` updated after send; next `componentDidUpdate` sees no diff and short-circuits. Plus `processThemeInput` sets skip flag. |

#### Scenario walkthrough

| Scenario | Flow | Result |
|----------|------|--------|
| Initial load, custom dark theme | `processThemeInput` applies dark → `skip=true` → `componentDidUpdate` sees light→dark but skip is true → consumed, no rerun | Correct |
| User toggles Dark in menu | `setAndSendTheme` → React re-renders → `componentDidUpdate` sees light→dark, `skip=false` → `maybeRerunForThemeChange()` fires | Correct |
| MPA page navigation | `handleNewSession` → `processThemeInput` → `skip=true` → suppressed | Correct |
| Host sends dark theme | `handleThemeMessage` → `setTheme()` → React re-renders → `componentDidUpdate` fires → rerun | Correct |
| OS dark↔light while System selected | `updateAutoTheme` in `useThemeManager` → prop changes → `componentDidUpdate` fires → rerun | Correct |
| Reconnection | Same path as initial load through `handleNewSession` → suppressed | Correct |
| Script already running when theme changes | `maybeRerunForThemeChange` sees `RUNNING` → sets `pendingThemeRerun=true` → script finishes → `componentDidUpdate` sees `NOT_RUNNING` + pending → fires rerun | Correct |

#### Minor modification to `handleThemeMessage`

After applying the host theme, store the resolved preference and imported theme name for
`isHostThemePainted()` / `getResolvedThemePreference()`:

```tsx
this.hostThemePreference = hasLightBackgroundColor(newTheme.emotion)
  ? "light" : "dark"
this.hostImportedThemeName = newTheme.name  // used by isHostThemePainted()
```

#### No changes needed to

- `ThemeContext` or `ThemeManager` interface
- `useThemeManager` hook (the `matchMedia` listener stays as-is)
- The `setTheme` prop passed through context (stays as `this.setAndSendTheme`)
- `setAndSendTheme` (signature unchanged — when the user picks a different theme from
  the menu, the active theme name changes, so `isHostThemePainted()` naturally returns
  false without needing any code in `setAndSendTheme`)

#### Key files

- `frontend/app/src/App.tsx` — all implementation changes
- `frontend/lib/src/theme/getColors.ts` — `hasLightBackgroundColor` (existing, used
  for preference comparison)
- `frontend/app/src/util/useThemeManager.ts` — contains `matchMedia` listener (no
  changes; theme changes flow through props)

### 5. Docs

Update [`context.py`](../../lib/streamlit/runtime/context.py) docstring to match the
chosen product meaning. Drop stale first-load / settings caveats; keep CSS-override note.

### 6. Testing

**Python unit**

- Resolver matrix matching the product behavior table (presets; single custom `base` /
  hex / non-hex; light+dark sections; section-wins inheritance merge; parent `base`
  does not override section; missing colors → preference).
- `host_theme_active = true` → resolver returns `preference` directly, ignoring
  config.toml (even if config has conflicting `[theme] base="light"`).
- `_has_section_content` returns False for all-None dicts (registered but unset).
- `request_rerun` resolves on `_client_state` (not the incoming `client_state`) for
  full and fragment paths; verify server-initiated reruns also use resolved value.

**Frontend unit**

- Preference serialization (System→OS, Light, Dark, embed query, host theme); not
  from remapped custom theme name.
- `componentDidUpdate` appearance-diff: fires rerun on light↔dark flip; suppressed
  when `skipNextThemeUpdate` is set; no-op when `lastRerunAppearance` matches;
  deferred when script is running.
- `pendingThemeRerun`: theme change during `RUNNING` sets pending; transition to
  `NOT_RUNNING` drains it by calling `maybeRerunForThemeChange`.
- `processThemeInput` sets `skipNextThemeUpdate` — verify that `componentDidUpdate`
  after `handleNewSession` / page navigation does NOT trigger rerun.
- `handleThemeMessage` stores `hostThemePreference` and `hostImportedThemeName`;
  `getResolvedThemePreference()` returns host preference when set;
  `isHostThemePainted()` returns true only when active theme matches
  `hostImportedThemeName`.
- `isHostThemePainted()` returns false after user selects a different theme from
  the menu (non-sticky host activation).
- Regression: theme **name** change alone must not call `sendRerunBackMsg`.

**E2E** (`make run-e2e-test`)

- Custom `[theme]` `base = "dark"` + light OS/cache preference → first output
  `type: dark`.
- MPA deep link + `[theme]` lands on target page (#11797).
- Main-menu Light↔Dark updates `type` without manual rerun.
- Re-enable
  [`test_st_context_theme_respects_dark_theme_message`](../../e2e_playwright/hostframe_app_test.py)
  (skipped since #11870). No new CI host environment — this is an existing Playwright
  hostframe suite; unskip only.

## Alternatives considered

### A. Fix the auto-rerun MPA-safely (no new proto field)

Double-run on first load: wrong `type` → FE applies custom theme → corrected rerun.

- Simpler; worse UX; first script execution still wrong.

**Rejected** for first-run correctness.

### B. Backend uses config `base` / `backgroundColor` only (no preference)

- Fixes common single-custom-with-`base` quickly.
- Fails for dual light/dark sections and preset-only Dark menu selection.
- Still needs auto-rerun for mid-session changes.

**Rejected** as sole fix and as throwaway milestone (`theme_preference` is needed
eventually).

### C. Pre-session theme config before first script run

Extra RTT every connection; protocol reordering; comparable complexity, worse latency.

**Rejected.**

### D. Ship first-run and auto-rerun as separate PRs

Separable for blast radius. **This spec still does both in one pass**, with hard order
(resolver tested before auto-rerun) so auto-rerun can be reverted without undoing proto /
BE work.

## Risks

| Risk | Mitigation |
|------|------------|
| Auto-rerun reintroduces #11797 | `skipNextThemeUpdate` suppresses `processThemeInput` renders; appearance-diff (not name); `sendUpdateWidgetsMessage` preserves page context; MPA E2E required |
| BE luminance disagrees with FE | Use identical WCAG formula (sRGB linearization + BT.709, threshold `> 0.5`); cross-check unit test against FE boundary values; hex-only; fall back to `base`/preference |
| Preference tracking drifts after `processThemeInput` | Track explicit `ThemeSelection`, never reverse from theme name |
| Host/SiS theme messages ignored | Explicit `handleThemeMessage` path; re-enable hostframe E2E |
| Option A/B chosen late | §2 is the only major rewrite; proto + auto-rerun stay |

## Out of scope

- Full theme config on `st.context.theme` ([#11536](https://github.com/streamlit/streamlit/issues/11536)).
- Programmatic theme setters at runtime ([#14172](https://github.com/streamlit/streamlit/issues/14172)).
- Full Emotion theme build on the backend.
- Non-hex CSS color parsing for luminance.
- CSS-injected backgrounds affecting `type`.

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | Host theme path required; unskip existing hostframe E2E (no new CI infra) |
| No breaking API changes | Additive proto field; `type` shape unchanged. Old FE + new BE: `color_scheme` left as client-sent (no regression) |
| No new dependencies | Hex luminance only — no color-parsing library |
| Metrics collected | Existing `context.theme` metrics sufficient |
| Any security/legal impact? | No |
| Any docs changes needed? | Docstring + API reference once semantics are signed off |
