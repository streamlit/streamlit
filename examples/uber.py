# -*- coding: future_fstrings -*-

"""An example of showing geographic data."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from streamlit import st, cache
import pandas as pd
import numpy as np

DATE_TIME = 'date/time'
DATA_URL = 'https://s3-us-west-2.amazonaws.com/streamlit-demo-data/uber-raw-data-sep14.csv.gz'

st.title('Uber Example')

@cache
def load_data(nrows):
    data = pd.read_csv(DATA_URL, nrows=nrows)
    data.rename(str.lower, axis='columns', inplace=True)
    data[DATE_TIME] = pd.to_datetime(data[DATE_TIME])
    return data

def display_uber_data(hour):
    data = load_data(100000)
    data = data[data[DATE_TIME].dt.hour == hour]

    st.subheader(f'Geo Data at {hour}h')
    st.map(data[data[DATE_TIME].dt.hour == hour])

    st.subheader(f'Usage By Minute at {hour}h')
    st.bar_chart(np.histogram(data[DATE_TIME].dt.minute, bins=60, range=(0,60))[0])

    st.subheader(f'Raw Data at {hour}h')
    st.write(data)

if __name__ == '__main__':
    hour = 0
    assert 0 <= hour < 24
    display_uber_data(hour)
