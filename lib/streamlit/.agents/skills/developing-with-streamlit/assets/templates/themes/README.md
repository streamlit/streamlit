# Streamlit theme templates

Ready-to-use theme templates for Streamlit apps.

## Available themes

| Theme | Base | Primary color | Fonts |
|-------|------|---------------|-------|
| **snowflake** | Light | `#29B5E8` (cyan) | Inter, JetBrains Mono |
| **dracula** | Dark | `#BD93F9` (purple) | Fira Sans, JetBrains Mono |
| **nord** | Dark | `#88C0D0` (frost blue) | Inter, JetBrains Mono |
| **stripe** | Light | `#635BFF` (indigo) | Inter, Source Code Pro |
| **solarized-light** | Light | `#268BD2` (blue) | Source Sans 3, Source Code Pro |
| **spotify** | Dark | `#1DB954` (green) | Inter, Fira Code |
| **github** | Light | `#0969DA` (blue) | Inter, JetBrains Mono |
| **minimal** | Dark | `#6366f1` (indigo) | Inter, JetBrains Mono |

## Quick start

```bash
# Run a theme locally
cd assets/templates/themes/spotify
uv sync
uv run streamlit run streamlit_app.py
```

## Deploying to Snowflake

Before deploying, update `snowflake.yml` with your account-specific resources:

```yaml
# Find available compute pools
SHOW COMPUTE POOLS;

# Find available external access integrations
SHOW EXTERNAL ACCESS INTEGRATIONS;
```

Then edit `snowflake.yml` to replace the placeholders:
- `<YOUR_COMPUTE_POOL>` → e.g., `STREAMLIT_DEDICATED_POOL`
- `<YOUR_PYPI_INTEGRATION>` → e.g., `PYPI_ACCESS_INTEGRATION`
- `<FROM_CONNECTION>` values are filled from your active connection

Deploy with:
```bash
snow streamlit deploy --replace
```

## How Streamlit theming works

A custom theme requires two things:

### 1. Theme configuration in `.streamlit/config.toml`

```toml
[theme]
base = "dark"                      # "dark" or "light"
primaryColor = "#1DB954"           # Buttons, links, highlights
backgroundColor = "#121212"        # Main background
secondaryBackgroundColor = "#181818"  # Sidebar, cards
textColor = "#FFFFFF"              # Main text color
font = "Inter"                     # Body font
codeFont = "FiraCode"              # Code blocks
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

## Theme file structure

Each theme directory contains:

```
{theme}/
├── .streamlit/config.toml   # Theme colors and fonts (Google Fonts)
├── streamlit_app.py         # Demo app showing the theme
├── pyproject.toml           # Dependencies
└── snowflake.yml            # Snowflake deployment config
```

## Dependencies

All themes require Python >=3.11 and use:
- `snowflake-connector-python>=3.3.0` (required — `streamlit[snowflake]` silently skips this on Python 3.12+)
- `streamlit[snowflake]>=1.54.0`
- `altair>=5.5.0`
- `pandas>=2.2.3`

## Fonts

All themes use [Google Fonts](https://fonts.google.com/) loaded via URL in `[[theme.fontFaces]]` entries:

| Font | Used by |
|------|---------|
| Inter | snowflake, nord, spotify, github, minimal, stripe |
| JetBrains Mono | snowflake, dracula, nord, github, minimal |
| Fira Sans | dracula |
| Fira Code | spotify |
| Source Sans 3 | solarized-light |
| Source Code Pro | solarized-light, stripe |
