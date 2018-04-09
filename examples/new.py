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
def tester(x):
    io.write(f'computing `tester({x})`')
    if bool(random.randint(0,1)):
        raise RuntimeError('Exception at ' + str(x))
    return x

for i in range(10):
    for j in range(3):
        io.write(f'i={i} j={j}')
        try:
            io.write(tester(i))
        except Exception as e:
            io.exception(e)
