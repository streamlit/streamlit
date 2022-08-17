import streamlit as st
import pandas as pd
import numpy as np
from PIL import Image
from datetime import datetime
from datetime import date

# x = st.sidebar.text("overwrite me")
# x.text("overwritten")
# x = st.sidebar.text("overwrite me")
# x.text("overwritten")
# x = st.sidebar.text("overwrite me")
# x.text("overwritten")
# x = st.sidebar.text("overwrite me")
# x.text("overwritten")
# x = st.sidebar.text("overwrite me")
# x.text("overwritten")
# x = st.sidebar.text("overwrite me")
# x.text("overwritten")
# x = st.sidebar.text("overwrite me")
# x.text("overwritten")
# x = st.sidebar.text("overwrite me")
# x.text("overwritten")
# x = st.sidebar.text("overwrite me")
# x.text("overwritten")

w1 = st.date_input("Label 1", date(1970, 1, 1))
st.write("Value 1:", w1)


x = st.sidebar.text("overwrite me")
x.text("overwritten")

y = st.sidebar.text_input("type here")

w2 = st.sidebar.date_input("Label 2", datetime(2019, 7, 6, 21, 15))
st.write("Value 2:", w2)


# Build a bunch of data to display
df1 = pd.DataFrame(
    data=[[1, 2, 3], [4, 5, 6], [7, 8, 9]], index=[0, 1, 2], columns=["AA", "BB", "CC"]
)
df4 = (df1 * 111).rename(columns={"AA": "DD", "BB": "EE", "CC": "FF"}).copy()
df2 = df1.join(df4) * 1000
df3 = df4.join(df1) * 11111

c1, c2, c3 = st.columns((3, 4, 5))

c1.subheader("Data A")
c1.table(df1)
c2.subheader("Data B")
c2.table(df2)
c3.subheader("Data C")
c3.table(df3)

# Interactive Scatter Plot Example

interactive_scatter_spec = {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "description": "Drag the sliders to highlight points.",
    "title": f"Interactive Scatter Chart",
    "data": {"url": "https://vega.github.io/vega-datasets/data/cars.json"},
    "transform": [{"calculate": "year(datum.Year)", "as": "Year"}],
    "layer": [
        {
            "params": [
                {
                    "name": "CylYr",
                    "value": [{"Cylinders": 4, "Year": 1977}],
                    "select": {"type": "point", "fields": ["Cylinders", "Year"]},
                    "bind": {
                        "Cylinders": {"input": "range", "min": 3, "max": 8, "step": 1},
                        "Year": {"input": "range", "min": 1969, "max": 1981, "step": 1},
                    },
                }
            ],
            "mark": "circle",
            "encoding": {
                "x": {"field": "Horsepower", "type": "quantitative"},
                "y": {"field": "Miles_per_Gallon", "type": "quantitative"},
                "color": {
                    "condition": {
                        "param": "CylYr",
                        "field": "Origin",
                        "type": "nominal",
                    },
                    "value": "grey",
                },
            },
        },
        {
            "transform": [{"filter": {"param": "CylYr"}}],
            "mark": "circle",
            "encoding": {
                "x": {"field": "Horsepower", "type": "quantitative"},
                "y": {"field": "Miles_per_Gallon", "type": "quantitative"},
                "color": {"field": "Origin", "type": "nominal"},
                "size": {"value": 100},
            },
        },
    ],
}

st.vega_lite_chart(interactive_scatter_spec, None, use_container_width=True)


# ----------- #4914

# # st.set_page_config(page_title='Corgis', initial_sidebar_state='collapsed')
# # st.set_page_config(layout='wide', page_title='Example', initial_sidebar_state='expanded')
# st.sidebar.write('Close sidebar and issue sometimes goes away')

# # Build a bunch of data to display
# df1 = pd.DataFrame(data=[[1, 2, 3], [4, 5, 6], [7, 8, 9]], index=[0, 1, 2], columns=['AA', 'BB', 'CC'])
# df4 = (df1 * 111).rename(columns={'AA': 'DD', 'BB': 'EE', 'CC': 'FF'}).copy()
# df2 = df1.join(df4) * 1000
# df3 = df4.join(df1) * 11111

# # Display data
# c1, c2, c3, c4 = st.columns((3, 4, 5, 3))

# c1.subheader('Frame 1')
# c1.table(df1)
# # c1.write(df1)
# c2.subheader('Frame 2')
# c2.table(df2)
# # c2.write(df2)
# c3.subheader('Frame 3')
# c3.table(df3)
# # c3.write(df3)
# c4.subheader('Frame 4')
# c4.table(df4)
# # c4.write(df4)

# ----------- # Table overflow PR
# with st.container():
#     st.markdown("# some really long header " + " ".join(["lol"] * 10))
#     np.random.seed(0)
#     st.table(np.random.randn(10, 20))


# ----------- #4647

# st.file_uploader("File Uploader")


# ----------- #4930


# df1 = pd.DataFrame(data=[[1, 2, 3], [4, 5, 6], [7, 8, 9]], index=[0, 1, 2], columns=['AA', 'BB', 'CC'])
# df4 = (df1 * 111).rename(columns={'AA': 'DD', 'BB': 'EE', 'CC': 'FF'}).copy()
# df5 = (df4 * 111).rename(columns={'DD': 'GG', 'EE': 'HH', 'FF': 'II'}).copy()
# df2 = df1.join(df4) * 1000
# df3 = df4.join(df1) * 11111
# df6 = df3.join(df5) * 11111


# with st.expander("Show Data Sample"):
#     st.table(df6.head(100))

# ----------- #4803


Title_html = """
<style>
.title span {
user-select: none;
font-size: 70px;
color: white;
background: repeating-linear-gradient(-45deg, red 0%, yellow 7.14%, rgb(0,255,0) 14.28%, rgb(0,255,255) 21.4%, cyan 28.56%, blue 35.7%, magenta 42.84%, red 50%);
background-size: 600vw 600vw;
-webkit-text-fill-color: transparent;
-webkit-background-clip: text;
animation: slide 5s linear infinite forwards;
}
@Keyframes slide {
0%{
background-position-x: 0%;
}
100%{
background-position-x: 600vw;
}
}
</style>
<div class="title"> <h1 align="center"> My Title <br><br></h1> </div>
</html>

"""
# st.markdown(Title_html, unsafe_allow_html=True) #Title rendering


# ----------- #4897


# age = st.slider("How old are you?", 0, 130, 25, format="$%dk")
# st.write("I'm ", age, "years old")

# number = st.number_input("Insert a number", value=0, format="$%dk")
# st.write("The current number is ", number)


# ----------- #4775

# st.metric("label", value=20, delta="Going up")
# st.metric("label", value=10, delta="Going down")
# st.metric("label", value=10, delta="-Going down")
