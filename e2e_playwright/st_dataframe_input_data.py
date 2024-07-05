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
import xarray as xr

import streamlit as st
from shared.data_mocks import SHARED_TEST_CASES

np.random.seed(0)
random.seed(0)

st.set_page_config(layout="wide")

# Render all test cases with st.dataframe:
for test_case in SHARED_TEST_CASES:
    data = test_case[0]
    st.subheader(str(test_case[1].expected_data_format))
    st.dataframe(data)
    # st.dataframe(xr.DataArray(data))


from collections import defaultdict

# Defining the dict and passing
# lambda as default_factory argument
d = defaultdict(lambda: "Not Present")
d["a"] = 1
d["b"] = 2

st.dataframe(d)
st.write(d)
st.write(isinstance(d, dict))


data = np.random.rand(4, 3)
places = ["home", "shop", "park"]
times = pd.date_range("2000-01-01", periods=4)
da = xr.DataArray(data, coords=[times, places], dims=["time", "place"])
st.dataframe(da)

data = xr.DataArray(np.random.randn(2, 3), dims=("x", "y"), coords={"x": [10, 20]})
st.dataframe(data)

data = xr.DataArray(pd.Series(range(3), index=list("abc"), name="foo"))
result = st.data_editor(data.copy(deep=True))
st.write(result)
st.write(type(result))
# data.to_pandas()
# data.to_dataframe()

# st.dataframe(data.to_pandas())

# st.dataframe(data.to_dataframe())
st.write("Foo", data.to_series().copy())

np.random.seed(0)
temperature = 15 + 8 * np.random.randn(2, 3, 4)
precipitation = 10 * np.random.rand(2, 3, 4)
lon = [-99.83, -99.32]
lat = [42.25, 42.21]
instruments = ["manufac1", "manufac2", "manufac3"]
time = pd.date_range("2014-09-06", periods=4)
reference_time = pd.Timestamp("2014-09-05")
ds = xr.Dataset(
    data_vars=dict(
        temperature=(["loc", "instrument", "time"], temperature),
        precipitation=(["loc", "instrument", "time"], precipitation),
    ),
    coords=dict(
        lon=("loc", lon),
        lat=("loc", lat),
        instrument=instruments,
        time=time,
        reference_time=reference_time,
    ),
    attrs=dict(description="Weather related data."),
)


from collections import OrderedDict

# st.write(type(ds))

data = [
    (None, []),
    # List:
    ([], []),
    (
        ["st.number_input", "st.text_area", "st.text_input"],
        ["st.number_input", "st.text_area", "st.text_input"],
    ),
    (
        [1, 2, 3],
        [1, 2, 3],
    ),
    # Reversed list:
    (
        reversed(["st.number_input", "st.text_area", "st.text_input"]),
        ["st.text_input", "st.text_area", "st.number_input"],
    ),
    # Set:
    (set(), []),
    (
        {"st.number_input", "st.text_area", "st.text_input"},
        ["st.text_input", "st.number_input", "st.text_area"],
    ),
    # Tuple:
    ((), []),
    (
        ("st.number_input", "st.text_area", "st.text_input"),
        ["st.number_input", "st.text_area", "st.text_input"],
    ),
    # Dict:
    ({}, []),
    (
        {
            "st.number_input": "number",
            "st.text_area": "text",
            "st.text_input": "text",
        },
        ["st.number_input", "st.text_area", "st.text_input"],
    ),
    # Dict keys:
    (
        {
            "st.number_input": "number",
            "st.text_area": "text",
            "st.text_input": "text",
        }.keys(),
        ["st.number_input", "st.text_area", "st.text_input"],
    ),
    # Dict values:
    (
        {
            "st.number_input": "number",
            "st.text_area": "text",
            "st.text_input": "text",
        }.values(),
        ["number", "text", "text"],
    ),
    # OrderedDict:
    (
        OrderedDict(
            [
                ("st.number_input", "number"),
                ("st.text_area", "text"),
                ("st.text_input", "text"),
            ]
        ),
        ["st.number_input", "st.text_area", "st.text_input"],
    ),
    # Enum:
    # (
    #     TestEnum,
    #     [TestEnum.NUMBER_INPUT, TestEnum.TEXT_AREA, TestEnum.TEXT_INPUT],
    # ),
    # (StrTestEnum, ["st.number_input", "st.text_area", "st.text_input"]),
    # # Generator:
    # (data_generator(), ["st.number_input", "st.text_area", "st.text_input"]),
    # String:
    # ("abc", ["a", "b", "c"]),
    # Enumerate:
    (
        enumerate(["st.number_input", "st.text_area", "st.text_input"]),
        [0, 1, 2],
    ),
    # Range:
    (range(3), [0, 1, 2]),
    # Pandas Dataframe:
    (
        pd.DataFrame(),
        [],
    ),
    (
        pd.DataFrame(columns=["name", "type"], index=pd.RangeIndex(start=0, step=1)),
        [],
    ),
    (
        pd.DataFrame(["st.number_input", "st.text_area", "st.text_input"]),
        ["st.number_input", "st.text_area", "st.text_input"],
    ),
    # Dataframe with multiple columns (widgets & types)
    # The first column is expected to be selected as the sequence.
    (
        pd.DataFrame(
            {
                "widgets": ["st.number_input", "st.text_area", "st.text_input"],
                "types": ["number", "text", "text"],
            }
        ),
        ["st.number_input", "st.text_area", "st.text_input"],
    ),
    # Pandas Series (pd.Series):
    (
        pd.Series(["st.number_input", "st.text_area", "st.text_input"], name="widgets"),
        ["st.number_input", "st.text_area", "st.text_input"],
    ),
    # Pandas Index (pd.Index):
    (
        pd.Index(["st.number_input", "st.text_area", "st.text_input"]),
        ["st.number_input", "st.text_area", "st.text_input"],
    ),
    # Pandas Styler (pd.Styler):
    (
        pd.DataFrame(["st.number_input", "st.text_area", "st.text_input"]).style,
        ["st.number_input", "st.text_area", "st.text_input"],
    ),
    # Pandas Categorical (pd.Categorical):
    (
        pd.Categorical(["st.number_input", "st.text_area", "st.text_input"]),
        ["st.number_input", "st.text_area", "st.text_input"],
    ),
    # Pandas DatetimeIndex (pd.DatetimeIndex):
    (
        pd.DatetimeIndex(["1/1/2020 10:00:00+00:00", "2/1/2020 11:00:00+00:00"]),
        [
            pd.Timestamp("2020-01-01 10:00:00+0000", tz="UTC"),
            pd.Timestamp("2020-02-01 11:00:00+0000", tz="UTC"),
        ],
    ),
    # Pandas DatetimeArrayå:
    (
        pd.arrays.DatetimeArray(
            pd.DatetimeIndex(["1/1/2020 10:00:00+00:00", "2/1/2020 11:00:00+00:00"]),
        ),
        [
            pd.Timestamp("2020-01-01 10:00:00+0000", tz="UTC"),
            pd.Timestamp("2020-02-01 11:00:00+0000", tz="UTC"),
        ],
    ),
    # Pandas RangeIndex (pd.RangeIndex):
    (
        pd.RangeIndex(start=0, stop=3, step=1),
        [0, 1, 2],
    ),
    # Numpy array:
    (
        np.array([]),
        [],
    ),
    (
        np.array(["st.number_input", "st.text_area", "st.text_input"]),
        ["st.number_input", "st.text_area", "st.text_input"],
    ),
]
import enum


class StrTestEnum(str, enum.Enum):
    NUMBER_INPUT = "st.number_input"
    TEXT_AREA = "st.text_area"
    TEXT_INPUT = "st.text_input"


class TestEnum(enum.Enum):
    NUMBER_INPUT = "st.number_input"
    TEXT_AREA = "st.text_area"
    TEXT_INPUT = "st.text_input"


def data_generator():
    yield "st.number_input"
    yield "st.text_area"
    yield "st.text_input"


from collections import Counter

counter = Counter({"red": 4, "blue": 2})
st.dataframe(counter)
st.dataframe(StrTestEnum)
# TestEnum.
st.dataframe(TestEnum)

for d in data:
    st.dataframe(d[0])
    st.write(str(type(d[0])))
