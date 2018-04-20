#!./streamlit_run

from streamlit import io
import numpy as np
import time
import sys

import contextlib

io.help(sys.exc_info)

# io.line_chart(np.random.randn(100, 3), height=300)

# with streamlit.render():
#     x = 1
#     y = 2
#     io.write(x, y)
