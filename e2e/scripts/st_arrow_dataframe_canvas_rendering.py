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

import random

import numpy as np
import pandas as pd
import pyarrow as pa

import streamlit as st

# Explicitly seed the RNG for deterministic results
np.random.seed(0)
random.seed(0)

st.set_page_config(layout="wide")

st.header("Empty dataframes")
st._arrow_dataframe(pd.DataFrame([]))
st._arrow_dataframe(np.array(0))
st._arrow_dataframe()
st._arrow_dataframe([])

st.header("Empty one-column dataframes")
st._arrow_dataframe(np.array([]))

st.header("Empty two-column dataframes")
st._arrow_dataframe(pd.DataFrame({"lat": [], "lon": []}))

st.header("Custom index: dates")
df = pd.DataFrame(
    np.random.randn(8, 4),
    index=pd.date_range("1/1/2000", periods=8),
    columns=["A", "B", "C", "D"],
)
st._arrow_dataframe(df)

st.header("Custom index: strings")
df = pd.DataFrame(np.random.randn(6, 4), index=list("abcdef"), columns=list("ABCD"))
st._arrow_dataframe(df)

st.header("Multi Index")
df = pd.DataFrame(
    np.random.randn(8, 4),
    index=[
        np.array(["bar", "bar", "baz", "baz", "foo", "foo", "qux", "qux"]),
        np.array(["one", "two", "one", "two", "one", "two", "one", "two"]),
    ],
)
st._arrow_dataframe(df)

st.header("Index in Place")
df = pd.DataFrame(np.random.randn(6, 4), columns=list("ABCD"))
df.set_index("C", inplace=True)
st._arrow_dataframe(df)

st.header("Pandas Styler: Value formatting")
df = pd.DataFrame({"test": [3.1423424, 3.1]})
st._arrow_dataframe(df.style.format({"test": "{:.2f}"}))

st.header("Pandas Styler: Background color")


def highlight_first(value):
    return "background-color: yellow" if value == 0 else ""


df = pd.DataFrame(np.arange(0, 100, 1).reshape(10, 10))
st._arrow_dataframe(df.style.applymap(highlight_first))

st.header("Pandas Styler: Background and font styling")

df = pd.DataFrame(np.random.randn(20, 4), columns=["A", "B", "C", "D"])


def style_negative(v, props=""):
    return props if v < 0 else None


def highlight_max(s, props=""):
    return np.where(s == np.nanmax(s.values), props, "")


# Passing style values w/ all color formats to test css-style-string parsing robustness.
styled_df = df.style.applymap(style_negative, props="color:#FF0000;").applymap(
    lambda v: "opacity: 20%;" if (v < 0.3) and (v > -0.3) else None
)

styled_df.apply(
    highlight_max, props="color:white;background-color:rgb(255, 0, 0)", axis=0
)

styled_df.apply(
    highlight_max, props="color:white;background-color:hsl(273, 98%, 60%);", axis=1
).apply(highlight_max, props="color:white;background-color:purple", axis=None)

st._arrow_dataframe(styled_df)

st.header("Pandas Styler: Gradient Styling")

weather_df = pd.DataFrame(
    np.random.rand(10, 2) * 5,
    index=pd.date_range(start="2021-01-01", periods=10),
    columns=["Tokyo", "Beijing"],
)


def rain_condition(v):
    if v < 1.75:
        return "Dry"
    elif v < 2.75:
        return "Rain"
    return "Heavy Rain"


def make_pretty(styler):
    styler.set_caption("Weather Conditions")
    styler.format(rain_condition)
    styler.background_gradient(axis=None, vmin=1, vmax=5, cmap="YlGnBu")
    return styler


styled_df = weather_df.style.pipe(make_pretty)

st._arrow_dataframe(styled_df)

st.header("Various data types")

from string import ascii_lowercase, ascii_uppercase, digits

n_rows = 10
random_int = np.random.randint(30, 50)
chars = ascii_uppercase + ascii_lowercase + digits  # will use it to generate strings

dft = pd.DataFrame(
    {
        # Boolean types
        "numpy bool": [np.random.choice([True, False]) for _ in range(n_rows)],
        "boolean": pd.array(
            [random.choice([True, False, None]) for _ in range(n_rows)],
            dtype="boolean",
        ),
        # String types
        "string_object": [
            "".join(random.choice(chars) for i in range(5)) for j in range(n_rows)
        ],
        "string_string": pd.Series(
            ["".join(random.choice(chars) for i in range(5)) for j in range(n_rows)],
            dtype="string",
        ),
        # Numeric types
        "int64": pd.array(range(0, n_rows), dtype="Int64"),
        "int32": pd.array(range(0, n_rows), dtype="Int32"),
        "int16": pd.array(range(0, n_rows), dtype="Int16"),
        "int8": pd.array(range(0, n_rows), dtype="Int8"),
        "uint64": pd.array(range(0, n_rows), dtype="UInt64"),
        "uint32": pd.array(range(0, n_rows), dtype="UInt32"),
        "uint16": pd.array(range(0, n_rows), dtype="UInt16"),
        "uint8": pd.array(range(0, n_rows), dtype="UInt8"),
        "float64": np.random.rand(n_rows),
        "float32": pd.array(np.random.rand(n_rows), dtype="float32"),
        "float16": pd.array(np.random.rand(n_rows), dtype="float16"),
    }
)
st._arrow_dataframe(dft, use_container_width=True)

dft = pd.DataFrame(
    {
        # Data time types
        "datetime64": [
            (np.datetime64("2022-03-11T17:13:00") - np.random.randint(400000, 1500000))
            for _ in range(n_rows)
        ],
        "datetime64 + TZ": [
            (pd.to_datetime("2022-03-11 17:41:00-05:00")) for _ in range(n_rows)
        ],
        # Period type
        "period[H]": [
            (pd.Period("2022-03-14 11:52:00", freq="H") + pd.offsets.Hour(i))
            for i in range(n_rows)
        ],
        # Interval types
        "i_int64_both": [
            pd.Interval(left=i, right=i + 1, closed="both") for i in range(n_rows)
        ],
        "i_int64_right": [
            pd.Interval(left=i, right=i + 1, closed="right") for i in range(n_rows)
        ],
        "i_int64_left": [
            pd.Interval(left=i, right=i + 1, closed="left") for i in range(n_rows)
        ],
        "i_int64_neither": [
            pd.Interval(left=i, right=i + 1, closed="neither") for i in range(n_rows)
        ],
        "i_timestamp_right_defualt": [
            pd.Interval(
                left=pd.Timestamp(2022, 3, 14, i),
                right=pd.Timestamp(2022, 3, 14, i + 1),
            )
            for i in range(n_rows)
        ],
        "i_float64": [
            pd.Interval(np.random.random(), np.random.random() + 1)
            for _ in range(n_rows)
        ],
        # Category
        "category": pd.Series(
            list("".join(random.choice(ascii_lowercase) for i in range(n_rows))),
            dtype="category",
        ),
        "category_period": pd.Series(
            [
                pd.Interval(np.random.random(), np.random.random() + 1)
                for _ in range(n_rows)
            ],
            dtype="category",
        ),
    }
)
st._arrow_dataframe(dft, use_container_width=True)

dft = pd.DataFrame(
    {
        # List
        "list_string": [
            [
                "".join(random.choice(chars) for _ in range(5))
                for _ in range(np.random.randint(0, 3))
            ]
            for _ in range(n_rows)
        ],
        "list_int": [
            [np.random.randint(0, 1000) for _ in range(np.random.randint(0, 3))]
            for _ in range(n_rows)
        ],
        "list_float": [
            [np.random.random() for _ in range(np.random.randint(0, 3))]
            for _ in range(n_rows)
        ],
        # TODO: Sparse pandas data (column sparse) is not supported yet
        # "sparse": sparse_data
        # TODO: Duration type is not supported yet.
        #   See: https://github.com/streamlit/streamlit/issues/4489
        # "timedelta64":[np.timedelta64(i+1, 'h') for i in range(n_rows)],
    }
)
st._arrow_dataframe(dft, use_container_width=True)

st.header("Missing data")
df = pd.DataFrame(
    np.random.rand(5, 3),
    index=["a", "c", "e", "f", "h"],
    columns=["one", "two", "three"],
)
df["four"] = "bar"
df["five"] = df["one"] > 0
df_nan = df.reindex(["a", "b", "c", "d", "e", "f", "g", "h"])
df_nan["timestamp"] = pd.Timestamp("20220315")
df_nan.loc[["a", "c", "h"], ["one", "timestamp"]] = np.nan
st._arrow_dataframe(df_nan)

st.header("Input Data: pyarrow.Table")
df_arr1 = pd.DataFrame(
    {
        "int": [1, 1, 2, 3, 5],
        "str": ["a", "b", "c", "ab", "bc"],
        "float": [3.14, 2.71, 9.98, 6.02, 1060.02],
    }
)
table1 = pa.Table.from_pandas(df_arr1)
st._arrow_dataframe(table1)

st.header("Input Data: numpy.ndarray")
np_array: "np.typing.NDArray[np.int_]" = np.ndarray(
    shape=(5, 5),
    buffer=np.arange(40),
    dtype=int,
    offset=8 * np.int_().itemsize,
    order="F",
)
st._arrow_dataframe(np_array)

st.header("Input Data: dict")
dict = {
    "brand 🚗": ["Ford", "KIA", "Toyota", "Tesla"],
    "model 🚙": ["Mustang", "Optima", "Corolla", "Model 3"],
    "year 📆": [1964, 2007, 2022, 2021],
    "color 🌈": ["Black ⚫", "Red 🔴", "White ⚪", "Red 🔴"],
    "emoji 🚀🚀": ["👨🏻‍🚀", "👩🏻‍🚀", "👩🏻‍🚒🚀", "👨🏻‍🚒"],
}
st._arrow_dataframe(dict)

st.header("Input Data: List")
st._arrow_dataframe(["apple", "banana", "cherry", "apple", "cherry"])

st.header("Input Data: 1-d tuple")
st._arrow_dataframe(("apple", "banana", "cherry", "apple", "cherry"))

st.header("Input Data: 2-d tuple")
st._arrow_dataframe(
    (
        ("apple", "banana", "cherry", "apple", "cherry"),
        ("obladi", "oblada", "life", "goes", "on"),
        ("who", "let", "the", "dogs", "out"),
        ("Kids", "!", "Are", "you", "ready"),
    )
)
st.header("Input Data: iter(2-d tuple)")
st._arrow_dataframe(
    iter(
        (
            ("apple", "banana", "cherry", "apple", "cherry"),
            ("obladi", "oblada", "life", "goes", "on"),
            ("who", "let", "the", "dogs", "out"),
            ("Kids", "!", "Are", "you", "ready"),
        )
    )
)

st.header("Input Data: 1-d set")
# Set does not have a stable order across different Python version.
# Therefore, we are only testing this with one item.
st._arrow_dataframe({"apple", "apple"})

st.header("Input Data: 2-d list")
list_1 = [[1, 2, 3, 4, 5], [-1, -2, -3, -4, -5], [10, 20, 30, 40, 50], [6, 7, 8, 9, 10]]
st._arrow_dataframe(list_1)

df = pd.DataFrame(
    np.random.randn(50, 36), columns=list("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
)

st.header("Long colum header")

df = pd.DataFrame(
    np.random.randn(200, 4),
    columns=["this is a very long header name", "A", "C", "this is another long name"],
)

st._arrow_dataframe(df)
