import streamlit as st

# import pandas as pd
# import plost


# Column Gap -----------------

# st.write("Deafult Gap (small)")
# col1, col2, col3 = st.columns(3)

# with col1:
#     st.subheader("Longer String Longer String One")

# with col2:
#     st.subheader("Longer String Longer String Two")

# with col3:
#     st.subheader("Longer String Longer String Three")

# st.write("Small Gap")
# col4, col5, col6 = st.columns(3, gap="small")
# # col4, col5, col6 = st.columns(3)


# with col4:
#     st.subheader("Longer String Longer String Four")

# with col5:
#     st.subheader("Longer String Longer String Five")

# with col6:
#     st.subheader("Longer String Longer String Six")

# st.write("Medium Gap")
# col7, col8, col9 = st.columns(3, gap="medium")
# # col7, col8, col9 = st.columns(3)


# with col7:
#     st.subheader("Longer String Longer String Seven")

# with col8:
#     st.subheader("Longer String Longer String Eight")

# with col9:
#     st.subheader("Longer String Longer String Nine")

# st.write("Large Gap")
# col10, col11, col12 = st.columns(3, gap="large")
# # col10, col11, col12 = st.columns(3)


# with col10:
#     st.subheader("Longer String Longer String Ten")

# with col11:
#     st.subheader("Longer String Longer String Eleven")

# with col12:
#     st.subheader("Longer String Longer String Twelve")

# col10, col11, col12 = st.columns(3, gap="penguin")


CAT_IMAGE = "https://images.unsplash.com/photo-1552933529-e359b2477252?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=950&q=80"

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

c7, c8, c9 = st.columns(3, gap="MediUM")
c7.image(CAT_IMAGE)
c8.image(CAT_IMAGE)
c9.image(CAT_IMAGE)

c10, c11, c12 = st.columns(3, gap="large")
c10.image(CAT_IMAGE)
c11.image(CAT_IMAGE)
c12.image(CAT_IMAGE)


# dataset = {
#     "company": ["goog", "fb", "ms", "amazon"], "q2": [4,6,8,2], "q3": [2,5,2,6],
# }

# df = pd.DataFrame(dataset)

# St.header("Chart header")

# plost.bar_chart(
#     data=df,
#     bar='company',
#     value=['q2', 'q3'],
#     group='value',
#     color='company',
#     legend=None,
# )

# st.radio("Radio Button", ('This is a test for a really really really long label for a radio button', 'Comedy', 'Comedy', 'Comedy', 'Comedy', 'Comedy', 'Comedy', 'Comedy', 'Drama', 'Documentary'))
# st.radio("Radio Button", ('This is a test for a really really really long label for a radio button', 'Comedy', 'Comedy', 'Comedy', 'Comedy', 'Comedy', 'Comedy', 'Comedy', 'Drama', 'Documentary'), horizontal=True)


# import pandas as pd
# import altair as alt


# data = { 'brand' : ['ford', 'toyota'], 'count': [100,50] }
# df = pd.DataFrame(data)

# st.write(df)

# def cars(df):

#     base = alt.Chart(df)

#     pie = base.mark_arc().encode(
#         theta=alt.Theta(field="count", type="quantitative"),
#         color=alt.Color(field="brand", type="nominal"),
#     )

#     st.altair_chart(pie, use_container_width=True)

# cars(df)

# import streamlit as st

# # for k in range(5):
# #     st.slider(
# #         f"Slider {k}",
# #         min_value=0,
# #         max_value=100,
# #         value=50,
# #         step=1,
# #         key="slider",
#     # )

# st.slider(
#     f"Slider 1",
#     min_value=0,
#     max_value=100,
#     value=50,
#     step=1,
#     key="slider",
# )

# st.slider(
#     f"Slider",
#     min_value=0,
#     max_value=100,
#     value=50,
#     step=1,
#     key="slider",
# )

# st.write(st.session_state)

# import streamlit as st

# if "x" not in st.session_state:
#     st.session_state["x"] = (3,7)
# x = st.slider("x", min_value=0, max_value=10, value=(1,2), key="x")
# y = st.slider("y", min_value=0, max_value=10, value=(2,8), key="y")
# st.write(st.session_state)


# import streamlit as st
# import pandas as pd
# import time
# from PIL import Image

# image = Image.open("Arrow2.png")


# container = st.container()
# container.write("Container 1:")


# with st.form("my_form"):

#     # container = st.container()
#     container2 = st.container()

#     st.write("Inside the form")
#     slider_val = st.slider("Form slider")
#     checkbox_val = st.checkbox("Form checkbox")

#     # Every form must have a submit button.
#     submitted = st.form_submit_button("Submit")
#     time.sleep(7)

#     if submitted:

#         st.write("slider", slider_val, "checkbox", checkbox_val)

#         thislist = ["apple", "banana", "cherry"]

#         List = container2.selectbox("list", thislist)

#         Drawing = container.image(image, width=700)
#         # Drawing = container.write("This is it")


# st.write("Outside the form")


# 4663 -----------------
import numpy as np


# st.select_slider(
#     label="Select slider of floats",
#     options=np.arange(0.0, 0.25, 0.05),
#     value=(0.1, 0.2),
# )


# 4647 -----------------

# st.file_uploader("This is the uploader")
