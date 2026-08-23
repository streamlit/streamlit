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
4. The echo is **gated**: it is sent only on the first `NewSession` of a session, or once a
   run has actually read `st.context.theme`. With no echo there is nothing to compare, so
   the client does not rerun.

Point 4 matters as much as the rest. `st.context.theme.type` is read by roughly **0.6% of
apps**, so a correction mechanism that fired for everyone would charge the other 99.4% for a
value they never read. See [the access gate](#5-the-access-gate)
for what it costs them (one correction per session, not zero) and for the client-side
condition that makes gating safe rather than harmful.

The echo is what makes the system self-correcting. The backend resolver is deliberately
best-effort — it parses most CSS colours but not every syntax — and any disagreement, from
an unparseable `backgroundColor` to a resolver bug to future frontend drift, is detected
and fixed by one automatic rerun, with the client's painted value winning. That is the
correct outcome under **Option C** (visual appearance) in the
[product spec](./product-spec.md).

See [Implementation notes](#implementation-notes) for behaviors of the existing code that
this design depends on, and that are easy to get wrong.

### Terms

Four terms this design leans on, which are easy to conflate:

| Term | Meaning |
|------|---------|
| **Appearance preference** | What the user or their OS asked for: menu `Light` / `Dark` / `System`, with `System` resolved against `prefers-color-scheme`. Sent as `theme_preference` |
| **Painted appearance** | Whether the app actually renders light or dark, from the active theme's background luminance (`getThemeColorScheme`). What Option C defines `type` to mean |
| **Theme applied** | Whether the client is painting its *final* theme for this session, which makes its own `color_scheme` authoritative. Sent as `theme_applied` |
| **Echo** | `NewSession.resolved_color_scheme` — the value the script actually saw, sent back so the client can detect a disagreement |

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
the backend. So getting the *first* run right means either resolving it there, or reordering
the handshake so the client has the theme before it asks for a run — which is what
[the design space](#the-design-space-three-approaches) weighs. Everything after the first run
is correctable without either.

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

## The design space: three approaches

Everything else in this spec is shared: the echo (`resolved_color_scheme`), the client
comparison in §3-§4, and the access gate in §5. The three approaches differ **only in how
the first script run gets its value**.

These are approaches to *implementation*. They are unrelated to the product spec's Options
A/B/C, which decide what `type` should *mean*. That decision is **Option C** (visual
appearance), owned by the [product spec](./product-spec.md) and settled by merging it. All
three approaches below implement that meaning; see
[Alternatives considered](#if-the-product-spec-picks-meaning-a-or-b-instead-of-c) for what
changes if it lands differently.

| | **A — lightweight** | **B — robust** (proposed) | **C — push theme ahead** |
|---|---|---|---|
| How run 1 gets its value | the client's provisional value; corrected on run 2 | the backend resolves from `config.toml` before the run | the backend sends the theme *before* the client's first rerun |
| Run 1, ordinary custom theme | **wrong** — visible flash | **right** | **right** |
| Run 1, host theme (SiS) | wrong → corrected | wrong → corrected | **still wrong** — host themes come from the embedder, not the server |
| Added latency | none | none | +1 RTT before first content, every session, every app |
| Proto change | 1 field | 3 fields, all additive | protocol reordering |
| Backend code | none | ~110 lines | new pre-session message + handshake ordering |
| Mirrors frontend rules | no | 3 rules | no |
| Verdict | viable fallback | **proposed** | rejected — see below |

### A vs B, in detail

These are the two live candidates. C is rejected on grounds that do not depend on the
adoption argument (see the end of this section).

| | **A — lightweight** | **B — robust** |
|---|---|---|
| `theme_type.py` | not needed | ~110 lines; 189 with docs |
| Of which mirrors frontend behaviour | — | 3 rules: section inheritance, dual-theme detection, single-theme light fallback |
| Of which is standard or delegated | — | `_luminance` is the published WCAG formula; `_parse_color` delegates to Pillow |
| Proto fields | `resolved_color_scheme` | + `theme_preference`, `theme_applied` |
| `app_session` wiring | unchanged | must pass a **copy** of `context_info` to `RerunData` (§2) |
| `AGENTS.md` "no backend theming" | not engaged | narrow exception; the rule targets styling/layout math, and its stated worry — the backend cannot see the active theme — is exactly what the echo answers |
| Reruns, app that reads `type` | 2 on first load | 1 on first load |
| Reruns, app that does not | none, after the gate | none, after the gate |
| Residual wrong first runs | all custom themes | unparseable colour syntax; host-theme race |
| Ongoing maintenance | none | keep 3 rules in step with the frontend |

**What A costs the user.** Not an invisible delay. Run 1 renders with the wrong value — a
light logo on a dark background, or `plotly_white` on a dark page — and then flips. For an
API whose whole purpose is contrast adaptation, the first paint *is* the product, and "first
run with a custom theme" is the first failure mode
[#11920](https://github.com/streamlit/streamlit/issues/11920) lists. A closes the issue's
second half and leaves the first visible on every load.

**What B costs the team.** Three mirrored rules, anchored to the *public* `[theme]` config
schema. That schema is user-facing contract and does not churn freely — it last changed when
dual themes were introduced. So drift is a real but modest risk, and the echo bounds any
drift to one wrong first run rather than a stale session. Note also that neither option
avoids the harder part — the shared client trigger in §4, where the subtle failure modes live
(dropped sends, duplicate corrections, stale comparisons) and which A and B need identically.
A is smaller, not safer.

**Decision rule.** If a visible wrong-contrast flash on first load is acceptable, take A and
delete the resolver. If it is not — and for a contrast-adaptation API that is hard to argue
— take B. Nothing else changes either way, so A stays a clean retreat if the mirror ever
becomes a burden.

### Why C is rejected

On connect the backend would send the `config.toml` theme; the client applies it and only
then sends its first rerun, already carrying a correct `color_scheme`. That buys a correct
first run with no resolver and no mirror — genuinely attractive — but:

1. **An extra round trip before the script starts, every session.** `connect → client rerun
   → script runs` becomes `connect → server theme → client applies → client rerun → script
   runs`. The delay lands on time to first *content*; the client already paints a cached or
   preset theme immediately, so users would see chrome as fast as ever and then wait longer
   for the body.
2. **Every app pays it**, to fix a value ~0.6% of apps read.
3. **It hurts the deployments least able to absorb it** — Community Cloud and especially
   SiS/SPCS sit behind longer paths, an iframe, and a container or warehouse layer, on top of
   cold-start latency users already notice.
4. **It does not fix the host-theme case, which is the SiS case.** Host themes arrive from
   the embedder via `SET_CUSTOM_THEME_CONFIG`, not from the server, so the backend cannot
   push them ahead of the first run. C would still need the echo — for exactly the platform
   paying the most latency for it.
5. **Protocol reordering rather than additive fields**, so version-skew combinations need
   real thought instead of falling out of optional-field semantics.

Point 4 is decisive: a universal, SiS-weighted latency cost that still does not remove the
correction mechanism.

## Proposal

This describes **approach B**. Under approach A, §2 is dropped entirely and §1 carries only
`resolved_color_scheme`; everything else — §3 through §7 — is identical.

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

`resolved_color_scheme` is **conditionally** populated — see
[the access gate](#5-the-access-gate). Its absence is meaningful
rather than merely empty: it tells the client there is nothing to keep truthful, and the
client must clear its copy rather than retain the last value.

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

It reads all six theme sections (`theme`, `theme.light`, `theme.dark`, and their `.sidebar`
subsections) and branches in this order: **no theme config at all** → return the preference;
**any light/dark section has content** → dual-theme path; **otherwise** → single custom theme.
Dual-theme detection must include the nested `.sidebar` subsections, because the frontend's
`hasThemeSectionConfigs` looks one level into nested objects.

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
TOML header, so the *values* are the signal.

**Mirror `hasThemeSectionConfigs`, not `_populate_theme_msg`.** The nearby backend check is
the tempting model and it is the wrong one: `_populate_theme_msg` early-returns only on
`all(val is None ...)`, so it counts `chartCategoricalColors = []` as content, while the
frontend discounts empty lists. Copying the backend check would put the resolver on the
dual-theme path for a `[theme.light]` holding only an empty colour list, while the client
builds a single custom theme — the two would then disagree about which theme is even active.
The frontend is the authority here, because what it paints is what `type` must report.

`_merge_for_dual_theme` lets section values win over `[theme]`, then forces
`base = variant`, mirroring the FE merging `{ base }` last. (`base` is only registered on
`[theme]`, so it cannot come from the section itself.) The only way to override the forced
base is an explicit section `backgroundColor`.

`_type_from_bg_or_base` checks `backgroundColor` luminance, then `base`, then the
fallback. It assumes `base` is already `"light"`/`"dark"`;
`config_util.process_theme_inheritance` guarantees that.

**Colour handling** must match the frontend, because a mismatch reports the inverse of what
is painted:

- `_parse_color` uses `PIL.ImageColor.getrgb` — **no new dependency**, `pillow>=7.1.0,<13`
  is already required — covering hex in 3/4/6/8 digits, the 148 CSS named colours, `rgb()`
  with numbers or percentages, and `hsl()`. Alpha is dropped, matching the frontend. Import
  it lazily: the resolver runs at most once per session.
- It must **retry with a `#` prefix**, because the frontend's `parseColor` does — otherwise a
  bare `backgroundColor = "121212"` is a working config the backend misreads.
- `_luminance` is WCAG relative luminance (sRGB linearization + BT.709) with threshold
  `> 0.5`, identical to color2k's `getLuminance`. Pin the boundary in tests at **`#bbbbbb`
  (0.4969, dark) / `#bcbcbc` (0.5029, light)** — that is the real crossing. Mid-gray sits at
  ~0.21 and would pass any implementation, proving nothing.
- **Still best-effort, and the gap is wider than it looks.** Unparsed: CSS's space-separated
  syntax (`rgb(0 0 0)`, `hsl(0 0% 10%)`), `transparent`, and the modern colour functions
  `oklch()`, `oklab()`, `lab()`, `lch()`, `hwb()`. Those five are not hypothetical —
  `frontend/lib/src/theme/utils.test.ts` pins them as accepted `backgroundColor` values, so
  each is a working config whose first run the backend gets wrong. All fall through to the
  fallback. The resolver deliberately
  does not grow a full CSS parser: the echo covers them at the cost of one rerun, which is
  what lets the resolver stay small as frontend theme logic evolves. Pin that gap in a test
  so it stays visible.

#### Wiring in `app_session.py`

`request_rerun` resolves onto the session's **cached** `_client_state` — the incoming
`client_state` is a different object, so resolving on the parameter would never reach the
script — and then hands `RerunData` a fresh snapshot of the result:

```python
if client_state.HasField("context_info"):
    self._client_state.context_info.CopyFrom(client_state.context_info)
    _resolve_color_scheme(self._client_state.context_info)

# A snapshot, NOT the session's own object -- see below.
context_info = ContextInfo()
context_info.CopyFrom(self._client_state.context_info)

query_string = sanitize_query_string(client_state.query_string)
rerun_data = RerunData(
    ...
    context_info=context_info,
)
```

**Hand `RerunData` a copy, not `_client_state.context_info`.** `RerunData` is a snapshot,
but the session's `context_info` is long-lived and every later rerun request overwrites it
in place, while `ScriptRunContext` holds whatever object it was given and `st.context` reads
it lazily at property-access time. Passing the live object lets an incoming request change
what an *already-running* script sees — for `theme.type` and equally for `timezone`,
`locale`, `url`, and `is_embedded`. Copy the incoming context into the session cache and
resolve *there* — never on the `client_state` parameter, which is the caller's message and
must come back untouched — then `CopyFrom` the result into a fresh `ContextInfo` for
`RerunData`. A test that only asserts the incoming BackMsg is untouched will not catch the
aliasing; assert the *outgoing* snapshot is stable across a second request.

Resolving onto the cache is also what carries the value across reruns the client did not
ask for. **These are not a special case, and it is worth being precise, because assuming
they were would invent one:** `run_on_save` calls `request_rerun(self._client_state)`, and
`st.rerun()` / `st.switch_page()` pass `context_info=ctx.context_info` into `RerunData`
([`execution_control.py`](../../lib/streamlit/commands/execution_control.py)) — all of them
reuse the last client context, so the echo should report whatever that run actually saw, as
usual. The only path with `context_info=None` is `request_rerun(None)`, used by
`Runtime.does_script_run_without_error` (the app-warmup check) and by tests, where there is
no browser: `type` is `None` for that run and the echo correctly stays unset.

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

`_create_new_session_message` sends the echo — **subject to the
[access gate](#5-the-access-gate)**, and left unset when there is
no value yet (e.g. the `request_rerun(None)` warmup path), which the client treats as
"nothing to compare" rather than a mismatch:

```python
# `color_scheme_this_run` arrives on the SCRIPT_STARTED event, NOT from
# `self._client_state` -- see below.
correction_can_matter = not self._has_sent_new_session or self._context_theme_was_read
if correction_can_matter and color_scheme_this_run:
    msg.new_session.resolved_color_scheme = color_scheme_this_run
self._has_sent_new_session = True
```

**The echo must come from the run's own snapshot, not `_client_state`.** This is the same
aliasing hazard as `RerunData` above, on the reporting side, and it is easy to miss because
the buggy version reads naturally. `ScriptRunner` emits `SCRIPT_STARTED` from the **script
thread**, and `_on_scriptrunner_event` hands it to the event loop via
`call_soon_threadsafe`; `_create_new_session_message` therefore runs *later* than the
moment the run began. A `BackMsg` arriving in that gap runs `request_rerun` on the loop
first, overwriting `_client_state.context_info` in place, so an echo read from there can
report a value **this run never saw**.

The consequence is worse than a spurious rerun: if the stale echo happens to match what the
client paints, the client sees agreement, the real disagreement is never corrected, and
`type` stays wrong for the rest of the session — silently, and precisely the bug #11920 is
about. Carry the run's value on the event instead. `SCRIPT_STARTED` already passes per-run
data (`page_script_hash`, `fragment_ids_this_run`, `pages`), and at the emission site
`rerun_data.context_info` is in scope — the very object just handed to `ctx.reset()`, so it
is by construction what the script sees. Note that stashing the snapshot on the session at
`request_rerun` time does **not** work: a second request would overwrite that field before
the first `SCRIPT_STARTED` is processed, reproducing the same race one level down.

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
"has the final theme been applied" test. `hostThemeApplied` covers the other way the window
can close; see §4 for how it is set.

Because `theme_preference` is consulted **only** inside that startup window — before any
in-session interaction — the cached selection and the OS preference are the whole story.
There is no tracked `ThemeSelection`, no host-theme identity comparison, and no new embed
helper: the two existing query-param predicates suffice.

### 4. Self-correcting rerun

Three instance fields on `App`:

| Field | Meaning |
|-------|---------|
| `backendColorScheme: "light" \| "dark" \| null` | What Python currently believes `type` is. `null` means we have not been told yet, which is **not** a disagreement |
| `hostThemeApplied: boolean` | A host has pushed a theme. Set **inside** each `handleThemeMessage` branch, never after the chain — a message matching no branch paints nothing and must not claim authority. Monotonic thereafter |
| `themeCorrectionInFlight: boolean` | A correction was sent and the server has not answered. Cleared only on observed events (see below) |

There is deliberately **no** "pending rerun" flag. The disagreement between what we paint
and `backendColorScheme` *is* the pending state, and unlike a flag it survives disconnects
and sends that never reach the server.

Four hooks:

**1. `handleNewSession`** does two things that **must not be placed together**, which is the
single most error-prone detail in this design:

```tsx
// Above the fragment branch: EVERY NewSession records the echo.
const resolved = newSessionProto.resolvedColorScheme
this.backendColorScheme =
  resolved === "light" || resolved === "dark" ? resolved : null

if (!fragmentIdsThisRun.length) {
  // Inside it: only a full-app NewSession answers a correction.
  this.themeCorrectionInFlight = false
  ...
}
```

**Recording goes above the `if (!fragmentIdsThisRun.length)` branch.** Do not put it next to
`processThemeInput`, which lives inside that branch: fragment reruns skip it, and the
"absent echo means stop comparing" rule of §5 has to hold for every `NewSession` or a stale
value survives. An absent or unrecognized echo must be recorded as `null`, **not** skipped —
skipping is the infinite-loop mode described in §5. The only ordering the comparison needs is
"before the `componentDidUpdate` that follows", which holds anywhere in this method;
applying the theme is unrelated.

**Clearing the in-flight flag stays inside the full-app branch.** A correction is always a
full-app rerun, so only a full-app `NewSession` can answer one. Clearing on a fragment's
`NewSession` releases the guard while the disagreement is still unresolved, and the next
render sends a **second, redundant full-app correction** — one theme change, two app runs.
Moving both statements together looks like the tidy refactor and is a defect; there is a
regression test for it in §7.

**`sendRerunBackMsg` must NOT record what Python will believe.** The echo is the only
writer of `backendColorScheme`. Predicting it at send time is unsound, because
`ConnectionManager.sendMessage` logs an error and returns `void` when disconnected — the
caller cannot tell whether the message went out. A predicted update after a discarded send
would leave the client believing Python holds a value it never received, with no
disagreement left to detect.

**2. `componentDidUpdate`**, appended after the existing `scriptRunState` handling — one
unconditional re-evaluation:

```tsx
this.maybeRerunForThemeChange()
```

**3. `maybeRerunForThemeChange`** compares, and either sends or does nothing:

```tsx
private readonly maybeRerunForThemeChange = (): void => {
  // `null` means we have not been told what Python holds, so there is nothing
  // to correct yet.
  if (
    this.backendColorScheme === null ||
    this.getThemeColorScheme() === this.backendColorScheme
  ) {
    return
  }

  if (
    this.themeCorrectionInFlight ||
    !this.isServerConnected() ||
    this.state.scriptRunState !== ScriptRunState.NOT_RUNNING
  ) {
    // Cannot or should not send right now. Nothing to remember: the disagreement
    // persists in state, and reconnecting, the script finishing, or the server
    // answering all re-render and re-check.
    return
  }

  this.widgetMgr.sendUpdateWidgetsMessage(undefined)

  // Suppress duplicate sends until the server answers.
  this.themeCorrectionInFlight = true
}
```

**4. `handleConnectionStateChanged`** is the other half of that flag's lifecycle, and the
reason a dropped send is not lost forever. It is easy to omit, because nothing fails visibly
without it — the correction is simply never retried:

```tsx
// Leaving CONNECTED: the in-flight send may have been discarded, since
// ConnectionManager.sendMessage drops messages and returns normally when
// disconnected. Forget the in-flight assumption so the disagreement -- still
// recorded in backendColorScheme -- is retried on the reconnect re-render.
if (this.state.connectionState === ConnectionState.CONNECTED) {
  this.themeCorrectionInFlight = false
}
```

Four constraints on this, each of which is easy to get wrong:

**Use a local flag, not `scriptRunState`.** Marking the app `RERUN_REQUESTED` is tempting —
it would block a second send and let the reconnect path retry a dropped one — but that state
makes `isElementStale` return `true` for *every* element and shows a running indicator, so a
theme change would grey out the whole app. `sendUpdateWidgetsMessage` avoids it for the same
reason (see the `ChatInput` comment).

**Clear the flag only on observed events**, never on the assumption a send succeeded:
`ConnectionManager.sendMessage` discards messages and returns `void` when disconnected. Clear
it when a `NewSession` arrives, and when the connection drops — the latter is what retries a
discarded send, since the disagreement is still recorded and reconnecting re-renders.

**The echo is the only writer of `backendColorScheme`** (hook 1). Loop safety follows from
that: once the echo and the paint agree, the comparison short-circuits.

**Corrections land one script completion later.** The echo rides on `NewSession`, which
carries `sessionStatus.scriptIsRunning = true`, so the client learns Python's value while the
script is running and the correction waits for that run to finish. Never same-run.

The rerun preserves the current page, which is what #11797 turned on: `undefined` here is the
*fragment id*, making this a full-app rerun, while `WidgetStateManager` separately passes
`pageScriptHash` as `undefined`, so `sendRerunBackMsg` falls through to
`this.state.currentPageScriptHash` and cannot carry a stale or empty page.

**Why this does not regress MPA:**

| Old failure mode (PR #10972) | How this avoids it |
|---|---|
| Fired on `processThemeInput` (preset → custom name change) | Compares painted appearance against the value the backend echoed. Re-applying the same config theme leaves both sides equal, so nothing fires |
| Fired on page navigation / reconnection | Same — a new `NewSession` re-applies the same theme and echoes the same value |
| Used theme NAME comparison | Nothing reads theme names; the comparison is `getThemeColorScheme()` vs. the echo |
| `sendRerunBackMsg()` without page context lost current page | The rerun goes through `sendUpdateWidgetsMessage`, so `sendRerunBackMsg` falls through to `this.state.currentPageScriptHash` |
| Theme change while script running was silently dropped | Nothing to drop: the disagreement persists in state, and the script finishing re-renders and re-checks |

**Invariant the trigger depends on:** it only fires when React renders. `App` is a
`PureComponent` but re-renders on every `ThemedApp` render because `useThemeManager`
returns a fresh object literal each time. Memoizing that manager for performance would
silently disable this hook, so it is worth a test that would fail loudly if it happened.

### When the first run is still wrong

The rule is exact: **the first run is wrong precisely when the backend's config-based guess
differs from what the client paints.** The echo then corrects it in one rerun. Known cases:

| Case | Why the guess differs |
|------|----------------------|
| `backgroundColor` in a CSS syntax Pillow cannot parse — space-separated `rgb()`/`hsl()`, `transparent`, and `oklch()`/`oklab()`/`lab()`/`lch()`/`hwb()` | The frontend's parser accepts more syntax than Pillow's. Named colours, `rgb()`, `rgb(%)` and `hsl()` **are** handled and are correct on the first run |
| Host theme applied around or after the first `BackMsg` | The guess comes from `config.toml`, but a host theme is what gets painted |
| A mirror divergence not yet found | The resolver re-implements three frontend rules; any could drift |

**No case is silently wrong** — if the client's luminance agrees with the guess then `type`
equals the painted appearance by definition, so every divergence is detectable and produces
exactly one corrective rerun. **But the correction is not free:** run 1 *executed* with the
wrong value, and the output is visible before it settles. A light logo on a dark background
is not a subliminal flicker, and a script with side effects on that run — a log, an API call,
a counter — performed them with the wrong `type`. That residue is the strongest argument for
approach C, and why approach A is not simply a cheaper B.

Note that `config.toml` **precedence** is not a source of error: the resolver reads
`get_options_for_section` *after* all merging — global and project config, env vars, CLI
flags, and `theme.base` file inheritance — so it reads the merged answer rather than
re-deriving it. Only the section→appearance mapping is mirrored.

### 5. The access gate

`st.context.theme.type` is read by roughly **0.6% of apps**, so no approach may add reruns
for the other 99.4%. Send `resolved_color_scheme` only when a correction could matter:

```python
correction_can_matter = not self._has_sent_new_session or self._context_theme_was_read
```

**Do not use `gather_metrics` to detect the access.** `@gather_metrics("context.theme")`
only records when `ctx.gather_usage_stats` is true, and `metrics_util` skips tracking
entirely when `browser.gatherUsageStats` is off — so telemetry-disabled deployments would
silently lose corrections. Notify explicitly instead: `ContextProxy.theme` calls an
`on_context_theme_read` callback carried on `ScriptRunContext`, following the route
`on_script_error` already takes (`AppSession` → `ScriptRunner` → context). `AppSession`
holds the memory in two sticky booleans, because a per-run context cannot outlive the run
that made the access. There is no pre-existing "have we sent a `NewSession`" signal; add one.

Put the callback *before* the `context_info is None` early return, so an access counts even
when there is no value yet. Note the gate is intentionally coarse: bare `st.context.theme`
with no field access still counts. `ContextProxy` is a plain class rather than a dict, so
the property is the only door and both `.type` and `["type"]` route through it.

**The client must treat an absent echo as "nothing to compare", not "keep the old value".**
This is the part that is easy to get wrong and it is load-bearing:

```tsx
this.backendColorScheme =
  resolved === "light" || resolved === "dark" ? resolved : null
```

Retaining the previous value instead — an `if (valid) { assign }` — creates an **infinite
correction loop** once the gate engages: the client corrects, the resulting `NewSession`
carries no echo, the stale value is kept while `themeCorrectionInFlight` is cleared, so the
disagreement never resolves and the client corrects again, forever. The backend gate alone
is *worse* than no gate. Cover this with a test that counts reruns rather than asserting an
absence.

**What it actually costs a non-reading app: one correction per session, not zero.** The
first `NewSession` is emitted at `SCRIPT_STARTED`, before any user code runs, so the client
necessarily holds a comparable value through run 1. A no-read app therefore pays exactly one
correction — on the first theme change after load — and none thereafter, since the unechoed
`NewSession` from that very rerun nulls the client's copy. If any unrelated rerun happens
first, the cost is zero. The saving is one-per-session instead of one-per-theme-change.

### 6. Docs

Update the [`context.py`](../../lib/streamlit/runtime/context.py) `theme.type` docstring:
drop the stale first-load and settings-change caveats (both fixed by this design), and keep
the CSS-override note, which remains true.

### 7. Testing

**Python unit** — a new `lib/tests/streamlit/runtime/theme_type_test.py`:

- **Luminance parity with the frontend.** Pin values measured against the vendored color2k,
  including the true `#bbbbbb` / `#bcbcbc` crossing, plus short-form expansion and alpha
  being ignored.
- **Colour parsing.** Hex in all four lengths, named colours, `rgb()`, `rgb(%)`, `hsl()`;
  and rejection of genuine garbage. Also pin the syntax that is *not* parsed
  (space-separated `rgb()`/`hsl()`, `transparent`, and `oklch()`/`oklab()`/`lab()`/`lch()`/
  `hwb()`) so the size of the gap stays visible rather than silent — and so that Pillow
  learning one of them shows up as a test change instead of a behaviour change.
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
- **The echo reports the run's own value, not a later one.** Deliver `SCRIPT_STARTED` for a
  run carrying `"light"`, then apply a second `request_rerun` carrying `"dark"` *before*
  building the message, and assert the echo is still `"light"`. Without this, the aliasing
  bug is invisible: every single-request test passes either way.

**Python unit, the gate** — three cases on `_create_new_session_message`: the first
`NewSession` echoes; a later one does **not** when no run has read the theme; a later one
does once a run has. Plus, on the notification path: reading `st.context.theme` sets the
flag, reading a sibling like `st.context.timezone` does **not**, and a `None` handler is
harmless (which is how `AppTest` runs).

**Frontend unit** — `App.test.tsx` needs the two new `contextInfo` fields added to the three
existing `sendRerunBackMsg` assertions, plus dedicated coverage for the parts E2E reaches
awkwardly: `isThemeApplied` across the startup window and after a host theme;
`getResolvedThemePreference` for each source; `maybeRerunForThemeChange` deferring while
`RUNNING` or disconnected and draining once idle; a dropped send being retried after a
reconnect (the hook-4 clear); **that the client stops correcting once the echo stops
arriving** — the test that catches the infinite-loop failure mode described in the access
gate; and **two tests for the split in §4's hook 1**, which pin it from both sides:

- *A fragment `NewSession` records the echo* — pins the recording above the full-app branch.
  Assert the **positive**: a fragment echo that disagrees *does* produce a correction. The
  tempting negative form ("an unechoed fragment `NewSession` causes no further correction")
  passes even with the recording inside the branch, because the uncleared in-flight flag
  suppresses the send by itself. And do not reach for a disconnect to clear that flag: on
  reconnect the app requests its own rerun when the last run was a fragment, so the rerun
  count stops measuring corrections.
- *A fragment `NewSession` does not reopen an unresolved correction* — pins the flag clear
  inside the branch. Send a correction, then deliver a fragment `NewSession` still echoing
  the stale value, and assert the rerun count is **unchanged**. Without this, moving both
  statements above the branch — which reads as the obvious cleanup — silently doubles the
  reruns for a single theme change.

**Mutation-test every guard.** Each of these tests should be verified by removing the
protection it covers and confirming it goes red. A guard test that cannot fail is worse than
no test, because it manufactures confidence. The failure mode is specific and easy to hit
here: a guard test can be satisfied by a rerun from an unrelated code path and pass whether
or not the guard exists.

**E2E** — one module per theme configuration, since a module can only apply one (see
[Implementation notes](#implementation-notes)):

| Scenario | Config | Assert |
|----------|--------|--------|
| First-run correctness — the core of #11920 | `base=dark` + a dark `backgroundColor`, light OS preference | `type` is `"dark"` with no interaction, and stays `"dark"` across a rerun (covering the handoff to the client's own value) |
| Non-hex background | `backgroundColor="black"`, light OS preference | the computed background really is `rgb(0, 0, 0)`, and `type` is `"dark"` on the first run |
| Menu appearance change — #15287 | none (presets) | Light→Dark→Light from the settings menu updates `type` with no manual rerun, and a run counter proves exactly one rerun per toggle |
| MPA deep link — the #11797 guard | `[theme]` set | entering a non-default page by direct URL still lands on that page. Belongs in `mpa_v2_custom_theme_test.py`, which already configures a theme; verify it by reintroducing #10972's name-diff rerun and checking the test fails |
| **An app that never reads `st.context.theme`** | presets | count the reruns across several menu toggles. Assert the *number*, not the absence of a correction — an absence assertion passes even when the gate is broken. This is the only test that measures the cost to the 99.4% |

Also unskip [`hostframe_app_test.py::test_st_context_theme_respects_dark_theme_message`](../../e2e_playwright/hostframe_app_test.py),
skipped since #11870. No new CI infrastructure — the hostframe suite already exists.

**External-host coverage is a separate question from that unskip**, and the split is not
uniform across these tests. `@pytest.mark.external_test` runs a test against an externally
hosted app or an embedding host page (`--external-app-url` / `--external-host-url`); per
`e2e_playwright/AGENTS.md` the marker is a manual, per-test decision.

- The config-driven tests (first-run correctness, non-hex background) are **not** candidates.
  They depend on a module-scoped `@pytest.mark.early` config fixture applied before the local
  server boots — exactly the local-harness coupling the marker excludes.
- The **host-theme** path is the strongest candidate, since it needs no `config.toml` and is
  the SiS case: `SET_CUSTOM_THEME_CONFIG` across a real iframe boundary, plus the
  `localStorage` theme cache in a third-party frame, are what a local hostframe approximates
  rather than reproduces. `hostframe_app_test.py` carries no `external_test` marker today, so
  this is a decision for the implementation PR — the unskip does not deliver it.

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
- **Fragment reruns emit a `NewSession` too**, on both sides. The backend builds and enqueues
  it unconditionally at `SCRIPT_STARTED` with `fragment_ids_this_run` set; on the client,
  `handleNewSession` runs for it but **skips the `if (!fragmentIdsThisRun.length)` branch**
  that applies the theme. That asymmetry is why §4 puts the echo recording above that branch
  — while the flag clear stays inside it. A fragment `NewSession` must **not** clear
  `themeCorrectionInFlight`. Do not expect the trigger's `NOT_RUNNING` condition to save you
  here: fragment runs do flip `scriptRunState` to `RUNNING` (the backend enters
  `APP_IS_RUNNING` and emits `session_status_changed`), but that message is enqueued *after*
  the `NewSession`, so the client can act on the echo while it still believes nothing is
  running.
- **Non-hex `backgroundColor` is deliberately supported by the frontend.** `parseColor` in
  `frontend/lib/src/theme/utils.ts` runs the value through the browser's CSS parser,
  retries with a `#` prefix, and warns only on real failure. So `"black"` is a valid,
  working config that must not be rejected — which is precisely why the echo exists.

## Alternatives considered

Approach C — pushing the theme ahead of the first rerun — is the main rejected alternative;
it is weighed with A and B in
[the design space](#the-design-space-three-approaches) rather than repeated here.

### Resolve from config alone, ignoring the client's preference

Fixes single-custom-with-`base` quickly; fails for dual light/dark sections and
preset-only Dark menu selection. **Rejected** as sole fix.

### Have the client *predict* the backend's answer instead of being told it

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

### If the product spec picks meaning A or B instead of C

That is the product spec's Options A/B/C — what `type` *means* — not the implementation
approaches above. Only §2 changes. The proto and the §3/§4 exchange are agnostic to *what* the backend
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
| Any docs changes needed? | Yes — the `context.py` docstring (§6) |
