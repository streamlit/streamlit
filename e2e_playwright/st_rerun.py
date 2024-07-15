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

import streamlit as st

if "count" not in st.session_state:
    st.session_state.count = 0
    st.session_state.fragment_count = 0


@st.fragment
def my_fragment():
    if st.button("rerun fragment"):
        st.session_state.fragment_count += 1
        st.rerun(scope="fragment")

    st.write(f"fragment run count: {st.session_state.fragment_count}")

    if st.session_state.fragment_count % 5 != 0:
        st.session_state.fragment_count += 1
        st.rerun(scope="fragment")


st.session_state.count += 1

if st.session_state.count < 4:
    st.rerun()

if st.session_state.count >= 4:
    st.text("Being able to rerun a session is awesome!")

my_fragment()
st.write(f"app run count: {st.session_state.count}")
