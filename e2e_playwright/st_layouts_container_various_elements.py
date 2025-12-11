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

from __future__ import annotations

import numpy as np
import numpy.typing as npt
import pandas as pd

import streamlit as st

# Common data used across multiple cases
img: npt.NDArray[np.int64] = np.repeat(0, 75000).reshape(300, 250)
small_data = pd.DataFrame(
    {
        "x": list(range(5)),
        "y": [i * i for i in range(5)],
    }
)

CONTAINER_CASES = [
    "layout-dashboard-example",
    "layout-horizontal-form",
    "layout-horizontal-expander-dataframe",
    "layout-horizontal-expander-dataframe-content-width",
    "layout-horizontal-expander-dataframe-content-width-large",
    "layout-horizontal-images-center",
    "layout-horizontal-images-distribute",
    "layout-horizontal-columns",
    "layout-horizontal-tabs",
    "layout-horizontal-map",
    "layout-horizontal-content-width",
    "layout-horizontal-text-area",
    "layout-vertical-stretch-height",
    "layout-vertical-content-width-container-with-various-elements",
    "layout-vertical-content-width-container-with-stretch-width-dataframes",
    "layout-vertical-content-width-container-with-content-width-dataframes",
    "layout-horizontal-content-width-container-with-metrics-dataframes-line-charts",
    "layout-vertical-content-width-container-with-map",
    "narrow-fixed-width-container-with-dataframe",
]

selected_case = st.selectbox("Select container case", CONTAINER_CASES, index=None)

if selected_case == "layout-dashboard-example":
    with st.container(
        border=False,
        horizontal=False,
        key="layout-dashboard-example",
    ):
        st.title("Q3 Results")
        st.subheader("Sales Performance")
        with st.container(
            border=True,
            horizontal=True,
        ):
            st.line_chart(small_data.set_index("x"), width=300)

            with st.container(
                border=False,
                horizontal=False,
            ):
                st.metric(label="Metric", value=156, delta=10, height=100, width=70)
                st.dataframe(small_data)

elif selected_case == "layout-horizontal-form":
    with st.container(
        border=True,
        horizontal=True,
        key="layout-horizontal-form",
    ):
        with st.form("Form", width=400):
            st.text_input("Name")
            st.number_input("Age")
            st.selectbox("Gender", ["Male", "Female"])
            st.text_area("Message")
            st.form_submit_button("Submit")

        with st.container(border=False, horizontal=False):
            st.info(
                "Please fill out the form to continue. We value your input!", width=250
            )
            st.image(img)

elif selected_case == "layout-horizontal-expander-dataframe":
    with st.container(
        border=True,
        horizontal=True,
        key="layout-horizontal-expander-dataframe",
    ):
        with st.expander("Expand me"):
            st.title("Hidden Chart")
            st.bar_chart(small_data.set_index("x"))

        st.dataframe(small_data)

elif selected_case == "layout-horizontal-expander-dataframe-content-width":
    with st.container(
        border=True,
        horizontal=True,
        key="layout-horizontal-expander-dataframe-content-width",
    ):
        with st.expander("Expand me"):
            st.title("Hidden Chart")
            st.bar_chart(small_data.set_index("x"))

        st.dataframe(small_data, width="content")

elif selected_case == "layout-horizontal-expander-dataframe-content-width-large":
    df = pd.DataFrame(
        {
            "x": list(range(5)),
            "y": [i * i for i in range(5)],
            "z": [i * i * i for i in range(5)],
            "w": [i * i * i * i for i in range(5)],
            "v": [i * i * i * i * i for i in range(5)],
            "u": [i * i * i * i * i * i for i in range(5)],
            "t": [i * i * i * i * i * i * i for i in range(5)],
            "s": [i * i * i * i * i * i * i * i for i in range(5)],
            "r": [i * i * i * i * i * i * i * i * i for i in range(5)],
            "q": [i * i * i * i * i * i * i * i * i * i for i in range(5)],
            "p": [i * i * i * i * i * i * i * i * i * i * i for i in range(5)],
            "o": [i * i * i * i * i * i * i * i * i * i * i * i for i in range(5)],
        }
    )
    with st.container(
        border=True,
        horizontal=True,
        key="layout-horizontal-expander-dataframe-content-width-large",
    ):
        with st.expander("Expand me"):
            st.title("Hidden Chart")
            st.bar_chart(df.set_index("x"))

        st.dataframe(df, width="content")

elif selected_case == "layout-horizontal-images-center":
    with st.container(
        border=True,
        horizontal=True,
        gap=None,
        horizontal_alignment="center",
        key="layout-horizontal-images-center",
    ):
        st.image(img, width=100)
        st.image(img, width=100)
        st.image(img, width=100)

elif selected_case == "layout-horizontal-images-distribute":
    with st.container(
        border=True,
        horizontal=True,
        horizontal_alignment="distribute",
        vertical_alignment="center",
        key="layout-horizontal-images-distribute",
    ):
        st.image(img, width=200)
        st.image(img, width=50)
        st.image(img)

elif selected_case == "layout-horizontal-columns":
    with st.container(border=True, horizontal=False, key="layout-horizontal-columns"):
        st.title("Columns")
        with st.container(border=False, horizontal=True):
            col1, col2 = st.columns(2)
            with col1:
                with st.container(
                    border=False,
                    horizontal=True,
                ):
                    st.info("Very important information", width=150)
                    st.dataframe(small_data, width="content")

            with col2:
                st.dataframe(small_data, width="stretch")

elif selected_case == "layout-horizontal-tabs":
    import altair as alt

    with st.container(border=True, horizontal=True, key="layout-horizontal-tabs"):
        st.title("Tabs", width=150)
        tab1, tab2 = st.tabs(["Tab 1", "Tab 2"])
        with tab1:
            with st.container(
                border=False,
                horizontal=True,
            ):
                st.info("This is a tab")
                st.dataframe(small_data)
        with tab2:
            with st.container(
                border=False,
                horizontal=False,
            ):
                st.altair_chart(alt.Chart(small_data).mark_bar().encode(x="x", y="y"))
                st.warning("This is a warning")

elif selected_case == "layout-horizontal-map":
    with st.container(
        border=True,
        horizontal=True,
        key="layout-horizontal-map",
    ):
        st.map(pd.DataFrame({"lat": [37.76, 37.77], "lon": [-122.4, -122.41]}))
        st.markdown(
            """
        # Hello
        ## Hello
        ### Hello
        #### Hello
        ##### Hello
        ###### Hello
        """,
            width="content",
        )

elif selected_case == "layout-horizontal-content-width":
    with st.container(
        border=True, horizontal=True, key="layout-horizontal-content-width"
    ):
        st.markdown(
            """
        # Hello beautiful
        ## Hello beautiful
        ### Hello beautiful
        #### Hello beautiful
        ###### Hello beautiful
        """,
            width="content",
        )

        st.markdown(
            """
        # Hello
        ## Hello
        ### Hello
        #### Hello
        ###### Hello
        """,
            width="content",
        )

elif selected_case == "layout-horizontal-text-area":
    with st.container(horizontal=True, height=300, key="layout-horizontal-text-area"):
        st.text_area("Hello", width="stretch", height="stretch")
        st.text_area("Hello", width="stretch")
        st.container(border=True, width="stretch")

elif selected_case == "layout-vertical-stretch-height":
    with st.container(key="layout-vertical-stretch-height", border=True, height=400):
        df = pd.DataFrame(
            {
                "x": list(range(5)),
                "y": [i * i for i in range(5)],
            }
        )
        st.dataframe(df, height="stretch")
        st.dataframe(df, height="stretch")
        st.markdown("Hello")

elif selected_case == "layout-vertical-content-width-container-with-various-elements":
    with st.container(
        width="content",
        border=True,
        key="layout-vertical-content-width-container-with-various-elements",
        horizontal_alignment="center",
    ):
        st.line_chart(small_data, width="content")
        st.markdown("Growth in the last 3 months", width="content")

elif (
    selected_case
    == "layout-vertical-content-width-container-with-stretch-width-dataframes"
):
    medium_data = pd.DataFrame(
        {
            "Name": ["Alice", "Bob", "Charlie", "Diana", "Eve"],
            "Age": [25, 30, 35, 28, 32],
            "City": ["New York", "London", "Tokyo", "Paris", "Sydney"],
            "Salary": [50000, 60000, 70000, 55000, 65000],
            "Department": ["Engineering", "Marketing", "Sales", "HR", "Finance"],
        }
    )
    with st.container(
        width="content",
        border=True,
        key="layout-vertical-content-width-container-with-stretch-width-dataframes",
    ):
        st.dataframe(small_data, width="stretch")
        st.dataframe(medium_data, width="stretch")

elif (
    selected_case
    == "layout-vertical-content-width-container-with-content-width-dataframes"
):
    medium_data = pd.DataFrame(
        {
            "Name": ["Alice", "Bob", "Charlie", "Diana", "Eve"],
            "Age": [25, 30, 35, 28, 32],
            "City": ["New York", "London", "Tokyo", "Paris", "Sydney"],
            "Salary": [50000, 60000, 70000, 55000, 65000],
            "Department": ["Engineering", "Marketing", "Sales", "HR", "Finance"],
        }
    )
    with st.container(
        width="content",
        border=True,
        key="layout-vertical-content-width-container-with-content-width-dataframes",
    ):
        st.dataframe(small_data, width="content")
        st.dataframe(medium_data, width="content")

elif (
    selected_case
    == "layout-horizontal-content-width-container-with-metrics-dataframes-line-charts"
):
    medium_data = pd.DataFrame(
        {
            "Name": ["Alice", "Bob", "Charlie", "Diana", "Eve"],
            "Age": [25, 30, 35, 28, 32],
            "City": ["New York", "London", "Tokyo", "Paris", "Sydney"],
            "Salary": [50000, 60000, 70000, 55000, 65000],
            "Department": ["Engineering", "Marketing", "Sales", "HR", "Finance"],
        }
    )
    chart_data1 = pd.DataFrame({"x": range(10), "y": [i**2 for i in range(10)]})
    with st.container(
        width=700,
        key="layout-horizontal-content-width-container-with-metrics-dataframes-line-charts",
    ):
        with st.container(
            horizontal=True,
            width="content",
            border=True,
            gap="medium",
        ):
            st.metric("Metric", "100", width="stretch")
            st.dataframe(medium_data, width="stretch")
            st.line_chart(chart_data1, width="stretch")

elif selected_case == "layout-vertical-content-width-container-with-map":
    with st.container(
        width="content",
        border=True,
        key="layout-vertical-content-width-container-with-map",
    ):
        map_data = pd.DataFrame(
            {
                "lat": [37.7749, 37.8044, 37.7599],
                "lon": [-122.4194, -122.2712, -122.4148],
            }
        )
        st.map(map_data, width="stretch")

elif selected_case == "narrow-fixed-width-container-with-dataframe":
    medium_data = pd.DataFrame(
        {
            "Name": ["Alice", "Bob", "Charlie", "Diana", "Eve"],
            "Age": [25, 30, 35, 28, 32],
            "City": ["New York", "London", "Tokyo", "Paris", "Sydney"],
            "Salary": [50000, 60000, 70000, 55000, 65000],
            "Department": ["Engineering", "Marketing", "Sales", "HR", "Finance"],
        }
    )
    with st.container(
        width=100, border=True, key="narrow-fixed-width-container-with-dataframe"
    ):
        st.dataframe(medium_data, width="stretch")
