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

import altair as alt
import numpy as np
import pandas as pd
import plotly.express as px

import streamlit as st


def run_chart_tester_app():
    # Better show the charts by minimizing the dead space
    st.html("""
        <style>
            .stMainBlockContainer {
                padding-top: 4rem;
            }
        </style>
    """)

    st.set_page_config(initial_sidebar_state="collapsed", layout="wide")

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

    # Set seed for reproducible data in E2E testing
    np.random.seed(7)
    data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])

    with col1:
        st.write("**st.line_chart**")
        st.line_chart(
            data, x_label="x label", y_label="y label", use_container_width=True
        )
        st.sidebar.line_chart(
            data, x_label="x label", y_label="y label", use_container_width=True
        )

        st.write("**st.plotly_chart**")
        categorical_data = pd.DataFrame(
            {
                "sales": [120, 95, 150, 110, 135, 88, 175, 92, 148, 103],
                "category": [
                    "Electronics",
                    "Clothing",
                    "Books",
                    "Home",
                    "Sports",
                    "Automotive",
                    "Beauty",
                    "Toys",
                    "Garden",
                    "Kitchen",
                ],
            }
        )

        fig_categorical = px.bar(
            categorical_data, x="category", y="sales", color="category", height=350
        )
        st.plotly_chart(fig_categorical)

    with col2:
        st.write("**st.altair_chart**")
        scatter_data = pd.DataFrame(
            {
                "x": np.random.randn(50),
                "y": np.random.randn(50),
                "category": np.random.choice(["1", "2", "3"], 50),
            }
        )

        altair_chart = (
            alt.Chart(scatter_data)
            .mark_circle(size=60)
            .encode(
                x="x:Q",
                y="y:Q",
                color=alt.Color("category:N", legend=alt.Legend(orient="bottom")),
            )
        )
        st.altair_chart(altair_chart, use_container_width=True)

        st.write("**st.vega_lite_chart**")
        categorical_data = pd.DataFrame(
            {
                "category": ["A", "B", "C", "A", "B", "C"] * 5,
                "value": np.random.randint(10, 100, 30),
                "x": list(range(30)),
            }
        )

        vega_spec = {
            "mark": "bar",
            "encoding": {
                "x": {
                    "field": "x",
                    "type": "quantitative",
                    "scale": {"domain": [0, 30]},
                },
                "y": {"field": "value", "type": "quantitative"},
                "color": {
                    "field": "category",
                    "type": "nominal",
                    "legend": {"orient": "bottom"},
                },
            },
        }
        st.vega_lite_chart(categorical_data, vega_spec, use_container_width=True)
