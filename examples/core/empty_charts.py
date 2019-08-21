import streamlit as st
import pandas as pd

import time
import random

data = pd.DataFrame({
    'a': [1, 2, 3, 4],
    'b': [1, 3, 2, 4],
})

spec = {
    'mark': 'line',
    'encoding': {
        'x': {'field': 'a', 'type': 'quantitative'},
        'y': {'field': 'b', 'type': 'quantitative'},
    },
}

# 2 empty charts
st.vega_lite_chart(spec)
st.pyplot()

# 1 empty map
st.deck_gl_chart()

# 10 errors
try:
    st.vega_lite_chart({})
except Exception as e:
    st.write(e)

try:
    st.vega_lite_chart(data, {})
except Exception as e:
    st.write(e)

try:
    st.vega_lite_chart(data)
except Exception as e:
    st.write(e)

try:
    st.vega_lite_chart()
except Exception as e:
    st.write(e)

try:
    st.altair_chart()
except Exception as e:
    st.write(e)

try:
    st.line_chart()
except Exception as e:
    st.write(e)

try:
    st.area_chart()
except Exception as e:
    st.write(e)

try:
    st.bar_chart()
except Exception as e:
    st.write(e)

try:
    st._native_chart()
except Exception as e:
    st.write(e)

try:
    st.map()
except Exception as e:
    st.write(e)
