# -*- coding: future_fstrings -*-

"""The crypt of top secret undocumented Streamlit API calls."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import streamlit as st
import numpy as np
import pandas as pd
from datetime import datetime

st.title('Apocrypha')

st.write('The crypt of top secret _undocumented_ Streamlit API calls.')

st.header('Tables')
with st.echo():
    arrays = [
        np.array(['bar', 'bar', 'baz', 'baz', 'foo', None , 'qux', 'qux']),
        np.array(['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two'])]

    df = pd.DataFrame(np.random.randn(8, 4), index=arrays,
        columns=[datetime(2012, 5, 1), datetime(2012, 5, 2), datetime(2012, 5, 3), datetime(2012, 5, 4)])

    st.subheader("A table")
    st.table(df)

    st.subheader("...and its transpose")
    st.table(df.T)

st.header('Maps')
st.warning('TODO: Need to document the st.map() API here.')

st.balloons()
