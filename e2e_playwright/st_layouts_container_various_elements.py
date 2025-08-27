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
import numpy.typing as npt
import pandas as pd

import streamlit as st

img: npt.NDArray[np.int_] = np.repeat(0, 75000).reshape(300, 250)

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
        df = pd.DataFrame(
            {
                "x": list(range(5)),
                "y": [i * i for i in range(5)],
            }
        )
        st.line_chart(df.set_index("x"), width=300)

        with st.container(
            border=False,
            horizontal=False,
        ):
            st.metric(label="Metric", value=156, delta=10, height=100, width=70)
            st.dataframe(df)

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
        st.info("Please fill out the form to continue. We value your input!", width=250)
        st.image(img)

with st.container(
    border=True,
    horizontal=True,
    key="layout-horizontal-expander-dataframe",
):
    df = pd.DataFrame(
        {
            "x": list(range(5)),
            "y": [i * i for i in range(5)],
        }
    )
    with st.expander("Expand me"):
        st.title("Hidden Chart")
        st.bar_chart(df.set_index("x"))

    st.dataframe(df)

with st.container(
    border=True,
    horizontal=True,
    key="layout-horizontal-expander-dataframe-content-width",
):
    df = pd.DataFrame(
        {
            "x": list(range(5)),
            "y": [i * i for i in range(5)],
        }
    )
    with st.expander("Expand me"):
        st.title("Hidden Chart")
        st.bar_chart(df.set_index("x"))

    st.dataframe(df, use_container_width=False)

with st.container(
    border=True,
    horizontal=True,
    key="layout-horizontal-expander-dataframe-content-width-large",
):
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
    with st.expander("Expand me"):
        st.title("Hidden Chart")
        st.bar_chart(df.set_index("x"))

    st.dataframe(df, use_container_width=False)

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

with st.container(border=True, horizontal=False, key="layout-horizontal-columns"):
    st.title("Columns")
    df = pd.DataFrame(
        {
            "x": list(range(5)),
            "y": [i * i for i in range(5)],
        }
    )
    with st.container(border=False, horizontal=True):
        col1, col2 = st.columns(2)
        with col1:
            with st.container(
                border=False,
                horizontal=True,
            ):
                st.info("Very important information", width=150)
                st.dataframe(df, use_container_width=False)

        with col2:
            st.dataframe(df, use_container_width=True)

with st.container(border=True, horizontal=True, key="layout-horizontal-tabs"):
    import altair as alt

    st.title("Tabs", width=150)
    df = pd.DataFrame(
        {
            "x": list(range(5)),
            "y": [i * i for i in range(5)],
        }
    )
    tab1, tab2 = st.tabs(["Tab 1", "Tab 2"])
    with tab1:
        with st.container(
            border=False,
            horizontal=True,
        ):
            st.info("This is a tab")
            st.dataframe(df)
    with tab2:
        with st.container(
            border=False,
            horizontal=False,
        ):
            st.altair_chart(alt.Chart(df).mark_bar().encode(x="x", y="y"))
            st.warning("This is a warning")

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

with st.container(border=True, horizontal=True, key="layout-horizontal-content-width"):
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

with st.container(horizontal=True, height=300, key="layout-horizontal-text-area"):
    st.text_area("Hello", width="stretch", height="stretch")
    st.text_area("Hello", width="stretch")
    st.container(border=True, width="stretch")
