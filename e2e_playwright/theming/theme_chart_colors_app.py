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

import altair as alt
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.io as pio

import streamlit as st


def run_chart_colors_test_app():
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

    col1, col2, col3 = st.columns(3)

    # Charts testing categorical colors.
    with col1:
        st.write("**Categorical: `st.line_chart`**")
        # Set seed for reproducible data in E2E testing
        np.random.seed(7)
        data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])

        st.line_chart(data, x_label="x label", y_label="y label", width="stretch")
        st.sidebar.line_chart(
            data,
            x_label="x label",
            y_label="y label",
            width="stretch",
            height=250,
        )

        st.write("**Categorical: `st.plotly_chart`**")
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

    # Charts testing sequential colors.
    with col2:
        st.write("**Sequential: `st.area_chart`**")
        stacked_data = []
        categories = [
            "Category A",
            "Category B",
            "Category C",
            "Category D",
            "Category E",
        ]
        time_points = np.arange(20)

        for i, category in enumerate(categories):
            for t in time_points:
                stacked_data.append(
                    {
                        "time": t,
                        "value": 5
                        + 3 * np.sin(t * 0.3 + i * 0.5)
                        + np.random.normal(0, 0.5),
                        "category": category,
                        "category_num": i,
                    }
                )

        st.area_chart(
            pd.DataFrame(stacked_data),
            x="time",
            y="value",
            color="category_num",
            width="stretch",
        )

        st.sidebar.area_chart(
            pd.DataFrame(stacked_data),
            x="time",
            y="value",
            color="category_num",
            width="stretch",
            height=250,
        )

        st.write("**Sequential: `st.plotly_chart`**")
        sequential_data = pd.DataFrame(
            {
                "x": np.random.normal(0, 1, 100),
                "y": np.random.normal(0, 1, 100),
                "temperature": np.random.uniform(
                    0, 100, 100
                ),  # 0-100 temperature scale
            }
        )

        fig_sequential = px.scatter(sequential_data, x="x", y="y", color="temperature")
        fig_sequential.update_layout(
            coloraxis_colorbar=dict(
                orientation="h", yanchor="top", y=-0.15, xanchor="center", x=0.5, len=1
            )
        )
        st.plotly_chart(fig_sequential, width="stretch")

    # Charts testing diverging colors.
    with col3:
        st.write("**Diverging: `st.altair_chart`**")
        # Data with values that diverge from 0
        diverging_data = pd.DataFrame(
            {"x": list(range(10)), "value": [-50, -30, -10, -5, 0, 5, 10, 30, 50, 70]}
        )

        # Chart using diverging scale - uses theme's chartDivergingColors
        # Key: use domainMid to trigger diverging color range from theme
        diverging_chart = (
            alt.Chart(diverging_data)
            .mark_bar()
            .encode(
                x="x:O",
                y="value:Q",
                color=alt.Color(
                    "value:Q",
                    scale=alt.Scale(
                        domainMid=0
                    ),  # domainMid triggers use of range.diverging
                ),
            )
        )
        st.altair_chart(diverging_chart, theme="streamlit", width="stretch")

        st.sidebar.altair_chart(
            diverging_chart, theme="streamlit", width="stretch", height=250
        )

        st.write("**Diverging: `st.plotly_chart`**")
        diverging_data_2 = pd.DataFrame(
            {
                "x": np.random.normal(0, 1, 100),
                "y": np.random.normal(0, 1, 100),
                "value": np.random.uniform(-50, 50, 100),  # Values centered around 0
            }
        )

        # For Plotly, you must explicitly use the template's diverging colorscale.
        # Unlike Altair, Plotly doesn't auto-switch based on color_continuous_midpoint.
        plotly_fig = px.scatter(
            diverging_data_2,
            x="x",
            y="y",
            color="value",
            color_continuous_midpoint=0,
            color_continuous_scale=pio.templates[
                "streamlit"
            ].layout.colorscale.diverging,
        )
        plotly_fig.update_layout(
            coloraxis_colorbar=dict(
                orientation="h", yanchor="top", y=-0.15, xanchor="center", x=0.5, len=1
            )
        )

        st.plotly_chart(plotly_fig, theme="streamlit", width="stretch")
