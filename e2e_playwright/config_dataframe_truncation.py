import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)

df = pd.DataFrame(np.random.randn(50000, 20), columns=("col %d" % i for i in range(20)))
st.dataframe(df)

st.line_chart(df, x="col 1", y=["col 2", "col 3", "col 4", "col 5"])
