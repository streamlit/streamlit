# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
from typing import Literal

import pandas as pd
import pydeck as pdk
from playwright.sync_api import Page, expect

import streamlit as st

H3_HEX_DATA = [
    {"hex": "88283082b9fffff", "count": 10},
    {"hex": "88283082d7fffff", "count": 50},
    {"hex": "88283082a9fffff", "count": 100},
]
df = pd.DataFrame(H3_HEX_DATA)


def get_pydeck_chart(
    key: str,
    selection_mode: Literal["single-object", "multi-object"],
    on_select="rerun",
):
    return st.pydeck_chart(
        pdk.Deck(
            map_style="mapbox://styles/mapbox/outdoors-v12",
            initial_view_state=pdk.ViewState(
                latitude=37.7749295,
                longitude=-122.4194155,
                zoom=11,
                bearing=0,
                pitch=30,
            ),
            layers=[
                pdk.Layer(
                    "H3HexagonLayer",
                    df,
                    id="MyHexLayer",
                    stroked=True,
                    filled=True,
                    get_hexagon="hex",
                    line_width_min_pixels=2,
                    get_fill_color="[120, count > 50 ? 255 : 0, 255]",
                ),
            ],
        ),
        use_container_width=True,
        key=key,
        on_select=on_select,
        selection_mode=selection_mode,
    )


def wait_for_chart(app: Page):
    # The pydeck chart takes a while to load so check that
    # it gets attached with an increased timeout.
    pydeck_charts = app.get_by_test_id("stDeckGlJsonChart")
    expect(pydeck_charts).to_have_count(5, timeout=15000)

    # The map assets can take more time to load, add an extra timeout
    # to prevent flakiness.
    app.wait_for_timeout(10000)


def get_click_handling_div(app: Page, nth: int):
    # Find canvas with class name "mapboxgl-canvas"
    expect(app.locator(".mapboxgl-canvas").nth(nth)).to_be_visible()
    return app.locator("#view-default-view").nth(nth)
