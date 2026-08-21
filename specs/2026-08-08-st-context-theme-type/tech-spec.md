---
author: mayagbarnes
created: 2026-08-08
---

# Make `st.context.theme.type` correct — tech design

## Summary

Fix `st.context.theme.type` by having the client send a resolved appearance preference
(`"light"` | `"dark"`) on every rerun, and having the backend resolve the effective type
from that preference plus `config.toml` **before** the script runs — plus an MPA-safe
auto-rerun whenever the inputs the backend resolves from change (menu, host, or OS).

See the [product spec](./product-spec.md) for the A/B/C semantics decision and
user-facing behavior. This tech spec is written against **Option C** (visual appearance);
if product picks A or B, adjust §2 only.

### Terms

| Term | Meaning |
|------|---------|
| **Frontend** / **FE**, **Backend** / **BE** | The React app in `frontend/` and the Python runtime in `lib/`, respectively |
| **Appearance preference** | What the user or their OS asked for: menu `Light` / `Dark` / `System`, with `System` resolved against `prefers-color-scheme`. Sent as `theme_preference` |
| **Painted appearance** | Whether the app actually renders light or dark, from the active theme's background luminance. What Option C defines `type` to mean |
| **Dual theme** | A `config.toml` with `[theme.light]` and/or `[theme.dark]` sections, which makes the FE build separate light and dark custom themes |
| **Section variant** | Which half of a dual theme is active — `"light"` or `"dark"`. The FE forces the theme's `base` from it |
| **Host theme** | A theme pushed by an embedding host at runtime via the `SET_CUSTOM_THEME_CONFIG` postMessage, which replaces `config.toml` on the FE |
| **Resolution key** | The `(appearance preference, host theme active)` pair — precisely the client-supplied inputs the backend resolves `type` from, and the trigger for the §4 auto-rerun |

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
// Resolved light/dark value from the client: "light" or "dark".
// Normally the user's appearance preference, with a System menu selection
// resolved to the OS preference before send. When host_theme_active is true it
// instead carries the painted luminance of the host theme, since that is the
// only signal the backend can act on for a theme it cannot see.
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

Add `lib/streamlit/runtime/theme_type.py` (sketch under Option C).

**Module comment required:** The general principle (per `AGENTS.md`) is that theming
calculations belong on the frontend. This module is a justified exception: the backend is
the only entity that has both the user's appearance preference AND `config.toml` at
first-run time (the FE hasn't received `NewSession.custom_theme` yet). The implementation
PR must include a short module-level docstring explaining this so future readers do not
"fix" it back to FE-only luminance.

```python
def resolve_theme_type(
    preference: Literal["light", "dark"],
) -> Literal["light", "dark"]:
    theme = config.get_options_for_section("theme")
    light = config.get_options_for_section("theme.light")
    dark = config.get_options_for_section("theme.dark")
    sidebar = config.get_options_for_section("theme.sidebar")
    light_sidebar = config.get_options_for_section("theme.light.sidebar")
    dark_sidebar = config.get_options_for_section("theme.dark.sidebar")

    if not _has_any_theme_config(
        theme, light, dark, sidebar, light_sidebar, dark_sidebar
    ):
        return preference  # presets only

    # FE enters dual-theme mode when theme.light / theme.dark have content OR
    # when their nested sidebar subsections do (hasThemeSectionConfigs checks
    # one level deep into nested objects).
    if (
        _has_section_content(light)
        or _has_section_content(dark)
        or _has_section_content(light_sidebar)
        or _has_section_content(dark_sidebar)
    ):
        section = dark if preference == "dark" else light
        merged = _merge_for_dual_theme(theme, section, variant=preference)
        # fallback = preference (which equals the section variant name, e.g.
        # "dark" for [theme.dark]) — mirrors the FE behavior where selecting
        # the dark section implies dark appearance when no explicit base/bg.
        return _type_from_bg_or_base(merged, fallback=preference)

    # Single custom theme — if neither bg nor base is set, FE defaults to
    # light preset (no base → inherits from lightTheme). This also covers
    # sidebar-only configs ([theme.sidebar] without main-area keys): the FE
    # creates a single custom theme inheriting from lightTheme, so the main
    # area always paints light.
    return _type_from_bg_or_base(theme, fallback="light")


def _merge_for_dual_theme(parent: dict, section: dict, *, variant: str) -> dict:
    """Merge parent [theme] into a light/dark section for type resolution.

    Section values override parent (mirrors frontend handleSectionInheritance).
    After merging, `base` is ALWAYS forced to the section variant name —
    matching the FE, which sets `base` from the variant last, overriding any
    `base` inherited from `[theme]`.

    Note: `base` is only a registered config option on `[theme]` — it is not a
    valid key in `[theme.light]` / `[theme.dark]`, so the only `base` that can
    reach this merge comes from the parent section. A contradictory
    `[theme.dark] base = "light"` is a config error, not an input we resolve.

    The only way to override the forced `base` in dual themes is via
    `backgroundColor` luminance (priority 1 in `_type_from_bg_or_base`).

    This ensures:
    - [theme] base="light" + [theme.dark] primaryColor="..." → base forced to
      "dark" (variant) → resolver returns "dark". Correct — the FE paints dark.
    - [theme.dark] backgroundColor="#ffffff" (pathological) → bg luminance →
      "light" (what is painted, overrides forced base). Correct.
    """
    # Filter None values — get_options_for_section includes all registered keys
    # even when unset. Only non-None values represent user-provided config.
    parent_set = {k: v for k, v in parent.items() if v is not None}
    section_set = {k: v for k, v in section.items() if v is not None}
    merged = {**parent_set, **section_set}
    # Force base from variant — matches FE handleSectionInheritance
    merged["base"] = variant
    return merged


def _type_from_bg_or_base(opts: dict, *, fallback: str) -> str:
    """Classify appearance: hex background luminance, then base, then fallback.

    Assumes `base` has already been normalized to "light"/"dark". That holds
    because `theme.base` also accepts a TOML file path or URL, and
    `config_util.process_theme_inheritance` rewrites it to a plain "light" /
    "dark" (defaulting to "light" when the referenced file sets no base)
    before options are read. Do NOT "fix" this to resolve paths itself.
    """
    bg = opts.get("backgroundColor")
    if _is_hex_color(bg):
        return "light" if _hex_luminance(bg) > 0.5 else "dark"
    base = opts.get("base")
    if base in ("light", "dark"):
        return base
    return fallback


def _is_hex_color(value: object) -> bool:
    """Accept all valid hex color forms: #rgb, #rgba, #rrggbb, #rrggbbaa.

    Stricter than config validation's is_hex_color_like (which uses isalnum
    and would accept non-hex chars like 'g'/'z'). We need actual hex digits
    since _hex_luminance parses them with int(..., 16).
    """
    if not isinstance(value, str) or not value.startswith("#"):
        return False
    h = value[1:]
    if len(h) not in (3, 4, 6, 8):
        return False
    return all(c in "0123456789abcdefABCDEF" for c in h)
```

**`_hex_luminance` must normalize short forms and ignore alpha:** Expand `#rgb` →
`#rrggbb` (double each digit), `#rgba` → `#rrggbbaa` (double each, then discard alpha),
`#rrggbbaa` → use first 6 hex digits only. Then compute WCAG relative luminance (sRGB
linearization + BT.709 coefficients) with threshold `> 0.5`, identical to the frontend's
`hasLightBackgroundColor` / color2k `getLuminance`.

```python
def _hex_luminance(hex_color: str) -> float:
    """WCAG relative luminance from any hex form.

    Short forms are expanded and any alpha channel is ignored.
    """
    h = hex_color.lstrip("#")
    if len(h) in (3, 4):
        # Expand short form: #rgb → rrggbb, #rgba → rrggbbaa
        h = "".join(c * 2 for c in h)
    # Use only first 6 chars (ignore alpha if present)
    r, g, b = int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255
    # sRGB linearization
    r = r / 12.92 if r <= 0.04045 else ((r + 0.055) / 1.055) ** 2.4
    g = g / 12.92 if g <= 0.04045 else ((g + 0.055) / 1.055) ** 2.4
    b = b / 12.92 if b <= 0.04045 else ((b + 0.055) / 1.055) ** 2.4
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
```

A divergent Python implementation would disagree with painted appearance for
near-threshold hex backgrounds. Add a cross-check unit test comparing Python
`_hex_luminance` against known FE outputs. **Pick colors that actually straddle the
threshold** — mid-gray does not. Values measured against the vendored `color2k`:

| Color | `getLuminance` | Classified |
|-------|---------------|------------|
| `#000` | 0.0000 | dark |
| `#7f7f7f` | 0.2122 | dark |
| `#808080` | 0.2159 | dark |
| `#bbbbbb` | 0.4969 | **dark** — just below |
| `#bcbcbc` | 0.5029 | **light** — just above |
| `#ccc` | 0.6038 | light |
| `#fff` | 1.0000 | light |

`#bbbbbb` / `#bcbcbc` is the real crossing; `#bbb` (0.4969) additionally covers short-form
expansion right at the boundary. `#7f7f7f` / `#808080` sit at ~0.21 and would pass any
implementation, testing nothing.

**Known limitation — non-hex `backgroundColor` inverts the answer.** Theme color options
are **not** validated as hex. `theme.backgroundColor` is a plain `str` config option
(`_create_theme_options` applies no validator), so `config.set_option
("theme.backgroundColor", "black")` is accepted today. Meanwhile `color2k` parses the full
CSS color space — verified: `getLuminance("black") = 0`, `getLuminance("rgb(0,0,0)") = 0`,
`getLuminance("hsl(0,0%,10%)") = 0.0103`. So:

```toml
[theme]
backgroundColor = "black"   # no base set
```

paints **dark** on the frontend, while `_is_hex_color("black")` is false, `base` is unset,
and the resolver returns `fallback="light"` — the exact inverse of what Option C promises.
Named colors, `rgb()`, and `hsl()` all land here.

This is a real correctness gap, not a theoretical one, and it predates this design (today's
frontend-computed `color_scheme` gets it right, because the FE has the parsed color). Three
ways out, for reviewer decision — see product spec open question 5:

1. **Accept and document.** Cheapest; leaves a wrong `type` for these configs.
2. **Handle the common cases.** Add the 148 CSS named colors as a dict plus `rgb()`/`hsl()`
   parsing. No new dependency, but it grows the very FE/BE duplication the risk table warns
   about.
3. **Validate theme colors as hex in config.** Closes it properly and benefits more than
   `type`, but it would start rejecting configs that work today — a breaking change needing
   its own deprecation path.

Until this is decided, the resolver should at minimum **not** silently claim `"light"`: log
a debug message when `backgroundColor` is set but unparseable, so the fallback is
diagnosable.

**`_has_section_content`** returns True when the section has at least one option with a
non-None value. `get_options_for_section` returns all registered option keys for the
section (even when the user didn't write that TOML header), so checking truthiness of
the dict is insufficient — filter None values:

```python
def _has_section_content(section: dict) -> bool:
    return any(v is not None for v in section.values())
```

**Reuse the existing gate rather than re-deriving it.** `_populate_theme_msg` already makes
exactly this determination — `if all(val is None for val in theme_opts.values()): return`
(`lib/streamlit/runtime/app_session.py:1262-1264`) — and it decides whether a
`custom_theme` reaches the frontend at all. These two must agree: if the resolver thinks a
section has content and `_populate_theme_msg` disagrees, the backend resolves against config
the frontend was never told about. Factor the predicate into one shared helper (or have the
resolver call it) so the "Resolver drifts from FE theme logic" risk does not apply to this
*sibling* check too.

A bare `[theme.dark]` header with no keys underneath has all-None values → returns
False. This matches the FE's behavior, which also requires at least one key to trigger
dual-theme mode.

**`_has_any_theme_config`** is a simple OR over all six sections (main-area and sidebar):

```python
def _has_any_theme_config(
    theme: dict,
    light: dict,
    dark: dict,
    sidebar: dict,
    light_sidebar: dict,
    dark_sidebar: dict,
) -> bool:
    return (
        _has_section_content(theme)
        or _has_section_content(light)
        or _has_section_content(dark)
        or _has_section_content(sidebar)
        or _has_section_content(light_sidebar)
        or _has_section_content(dark_sidebar)
    )
```

**Why sidebar sections matter:** The FE creates a custom theme whenever `custom_theme` is
present in `NewSession` — even if only sidebar fields are set. A bare `[theme.sidebar]`
(no main-area keys) produces a single custom theme inheriting from `lightTheme`; the main
area always paints light regardless of OS preference. Without detecting sidebar sections,
the resolver would return `preference` (wrong when OS = dark).

`[theme.light.sidebar]` or `[theme.dark.sidebar]` trigger dual-theme mode on the FE
because `hasThemeSectionConfigs` recursively checks one level of nested objects. The
resolver mirrors this by including `light_sidebar` / `dark_sidebar` in the dual-theme
condition.

| Config shape | How to get `type` (Option C) |
|--------------|------------------------------|
| No custom theme (presets) | Return `preference` |
| Single `[theme]` only | `_type_from_bg_or_base` with `fallback="light"` (FE default) |
| Only `[theme.sidebar]` (no main-area keys) | Same as single `[theme]`: falls to `fallback="light"` (main area inherits lightTheme) |
| `[theme.light]` and/or `[theme.dark]` | Pick section from `preference`, force `base=variant` (matching FE), then `_type_from_bg_or_base` with `fallback=preference` (= section variant name) |
| `[theme.light.sidebar]` or `[theme.dark.sidebar]` (no main-area keys in .light/.dark) | Dual-theme path: merged section has only forced `base=variant` → returns `preference` (main area follows preset for each variant) |

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

**Critical — required wiring change:** Today `request_rerun` constructs `RerunData`
inline (there is no `_create_rerun_data` helper) and passes
`context_info=client_state.context_info` — the incoming parameter, not
`self._client_state`. This must be changed: after resolving `color_scheme` on
`self._client_state.context_info` (snippet above), the inline `RerunData(...)`
construction must pass `context_info=self._client_state.context_info` so the resolved
value reaches the script. Without this change, the script still sees the unresolved
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
  if (this.hostImportedTheme == null) return false
  if (this.hasEmbedThemeOverride()) return false
  // Object identity, NOT name equality — see below.
  return this.props.theme.activeTheme === this.hostImportedTheme
}
```

**Compare by object identity, never by theme name.** Host runtime themes and config.toml
*single* custom themes are both created with the same name constant `CUSTOM_THEME_NAME`
("Custom Theme") — `setImportedTheme` calls `createTheme(CUSTOM_THEME_NAME, proto)`, and
`createCustomThemes`' single-theme branch calls `createTheme(CUSTOM_THEME_NAME,
themeInput)`. A name comparison therefore cannot distinguish them, and the sticky-host
bug survives in this shape: with a single `[theme]` in config.toml plus a host dark
theme, a user selecting "Custom Theme" from the menu still matches the stored host name,
so the client would keep sending `host_theme_active=true` with the stale host preference
while the UI paints the config theme.

`hostImportedTheme` stores the `ThemeConfig` **object** created when the host theme was
applied. `applyTheme` does `setTheme(newTheme)` without copying, and the manager exposes
`activeTheme` as that same `useState` value, so the reference survives until something
replaces it; any other selection — preset, config.toml theme, or a later host import —
yields a different object and `isHostThemePainted()` goes false. Several config.toml paths
do spread-copy their themes (`createCustomThemes` for the light/dark/auto variants,
`createAutoCustomTheme` in the hook), but none of them copies a *host* import, so they all
correctly compare unequal to `hostImportedTheme`.

`hasEmbedThemeOverride()` reuses the existing embed query helpers — no new protocol:

```ts
private hasEmbedThemeOverride(): boolean {
  return isLightThemeInQueryParams() || isDarkThemeInQueryParams()
}
```

Both are already exported from `frontend/lib/src/util/utils.ts`. When an embed override is
active the FE paints the preset variant rather than the host custom theme, so config.toml
resolution on the BE remains correct and `hostThemeActive` must be false.

**Source of truth** (do not reverse-engineer from active custom theme name after
`processThemeInput`):

1. Existing embed query options `embed_options=light_theme` /
   `embed_options=dark_theme` (already used by host embedding — not a new protocol)
   if present.
2. Host-provided custom theme — **only when `isHostThemePainted()` is true** (the host
   theme is still the active rendered theme). Returns `hostThemePreference`, which
   `handleThemeMessage` derives from the applied theme's background luminance via
   `hasLightBackgroundColor` (see the sketch in §4). If `isHostThemePainted()` is false,
   this step is skipped even if `hostThemePreference` is non-null — prevents stale host
   preference from leaking after the user picks a different theme from the menu.
3. Else tracked `ThemeSelection` (`Light` / `Dark` / `System`), with
   `System` → `getSystemThemePreference()`.
4. `getCachedThemeSelection()` only for initial hydrate.

`getResolvedThemePreference()` checks in order: embed query → host (if painted) →
menu/OS selection.

These two values — `themePreference` and `hostThemeActive` — are exactly the inputs the
backend resolves from, so §4 uses the pair as its rerun trigger. Maintain
`lastSentThemeResolutionKey` on the App instance (see §4 for semantics); update it whenever a
rerun BackMsg is sent. Keep sending `colorScheme` for back-compat if useful; BE overwrites
when `theme_preference` is present.

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
   theme via `setImportedTheme` → `createTheme(CUSTOM_THEME_NAME, proto)`. No merge with
   config.toml — last-write-wins, whichever arrives later. When `host_theme_active` is
   true, config.toml colors are not painted — BE must not resolve from them. Arrival
   order relative to `NewSession` varies by host; both orderings are specified below.

**Host theme arrival ordering.** Hosts differ in when they post
`SET_CUSTOM_THEME_CONFIG` relative to the WebSocket handshake, so both orderings must be
handled. Neither is a "rare race" that can be waved off — each produces a wrong `type`
under a naive implementation, and each is corrected by a different part of §4:

| Ordering | First run resolves from | Then | Correction |
|----------|------------------------|------|------------|
| Host theme applied **before** the first BackMsg (host posts during iframe init, before connect) | Host appearance — first BackMsg already carries `host_theme_active=true` | `NewSession` arrives, `processThemeInput` paints the config.toml theme and clears the host fields | Resolution key flips `dark\|true` → `light\|false`, so §4 fires one rerun and the BE re-resolves from config.toml |
| Host theme applied **after** `NewSession` (host posts once the app is live) | config.toml — first BackMsg carries `host_theme_active=false` | `handleThemeMessage` applies the host theme | Resolution key flips `light\|false` → `dark\|true`, so §4 fires one rerun and the BE takes `theme_preference` directly |

The first ordering is the one an appearance-diff trigger gets wrong: the config.toml theme
may paint the *same* luminance the host theme did, so painted appearance does not change,
yet the backend must switch resolution source from host-preference to config.toml. This is
why §4 keys on the `(preference, hostThemeActive)` resolution key rather than on luminance —
see the design note there.

In both orderings the first script run may briefly show a `type` resolved from the other
source; the correcting rerun fires within milliseconds and is invisible to users.
Eliminating the first run's exposure entirely would require a new protocol where the host
pushes its theme to the server rather than only to the iframe — out of scope.

**Pre-existing issue to decide on: host theme + no `config.toml` theme.** The table above
assumes `processThemeInput` paints a config.toml theme. With **no** `[theme]` at all — a
common SiS/Cloud shape — it takes its `else` branch instead, and that branch is destructive
to host themes today. `usingCustomTheme` is `!isPresetTheme(activeTheme)`, which is `true`
for a host theme (named `CUSTOM_THEME_NAME`), so the branch runs
`setAndSendTheme(mappedTheme ?? createAutoTheme())` and **replaces the painted host theme
with a preset**. That is existing behavior on `develop`, independent of this design: the
host's theme visibly disappears on the first `NewSession`.

For this spec it means ordering A's "correction" is not merely a `type` fix in that
configuration — the host theme itself is lost, so `type` correctly reports the preset that
ends up painted. **Reviewer decision needed:** treat the clobber as a separate bug (file it,
keep it out of scope here, and note that `type` stays truthful either way), or fix it as
part of this work by having the `else` branch leave a host-imported theme in place. The
resolution-key design behaves correctly under both, so this is a scoping call rather than a
design dependency.

### 4. MPA-safe auto-rerun on theme change

#### Design: `componentDidUpdate` resolution key diff

The backend resolves `color_scheme` from exactly two client-supplied inputs —
`theme_preference` and `host_theme_active` — plus `config.toml`. Holding `config.toml`
constant, `st.context.theme.type` can only change when that pair changes, so the trigger
is a **resolution key diff** on the pair rather than a painted-luminance diff:

```tsx
private getThemeResolutionKey(): string {
  return `${this.getResolvedThemePreference()}|${this.isHostThemePainted()}`
}
```

A rerun fires whenever the current resolution key differs from the one sent with the last
BackMsg. Against a fixed `config.toml` that condition is both necessary and sufficient: a
changed resolution key means the backend would now compute a different `type`; an unchanged
resolution key means it would compute the same one.

`config.toml` is not strictly immutable — `bootstrap._install_config_watchers` reloads
config options when the file changes — but that watcher only refreshes server-side options;
it does not rerun the script or push a new theme to the client. So after a mid-session
`[theme]` edit, neither the painted theme nor `type` changes until the next rerun, and on
the next **full** rerun both update together: the resolver reads the new options while the
accompanying `NewSession` carries the new `custom_theme`. The resolution key therefore does
not need to track config edits.

The one seam: a **fragment** rerun sends no `NewSession`, so between a mid-session `[theme]`
edit and the next full rerun, a fragment run would resolve `type` from the new config while
the client still paints the old theme. This is a developer-only window (editing
`config.toml` against a live app) and self-corrects on the next full rerun.

**Why not diff painted appearance?** Luminance is a proxy that fails in two ways. It
misses the host→config.toml transition (§3's first ordering), where the resolution
*source* changes while painted luminance may not — leaving `type` stuck on the host value
for the rest of the session. And it forces a `skipNextThemeUpdate` flag, because applying
a config.toml custom theme legitimately flips luminance without changing what the backend
would compute, so the flag is needed to tell those apart. Keying on the resolution key removes
both problems, and with them both the `skipNextThemeUpdate` flag and the
`lastRerunAppearance` guard used in earlier drafts.

**Accepted cost:** the resolution key fires a rerun in cases a luminance diff deduped — a
preference change that the resolver ignores because config pins the answer, e.g. toggling
menu Light↔Dark (or the OS flipping while System is selected) with a *single* custom
theme. `type` is unchanged, so the rerun is redundant. Suppressing it would require
reimplementing the resolver on the frontend, which is exactly the duplication this design
is trying to contain; it stays one rerun per explicit change (Principle 34), never a loop.
We take the redundant rerun over the duplicated logic.

#### Implementation

**1. Instance fields:**

```tsx
private lastSentThemeResolutionKey: string | null = null
private pendingThemeRerun: boolean = false
private themeSelection: ThemeSelection = getCachedThemeSelection() ?? "System"
private hostThemePreference: "light" | "dark" | null = null
private hostImportedTheme: ThemeConfig | null = null
```

- `lastSentThemeResolutionKey` — the `getThemeResolutionKey()` value carried by the most
  recent rerun BackMsg. The dedup guard: no rerun fires while it matches the current
  resolution key. Anchoring the guard to what was *sent* (rather than to the previous
  render) is what makes a change impossible to lose across renders, disconnects, or script
  runs. It starts `null`, so the key trivially differs before the first BackMsg; every
  `componentDidUpdate` until then sets `pendingThemeRerun`, which is harmless (the first
  real BackMsg sets the key and the drain no-ops) but will look odd in a debugger.
- `pendingThemeRerun` — set when a resolution key change arrives while the script is
  running, a rerun is already requested, or the socket is down. Ensures the rerun fires
  once the app is connected and idle rather than being silently dropped.
- `themeSelection` — the user's tracked `ThemeSelection` (`"Light"` / `"Dark"` /
  `"System"`), step 3 of §3's source-of-truth list. **This field is load-bearing for MPA
  safety, so its write sites matter:** it must be written only where the *user or host*
  expresses a choice — the settings-menu callback, and `handleThemeMessage`'s preset
  branches (below). It must **not** be written inside `setAndSendTheme`, because
  `processThemeInput` calls `setAndSendTheme` itself while applying a server-sent theme; a
  write there would let a `NewSession` overwrite the user's selection, flip the resolution
  key, and fire a rerun *from `processThemeInput`* — exactly the #11797 regression the
  failure-mode table below promises cannot happen. Never derive it by reversing the active
  theme's name.
- `hostThemePreference` / `hostImportedTheme` — see §3. The host theme is held as an
  object reference for identity comparison, never as a name.

**2. In `processThemeInput`, after the hash-check early return, before `this.setState`:**

```tsx
// A config.toml theme is now what gets painted, so a host theme (if any) is no
// longer active. Clearing these flips isHostThemePainted() to false, which changes
// the resolution key and lets componentDidUpdate fire the correcting rerun.
this.hostThemePreference = null
this.hostImportedTheme = null
```

No suppression flag is set here. If the previous BackMsg reported
`host_theme_active=true`, clearing these fields *changes* the resolution key, and the rerun
that follows is exactly the correction §3's first ordering requires. If the previous
BackMsg already reported `host_theme_active=false` — the ordinary config.toml case,
including MPA navigation and reconnection — the resolution key is unchanged and nothing fires.
If the host later posts another `SET_CUSTOM_THEME_CONFIG`, `handleThemeMessage` re-sets
both fields and the resolution key flips back.

**3. In `componentDidUpdate`, appended after the existing `scriptRunState` handling:**

```tsx
// --- Theme resolution key diff ---
// Compared against what was last SENT, not against the previous render, so a
// change cannot be lost across renders. componentDidUpdate runs on every update,
// so any state or prop change re-checks the resolution key.
if (this.getThemeResolutionKey() !== this.lastSentThemeResolutionKey) {
  this.maybeRerunForThemeChange()
}

// --- Drain a deferred theme rerun once connected + idle ---
if (
  this.pendingThemeRerun &&
  this.isServerConnected() &&
  this.state.scriptRunState === ScriptRunState.NOT_RUNNING
) {
  this.maybeRerunForThemeChange()
}
```

Because the guard is the last-sent resolution key rather than `prevProps`, this hook needs no
previous props. Note the method's current signature is `componentDidUpdate(_prevProps, prevState)`
with `_prevProps` deliberately unused — it stays unused, so no rename is required.

**Invariant this hook depends on — state it, test it, don't discover it later.** The trigger
only fires when React renders, so it needs: *whenever the resolution key changes in a way
that changes `type`, a render must follow.* That holds today, for two reasons worth making
explicit because both are incidental rather than guaranteed:

1. `App` is a `PureComponent`, but it re-renders on every `ThemedApp` render anyway because
   `useThemeManager` returns a **fresh manager object literal** each time. If someone later
   memoizes that manager for performance, this hook silently stops running. Leave a comment
   at the `useThemeManager` return site saying so.
2. The key can genuinely change with no render — OS flips while `System` is selected with a
   *single* custom theme, where `updateAutoTheme` finds nothing to re-apply. No rerun fires,
   which is **correct**, because a config-pinned theme makes `type` identical either way. The
   invariant survives only because a preference change that fails to force a render is also
   one the resolver ignores. Any future change that decouples those two — e.g. exposing
   `st.context.theme.preference` (#11536), where preference alone becomes observable — breaks
   it, and the trigger would then need an explicit hook on the `matchMedia` listener.

Add a frontend test asserting the key is re-checked after a render caused by unrelated state,
so a future memoization of the theme manager fails loudly instead of silently.

**4. New method `maybeRerunForThemeChange`:**

```tsx
private maybeRerunForThemeChange = (): void => {
  if (this.getThemeResolutionKey() === this.lastSentThemeResolutionKey) {
    // Nothing to correct — e.g. a queued rerun that a user-driven rerun already
    // covered, since sendRerunBackMsg refreshes the resolution key.
    this.pendingThemeRerun = false
    return
  }
  if (
    !this.isServerConnected() ||
    // Mirror the drain condition exactly. Enumerating "busy" states would miss
    // STOP_REQUESTED (script IS still running) and COMPILATION_ERROR.
    this.state.scriptRunState !== ScriptRunState.NOT_RUNNING
  ) {
    // Defer: fire once connected + idle.
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

**5. In `sendRerunBackMsg`, after the BackMsg is sent:**

```tsx
this.lastSentThemeResolutionKey = this.getThemeResolutionKey()
```

Every rerun — user-driven or theme-driven — refreshes the guard, so it always reflects
what the backend was last told. This is also why an ordinary interaction absorbs a pending
theme change for free instead of causing a second rerun.

#### Why no suppression flag is needed

Earlier drafts needed `skipNextThemeUpdate` because `processThemeInput` legitimately flips
painted luminance when it applies a config.toml custom theme, and a luminance-diff trigger
could not tell that apart from a user-initiated change. The resolution key has no such
ambiguity: applying a config.toml theme changes neither the user's preference nor whether a
host theme is painted, so the resolution key is identical before and after and nothing fires.
The one case where `processThemeInput` *does* change the resolution key — clearing an active
host theme — is precisely the case that must rerun.

That removes the cross-render-boundary reasoning the flag design depended on (set a flag
synchronously, let React batch, and rely on `componentDidUpdate` consuming it on exactly
the right render). The only ordering requirement left is in `handleThemeMessage`, below.

#### Why this does not regress MPA (failure mode analysis)

| Old failure mode (PR #10972) | How this proposal avoids it |
|---|---|
| Fired on `processThemeInput` (preset → custom name change) | Applying a config.toml theme changes neither preference nor host-active, so the resolution key is unchanged and nothing fires — no flag required |
| Fired on page navigation (new `NewSession` → theme reapplication) | Same: page nav re-applies the same config theme, resolution key unchanged |
| Fired on reconnection | Same: reconnection re-applies the same config theme, resolution key unchanged |
| Used theme NAME comparison (fragile, changes for internal reasons) | Uses the `(preference, hostThemeActive)` resolution key — the backend's actual resolution inputs, never derived from a theme name |
| `sendRerunBackMsg()` without page context lost current page | `sendUpdateWidgetsMessage(undefined)` → `sendRerunBackMsg` uses `this.state.currentPageScriptHash` |
| Theme change while script running was silently dropped | `pendingThemeRerun` records the intent; `componentDidUpdate` drains it once connected and `NOT_RUNNING` |
| Infinite loops (theme change → rerun → NewSession → theme change → ...) | `lastSentThemeResolutionKey` is refreshed on every send, and the `NewSession` that follows does not change the resolution key, so the next `componentDidUpdate` short-circuits |

#### Scenario walkthrough

Resolution keys below are written `preference|hostThemeActive`.

| Scenario | Resolution key: last sent → current | Result |
|----------|-------------------------------|--------|
| Initial load, custom dark theme, OS light | `light\|false` → `light\|false` (`processThemeInput` paints the config theme; preference unchanged) | No rerun — the first run already resolved `"dark"` from config.toml. Correct |
| User toggles Dark in menu (presets) | `light\|false` → `dark\|false` | Rerun; BE returns `"dark"`. Correct |
| MPA page navigation | unchanged | No rerun — deep link preserved (#11797). Correct |
| Reconnection | unchanged | No rerun. Correct |
| Host posts dark theme after `NewSession` | `light\|false` → `dark\|true` | Rerun; BE takes `theme_preference` directly. Correct |
| Host theme painted before first BackMsg, then `NewSession` paints config | `dark\|true` → `light\|false` | Rerun; BE re-resolves from config.toml. Correct — **this is the case a luminance diff misses**, since both themes may paint the same luminance |
| User switches away from host theme via menu | `dark\|true` → `light\|false` | `isHostThemePainted()` false by object identity; rerun; BE resumes config resolution. Correct |
| User switches from host theme to a config.toml theme that shares `CUSTOM_THEME_NAME` | `dark\|true` → `light\|false` | Object identity separates them where a name comparison could not. Correct |
| OS dark↔light while System selected | `light\|false` → `dark\|false` | `updateAutoTheme` re-applies the theme → `componentDidUpdate` → rerun. Correct |
| Resolution key change while script is RUNNING | deferred | `pendingThemeRerun` set; `componentDidUpdate` drains it at `NOT_RUNNING`. Correct |
| Resolution key change while disconnected | deferred | `pendingThemeRerun` set; drains on reconnect once `NOT_RUNNING`. Correct |
| Resolution key change while RUNNING, then a hash-changing `processThemeInput` | pending stays set; the drain re-reads the *current* resolution key | Rerun fires if the resolution key still differs, no-ops if the config theme already made it match. Correct either way — no stale dedup guard to swallow it |
| Menu Light↔Dark with a single custom theme (or OS flip while System) | `light\|false` → `dark\|false` | Rerun fires though `type` is unchanged — the accepted cost documented above |

#### Required changes to `handleThemeMessage` (and `setImportedTheme`)

`handleThemeMessage` has three branches today, and **all three** need to participate in
the resolution key. Its current shape:

```tsx
handleThemeMessage = (themeName?: PresetThemeName, theme?: ICustomThemeConfig): void => {
  const [, lightTheme, darkTheme] = createPresetThemes()
  const isUsingPresetTheme = isPresetTheme(this.props.theme.activeTheme)

  if (themeName === lightTheme.name && isUsingPresetTheme) {
    this.props.theme.setTheme(lightTheme)          // (1) host selects preset Light
  } else if (themeName === darkTheme.name && isUsingPresetTheme) {
    this.props.theme.setTheme(darkTheme)           // (2) host selects preset Dark
  } else if (theme) {
    this.props.theme.setImportedTheme(theme)       // (3) host pushes a custom theme
  }
}
```

**Branches 1 and 2 (host picks a preset).** These are a host-driven equivalent of a menu
selection, so they must write `themeSelection` — otherwise painted appearance changes
while the resolution key does not, and `type` goes stale. Set
`this.themeSelection = "Light"` / `"Dark"` alongside the existing `setTheme` call.

**Branch 3 (host pushes a custom theme).** This is where the identity comparison needs the
`ThemeConfig` object — and App cannot currently obtain it. `handleThemeMessage` receives
the **proto** (`ICustomThemeConfig`), while the `ThemeConfig` is constructed inside the
hook by `setImportedTheme`, which returns `void`:

```ts
// frontend/app/src/util/useThemeManager.ts
setImportedTheme: (themeInfo: ICustomThemeConfig) => void
```

**So `setImportedTheme` must return the `ThemeConfig` it creates**, and App must store it:

```tsx
// Assign synchronously, before React flushes the state update that
// setImportedTheme() queued, so that componentDidUpdate — which fires on the first
// render after the host theme is applied — already sees both fields set.
const hostTheme = this.props.theme.setImportedTheme(theme)
this.hostThemePreference = hasLightBackgroundColor(hostTheme.emotion)
  ? "light" : "dark"
// Store the ThemeConfig OBJECT, not its name: host imports and config.toml single
// custom themes share the CUSTOM_THEME_NAME constant, so only identity distinguishes
// them (see §3).
this.hostImportedTheme = hostTheme
```

The stored object must be the same one handed to `setTheme` inside the hook, since
`isHostThemePainted()` compares it against `props.theme.activeTheme` by reference.

The alternative — App building the theme itself via `createTheme(CUSTOM_THEME_NAME, new
CustomThemeConfig(themeInfo))` and calling `setTheme` — is **rejected**: it bypasses
`setImportedTheme`'s `setFonts(themeInfo)` call and would regress host font loading.

#### Interface changes this requires

Returning the theme changes the `ThemeManager` contract, so these are **in** scope (they
were listed as untouched in an earlier draft):

- `ThemeManager.setImportedTheme` — return type `void` → `ThemeConfig`
- `useThemeManager`'s `setImportedTheme` implementation — return the `customTheme` it
  already builds (a one-line change; `updateTheme` is unaffected)

#### No changes needed to

- `ThemeContext`
- `useThemeManager`'s `matchMedia` listener
- The `setTheme` prop passed through context (stays as `this.setAndSendTheme`)
- `setAndSendTheme` (its signature is unchanged, and it must **not** write
  `themeSelection` — see the field notes above. A menu selection installs a different
  `ThemeConfig` object, so `isHostThemePainted()` returns false by identity without any
  code here, even when the selected theme shares the `CUSTOM_THEME_NAME` name with the
  host import.)
- `componentDidUpdate`'s parameter list — the resolution key diff needs no previous props,
  so `_prevProps` stays unused

#### Key files

- `frontend/app/src/App.tsx` — all implementation changes
- `frontend/lib/src/theme/getColors.ts` — `hasLightBackgroundColor` (existing, used to
  derive `hostThemePreference` from the host theme's background)
- `frontend/lib/src/util/utils.ts` — existing `isLightThemeInQueryParams` /
  `isDarkThemeInQueryParams`, composed into `hasEmbedThemeOverride()`
- `frontend/app/src/util/useThemeManager.ts` — `setImportedTheme` (host themes) and the
  `matchMedia` listener (no changes; theme changes flow through props)

### 5. Docs

Update [`context.py`](../../lib/streamlit/runtime/context.py) docstring to match the
chosen product meaning. Drop stale first-load / settings caveats; keep CSS-override note.

### 6. Testing

**Python unit**

- Resolver matrix matching the product behavior table (presets; single custom `base` /
  hex / non-hex; light+dark sections; dual-theme forced variant `base` overrides a `base`
  inherited from `[theme]`, matching FE `handleSectionInheritance`; missing colors →
  preference).
- Short hex forms: `#fff` → "light", `#000` → "dark", `#rgba` forms handled correctly.
- `_is_hex_color` accepts `#` followed by 3, 4, 6, or 8 hex digits (i.e. total string
  lengths 4, 5, 7, 9 including the `#`); rejects non-hex alphanumeric such as `#ghijkl` —
  stricter than config validation's `is_hex_color_like`.
- `_hex_luminance` expands short forms correctly (e.g. `#abc` → `#aabbcc`).
- Sidebar-only configs: `[theme.sidebar]` alone → "light" (regardless of preference);
  `[theme.light.sidebar]` alone → enters dual-theme path → returns preference.
- `host_theme_active = true` → **`request_rerun`** sets `color_scheme` from
  `theme_preference` directly and never calls `resolve_theme_type`, even when config has a
  conflicting `[theme] base="light"`. (This bypass lives in `request_rerun`, not in the
  resolver — `resolve_theme_type(preference)` takes no `host_theme_active` argument.)
- Non-hex `backgroundColor`: `"black"` / `"rgb(0,0,0)"` currently fall through to the
  fallback. Assert whatever behavior open question 5 settles on, and until then pin the
  known-wrong result so the gap is visible in the suite rather than silent.
- `_has_section_content` returns False for all-None dicts (registered but unset).
- `request_rerun` resolves on `_client_state` (not the incoming `client_state`) for
  full and fragment paths; verify server-initiated reruns also use resolved value.

**Frontend unit**

- Preference serialization (System→OS, Light, Dark, embed query, host theme); never
  derived from a remapped custom theme name.
- `getThemeResolutionKey()`: reflects `(getResolvedThemePreference(), isHostThemePainted())`;
  changes when either input changes and is stable otherwise.
- `componentDidUpdate` resolution key diff: fires a rerun when the resolution key differs from
  `lastSentThemeResolutionKey`; no-op when it matches; defers when running or disconnected.
- `sendRerunBackMsg` refreshes `lastSentThemeResolutionKey`, so a user-driven rerun absorbs a
  pending theme change instead of causing a second rerun.
- `pendingThemeRerun`: a resolution key change during `RUNNING` or while disconnected sets
  pending; the drain fires once connected + `NOT_RUNNING`; the drain re-reads the current
  resolution key and no-ops if it has since converged.
- **MPA regression:** `processThemeInput` during `handleNewSession` / page navigation
  leaves the resolution key unchanged, so `componentDidUpdate` must NOT trigger a rerun — with
  no suppression flag involved.
- **Host ordering A (host before first BackMsg):** host theme applied, first BackMsg
  carries `hostThemeActive=true`; then `processThemeInput` paints the config theme and
  clears the host fields → resolution key flips → exactly one rerun fires with
  `hostThemeActive=false`. Assert the rerun happens **even when both themes paint the same
  luminance**, which is the case a luminance diff missed.
- **Host ordering B (host after `NewSession`):** `handleThemeMessage` applies the host
  theme → resolution key flips → one rerun with `hostThemeActive=true`.
- `handleThemeMessage` stores `hostThemePreference` and the `hostImportedTheme` **object**;
  `getResolvedThemePreference()` returns the host preference only when
  `isHostThemePainted()` is true, and falls through to menu/OS otherwise.
- **Identity, not name:** with a config.toml single `[theme]` *and* a host import — both
  named `CUSTOM_THEME_NAME` — selecting the config theme from the menu makes
  `isHostThemePainted()` false and stops the stale host preference from being sent.
- `isHostThemePainted()` is false when an embed theme override is present, even while a
  host theme object is stored.
- **`themeSelection` write sites (guards the MPA regression):** a `processThemeInput` call
  that internally invokes `setAndSendTheme` must NOT change `themeSelection`, so the
  resolution key is unchanged and no rerun fires. Cover the concrete trap: a cached `"Dark"`
  selection plus a single `[theme]` config, where `getPreferredTheme` finds no match and
  `processThemeInput` applies `customThemes[0]` — assert `themeSelection` stays `"Dark"` and
  no BackMsg is sent.
- **`handleThemeMessage` preset branches:** a host posting `themeName` Light/Dark while a
  preset is active updates `themeSelection`, flips the resolution key, and fires exactly one
  rerun.
- **Deferral covers every non-idle state:** a resolution key change during `STOP_REQUESTED`
  and `COMPILATION_ERROR` defers rather than firing immediately, matching the drain's
  `NOT_RUNNING` condition.
- `setImportedTheme` returns the created `ThemeConfig`, and `handleThemeMessage` stores that
  exact object (identity, not a copy).
- Regression: theme **name** change alone must not call `sendRerunBackMsg`.

**E2E** (`make run-e2e-test`)

- Custom `[theme]` `base = "dark"` + light OS/cache preference → first output
  `type: dark`.
- MPA deep link + `[theme]` lands on target page (#11797).
- Main-menu Light↔Dark updates `type` without manual rerun.
- Host theme **and** a config.toml `[theme]` both present: `type` follows whichever theme
  is painted, and switching between them via the menu updates `type` without a manual
  rerun (covers the shared-`CUSTOM_THEME_NAME` case).
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
| Auto-rerun reintroduces #11797 | Resolution key diff on `(preference, hostThemeActive)`, which `processThemeInput` and page navigation do not change — so no suppression flag is needed and there is no flag-timing failure mode; `sendUpdateWidgetsMessage` preserves page context; MPA E2E required |
| BE luminance disagrees with FE | Use identical WCAG formula (sRGB linearization + BT.709, threshold `> 0.5`); normalize all hex forms (#rgb/#rgba/#rrggbb/#rrggbbaa); cross-check unit test against FE boundary values; fall back to `base`/preference for non-hex |
| **Resolver drifts from FE theme logic** | The resolver is a second implementation of rules the FE already owns (section inheritance, forced variant `base`, sidebar-only handling, luminance). Every future change to FE theme resolution needs a matching Python change, and the cross-check unit test is the only guard. Keep the resolver small, keep its test matrix aligned with the product behavior table, and reference `handleSectionInheritance` from the module docstring |
| Stale host theme forced onto the BE | `isHostThemePainted()` compares the active theme by **object identity** — host imports and config.toml single custom themes share the `CUSTOM_THEME_NAME` constant, so a name comparison would leak stale host preference; `processThemeInput` also clears the host fields |
| Preference tracking drifts after `processThemeInput` | Track explicit `ThemeSelection`, never reverse from theme name |
| Host/SiS theme messages ignored | Explicit `handleThemeMessage` path; both arrival orderings specified in §3; re-enable hostframe E2E |
| Redundant reruns when config pins the answer | Accepted: a preference change the resolver ignores (single custom theme) still reruns once. Bounded to one rerun per explicit change; suppressing it would require duplicating the resolver on the FE |
| Option A/B chosen late | §2 resolver is the only significant rewrite. Because §4 keys on preference rather than painted luminance, Option A needs **no** trigger redesign — a preference change already fires a rerun. Proto stays either way |

## Out of scope

- Full theme config on `st.context.theme` ([#11536](https://github.com/streamlit/streamlit/issues/11536)).
- Programmatic theme setters at runtime ([#14172](https://github.com/streamlit/streamlit/issues/14172)).
- Full Emotion theme build on the backend.
- Non-hex CSS color parsing for luminance (named colors like `"red"`, `rgb()`, `hsl()`).
  Only hex forms are handled. Note these values **are** accepted by config today — there is
  no hex validation on theme color options — so this is a known gap with a wrong-answer
  consequence, not merely an unsupported input. See the limitation in §2 and product spec
  open question 5.
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
