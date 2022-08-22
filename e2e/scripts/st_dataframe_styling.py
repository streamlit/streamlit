# Copyright 2018-2022 Streamlit Inc.
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


import numpy as np
import pandas as pd

import streamlit as st


# Create a dataframe to be styled in various ways.
np.random.seed(24)  # Produce the same values everytime the test is run.
generic_df: pd.DataFrame = pd.DataFrame(
    {x: np.random.randn(2) for x in ["A", "B", "C", "D", "E"]}
)

# Render dataframe with background-color value of blue spec'd. in plaintext.
st.dataframe(generic_df.style.set_properties(**{"background-color": "red"}))
# render dataframe with background-color value of blue spec'd. in hexadecimal.
st.dataframe(generic_df.style.set_properties(**{"background-color": "#0000FF"}))
# render dataframe with background-color value of blue spec'd in hsl
st.dataframe(
    generic_df.style.set_properties(**{"background-color": "hsl(240, 100%, 50%)"})
)
# render dataframe with background-color value of blue in spec'd in rgb.
st.dataframe(generic_df.style.set_properties(**{"background-color": "rgb(0, 0, 255)"}))
