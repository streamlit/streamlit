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
```

Keep `color_scheme` as what Python exposes via `st.context.theme.type`. When
`theme_preference` is present, the backend overwrites `color_scheme` before the script
run. **Old clients without field 7 keep working:** the backend leaves `color_scheme` as
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
        # Merge [theme] inheritance for base / backgroundColor only
        return _type_from_base_or_bg(_merge_theme(theme, section), fallback=preference)

    # Single custom theme — preference does not override appearance
    return _type_from_base_or_bg(theme, fallback=preference)


def _type_from_base_or_bg(opts: dict, *, fallback: str) -> str:
    base = opts.get("base")
    if base in ("light", "dark"):
        return base
    bg = opts.get("backgroundColor")
    if _is_six_digit_hex(bg):
        return "light" if _hex_luminance(bg) > 0.5 else "dark"
    return fallback
```

| Config shape | How to get `type` (Option C) |
|--------------|------------------------------|
| No custom theme (presets) | Return `preference` |
| Single `[theme]` only | `_type_from_base_or_bg` (ignore preference for the value except as fallback) |
| `[theme.light]` and/or `[theme.dark]` | Pick section from `preference`, merge inheritance, then `_type_from_base_or_bg` |

Wire in [`app_session.request_rerun`](../../lib/streamlit/runtime/app_session.py) after
copying client `context_info` into `RerunData`:

```python
if client_state.HasField("context_info"):
    self._client_state.context_info.CopyFrom(client_state.context_info)
    if client_state.context_info.HasField("theme_preference"):
        client_state.context_info.color_scheme = resolve_theme_type(
            client_state.context_info.theme_preference
        )
```

Applies to **full-script and fragment** reruns alike.

If product picks **Option A**, this collapses to
`color_scheme = theme_preference`. If **Option B** (theme identity), return a
descriptive string like `"Default Light"`, `"Custom"`, or `"Custom Dark"` instead of
a binary light/dark classification — requires changing the return type and downstream
`st.context.theme.type` contract.

### 3. Frontend: send preference on every rerun

In [`App.sendRerunBackMsg`](../../frontend/app/src/App.tsx) / `contextInfo`:

```ts
themePreference: this.getResolvedThemePreference(), // "light" | "dark"
```

**Source of truth** (do not reverse-engineer from active custom theme name after
`processThemeInput`):

1. Existing embed query options `embed_options=light_theme` /
   `embed_options=dark_theme` (already used by host embedding — not a new protocol)
   if present.
2. Else tracked `ThemeSelection` (`Light` / `Dark` / `System`), with
   `System` → `getSystemThemePreference()`.
3. `getCachedThemeSelection()` only for initial hydrate.

Maintain `lastSentThemePreference` on the App instance; update it whenever a BackMsg
with that preference is actually sent. Keep sending `colorScheme` for back-compat if
useful; BE overwrites when `theme_preference` is present.

**Backward compatibility:** New backend + old frontend (no `theme_preference`) leaves
`color_scheme` untouched — existing deployed clients do not regress. New frontend +
old backend ignores the unknown field until both sides are upgraded; once both are
new, BE overwrites `color_scheme` from preference + config.

### 4. MPA-safe auto-rerun on appearance change

#### Design: unified `componentDidUpdate` preference-diff with suppression flag

All three trigger sources (menu toggle, host message, OS preference change) produce
the same observable: `props.theme.activeTheme` changes its visual appearance in
`App.tsx`. A single `componentDidUpdate` check handles all three. The only path to
suppress is `processThemeInput` (called during `handleNewSession`).

#### Implementation

**1. Two instance fields:**

```tsx
private lastSentThemePreference: "light" | "dark" | null = null
private skipNextThemeUpdate: boolean = false
```

- `lastSentThemePreference` — tracks the preference sent in the last
  `sendRerunBackMsg`. Prevents duplicate reruns and handles edge cases where
  appearance does not actually change.
- `skipNextThemeUpdate` — set by `processThemeInput` when it applies a server-sent
  custom theme. Consumed (cleared) by the next `componentDidUpdate` to prevent that
  render from triggering an auto-rerun.

**2. In `processThemeInput`, after the hash-check early return (~line 1738), before
`this.setState`:**

```tsx
this.skipNextThemeUpdate = true
```

Only set when the theme actually changes (hash differs), so it will not stick around
to suppress a later legitimate change.

**3. In `componentDidUpdate`, appended after the existing `scriptRunState` handling:**

```tsx
const prevPreference = hasLightBackgroundColor(prevProps.theme.activeTheme.emotion)
  ? "light" : "dark"
const currPreference = hasLightBackgroundColor(this.props.theme.activeTheme.emotion)
  ? "light" : "dark"

if (prevPreference !== currPreference && !this.skipNextThemeUpdate) {
  this.maybeRerunForThemeChange()
}
if (this.skipNextThemeUpdate) {
  this.skipNextThemeUpdate = false
}
```

**4. New method `maybeRerunForThemeChange`:**

```tsx
private maybeRerunForThemeChange = (): void => {
  const currentPreference = hasLightBackgroundColor(
    this.props.theme.activeTheme.emotion
  ) ? "light" : "dark"

  if (currentPreference === this.lastSentThemePreference) return
  if (!this.isServerConnected()) return
  if (
    this.state.scriptRunState === ScriptRunState.RUNNING ||
    this.state.scriptRunState === ScriptRunState.RERUN_REQUESTED
  ) return

  this.widgetMgr.sendUpdateWidgetsMessage(undefined)
}
```

MPA safety: `sendUpdateWidgetsMessage(undefined)` passes no `pageScriptHash`, so
`sendRerunBackMsg` falls through to `this.state.currentPageScriptHash` (the current
page).

**5. In `sendRerunBackMsg`, after the BackMsg is sent (~line 2243):**

```tsx
this.lastSentThemePreference = hasLightBackgroundColor(
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
| Infinite loops (theme change → rerun → NewSession → theme change → ...) | `lastSentThemePreference` updated after send; next `componentDidUpdate` sees no diff and short-circuits. Plus `processThemeInput` sets skip flag. |

#### Scenario walkthrough

| Scenario | Flow | Result |
|----------|------|--------|
| Initial load, custom dark theme | `processThemeInput` applies dark → `skip=true` → `componentDidUpdate` sees light→dark but skip is true → consumed, no rerun | Correct |
| User toggles Dark in menu | `setAndSendTheme` → React re-renders → `componentDidUpdate` sees light→dark, `skip=false` → `maybeRerunForThemeChange()` fires | Correct |
| MPA page navigation | `handleNewSession` → `processThemeInput` → `skip=true` → suppressed | Correct |
| Host sends dark theme | `handleThemeMessage` → `setTheme()` → React re-renders → `componentDidUpdate` fires → rerun | Correct |
| OS dark↔light while System selected | `updateAutoTheme` in `useThemeManager` → prop changes → `componentDidUpdate` fires → rerun | Correct |
| Reconnection | Same path as initial load through `handleNewSession` → suppressed | Correct |
| Script already running when theme changes | `maybeRerunForThemeChange` sees `RUNNING` → returns without firing | Correct |

#### No changes needed to

- `setAndSendTheme` (signature unchanged)
- `handleThemeMessage` (no modification)
- `ThemeContext` or `ThemeManager` interface
- `useThemeManager` hook (the `matchMedia` listener stays as-is)
- The `setTheme` prop passed through context (stays as `this.setAndSendTheme`)

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
  hex / non-hex; light+dark sections; inheritance; missing colors → preference).
- `request_rerun` sets `color_scheme` for full and fragment paths.

**Frontend unit**

- Preference serialization (System→OS, Light, Dark, host query); not from remapped
  custom theme name.
- `componentDidUpdate` preference-diff: fires rerun on light↔dark flip; suppressed
  when `skipNextThemeUpdate` is set; no-op when `lastSentThemePreference` matches;
  no-op when script is running.
- `processThemeInput` sets `skipNextThemeUpdate` — verify that `componentDidUpdate`
  after `handleNewSession` / page navigation does NOT trigger rerun.
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
| Auto-rerun reintroduces #11797 | `skipNextThemeUpdate` suppresses `processThemeInput` renders; preference-diff (not name); `sendUpdateWidgetsMessage` preserves page context; MPA E2E required |
| BE luminance disagrees with FE | Prefer `base`; hex-only luminance; fall back to preference |
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
