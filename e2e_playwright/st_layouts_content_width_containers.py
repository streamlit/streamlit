# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import pandas as pd

import streamlit as st

with st.container(width="content", border=True):
    st.divider(width="stretch")

with st.container(width="content", border=True):
    st.write("---")

with st.container(width="content", border=True):
    st.markdown("---")

with st.container(width="content", border=True):
    st.slider("", min_value=0, max_value=100, width="stretch")

with st.container(width="content", border=True):
    st.selectbox("", ["a", "b", "c"], width="stretch")

with st.container(width="content", border=True):
    st.dataframe(pd.DataFrame({"a": [1, 2, 3]}))

with st.container(width="content", border=True):
    st.data_editor(pd.DataFrame({"a": [1, 2, 3]}))

with st.container(width="content", border=True):
    st.table(
        pd.DataFrame({"apples": [1, 2, 3], "oranges": [4, 5, 6], "bananas": [7, 8, 9]})
    )

with st.container(width="content", border=True):
    st.area_chart(pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]}))

with st.container(width="content", border=True):
    st.bar_chart(pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]}))

with st.container(width="content", border=True):
    st.line_chart(pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]}))

with st.container(width="content", border=True):
    st.scatter_chart(pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]}))

with st.container(width="content", border=True):
    map_data = pd.DataFrame(
        {"lat": [37.7749, 37.7833, 37.7749], "lon": [-122.4194, -122.4167, -122.4194]}
    )
    st.map(map_data)

with st.container(width="content", border=True):
    import pydeck as pdk

    # Sample data for pydeck chart - simple scatter plot
    pydeck_data = pd.DataFrame(
        {
            "lat": [37.7749, 37.7833, 37.7749],
            "lon": [-122.4194, -122.4167, -122.4194],
            "value": [1, 2, 3],
        }
    )

    # Create a PyDeck chart configuration
    layer = pdk.Layer(
        "ScatterplotLayer",
        data=pydeck_data,
        get_position=["lon", "lat"],
        get_radius="value * 100",
        get_fill_color=[255, 0, 0],
        pickable=True,
    )

    view_state = pdk.ViewState(
        latitude=37.7749,
        longitude=-122.4194,
        zoom=11,
    )

    chart = pdk.Deck(
        layers=[layer],
        initial_view_state=view_state,
    )
    st.pydeck_chart(chart)

with st.container(width="content", border=True):
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots()
    ax.plot([1, 2, 3], [4, 5, 6])
    st.pyplot(fig)

with st.container(width="content", border=True):
    # Sample image from Streamlit's website
    st.image(
        "https://streamlit.io/images/brand/streamlit-mark-color.png",
        width=200,
    )

with st.container(width="content", border=True):
    # List of sample images
    images = [
        "https://streamlit.io/images/brand/streamlit-mark-color.png",
        "https://streamlit.io/images/brand/streamlit-logo-primary-colormark-darktext.png",
        "https://streamlit.io/images/brand/streamlit-logo-secondary-colormark-darktext.png",
    ]

    for image_url in images:
        st.image(image_url, width=200)

with st.container(width="content", border=True):
    import altair as alt

    # Sample data for Altair chart
    data = pd.DataFrame(
        {
            "x": [1, 2, 3, 4, 5],
            "y": [2, 4, 6, 8, 10],
            "category": ["A", "B", "A", "B", "A"],
        }
    )

    # Create Altair chart
    chart = alt.Chart(data).mark_line().encode(x="x", y="y", color="category")
    st.altair_chart(chart)

with st.container(width="content", border=True):
    # Sample data for Vega-Lite chart
    data = pd.DataFrame(
        {
            "x": [1, 2, 3, 4, 5],
            "y": [2, 4, 6, 8, 10],
            "category": ["A", "B", "A", "B", "A"],
        }
    )

    # Create Vega-Lite chart specification
    vega_lite_spec = {
        "mark": "bar",
        "encoding": {
            "x": {"field": "x", "type": "quantitative"},
            "y": {"field": "y", "type": "quantitative"},
            "color": {"field": "category", "type": "nominal"},
        },
    }
    st.vega_lite_chart(data, vega_lite_spec)

with st.container(width="content", border=True):
    from bokeh.plotting import figure

    # Create a Bokeh figure
    p = figure(title="Simple Bokeh Line Chart", x_axis_label="x", y_axis_label="y")
    p.line([1, 2, 3, 4, 5], [2, 4, 6, 8, 10], line_width=2)
    st.bokeh_chart(p)

with st.container(width="content", border=True):
    import plotly.express as px

    # Create a Plotly figure
    fig = px.scatter(
        data_frame=pd.DataFrame(
            {
                "x": [1, 2, 3, 4, 5],
                "y": [2, 4, 6, 8, 10],
                "category": ["A", "B", "A", "B", "A"],
            }
        ),
        x="x",
        y="y",
        color="category",
        title="Plotly Scatter Plot",
    )
    st.plotly_chart(fig)

with st.container(width="content", border=True):
    import graphviz

    # Create a simple directed graph
    dot = graphviz.Digraph(comment="Simple Graph")
    dot.attr(rankdir="LR")
    dot.node("A", "Node A")
    dot.node("B", "Node B")
    dot.node("C", "Node C")
    dot.edge("A", "B")
    dot.edge("B", "C")
    dot.edge("C", "A")
    st.graphviz_chart(dot)

# Button containers
with st.container(width="content", border=True):
    st.button("Regular Button", type="primary")
    st.download_button("Download CSV", data="a,b,c\n1,2,3", file_name="sample.csv")
    st.link_button("Visit Streamlit", "https://streamlit.io")

# Form elements
with st.container(width="content", border=True):
    with st.form("my_form"):
        st.form_submit_button("Submit Form")
        st.text_input("Username")
        st.text_area("Comments", height=100)
        st.number_input("Age", min_value=0, max_value=120)
        st.date_input("Birth Date")
        st.time_input("Appointment Time")

# Selection widgets
with st.container(width="content", border=True):
    st.checkbox("Accept terms")
    st.toggle("Enable feature")
    st.multiselect("Select colors", ["Red", "Green", "Blue"])
    st.selectbox("Choose a fruit", ["Apple", "Banana", "Orange"])
    st.radio("Select size", ["Small", "Medium", "Large"])
    st.pills("Select category", ["A", "B", "C"])
    st.segmented_control("Choose option", ["Option 1", "Option 2", "Option 3"])

# Slider containers
with st.container(width="content", border=True):
    st.slider("Select range", 0, 100, (25, 75))

with st.container(width="content", border=True):
    st.select_slider("Select value", options=["Poor", "Fair", "Good", "Excellent"])

# Input widgets
with st.container(width="content", border=True):
    st.text_input("Enter name")

with st.container(width="content", border=True):
    st.text_area("Enter description", height=100)

with st.container(width="content", border=True):
    st.color_picker("Pick a color")

# Media input containers
with st.container(width="content", border=True):
    st.audio_input("Record audio")

with st.container(width="content", border=True):
    st.file_uploader("Upload file", type=["txt", "csv", "pdf"])

with st.container(width="content", border=True):
    st.camera_input("Take a photo")

# Chat elements
with st.container(width="content", border=True):
    st.chat_input("Type a message...")
    with st.chat_message("user"):
        st.write("Hello! 👋")
    with st.chat_message("assistant"):
        st.write("Hi there! How can I help you?")

# Status and progress
with st.container(width="content", border=True):
    with st.status("Processing...", expanded=True):
        st.write("Step 1: Loading data...")
        st.write("Step 2: Processing...")
        st.write("Step 3: Complete!")

with st.container(width="content", border=True):
    st.progress(0.75, text="75% Complete")

# Spinner and toast
with st.container(width="content", border=True):
    with st.spinner("Loading..."):
        st.write("This content is loading...")

with st.container(width="content", border=True):
    st.toast("🎉 New update available!", icon="🎉")

# Alert messages
with st.container(width="content", border=True):
    st.success("Operation completed successfully!")
    st.info("Here's some useful information.")
    st.warning("Please be careful with this action.")
    st.error("An error occurred during processing.")
    try:
        raise Exception("This is a test exception")
    except Exception as e:
        st.exception(e)

# Expander and popover
with st.container(width="content", border=True):
    with st.expander("Click to expand"):
        st.write("This is the expanded content.")
        st.write("You can put any Streamlit elements here.")

with st.container(width="content", border=True):
    with st.popover("Click for more info"):
        st.write("This is a popover with additional information.")
        st.button("Action Button")

# Media elements
with st.container(width="content", border=True):
    st.audio("https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav")

with st.container(width="content", border=True):
    st.video("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

# Columns
with st.container(width="content", border=True):
    col1, col2, col3 = st.columns(3)
    with col1:
        st.write("Column 1")
        st.button("Button 1")
    with col2:
        st.write("Column 2")
        st.button("Button 2")
    with col3:
        st.write("Column 3")
        st.button("Button 3")


# Fragment example
@st.fragment
def render_fragment():
    st.write("This content is rendered by a fragment")
    st.button("Fragment Button")
    st.slider("Fragment Slider", 0, 100, 50)


with st.container(width="content", border=True):
    render_fragment()

# Iframe container
with st.container(width="content", border=True):
    import streamlit.components.v1 as components

    components.iframe(
        "https://docs.streamlit.io",
        height=400,
        scrolling=True,
    )
