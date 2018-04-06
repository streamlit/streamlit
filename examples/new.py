import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys
import time
import random

import streamlit

@streamlit.cache
def long_running_identity(x):
    time.sleep(2)
    return x * 2

# import streamlit.local.connection
# delta_generator = streamlit.local.connection.get_delta_generator()
# delta_generator('hello, my little world!!!')
# print('Got the delta_generator', delta_generator)

from streamlit import io
print(io)
print(dir(io))
print(io.hello())
print(help(io.hello))
io.goodbye()
io.fancy_()
io.fancy__()

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
# #     write('result:', long_running_identity(12345))
# #     write('pwd', os.getcwd())
