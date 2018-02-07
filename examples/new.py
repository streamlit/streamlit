"""Test scripts to see if the server is working."""

import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys

sys.path.append('local/server')
from streamlet import Notebook, Chart

with Notebook() as write:
    write('Hello world.')

    x = np.random.randn(100, 100)
    write(x.shape)
    write(x)
