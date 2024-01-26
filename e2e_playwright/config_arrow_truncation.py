# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Nothing to do here since the deploy button is part of the frontend even
# without any Streamlit element being rendered.

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)

df = pd.DataFrame(np.random.randn(50000, 20), columns=("col %d" % i for i in range(20)))

st.dataframe(df)