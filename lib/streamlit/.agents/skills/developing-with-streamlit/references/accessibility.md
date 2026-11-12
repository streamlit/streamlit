# Accessibility when building Streamlit apps

Streamlit ships a useful accessibility **floor** (landmarks, skip link, native widget keyboard for most `st.*`, default theme contrast when tokens are untouched). That is **not** a claim that an app is WCAG-conformant. Conformance applies to the app you ship. This page is the decision layer: what the library already covers, what you must still supply, and what not to invent around.

Prefer native `st.*` over custom HTML, third-party widgets, or CSS that recreates chrome. Custom and community surfaces often lose keyboard, focus, and naming behavior Streamlit already provides. See also [best-practices.md](best-practices.md), [theme.md](theme.md), [charts.md](charts.md#accessible-names-alt), [media-display.md](media-display.md#accessible-names-alt), and [data-display.md](data-display.md#accessible-names-alt).

## Library already covers (do not reinvent)

- App frame: main landmark, “Skip to main content,” and a named page-navigation landmark when multipage nav is shown.
- Most native widgets are keyboard-operable; dialogs use shared modal focus containment when dismissible.
- Default light/dark themes meet many text and control contrast floors when you leave stock tokens alone.

Do not rebuild headers, sidebars, menus, or toasts in raw HTML to “fix” accessibility. Fix author content first.

## Author must (always do these)

- Pass keyword-only `alt=` on images, charts, maps, media, iframes, PDFs, tables, dataframes, and data editors. Short plain text that states the **takeaway or purpose** — not the chart type, not `"Image of…"`, not a data dump. Decorative `alt=""` is only for `st.image` / `st.pyplot`. Whitespace-only `alt` is ignored.
- Give every widget a real label. Never `label=""`. Use `label_visibility="collapsed"` or `"hidden"` when the visible UI already names the control. Do not use `help=` or `placeholder=` as a substitute for a label. Icon- or emoji-only buttons still need an accessible name (visible text or `aria`-equivalent via the widget `label`).
- Set a descriptive browser tab title with `st.set_page_config(page_title=...)` (not the default “Streamlit”).
- For `st.video`, supply captions (`subtitles=`) when speech matters. For `st.audio`, place a transcript nearby when the recording is essential content (there is no `transcript=` parameter).
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
```

## Common AI anti-patterns

- Claiming the app or Streamlit is “WCAG compliant,” “AA certified,” or “fully accessible.”
- Generic or chart-type `alt` (`"Chart"`, `"Line chart"`, `"Image of…"`) or pasting the same string into `caption` and `alt`.
- Using decorative `alt=""` on meaningful images/charts to “satisfy” the rule.
- Icon-only controls with no spoken name; `help=` / placeholder as the only label.
- Color-only metric deltas or status (red/green with no text).
- Critical failures only in `st.toast`.
- Rebuilding nav or page chrome with custom HTML when `st.navigation`, containers, and native widgets already cover the layout.

## Theme override hazards

Stock defaults are measured against WCAG AA-style floors for body text, muted text, links, primary-as-control, and related roles. Custom themes often break those floors.

When you set colors in `.streamlit/config.toml`:

- Keep body `textColor` strong on `backgroundColor` and on `secondaryBackgroundColor` (sidebar / cards).
- If the sidebar should differ, set a **full** contrast set there — not only `backgroundColor`.
- Ensure `primaryColor` still supports **white** button labels; avoid using primary as plain body text on dark surfaces without checking.
- Weak `borderColor` fails non-text contrast; do not strip focus styles with CSS.
- Named markdown colors and translucent status fills can fail as plain text even when badge-style fills look fine.

Start from a shipped theme template and retint carefully; see [theme.md](theme.md). Prefer config over CSS.

## Known library gaps (do not CSS-patch)

These need Streamlit (or dependency) changes. Do not invent brittle CSS or HTML workarounds; use native commands and good author content instead.

- Dataframe / data editor: pointer-only column menu; incomplete canvas cell names; missing live status; unlocked toolbars can stay invisible under keyboard focus.
- `st.toast`: weak accessible name / status announcement — use on-page alerts for critical errors.
- PDF viewer: scrollport / in-document links not fully keyboard-operable.
- Stock borders and soft focus rings can fail contrast until defaults are raised.

## Verify before you say done

Scan the app you generated or edited:

1. Every image, chart, map, media, iframe, PDF, table, and dataframe has a **useful** `alt=` (takeaway, not chart type); decorative `alt=""` only on image/pyplot when intentional.
2. No empty widget labels; collapsed labels are intentional (`help=` / placeholder are not substitutes).
3. `st.set_page_config(page_title=...)` sets a descriptive tab title.
4. Video/audio that carries speech has captions or a transcript path.
5. Meaning is not color-only (charts, metrics, status).
6. Custom theme or colored markdown was contrast-checked, or you stayed on stock tokens.
7. You did not add custom HTML/CSS to replace native chrome or to “fix” a known library gap above.
