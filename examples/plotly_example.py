# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import streamlit as st
import plotly.graph_objs as go
import numpy as np

st.title("Plotly examples")

st.header("Chart with two lines")

trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
trace1 = go.Scatter(x=[1, 2, 3, 4], y=[16, 5, 11, 9])
data = [trace0, trace1]
st.write(data)


###

st.header("Matplotlib chart in Plotly")

import matplotlib.pyplot as plt

f = plt.figure()
arr = np.random.normal(1, 1, size=100)
plt.hist(arr, bins=20)

st.plotly_chart(f)


###

st.header("3D plot")

x, y, z = np.random.multivariate_normal(np.array([0, 0, 0]), np.eye(3), 400).transpose()

trace1 = go.Scatter3d(
    x=x,
    y=y,
    z=z,
    mode="markers",
    marker=dict(
        size=12,
        color=z,  # set color to an array/list of desired values
        colorscale="Viridis",  # choose a colorscale
        opacity=0.8,
    ),
)

data = [trace1]
layout = go.Layout(margin=dict(l=0, r=0, b=0, t=0))
fig = go.Figure(data=data, layout=layout)

st.write(fig)


###

st.header("Fancy density plot")

import plotly.figure_factory as ff

import numpy as np

# Add histogram data
x1 = np.random.randn(200) - 2
x2 = np.random.randn(200)
x3 = np.random.randn(200) + 2

# Group data together
hist_data = [x1, x2, x3]

group_labels = ["Group 1", "Group 2", "Group 3"]

# Create distplot with custom bin_size
fig = ff.create_distplot(hist_data, group_labels, bin_size=[0.1, 0.25, 0.5])

# Plot!
st.plotly_chart(fig)
