import altair as alt
import numpy as np
import pandas as pd

import streamlit as st

# Add 10 sidebar widgets, each with 1000 different options.
for i in range(10):
    st.sidebar.selectbox(
        f"Widget {i}",
        [f"Option {j}" for j in range(1000)],
    )

# Generate sample data
n_points = 8000
data = pd.DataFrame(
    {
        "x": np.random.randn(n_points),
        "y": np.random.randn(n_points),
        "category": np.random.choice(["A", "B", "C"], n_points),
    }
)

# Line chart
lines = (
    alt.Chart(data)
    .mark_line()
    .encode(
        x=alt.X("x:Q"),
        y=alt.Y("y:Q"),
        color=alt.Color("category:N"),
    )
)

# 10 text overlay labels
labels = (
    alt.Chart(data.head(10))
    .mark_text()
    .encode(
        x=alt.X("x:Q"),
        y=alt.Y("y:Q"),
        text=alt.Text("category:N"),
    )
)

st.altair_chart(lines + labels, use_container_width=True)

st.button("rerun")
