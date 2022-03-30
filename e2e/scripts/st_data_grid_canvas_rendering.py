# Copyright 2018-2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import random
import streamlit as st
import pandas as pd
import numpy as np

# Explicitly seed the RNG for deterministic results
np.random.seed(0)

st.header("Test datetime handling:")
df = pd.DataFrame({"str": ["2020-04-14 00:00:00"]})
df["notz"] = pd.to_datetime(df["str"])
df["yaytz"] = pd.to_datetime(df["str"]).dt.tz_localize("Europe/Moscow")
st.experimental_data_grid(df)

st.header("Test value formatting via Pandas Styler:")
df = pd.DataFrame({"test": [3.14, 3.1]})
st.experimental_data_grid(df.style.format({"test": "{:.2f}"}))

st.header("Empty dataframes")
st.experimental_data_grid(pd.DataFrame([]))
st.experimental_data_grid(np.array(0))
st.experimental_data_grid()
st.experimental_data_grid([])

st.header("Empty one-column dataframes")
st.experimental_data_grid(np.array([]))

st.header("Empty two-column dataframes")
st.experimental_data_grid(pd.DataFrame({"lat": [], "lon": []}))

st.header("Custom index: dates")
df = pd.DataFrame(
    np.random.randn(8, 4),
    index=pd.date_range("1/1/2000", periods=8),
    columns=["A", "B", "C", "D"],
)
st.experimental_data_grid(df)

st.header("Custom index: strings")
df = pd.DataFrame(np.random.randn(6, 4), index=list("abcdef"), columns=list("ABCD"))
st.experimental_data_grid(df)

st.header("Multi Index")
df = pd.DataFrame(
    np.random.randn(8, 4),
    index=[
        np.array(["bar", "bar", "baz", "baz", "foo", "foo", "qux", "qux"]),
        np.array(["one", "two", "one", "two", "one", "two", "one", "two"]),
    ],
)
st.experimental_data_grid(df)

st.header("Index in Place")
df = pd.DataFrame(np.random.randn(6, 4), columns=list("ABCD"))
df.set_index("C", inplace=True)
st.experimental_data_grid(df)

st.header("Various data types")

from string import ascii_uppercase, ascii_lowercase, digits

n_rows = 30
random_int = random.randint(30, 50)
chars = ascii_uppercase + ascii_lowercase + digits  # will use it to generate strings

dft = pd.DataFrame(
    {
        "float64": np.random.rand(n_rows),
        "int64": np.arange(random_int, random_int + n_rows),
        "numpy bool": [random.choice([True, False]) for _ in range(n_rows)],
        "boolean": pd.array(
            [random.choice([True, False, None]) for _ in range(n_rows)], dtype="boolean"
        ),
        # "timedelta64":[np.timedelta64(i+1, 'h') for i in range(n_rows)],
        "datetime64": [
            (np.datetime64("2022-03-11T17:13:00") - random.randint(400000, 1500000))
            for _ in range(n_rows)
        ],
        "datetime64 + TZ": [
            (pd.to_datetime("2022-03-11 17:41:00-05:00")) for _ in range(n_rows)
        ],
        "string_object": [
            "".join(random.choice(chars) for i in range(random_int))
            for j in range(n_rows)
        ],
        "string_string": [
            "".join(random.choice(chars) for i in range(random_int))
            for j in range(n_rows)
        ],
        "category": pd.Series(
            list("".join(random.choice(ascii_lowercase) for i in range(n_rows)))
        ).astype("category"),
        "period[H]": [
            (pd.Period("2022-03-14 11:52:00", freq="H") + pd.offsets.Hour(i))
            for i in range(n_rows)
        ],
        # "sparse": sparse_data # Sparse pandas data (column sparse) not supported
        "interval": [
            pd.Interval(left=i, right=i + 1, closed="both") for i in range(n_rows)
        ],
        "string_list": [
            [
                "".join(random.choice(chars) for _ in range(10))
                for _ in range(random.randint(0, 10))
            ]
            for _ in range(n_rows)
        ],
    }
)

# string_string initially had the 'object' dtype. this line convert it into 'string'
dft = dft.astype({"string_string": "string"})

st.experimental_data_grid(dft)
