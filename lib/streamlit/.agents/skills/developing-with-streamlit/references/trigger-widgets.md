# Streamlit trigger / button widgets

Buttons and button-like widgets are **trigger** widgets: they fire an action on click and return a transient value (often `True` or the picked option) on that one rerun, then revert. They do **not** hold a persistent value the way selection widgets ([selection-widgets.md](selection-widgets.md)) or value-entry widgets (the input-widgets reference) do. Reach for these when the user is *doing* something, not *choosing* a value to keep.

## When to use what

| Widget | Use for | Returns |
|--------|---------|---------|
| `st.button` | Fire an action or flip state on click | `bool` (transient — `True` only on the click rerun) |
| `st.menu_button` | A toolbar / action menu: one button that opens a dropdown of choices and returns the pick once | the chosen option once, then `None` |
| `st.download_button` | Send a file (CSV, image, report) to the user | `bool` (`True` on the download click) |
| `st.link_button` | Navigate to a URL (external or internal) | nothing — it's a link, not a rerun trigger |

## st.button — the basic trigger

`st.button` returns `True` only on the single rerun where the click happened, then goes back to `False`. The value is transient, not remembered across reruns.

```python
# BAD: assumes the button "stays clicked" — this branch only runs on the click
# rerun, then the panel vanishes on the next interaction.
if st.button("Show details"):
    show_panel()

# GOOD: use the click to set persistent state, then read the state.
if st.button("Show details"):
    st.session_state.show = True
if st.session_state.get("show"):
    show_panel()
```

Use the click to fire an action (save, send, recompute) or to flip a value in `st.session_state`; never rely on the boolean surviving to the next run. See [session-state.md](session-state.md) for the persistence patterns. Style emphasis with `type="primary"` and add a leading glyph with `icon=":material/save:"`.

## st.menu_button — one-shot action menu (trigger semantics)

Use `st.menu_button` for a toolbar/action button that opens a dropdown of options and fires **once per click** — e.g. an Export button offering CSV / Excel / PDF. It returns the picked option exactly once, then reverts to `None` on the next rerun, just like `st.button` returns `True` once. The button label never changes after a selection.

```python
# GOOD: trigger-style action menu. Returns the option once, then None.
choice = st.menu_button("Export", ["CSV", "Excel", "PDF"])
if choice is not None:
    st.write(f"Exporting as {choice}…")
```

```python
# BAD: st.selectbox is a PERSISTENT selector — it shows the choice in the
# widget and remembers it, so it can't model a one-shot "Export" action.
fmt = st.selectbox("Export", ["CSV", "Excel", "PDF"])
st.write(f"Exporting as {fmt}…")  # fires on every rerun, never resets

# BAD: hand-rolled HTML/JS dropdown. Unnecessary and won't render
# a real menu — also fails when unsafe_allow_html is stripped.
st.markdown("<select>…</select>", unsafe_allow_html=True)
```

Notes:
- Guard the output with `if choice is not None:` so nothing shows before the user picks (the return is `None` on first load and after each rerun). Prefer `is not None` over a plain truthiness check so a falsy option value (e.g. `0` or `""`) isn't silently skipped.
- For a full-width button, pass `width="stretch"` (the default is `width="content"`). Do NOT use `use_container_width=True` — that parameter is deprecated.
- Prefer it over `st.selectbox`, `st.pills`, or a custom `st.popover` + `st.button` combo for action/toolbar menus.
- Do NOT build this with `unsafe_allow_html=True` in `st.markdown` or with `st.components.v1.html(...)` — those were the old workarounds and are now obsolete.

## st.download_button — send a file to the user

Use `st.download_button` to hand the user a file (CSV export, generated image, report). It renders a button and returns `True` on the download click. The `data` can be a `str`, `bytes`, or a file-like object — don't hand-roll a download link with raw HTML or a data URI.

```python
# GOOD: native download button; data can be str/bytes/file-like.
csv = df.to_csv(index=False)
st.download_button("Download CSV", data=csv, file_name="report.csv", mime="text/csv")

# BAD: a hand-rolled data-URI link — unstyled, unsanitized, and brittle.
st.markdown(f'<a href="data:text/csv;base64,{b64}">Download</a>', unsafe_allow_html=True)
```

If building the file is expensive, gate the work behind the click or wrap it in `st.cache_data` so it isn't recomputed every rerun. See [performance.md](performance.md).

## st.link_button — navigate to a URL

Use `st.link_button` to send the user to a URL (external site, docs, or another route). Unlike `st.button` it doesn't trigger a rerun or return a value — it's a styled link.

```python
# GOOD: a styled link that navigates away; no rerun, no return value to handle.
st.link_button("Open docs", "https://docs.streamlit.io")

# BAD: st.button can't navigate on its own — it just reruns the script.
if st.button("Open docs"):
    ...  # no built-in way to open a URL from here
```

For in-app navigation between pages of a multi-page app, prefer `st.page_link` / `st.switch_page` (see [multipage-apps.md](multipage-apps.md)); use `st.link_button` for external URLs.

## References

- [st.button](https://docs.streamlit.io/develop/api-reference/widgets/st.button)
- [st.menu_button](https://docs.streamlit.io/develop/api-reference/widgets/st.menu_button)
- [st.download_button](https://docs.streamlit.io/develop/api-reference/widgets/st.download_button)
- [st.link_button](https://docs.streamlit.io/develop/api-reference/widgets/st.link_button)
