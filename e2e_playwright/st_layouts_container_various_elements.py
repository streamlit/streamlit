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

import pandas as pd

import streamlit as st

with st.container(
    border=False,
    direction="vertical",
    wrap=False,
    key="layout-dashboard-example",
):
    st.title("Q3 Results")
    st.subheader("Sales Performance")
    with st.container(
        border=True,
        direction="horizontal",
        wrap=False,
    ):
        df = pd.DataFrame(
            {
                "x": list(range(5)),
                "y": [i * i for i in range(5)],
            }
        )
        st.line_chart(df.set_index("x"))

        with st.container(
            border=False,
            direction="vertical",
            wrap=False,
        ):
            st.metric(label="Metric", value=156, delta=10, height=100, width=70)
            st.dataframe(df)

with st.container(
    border=True,
    direction="horizontal",
    wrap=False,
    key="layout-horizontal-form",
):
    with st.form("Form", width=400):
        st.text_input("Name")
        st.number_input("Age")
        st.selectbox("Gender", ["Male", "Female"])
        st.text_area("Message")
        st.form_submit_button("Submit")

    with st.container(border=False, direction="vertical"):
        st.info("Please fill out the form to continue. We value your input!", width=250)
        st.image("https://placehold.co/250x300")

with st.container(
    border=True,
    direction="horizontal",
    wrap=False,
    key="layout-horizontal-expander-dataframe",
):
    df = pd.DataFrame(
        {
            "x": list(range(5)),
            "y": [i * i for i in range(5)],
        }
    )
    with st.expander("Expand me", key="container-various-expander"):
        st.title("Hidden Chart")
        st.bar_chart(df.set_index("x"))

    st.dataframe(df)

with st.container(
    border=True,
    direction="horizontal",
    wrap=False,
    gap=None,
    horizontal_alignment="center",
    key="layout-horizontal-images-center",
):
    st.image("https://images.unsplash.com/photo-1506744038136-46273834b3fb", width=100)
    st.image("https://images.unsplash.com/photo-1519125323398-675f0ddb6308", width=100)
    st.image("https://images.unsplash.com/photo-1506744038136-46273834b3fb", width=100)

with st.container(
    border=True,
    direction="horizontal",
    wrap=False,
    horizontal_alignment="distribute",
    vertical_alignment="center",
    key="layout-horizontal-images-distribute",
):
    st.image("https://images.unsplash.com/photo-1506744038136-46273834b3fb", width=200)
    st.image("https://images.unsplash.com/photo-1519125323398-675f0ddb6308", width=50)
    st.image("https://images.unsplash.com/photo-1506744038136-46273834b3fb", width=300)

with st.container(border=True, direction="horizontal", key="layout-horizontal-columns"):
    st.title("Columns")
    df = pd.DataFrame(
        {
            "x": list(range(5)),
            "y": [i * i for i in range(5)],
        }
    )
    col1, col2 = st.columns(2)
    with col1:
        with st.container(
            border=False,
            direction="horizontal",
            wrap=False,
        ):
            st.info("Very important information")
            st.dataframe(df)

    with col2:
        st.dataframe(df)

with st.container(border=True, direction="horizontal", key="layout-horizontal-tabs"):
    import altair as alt

    st.title("Tabs")
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
            direction="horizontal",
            wrap=False,
        ):
            st.info("This is a tab")
            st.dataframe(df)
    with tab2:
        with st.container(
            border=False,
            direction="vertical",
        ):
            st.altair_chart(alt.Chart(df).mark_bar().encode(x="x", y="y"))
            st.warning("This is a warning")

with st.container(
    border=True,
    direction="horizontal",
    wrap=False,
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
