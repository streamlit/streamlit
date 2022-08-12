import streamlit as st
import pandas as pd

"## Table Caption"
df = pd.DataFrame([["foo", 100], ["bar", 200]])
styler = df.style.set_caption("The caption")
st._arrow_table(styler)

"## CategoricalIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.CategoricalIndex([1, 2]),
)
st._arrow_table(df)

"## IntervalIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.interval_range(start=0, end=2),
)
st._arrow_table(df)

"## MultiIndex Styler"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=[["a", "b"], [1, 2]],
)
styler = df.style.highlight_max()
st._arrow_table(styler)

"## MultiIndex `add_rows()`"
df1 = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=[["a", "b"], [1, 2]],
)
df2 = pd.DataFrame(
    [["baz", 300], ["qux", 400]],
    index=[["c", "d"], [3, 4]],
)
table = st._arrow_table(df1)
table._arrow_add_rows(df2)

"## RangeIndex `step`"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]], index=pd.RangeIndex(start=10, stop=30, step=10)
)
st._arrow_table(df)

"## `Pandas.NaT`"
df = pd.DataFrame([[pd.NaT, 100], [pd.NaT, 200]])
st._arrow_table(df)
