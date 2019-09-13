import streamlit as st
import pandas as pd

chart_data = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])

st.bar_chart(chart_data)
