import numpy as np
import streamlit as st
from plotly import figure_factory

# Explicitly seed the RNG for deterministic results
np.random.seed(0)

# Add histogram data
x1: "np.typing.NDArray[np.float_]" = np.random.randn(200) - 2
x2: "np.typing.NDArray[np.float_]" = np.random.randn(200)
x3: "np.typing.NDArray[np.float_]" = np.random.randn(200) + 2

# Group data together
hist_data = [x1, x2, x3]
group_labels = ["Group 1", "Group 2", "Group 3"]
bin_size = [0.1, 0.25, 0.5]

# Create distribution plot with custom bin_size
chart = figure_factory.create_distplot(hist_data, group_labels, bin_size)

# Plot!
st.plotly_chart(chart)
