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

"""E2E app for st.dataframe / st.data_editor alt accessible names."""

from __future__ import annotations

import pandas as pd

import streamlit as st

df = pd.DataFrame({"A": [1, 2], "B": [3, 4]})

st.subheader("Dataframe alt")
# A display-only st.dataframe does not register an element ID, so its `key` never
# reaches the DOM. Wrap each case in a keyed container to target it without nth().
with st.container(key="df_labeled"):
    st.dataframe(df, alt="Top 20 customers by revenue")
with st.container(key="df_unlabeled"):
    st.dataframe(df)

st.subheader("Data editor alt")
with st.container(key="editor_labeled"):
    st.data_editor(df, alt="Editable customer list", key="editor_labeled_widget")
with st.container(key="editor_unlabeled"):
    st.data_editor(df, key="editor_unlabeled_widget")
