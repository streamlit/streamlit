# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Helper functions to marshall a pandas.DataFrame into a proto.Dataframe."""

import datetime
import re
from collections import namedtuple
from typing import cast

import tzlocal

import streamlit
from streamlit import type_util
from streamlit.logger import get_logger
from streamlit.proto.DataFrame_pb2 import DataFrame as DataFrameProto

LOGGER = get_logger(__name__)

CSSStyle = namedtuple("CSSStyle", ["property", "value"])


class DataFrameMixin:
    def dataframe(self, data=None, width=None, height=None):
        """Display a dataframe as an interactive table.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict,
            or None
            The data to display.

            If 'data' is a pandas.Styler, it will be used to style its
            underyling DataFrame. Streamlit supports custom cell
            values and colors. (It does not support some of the more exotic
            pandas styling features, like bar charts, hovering, and captions.)
            Styler support is experimental!
        width : int or None
            Desired width of the UI element expressed in pixels. If None, a
            default width based on the page width is used.
        height : int or None
            Desired height of the UI element expressed in pixels. If None, a
            default height is used.

        Examples
        --------
        >>> df = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> st.dataframe(df)  # Same as st.write(df)

        .. output::
           https://static.streamlit.io/0.25.0-2JkNY/index.html?id=165mJbzWdAC8Duf8a4tjyQ
           height: 330px

        >>> st.dataframe(df, 200, 100)

        You can also pass a Pandas Styler object to change the style of
        the rendered DataFrame:

        >>> df = pd.DataFrame(
        ...    np.random.randn(10, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> st.dataframe(df.style.highlight_max(axis=0))

        .. output::
           https://static.streamlit.io/0.29.0-dV1Y/index.html?id=Hb6UymSNuZDzojUNybzPby
           height: 285px

        """
        data_frame_proto = DataFrameProto()
        marshall_data_frame(data, data_frame_proto)

        return self.dg._enqueue(
            "data_frame",
            data_frame_proto,
            element_width=width,
            element_height=height,
        )

    def table(self, data=None):
        """Display a static table.

        This differs from `st.dataframe` in that the table in this case is
        static: its entire contents are laid out directly on the page.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict,
            or None
            The table data.

        Example
        -------
        >>> df = pd.DataFrame(
        ...    np.random.randn(10, 5),
        ...    columns=('col %d' % i for i in range(5)))
        ...
        >>> st.table(df)

        .. output::
           https://static.streamlit.io/0.25.0-2JkNY/index.html?id=KfZvDMprL4JFKXbpjD3fpq
           height: 480px

        """
        table_proto = DataFrameProto()
        marshall_data_frame(data, table_proto)
        return self.dg._enqueue("table", table_proto)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)


def marshall_data_frame(data, proto_df):
    """Convert a pandas.DataFrame into a proto.DataFrame.

    Parameters
    ----------
    data : pandas.DataFrame, numpy.ndarray, Iterable, dict, DataFrame, Styler, or None
        Something that is or can be converted to a dataframe.

    proto_df : proto.DataFrame
        Output. The protobuf for a Streamlit DataFrame proto.
    """
    df = type_util.convert_anything_to_df(data)

    # Convert df into an iterable of columns (each of type Series).
    df_data = (df.iloc[:, col] for col in range(len(df.columns)))

    _marshall_table(df_data, proto_df.data)
    _marshall_index(df.columns, proto_df.columns)
    _marshall_index(df.index, proto_df.index)

    styler = data if type_util.is_pandas_styler(data) else None
    _marshall_styles(proto_df.style, df, styler)


def _marshall_styles(proto_table_style, df, styler=None):
    """Adds pandas.Styler styling data to a proto.DataFrame

    Parameters
    ----------
    proto_table_style : proto.TableStyle
    df : pandas.DataFrame
    styler : pandas.Styler holding styling data for the data frame, or
        None if there's no style data to marshall
    """

    # NB: we're using protected members of Styler to get this data,
    # which is non-ideal and could break if Styler's interface changes.

    if styler is not None:
        styler._compute()
        translated_style = styler._translate()
        css_styles = _get_css_styles(translated_style)
        display_values = _get_custom_display_values(df, translated_style)
    else:
        # If we have no Styler, we just make an empty CellStyle for each cell
        css_styles = {}
        display_values = {}

    nrows, ncols = df.shape
    for col in range(ncols):
        proto_col = proto_table_style.cols.add()
        for row in range(nrows):
            proto_cell_style = proto_col.styles.add()

            for css in css_styles.get((row, col), []):
                proto_css = proto_cell_style.css.add()
                proto_css.property = css.property
                proto_css.value = css.value

            display_value = display_values.get((row, col), None)
            if display_value is not None:
                proto_cell_style.display_value = display_value
                proto_cell_style.has_display_value = True


def _get_css_styles(translated_style):
    """Parses pandas.Styler style dictionary into a
    {(row, col): [CSSStyle]} dictionary
    """
    # In pandas < 1.1.0
    # translated_style["cellstyle"] has the following shape:
    # [
    #   {
    #       "props": [["color", " black"], ["background-color", "orange"], ["", ""]],
    #       "selector": "row0_col0"
    #   }
    #   ...
    # ]
    #
    # In pandas >= 1.1.0
    # translated_style["cellstyle"] has the following shape:
    # [
    #   {
    #       "props": [("color", " black"), ("background-color", "orange"), ("", "")],
    #       "selectors": ["row0_col0"]
    #   }
    #   ...
    # ]

    cell_selector_regex = re.compile(r"row(\d+)_col(\d+)")

    css_styles = {}
    for cell_style in translated_style["cellstyle"]:
        if type_util.is_old_pandas_version():
            cell_selectors = [cell_style["selector"]]
        else:
            cell_selectors = cell_style["selectors"]

        for cell_selector in cell_selectors:
            match = cell_selector_regex.match(cell_selector)
            if not match:
                raise RuntimeError(
                    'Failed to parse cellstyle selector "%s"' % cell_selector
                )
            row = int(match.group(1))
            col = int(match.group(2))
            css_declarations = []
            props = cell_style["props"]
            for prop in props:
                if not isinstance(prop, (tuple, list)) or len(prop) != 2:
                    raise RuntimeError('Unexpected cellstyle props "%s"' % prop)
                name = str(prop[0]).strip()
                value = str(prop[1]).strip()
                if name and value:
                    css_declarations.append(CSSStyle(property=name, value=value))
            css_styles[(row, col)] = css_declarations

    return css_styles


def _get_custom_display_values(df, translated_style):
    """Parses pandas.Styler style dictionary into a
    {(row, col): display_value} dictionary for cells whose display format
    has been customized.
    """
    # Create {(row, col): display_value} from translated_style['body']
    # translated_style['body'] has the shape:
    # [
    #   [ // row
    #     {  // cell or header
    #       'id': 'level0_row0' (for row header) | 'row0_col0' (for cells)
    #       'value': 1.329212
    #       'display_value': '132.92%'
    #       ...
    #     }
    #   ]
    # ]

    default_formatter = df.style._display_funcs[(0, 0)]

    def has_custom_display_value(cell):
        value = cell["value"]
        display_value = cell["display_value"]

        if type(value) is type(display_value) and str(value) == str(display_value):
            return False

        # Pandas applies a default style to all float values, regardless
        # of whether they have a user-specified display format. We test
        # for that here.
        return (
            type(value) is not type(display_value)
            or default_formatter(value) != display_value
        )

    cell_selector_regex = re.compile(r"row(\d+)_col(\d+)")
    header_selector_regex = re.compile(r"level(\d+)_row(\d+)")

    display_values = {}
    for row in translated_style["body"]:
        # row is a List[Dict], containing format data for each cell in the row,
        # plus an extra first entry for the row header, which we skip
        found_row_header = False
        for cell in row:
            cell_id = cell["id"]  # a string in the form 'row0_col0'
            if header_selector_regex.match(cell_id):
                if not found_row_header:
                    # We don't care about processing row headers, but as
                    # a sanity check, ensure we only see one per row
                    found_row_header = True
                    continue
                else:
                    raise RuntimeError('Found unexpected row header "%s"' % cell)
            match = cell_selector_regex.match(cell_id)
            if not match:
                raise RuntimeError('Failed to parse cell selector "%s"' % cell_id)

            # Only store display values that differ from the cell's default
            if has_custom_display_value(cell):
                row = int(match.group(1))
                col = int(match.group(2))
                display_values[(row, col)] = str(cell["display_value"])

    return display_values


def _marshall_index(pandas_index, proto_index):
    """Convert an pandas.Index into a proto.Index.

    pandas_index - Panda.Index or related (input)
    proto_index  - proto.Index (output)
    """
    import pandas as pd
    import numpy as np

    if type(pandas_index) == pd.Index:
        _marshall_any_array(np.array(pandas_index), proto_index.plain_index.data)
    elif type(pandas_index) == pd.RangeIndex:
        min = pandas_index.min()
        max = pandas_index.max()
        if pd.isna(min) or pd.isna(max):
            proto_index.range_index.start = 0
            proto_index.range_index.stop = 0
        else:
            proto_index.range_index.start = min
            proto_index.range_index.stop = max + 1
    elif type(pandas_index) == pd.MultiIndex:
        for level in pandas_index.levels:
            _marshall_index(level, proto_index.multi_index.levels.add())
        if hasattr(pandas_index, "codes"):
            index_codes = pandas_index.codes
        else:
            # Deprecated in Pandas 0.24, do don't bother covering.
            index_codes = pandas_index.labels  # pragma: no cover
        for label in index_codes:
            proto_index.multi_index.labels.add().data.extend(label)
    elif type(pandas_index) == pd.DatetimeIndex:
        if pandas_index.tz is None:
            current_zone = tzlocal.get_localzone()
            pandas_index = pandas_index.tz_localize(current_zone)
        proto_index.datetime_index.data.data.extend(pandas_index.map(datetime.datetime.isoformat))
    elif type(pandas_index) == pd.TimedeltaIndex:
        proto_index.timedelta_index.data.data.extend(pandas_index.astype(np.int64))
    elif type(pandas_index) == pd.Int64Index:
        proto_index.int_64_index.data.data.extend(pandas_index)
    elif type(pandas_index) == pd.Float64Index:
        proto_index.float_64_index.data.data.extend(pandas_index)
    else:
        raise NotImplementedError("Can't handle %s yet." % type(pandas_index))


def _marshall_table(pandas_table, proto_table):
    """Convert a sequence of 1D arrays into proto.Table.

    pandas_table - Sequence of 1D arrays which are AnyArray compatible (input).
    proto_table  - proto.Table (output)
    """
    for pandas_array in pandas_table:
        if len(pandas_array) == 0:
            continue
        _marshall_any_array(pandas_array, proto_table.cols.add())


def _marshall_any_array(pandas_array, proto_array):
    """Convert a 1D numpy.Array into a proto.AnyArray.

    pandas_array - 1D arrays which is AnyArray compatible (input).
    proto_array  - proto.AnyArray (output)
    """
    import numpy as np

    # Convert to np.array as necessary.
    if not hasattr(pandas_array, "dtype"):
        pandas_array = np.array(pandas_array)

    # Only works on 1D arrays.
    if len(pandas_array.shape) != 1:
        raise ValueError("Array must be 1D.")

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
    # dtype='string', <class 'pandas.core.arrays.string_.StringDtype'>
    # NOTE: StringDtype is considered experimental.
    # The implementation and parts of the API may change without warning.
    elif pandas_array.dtype.name == "string":
        proto_array.strings.data.extend(map(str, pandas_array))
    # Setting a timezone changes (dtype, dtype.type) from
    #   'datetime64[ns]', <class 'numpy.datetime64'>
    # to
    #   datetime64[ns, UTC], <class 'pandas._libs.tslibs.timestamps.Timestamp'>
    elif pandas_array.dtype.name.startswith("datetime64"):
        # Just convert straight to ISO 8601, preserving timezone
        # awareness/unawareness. The frontend will render it correctly.
        proto_array.datetimes.data.extend(pandas_array.map(datetime.datetime.isoformat))
    else:
        raise NotImplementedError("Dtype %s not understood." % pandas_array.dtype)


def add_rows(delta1, delta2, name=None):
    """Concat the DataFrame in delta2 to the DataFrame in delta1.

    Parameters
    ----------
    delta1 : Delta
    delta2 : Delta
    name : str or None

    """
    df1 = _get_data_frame(delta1, name)
    df2 = _get_data_frame(delta2, name)

    if len(df1.data.cols) == 0:
        if len(df2.data.cols) == 0:
            return
        df1.CopyFrom(df2)
        return

    # Copy Data
    if len(df1.data.cols) != len(df2.data.cols):
        raise ValueError("Dataframes have incompatible shapes")
    for (col1, col2) in zip(df1.data.cols, df2.data.cols):
        _concat_any_array(col1, col2)

    # Copy index
    _concat_index(df1.index, df2.index)

    # Don't concat columns! add_rows should leave the dataframe with the same
    # number of columns as it had before.
    # DON'T DO: _concat_index(df1.columns, df2.columns)

    # Copy styles
    for (style_col1, style_col2) in zip(df1.style.cols, df2.style.cols):
        _concat_cell_style_array(style_col1, style_col2)


def _concat_index(index1, index2):
    """Contact index2 into index1."""
    # Special case if index1 is empty.
    if _index_len(index1) == 0:
        index1.Clear()
        index1.CopyFrom(index2)
        return

    # Otherwise, dispatch based on type.
    type1 = index1.WhichOneof("type")
    type2 = index2.WhichOneof("type")
    # This branch is covered with tests but pytest doesnt seem to realize it.
    if type1 != type2:  # pragma: no cover
        raise ValueError(
            "Cannot concatenate %(type1)s with %(type2)s."
            % {"type1": type1, "type2": type2}
        )

    if type1 == "plain_index":
        _concat_any_array(index1.plain_index.data, index2.plain_index.data)
    elif type1 == "range_index":
        index1.range_index.stop += index2.range_index.stop - index2.range_index.start
    elif type1 == "multi_index":
        raise NotImplementedError("Cannot yet concatenate MultiIndices.")
    elif type1 == "int_64_index":
        index1.int_64_index.data.data.extend(index2.int_64_index.data.data)
    elif type1 == "datetime_index":
        index1.datetime_index.data.data.extend(index2.datetime_index.data.data)
    elif type1 == "timedelta_index":
        index1.timedelta_index.data.data.extend(index2.timedelta_index.data.data)
    else:
        raise NotImplementedError('Cannot concatenate "%s" indices.' % type1)


def _concat_any_array(any_array_1, any_array_2):
    """Concat elements from any_array_2 into any_array_1."""
    # Special case if any_array_1 is empty
    if _any_array_len(any_array_1) == 0:
        any_array_1.CopyFrom(any_array_2)
        return

    type1 = any_array_1.WhichOneof("type")
    type2 = any_array_2.WhichOneof("type")
    if type1 != type2:
        raise ValueError(
            "Cannot concatenate %(type1)s with %(type2)s."
            % {"type1": type1, "type2": type2}
        )
    getattr(any_array_1, type1).data.extend(getattr(any_array_2, type2).data)


def _concat_cell_style_array(style_array1, style_array2):
    """Concat elements from any_array_2 into any_array_1."""
    # Special case if array1 is empty
    if len(style_array1.styles) == 0:
        style_array1.CopyFrom(style_array2)
        return

    style_array1.styles.extend(style_array2.styles)


def _get_data_frame(delta, name=None):
    """Extract the dataframe from a delta."""
    delta_type = delta.WhichOneof("type")

    if delta_type == "new_element":
        element_type = delta.new_element.WhichOneof("type")

        # Some element types don't support named datasets.
        if name and element_type in ("data_frame", "table", "chart"):
            raise ValueError("Dataset names not supported for st.%s" % element_type)

        if element_type in "data_frame":
            return delta.new_element.data_frame
        elif element_type in "table":
            return delta.new_element.table
        elif element_type == "chart":
            return delta.new_element.chart.data
        elif element_type == "vega_lite_chart":
            chart_proto = delta.new_element.vega_lite_chart
            if name:
                return _get_or_create_dataset(chart_proto.datasets, name)
            elif len(chart_proto.datasets) == 1:
                # Support the case where the dataset name was randomly given by
                # the charting library (e.g. Altair) and the user has no
                # knowledge of it.
                return chart_proto.datasets[0].data
            else:
                return chart_proto.data
        # TODO: Support DeckGL. Need to figure out how to handle layer indices
        # first.

    elif delta_type == "add_rows":
        if delta.add_rows.has_name and name != delta.add_rows.name:
            raise ValueError('No dataset found with name "%s".' % name)
        return delta.add_rows.data
    else:
        raise ValueError("Cannot extract DataFrame from %s." % delta_type)


def _get_or_create_dataset(datasets_proto, name):
    for dataset in datasets_proto:
        if dataset.has_name and dataset.name == name:
            return dataset.data

    dataset = datasets_proto.add()
    dataset.name = name
    dataset.has_name = True
    return dataset.data


def _index_len(index):
    """Return the number of elements in an index."""
    index_type = index.WhichOneof("type")
    if index_type == "plain_index":
        return _any_array_len(index.plain_index.data)
    elif index_type == "range_index":
        return index.range_index.stop - index.range_index.start
    elif index_type == "multi_index":
        if len(index.multi_index.labels) == 0:
            return 0
        else:
            return len(index.multi_index.labels[0].data)
    elif index_type == "int_64_index":
        return len(index.int_64_index.data.data)
    elif index_type == "float_64_index":
        return len(index.float_64_index.data.data)
    elif index_type == "datetime_index":
        return len(index.datetime_index.data.data)
    elif index_type == "timedelta_index":
        return len(index.timedelta_index.data.data)


def _any_array_len(any_array):
    """Return the length of an any_array."""
    array_type = any_array.WhichOneof("type")
    the_array = getattr(any_array, array_type).data
    return len(the_array)
