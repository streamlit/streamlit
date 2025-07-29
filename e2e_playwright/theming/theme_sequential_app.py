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
    # Set seed for reproducibility
    np.random.seed(42)

    with col1:
        st.write("**st.area_chart**")
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
            use_container_width=True,
        )

        st.write("**st.plotly_chart**")
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
        st.plotly_chart(fig_sequential, use_container_width=True)

    with col2:
        st.write("**st.altair_chart**")
        # Create explicit sequential data for color mapping
        time_data = pd.DataFrame(
            {
                "time_step": np.arange(50),
                "value_x": np.cumsum(np.random.normal(0, 1, 50)),
                "value_y": np.cumsum(np.random.normal(0, 1, 50)),
                "intensity": np.arange(50),  # This will drive the sequential color
            }
        )

        altair_chart = (
            alt.Chart(time_data)
            .mark_circle(size=100)
            .encode(
                x=alt.X("value_x:Q", title="X Position"),
                y=alt.Y("value_y:Q", title="Y Position"),
                color=alt.Color(
                    "intensity:Q", title="Time Step", legend=alt.Legend(orient="bottom")
                ),  # No explicit scheme - should use theme
            )
        )
        st.altair_chart(altair_chart, use_container_width=True)

        st.write("**st.vega_lite_chart**")
        # Create heatmap-style sequential data
        time_points = np.arange(30)
        heatmap_data = pd.DataFrame(
            {
                "time": time_points,
                "temperature": 20 + 15 * np.sin(time_points * 0.2) + time_points * 0.3,
                "day_of_month": (time_points % 30) + 1,
            }
        )

        vega_spec = {
            "mark": {"type": "rect", "tooltip": True},
            "encoding": {
                "x": {"field": "day_of_month", "type": "ordinal", "title": "Day"},
                "y": {"field": "time", "type": "ordinal", "title": "Time Period"},
                "color": {
                    "field": "temperature",
                    "type": "quantitative",
                    "title": "Temperature",
                    "legend": {"orient": "bottom"},
                },
            },
            "width": 400,
            "height": 350,
        }
        st.vega_lite_chart(heatmap_data, vega_spec, use_container_width=True)
