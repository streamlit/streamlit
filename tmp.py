import streamlit as st

# Various form/widget association tests:
cols = st.beta_columns(2)

# NO (parent block created outside form; element created inside form)
with st.beta_form(key="form_1"):
    cols[0].slider("NOT in form 1", key="slider_1")
    st.text("(Empty form)")

# YES (parent block created inside form; element created inside form)
with st.beta_form(key="form_2"):
    cols = st.beta_columns(2)
    cols[0].slider("in form 2!", key="slider_2")

# YES (parent block created inside form; element created outside form)
cols[1].slider("in form 3!", key="slider_3")

# NO (dg created outside form; element created inside form)
empty = st.empty()
with st.beta_form(key="form_3"):
    empty.slider("NOT in form 4!", key="slider_4")

# YES (dg created inside form; element created outside form)
with st.beta_form(key="form_4"):
    empty = st.empty()
empty.slider("in form 5!", key="slider_5")

# YES (element created directly on form block)
form = st.beta_form(key="form_5")
form.slider("in form 6!", key="slider_6")

# YES (form in sidebar)
with st.sidebar.beta_form(key="form_6"):
    st.slider("in form 7!", key="slider_7")

"# Columns outside a form"
c1, _ = st.beta_columns(2)

with st.beta_form(key="f1"):
    aaa = c1.slider("aaa", 1, 10)
"aaa", aaa


"# Columns inside a form"
with st.beta_form(key="f2"):
    c2, _ = st.beta_columns(2)
    bbb = c2.slider("bbb", 1, 20)
"bbb", bbb


"# Forms inside columns"
c3, c4 = st.beta_columns(2)

with c3:
    with st.beta_form(key="f3"):
        ccc = st.slider("ccc", 1, 5)
    "ccc", ccc

with c4:
    with st.beta_form(key="f4"):
        ddd = st.slider("ddd", 5, 10)
    "ddd", ddd


"# Columns inside a form"
with st.beta_form(key="f5"):
    c5, c6 = st.beta_columns(2)

    with c5:
        eee = st.slider("eee", 10, 50)
    "eee", eee

    fff = c6.slider("fff", 151, 200)
    "fff", fff

    ggg = st.sidebar.slider("ggg", 201, 250)
    "ggg", ggg


with st.sidebar.beta_form(key="blah"):
    c10, c11 = st.beta_columns(2)
    c10.slider("blah")
