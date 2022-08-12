import pandas as pd

import streamlit as st

# NOTE: DO NOT CHANGE the order of elements.
# Otherwise, snapshots will fail.

"## CategoricalIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.CategoricalIndex([1, 2]),
)
st._arrow_table(df)

"## DatetimeIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.Series(pd.date_range("2021-01-01", periods=2, freq="Y")),
)
st._arrow_table(df)

"## Float64Index"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.Float64Index([1.23, 2.34]),
)
st._arrow_table(df)

"## Int64Index"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=[1, 2],
)
st._arrow_table(df)

"## IntervalIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.interval_range(start=0, end=2),
)
st._arrow_table(df)

"## MultiIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=[["a", "b"], [1, 2]],
)
st._arrow_table(df)

"## PeriodIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.PeriodIndex(year=[2000, 2002], quarter=[1, 3]),
)
st._arrow_table(df)

"## RangeIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
)
st._arrow_table(df)

"## UInt64Index"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.UInt64Index([1, 2]),
)
st._arrow_table(df)

"## UnicodeIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=["a", "b"],
)
st._arrow_table(df)
