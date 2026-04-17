
# Using Markdown in Streamlit

Streamlit supports Markdown throughout its API—in `st.markdown()`, widget labels, help tooltips, metrics, `st.table()` cells, and more. Beyond standard GitHub-flavored Markdown, Streamlit adds colored text, badges, icons, and LaTeX.

## Quick reference

| Feature | Syntax | Example | Works in labels |
|---------|--------|---------|--------|
| Bold | `**text**` | `**Bold**` | ✓ |
| Italic | `*text*` | `*Italic*` | ✓ |
| Strikethrough | `~text~` | `~Strikethrough~` | ✓ |
| Inline code | `` `code` `` | `` `variable` `` | ✓ |
| Code block | ` ```lang...``` ` | ` ```python...``` ` | ✗ |
| Link | `[text](url)` | `[Streamlit](https://streamlit.io)` | ✓ |
| Image | `![alt](path)` | `![Logo](logo.png)` | ✓ |
| Heading | `# ` to `###### ` | `## Section` | ✗ |
| Blockquote | `> text` | `> Note` | ✗ |
| Horizontal rule | `---` | `---` | ✗ |
| Unordered list | `- item` | `- First`<br>`- Second` | ✗ |
| Ordered list | `1. item` | `1. First`<br>`2. Second` | ✗ |
| Task list | `- [ ]` / `- [x]` | `- [x] Done`<br>`- [ ] Todo` | ✗ |
| Table | `\| a \| b \|` | `\| H1 \| H2 \|`<br>`\|--\|--\|` | ✗ |
| Emoji | Direct or shortcode | `🎉` or `:tada:` | ✓ |
| Streamlit logo | `:streamlit:` | `:streamlit:` | ✓ |
| Material icon | `:material/icon_name:` | `:material/check_circle:` | ✓ |
| Colored text | `:color[text]` | `:red[Error]` | ✓ |
| Colored background | `:color-background[text]` | `:blue-background[Info]` | ✓ |
| Badge | `:color-badge[text]` | `:green-badge[Success]` | ✓ |
| Small text | `:small[text]` | `:small[footnote]` | ✓ |
| LaTeX (inline) | `$formula$` | `$ax^2 + bx + c$` | ✓ |
| LaTeX (block) | `$$formula$$` | `$$\int_0^1 x^2 dx$$` | ✗ |

## Where Markdown works

Markdown is supported in most places where text is rendered. Streamlit has three levels of markdown support:

**Full Markdown** — All syntax shown in the table above:
- `st.markdown()`, `st.write()`, `st.caption()`, `st.info()`, `st.warning()`, `st.error()`, `st.success()`, `st.table` cells and headers, tooltips (`help` parameter)

**Label subset** — Inline formatting only (see table above). Block elements (e.g. headings, lists, tables) are silently stripped:
- Widget and element labels (`st.button`, `st.checkbox`, `st.radio`, `st.expander`, `st.page_link`, etc.), `st.radio` and `st.select_slider` options, `st.tabs` names, `st.metric` label/value/delta, `st.title`, `st.header`, `st.subheader`, `st.image` caption, `st.dialog` title, `st.progress`, `st.spinner`.

**No Markdown** — Text displays literally:
- `st.text()`, `st.json()`, `st.dataframe()` / `st.data_editor()` cells, `st.selectbox` / `st.multiselect` options, input placeholders, `st.Page` titles, chart/map labels

## GitHub-flavored Markdown

Standard GFM syntax works as expected. Headings automatically get anchor links for navigation.

~~~python
st.markdown("""
# Heading

**Bold**, *italic*, ~~strikethrough~~, `inline code`, [links](url)

- Unordered list
- [x] Task list

| Column | Column |
|--------|--------|
| Cell   | Cell   |

> Blockquote

```python
code_block = "with syntax highlighting"
```
""")
~~~

## Colored text, backgrounds, and badges

```python
st.markdown(":red[Error] and :green[Success]")  # Colored text
st.markdown(":blue-background[Highlighted]")     # Colored background
st.markdown(":green-badge[Active] :red-badge[Inactive]")  # Inline badges
```

**Available colors:** `red`, `orange`, `yellow`, `green`, `blue`, `violet`, `gray`/`grey`, `rainbow`, `primary`

Note: `rainbow` is not supported for backgrounds or badges. Standalone badges also available via `st.badge()`.

## Material icons

Use Google Material Symbols with `:material/icon_name:` syntax. Find icons at [fonts.google.com/icons](https://fonts.google.com/icons)

```python
st.markdown(":material/check_circle: Complete")
```

Material icons also work in `icon` parameters across many elements (`st.button`, `st.expander`, `st.info`, etc.).

## Emojis

Both Unicode emojis (preferred) and shortcodes work.

```python
st.markdown("Hello! 👋 :+1: :tada: :streamlit:")
```

**Note:** Material icons are preferred over emojis for a more professional look.

## LaTeX math

Single `$` for inline, double `$$` for display mode. Inline math requires non-whitespace after `$` to avoid conflicts with currency (e.g., "$5" won't be parsed as math).

```python
# Inline math
st.markdown("The quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$")

# Display math (centered, larger)
st.markdown("""
$$
\\sum_{i=1}^{n} x_i = x_1 + x_2 + ... + x_n
$$
""")
```

## Images in Markdown

```python
st.markdown("![Alt text](https://example.com/image.png)")
st.button("![Logo](app/static/logo.png) Click me")  # Image as icon in label
```

In labels, images display as icons with max height equal to font height.

## Markdown in element labels

Widgets, containers, and other elements support Markdown in their labels (using the label subset).

```python
st.radio(":material/palette: Choose **color**", [":red-background[Red]", ":blue-background[Blue]", ":green-background[Green]"])
tab1, tab2 = st.tabs([":material/home: Home", ":material/settings: Settings"])
st.metric(label=":material/attach_money: Revenue", value=":green[$1.2M]", delta=":material/trending_up: 12%")
```

## Escaping special characters

Use backslash to show literal characters: `\\[`, `\\*`, `1\\.`

```python
st.markdown(":blue[Array: \\[1, 2, 3\\]]")
st.button("1\\. Not a list")
```

## Markdown in st.table

`st.table()` renders Markdown in cells and headers.

```python
st.table({
    "**Name**": "Alice",
    "**Status**": ":green-badge[Active]",
    "**Role**": ":material/shield: Admin"
})
```

## Combining features

Mix multiple features for rich formatting.

```python
st.markdown("""
### :material/rocket: Launch status

| Phase | Status | Notes |
|-------|--------|-------|
| Build | :green-badge[Complete] | All tests passing |
| Deploy | :orange-badge[In Progress] | ETA: 2 hours |
| Monitor | :gray-badge[Pending] | Waiting on deploy |

:small[Last updated: just now]
""")
```

## st.markdown - text alignment and width

Control layout with `text_alignment` and `width` parameters.

```python
st.markdown("Centered heading", text_alignment="center")  # left, center, right, justify
st.markdown("Content width only", width="content")  # stretch, content, or pixels (e.g. 400)
```

## HTML (use very sparingly!)

Mix Markdown with HTML using `unsafe_allow_html=True`. For pure HTML without markdown processing, use `st.html()` instead.

```python
st.markdown("**Status:** <span style='color: coral'>Custom styled</span>", unsafe_allow_html=True)
st.html("<div class='custom'>Pure HTML content</div>")
```

## References

- [st.markdown](https://docs.streamlit.io/develop/api-reference/text/st.markdown)
- [st.latex](https://docs.streamlit.io/develop/api-reference/text/st.latex)
- [GitHub-flavored Markdown spec](https://github.github.com/gfm)
- [Material Symbols](https://fonts.google.com/icons)
- [KaTeX supported functions](https://katex.org/docs/supported.html)
