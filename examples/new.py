#!./streamlit_run

import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys
import time
import random

from streamlit import io, cache


@cache
def fibo(x):
    io.write(f'Compputing fibo({x}).')
    if x <= 1:
        return 1
    else:
        return fibo(x - 1) + fibo(x-2)

# import streamlit.local.connection
# delta_generator = streamlit.local.connection.get_delta_generator()
# delta_generator('hello, my little world!!!')
# print('Got the delta_generator', delta_generator)

io.text('The answer is: ')
io.text(str(fibo(10)))
io.text(str(fibo(10)))

# print('hello world')
# report = streamlit.Report()
# print('Created a report', report)
# try:
#     print('Opening this report')
#     report.register()
#     report.get_delta_generator()('hello world')
# finally:
#     print('Closing this report')
#     report.unregister()
#
# # with Report() as write:
# #     write('hello world')
# #     an_array = np.random.randn(200, 200)
# #     write(an_array)
# #     write.alert('About to run a long-running function.')
# #     write('result:', long_running_double(12345))
# #     write('pwd', os.getcwd())
