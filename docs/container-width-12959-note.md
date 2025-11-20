# Note: `width="content"` for `st.container` (Issue #12959)

**Summary**

An issue was reported (Streamlit #12959) that using `width="content"` with `st.container`
produces an error rather than being accepted as a valid width value.

At the time of writing, the `st.container`/layout code does not accept the string
`"content"` as a valid `width` option. If you try:

```py
import streamlit as st

with st.container(width="content"):
    st.write("Hello")
