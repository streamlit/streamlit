import streamlit as st

page = st.Page(lambda: None, title="Home")

st.error(f"❌ BEFORE fix: type(st.Page(...)) = `{type(page).__name__}`")
st.error("❌ BEFORE fix: isinstance(page, st.Page) crashes with TypeError")
st.info("ℹ️ st.Page is currently a factory function, not a class")
st.code("""
# After fix (issue #12953):
# type(st.Page(...)) == 'Page'       ✅
# isinstance(page, st.Page) == True  ✅  
# StreamlitPage = Page (alias)       ✅
""")
