"""The crypt of top secret undocumented Streamlit API calls."""

import streamlit as st
import numpy as np
import pandas as pd
from datetime import datetime

st.title('Tables')

for c in [1, 2, 5, 20]:
    for r in [1, 2, 3, 4, 5, 6, 7, 8, 20]:
        df = pd.DataFrame(np.random.randn(c, r), index=range(c),
            columns=range(r))

        st.write(df)
