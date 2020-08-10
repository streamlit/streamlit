# Copyright 2018-2020 Streamlit Inc.
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

import pandas as pd
import pyarrow as pa
from streamlit import util
from streamlit import type_util


def marshall(proto, data, default_uuid=None):
    """Marshall data into an ArrowTable proto.

    Parameters
    ----------
    proto : proto.ArrowTable
        Output. The protobuf for a Streamlit ArrowTable proto.
    
    data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict, or None
        Something that is or can be converted to a dataframe.

    """
    if type_util.is_pandas_styler(data):
        _marshall_styler(proto, data, default_uuid)

    df = type_util.convert_anything_to_df(data)
    _marshall_index(proto, df.index)
    _marshall_columns(proto, df.columns)
    _marshall_data(proto, df.to_numpy())


def _marshall_styler(proto, styler, default_uuid):
    """Marshall pandas.Styler styling data into an ArrowTable proto.

    Parameters
    ----------
    proto : proto.ArrowTable
        Output. The protobuf for a Streamlit ArrowTable proto.

    styler : pandas.Styler
        Styler holding styling data for the dataframe.

    default_uuid : str
        If Styler custom uuid is not provided, this value will be used.

    """
    # NB: UUID should be set before _compute is called.
    _marshall_uuid(proto, styler, default_uuid)

    # NB: We're using protected members of Styler to get styles,
    # which is non-ideal and could break if Styler's interface changes.
    styler._compute()
    pandas_styles = styler._translate()

    _marshall_caption(proto, styler)
    _marshall_styles(proto, styler, pandas_styles)
    _marshall_display_values(proto, styler.data, pandas_styles)


def _marshall_uuid(proto, styler, default_uuid):
    """Marshall pandas.Styler UUID into an ArrowTable proto.

    Parameters
    ----------
    proto : proto.ArrowTable
        Output. The protobuf for a Streamlit ArrowTable proto.

    styler : pandas.Styler
        Styler holding styling data for the dataframe.

    default_uuid : str
        If Styler custom uuid is not provided, this value will be used.

    """
    if styler.uuid is None:
        styler.set_uuid(default_uuid)

    proto.styler.uuid = str(styler.uuid)


def _marshall_caption(proto, styler):
    """Marshall pandas.Styler caption into an ArrowTable proto.

    Parameters
    ----------
    proto : proto.ArrowTable
        Output. The protobuf for a Streamlit ArrowTable proto.

    styler : pandas.Styler
        Styler holding styling data for the dataframe.

    """
    if styler.caption is not None:
        proto.styler.caption = styler.caption


def _marshall_styles(proto, styler, styles):
    """Marshall pandas.Styler styles into an ArrowTable proto.

    Parameters
    ----------
    proto : proto.ArrowTable
        Output. The protobuf for a Streamlit ArrowTable proto.

    styler : pandas.Styler
        Styler holding styling data for the dataframe.

    styles : dict
        pandas.Styler translated styles.

    """
    css_rules = []

    if "table_styles" in styles:
        table_styles = styles["table_styles"]
        table_styles = _trim_pandas_styles(table_styles)
        for style in table_styles:
            # NB: styles in "table_styles" have a space
            # between the UUID and the selector.
            rule = _pandas_style_to_css(style, styler.uuid, separator=" ")
            css_rules.append(rule)

    if "cellstyle" in styles:
        cellstyle = styles["cellstyle"]
        cellstyle = _trim_pandas_styles(cellstyle)
        for style in cellstyle:
            rule = _pandas_style_to_css(style, styler.uuid)
            css_rules.append(rule)

    if len(css_rules) > 0:
        proto.styler.styles = "\n".join(css_rules)


def _trim_pandas_styles(styles):
    """Trim pandas styles dict.

    Parameters
    ----------
    styles : dict
        pandas.Styler translated styles.

    """
    # Filter out empty styles, as every cell will have a class
    # but the list of props may just be [['', '']].
    return [x for x in styles if any(any(y) for y in x["props"])]


def _pandas_style_to_css(style, uuid, separator=""):
    """Convert pandas.Styler translated styles entry to CSS.

    Parameters
    ----------
    style : dict
        pandas.Styler translated styles entry.

    uuid: str
        pandas.Styler UUID.

    separator: str
        A string separator used between table and cell selectors.

    """
    declarations = []
    for css_property, css_value in style["props"]:
        declaration = css_property.strip() + ": " + css_value.strip()
        declarations.append(declaration)

    table_selector = "#T_" + str(uuid)
    cell_selector = style["selector"]
    selector = table_selector + separator + cell_selector
    declaration_block = "; ".join(declarations)
    rule_set = selector + " { " + declaration_block + " }"

    return rule_set


def _marshall_display_values(proto, df, styles):
    """Marshall pandas.Styler display values into an ArrowTable proto.

    Parameters
    ----------
    proto : proto.ArrowTable
        Output. The protobuf for a Streamlit ArrowTable proto.

    df : pandas.DataFrame
        A dataframe with original values.

    styles : dict
        pandas.Styler translated styles.

    """
    new_df = _use_display_values(df, styles)
    proto.styler.display_values = _dataframe_to_serialized_arrow_table(new_df)


def _use_display_values(df, styles):
    """Create a new pandas.DataFrame where display values are used instead of original ones.

    Parameters
    ----------
    df : pandas.DataFrame
        A dataframe with original values.

    styles : dict
        pandas.Styler translated styles.

    """
    # (HK) TODO: Rewrite this method without using regex.
    import re

    # If values in a column are not of the same type, Arrow Table
    # serialization would fail. Thus, we need to cast all values
    # of the dataframe to strings before assigning them display values.
    new_df = df.astype(str)

    cell_selector_regex = re.compile(r"row(\d+)_col(\d+)")
    if "body" in styles:
        rows = styles["body"]
        for row in rows:
            for cell in row:
                cell_id = cell["id"]
                match = cell_selector_regex.match(cell_id)
                if match:
                    r, c = map(int, match.groups())
                    new_df.iat[r, c] = str(cell["display_value"])

    return new_df


def _dataframe_to_serialized_arrow_table(df):
    """Convert pandas.DataFrame to Arrow Table pybytes.

    Parameters
    ----------
    df : pandas.DataFrame
        A dataframe to convert.

    """
    table = pa.Table.from_pandas(df)
    sink = pa.BufferOutputStream()
    writer = pa.RecordBatchStreamWriter(sink, table.schema)
    writer.write_table(table)
    writer.close()
    return sink.getvalue().to_pybytes()


def _marshall_index(proto, index):
    """Marshall pandas.DataFrame index into an ArrowTable proto.

    Parameters
    ----------
    proto : proto.ArrowTable
        Output. The protobuf for a Streamlit ArrowTable proto.

    index : Index or array-like
        Index to use for resulting frame. 
        Will default to RangeIndex (0, 1, 2, ..., n) if no index is provided.

    """
    index = map(util._maybe_tuple_to_list, index.values)
    index_df = pd.DataFrame(index)
    proto.index = _dataframe_to_serialized_arrow_table(index_df)


def _marshall_columns(proto, columns):
    """Marshall pandas.DataFrame columns into an ArrowTable proto.

    Parameters
    ----------
    proto : proto.ArrowTable
        Output. The protobuf for a Streamlit ArrowTable proto.

    columns : Index or array-like
        Column labels to use for resulting frame. 
        Will default to RangeIndex (0, 1, 2, ..., n) if no column labels are provided.

    """
    columns = map(util._maybe_tuple_to_list, columns.values)
    columns_df = pd.DataFrame(columns)
    proto.columns = _dataframe_to_serialized_arrow_table(columns_df)


def _marshall_data(proto, data):
    """Marshall pandas.DataFrame data into an ArrowTable proto.

    Parameters
    ----------
    proto : proto.ArrowTable
        Output. The protobuf for a Streamlit ArrowTable proto.

    df : pandas.DataFrame
        A dataframe to marshall.

    """
    df = pd.DataFrame(data)
    proto.data = _dataframe_to_serialized_arrow_table(df)
