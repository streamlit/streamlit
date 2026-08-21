---
author: mayagbarnes
created: 2026-08-08
---

# Make `st.context.theme.type` correct — tech design

## Summary

Fix `st.context.theme.type` with a two-way exchange:

1. The client sends its resolved light/dark **preference** on every rerun, plus a flag
   saying whether it is yet painting its final theme for this session.
2. While that flag is false — the startup window before the `config.toml` theme has been
   applied — the backend resolves `color_scheme` from the preference plus `config.toml`,
   **before** the script runs. Otherwise it trusts the client's own `color_scheme`.
3. The backend **echoes** whatever the script saw back in `NewSession`. The client reruns
   once whenever what it paints disagrees with that echo.

The echo is what makes the system self-correcting. The backend resolver is deliberately
best-effort — it parses most CSS colours but not every syntax — and any disagreement, from
an unparseable `backgroundColor` to a resolver bug to future frontend drift, is detected
and fixed by one automatic rerun, with the client's painted value winning. That is the
correct outcome under **Option C** (visual appearance) in the
[product spec](./product-spec.md).

See [Implementation notes](#implementation-notes) for behaviors of the existing code that
this design depends on, and that are easy to get wrong.

### Terms

| Term | Meaning |
|------|---------|
| **Frontend** / **FE**, **Backend** / **BE** | The React app in `frontend/` and the Python runtime in `lib/`, respectively |
| **Appearance preference** | What the user or their OS asked for: menu `Light` / `Dark` / `System`, with `System` resolved against `prefers-color-scheme`. Sent as `theme_preference` |
| **Painted appearance** | Whether the app actually renders light or dark, from the active theme's background luminance (`getThemeColorScheme`). What Option C defines `type` to mean |
| **Theme applied** | Whether the client is painting its *final* theme for this session, which makes its own `color_scheme` authoritative. Sent as `theme_applied` |
| **Echo** | `NewSession.resolved_color_scheme` — the value the script actually saw, sent back so the client can detect a disagreement |
| **Dual theme** | A `config.toml` with `[theme.light]` and/or `[theme.dark]` sections, which makes the FE build separate light and dark custom themes |
| **Section variant** | Which half of a dual theme is active — `"light"` or `"dark"`. The FE forces the theme's `base` from it |
| **Host theme** | A theme pushed by an embedding host at runtime via the `SET_CUSTOM_THEME_CONFIG` postMessage, which replaces `config.toml` on the FE |

## Problem

### Current data path

```text
FE getThemeColorScheme()  →  ContextInfo.color_scheme  →  st.context.theme.type
```

`color_scheme` is inferred from the active frontend theme's background luminance
([`App.getThemeColorScheme`](../../frontend/app/src/App.tsx)) and sent inside
`BackMsg.rerun_script`. Custom theme config arrives later in `NewSession.custom_theme`
via [`_populate_theme_msg`](../../lib/streamlit/runtime/app_session.py). There is no
backend resolution of `type` today, and nothing tells the client what Python ended up
with.

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
page ([#11797](https://github.com/streamlit/streamlit/issues/11797)).
[#11870](https://github.com/streamlit/streamlit/pull/11870) removed that path. **Do not
restore** name-based `componentDidUpdate` reruns.

## Proposal

### High-level flow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend

    FE->>BE: BackMsg.rerun (theme_preference, theme_applied=false, color_scheme)
    BE->>BE: theme_applied false → resolve from preference + config.toml
    BE->>BE: Script runs; st.context.theme.type is the resolved value
    BE->>FE: NewSession (custom_theme, resolved_color_scheme)
    FE->>FE: Apply custom theme, compare paint against resolved_color_scheme
    FE->>BE: One rerun, only if they disagree (theme_applied=true from here on)
```

### 1. Proto

Three new fields. In
[`ClientState.proto`](../../proto/streamlit/proto/ClientState.proto), on `ContextInfo`:

```protobuf
// The client's resolved light/dark appearance preference ("light" or "dark").
// A "System" menu selection is resolved against the OS preference before send.
// Only consulted when theme_applied is false.
optional string theme_preference = 7;

// True once the client is painting its final theme for this session, meaning
// color_scheme above is authoritative. False only during the startup window
// before the config.toml theme has been applied, when the backend must
// resolve the appearance itself from theme_preference + config.toml.
optional bool theme_applied = 8;
```

In [`NewSession.proto`](../../proto/streamlit/proto/NewSession.proto), on `NewSession`:

```protobuf
// The light/dark appearance the script actually saw this run, as
// st.context.theme.type. Echoed back so the client can tell whether the value
// Python holds matches what the client is painting, and rerun if it does not.
// Needed because the backend resolves this from config.toml on the first run,
// and its colour parsing is best-effort: the client's CSS parser accepts more
// syntax than the backend's, and the backend cannot see host-provided themes.
optional string resolved_color_scheme = 12;
```

`color_scheme` remains what Python exposes via `st.context.theme.type`; the backend
overwrites it only in the `theme_applied=false` window.

**Backward compatibility.** Old FE + new BE: no `theme_preference`, so `color_scheme` is
left exactly as sent — no regression. New FE + old BE: no `resolved_color_scheme`, so the
client never sees a disagreement and behaves as it does today.

### 2. Backend resolver

[`lib/streamlit/runtime/theme_type.py`](../../lib/streamlit/runtime/theme_type.py) —
`resolve_theme_type(preference: ThemeType) -> ThemeType`, with
`ThemeType = Literal["light", "dark"]`. Private helpers: `_has_section_content`,
`_merge_for_dual_theme`, `_type_from_bg_or_base`, `_parse_color`, `_luminance`.

The module docstring carries the justification for existing at all — `AGENTS.md` says
theming calculations belong on the frontend, and this is the one window where the frontend
cannot know the answer. It also points at `handleSectionInheritance` /
`createCustomThemes` in `frontend/lib/src/theme/utils.ts` as the rules being mirrored.

```python
def resolve_theme_type(preference: ThemeType) -> ThemeType:
    theme = config.get_options_for_section("theme")
    light = config.get_options_for_section("theme.light")
    dark = config.get_options_for_section("theme.dark")
    sidebar = config.get_options_for_section("theme.sidebar")
    light_sidebar = config.get_options_for_section("theme.light.sidebar")
    dark_sidebar = config.get_options_for_section("theme.dark.sidebar")

    if not any(
        _has_section_content(section)
        for section in (theme, light, dark, sidebar, light_sidebar, dark_sidebar)
    ):
        # Presets only: the frontend paints whatever was preferred.
        return preference

    # The frontend enters dual-theme mode when [theme.light] / [theme.dark] have
    # content, or when their nested sidebar subsections do (hasThemeSectionConfigs
    # checks one level into nested objects).
    if any(
        _has_section_content(section)
        for section in (light, dark, light_sidebar, dark_sidebar)
    ):
        section = dark if preference == "dark" else light
        merged = _merge_for_dual_theme(theme, section, variant=preference)
        return _type_from_bg_or_base(merged, fallback=preference)

    # A single custom theme. With neither background nor base set the frontend
    # inherits from lightTheme, so it paints light. This also covers sidebar-only
    # configs, where the main area always follows lightTheme.
    return _type_from_bg_or_base(theme, fallback="light")
```

| Config shape | Resolved `type` |
|--------------|-----------------|
| No custom theme (presets) | `preference` |
| Single `[theme]` only | `_type_from_bg_or_base(theme, fallback="light")` — the FE default |
| Only `[theme.sidebar]` (no main-area keys) | Same as single `[theme]` → `"light"` (main area inherits `lightTheme`) |
| `[theme.light]` and/or `[theme.dark]` | Section from `preference`, `base` forced to the variant, then `_type_from_bg_or_base(..., fallback=preference)` |
| `[theme.light.sidebar]` / `[theme.dark.sidebar]` only | Dual-theme path; merged section has only the forced `base` → `preference` |

`_has_section_content` returns True when the section holds any value that is neither `None`
nor an empty list — empty lists are discounted because the frontend's
`hasThemeSectionConfigs` treats them as "no config" too.
`get_options_for_section` returns every registered key even when the user never wrote the
TOML header, so the *values* are the signal. This is the same determination
`_populate_theme_msg` makes before sending a theme to the client, and the two must agree —
otherwise the backend resolves against config the frontend was never told about.

`_merge_for_dual_theme` lets section values win over `[theme]`, then forces
`base = variant`, mirroring the FE merging `{ base }` last. (`base` is only registered on
`[theme]`, so it cannot come from the section itself.) The only way to override the forced
base is an explicit section `backgroundColor`.

`_type_from_bg_or_base` checks `backgroundColor` luminance, then `base`, then the
fallback. It assumes `base` is already `"light"`/`"dark"`;
`config_util.process_theme_inheritance` guarantees that.

`_parse_color` handles the CSS colour space rather than hex alone, using
`PIL.ImageColor.getrgb` — **no new dependency**, since `pillow>=7.1.0,<13` is already a
runtime dependency of the library. That covers hex in 3/4/6/8 digits, all 148 CSS named
colours, `rgb()` with numbers or percentages, and `hsl()`; alpha is dropped, matching the
frontend. It is imported lazily because the resolver runs at most once per session and the
runtime should not pay for Pillow at startup.

`_luminance` computes WCAG relative luminance (sRGB linearization + BT.709) with threshold
`> 0.5` — identical to color2k's `getLuminance`, which the FE uses via
`hasLightBackgroundColor`. Pin these boundary values in the tests, measured against the
vendored color2k:

| Color | `getLuminance` | Classified |
|-------|---------------|------------|
| `#7f7f7f` | 0.2122 | dark |
| `#808080` | 0.2159 | dark |
| `#bbbbbb` | 0.4969 | **dark** — just below |
| `#bcbcbc` | 0.5029 | **light** — just above |

`#bbbbbb`/`#bcbcbc` is the real crossing. Mid-gray sits at ~0.21 and would pass any
implementation, proving nothing.

`_parse_color` must also retry with a `#` prefix, because the frontend's `parseColor` does
— which makes a bare `backgroundColor = "121212"` a working config that the backend would
otherwise misread.

**Still best-effort, but the gap is narrow.** What remains unparsed is CSS's
space-separated syntax (`rgb(0 0 0)`, `hsl(0 0% 10%)`) and the `transparent` keyword. Those
fall through to the fallback and can be the inverse of what is painted. The resolver
deliberately does **not** grow a full CSS parser to chase them — the echo covers them at
the cost of one extra rerun on that load, which is also what lets the resolver stay small
as frontend theme logic evolves. Pin the remaining gap in a test so it stays visible.

#### Wiring in `app_session.py`

`request_rerun` resolves onto the session's **cached** `_client_state`, and `RerunData`
then reads from that copy — the incoming `client_state` is a different object:

```python
if client_state.HasField("context_info"):
    self._client_state.context_info.CopyFrom(client_state.context_info)
    _resolve_color_scheme(self._client_state.context_info)

query_string = sanitize_query_string(client_state.query_string)
rerun_data = RerunData(
    ...
    # Read from the cached copy, not the incoming parameter: the
    # resolution above only applies to _client_state, and for a client
    # BackMsg these are distinct objects.
    context_info=self._client_state.context_info,
)
```

Resolving on the cached copy also means server-initiated reruns (run-on-save, fragment
reruns) use the resolved value.

```python
def _resolve_color_scheme(context_info: ContextInfo) -> None:
    if not context_info.HasField("theme_preference") or context_info.theme_applied:
        return

    # Only the two known values are actionable; anything else means a client we
    # don't understand, so leave color_scheme alone rather than guessing.
    if context_info.theme_preference == "light":
        preference: theme_type.ThemeType = "light"
    elif context_info.theme_preference == "dark":
        preference = "dark"
    else:
        return

    context_info.color_scheme = theme_type.resolve_theme_type(preference)
```

`_create_new_session_message` sends the echo, left unset when there is no value yet (e.g.
a server-initiated first run) so the client treats it as "unknown" rather than a mismatch:

```python
if self._client_state.context_info.color_scheme:
    msg.new_session.resolved_color_scheme = (
        self._client_state.context_info.color_scheme
    )
```

### 3. Frontend: what it sends

Two fields added to the `contextInfo` built in `sendRerunBackMsg`:

```tsx
themePreference: this.getResolvedThemePreference(), // "light" | "dark"
themeApplied: this.isThemeApplied(),
```

```tsx
isThemeApplied = (): boolean =>
  this.hostThemeApplied || this.state.themeHash !== ""

getResolvedThemePreference = (): "light" | "dark" => {
  // Embed params force a preset regardless of anything else.
  if (isLightThemeInQueryParams()) return "light"
  if (isDarkThemeInQueryParams()) return "dark"

  const cachedSelection = getCachedThemeSelection()
  if (cachedSelection === "Light") return "light"
  if (cachedSelection === "Dark") return "dark"
  return getSystemThemePreference()
}
```

`state.themeHash` is `""` **exactly** during the pre-`processThemeInput` window — a
session with no custom theme still gets a non-empty sentinel hash — so it is a reliable
"has the final theme been applied" test. `hostThemeApplied` is a monotonic flag set **inside** each of
`handleThemeMessage`'s three branches, never after the chain: a host message that matches no
branch paints nothing, so it must not claim the client's `colorScheme` is authoritative.
Once a branch does paint, the flag stays set for the session, which is why it needs no
clearing.

Because `theme_preference` is consulted **only** inside that startup window — before any
in-session interaction — the cached selection and the OS preference are the whole story.
There is no tracked `ThemeSelection`, no host-theme identity comparison, and no new embed
helper: the two existing query-param predicates suffice.

### 4. Self-correcting rerun

Three instance fields on `App`:

| Field | Meaning |
|-------|---------|
| `backendColorScheme: "light" \| "dark" \| null` | What Python currently believes `type` is. `null` means we have not been told yet, which is **not** a disagreement |
| `hostThemeApplied: boolean` | A host has pushed a theme. Monotonic — never cleared, so there is no stale-flag failure mode |
| `pendingThemeRerun: boolean` | A theme rerun that could not be sent because we were busy or offline |

Four hooks:

**1. `handleNewSession`** records the echo *before* `processThemeInput`, so the
`componentDidUpdate` that follows the theme application can compare the two. Anything
other than `"light"`/`"dark"` (including unset) is ignored:

```tsx
if (
  newSessionProto.resolvedColorScheme === "light" ||
  newSessionProto.resolvedColorScheme === "dark"
) {
  this.backendColorScheme = newSessionProto.resolvedColorScheme
}
```

**2. `sendRerunBackMsg`**, after the message is sent, records what Python will now believe:

```tsx
this.backendColorScheme = contextInfo.themeApplied
  ? (contextInfo.colorScheme as "light" | "dark")
  : null
this.pendingThemeRerun = false
```

When we claimed our theme was applied, Python gets exactly the `colorScheme` we sent.
Otherwise the backend is resolving and we learn the value from the echo.

**3. `componentDidUpdate`**, appended after the existing `scriptRunState` handling:

```tsx
// Rerun when what we paint disagrees with what Python holds. `null` means we
// have not been told yet, which is not a disagreement.
if (
  this.backendColorScheme !== null &&
  this.getThemeColorScheme() !== this.backendColorScheme
) {
  this.maybeRerunForThemeChange()
}

if (this.pendingThemeRerun) {
  this.maybeRerunForThemeChange()
}
```

**4. `maybeRerunForThemeChange`** re-checks, defers, or sends:

```tsx
private maybeRerunForThemeChange = (): void => {
  // Same predicate as the caller: null means we have not been told what Python
  // holds, which is not a disagreement to correct.
  if (
    this.backendColorScheme === null ||
    this.getThemeColorScheme() === this.backendColorScheme
  ) {
    this.pendingThemeRerun = false
    return
  }
  if (
    !this.isServerConnected() ||
    this.state.scriptRunState !== ScriptRunState.NOT_RUNNING
  ) {
    this.pendingThemeRerun = true
    return
  }
  // Left set until the BackMsg is actually sent, so a send that silently
  // fails (e.g. the socket dropped underneath us) is retried rather than lost.
  this.widgetMgr.sendUpdateWidgetsMessage(undefined)
}
```

**Why this preserves the current page.** The `undefined` argument to
`sendUpdateWidgetsMessage` is the *fragment id*, which makes this a full-app rerun. The page
hash matters separately: `WidgetStateManager.sendUpdateWidgetsMessage` always calls
`sendRerunBackMsg` with `pageScriptHash` as `undefined`, and `sendRerunBackMsg` then falls
through to `this.state.currentPageScriptHash`. So the rerun cannot carry a stale or empty
page, which is what broke deep links in #11797.

**Loop safety.** Every send refreshes `backendColorScheme`, and the `NewSession` echo
reports what the script actually saw, so once the two agree the comparison short-circuits.
The menu E2E should assert a run counter, proving exactly one rerun per toggle (Principle 34).

**Why this does not regress MPA:**

| Old failure mode (PR #10972) | How this avoids it |
|---|---|
| Fired on `processThemeInput` (preset → custom name change) | Compares painted appearance against the value the backend echoed. Re-applying the same config theme leaves both sides equal, so nothing fires |
| Fired on page navigation / reconnection | Same — a new `NewSession` re-applies the same theme and echoes the same value |
| Used theme NAME comparison | Nothing reads theme names; the comparison is `getThemeColorScheme()` vs. the echo |
| `sendRerunBackMsg()` without page context lost current page | The rerun goes through `sendUpdateWidgetsMessage`, so `sendRerunBackMsg` falls through to `this.state.currentPageScriptHash` |
| Theme change while script running was silently dropped | `pendingThemeRerun`, drained by `componentDidUpdate` once connected and `NOT_RUNNING` |

**Invariant the trigger depends on:** it only fires when React renders. `App` is a
`PureComponent` but re-renders on every `ThemedApp` render because `useThemeManager`
returns a fresh object literal each time. Memoizing that manager for performance would
silently disable this hook, so it is worth a test that would fail loudly if it happened.

### When the first run is still wrong

The rule is exact: **the first run is wrong precisely when the backend's config-based guess
differs from what the client paints.** The echo then corrects it in one rerun. Known cases:

| Case | Why the guess differs |
|------|----------------------|
| `backgroundColor` in a CSS syntax Pillow cannot parse — `rgb(0 0 0)`, `hsl(0 0% 10%)`, `transparent` | The frontend's parser accepts more syntax than Pillow's. Named colours, `rgb()`, `rgb(%)` and `hsl()` **are** handled and are correct on the first run |
| Host theme applied around or after the first `BackMsg` | The guess comes from `config.toml`, but a host theme is what gets painted |
| A mirror divergence not yet found | The resolver re-implements five frontend rules; any of them could drift |

Two properties worth stating explicitly, because they bound how much this matters:

**No silently-wrong case remains.** If the client's luminance agrees with the guess, then
`type` equals the painted appearance, which is correct by definition. So every divergence
is detectable, and every detectable divergence produces exactly one corrective rerun.

**But "corrected in milliseconds" is not free.** The first run *executed* with the wrong
value. For pure rendering the output flashes and settles, invisibly. For a script with
side effects on that run — logging, an API call, a counter, an email — the work was done
with the wrong `type`. This is the inherent cost of any resolver-based approach and the
strongest argument for alternative C.

By contrast, `config.toml` precedence is **not** a source of first-run error. The resolver
reads through `get_options_for_section` *after* all merging has happened — global and
project `config.toml`, environment variables, CLI flags, and `theme.base` file inheritance
(`config_util.process_theme_inheritance` clears and re-applies every `theme.*` option,
sections included). We read the merged answer rather than re-deriving it, so multi-config
precedence cannot drift. Only the section→appearance mapping is mirrored, and that is what
the echo guards.

### 5. Docs

Update the [`context.py`](../../lib/streamlit/runtime/context.py) `theme.type` docstring:
drop the stale first-load and settings-change caveats (both fixed by this design), and keep
the CSS-override note, which remains true.

### 6. Testing

**Python unit** — a new `lib/tests/streamlit/runtime/theme_type_test.py`:

- **Luminance parity with the frontend.** Pin values measured against the vendored color2k,
  including the true `#bbbbbb` / `#bcbcbc` crossing, plus short-form expansion and alpha
  being ignored.
- **Colour parsing.** Hex in all four lengths, named colours, `rgb()`, `rgb(%)`, `hsl()`;
  and rejection of genuine garbage. Also pin the syntax that is *not* parsed
  (`rgb(0 0 0)`, `transparent`) so the remaining gap stays visible rather than silent.
- **The resolver matrix**, one case per row of the product spec's behavior table: presets
  follow preference; single custom `base`; hex and non-hex backgrounds; background winning
  over `base`; no-`base`-no-background falling to light; sidebar-only; dual themes following
  preference; the forced variant `base` overriding a parent `[theme] base`; a section
  background overriding the forced base; and a nested `[theme.light.sidebar]` triggering the
  dual path.

In `app_session_test.py`, four cases around the wiring:

- An unapplied theme gets `color_scheme` resolved — and the **incoming BackMsg must stay
  untouched**, which is what proves `RerunData` read the resolved copy rather than the
  parameter.
- An applied theme is trusted, with `resolve_theme_type` never called.
- A client sending no `theme_preference` passes straight through, covering old frontends.
- `_create_new_session_message` populates the echo, and leaves it unset when there is no
  value to send.

**Frontend unit** — `App.test.tsx` needs the two new `contextInfo` fields added to the three
existing `sendRerunBackMsg` assertions, plus dedicated coverage for the parts E2E reaches
awkwardly: `isThemeApplied` across the startup window and after a host theme;
`getResolvedThemePreference` for each source; and `maybeRerunForThemeChange` deferring while
`RUNNING` or disconnected and draining once idle.

**E2E** — one module per theme configuration, since a module can only apply one (see
[Implementation notes](#implementation-notes)):

| Scenario | Config | Assert |
|----------|--------|--------|
| First-run correctness — the core of #11920 | `base=dark` + a dark `backgroundColor`, light OS preference | `type` is `"dark"` with no interaction, and stays `"dark"` across a rerun (covering the handoff to the client's own value) |
| Non-hex background | `backgroundColor="black"`, light OS preference | the computed background really is `rgb(0, 0, 0)`, and `type` is `"dark"` on the first run |
| Menu appearance change — #15287 | none (presets) | Light→Dark→Light from the settings menu updates `type` with no manual rerun, and a run counter proves exactly one rerun per toggle |
| MPA deep link — the #11797 guard | `[theme]` set | entering a non-default page by direct URL still lands on that page. **No such test exists today:** `mpa_v2_custom_theme_test.py` configures a theme but navigates by clicking, and `mpa_basics_test.py` deep-links with no theme — so the regression this design must not reintroduce is currently unguarded |

Also unskip [`hostframe_app_test.py::test_st_context_theme_respects_dark_theme_message`](../../e2e_playwright/hostframe_app_test.py),
skipped since #11870. No new CI infrastructure — the hostframe suite already exists.

Run the theme E2Es on Firefox and WebKit as well as Chromium: the trigger depends on React
lifecycle timing, which is the kind of thing that differs between engines.

## Implementation notes

Behaviors of the existing code that this design leans on. None is obvious from the
surrounding code, and each one will cost time if it is discovered late.

- **`patch_config_options` will not work for this resolver.**
  `streamlit/testing/v1/util.py` patches only `config.get_option`, and the resolver reads
  whole sections via `get_options_for_section`, which walks registered `ConfigOption`
  values directly — so the usual helper has no effect. Resolver tests need to set real
  values with `config._set_option` and restore both the value and `where_defined`
  afterwards; a small context manager is the tidiest way.
- **`hasThemeSectionConfigs` treats an empty array as "no config".** So the backend's
  section-emptiness check has to discount empty lists too, or a `[theme.light]` containing
  only `chartCategoricalColors = []` puts the backend on the dual-theme path while the
  frontend builds a single custom theme.
- **`createThemeHash(undefined)` returns a non-empty sentinel**
  (`"hash_for_undefined_custom_theme"`). That is what makes `state.themeHash !== ""` a
  sound test for "`processThemeInput` has run", even for apps with no custom theme, and
  therefore what makes `theme_applied` computable at all.
- **`setAndSendTheme` only sets the theme and notifies the host** — it does *not* send a
  rerun, so a menu selection produces exactly one rerun, from the trigger in §4.
- **A theming E2E module can exercise only ONE theme configuration.** The config fixture is
  `@pytest.mark.early` and module-scoped, applied before the app server boots. A second
  config fixture in the same file is silently ignored — the server keeps serving the first
  config. Each theme scenario therefore needs its own module. The failure mode is a
  confusing assertion mismatch rather than an error, so this is worth knowing up front.
- **`theme.base` may be a TOML path or URL.** `config_util.process_theme_inheritance`
  normalizes it to `"light"`/`"dark"` before options are read, so
  `_type_from_bg_or_base` can treat `base` as a plain variant name. Do not make it resolve
  paths.
- **Non-hex `backgroundColor` is deliberately supported by the frontend.** `parseColor` in
  `frontend/lib/src/theme/utils.ts` runs the value through the browser's CSS parser,
  retries with a `#` prefix, and warns only on real failure. So `"black"` is a valid,
  working config that must not be rejected — which is precisely why the echo exists.

## Alternatives considered

Two of these are genuinely simpler than the proposal and deserve a real decision rather
than a dismissal, because both eliminate the resolver — and with it the FE/BE mirror that
is this design's main long-term liability. The proposal sits deliberately between them.

### A. Echo only — delete the resolver

Keep `resolved_color_scheme`, drop `theme_type.py` and `theme_preference` entirely. The
first run uses whatever the client's provisional `color_scheme` says; the echo detects the
disagreement and reruns once.

- **Buys:** no second implementation of frontend theme rules in Python, so the drift risk
  and the non-hex gap both disappear. Materially less code.
- **Costs:** the first script run is wrong for *every* custom theme, not just edge cases —
  which is the larger half of [#11920](https://github.com/streamlit/streamlit/issues/11920).

Worth noting this is exactly what the proposal already does for non-hex backgrounds,
generalized to all custom themes. **Rejected** for first-run correctness, but it is the
right fallback if the mirror proves hard to maintain.

### B. Backend uses config `base` / `backgroundColor` only (no preference)

Fixes single-custom-with-`base` quickly; fails for dual light/dark sections and
preset-only Dark menu selection. **Rejected** as sole fix.

### C. Push the theme to the client before the first script run

On connect, the backend sends the `config.toml` theme; the client applies it and only then
sends its first rerun, already carrying a correct `color_scheme`.

**Buys:** no resolver, no mirror of frontend rules, no colour-parsing gap at all, and a
correct first run for `config.toml` themes.

**Costs — and they are larger than they first look:**

1. **An extra round trip before the script starts, on every session.** Today the sequence
   is `connect → client rerun → script runs`. This makes it
   `connect → server theme → client applies → client rerun → script runs`. The delay lands
   on **time to first content**, not time to first paint — the client already paints a
   cached or preset theme immediately, so users would see the chrome just as fast and then
   wait longer for the app body.
2. **Every app pays it, to fix a value most apps read once or never.** The cost is
   universal; the benefit is confined to apps that read `st.context.theme.type` on their
   first run.
3. **It hurts the deployments least able to absorb it.** Community Cloud and especially
   SiS/SPCS sit behind longer network paths, an embedding iframe, and a container or
   warehouse layer. An added RTT there is materially worse than on localhost, and it
   compounds with cold-start latency that users already notice.
4. **It does not even fix the host-theme case — which is the SiS case.** Host themes arrive
   from the *embedder* via `SET_CUSTOM_THEME_CONFIG` postMessage, not from the server, so
   the backend cannot push them ahead of the first run. C would still need a correction
   mechanism for exactly the platform paying the most latency for it.
5. **Protocol reordering rather than additive fields**, so old/new client-server
   combinations need real thought instead of falling out of optional-field semantics.

**Rejected.** Point 4 is decisive: C pays a universal, SiS-weighted latency cost and still
does not remove the need for the echo. If reviewers weight first-run side effects heavily
(see [When the first run is still wrong](#when-the-first-run-is-still-wrong)), the cheaper
move is to narrow the resolver's remaining gaps rather than reorder the handshake.

### D. Have the client *predict* the backend's answer instead of being told it

Instead of the echo, the client could key its rerun on the inputs the backend resolves
from — the appearance preference plus a flag for whether a host theme is active — and rerun
whenever that pair changes.

**Rejected.** Predicting the answer is strictly weaker than being told it, and the
bookkeeping is worse: the client would have to track the user's `ThemeSelection` itself
(with careful rules about which code paths may write it, since `processThemeInput` also
applies themes), identify the host theme by object reference rather than name (host imports
and single `config.toml` custom themes share the `CUSTOM_THEME_NAME` constant), and reason
explicitly about host-message arrival ordering. It also fires redundant reruns when the
preference changes but config pins the appearance either way — and it cannot detect a
backend/frontend disagreement at all, which is the failure mode most worth catching.

### If product picks A or B instead of C

Only §2 changes. The proto and the §3/§4 exchange are agnostic to *what* the backend
resolves — the echo compares whatever the script saw against what is painted either way.

## Out of scope

- Full theme config on `st.context.theme` ([#11536](https://github.com/streamlit/streamlit/issues/11536)).
- Programmatic theme setters at runtime ([#14172](https://github.com/streamlit/streamlit/issues/14172)).
- Full Emotion theme build on the backend.
- A complete CSS colour parser on the backend. `_parse_color` uses Pillow, which covers
  hex, named colours, `rgb()` and `hsl()`; the space-separated syntax and `transparent`
  are left to the echo rather than reimplemented.
- CSS-injected backgrounds affecting `type`.

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | Host theme path is explicit; unskipping the existing hostframe E2E covers it, with no new CI infra |
| No breaking API changes | Additive proto fields; `type` shape unchanged. Old FE + new BE leaves `color_scheme` as client-sent |
| No new dependencies | `_parse_color` uses `PIL.ImageColor`, already a runtime dependency (`pillow>=7.1.0,<13`), imported lazily |
| Metrics collected | Existing `context.theme` metrics sufficient |
| Any security/legal impact? | No |
| Any docs changes needed? | Yes — the `context.py` docstring (§5) |
