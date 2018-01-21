"""Helper functions to marshall a pandas.DataFrame into a protobuf.Dataframe."""

import numpy as np
import pandas as pd
from tiny_notebook import protobuf

def marshall_data_frame(pandas_df, proto_df):
    """
    Converts a pandas.DataFrame into a protobuf.DataFrame.

    pandas_df - Panda.DataFrame (input)
    proto_df  - Protobuf.DataFrame (output)
    """
    pandas_df_data = (pandas_df[col] for col in pandas_df.columns)
    marshall_table(pandas_df_data, proto_df.data)
    marshall_index(pandas_df.columns, proto_df.columns)
    marshall_index(pandas_df.index, proto_df.index)

def marshall_index(pandas_index, proto_index):
    """
    Converts an pandas.Index into a protobuf.Index.

    pandas_index - Panda.Index or related (input)
    proto_index  - Protobuf.Index (output)
    """
    if type(pandas_index) == pd.Index:
        marshall_any_array(pandas_index.data, proto_index.plain_index.data)
    elif type(pandas_index) == pd.MultiIndex:
        for level in pandas_index.levels:
            marshall_index(level, proto_index.multi_index.levels.add())
        for label in pandas_index.labels:
            proto_index.multi_index.labels.add().data.extend(label)
    elif type(pandas_index) == pd.RangeIndex:
        proto_index.range_index.start = pandas_index.min()
        proto_index.range_index.stop = pandas_index.max() + 1
        proto_index.range_index.step = 1
    elif type(pandas_index) == pd.Int64Index:
        proto_index.int_64_index.data.data.extend(pandas_index)
    else:
        raise RuntimeError(f"Can't handle {type(pandas_index)} yet.")

def marshall_table(pandas_table, proto_table):
    """
    Converts a sequence of 1d arrays into protobuf.Table.

    pandas_table - Sequence of 1d arrays which are AnyArray compatible (input).
    proto_table  - Protobuf.Table (output)
    """
    for pandas_array in pandas_table:
        marshall_any_array(pandas_array, proto_table.cols.add())

def marshall_any_array(pandas_array, proto_array):
    """
    Converts a 1D numpy.Array into a protobuf.AnyArray.

    pandas_array - 1d arrays which is AnyArray compatible (input).
    proto_array  - Protobuf.AnyArray (output)
    """
    # Convert to np.array as necessary.
    if not hasattr(pandas_array, 'dtype'):
        pandas_array = np.array(pandas_array)

    # Only works on 1D arrays.
    assert len(pandas_array.shape) == 1, 'Array must be 1D.'

    # Perform type-conversion based on the array dtype.
    if pandas_array.dtype == np.float64:
        proto_array.doubles.data.extend(pandas_array)
    elif pandas_array.dtype == np.object:
        proto_array.strings.data.extend(pandas_array.astype(np.str))
    else:
        raise RuntimeError(f'Dtype {array.dtype} not understood.')
