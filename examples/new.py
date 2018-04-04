import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys
import time
import random

sys.path.append('/Users/adrien/Desktop/streamlet-cloud/local/server')
from streamlit import Notebook, Chart
import streamlit

@streamlit.memoize
def long_running_identity(x):
    time.sleep(10)
    return x

with Notebook() as write:
    write('hello world')
    an_array = np.random.randn(200, 200)
    write(an_array)
    write.alert('About to run a long-running function.')
    write('result:', long_running_identity(1234))
