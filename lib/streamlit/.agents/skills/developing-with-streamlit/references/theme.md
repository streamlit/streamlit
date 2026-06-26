
# Creating Streamlit themes

Build professional, brand-aligned themes using `.streamlit/config.toml`. This skill covers design principles and complete configuration for polished, cohesive themes.

## Theme file setup

Theme options go in Streamlit's `config.toml` under the `[theme]` section:

## Theme inheritance

Start from a built-in theme or external file:

```toml
[theme]
base = "light"                         # or "dark"
# base = "./my-base-theme.toml"        # Local file
# base = "https://example.com/theme.toml"  # Remote URL
```

When using `base`, you only need to override the values you want to change. Theme files referenced via `base` can only contain a single `[theme]` section—`[theme.light]` and `[theme.dark]` variants are not supported in external theme files.

## Color configuration

### Theme colors

```toml
[theme]
primaryColor = "#0969da"           # Buttons, links, active elements
backgroundColor = "#ffffff"        # Main content background
secondaryBackgroundColor = "#f6f8fa"  # Widget backgrounds, code blocks
textColor = "#1F2328"              # Body text

# Optional refinements
linkColor = "#0969da"              # Markdown links (defaults to primaryColor)
codeTextColor = "#1F2328"          # Inline code text
codeBackgroundColor = "#f6f8fa"    # Code block background
borderColor = "#d0d7de"            # Widget borders
```

**Design principle:** Choose a `primaryColor` dark enough to contrast with white text. Streamlit renders the text of primary buttons white against the primary color.

### Color palette

Define semantic colors for status indicators, markdown text coloring, and sparklines:

```toml
[theme]
redColor = "#cf222e"
orangeColor = "#bf8700"
yellowColor = "#dbab09"
greenColor = "#1a7f37"
blueColor = "#0969da"
violetColor = "#8250df"
grayColor = "#57606a"
```

Each color supports background and text variants (auto-derived if not set):

```toml
[theme]
greenColor = "#1a7f37"
greenBackgroundColor = "#dafbe1"   # Light tint for badges
greenTextColor = "#116329"         # Darkened for readability
```

### Chart colors

Define colors for Plotly, Altair, and Vega-Lite charts:

```toml
[theme]
# Categorical data (bars, pie slices, series)
chartCategoricalColors = ["#0969da", "#1a7f37", "#bf3989", "#8250df", "#cf222e", "#bf8700", "#57606a"]

# Sequential/gradient data (heatmaps) - exactly 10 colors required
chartSequentialColors = ["#f0f6fc", "#c8e1ff", "#79c0ff", "#58a6ff", "#388bfd", "#1f6feb", "#1158c7", "#0d419d", "#0a3069", "#04244a"]
```

### Dataframe styling

```toml
[theme]
dataframeBorderColor = "#d0d7de"
dataframeHeaderBackgroundColor = "#f6f8fa"
```

Ensure `textColor` is readable against `dataframeHeaderBackgroundColor`—headers use the main text color.

## Typography

### Font families

Use built-in fonts, load from Google Fonts, or define custom fonts from font files (see below):

```toml
[theme]
# Built-in options
font = "sans-serif"  # or "serif" or "monospace"

# Google Fonts
font = "Inter:https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"

# Font with spaces in name
font = "'IBM Plex Sans':https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap"
```

### Self-hosting custom fonts

Use `[[theme.fontFaces]]` tables to load fonts via Streamlit's static file serving. Font files must be placed in a `static/` directory and served through the app—they cannot be arbitrary local file paths.

**Before adding fonts to config.toml:** Verify the font files exist in the static directory.

```toml
[[theme.fontFaces]]
family = "CustomFont"
url = "app/static/CustomFont-Regular.woff2"
weight = 400

[[theme.fontFaces]]
family = "CustomFont"
url = "app/static/CustomFont-Bold.woff2"
weight = 700

[theme]
font = "CustomFont"
```

**Attributes:** `family` (name), `url` (path to OTF/TTF/WOFF/WOFF2), `weight` (400, "200 800", or "bold"), `style` ("normal"/"italic"/"oblique"), `unicodeRange` (e.g., "U+0000-00FF").

Changes to `fontFaces` require a server restart.

### Heading and code fonts

```toml
[theme]
headingFont = "Inter:https://fonts.googleapis.com/css2?family=Inter:wght@600;700&display=swap"
codeFont = "'JetBrains Mono':https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
```

### Font sizing and weight

```toml
[theme]
baseFontSize = 14                  # Root size in pixels (default: 16)
baseFontWeight = 400               # Normal weight
codeFontSize = "0.875rem"          # Relative to base, or use "13px"
codeFontWeight = 400

# Heading hierarchy (h1 through h6), or use a single value for all
headingFontSizes = ["32px", "24px", "20px", "16px", "14px", "12px"]
headingFontWeights = [600, 600, 600, 500, 500, 500]
```

### Link styling

```toml
[theme]
linkUnderline = false              # Remove underlines for cleaner look
```

## Border and radius

```toml
[theme]
baseRadius = "8px"                 # All components (none/small/medium/large/full/px/rem)
buttonRadius = "8px"               # Buttons specifically (defaults to baseRadius)
showWidgetBorder = true            # Show borders on unfocused widgets
showSidebarBorder = true           # Show divider between sidebar and content
```

**Radius keywords:** `"none"` (0), `"small"` (4px), `"medium"` (8px), `"large"` (12px), `"full"` (pill shape).

## Sidebar customization

Style the sidebar independently:

```toml
[theme.sidebar]
backgroundColor = "#f6f8fa"
secondaryBackgroundColor = "#eaeef2"
codeBackgroundColor = "#eaeef2"
textColor = "#1F2328"
borderColor = "#d0d7de"
primaryColor = "#0969da"           # Active elements in sidebar
```

## Light and dark modes

Define separate themes for each mode:

```toml
[theme.light]
primaryColor = "#0969da"
backgroundColor = "#ffffff"
secondaryBackgroundColor = "#f6f8fa"
textColor = "#1F2328"

[theme.dark]
primaryColor = "#58a6ff"
backgroundColor = "#0d1117"
secondaryBackgroundColor = "#161b22"
textColor = "#e6edf3"

[theme.light.sidebar]
backgroundColor = "#f6f8fa"

[theme.dark.sidebar]
backgroundColor = "#010409"
```

Users can switch between modes in the app settings menu only if both `[theme.light]` and `[theme.dark]` are defined. A custom theme with just `[theme]` locks the app to a single mode.

## Detecting current theme

Use `st.context.theme.type` to adapt your app to the active theme. Useful for:

- Adjusting specific chart colors for better contrast
- Swapping logos or images (e.g., dark logo on light, light logo on dark)
- Styling third-party components that don't auto-adapt
- Applying conditional CSS or custom styling

```python
if st.context.theme.type == "dark":
    # Do something for dark mode
```

## Design principles

### Color contrast

Ensure WCAG AA compliance (4.5:1 ratio for text):
- Light themes: Dark text (#1F2328) on light backgrounds (#ffffff)
- Dark themes: Light text (#e6edf3) on dark backgrounds (#0d1117)
- Primary colors must contrast with white button text

### Color harmony

Build cohesive palettes using these approaches:

**Monochromatic:** Single hue with varying lightness (e.g., shadcn's zinc grays)
```toml
primaryColor = "#18181B"
textColor = "#09090B"
borderColor = "#E4E4E7"
grayColor = "#71717A"
```

**Brand accent:** Neutral base with one brand color (e.g., a signature indigo)
```toml
primaryColor = "#635bff"           # Brand purple
backgroundColor = "#ffffff"
textColor = "#425466"              # Neutral gray
```

**Complementary:** Brand primary with supporting accent colors
```toml
primaryColor = "#0969DA"           # Brand blue
textColor = "#1F2328"              # Near-black for text
greenColor = "#36B37E"             # Success states
redColor = "#DE350B"               # Error states
```

### Typography guidelines

- **Body text:** 14-16px, weight 400
- **Headings:** Decreasing scale from h1 (28-40px) to h6 (12-14px)
- **Code:** Monospace font, slightly smaller than body (0.85-0.875rem)
- **Font pairing:** Use the same font for body and headings for consistency, or pair complementary fonts (e.g., serif headings with sans-serif body). Code should always use a distinct monospace font.

### Visual hierarchy

Create depth with background layers:
```
Main content:        #ffffff (lightest)
Secondary elements:  #f6f8fa (slightly darker)
Sidebar:             #f6f8fa or contrasting brand color
Code blocks:         #f6f8fa (matches secondary or distinct)
```

## Example: VS Code dark theme

Developer-focused dark theme with syntax-inspired colors:

```toml
[theme]
base = "dark"
primaryColor = "#0078d4"
backgroundColor = "#1e1e1e"
secondaryBackgroundColor = "#252526"
codeBackgroundColor = "#1e1e1e"
textColor = "#cccccc"
linkColor = "#3794ff"
borderColor = "#3c3c3c"
showWidgetBorder = true
showSidebarBorder = true
baseRadius = "4px"
buttonRadius = "4px"

font = "'Segoe UI', 'Open Sans':https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap"
codeFont = "'Fira Code':https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap"
codeFontSize = "13px"
codeTextColor = "#d4d4d4"
baseFontSize = 14
baseFontWeight = 400
headingFontSizes = ["28px", "22px", "18px", "16px", "14px", "12px"]
headingFontWeights = [600, 600, 600, 600, 600, 600]
linkUnderline = false

chartCategoricalColors = ["#0078d4", "#4ec9b0", "#dcdcaa", "#ce9178", "#c586c0", "#569cd6", "#6a9955"]

blueColor = "#569cd6"
greenColor = "#6a9955"
yellowColor = "#dcdcaa"
orangeColor = "#ce9178"
violetColor = "#c586c0"

[theme.sidebar]
backgroundColor = "#252526"
secondaryBackgroundColor = "#333333"
codeBackgroundColor = "#1e1e1e"
borderColor = "#3c3c3c"
```

## Common mistakes

### Primary color too light

```toml
# BAD: White text on yellow is unreadable
primaryColor = "#FFEB3B"

# GOOD: Use a darker shade
primaryColor = "#F59E0B"
```

### Insufficient contrast

```toml
# BAD: Light gray text on white
textColor = "#CCCCCC"
backgroundColor = "#FFFFFF"

# GOOD: Dark text on light background
textColor = "#1F2328"
backgroundColor = "#FFFFFF"
```

### Mismatched backgrounds

```toml
# BAD: Secondary lighter than primary
backgroundColor = "#f6f8fa"
secondaryBackgroundColor = "#ffffff"

# GOOD: Secondary should be darker/distinct
backgroundColor = "#ffffff"
secondaryBackgroundColor = "#f6f8fa"
```

### Forgetting sidebar contrast

When using a dark sidebar with a light main section, adjust all sidebar colors—not just `textColor`:

```toml
# BAD: Only changed backgroundColor
[theme.sidebar]
backgroundColor = "#11567F"

# GOOD: Adjust all colors for dark sidebar
[theme.sidebar]
backgroundColor = "#11567F"
secondaryBackgroundColor = "#174D6A"
textColor = "#ffffff"
borderColor = "#1E6D94"
...
```

## IMPORTANT: No custom CSS unless explicitly requested

**DO NOT use custom CSS or HTML for theming.** This includes:
- `st.markdown(..., unsafe_allow_html=True)` with `<style>` or inline styles
- `st.html()` with `<style>` blocks
- Any HTML/CSS for colors, backgrounds, fonts, or visual styling

**Only use CSS if the user explicitly asks for it** (e.g., "add custom CSS", "use st.html for styling"). For brand colors, theming, and visual identity—always use `config.toml`.

Native theming is cleaner, more maintainable, and won't break with Streamlit updates.

If the user explicitly asks for CSS, use `key=` to create targetable classes:

```python
st.button("Submit", key="submit")
# Generates: .st-key-submit

st.html("""<style>.st-key-submit button { width: 100%; }</style>""")
```

**Never use CSS for theming (colors, backgrounds, fonts) unless explicitly asked. Use config.toml instead.**

## Development workflow

Most theme options update live after saving `config.toml` and rerunning. Font-related options (`fontFaces`) require a server restart.

Test your theme with: buttons (primary contrast), forms (borders, focus), dataframes (headers), code blocks, charts, and sidebar.

## Theme templates

Ready-to-use theme configs (Google Fonts, no local font files) are available in
`assets/templates/themes/configs/`. Copy one to `.streamlit/config.toml` in your
app:

| Theme | Base | Primary Color | Fonts |
|-------|------|---------------|-------|
| **dracula** | Dark | `#BD93F9` (purple) | Fira Sans, JetBrains Mono |
| **financial-dashboard** | Dark | `#60A5FA` (blue) | Inter, JetBrains Mono |
| **fluent** | Light | `#0078D4` (blue) | Segoe UI, Cascadia Code |
| **jupyter** | Light | `#F37626` (orange) | Source Sans 3, Source Code Pro |
| **material-ui** | Light | `#6750A4` (violet) | Roboto, Roboto Mono |
| **minimal** | Dark | `#6366F1` (indigo) | Inter, JetBrains Mono |
| **nord** | Dark | `#88C0D0` (frost blue) | Inter, JetBrains Mono |
| **one-dark-pro** | Dark | `#61AFEF` (blue) | IBM Plex Sans, JetBrains Mono |
| **shadcn** | Light | `#18181B` (zinc) | Inter, JetBrains Mono |
| **solarized-light** | Light | `#268BD2` (blue) | Source Sans 3, Source Code Pro |
| **ubuntu** | Light | `#E95420` (orange) | Ubuntu, Ubuntu Mono |
| **vscode** | Dark | `#0078D4` (blue) | Segoe UI, Fira Code |

See `assets/templates/themes/README.md`.

## References

- `design.md` — Visual polish with icons, badges, spacing
- [Theming overview](https://docs.streamlit.io/develop/concepts/configuration/theming)
- [Colors and borders](https://docs.streamlit.io/develop/concepts/configuration/theming-customize-colors-and-borders)
- [Fonts](https://docs.streamlit.io/develop/concepts/configuration/theming-customize-fonts)
- [config.toml reference](https://docs.streamlit.io/develop/api-reference/configuration/config.toml)
- [st.context](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.context)
