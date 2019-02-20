# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""A "Hello World" report."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import streamlit as st
import numpy as np
import time


def run():
    st.title('Hello Streamlit!')
    st.write('''
        This is an example **Streamlit** report.

        If this is your first time using Streamlit, welcome! You may want to
        take a look at our
        [tutorials and documentation](https://streamlit.io/secret/docs) next.
        And feel free to ask us questions any time at
        [help@streamlit.io](mailto:help@streamlit.io).

        To celebrate this magic moment, below we're generating a bunch of
        random numbers in a loop for around 10 seconds. Enjoy!
    ''')

    progress_bar = st.progress(0)
    status_text = st.empty()
    chart = st.line_chart(np.random.randn(10, 1))

    for i in range(100):
        # Update progress bar.
        progress_bar.progress(i)

        new_rows = np.random.randn(10, 1)

        # Update status text.
        status_text.text(
            'The latest random number is: %s' % new_rows[-1, 0])

        # Append data to the chart.
        chart.add_rows(new_rows)

        # Pretend we're doing some computation that takes time.
        time.sleep(0.1)

    status_text.text('Done!')
    st.balloons()

    st.write('''
        PS: Want to know how we did this?
        [You can learn about it here.](https://streamlit.io/secret/docs/core_mechanics.html)
    ''')
