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

import datetime
import random
from datetime import date
from decimal import Decimal

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)
random.seed(0)

st.set_page_config(layout="wide")

st.subheader("Base types")
base_df = pd.DataFrame(
    {
        "string": [
            "a",
            "this is a very long sentence that does not contain any reasonable content.",
            "c",
            "d",
            "",
            None,
        ],
        "bool": [True, False, True, False, True, None],
        "int64": [-5, 1, 2, 3, 4, 5],
        "float64": [-0.1, 0, 0.1, 0.001, 1.1, None],
        "datetime": [
            datetime.datetime(2020, 1, 1, 0, 0, 0),
            datetime.datetime(2020, 1, 1, 0, 0, 1),
            datetime.datetime(2020, 1, 1, 0, 0, 2),
            datetime.datetime(2020, 1, 1, 0, 0, 3),
            datetime.datetime(2020, 1, 1, 0, 0, 4),
            None,
        ],
        "date": [
            date(2020, 1, 1),
            date(2020, 1, 2),
            date(2020, 1, 3),
            date(2020, 1, 4),
            date(2020, 1, 5),
            None,
        ],
        "time": [
            datetime.time(0, 0, 0),
            datetime.time(0, 0, 1),
            datetime.time(0, 0, 2),
            datetime.time(0, 0, 3),
            datetime.time(0, 0, 4),
            None,
        ],
        "empty": [None, np.nan, pd.NA, pd.NaT, None, None],
    }
)

st.dataframe(base_df.dtypes)
st.dataframe(base_df.copy(), use_container_width=True)
st.experimental_data_editor(base_df.copy(), use_container_width=True)


st.subheader("Number types")
numbers_df = pd.DataFrame(
    {
        "int64": pd.array([-5, 1, 2, 3, 4, None], dtype="Int64"),
        "int32": pd.array([-5, 1, 2, 3, 4, None], dtype="Int32"),
        "int16": pd.array([-5, 1, 2, 3, 4, None], dtype="Int16"),
        "int8": pd.array([-5, 1, 2, 3, 4, None], dtype="Int8"),
        "uint64": pd.array([1, 2, 3, 4, 5, None], dtype="UInt64"),
        "uint32": pd.array([1, 2, 3, 4, 5, None], dtype="UInt32"),
        "uint16": pd.array([1, 2, 3, 4, 5, None], dtype="UInt16"),
        "uint8": pd.array([1, 2, 3, 4, 5, None], dtype="UInt8"),
        "float64": pd.array([-0.1, 0, 0.1, 0.001, 1.1, None], dtype="float64"),
        "float32": pd.array([-0.1, 0, 0.1, 0.001, 1.1, None], dtype="float32"),
        "float16": pd.array([-0.1, 0, 0.1, 0.001, 1.1, None], dtype="float16"),
        "mixed": pd.array([1, -2, 3.1, 4, 5.0, None]),
    }
)

st.dataframe(numbers_df.dtypes)
st.dataframe(numbers_df.copy(), use_container_width=True)
st.experimental_data_editor(numbers_df.copy(), use_container_width=True)

n_rows = 9
start_date = datetime.datetime.fromisoformat("2018-01-31T09:24:31.488670+00:00")
end_date = datetime.datetime.fromisoformat("2022-01-31T09:24:31.488670+00:00")


def random_date(start: datetime.datetime, end: datetime.datetime) -> datetime.datetime:
    """Generate a random datetime between `start` and `end`"""
    return (
        start
        + datetime.timedelta(
            # Get a random amount of seconds between `start` and `end`
            seconds=random.randint(0, int((end - start).total_seconds())),
        )
    ).replace(tzinfo=None)


st.subheader("Date, time and datetime types")
datetime_df = pd.DataFrame(
    {
        "datetime": [random_date(start_date, end_date) for _ in range(n_rows)] + [None],
        "time": [random_date(start_date, end_date).time() for _ in range(n_rows)]
        + [None],
        "date": [random_date(start_date, end_date).date() for _ in range(n_rows)]
        + [None],
        "mixed datetime": [
            random.choice(
                [
                    pd.Timestamp(random_date(start_date, end_date)),
                    np.datetime64("2022-03-11T17:13:00")
                    - np.random.randint(400000, 1500000),
                    pd.to_datetime(10, unit="s"),
                ]
            )
            for _ in range(n_rows)
        ]
        + [None],
        "pd_datetime + TZ": [
            (pd.to_datetime("2022-03-11 17:41:00-05:00")) for _ in range(n_rows)
        ]
        + [None],
        "datetime + UTC TZ": [
            random_date(start_date, end_date).replace(tzinfo=datetime.timezone.utc)
            for _ in range(n_rows)
        ]
        + [None],
        # TODO: Mixed timezones within a column will force the column to be of type object
        # It also seems to not work correctly.
        "mixed timezones": [
            random.choice(
                [
                    random_date(start_date, end_date).replace(
                        tzinfo=datetime.timezone.utc
                    ),
                    pd.to_datetime("2022-03-11 17:41:00-05:00"),
                    random_date(start_date, end_date),
                ]
            )
            for _ in range(n_rows)
        ]
        + [None],
    }
)

st.dataframe(datetime_df.dtypes)
st.dataframe(datetime_df.copy(), use_container_width=True)
st.experimental_data_editor(datetime_df.copy(), use_container_width=True)

st.subheader("List types")
list_types_df = pd.DataFrame(
    {
        "string-list": pd.Series(
            [["a", "b", "c"], ["foo", "bar"], list(["lorem"]), [], None]
        ),
        "number-set": pd.Series([{1, 2, 3}, {2, 3}, {4, 4}, set(), None]),
        "boolean_tuple": [
            (True, False),
            (False, True, True),
            (True, True),
            tuple(),
            None,
        ],
        "dict-list": [
            [{"foo": random.randint(0, 1000), "bar": "blub"} for _ in range(2)]
            for _ in range(4)
        ]
        + [None],
        "datetime_list": [
            [random_date(start_date, end_date) for _ in range(2)] for _ in range(4)
        ]
        + [None],
    }
)

st.dataframe(list_types_df.dtypes)
st.dataframe(list_types_df.copy(), use_container_width=True)
st.experimental_data_editor(list_types_df.copy(), use_container_width=True)

st.subheader("Special types")
special_types_df = pd.DataFrame(
    {
        "categorical": pd.Series(["a", "b", "c", "a", None]).astype("category"),
        "decimal": pd.Series(
            [Decimal("1.1"), Decimal("2.2"), Decimal("10000"), Decimal("-2.2123"), None]
        ),
        "bytes": pd.Series(
            [
                b"foo",
                b"bar",
                b"lorem",
                b"ipsum",
                None,
            ]
        ),
        "interval": [pd.Interval(left=i, right=i + 1, closed="both") for i in range(5)],
    }
)

st.dataframe(special_types_df.dtypes)
st.dataframe(special_types_df.copy(), use_container_width=True)
st.experimental_data_editor(special_types_df.copy(), use_container_width=True)


class TestObject(object):
    def __str__(self):
        return "TestObject"


st.subheader("Unsupported types")
unsupported_df = pd.DataFrame(
    {
        "period[H]": [
            (pd.Period("2022-03-14 11:52:00", freq="H") + pd.offsets.Hour(i))
            for i in range(3)
        ],
        "period[D]": [
            (pd.Period(random_date(start_date, end_date).date(), freq="D"))
            for _ in range(3)
        ],
        "complex": pd.Series([1 + 2j, 3 + 4j, 5 + 6 * 1j]),
        "timedelta": pd.Series(
            [pd.Timedelta("1 days"), np.timedelta64(366, "D"), pd.Timedelta("2 hours")]
        ),
        "decimal": pd.Series([Decimal("1.1"), Decimal("2.2"), Decimal("10000")]),
        "mixed-integer": pd.Series([1, 2, "3"]),
        "mixed-types": pd.Series([2.1, "3", True]),
        "frozenset": pd.Series(
            [frozenset([1, 2]), frozenset([3, 4]), frozenset([5, 6])]
        ),
        "dicts": pd.Series([{"a": 1}, {"b": 2}, {"c": 2}]),
        "objects": pd.Series([TestObject(), TestObject(), TestObject()]),
        # TODO(lukasmasuch): Not supported, but currently leads to error
        # "mixed_types_list": pd.Series(
        #     [random.choice([1, 1.0, None, "foo"]) for _ in range(10)]
        #     for _ in range(n_rows)
        # ),
        # TODO(lukasmasuch): Sparse array is supported, but currently leads to error
        # "sparse-array": pd.Series(
        #     pd.arrays.SparseArray([random.choice([0, 1, 2]) for _ in range(n_rows)])
        # ),
    }
)

st.dataframe(unsupported_df.dtypes)
st.dataframe(unsupported_df.copy(), use_container_width=True)
st.experimental_data_editor(unsupported_df.copy(), use_container_width=True)
