#!./streamlit_run

from streamlit import io, cache
import numpy as np
import pandas as pd
import time
import sys

import json

io.write('Hello world.')
io.write(dir(json))
io.help(json.load)
# io.line_chart(np.random.randn(100, 3), height=300)

@cache
def open_json():
    with open('swift-gnss-20180405-180845.sbp.expanded.json') as file:
        return [json.loads(line) for line in file.readlines()]

io.write('getting the json')
data = open_json()
io.write('got the json')
io.write(id(data))
io.write(len(data))
io.write([type(entry) for entry in data[:10]])
io.json(data[:10])
df = pd.DataFrame(data)
io.write(df)
# with streamlit.render():
#     x = 1
#     y = 2
#     io.write(x, y)
