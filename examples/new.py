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
    print('Hello world 6.')
    print('Hello world *BLAH*.')
    # print('Hello world 2.')
    # print('Starting the loop')
    # for i in range(100):
    #     print('i', i)
    # print('Finished the loop')

    an_array = np.random.randn(5, 5)
    print(an_array)
    print(an_array.shape)

    my_progress = print.progress(0)
    for i in range(5):
        my_progress.progress((i+1) % 101)
        time.sleep(0.05)
        i += 1
