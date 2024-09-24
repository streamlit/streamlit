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

st.subheader("Simple dict:")
st.json({"foo": "bar"})

st.subheader("Collapsed")
st.json({"foo": "bar"}, expanded=False)

st.subheader("Keep whitespaces:")
st.json({"Hello     World": "Foo    Bar"})

st.subheader("Complex dict:")
st.json(
    {
        "array": [1, 2],
        "boolean": True,
        "null": None,
        "integer": 123,
        "float": 123.45,
        "object": {"a": "b", "c": "d"},
        "string": "Hello World",
    }
)

st.subheader("Simple List:")
st.json(["a", "b"])

st.subheader("Empty dict:")
st.json({})

st.subheader("Expand to depth of 2:")
st.json(
    {
        "level1": {
            "level2": {"level3": {"a": "b"}},
            "c": "d",
            "list": [{"list_item": "value"}],
        },
        "string": "Hello World",
    },
    expanded=2,
)

st.subheader("Keeps container bounds:")

col1, col2 = st.container(key="container_with_json").columns(2)

with col1.container(border=True):
    st.json(
        {
            "foo": "a" * 100,
            "bar": "this is a very long string that will not fit in the column and will cause it to wrap",
        }
    )
