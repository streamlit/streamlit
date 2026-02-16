import streamlit as st

# We set a wide layout so the sliders have room
st.set_page_config(layout="wide")

st.header("Vertical Slider Test")

col1, col2, col3 = st.columns(3)

with col1:
    st.write("Horizontal (Default)")
    st.slider(
        "Horizontal Slider",
        min_value=0,
        max_value=100,
        value=50,
        key="horizontal_slider"
    )

with col2:
    st.write("Vertical Slider")
    # This uses your new feature!
    st.slider(
        "Vertical Slider",
        min_value=0,
        max_value=100,
        value=50,
        orientation="vertical",
        key="vertical_slider"
    )

with col3:
    st.write("Vertical Range")
    st.slider(
        "Vertical Range",
        min_value=0.0,
        max_value=1.0,
        value=(0.25, 0.75),
        orientation="vertical",
        key="vertical_range"
    )
