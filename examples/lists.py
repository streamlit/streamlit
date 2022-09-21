# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

st.title("Lists!")

lists = [
    [],
    [10, 20, 30],
    [[10, 20, 30], [1, 2, 3]],
    [[10, 20, 30], [1]],
    [[10, "hi", 30], [1]],
    [[{"foo": "bar"}, "hi", 30], [1]],
    [[{"foo": "bar"}, "hi", 30], [1, [100, 200, 300, 400]]],
]


for i, l in enumerate(lists):
    st.header("List %d" % i)

    st.write("With st.write")
    st.write(l)

    st.write("With st.json")
    st.json(l)

    st.write("With st.dataframe")
    st.dataframe(l)
