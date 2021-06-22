# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

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
st.arrow_vega_lite_chart(spec, use_container_width=True)
fig, ax = plt.subplots()
st.pyplot(fig, use_container_width=True)
st.arrow_line_chart()
st.arrow_bar_chart()
st.arrow_area_chart()

# 1 empty map
# comment this one out to avoid this Cypress-Mapbox related error.
# ref: https://github.com/cypress-io/cypress/issues/4322
# st.pydeck_chart()
# st.map()

# 6 errors
try:
    st.arrow_vega_lite_chart({}, use_container_width=True)
except Exception as e:
    st.write(e)

try:
    st.arrow_vega_lite_chart(data, {}, use_container_width=True)
except Exception as e:
    st.write(e)

try:
    st.arrow_vega_lite_chart(data, use_container_width=True)
except Exception as e:
    st.write(e)

try:
    st.arrow_vega_lite_chart(use_container_width=True)
except Exception as e:
    st.write(e)

try:
    st.arrow_altair_chart(use_container_width=True)
except Exception as e:
    st.write(e)
