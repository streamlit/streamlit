# Creating Streamlit themes

Configure themes in `.streamlit/config.toml`. When several apps share a brand, point each app's `theme.base` at one shared file (or URL) and override per app. Use CLI flags or env vars only for temporary overrides, and use CSS only when the user explicitly asks for it.

Use `streamlit config show` for the full option list and descriptions. Do not invent option names. Theme options can't be changed from the script (`st.set_option` rejects them). Set them in TOML, flags, or env vars.

- TOML edits apply on the next rerun.
- `fontFaces` additions and updates apply on the next rerun. After you remove the last `fontFaces` entry, refresh the page so old `@font-face` rules clear.
- Restart the server when you newly enable `[server] enableStaticServing` so static font routes register.

## Choose a config shape

| Goal | Use | Start from |
|------|-----|------------|
| Brand many apps the same way | Shared TOML/URL via `theme.base`, per-app overrides in each `config.toml` | Adapt a template into the shared file |
| Single locked look | `[theme]` only (`base = "light"` or `"dark"`) | `shadcn` (light) or `vscode` (dark) |
| User can toggle light/dark | `[theme]` + `[theme.light]` + `[theme.dark]` (define both for full control) | `shadcn-dual` |
| Distinct sidebar | `[theme.sidebar]` and/or `[theme.light.sidebar]` / `[theme.dark.sidebar]` — full contrast set, not only `backgroundColor` | `shadcn-dual` |
| Tighter page / sidebar spacing | `paddingTop` / `paddingBottom` (prefer over `.block-container` CSS) | `dense-dashboard` |

Relative `theme.base` paths resolve from the `streamlit run` working directory, not from `config.toml`.

**Where to put keys:** shared fonts/radii/borders/padding on `[theme]`; per-mode colors on `[theme.light]` / `[theme.dark]` (a color on `[theme]` also reaches dark unless overridden — see `shadcn-dual`); sidebar contrast on `[theme.sidebar]` or nested light/dark sidebars; chart/dataframe palettes on the section for that mode.

## Cheat sheet: common customization intents

Map common polish and brand requests to config keys. For mode and layout choices, use **Choose a config shape** above.

| Intent | Put in `config.toml` | Start from |
|--------|----------------------|------------|
| Brand accent (buttons, links) | `primaryColor`, usually also `linkColor` | Any template; retint primary |
| Page / panel surfaces | `backgroundColor`, `secondaryBackgroundColor`, `textColor`, `borderColor` | `shadcn` / `shadcn-dual` |
| Chart / dataframe brand | `chartCategoricalColors`; sequential/diverging must be exactly 10 colors; `dataframe*` | `dense-dashboard` |
| Fonts, radii, widget borders | `font` / `headingFont` / `codeFont`, `baseRadius`, `showWidgetBorder` | Most templates |

Prefer these over CSS. Full detail below; inventory via `streamlit config show`.

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

All other theme keys may be set in any of the six sections:

- Colors and semantic `*Color` / `*BackgroundColor` / `*TextColor`
- Dataframe chrome and chart palettes
- Fonts (`font`, `headingFont`, `headingFontSizes`, `headingFontWeights`, `codeFont*`, `linkUnderline`)
- Radii and `showWidgetBorder`
- `paddingTop` / `paddingBottom`

## How theme config is applied

### Source precedence (highest wins)

Source precedence follows `cli.md`: CLI flags > env vars > script, project, then global `config.toml` > defaults. Values already set in config, environment variables, or CLI flags override a `theme.base` file or URL. Keys that file leaves unset fall back to the built-in light or dark theme.

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

When `theme.base` is `"light"` / `"dark"`, Streamlit starts from that built-in theme. When `theme.base` is a **file/URL**, that file’s options are loaded first (if the file sets `base`, it must be `"light"` or `"dark"`, not another file; omitted `base` defaults to `"light"`). When `[theme.light]` or `[theme.dark]` is set, each variant starts from its matching built-in theme, and `[theme] base` is ignored for that choice. Color and other keys on `[theme]` still apply to both variants.

Then, for **main** (light mode): `[theme]` → `[theme.light]`.
For **sidebar** (light mode): resolved main → `[theme.sidebar]` → `[theme.light.sidebar]`.
Dark mode uses `[theme.dark]` / `[theme.dark.sidebar]` the same way.

Unset sidebar surfaces depend on whether the resolved main backgrounds still match the built-in light/dark pair:

- **Main backgrounds still match the built-in pair:** the sidebar uses light `#F8F8F7` / `#F1F0EE` or dark `#21201D` / `#2D2B27` (background / secondary background).
- **Either resolved main surface differs from that built-in pair:** unset sidebar background uses the main secondary background, and unset sidebar secondary uses the main background.

Set both sidebar surfaces explicitly when the sidebar should use another custom pair.

**Sidebar headings:**

- `headingFontSizes` start from the sidebar defaults unless a sidebar section sets them.
- `headingFontWeights` follow the normal merge (resolved main, then sidebar sections).
- `[theme]`-only keys are never read from nested tables.

### Appearance toggle rules

- Only `[theme]` (no light/dark sections) **locks** appearance; users cannot toggle in settings.
- `[theme.light]` and/or `[theme.dark]` enable the settings toggle; define **both** for full control of each mode.
- `[theme.sidebar]` alone (no `[theme.light]` / `[theme.dark]` keys) stays one custom theme: the Light/Dark choices go away, and the main area stays on that single theme (the light preset when `base` is unset).
- `[theme.light.sidebar]` or `[theme.dark.sidebar]` with no other light/dark keys still turns the toggle on, because nested sidebars count as light/dark section configs.

## Shared base themes across apps

Host one brand file (path or URL). Each app points `theme.base` at it and overrides as needed.

Put **cross-app brand** keys in that shared file: colors, fonts, radii, borders, chart/dataframe brand palettes, and optional light/dark brand pairs. Keep **app-specific** tweaks in each app’s `config.toml` (for example `paddingTop` / `paddingBottom`, a denser sidebar, or a one-off primary). Do not park a single app’s layout quirks in the shared brand file.

Use approved HTTPS sources for remote `theme.base` and Google Fonts URLs; self-host the theme file or fonts when external disclosure or availability matters.

**`brand-theme.toml`** — `[theme]` is the shared layer and supplies the light colors; `[theme.dark]` overrides those keys in dark mode. A key set only on `[theme]` still applies in dark mode:

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
primaryColor = "#4f46e5"
linkColor = "#a5b4fc"

[theme.dark]
primaryColor = "#4f46e5"
backgroundColor = "#0b1220"
secondaryBackgroundColor = "#111827"
textColor = "#e5e7eb"
linkColor = "#a5b4fc"
```

**App** `.streamlit/config.toml`:

```toml
[theme]
# Relative to the directory where you run `streamlit run`, not to config.toml.
base = "shared/brand-theme.toml"
# Or: base = "https://example.com/brand-theme.toml"
primaryColor = "#0969da"   # Light mode only; the file's [theme.dark] still wins in dark mode

[theme.dark]
primaryColor = "#1f6feb"   # Override dark mode separately
```

A shared file may use all valid theme sections. App config, environment variables, and CLI flags override it. For a single machine, `~/.streamlit/config.toml` also works; prefer `theme.base` when apps are deployed separately.

## Options agents often miss

Prefer these over CSS beyond the classic five (`primaryColor`, `backgroundColor`, `secondaryBackgroundColor`, `textColor`, `font`):

- Semantic `*Color` / `*BackgroundColor` / `*TextColor`
- `chartCategoricalColors`, `chartSequentialColors`, `chartDivergingColors` (see [Chart colors](#chart-colors))
- `dataframeHeaderBackgroundColor`, `dataframeHeaderTextColor`, `dataframeBorderColor`
- `baseRadius`, `buttonRadius`, `showWidgetBorder`, and `[theme]`-only `showSidebarBorder`
- Google Fonts URL syntax in `font`, `headingFont`, or `codeFont`
- Self-hosted fonts via `[[theme.fontFaces]]` and `[server] enableStaticServing = true`
- `headingFontSizes` / `headingFontWeights`, `metricValueFontSize` / `metricValueFontWeight`, `linkUnderline`
- A shared `theme.base` file/URL for multi-app brand inheritance
- Dual light/dark sections and sidebars when those shapes fit
- `paddingTop` / `paddingBottom` on main and sidebar (prefer over `.block-container` CSS)

## Color configuration

### Theme colors

```toml
[theme]
primaryColor = "#0969da"           # Buttons, links, active elements
backgroundColor = "#ffffff"        # Main content background
secondaryBackgroundColor = "#f6f8fa"  # Widget backgrounds
textColor = "#1F2328"              # Body text

linkColor = "#0969da"              # Defaults to blueTextColor
codeTextColor = "#1F2328"          # Built-in default matches body text; a custom textColor does not change it
codeBackgroundColor = "#f6f8fa"    # Unset keeps the built-in code background
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
# Pick one `font` value; the commented-out lines are alternatives.
font = "sans-serif"  # or "serif" / "monospace"
# font = "Inter:https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
# font = "'IBM Plex Sans':https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap"
```

### Self-hosting custom fonts

Place files under `static/`, enable `[server] enableStaticServing = true`, and declare `[[theme.fontFaces]]` (`family`, `url`, optional `weight` / `style` / `unicodeRange`). Restart only when you newly enable static serving so routes register. `fontFaces` additions and updates apply on the next rerun; after removing the last entry, refresh the page.

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
metricValueFontSize = "2.25rem"    # String with px/rem (or unitless = px); bare numbers are ignored. [theme]-only
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

## Content padding

Control the gap between Streamlit chrome and the first/last author widgets. Prefer these options over `st.html` / `unsafe_allow_html` CSS that targets `.block-container` or other private layout classes.

Values are quoted strings:

- `"1rem"` or `"16px"` — prefer rem so spacing scales with font size
- `"16"` — a unitless number is pixels (`"1.5"` → `1.5px`)
- `"0"`, `"0rem"`, and `"0px"` — zero is valid
- Unquoted TOML numbers (`paddingTop = 0`) are ignored
- Negatives, `%`, and other CSS units log a warning and fall back to the built-in spacing

`paddingLeft` and `paddingRight` are not recognized. Different `[theme.light]` and `[theme.dark]` values change page height when the user toggles modes.

```toml
[theme]
paddingTop = "1rem"
paddingBottom = "2rem"

[theme.sidebar]
paddingTop = "0.5rem"      # Overrides [theme]; inherits if unset
paddingBottom = "1rem"
```

**Main `paddingTop`:** Gap *below* visible header chrome. Streamlit adds header height so `"0"` is flush under the header (not the viewport top). Embed options leave the value as-is. In a bare embed with no header, a very small value can clip overlay toolbars — leave unset or use a small non-zero gap. Print uses the value alone (no header reservation).

**Sidebar `paddingTop`:** Gap before the first sidebar widget (after nav, or after header/logo when there is no page nav).

**`paddingBottom`:** Replaces the default bottom inset in main or sidebar. Does not affect sticky `st.bottom` content.

## Sidebar customization

Affects sidebar chrome and widgets only (not the main block). `showSidebarBorder` stays on `[theme]`.

```toml
[theme.sidebar]
backgroundColor = "#0f172a"
secondaryBackgroundColor = "#1e293b"
codeBackgroundColor = "#1e293b"
textColor = "#f8fafc"
borderColor = "#334155"
primaryColor = "#0284c7"
linkColor = "#38bdf8"
showWidgetBorder = true
```

Per appearance: shared `[theme.sidebar]` plus `[theme.light.sidebar]` / `[theme.dark.sidebar]`. Merge: main → `[theme.sidebar]` → nested sidebar. Unset sidebar backgrounds use Streamlit's default sidebar colors when the main backgrounds still match the built-in pair; otherwise they swap the main `secondaryBackgroundColor` / `backgroundColor` (see [Section merge order](#section-merge-order)).

When the sidebar contrast differs from main, set a full color set (`textColor`, `linkColor`, `borderColor`, secondary/code backgrounds, `primaryColor`)—not only `backgroundColor`.

## Light and dark modes

See [Choose a config shape](#choose-a-config-shape) for locked vs toggle layouts. Add `[theme.*.sidebar]` when sidebars should differ per mode.

`base` is `[theme]`-only. Dual mode uses the merge order above: each variant starts from its matching built-in theme, and `[theme]` color keys still apply to both.

**Per mode, set at least:** `backgroundColor`, `secondaryBackgroundColor`, `textColor`, `primaryColor` (contrast with white button text), `borderColor`, and chart palettes if you use charts.

**Runtime:** `st.context.theme.type` is `"light"` or `"dark"`—use for logos or third-party pieces that ignore theme tokens; keep colors/fonts in config. The value comes from the active theme's background color (CSS does not change it) and can be wrong on the first run of a session and right after a Settings appearance change, until the next rerun.

```python
logo = "logo-light.png" if st.context.theme.type == "dark" else "logo-dark.png"
st.image(logo, alt="Company logo")
```

## Design principles

- **Contrast:** WCAG AA (~4.5:1) for body text; primary color must support white button labels.
- **Harmony:** Neutral base + one brand accent, or a small semantic set (success/error) alongside primary.
- **Type:** Body 14–16px / 400; clear heading scale; monospace code slightly smaller than body.
- **Layers:** Keep `secondaryBackgroundColor` distinct from `backgroundColor`—slightly darker on a light theme, slightly lighter on a dark theme. Sidebar may match or deliberately contrast.

## Example: dual light/dark with sidebars

For a complete dual-mode config, copy `assets/templates/themes/configs/shadcn-dual.toml`: a shared `[theme]`, then `[theme.light]` and `[theme.dark]`, each with its own `.sidebar`.

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
primaryColor = "#0969da"
linkColor = "#8ecbff"
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
primaryColor = "#1f6feb"
```

Also avoid:

- A light `primaryColor` behind white button text
- Gray body text on a white background
- A `secondaryBackgroundColor` that is not distinct from `backgroundColor` (darker on a light theme, lighter on a dark theme)
- Brand colors that exist only as CLI flags or env vars
- CSS that sets `.block-container` padding instead of `paddingTop` / `paddingBottom`

## IMPORTANT: No custom CSS unless explicitly requested

Do **not** use `st.markdown(..., unsafe_allow_html=True)` or `st.html()` with `<style>` for colors, fonts, branding, or page spacing (including `.block-container` padding) unless the user explicitly asks for CSS. Use `config.toml`.

If they ask for CSS, target `key=` classes (e.g. `.st-key-submit`), never private Streamlit class names for theming.

## Development workflow

Most options hot-reload on save + rerun. `fontFaces` additions/updates apply on the next rerun; after removing the last entry, refresh. Restart when newly enabling `[server] enableStaticServing`. Verify with buttons, forms, dataframes, code, charts, sidebar, and (if dual-mode) the appearance toggle. Inspect: `streamlit config show`.

## Theme templates

Copy from `assets/templates/themes/configs/` into `.streamlit/config.toml`, or adapt into a shared brand file via `theme.base`. See `assets/templates/themes/README.md` for picker defaults; use dual mode only when the appearance toggle should stay available.

| Theme | Mode | Primary | Fonts | Notes |
|-------|------|---------|-------|-------|
| **shadcn-dual** | Light + dark | `#18181B` / `#71717A` | Inter, JetBrains Mono | Default dual-mode + sidebars |
| **dense-dashboard** | Light + dark | `#1D4ED8` / `#2563EB` | Inter, JetBrains Mono | Dual-mode + compact `paddingTop`/`paddingBottom` for KPI layouts |
| **dracula** | Dark (locked) | `#BD93F9` | Fira Sans, JetBrains Mono | |
| **financial-dashboard** | Dark (locked) | `#60A5FA` | Inter, JetBrains Mono | |
| **fluent** | Light (locked) | `#0078D4` | Segoe UI, Cascadia Code | |
| **jupyter** | Light (locked) | `#F37626` | Source Sans 3, Source Code Pro | |
| **material-ui** | Light (locked) | `#6750A4` | Roboto, Roboto Mono | |
| **minimal** | Dark (locked) | `#6366F1` | Inter, JetBrains Mono | |
| **nord** | Dark (locked) | `#88C0D0` | Inter, JetBrains Mono | |
| **one-dark-pro** | Dark (locked) | `#61AFEF` | IBM Plex Sans, JetBrains Mono | |
| **shadcn** | Light (locked) | `#18181B` | Inter, JetBrains Mono | |
| **solarized-light** | Light (locked) | `#268BD2` | Source Sans 3, Source Code Pro | |
| **ubuntu** | Light (locked) | `#E95420` | Ubuntu, Ubuntu Mono | |
| **vscode** | Dark (locked) | `#0078D4` | Segoe UI, Fira Code | |

See `assets/templates/themes/README.md`. To support the toggle with a single-mode template, split it into `[theme.light]` / `[theme.dark]` following `shadcn-dual.toml`.

## References

- `cli.md` — Precedence, CLI, environment variables
- `design.md` — Icons, badges, spacing polish
- `ccv2-theme-css-variables.md` — `--st-*` variables for CCv2
- [Theming overview](https://docs.streamlit.io/develop/concepts/configuration/theming)
- [Colors and borders](https://docs.streamlit.io/develop/concepts/configuration/theming-customize-colors-and-borders)
- [Fonts](https://docs.streamlit.io/develop/concepts/configuration/theming-customize-fonts)
- [config.toml reference](https://docs.streamlit.io/develop/api-reference/configuration/config.toml)
- [st.context](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.context)
