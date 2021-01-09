# Copyright 2018-2020 Streamlit Inc.
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

import streamlit as st
from datetime import datetime
from datetime import time
import numpy as np
from numpy.random import randn
from plotly import figure_factory
import pandas as pd


def get_plotly_chart():
    # Add histogram data
    x1 = randn(200) - 2
    x2 = randn(200)
    x3 = randn(200) + 2

    # Group data together
    hist_data = [x1, x2, x3]
    group_labels = ["Group 1", "Group 2", "Group 3"]
    bin_size = [0.1, 0.25, 0.5]

    # Create distribution plot with custom bin_size
    return figure_factory.create_distplot(hist_data, group_labels, bin_size)


st.button("some button", help="tooltip")
st.checkbox("some checkbox", help="tooltip")
st.number_input("number input", value=1, help="tooltip")
st.radio("some radio", ("a", "b", "c"), 0, help="tooltip")
st.selectbox("selectbox", ("a", "b", "c"), 0, help="tooltip")
st.text_input("some input text", "default text", help="tooltip")
st.time_input("time", datetime(2019, 7, 6, 21, 15), help="tooltip")
st.date_input("date", datetime(2019, 7, 6, 21, 15), help="tooltip")
st.write("here is some text", help="tooltip")
st.markdown("here is some text", help="tooltip")
st.header("some header", help="tooltip")
st.subheader("some subheader", help="tooltip")
st.code("import streamlit as st", language="python", help="tooltip")
st.latex(r"\LaTeX", help="tooltip")
st.image(np.repeat(0, 10000).reshape(100, 100), help="tooltip")
st.line_chart(pd.DataFrame(randn(20, 3), columns=["a", "b", "c"]), help="tooltip")
st.plotly_chart(get_plotly_chart())