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

from dataclasses import dataclass
from typing import NamedTuple

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)


st.subheader("st.write(dataframe-like)")

st.write(pd.DataFrame(np.random.randn(25, 3), columns=["a", "b", "c"]))

st.write(pd.Series([1, 2, 3]))

st.write(
    pd.DataFrame(np.random.randn(25, 3), columns=["a", "b", "c"]).style.format("{:.2%}")
)

st.write(np.arange(25).reshape(5, 5))

st.subheader("st.write(json-like)")

st.write(["foo", "bar"])

st.write({"foo": "bar"})

st.write(st.session_state)
st.write(st.user)
st.write(st.query_params)


class Point(NamedTuple):
    x: int
    y: int


st.write(Point(1, 2))

st.subheader("st.write(help)")

st.write(st.dataframe)


@dataclass
class ExampleClass:
    name: str
    age: int


st.write(ExampleClass)

st.subheader("st.write(reprhtmlable)")


class ClassWithReprHtml:
    def _repr_html_(self) -> str:
        return "This is an <b>HTML tag</b>!"


# Shows as st.help because this is just an object.
st.write(ClassWithReprHtml())

# Shows as HTML.
st.write(ClassWithReprHtml(), unsafe_allow_html=True)

st.subheader("st.write(exception)")

st.write(Exception("This is an exception!"))
