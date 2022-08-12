import streamlit as st
import numpy as np
import pandas as pd

np.random.seed(0)

data = np.random.randn(20, 3)
df = pd.DataFrame(data, columns=["a", "b", "c"])

st._arrow_bar_chart(df)
st._arrow_bar_chart(df, x="a")
st._arrow_bar_chart(df, y="a")
st._arrow_bar_chart(df, y=["a", "b"])
st._arrow_bar_chart(df, x="a", y="b")
st._arrow_bar_chart(df, x="b", y="a")
st._arrow_bar_chart(df, x="a", y=["b", "c"])
