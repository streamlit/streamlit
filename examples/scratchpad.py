#!./streamlit_run

from streamlit import io
import numpy as np
import time

io.write('Hello world!')

an_array = np.random.randn(200, 8)
io.write(an_array)
io.line_chart(an_array)

my_bar = io.progress(0)
for i in range(1, 101):
    my_bar.progress(i)
    time.sleep(0.1)
