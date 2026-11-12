# Accessibility when building Streamlit apps

This page covers what Streamlit already provides, what app authors must supply, and which workarounds to avoid. Streamlit's shipped defaults give a useful **baseline** (landmarks, skip link, keyboard support in most native widgets, default theme contrast when tokens are untouched) — **not** a claim that an app is WCAG-conformant. Conformance applies to the app you ship.

Prefer native `st.*` over custom HTML, third-party widgets, or CSS that recreates chrome. Custom and community surfaces often lose keyboard, focus, and naming behavior Streamlit already provides. See also [best-practices.md](best-practices.md), [theme.md](theme.md), [charts.md](charts.md#accessible-names-alt), [media-display.md](media-display.md#accessible-names-alt), and [data-display.md](data-display.md#accessible-names-alt).

## Library already covers (do not reinvent)

- App frame: main landmark, “Skip to main content,” and a named page-navigation landmark when multipage nav is shown.
- Most native widgets are keyboard-operable, and `st.dialog` contains focus while open.
- Default light/dark themes meet AA text contrast (body, muted, links) and white-on-primary button labels when you leave stock tokens alone.

Do not rebuild headers, sidebars, menus, or toasts in raw HTML to “fix” accessibility. Fix author content first.

## Author must (always do these)

- Pass keyword-only `alt=` on author-content media and data displays that accept it: `st.image`, `st.pyplot`, charts, maps, `st.video`, `st.audio`, `st.iframe`, `st.pdf`, `st.table`, `st.dataframe`, and `st.data_editor`. Short plain text that states the **takeaway or purpose** — not the chart type, not `"Image of…"`, not a data dump. Decorative `alt=""` is only for `st.image` / `st.pyplot`. Whitespace-only `alt` is ignored. Do not pass `alt=` to app-chrome commands such as `st.logo` (no such parameter).
- On `st.echarts_chart`, `alt` replaces the data-derived description, so a vague name is worse than omitting `alt`. On `st.image` / `st.pyplot` with several images, pass a same-length sequence (use `None` to skip one); a single string raises an error.
- Give input widgets a real label. Never `label=""` on inputs. Use `label_visibility="collapsed"` or `"hidden"` on widgets that accept it when the visible UI already names the control. Do not use `help=` or `placeholder=` as a substitute for a label on those widgets.
- Buttons have no `label_visibility`: for an icon-only button, pass `""` as the label with `icon=":material/…:"` and pick an icon whose name describes the action; otherwise use a visible text label. Avoid emoji-only labels.
- `st.chat_input` has no `label`; its `placeholder` is the accessible name, so keep it descriptive and non-empty.
- Set a descriptive browser tab title with `st.set_page_config(page_title=...)`; the filename-derived default (for example `"streamlit_app"`) rarely describes the app.
- For native video files, supply captions with `st.video(..., subtitles=...)` when speech matters. YouTube embeds cannot take `subtitles=` (raises an error); rely on the YouTube video's own captions, or place a transcript next to the player. For `st.audio`, place a transcript nearby when the recording is essential content (there is no `transcript=` parameter).
- Do not encode meaning with color alone in charts, `st.metric` deltas, or status text. Pair color with text, pattern, or direct labels.
- Put **critical** errors in `st.error` / on-page alerts when the user must notice them — not only in `st.toast`.
- If you customize `theme.*` or use colored markdown (`:orange[…]`, status fills as plain text), re-check contrast (see [Theme override hazards](#theme-override-hazards)).

```python
# BAD — missing name, empty label, generic alt
st.line_chart(df)
st.line_chart(df, alt="Line chart")
st.text_input("")
st.text_input("", placeholder="Search", help="Search")

# GOOD — takeaway alt; real label (visibility may be collapsed); page title
st.set_page_config(page_title="Q3 revenue dashboard")
st.line_chart(df, alt="Monthly revenue rising through Q3")
st.text_input(
    "Search",  # required accessible name
    label_visibility="collapsed",
    placeholder="Search",  # not a label substitute
)
st.button("", icon=":material/delete:")  # icon-only; name comes from the icon
st.chat_input(placeholder="Ask about this dashboard")
```

## Common AI anti-patterns

- Claiming the app or Streamlit is “WCAG compliant,” “AA certified,” or “fully accessible.”
- Generic or chart-type `alt` (`"Chart"`, `"Line chart"`, `"Image of…"`) or pasting the same string into `caption` and `alt`.
- Using decorative `alt=""` on meaningful images/charts to “satisfy” the rule.
- Icon-only controls with no spoken name; `help=` / placeholder as the only label on labeled inputs.
- Color-only metric deltas or status (red/green with no text).
- Critical failures only in `st.toast`.
- Rebuilding nav or page chrome with custom HTML when `st.navigation`, containers, and native widgets already cover the layout.
- Passing `alt=` to `st.logo`, or `subtitles=` to `st.video` with a YouTube URL.
- Passing `label_visibility=` to buttons, or inventing a `label=` for `st.chat_input`.

## Theme override hazards

The shipped light and dark themes meet AA text contrast (body, muted, links) and white-on-primary button labels. Custom themes often break this.

When you set colors in `.streamlit/config.toml`:

- Keep body `textColor` strong on `backgroundColor` and on `secondaryBackgroundColor` (sidebar / cards).
- If the sidebar should differ, set a **full** contrast set there — not only `backgroundColor`.
- Ensure `primaryColor` still supports **white** button labels; avoid using primary as plain body text on dark surfaces without checking.
- Weak `borderColor` fails non-text contrast; do not strip focus styles with CSS.
- Named markdown colors and translucent status fills can fail as plain text even when badge-style fills look fine.

Start from a shipped theme template and retint carefully; see [theme.md](theme.md). Prefer config over CSS.

## Known library gaps (do not CSS-patch)

These need Streamlit (or dependency) changes. Do not invent brittle CSS or HTML workarounds; use native commands and good author content instead.

- Dataframe / data editor: column menus need a pointer, screen readers get incomplete cell names, and some toolbar buttons are hard to reach by keyboard.
- `st.toast` has a weak accessible name and isn't reliably announced. Use on-page alerts for critical errors.
- PDF viewer: scrolling the document and activating in-document links is not fully keyboard-operable.
- Default borders and focus rings can fall below non-text contrast.

## Verify before you say done

Scan the app you generated or edited:

1. Every `st.image`, chart, map, media, iframe, PDF, table, dataframe, and `st.data_editor` that accepts `alt=` has a **useful** value (takeaway, not chart type); decorative `alt=""` only on image/pyplot when intentional. Do not pass `alt=` to `st.logo`.
2. No empty labels on input widgets (icon-only buttons with a descriptive Material icon are fine; `st.chat_input` is named by its placeholder); collapsed labels are intentional, and `help=` / `placeholder` are not substitutes elsewhere.
3. `st.set_page_config(page_title=...)` sets a descriptive tab title (not the filename-derived default).
4. Native video with speech has `subtitles=`; YouTube uses on-platform captions or a nearby transcript; audio has a transcript path when needed.
5. Meaning is not color-only (charts, metrics, status).
6. Custom theme or colored markdown was contrast-checked, or you stayed on stock tokens.
7. You did not add custom HTML/CSS to replace native chrome or to “fix” a known library gap above.
