import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys
import time

sys.path.append('local/server')
from streamlet import Notebook, Chart


with Notebook() as write:
    # Title.
    write('hello world')

    my_bar = write.progress(0)
    for i in range(100):
        my_bar.progress(i)
        time.sleep(0.1)

    # write('This notebook shows some of the awesome elements of printf.')
    #
    # # Arrays

    #
