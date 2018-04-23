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
#         return [json.loads(line) for line in file.readlines()]
#
# json_data = open_json()
# io.write(pd.DataFrame(json_data))
# io.json(json_data)

data = pd.DataFrame()
data['labels'] = list(string.ascii_lowercase[:10])
data['frequencies'] = list(range(10))
data.set_index('labels', inplace=True)
io.write(data)
io.bar_chart(data)
