import streamlit as st
import numpy as np
import pandas as pd

data = np.random.randn(20, 3)
df = pd.DataFrame(data, columns=["a", "b", "c"])
st._legacy_area_chart(df)
