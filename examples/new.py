import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys
import time
import random

sys.path.append('/Users/adrien/Desktop/streamlet-cloud/local/server')
from streamlit import Notebook, Chart

with Notebook() as write:
    write('hello world zzz')
    an_array = np.random.randn(200, 2)
    write(an_array)
    write.line_chart(an_array)
