# Streamlit theme templates

Ready-to-use theme configs. Each file in `configs/` is a complete `[theme]`
block — paste into your app's `.streamlit/config.toml`.

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

All themes load [Google Fonts](https://fonts.google.com/) via the
`font = "<family>:<stylesheet_url>"` syntax — no local font files required.

See `references/theme.md` for the full theming guide.
