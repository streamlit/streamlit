# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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
import altair as alt

df = pd.DataFrame(np.random.randn(200, 3), columns=["a", "b", "c"])

c = alt.Chart(df).mark_circle().encode(x="a", y="b", size="c", color="c").interactive()

st.title("These two should look exactly the same")

st.write("Altair chart using `st.altair_chart`:")
st.altair_chart(c)

st.write("And the same chart using `st.write`:")
st.write(c)
