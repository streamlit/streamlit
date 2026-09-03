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

"""Altair selection bindings with on_select.

Reproduces streamlit/streamlit#8765: binding_radio / binding_select plus
on_select="rerun" must not duplicate Vega bind widgets.
"""

from typing import Any

import altair as alt
import pandas as pd

import streamlit as st

df = pd.DataFrame(
    {
        "Miles_per_Gallon": [18.0, 15.0, 16.0, 24.0, 22.0, 26.0, 27.0, 31.0, 35.0],
        "Horsepower": [130, 165, 150, 88, 95, 90, 70, 69, 67],
        "Origin": [
            "USA",
            "USA",
            "USA",
            "Europe",
            "Europe",
            "Europe",
            "Japan",
            "Japan",
            "Japan",
        ],
    }
)

REGION_OPTIONS = ["USA", "Europe", "Japan"]


def _make_chart(bind: alt.Binding, *, prefix: str) -> Any:
    """Scatter chart with a click selection on color and a fields-bound Origin filter.

    ``prefix`` makes Vega param names unique so radio widgets in different
    charts do not share HTML ``name`` attributes.
    """
    single_selection = alt.selection_point(name=f"{prefix}_single", toggle=False)
    selection = alt.selection_point(
        name=f"{prefix}_og_select",
        fields=["Origin"],
        bind=bind,
        value="USA",
        toggle=False,
    )
    return (
        alt.Chart(df)
        .mark_point()
        .encode(
            x="Miles_per_Gallon:Q",
            y="Horsepower:Q",
            color=alt.condition(single_selection, "Origin:N", alt.value("lightgray")),
        )
        .transform_filter(selection)
        .add_params(single_selection, selection)
        .properties(height=220)
    )


radio_bind = alt.binding_radio(
    options=REGION_OPTIONS,
    labels=REGION_OPTIONS,
    name="Region: ",
)
select_bind = alt.binding_select(
    options=REGION_OPTIONS,
    labels=REGION_OPTIONS,
    name="Region: ",
)

# on_select="ignore" does not register the chart as a widget, so `key=` does
# not add an st-key-* class. Wrap in a keyed container for stable locators.
with st.container(key="bind_radio_ignore"):
    st.altair_chart(
        _make_chart(radio_bind, prefix="ignore"),
        on_select="ignore",
        width="stretch",
    )
st.altair_chart(
    _make_chart(radio_bind, prefix="radio"),
    on_select="rerun",
    selection_mode="radio_single",
    key="bind_radio_rerun",
    width="stretch",
)
st.altair_chart(
    _make_chart(select_bind, prefix="select"),
    on_select="rerun",
    selection_mode="select_single",
    key="bind_select_rerun",
    width="stretch",
)
