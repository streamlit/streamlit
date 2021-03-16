# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import numpy as np
import streamlit as st
from plotly import figure_factory

# Explicitly seed the RNG for deterministic results
np.random.seed(0)

# Add histogram data
x1 = np.random.randn(200) - 2
x2 = np.random.randn(200)
x3 = np.random.randn(200) + 2

# Group data together
hist_data = [x1, x2, x3]
group_labels = ["Group 1", "Group 2", "Group 3"]
bin_size = [0.1, 0.25, 0.5]

# Create distribution plot with custom bin_size
chart = figure_factory.create_distplot(hist_data, group_labels, bin_size)

# Plot!
st.plotly_chart(chart)
