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
from __future__ import annotations

import time
from io import StringIO
from typing import Literal

import pandas as pd
import pydeck as pdk

import streamlit as st
from shared.pydeck_utils import get_pydeck_chart

st.header("PyDeck Chart")

if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")

selection_mode: Literal["single-object", "multi-object"] = st.selectbox(
    "Map Selection Mode",
    ["single-object", "multi-object"],
)

event_data = get_pydeck_chart("managed_map", selection_mode)

st.write(
    "session_state.managed_map:",
    str(st.session_state.get("managed_map") or ""),
)
st.write("managed_map selection:", str(event_data))


st.divider()
st.header("PyDeck Chart with Callback")


def on_selection():
    st.write(
        "PyDeck selection callback:",
        str(st.session_state.selection_callback),
    )


selection = get_pydeck_chart(
    "selection_callback", selection_mode="single-object", on_select=on_selection
)


st.divider()
st.header("PyDeck Chart in Form")

with st.form(key="my_form", clear_on_submit=True):
    selection = get_pydeck_chart("selection_in_form", selection_mode="single-object")
    st.form_submit_button("Submit")

st.write("PyDeck-in-form selection:", str(selection))
if "selection_in_form" in st.session_state:
    st.write(
        "PyDeck-in-form selection in session state:",
        str(st.session_state.selection_in_form),
    )


st.divider()
st.header("PyDeck Chart in Fragment")


@st.fragment
def test_fragment():
    selection = get_pydeck_chart("selection_in_fragment", "single-object")
    st.write("PyDeck-in-fragment selection:", str(selection))


test_fragment()

if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)

st.divider()
st.header("Scatterplot")


CITY_CSV = """
"City","State","Lat","Long","Size"
"Denver","Colorado",39.7391667,-104.984167,"30000"
"Hartford","Connecticut",41.767,-72.677,"100000"
"Juneau","Alaska",58.301935,-134.419740,"10000"
"Little Rock","Arkansas",34.736009,-92.331122,"50000"
"Phoenix","Arizona",33.448457,-112.073844,"200000"
"Sacramento","California",38.555605,-121.468926,"150000"
"""

csv_file_like = StringIO(CITY_CSV)


cities = pd.read_csv(
    csv_file_like,
    header=0,
    names=[
        "City",
        "State",
        "Lat",
        "Long",
        "Size",
    ],
)


st.pydeck_chart(
    pdk.Deck(
        pdk.Layer(
            "ScatterplotLayer",
            data=cities,
            id="cities",
            get_position=["Long", "Lat"],
            get_color="[255, 75, 75, 127]",
            pickable=True,
            get_radius="Size",
        ),
        initial_view_state=pdk.ViewState(
            latitude=cities.Lat.mean(),
            longitude=cities.Long.mean(),
            controller=True,
            zoom=3,
            pitch=50,
        ),
        tooltip={"text": "{City}, Size: {Size}"},
    ),
    on_select="rerun",
    selection_mode="single-object",
)
