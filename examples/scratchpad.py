#!./streamlit_run

from streamlit import io, cache

import json
import numpy as np
import pandas as pd
import string
import sys
import time

# @cache
# def open_json():
#     with open('swift-gnss-20180405-180845.sbp.expanded.json') as file:
#         return [json.loads(line) for line in file.readlines()][:10]
#
# @cache
# def something_funny():
#     time.sleep(3.0)
#     return 123
#
# io.write('something_funny:', something_funny())
# io.write(pd.DataFrame(open_json()))

data = pd.DataFrame()
data['labels'] = list(string.ascii_lowercase[:10])
data['frequencies'] = np.array(list(range(10))) * 4
data.set_index('labels', inplace=True)
io.write(data)
io.bar_chart(data)

# io.bar_chart(list(range(10)))

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
