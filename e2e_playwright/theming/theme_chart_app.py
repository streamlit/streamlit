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


import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(7)


def run_chart_tester_app():
    st.set_page_config(initial_sidebar_state="collapsed", layout="wide")

    st.header("Custom Themed :blue[App]")

    def page1():
        pass

    def page2():
        pass

    st.navigation(
        [
            st.Page(page1, title="Page 1", icon=":material/home:"),
            st.Page(page2, title="Page 2", icon=":material/settings:"),
        ]
    )

    col1, col2 = st.columns(2)

    data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])

    with col1:
        st.write("st.area_chart")
        st.area_chart(data, x_label="x label", y_label="y label")
        st.write("st.bar_chart")
        st.bar_chart(
            data,
            x_label="x label",
            y_label="y label",
        )

    with col2:
        st.write("st.line_chart")
        st.line_chart(data, x_label="x label", y_label="y label")
        st.write("st.scatter_chart")
        st.scatter_chart(data, x_label="x label", y_label="y label")
