import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys
import time

from streamlit import write, Report

# Get the latest report and print out information from it.
last_mnist = Report.ref('mnist:last')
write('Here is the contents lastest mnist report:')
write(latest_mnist)

# Get the last 5 graphs and display them.
write('Here are a set of summary graphs.')
for report in Report.ref('mnist:-5'):
    name = report.ref('name/2:')
    summary = report.ref('summary')
    write(f'Report {name}')
    write(summary)

# Here is one way of overlaying them
names, tables = []
for report in Report.ref('mnist:-5'):
    names.append(report.get('name/2:'))
    tables.append(report.ref('summary/loss'))
write(streamlit.concat(tables, columns=names))

# Here is a faster way of overlaying them
names = Report.ref('mnist:-5/name/2:')
table = Report.ref('mnist:-5/summary/loss').concat(columns=names)
write(table)
