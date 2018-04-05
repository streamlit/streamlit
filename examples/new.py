import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys
import time
import random

import streamlit
from streamlit import Notebook

@streamlit.cache
def long_running_identity(x):
    time.sleep(2)
    return x * 2

with Notebook() as write:
    write('hello world')
    write('123', long_running_identity('123456'))

# with Notebook() as write:
#     write('hello world')
#     an_array = np.random.randn(200, 200)
#     write(an_array)
#     write.alert('About to run a long-running function.')
#     write('result:', long_running_identity(12345))
#     write('pwd', os.getcwd())
