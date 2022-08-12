import matplotlib.pyplot as plt
import streamlit as st
import pandas as pd

data = pd.DataFrame({"a": [1, 2, 3, 4], "b": [1, 3, 2, 4]})

spec = {
    "mark": "line",
    "encoding": {
        "x": {"field": "a", "type": "quantitative"},
        "y": {"field": "b", "type": "quantitative"},
    },
}

# 5 empty charts
st._legacy_vega_lite_chart(spec, use_container_width=True)
fig, ax = plt.subplots()
st.pyplot(fig)
st._legacy_line_chart()
st._legacy_bar_chart()
st._legacy_area_chart()

# 1 empty map
# comment this one out to avoid this Cypress-Mapbox related error.
# ref: https://github.com/cypress-io/cypress/issues/4322
# st.pydeck_chart()
# st.map()

# 6 errors
try:
    st._legacy_vega_lite_chart({}, use_container_width=True)
except Exception as e:
    st.write(e)

try:
    st._legacy_vega_lite_chart(data, {}, use_container_width=True)
except Exception as e:
    st.write(e)

try:
    st._legacy_vega_lite_chart(data, use_container_width=True)
except Exception as e:
    st.write(e)

try:
    st._legacy_vega_lite_chart(use_container_width=True)
except Exception as e:
    st.write(e)

try:
    st._legacy_altair_chart(use_container_width=True)  # type: ignore[call-arg]
except Exception as e:
    st.write(e)
