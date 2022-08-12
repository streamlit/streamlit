import streamlit as st
import pandas as pd

df = pd.DataFrame({"test": [3.14, 3.1]})
st._legacy_dataframe(df.style.format({"test": "{:.2f}"}))
