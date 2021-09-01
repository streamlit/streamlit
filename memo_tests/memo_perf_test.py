import time

import streamlit as st
import pandas as pd
import numpy as np

from streamlit.legacy_caching import caching
from streamlit.memo import memo


def timed(name, func, *args, **kwargs):
    start = time.time()
    value = func(*args, **kwargs)
    end = time.time()
    st.write(f"'{name}':", (end - start), " seconds")
    # st.write(value)


def _create_dataframe(size: int) -> pd.DataFrame:
    return pd.DataFrame(np.random.randint(0, 100, size=(size, 1)))


size = int(st.number_input("size", min_value=1, value=100_000_000, step=10_000))

create_dataframe_raw = _create_dataframe
create_dataframe_memo = st.memo(_create_dataframe, persist=False)
create_dataframe_cache = st.cache(_create_dataframe, persist=False)

memo.clear_cache()
caching.clear_cache()

timed("raw (1)", create_dataframe_raw, size)
timed("raw (2)", create_dataframe_raw, size)

timed("@st.memo (cache miss)", create_dataframe_memo, size)
timed("@st.memo (cache hit)", create_dataframe_memo, size)

timed("@st.cache (cache miss)", create_dataframe_cache, size)
timed("@st.cache (cache hit)", create_dataframe_cache, size)
