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

import streamlit as st

with st.sidebar:
    st.button(
        label="Sidebar-button with help",
        help="""This is a longer help text to inform users of the functionality and in
            case it is disabled what to do to enable it. This is a longer help text
            to inform users of the functionality and in case it is disabled what to
            do to enable it.
            """,
    )


columns_ = st.columns([9, 1.5, 1.5])
with columns_[1].popover("Some popover"):
    pass

with columns_[2].popover("Popover with toggle"):
    st.toggle(
        "Right-toggle with help",
        help="""
            View statistics of all damage done at each skill level only.
            This includes all damage done at each player level available at
            each skill level.
            """,
    )
