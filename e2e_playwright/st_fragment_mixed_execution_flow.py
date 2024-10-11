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

import time
from uuid import uuid4

import streamlit as st

if "sleep_time" not in st.session_state:
    st.session_state["sleep_time"] = 0
sleep_time = st.session_state["sleep_time"]


@st.fragment
def my_fragment(n):
    with st.container(border=True):
        st.button("rerun this fragment", key=n)
        st.write(f"uuid in fragment {n}: {uuid4()}")
    # sleep here so that we have time to react to the flow
    # and trigger buttons etc. before the fragment is finished
    # and the next starts to render
    time.sleep(sleep_time)


my_fragment(1)
my_fragment(2)
my_fragment(3)

st.session_state["sleep_time"] = 3
st.button("Full app rerun")
