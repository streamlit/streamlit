from streamlit import io
import numpy as np
import pandas as pd
from datetime import datetime

io.title('Apocrypha')

io.write('This is a set of "undocumented" Streamlit API calls.')

io.header('Tables')
with io.echo():
    arrays = [
        np.array(['bar', 'bar', 'baz', 'baz', 'foo', 'foo', 'qux', 'qux']),
        np.array(['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two'])]

    df = pd.DataFrame(np.random.randn(8, 4), index=arrays,
        columns=[datetime(2012, 5, 1), datetime(2012, 5, 2), datetime(2012, 5, 3), datetime(2012, 5, 4)])

    io.table(df)
    io.table(df.T)

io.header('Maps')
io.warning('TODO: Need to document the io.map() API here.')
