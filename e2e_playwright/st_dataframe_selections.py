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

import random

import numpy as np
import pandas as pd

import streamlit as st
from streamlit.elements.lib.column_config_utils import ColumnConfig

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

with st.form(key="my_form"):
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
st.write(
    "Dataframe-in-form selection in session state:",
    str(st.session_state.df_selection_in_form),
)


st.header("Selection callback:")


def on_selection():
    st.write("Dataframe selection callback:", st.session_state.df_selection)


st.dataframe(
    df,
    hide_index=True,
    on_select=on_selection,
    selection_mode=selection_mode,
    key="df_selection",
    column_config=column_config,
)
