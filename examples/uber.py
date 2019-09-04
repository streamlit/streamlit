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

"""An example of showing geographic data."""

import streamlit as st
import pandas as pd
import numpy as np
import sys

DATE_TIME = 'date/time'
DATA_URL = 'http://s3-us-west-2.amazonaws.com/streamlit-demo-data/uber-raw-data-sep14.csv.gz'

st.title('Uber Example')

@st.cache(persist=True)
def load_data(nrows):
    data = pd.read_csv(DATA_URL, nrows=nrows)
    lowercase = lambda x: str(x).lower()
    data.rename(lowercase, axis='columns', inplace=True)
    data[DATE_TIME] = pd.to_datetime(data[DATE_TIME])
    return data

data = load_data(100000)

st.subheader('Pickups by hour')
st.bar_chart(np.histogram(data[DATE_TIME].dt.hour, bins=24, range=(0,24))[0])

hour = st.sidebar.slider('Hour to look at', 0, 23)

data = data[data[DATE_TIME].dt.hour == hour]

st.subheader('Pickup locations at %ih' % hour)
st.map(data[data[DATE_TIME].dt.hour == hour])

st.subheader('Pickup breakdown by minute at %ih' % hour)
st.bar_chart(np.histogram(data[DATE_TIME].dt.minute, bins=60, range=(0,60))[0])

st.subheader('Raw data at %ih' % hour)
st.write(data)
