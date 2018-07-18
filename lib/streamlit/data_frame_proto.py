# -*- coding: future_fstrings -*-

"""Helper functions to marshall a pandas.DataFrame into a protobuf.Dataframe."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from streamlit.logger import get_logger

import numpy as np
import pandas as pd
import tzlocal

LOGGER = get_logger()

def marshall_data_frame(pandas_df, proto_df):
    """
    Converts a pandas.DataFrame into a protobuf.DataFrame.

    pandas_df - Panda.DataFrame (input)
    proto_df  - Protobuf.DataFrame (output)
    """
    pandas_df_data = (pandas_df.iloc[:,col]
        for col in range(len(pandas_df.columns)))
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
        marshall_any_array(np.array(pandas_index), proto_index.plain_index.data)
    elif type(pandas_index) == pd.RangeIndex:
        proto_index.range_index.start = pandas_index.min()
        proto_index.range_index.stop = pandas_index.max() + 1
    elif type(pandas_index) == pd.MultiIndex:
        for level in pandas_index.levels:
            marshall_index(level, proto_index.multi_index.levels.add())
        for label in pandas_index.labels:
            proto_index.multi_index.labels.add().data.extend(label)
    elif type(pandas_index) == pd.DatetimeIndex:
        if pandas_index.tz is None:
            current_zone = tzlocal.get_localzone()
            pandas_index = pandas_index.tz_localize(current_zone)
        proto_index.datetime_index.data.data.extend(pandas_index.astype(np.int64))
    elif type(pandas_index) == pd.TimedeltaIndex:
        proto_index.timedelta_index.data.data.extend(pandas_index.astype(np.int64))
    elif type(pandas_index) == pd.Int64Index:
        proto_index.int_64_index.data.data.extend(pandas_index)
    elif type(pandas_index) == pd.Float64Index:
        proto_index.float_64_index.data.data.extend(pandas_index)
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
    if issubclass(pandas_array.dtype.type, np.floating):
        proto_array.doubles.data.extend(pandas_array)
    elif issubclass(pandas_array.dtype.type, np.timedelta64):
        proto_array.timedeltas.data.extend(pandas_array.astype(np.int64))
    elif issubclass(pandas_array.dtype.type, np.integer):
        proto_array.int64s.data.extend(pandas_array)
    elif pandas_array.dtype == np.bool:
        proto_array.int64s.data.extend(pandas_array)
    elif pandas_array.dtype == np.object:
        proto_array.strings.data.extend(map(str, pandas_array))
    elif issubclass(pandas_array.dtype.type, np.datetime64):
        if pandas_array.dt.tz is None:
            current_zone = tzlocal.get_localzone()
            pandas_array = pandas_array.dt.tz_localize(current_zone)
        proto_array.datetimes.data.extend(pandas_array.astype(np.int64))
    else:
        raise RuntimeError(f'Dtype {pandas_array.dtype} not understood.')

def add_rows(delta1, delta2):
    """Adds the rows from the DataFrame in delta2 to the DataFrame in delta1."""
    df1 = get_data_frame(delta1)
    df2 = get_data_frame(delta2)

    # print('ADDING ROWS')
    # print(delta1.WhichOneof('type'))
    # print(delta2.WhichOneof('type'))
    # print('df1', id(df1), df1 == None)
    # print('df2', id(df2), df2 == None)
    # print('df1.index', id(df1.index), df1.index == None, df1.index.WhichOneof('type'))
    # print('df2.index', id(df2.index), df2.index == None, df2.index.WhichOneof('type'))
    # print(delta1);
    # print('HERE IS DF1')
    # print(df1)

    concat_index(df1.index, df2.index)
    for (col1, col2) in zip(df1.data.cols, df2.data.cols):
        concat_any_array(col1, col2)

def concat_index(index1, index2):
    """Merges elements from index2 into index1."""
    # Special case if index1 is empty.
    if index_len(index1) == 0:
        index1.CopyFrom(index2)
        return

    # Otherwise, dispatch based on type.
    type1 = index1.WhichOneof('type')
    type2 = index2.WhichOneof('type')
    assert type1 == type2, f'Cannot concatenate {type1} with {type2}.'

    if type1 == 'plain_index':
        concat_any_array(index1.plain_index.data, index2.plain_index.data)
    elif type1 == 'range_index':
        index1.range_index.stop += \
            (index2.range_index.stop - index2.range_index.start)
    elif type1 == 'multi_index':
        raise NotImplementedError('Cannot yet concatenate MultiIndices.')
    elif type1 == 'int_64_index':
        index1.int_64_index.data.data.extend(index2.int_64_index.data.data)
    elif type1 == 'datetime_index':
        index1.datetime_index.data.data.extend(index2.datetime_index.data.data)
    elif type1 == 'timedelta_index':
        index1.timedelta_index.data.data.extend(index2.timedelta_index.data.data)
    else:
        raise NotImplementedError(f'Cannot concatenate "{type}" indices.')

def concat_any_array(any_array_1, any_array_2):
    """Merges elements from any_array_2 into any_array_1."""
    # Special case if any_array_1 is empty
    if any_array_len(any_array_1) == 0:
        any_array_1.CopyFrom(any_array_2)
        return

    type1 = any_array_1.WhichOneof('type')
    type2 = any_array_2.WhichOneof('type')
    assert type1 == type2, f'Cannot concatenate {type1} with {type2}.'
    getattr(any_array_1, type1).data.extend(getattr(any_array_2, type2).data)

def get_data_frame(delta):
    """Extracts the dataframe from a delta."""
    delta_type = delta.WhichOneof('type')
    if delta_type == 'new_element':
        element_type = delta.new_element.WhichOneof('type')
        if element_type == 'data_frame':
            return delta.new_element.data_frame
        elif element_type == 'chart':
            return delta.new_element.chart.data
        elif element_type == 'vega_lite_chart':
            return delta.new_element.vega_lite_chart.data
    elif delta_type == 'add_rows':
        return delta.add_rows
    else:
        raise RuntimeError(f'Cannot extract DataFrame from {delta_type}.')

def index_len(index):
    """Returns the number of elements in an index."""
    index_type = index.WhichOneof('type')
    if index_type == 'plain_index':
        return any_array_len(index.plain_index.data)
    elif index_type == 'range_index':
        return index.range_index.stop - index.range_index.start
    elif index_type == 'multi_index':
        if len(index.multi_index.labels) == 0:
            return 0
        else:
            return len(index.multi_index.labels[0])
    elif index_type == 'int_64_index':
        return len(index.int_64_index.data.data)
    elif index_type == 'datetime_index':
        return len(index.datetime_index.data.data)
    elif index_type == 'timedelta_index':
        return len(index.timedelta_index.data.data)

def any_array_len(any_array):
    """Returns the length of an any_array."""
    array_type = any_array.WhichOneof('type')
    the_array = getattr(any_array, array_type).data
    return len(the_array)
