# Creating Streamlit themes

Build brand-aligned themes with `.streamlit/config.toml`. Prefer config (and optional shared `theme.base` files) over CLI/env for persistent branding, and over CSS unless the user explicitly asks for CSS.

Use `streamlit config show` for the full option list and descriptions. Do not invent option names.

Theme options can't be changed from the script (`st.set_option` rejects them). Set them in TOML, flags, or env vars. TOML edits apply on the next rerun, except `fontFaces`, which needs a restart.

## Choose a config shape

| Goal | Use |
|------|-----|
| Single locked look | `[theme]` only (`base = "light"` or `"dark"`) |
| User can toggle light/dark | `[theme]` + `[theme.light]` + `[theme.dark]` (define both for full control) |
| Brand many apps the same way | Shared TOML/URL via `theme.base`, per-app overrides in each `config.toml` |
| Distinct sidebar | `[theme.sidebar]` and/or `[theme.light.sidebar]` / `[theme.dark.sidebar]` |

## Contents

- [Valid theme sections](#valid-theme-sections)
- [How theme config is applied](#how-theme-config-is-applied)
- [Shared base themes across apps](#shared-base-themes-across-apps)
- [Options agents often miss](#options-agents-often-miss)
- [Color configuration](#color-configuration)
- [Typography](#typography)
- [Border and radius](#border-and-radius)
- [Sidebar customization](#sidebar-customization)
- [Light and dark modes](#light-and-dark-modes)
- [Design principles](#design-principles)
- [Example: dual light/dark with sidebars](#example-dual-lightdark-with-sidebars)
- [Common mistakes](#common-mistakes)
- [IMPORTANT: No custom CSS unless explicitly requested](#important-no-custom-css-unless-explicitly-requested)
- [Development workflow](#development-workflow)
- [Theme templates](#theme-templates)
- [References](#references)

## Valid theme sections

| Section | Role |
|---------|------|
| `[theme]` | Root custom theme; shared defaults |
| `[theme.sidebar]` | Sidebar overrides on the active main theme |
| `[theme.light]` / `[theme.dark]` | Main-area overrides for that appearance |
| `[theme.light.sidebar]` / `[theme.dark.sidebar]` | Sidebar overrides for that appearance |

**Invalid:** `[theme.sidebar.light]` (light/dark must come before `.sidebar`).

### `[theme]`-only options

Do not put these under light/dark/sidebar: `base`, `fontFaces` (`[[theme.fontFaces]]`), `baseFontSize`, `baseFontWeight`, `metricValueFontSize`, `metricValueFontWeight`, `showSidebarBorder`.

### Options allowed in all six sections

Most other theme keys may be set in any of the six sections:

- Colors and semantic `*Color` / `*BackgroundColor` / `*TextColor`
- Dataframe chrome and chart palettes
- Fonts (`font`, `headingFont`, `headingFontSizes`, `headingFontWeights`, `codeFont*`, `linkUnderline`)
- Radii and `showWidgetBorder`

## How theme config is applied

### Source precedence (highest wins)

1. CLI flags — `--theme.primaryColor="#0969da"`
2. Environment variables — `STREAMLIT_THEME_PRIMARY_COLOR`
3. Script-level `.streamlit/config.toml` (next to the main script)
4. Project-level `$CWD/.streamlit/config.toml`
5. Global `~/.streamlit/config.toml`
6. Built-in defaults

Values already set in config, environment variables, or CLI flags override a `theme.base` file or URL. Keys the file leaves unset still use the built-in light or dark theme. General precedence is in `cli.md`.

### CLI and env naming

Prefix `STREAMLIT_`, replace dots with underscores, convert camelCase to SNAKE_CASE, then uppercase:

| Config key | CLI | Env |
|------------|-----|-----|
| `theme.primaryColor` | `--theme.primaryColor=…` | `STREAMLIT_THEME_PRIMARY_COLOR` |
| `theme.base` | `--theme.base=./brand.toml` | `STREAMLIT_THEME_BASE` |
| `theme.sidebar.backgroundColor` | `--theme.sidebar.backgroundColor=…` | `STREAMLIT_THEME_SIDEBAR_BACKGROUND_COLOR` |
| `theme.light.primaryColor` | `--theme.light.primaryColor=…` | `STREAMLIT_THEME_LIGHT_PRIMARY_COLOR` |
| `theme.dark.sidebar.textColor` | `--theme.dark.sidebar.textColor=…` | `STREAMLIT_THEME_DARK_SIDEBAR_TEXT_COLOR` |

Prefer TOML for arrays (chart palettes, heading sizes). Use flags/env for temporary overrides only.

### Section merge order

When `theme.base` is `"light"` / `"dark"`, Streamlit starts from that built-in theme. When `theme.base` is a **file/URL**, that file’s options are loaded first (if the file sets `base`, it must be `"light"` or `"dark"`, not another file; omitted `base` defaults to `"light"`).

When `[theme.light]` or `[theme.dark]` is set, each variant starts from its matching built-in theme, and `[theme] base` is ignored for that choice. Color and other keys on `[theme]` still apply to both variants.

Then, for **main** (light mode): `[theme]` → `[theme.light]`.
For **sidebar** (light mode): resolved main → `[theme.sidebar]` → `[theme.light.sidebar]`.
Dark mode uses `[theme.dark]` / `[theme.dark.sidebar]` the same way.

Unset sidebar `backgroundColor` falls back to the resolved main `secondaryBackgroundColor`, and unset sidebar `secondaryBackgroundColor` falls back to the main `backgroundColor` (they swap). Leave both unset to keep that swap. Set both explicitly only when the sidebar should use the main pairing or another custom pair.

**Sidebar headings:** `headingFontSizes` start from the sidebar defaults unless a sidebar section sets them. `headingFontWeights` follow the normal merge (resolved main, then sidebar sections). `[theme]`-only keys are never read from nested tables.

### Appearance toggle rules

- Only `[theme]` (no light/dark sections) **locks** appearance; users cannot toggle in settings.
- `[theme.light]` and/or `[theme.dark]` enable the settings toggle; define **both** for full control of each mode.
- `[theme.sidebar]` alone (no `[theme.light]` / `[theme.dark]` keys) stays one custom theme: the Light/Dark choices go away, and the main area stays on that single theme (the light preset when `base` is unset).
- `[theme.light.sidebar]` or `[theme.dark.sidebar]` with no other light/dark keys still turns the toggle on, because nested sidebars count as light/dark section configs.

## Shared base themes across apps

Host one brand file (path or URL). Each app points `theme.base` at it and overrides as needed.

Use approved HTTPS sources for remote `theme.base` and Google Fonts URLs; self-host the theme file or fonts when external disclosure or availability matters.

**`brand-theme.toml`** — root `[theme]` holds the light look; `[theme.dark]` overrides it for dark mode:

```toml
[theme]
base = "light"
primaryColor = "#635bff"
backgroundColor = "#ffffff"
secondaryBackgroundColor = "#f6f8fa"
textColor = "#425466"
font = "Inter:https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"

[theme.sidebar]
backgroundColor = "#0f172a"
secondaryBackgroundColor = "#1e293b"
codeBackgroundColor = "#1e293b"
textColor = "#f8fafc"
borderColor = "#334155"
primaryColor = "#a5b4fc"
linkColor = "#c7d2fe"

[theme.dark]
primaryColor = "#a5b4fc"
backgroundColor = "#0b1220"
secondaryBackgroundColor = "#111827"
textColor = "#e5e7eb"
```

**App** `.streamlit/config.toml`:

```toml
[theme]
# Relative to the directory where you run `streamlit run`, not to config.toml.
base = "shared/brand-theme.toml"
# Or: base = "https://example.com/brand-theme.toml"
primaryColor = "#0969da"   # app-only override
```

Shared-file rules: may include all valid theme sections; if it sets `base`, that value must be `"light"` or `"dark"` (no file chains; omitted `base` defaults to light); app/env/CLI override the file. For a single machine only, `~/.streamlit/config.toml` also works; prefer `theme.base` when apps are deployed separately.

## Options agents often miss

Prefer these over CSS beyond the classic five (`primaryColor`, `backgroundColor`, `secondaryBackgroundColor`, `textColor`, `font`):

- Semantic `*Color` / `*BackgroundColor` / `*TextColor`
- `chartCategoricalColors` (any non-empty length; Plotly, Altair, Vega-Lite, and ECharts), `chartSequentialColors` (exactly 10; same libraries), and `chartDivergingColors` (exactly 10; Plotly, Altair, Vega-Lite — not ECharts)
- `dataframeHeaderBackgroundColor`, `dataframeHeaderTextColor`, `dataframeBorderColor`
- `baseRadius`, `buttonRadius`, `showWidgetBorder`, `showSidebarBorder`
- Google Fonts URL syntax; `[[theme.fontFaces]]` + `[server] enableStaticServing = true`
- `headingFontSizes` / `headingFontWeights`, `metricValueFontSize` / `metricValueFontWeight`, `linkUnderline`
- Dual light/dark, sidebars, shared `theme.base`

## Color configuration

### Theme colors

```toml
[theme]
primaryColor = "#0969da"           # Buttons, links, active elements
backgroundColor = "#ffffff"        # Main content background
secondaryBackgroundColor = "#f6f8fa"  # Widget backgrounds, code blocks
textColor = "#1F2328"              # Body text

linkColor = "#0969da"              # Defaults to blueTextColor
codeTextColor = "#116329"          # Defaults to greenTextColor
codeBackgroundColor = "#f6f8fa"
borderColor = "#d0d7de"
```

Choose a `primaryColor` dark enough for white primary-button text.

### Color palette

```toml
[theme]
redColor = "#cf222e"
orangeColor = "#bf8700"
yellowColor = "#dbab09"
greenColor = "#1a7f37"
blueColor = "#0969da"
violetColor = "#8250df"
grayColor = "#57606a"
# Optional overrides (auto-derived if unset):
greenBackgroundColor = "#dafbe1"
greenTextColor = "#116329"
```

### Chart colors

Set chart colors in any of the six sections. An unset main section inherits `[theme]`; an unset sidebar inherits the resolved main palette for that appearance (so a palette on `[theme.dark]` appears in an unset dark sidebar). Categorical and sequential palettes apply to Plotly, Altair, Vega-Lite, and ECharts. Diverging palettes apply to Plotly, Altair, and Vega-Lite (ECharts does not read `chartDivergingColors`). Sequential and diverging lists must be exactly 10 colors.

```toml
[theme]
chartCategoricalColors = ["#0969da", "#1a7f37", "#bf3989", "#8250df", "#cf222e", "#bf8700", "#57606a"]
chartSequentialColors = ["#f0f6fc", "#c8e1ff", "#79c0ff", "#58a6ff", "#388bfd", "#1f6feb", "#1158c7", "#0d419d", "#0a3069", "#04244a"]  # exactly 10
chartDivergingColors = ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061"]  # exactly 10; not used by ECharts

[theme.dark]
chartCategoricalColors = ["#58a6ff", "#3fb950", "#db61a2", "#a371f7", "#f85149", "#d29922", "#8b949e"]
```

### Dataframe styling

```toml
[theme]
dataframeBorderColor = "#d0d7de"
dataframeHeaderBackgroundColor = "#1f2937"
dataframeHeaderTextColor = "#ffffff"
```

If unset, header text/icons use a faded `textColor`. Selected-column header text stays white even when `dataframeHeaderTextColor` is set.

## Typography

### Font families

```toml
[theme]
font = "sans-serif"  # or "serif" / "monospace"
font = "Inter:https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
font = "'IBM Plex Sans':https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap"
```

### Self-hosting custom fonts

Place files under `static/`, enable `[server] enableStaticServing = true`, and declare `[[theme.fontFaces]]` (`family`, `url`, optional `weight` / `style` / `unicodeRange`). Restart required after `fontFaces` changes.

```toml
[[theme.fontFaces]]
family = "CustomFont"
url = "app/static/CustomFont-Regular.woff2"
weight = 400

[theme]
font = "CustomFont"
```

### Heading, code, and metric type

```toml
[theme]
headingFont = "Inter:https://fonts.googleapis.com/css2?family=Inter:wght@600;700&display=swap"
codeFont = "'JetBrains Mono':https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
baseFontSize = 14                  # px; default 16 ([theme]-only)
baseFontWeight = 400               # [theme]-only
codeFontSize = "0.875rem"
codeFontWeight = 400
headingFontSizes = ["32px", "24px", "20px", "16px", "14px", "12px"]
headingFontWeights = [600, 600, 600, 500, 500, 500]
metricValueFontSize = "2.25rem"    # string with px/rem (unitless string = px); [theme]-only
metricValueFontWeight = 700        # unset → inherit from parent; [theme]-only
linkUnderline = false
```

## Border and radius

```toml
[theme]
baseRadius = "8px"                 # none/small/medium/large/full or px/rem
buttonRadius = "8px"               # defaults to baseRadius
showWidgetBorder = true
showSidebarBorder = true           # [theme]-only
```

Radius keywords: `"none"`, `"small"` (0.35rem), `"medium"` (0.5rem), `"large"` (1rem), `"full"` (1.4rem).

## Sidebar customization

Affects sidebar chrome and widgets only (not the main block). `showSidebarBorder` stays on `[theme]`.

```toml
[theme.sidebar]
backgroundColor = "#0f172a"
secondaryBackgroundColor = "#1e293b"
codeBackgroundColor = "#1e293b"
textColor = "#f8fafc"
borderColor = "#334155"
primaryColor = "#38bdf8"
linkColor = "#7dd3fc"
showWidgetBorder = true
```

Per appearance: shared `[theme.sidebar]` plus `[theme.light.sidebar]` / `[theme.dark.sidebar]`. Merge: main → `[theme.sidebar]` → nested sidebar. Unset sidebar backgrounds swap main `secondaryBackgroundColor` / `backgroundColor` (see [Section merge order](#section-merge-order)).

When the sidebar contrast differs from main, set a full color set (`textColor`, `linkColor`, `borderColor`, secondary/code backgrounds, `primaryColor`)—not only `backgroundColor`.

## Light and dark modes

| Goal | Config |
|------|--------|
| Locked single look | `[theme]` only |
| Toggle + control both | `[theme]` + `[theme.light]` + `[theme.dark]` |
| Tweak one mode | `[theme]` + only `[theme.dark]` (or only light) |
| Sidebars per mode | Add `[theme.*.sidebar]` |

`base` is `[theme]`-only. In dual mode, each variant starts from its matching built-in theme (`[theme] base` does not pick the built-in for light vs dark); `[theme]` color keys still apply to both.

**Per mode, set at least:** `backgroundColor`, `secondaryBackgroundColor`, `textColor`, `primaryColor` (contrast with white button text), `borderColor`, and chart palettes if you use charts.

**Runtime:** `st.context.theme.type` is `"light"` or `"dark"`—use for logos or third-party pieces that ignore theme tokens; keep colors/fonts in config. The value is inferred from the painted background and can be wrong on the first run of a session and immediately after a Settings appearance change until the next rerun.

```python
if st.context.theme.type == "dark":
    ...
```

## Design principles

- **Contrast:** WCAG AA (~4.5:1) for body text; primary color must support white button labels.
- **Harmony:** Neutral base + one brand accent, or a small semantic set (success/error) alongside primary.
- **Type:** Body 14–16px / 400; clear heading scale; monospace code slightly smaller than body.
- **Layers:** Keep `secondaryBackgroundColor` distinct from `backgroundColor`—slightly darker on a light theme, slightly lighter on a dark theme. Sidebar may match or deliberately contrast.

## Example: dual light/dark with sidebars

```toml
[theme]
font = "Inter:https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
codeFont = "'JetBrains Mono':https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
baseRadius = "0.5rem"
buttonRadius = "0.5rem"
showWidgetBorder = true
showSidebarBorder = true
linkUnderline = false

[theme.light]
primaryColor = "#0969da"
backgroundColor = "#ffffff"
secondaryBackgroundColor = "#f6f8fa"
textColor = "#1F2328"
borderColor = "#d0d7de"
codeBackgroundColor = "#f6f8fa"
chartCategoricalColors = ["#0969da", "#1a7f37", "#bf3989", "#8250df", "#cf222e", "#bf8700", "#57606a"]

[theme.dark]
primaryColor = "#58a6ff"
backgroundColor = "#0d1117"
secondaryBackgroundColor = "#161b22"
textColor = "#e6edf3"
borderColor = "#30363d"
codeBackgroundColor = "#161b22"
chartCategoricalColors = ["#58a6ff", "#3fb950", "#db61a2", "#a371f7", "#f85149", "#d29922", "#8b949e"]

[theme.light.sidebar]
backgroundColor = "#f6f8fa"
secondaryBackgroundColor = "#eaeef2"
textColor = "#1F2328"
borderColor = "#d0d7de"
primaryColor = "#0969da"

[theme.dark.sidebar]
backgroundColor = "#010409"
secondaryBackgroundColor = "#161b22"
textColor = "#e6edf3"
borderColor = "#30363d"
primaryColor = "#58a6ff"
```

For a single locked dark theme, see the **vscode** template under `assets/templates/themes/configs/`.

## Common mistakes

Wrong nest order:

```toml
# BAD
[theme.sidebar.light]

# GOOD
[theme.light.sidebar]
```

`[theme]`-only keys under light/dark:

```toml
# BAD
[theme.dark]
base = "dark"

# GOOD
[theme]
base = "dark"
```

Chaining base files inside a brand theme:

```toml
# BAD in brand-theme.toml
base = "./other.toml"

# GOOD in brand-theme.toml
base = "light"
```

Incomplete dark sidebar on a light main:

```toml
# BAD: only sidebar background
[theme.sidebar]
backgroundColor = "#11567F"

# GOOD: full contrast set
[theme.sidebar]
backgroundColor = "#11567F"
secondaryBackgroundColor = "#174D6A"
textColor = "#ffffff"
borderColor = "#1E6D94"
primaryColor = "#79c0ff"
```

Locked look vs settings toggle:

```toml
# Valid when you want one locked appearance (include base for dark):
[theme]
base = "dark"
primaryColor = "#0969da"
```

```toml
# Use light/dark sections when the settings toggle should stay available:
[theme.light]
primaryColor = "#0969da"
[theme.dark]
primaryColor = "#58a6ff"
```

Also avoid: light primary on white button text; gray-on-white body text; secondary that is not distinct from main (wrong direction for light or dark); branding only via CLI/env.

## IMPORTANT: No custom CSS unless explicitly requested

Do **not** use `st.markdown(..., unsafe_allow_html=True)` or `st.html()` with `<style>` for colors, fonts, or branding unless the user explicitly asks for CSS. Use `config.toml`.

If they ask for CSS, target `key=` classes (e.g. `.st-key-submit`), never private Streamlit class names for theming.

## Development workflow

Most options hot-reload on save + rerun; `fontFaces` need a server restart. Verify with buttons, forms, dataframes, code, charts, sidebar, and (if dual-mode) the settings appearance toggle. Inspect effective config: `streamlit config show`.

## Theme templates

Copy from `assets/templates/themes/configs/` into the app’s `.streamlit/config.toml`:

| Theme | Base | Primary | Fonts |
|-------|------|---------|-------|
| **dracula** | Dark | `#BD93F9` | Fira Sans, JetBrains Mono |
| **financial-dashboard** | Dark | `#60A5FA` | Inter, JetBrains Mono |
| **fluent** | Light | `#0078D4` | Segoe UI, Cascadia Code |
| **jupyter** | Light | `#F37626` | Source Sans 3, Source Code Pro |
| **material-ui** | Light | `#6750A4` | Roboto, Roboto Mono |
| **minimal** | Dark | `#6366F1` | Inter, JetBrains Mono |
| **nord** | Dark | `#88C0D0` | Inter, JetBrains Mono |
| **one-dark-pro** | Dark | `#61AFEF` | IBM Plex Sans, JetBrains Mono |
| **shadcn** | Light | `#18181B` | Inter, JetBrains Mono |
| **solarized-light** | Light | `#268BD2` | Source Sans 3, Source Code Pro |
| **ubuntu** | Light | `#E95420` | Ubuntu, Ubuntu Mono |
| **vscode** | Dark | `#0078D4` | Segoe UI, Fira Code |

See `assets/templates/themes/README.md`. Most templates are single-mode; adapt into light/dark (+ sidebars) using the dual-mode example above when the app should toggle.

## References

- `cli.md` — Precedence, CLI, environment variables
- `design.md` — Icons, badges, spacing polish
- `ccv2-theme-css-variables.md` — `--st-*` variables for CCv2
- [Theming overview](https://docs.streamlit.io/develop/concepts/configuration/theming)
- [Colors and borders](https://docs.streamlit.io/develop/concepts/configuration/theming-customize-colors-and-borders)
- [Fonts](https://docs.streamlit.io/develop/concepts/configuration/theming-customize-fonts)
- [config.toml reference](https://docs.streamlit.io/develop/api-reference/configuration/config.toml)
- [st.context](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.context)
