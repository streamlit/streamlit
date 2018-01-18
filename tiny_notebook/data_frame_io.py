"""Helper functions to marshall a pandas.DataFrame into a protobuf.Dataframe."""

import numpy as np
import pandas as pd
from tiny_notebook import protobuf

def marshall_data_frame(df):
    """Converts a pandas.DataFrame into a protobuf.DataFrame."""
    result = protobuf.DataFrame()
    result.data.CopyFrom(marshall_table(df[col] for col in df.columns))
    result.columns.CopyFrom(marshall_index(df.columns))
    result.index.CopyFrom(marshall_index(df.index))
    return result

def marshall_index(index):
    """Converts an pandas.Index into a protobuf.Table."""
    if type(index) == pd.MultiIndex:
        indices = [np.array(levels[idx]) for (levels, idx) in
                    zip(index.levels, index.labels)]
    else:
        indices = [index]
    return marshall_table(indices)

def marshall_table(table):
    """Converts a sequence of 1d arrays into protobuf.Table."""
    result = protobuf.Table()
    result.cols.extend(marshall_1d_array(array) for array in table)
    return result

def marshall_1d_array(array):
    """Converts a 1D numpy.Array into a protobuf.AnyArray."""
    assert len(array.shape) == 1, 'Array must be 1D.'
    result = protobuf.AnyArray()
    if array.dtype == np.float64:
        result.doubles.data.extend(array)
    elif array.dtype == np.object:
        result.strings.data.extend(array.astype(np.str))
    else:
        raise RuntimeError(f'Dtype {array.dtype} not understood.')
    return result
