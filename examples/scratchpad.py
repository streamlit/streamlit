#!./streamlit_run

from streamlit import io, cache

import json
import numpy as np
import pandas as pd
import string
import sys
import time


@cache
def open_json():
    with open('swift-gnss-20180405-180845.sbp.expanded.json') as file:
        return [json.loads(line) for line in file.readlines()]

io.write(np.random.randn(200, 200))
io.write(pd.DataFrame(open_json()))

# big_array = np.empty((1000, 100), dtype=np.object)
# for column in range(big_array.shape[1]):
#     value = string.ascii_lowercase[column % 26] * (column % 51 + 1)
#     big_array[:,column] = value
# io.write(big_array, big_array.dtype)

# io.subheader('str_array')
# str_array = np.array([['abc']])
# io.write(str_array)
# io.write(str_array.astype(np.str))
# io.write(type(str_array.dtype))
