#!./streamlit_run

import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys
import time
import random

from streamlit import io, cache

# def hook(exctype, value, tb):
#     sys.excepthook = old_hook
#     io.text(exctype.__name__)
#     # io.json(dir(value))
#     # io.write(value)
#     # print(list(traceback))
#     # io.help(type(traceback))
#     # io.text(traceback.extract_stack(traceback.extract_tb(tb)))
#     io.json(traceback.format_list(traceback.extract_tb(tb)))
# old_hook = sys.excepthook
# sys.excepthook = hook

# io.text('Here is some text.')
# raise RuntimeError('This was raised after the text was written.')
# io.text('Here is some text.')

io.json("{")
