# Streamlit theme templates

Ready-to-use theme configs. Each file in `configs/` is a complete `[theme]`
block — paste into your app's `.streamlit/config.toml`.

## Available themes

| Theme | Base | Primary color | Fonts |
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

All themes load [Google Fonts](https://fonts.google.com/) via the
`font = "<family>:<stylesheet_url>"` syntax — no local font files required.

See `references/theme.md` for the full theming guide.
