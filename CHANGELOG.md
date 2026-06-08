## Unreleased

### Breaking Changes 🛠

- `st.header()`, `st.subheader()`, and `st.title()` now default `anchor` to `False` (no anchor icon shown). Previously the default was `None`, which auto-generated and displayed an anchor icon. Apps relying on auto-generated anchors for in-page navigation or deep-linking should pass `anchor=None` explicitly to restore the previous behavior. ([#15461](https://github.com/streamlit/streamlit/pull/15461), [#15213](https://github.com/streamlit/streamlit/issues/15213))
