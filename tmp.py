import streamlit as st

"# Forms inside columns"
c1, c2 = st.beta_columns(2)

with c1:
    with st.beta_form(key="f1"):
        foo = st.slider("foo", 1, 5)
    "Foo", foo

with c2:
    with st.beta_form(key="f2"):
        bar = st.slider("bar", 5, 10)
    "Bar", bar


"# Columns inside a form"
with st.beta_form(key="f3"):
    c3, c4, c5 = st.beta_columns(3)

    with c3:
        baz = st.slider("baz", 10, 50)
    "Baz", baz

    with c4:
        qux = st.slider("qux", 51, 100)
    "Qux", qux

    quux = c5.slider("quux", 151, 200)
    "Quux", quux

    quuz = st.sidebar.slider("quuz", 201, 250)
    "Quuz", quuz
