# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import time

import numpy as np

import streamlit as st
from streamlit.hello.utils import show_code


def plotting_demo() -> None:
    progress_bar = st.sidebar.progress(0)
    status_text = st.sidebar.empty()
    chart = st.empty()

    # Initialize with one data point
    data = np.random.randn(1, 1)  # noqa: NPY002
    chart.line_chart(data)

    for i in range(1, 51):
        # Generate new rows based on the last value (random walk)
        new_rows = data[-1, :] + np.random.randn(5, 1).cumsum(axis=0)  # noqa: NPY002
        # Append new rows to existing data
        data = np.concatenate([data, new_rows])
        # Update the chart with full data
        chart.line_chart(data)
        # Scale progress to show 0-100% with 50 iterations
        progress = i * 2
        status_text.text(f"{progress}% complete")
        progress_bar.progress(progress)
        time.sleep(0.01)

    progress_bar.empty()

    # Streamlit widgets automatically run the script from top to bottom. Since
    # this button is not connected to any other logic, it just causes a plain
    # rerun.
    st.button("Rerun")


st.set_page_config(page_title="Plotting demo", page_icon=":material/show_chart:")
st.title("Plotting demo")
st.write(
    """
    This demo illustrates a combination of plotting and animation with
    Streamlit. We're generating a bunch of random numbers in a loop. Enjoy!
    """
)
plotting_demo()
show_code(plotting_demo)
