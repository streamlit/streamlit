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

import numpy as np
from matplotlib import pyplot

import streamlit as st

st.set_page_config(layout="wide")
# Change default plot height, so they fit in cypress canvas.
pyplot.rcParams["figure.figsize"] = [6.4, 4.8 / 2]

np.random.seed(0xDEADBEEF)
data = np.random.normal(1, 1, size=100)
plot = pyplot.plot(data)
st.pyplot()
pyplot.clf()

st.set_option("deprecation.showPyplotGlobalUse", False)
plot = pyplot.plot(data)
st.pyplot()
st.set_option("deprecation.showPyplotGlobalUse", True)

fig, ax = pyplot.subplots()

# Resize plot. It is now 4 times smaller than the default value.
fig.set_size_inches(6.4 / 4, 4.8 / 4)
ax.plot(data)
st.pyplot(fig)
st.pyplot(fig, use_container_width=False)
