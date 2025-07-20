
"""
Test script for the select_slider marks feature.
This script demonstrates the new marks parameter functionality.
"""

import streamlit as st

st.title("Select Slider Marks Feature Test")

st.header("Without Marks (Default)")
color = st.select_slider(
    "Select a color of the rainbow",
    options=["red", "orange", "yellow", "green", "blue", "indigo", "violet"],
    value="green",
)
st.write("Selected color:", color)

st.header("With Marks (Single Value)")
color_with_marks = st.select_slider(
    "Select a color of the rainbow (with marks)",
    options=["red", "orange", "yellow", "green", "blue", "indigo", "violet"],
    value="green",
    marks=True,
)
st.write("Selected color:", color_with_marks)

st.header("With Marks (Range)")
start_color, end_color = st.select_slider(
    "Select a range of colors",
    options=["red", "orange", "yellow", "green", "blue", "indigo", "violet"],
    value=("orange", "blue"),
    marks=True,
)
st.write("Selected range:", start_color, "to", end_color)

st.header("Without Marks (Range)")
start_color2, end_color2 = st.select_slider(
    "Select a range of colors (without marks)",
    options=["red", "orange", "yellow", "green", "blue", "indigo", "violet"],
    value=("red", "violet"),
)
st.write("Selected range:", start_color2, "to", end_color2)

st.header("Feature Description")
st.markdown("""
This feature adds visual marks to the select_slider widget to show all possible positions.

**Key Features:**
- **marks=True**: Shows small circular marks at each option position
- **Color coding**: Marks on the left side of the thumb are colored in the primary color
- **Range support**: For range sliders, marks between the thumbs are colored in the primary color
- **Visual feedback**: Makes it easier to see all available options at a glance

**Usage:**
```python
st.select_slider("Label", options=["a", "b", "c"], marks=True)
```
""")
