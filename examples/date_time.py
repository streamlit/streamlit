"""Example of everything that's possible in streamlit."""

import sys

import pandas as pd
import numpy as np
from datetime import datetime

from streamlit import Notebook, Chart, LineChart

with Notebook() as write:

    write("# Datetime Example", fmt='markdown')

    rng = pd.date_range('1/1/2011', periods=16, freq='H')
    ts = pd.Series(np.random.randn(len(rng)), index=rng)
    write(ts)
    write.line_chart(ts)

    rng = np.vectorize(lambda x: datetime(2012, 5, x))(np.random.randint(1, 30, size=len(rng)))
    ts = pd.Series(rng, index=list(range(len(rng))))
    write(ts)
