# Streamlit theme templates

Ready-to-use theme configurations for Streamlit apps. Each file in `configs/` is
a complete `[theme]` block you can drop into any app's `.streamlit/config.toml`.

## Available themes

| Theme | Base | Primary color | Fonts |
|-------|------|---------------|-------|
| **dracula** | Dark | `#BD93F9` (purple) | Fira Sans, JetBrains Mono |
| **nord** | Dark | `#88C0D0` (frost blue) | Inter, JetBrains Mono |
| **stripe** | Light | `#635BFF` (indigo) | Inter, Source Code Pro |
| **solarized-light** | Light | `#268BD2` (blue) | Source Sans 3, Source Code Pro |
| **spotify** | Dark | `#1DB954` (green) | Inter, Fira Code |
| **github** | Light | `#0969DA` (blue) | Inter, JetBrains Mono |
| **minimal** | Dark | `#6366f1` (indigo) | Inter, JetBrains Mono |

## Apply a theme to your app

Copy the chosen config file into your app's `.streamlit/` directory:

```bash
mkdir -p .streamlit
cp path/to/themes/configs/dracula.toml .streamlit/config.toml
```

## Preview themes locally

The `streamlit_app.py` in this directory is an "Element Explorer" that renders
every major Streamlit component, so you can see how any theme looks before
committing to it:

```bash
cd path/to/themes
uv sync

# Preview a theme by copying its config and running the app
mkdir -p .streamlit
cp configs/dracula.toml .streamlit/config.toml
uv run streamlit run streamlit_app.py

# Swap to a different theme by overwriting config.toml
cp configs/nord.toml .streamlit/config.toml
```

## How Streamlit theming works

A custom theme requires two things:

### 1. Theme configuration in `.streamlit/config.toml`

```toml
[theme]
base = "dark"                         # "dark" or "light"
primaryColor = "#1DB954"              # Buttons, links, highlights
backgroundColor = "#121212"           # Main background
secondaryBackgroundColor = "#181818"  # Sidebar, cards
textColor = "#FFFFFF"                 # Main text color
font = "Inter"                        # Body font
codeFont = "FiraCode"                 # Code blocks
```

### 2. Custom fonts via Google Fonts

Load custom fonts using `[[theme.fontFaces]]` with Google Fonts URLs:

```toml
[[theme.fontFaces]]
family = "Inter"
url = "https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap"
weight = 400

[[theme.fontFaces]]
family = "Inter"
url = "https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap"
weight = 700
```

### Sidebar theming (optional)

```toml
[theme.sidebar]
backgroundColor = "#181818"
secondaryBackgroundColor = "#121212"
borderColor = "#282828"
```

## Fonts used

All themes use [Google Fonts](https://fonts.google.com/) loaded via URL in
`[[theme.fontFaces]]` entries — no local font files required.

| Font | Used by |
|------|---------|
| Inter | nord, spotify, github, minimal, stripe |
| JetBrains Mono | dracula, nord, github, minimal |
| Fira Sans | dracula |
| Fira Code | spotify |
| Source Sans 3 | solarized-light |
| Source Code Pro | solarized-light, stripe |
