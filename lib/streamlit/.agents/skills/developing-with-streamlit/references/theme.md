
# Streamlit theming

Custom colors and styling via `.streamlit/config.toml`.

## IMPORTANT: No custom CSS unless explicitly requested

**DO NOT use custom CSS or HTML for theming.** This includes:
- `st.markdown(..., unsafe_allow_html=True)` with `<style>` or inline styles
- `st.html()` with `<style>` blocks
- Any HTML/CSS for colors, backgrounds, fonts, or visual styling

**Only use CSS if the user explicitly asks for it** (e.g., "add custom CSS", "use st.html for styling"). For brand colors, theming, and visual identity—always use `config.toml`.

Native theming is cleaner, more maintainable, and won't break with Streamlit updates.

## Basic theme

Configure your app's colors in `.streamlit/config.toml`:

```toml
[theme]
base = "light"  # or "dark"
primaryColor = "#FF4B4B"
backgroundColor = "#FFFFFF"
secondaryBackgroundColor = "#F0F2F6"
textColor = "#262730"
font = "sans serif"
```

**Core options:**
- `base` → Start from `"light"` or `"dark"` theme
- `primaryColor` → Interactive elements (buttons, links, sliders)
- `backgroundColor` → Main content area
- `secondaryBackgroundColor` → Sidebar and widget backgrounds
- `textColor` → All text
- `font` → `"sans serif"`, `"serif"`, or `"monospace"`

**Ensure sufficient contrast:** Always verify that `textColor` has strong contrast against `backgroundColor` and `secondaryBackgroundColor`. Poor contrast makes text unreadable. Use dark text on light backgrounds and light text on dark backgrounds.

## Separate light and dark themes

Define both themes and let users choose:

```toml
[theme.light]
primaryColor = "#FF4B4B"
backgroundColor = "#FFFFFF"
secondaryBackgroundColor = "#F0F2F6"
textColor = "#262730"

[theme.dark]
primaryColor = "#FF6B6B"
backgroundColor = "#0E1117"
secondaryBackgroundColor = "#262730"
textColor = "#FAFAFA"
```

When both are defined, users can switch between them in the settings menu.

## Sidebar styling

Style the sidebar separately:

```toml
[theme]
base = "light"
primaryColor = "slateBlue"
backgroundColor = "mintCream"

[theme.sidebar]
backgroundColor = "aliceBlue"
secondaryBackgroundColor = "skyBlue"
```

## Detect current theme

```python
if st.context.theme.base == "dark":
    # Dark mode specific logic
    chart_color = "#FF6B6B"
else:
    chart_color = "#FF4B4B"
```

Use `st.context.theme.base` to detect if the user is in light or dark mode.

## When CSS is allowed

**Only use custom CSS when the user explicitly requests it** (e.g., "add custom CSS", "use st.html", "I need a gradient header").

If the user explicitly asks for CSS, use `key=` to create targetable CSS classes:

```python
st.text_input("Username", key="username")
st.button("Submit", key="submit")
```

Generated CSS classes:
```css
.st-key-username { ... }
.st-key-submit { ... }
```

Apply styles:
```python
st.html("""
<style>
.st-key-submit button {
    width: 100%;
}
</style>
""")
```

**Never use CSS for theming (colors, backgrounds, fonts) unless explicitly asked. Use config.toml instead.**

## Theme templates

Ready-to-use themes with bundled fonts are available in `assets/templates/themes/`:

| Theme | Base | Primary Color | Fonts |
|-------|------|---------------|-------|
| **snowflake** | Light | `#29B5E8` (cyan) | Inter, JetBrains Mono |
| **dracula** | Dark | `#BD93F9` (purple) | Fira Sans, JetBrains Mono |
| **nord** | Dark | `#88C0D0` (frost blue) | Inter, JetBrains Mono |
| **stripe** | Light | `#635BFF` (indigo) | Inter, Source Code Pro |
| **solarized-light** | Light | `#268BD2` (blue) | Source Sans 3, Source Code Pro |
| **spotify** | Dark | `#1DB954` (green) | Inter, Fira Code |
| **github** | Light | `#0969DA` (blue) | Inter, JetBrains Mono |
| **minimal** | Dark | `#6366f1` (indigo) | Inter, JetBrains Mono |

Each theme includes local font files for Snowflake deployment. See `assets/templates/themes/README.md`.

## References

- [Theming](https://docs.streamlit.io/develop/concepts/configuration/theming)
- [st.context](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.context)
