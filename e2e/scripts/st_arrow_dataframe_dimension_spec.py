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

import streamlit as st
import numpy as np
import pandas as pd

# Explicitly seed the RNG for deterministic results
np.random.seed(0)

data = np.random.randn(100, 100)

df = pd.DataFrame(data)
st._arrow_dataframe(df)
st._arrow_dataframe(df, 250, 150)
st._arrow_dataframe(df, width=250)
st._arrow_dataframe(df, height=150)
