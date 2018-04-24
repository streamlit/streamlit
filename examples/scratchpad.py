#!./streamlit_run

from streamlit import io, cache

import json
import numpy as np
import pandas as pd
import string
import sys
import time

# @streamlit.cache
# def open_json(from_line, to_line):
#     with open('swift-gnss-20180405-180845.sbp.expanded.json') as file:
#         return [json.loads(line) for line in file.readlines()][from_line:to_line]
#
# json_data = open_json(0,100)
# io.write(pd.DataFrame(json_data))


timings = pd.DataFrame.from_records([
    {'method': 'no_cache', 'time': 123.0},
    {'method': 'cache',    'time': 345.0},
])

# timings.append(
# io.write(timings)

# io.json(json_data)
# data = pd.DataFrame()
# data['labels'] = list(string.ascii_lowercase[:10])
# data['frequencies'] = list(range(10))
# data.set_index('labels', inplace=True)
# io.write(data)
# io.bar_chart(data)
