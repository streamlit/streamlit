import sys

import streamlit as st

st.dataframe()
st.write("Hello, World!")

st.write(sys.modules)

st.write("Lazy-loaded modules:")

st.write("pandas: ", "pandas" in sys.modules)
st.write("altair: ", "altair" in sys.modules)
st.write("pyarrow: ", "pyarrow" in sys.modules)
st.write("requests: ", "requests" in sys.modules)
st.write("rich: ", "rich" in sys.modules)
st.write("tenacity: ", "tenacity" in sys.modules)
st.write("pydeck: ", "pydeck" in sys.modules)
st.write("bokeh: ", "bokeh" in sys.modules)

st.write("numpy: ", "numpy" in sys.modules)
st.write("matplotlib: ", "matplotlib" in sys.modules)
st.write("pillow: ", "PIL" in sys.modules)
st.write("plotly: ", "plotly" in sys.modules)
st.write("toml: ", "toml" in sys.modules)
st.write("watchdog: ", "watchdog" in sys.modules)
st.write("gitpython: ", "git" in sys.modules)
