#!./streamlit_run

from streamlit import io
import numpy as np

with io.echo():
    table = np.random.randn(200, 200)
    io.write(table)
