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

import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

import streamlit as st

np.random.seed(0)


st.subheader("st.write(Image)")

st.write(Image.new("L", (10, 10), "black"))


st.subheader("st.write(matplotlib)")

fig, ax = plt.subplots()
ax.hist(np.random.normal(1, 1, size=100), bins=20)

st.write(fig)
