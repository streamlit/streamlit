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

from uuid import uuid4

import streamlit as st


@st.fragment
def my_fragment(n):
    with st.container(border=True):
        st.button("rerun this fragment", key=n)
        st.write(f"uuid in fragment {n}: {uuid4()}")


@st.fragment
def exception_raising_fragment():
    if st.checkbox("Raise Exception", value=True):
        raise Exception("This is an exception raised in a fragment")
    st.write("No exception thrown")


my_fragment(1)
# fragment that raises an exception does not stop the flow
exception_raising_fragment()
my_fragment(2)
