import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys
import time
import random

sys.path.append('local/server')
from streamlet import Notebook, Chart

with Notebook() as write:
    write.header('My awesome program', level=3)
    write('hello my little world. I love you, too!! :)')
    my_array = np.random.randn(100, 100)
    write('my array', my_array)

    # print('About to sleep for 10 seconds.')
    # time.sleep(10.0)
    # print('Slept for 10 seconds.')

    # progress = write.progress(0)
    # for i in range(100):
    #     progress.progress(i)
    #     time.sleep(0.1)
