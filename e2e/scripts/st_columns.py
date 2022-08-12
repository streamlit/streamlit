import streamlit as st

CAT_IMAGE = "https://images.unsplash.com/photo-1552933529-e359b2477252?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=950&q=80"

if st.button("Layout should not shift when this is pressed"):
    st.write("Pressed!")

# Same-width columns
c1, c2, c3 = st.columns(3)
c1.image(CAT_IMAGE)
c2.image(CAT_IMAGE)
c3.image(CAT_IMAGE)


# Variable-width columns
for c in st.columns((1, 2, 3, 4)):
    c.image(CAT_IMAGE)

# Various column gaps
c4, c5, c6 = st.columns(3, gap="small")
c4.image(CAT_IMAGE)
c5.image(CAT_IMAGE)
c6.image(CAT_IMAGE)

c7, c8, c9 = st.columns(3, gap="medium")
c7.image(CAT_IMAGE)
c8.image(CAT_IMAGE)
c9.image(CAT_IMAGE)

c10, c11, c12 = st.columns(3, gap="large")
c10.image(CAT_IMAGE)
c11.image(CAT_IMAGE)
c12.image(CAT_IMAGE)
