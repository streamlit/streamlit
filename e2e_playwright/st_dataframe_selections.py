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

np.random.seed(0)
random.seed(0)

# Generate a random dataframe
df = pd.DataFrame(
    np.random.randn(5, 5),
    columns=("col_%d" % i for i in range(5)),
)

selection_mode = st.multiselect(
    "Select the selection modes",
    ["single-row", "multi-row", "multi-column", "single-column"],
    default=["single-row"],
)

st.header("Row & column selections:")

selection = st.dataframe(
    df, hide_index=True, on_select="rerun", selection_mode=selection_mode
)
st.write("Dataframe selection:", selection)

st.header("Selections in form:")

with st.form(key="my_form"):
    selection = st.dataframe(
        df,
        hide_index=True,
        on_select="rerun",
        selection_mode=selection_mode,
        key="df_selection_in_form",
    )
    st.form_submit_button("Submit")
st.write("Dataframe selection:", selection)
st.write("Dataframe selection in session state:", st.session_state.df_selection_in_form)


st.header("Selection callback:")


def on_selection():
    st.write("Dataframe selection callback:", st.session_state.df_selection)


st.dataframe(
    df,
    hide_index=True,
    on_select=on_selection,
    selection_mode=selection_mode,
    key="df_selection",
)
