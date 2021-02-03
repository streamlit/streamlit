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

"""This script demonstrates animation in streamlit."""

import streamlit as st
import numpy as np
import time
import pandas as pd

# import shapefile

st.empty()
my_bar = st.progress(0)
for i in range(100):
    my_bar.progress(i + 1)
    time.sleep(0.1)
n_elts = int(time.time() * 10) % 5 + 3
for i in range(n_elts):
    st.text("." * i)
st.write(n_elts)
for i in range(n_elts):
    st.text("." * i)
st.success("done")
