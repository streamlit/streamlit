import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys
import time

sys.path.append('local/server')
from streamlet import Notebook, Chart

with Notebook() as write:
    # Get the latest notebook and print out information from it.
    last_mnist = Notebook.ref('mnist:last')
    write('Here is the contents lastest mnist notebook:')
    write(latest_mnist)

    # Get the last 5 graphs and display them.
    write('Here are a set of summary graphs.')
    for notebook in Notebook.ref('mnist:-5'):
        name = notebook.ref('name/2')
        summary = notebook.ref('summary')
        write(f'Notebook {name}')
        write(summary)

    # Here is one way of overlaying them
    names, tables = []
    for notebook in Notebook.ref('mnist:-5'):
        names.append(notebook.get('name/2'))
        tables.append(notebook.ref('summary/loss'))
    write(streamlet.concat(tables, columns=names))

    # Here is a faster way of overlaying them
    names = Notebook.ref('mnist:-5/name/2')
    table = Notebook.ref('mnist:-5/summary/loss').concat(columns=names)
    write(table)
