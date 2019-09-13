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

"""The crypt of top secret undocumented Streamlit API calls."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims

setup_2_3_shims(globals())

import streamlit as st
import numpy as np
import pandas as pd
from datetime import datetime

st.title("Apocrypha")

st.write("The crypt of top secret _undocumented_ Streamlit API calls.")

st.header("Tables")
with st.echo():
    arrays = [
        np.array(["bar", "bar", "baz", "baz", "foo", None, "qux", "qux"]),
        np.array(["one", "two", "one", "two", "one", "two", "one", "two"]),
    ]

    df = pd.DataFrame(
        np.random.randn(8, 4),
        index=arrays,
        columns=[
            datetime(2012, 5, 1),
            datetime(2012, 5, 2),
            datetime(2012, 5, 3),
            datetime(2012, 5, 4),
        ],
    )

    st.subheader("A table")
    st.table(df)

    st.subheader("...and its transpose")
    st.table(df.T)

st.header("Maps")
st.warning("TODO: Need to document the st.map() API here.")

st.balloons()
