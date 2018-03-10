import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys
import time
import random

sys.path.append('local/server')
from streamlet import Notebook, Chart

with Notebook() as print:
    print('hello world')
    my_array = np.random.randn(200, 200)
    print('my array', my_array)
