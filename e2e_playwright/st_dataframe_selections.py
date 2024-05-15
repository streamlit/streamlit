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

import copy
import random
import time

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)
random.seed(0)

# Generate a random dataframe
df = pd.DataFrame(
    np.random.randn(5, 5),
    columns=("col_%d" % i for i in range(5)),
)

# set fixed column with so our pixel-clicks in the test are stable
column_with_fixed_width = st.column_config.Column(width="small")
column_config = {
    "col_0": column_with_fixed_width,
    "col_1": column_with_fixed_width,
    "col_2": column_with_fixed_width,
    "col_3": column_with_fixed_width,
    "col_4": column_with_fixed_width,
}

st.header("Row & column selections:")
st.subheader("single-row select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode="single-row",
    column_config=column_config,
)
st.write("Dataframe single-row selection:", str(selection))

st.subheader("single-column select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode="single-column",
    column_config=column_config,
)
st.write("Dataframe single-column selection:", str(selection))

st.subheader("multi-row select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode="multi-row",
    column_config=column_config,
)
st.write("Dataframe multi-row selection:", str(selection))

st.subheader("multi-column select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode="multi-column",
    column_config=column_config,
)
st.write("Dataframe multi-column selection:", str(selection))

if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")

st.subheader("multi-row & multi-column select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode=["multi-row", "multi-column"],
    column_config=column_config,
)
st.write("Dataframe multi-row-multi-column selection:", str(selection))

st.header("Selections in form:")

with st.form(key="my_form", clear_on_submit=True):
    selection = st.dataframe(
        df,
        hide_index=True,
        on_select="rerun",
        selection_mode=["multi-row", "multi-column"],
        key="df_selection_in_form",
        column_config=column_config,
    )
    st.form_submit_button("Submit")

st.write("Dataframe-in-form selection:", str(selection))
if "df_selection_in_form" in st.session_state:
    st.write(
        "Dataframe-in-form selection in session state:",
        str(st.session_state.df_selection_in_form),
    )

st.header("Selection callback:")


def on_selection():
    st.write("Dataframe selection callback:", str(st.session_state.df_selection))


st.dataframe(
    df,
    hide_index=True,
    on_select=on_selection,
    selection_mode=["multi-row", "multi-column"],
    key="df_selection",
    column_config=column_config,
)

st.header("Selections in fragment:")


@st.experimental_fragment()
def test_fragment():
    selection = st.dataframe(
        df,
        hide_index=True,
        on_select="rerun",
        selection_mode=["multi-row", "multi-column"],
        key="inside_fragment",
        column_config=column_config,
    )
    st.write("Dataframe-in-fragment selection:", str(selection))


test_fragment()

if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)

st.header("Dataframe with Index:")

column_config = copy.deepcopy(column_config)
column_config["_index"] = st.column_config.Column(width="small")

selection = st.dataframe(
    df,
    hide_index=False,
    on_select="rerun",
    selection_mode=["multi-column"],
    key="with_index",
    column_config=column_config,
    column_order=["col_1", "col_3"],
)
st.write("No selection on index column:", str(selection))
