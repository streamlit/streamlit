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
from datetime import date

import pandas as pd

import streamlit as st

with st.container(horizontal=True, border=True, key="layout-horizontal-markdown"):
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")
    st.markdown(
        "Really long test. Reallly long text. Really long text. This is a really long text. This is really long text.",
        width="stretch",
    )
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")
    st.markdown(
        "Really long test. Reallly long text. Really long text.", width="stretch"
    )
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")
    st.markdown(
        "Really long test. Reallly long text. Really long text.", width="stretch"
    )
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")

with st.container(horizontal=True, border=True, key="layout-horizontal-buttons"):
    st.button("A", width="stretch")
    st.button("OK", width="stretch")
    st.button("Submit", width="stretch")
    st.button("Download File", width="stretch")
    st.button(
        "This is a really long button label that should test wrapping", width="stretch"
    )
    st.button("X", width="stretch")

with st.container(horizontal=True, key="layout-horizontal-inputs"):
    st.date_input("Date Range", date(1970, 1, 1))
    st.selectbox("Group by", ["Foo"])
    st.multiselect("Deployment", ["All"], default=["All"])

    st.multiselect(
        "Organization type",
        ["Customer", "Partner"],
        default=["Customer", "Partner"],
    )
    st.multiselect("Account", ["All"], default=["All"])

with st.container(horizontal=True, border=True, key="layout-horizontal-checkboxes"):
    st.checkbox("", width="stretch", key="checkbox1")
    st.checkbox("", width="stretch", key="checkbox2")
    st.checkbox("", width="stretch", key="checkbox3")
    st.checkbox("", width="stretch", key="checkbox4")
    st.checkbox("", width="stretch", key="checkbox5")
    st.checkbox("", width="stretch", key="checkbox6")
    st.checkbox("", width="stretch", key="checkbox7")
    st.checkbox("", width="stretch", key="checkbox8")
    st.checkbox("", width="stretch", key="checkbox9")
    st.checkbox("", width="stretch", key="checkbox10")

with st.container(horizontal=True, border=True, key="layout-horizontal-text-area-info"):
    st.info("Info")
    st.text_area("Notes", height=80, width="stretch")

small_data = pd.DataFrame({"A": [1, 2, 3], "B": [4, 5, 6], "C": [7, 8, 9]})

medium_data = pd.DataFrame(
    {
        "Name": ["Alice", "Bob", "Charlie", "Diana", "Eve"],
        "Age": [25, 30, 35, 28, 32],
        "City": ["New York", "London", "Tokyo", "Paris", "Sydney"],
        "Salary": [50000, 60000, 70000, 55000, 65000],
        "Department": ["Engineering", "Marketing", "Sales", "HR", "Finance"],
    }
)

with st.container(horizontal=True, border=True, key="layout-horizontal-dataframes"):
    st.dataframe(small_data, use_container_width=False)
    st.dataframe(medium_data, use_container_width=False)
    st.dataframe(small_data, use_container_width=True)


with st.container(
    horizontal=True, border=True, key="layout-horizontal-nested-containers"
):
    with st.container(horizontal=True, border=True):
        st.markdown("Hello, how are you? Do you like ice cream?")
    with st.container(horizontal=True, border=True):
        st.markdown("Hello. Goodbye. So long.")
    with st.container(horizontal=True, border=True):
        st.markdown("Hello")
    st.info("(I like ice cream)")

with st.container(horizontal=True, border=True, key="layout-horizontal-columns"):
    col1, col2, col3 = st.columns(3)
    col1.markdown("Hello, how are you? Do you like ice cream?")
    col2.markdown("Hello. Goodbye. So long.")
    col3.markdown("Hello")
    st.info("(I like ice cream)")


with st.container(horizontal=True, border=True, key="layout-horizontal-button-groups"):
    st.segmented_control("Segmented Control", ["Option 1", "Option 2", "Option 3"])
    st.feedback("thumbs", width="stretch")
    st.pills("Priority", ["Low", "Medium", "High"], width="stretch")

with st.container(horizontal=True, border=True, key="layout-horizontal-line-charts"):
    # Create sample data for line charts
    chart_data1 = pd.DataFrame({"x": range(10), "y": [i**2 for i in range(10)]})

    chart_data2 = pd.DataFrame({"x": range(8), "y": [i * 2 + 1 for i in range(8)]})

    chart_data3 = pd.DataFrame({"x": range(12), "y": [abs(i - 6) for i in range(12)]})

    st.line_chart(chart_data1, x="x", y="y", width="content")
    st.line_chart(chart_data2, x="x", y="y", width="stretch")
    st.line_chart(chart_data3, x="x", y="y", width="stretch")
