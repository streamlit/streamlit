import streamlit as st
import pandas as pd
import numpy as np

chart_data = pd.DataFrame(np.random.randn(50, 3), columns=["a", "b", "c"])

st.bar_chart(chart_data)
