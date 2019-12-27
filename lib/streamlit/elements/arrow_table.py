# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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


def marshall(proto, df, default_uuid):
    if _is_pandas_styler(df):
        df = _marshall_styler(proto, df, default_uuid)

    # Convert all dataframe values to strings as we
    # only use them to show the result.
    df = df.astype(str)

    _marshall_headers(proto, df)
    _marshall_data(proto, df)


def _is_pandas_styler(df):
    return util.is_type(df, "pandas.io.formats.style.Styler")


def _marshall_styler(proto, styler, default_uuid):
    # NB: Order matters!
    # UUID should be set before _compute is called.
    _marshall_table_uuid(proto, styler, default_uuid)
    _marshall_table_caption(proto, styler)

    # NB: We're using protected members of Styler to get styles,
    # which is non-ideal and could break if Styler's interface changes.
    styler._compute()
    pandas_styles = styler._translate()

    _marshall_table_styles(proto, styler, pandas_styles)

    old_df = styler.data
    new_df = _use_display_values(old_df, pandas_styles)

    return new_df


def _marshall_table_uuid(proto, styler, default_uuid):
    if styler.uuid is None:
        styler.set_uuid(default_uuid)

    proto.uuid = str(styler.uuid)


def _marshall_table_caption(proto, styler):
    proto.caption = styler.caption if styler.caption is not None else ""


def _marshall_table_styles(proto, styler, styles):
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

    proto.styles = "\n".join(css_rules)


def _trim_pandas_styles(styles):
    # Filter out empty styles, as every cell will have a class
    # but the list of props may just be [['', '']].
    return [x for x in styles if any(any(y) for y in x["props"])]


def _pandas_style_to_css(style, uuid, separator=""):
    from collections import OrderedDict

    declarations = []
    for css_property, css_value in style["props"]:
        declaration = css_property.strip() + ": " + css_value.strip()
        declarations.append(declaration)

    # Remove duplicate styles preserving the order and
    # keeping the first appearance of each element.
    declarations = list(OrderedDict.fromkeys(declarations))

    table_selector = "#T_" + str(uuid)
    cell_selector = style["selector"]
    selector = table_selector + separator + cell_selector
    declaration_block = "; ".join(declarations)
    rule_set = selector + " { " + declaration_block + " }"

    return rule_set


def _marshall_headers(proto, df):
    # Serialize header columns
    header_columns = map(_tuple_to_list, df.columns.values)
    header_columns_df = pd.DataFrame(header_columns)
    header_columns_table = _dataframe_to_serialized_arrow_table(header_columns_df)
    proto.header_columns = header_columns_table

    # Serialize header rows
    header_rows = map(_tuple_to_list, df.index.values)
    header_rows_df = pd.DataFrame(header_rows)
    header_rows_table = _dataframe_to_serialized_arrow_table(header_rows_df)
    proto.header_rows = header_rows_table


def _tuple_to_list(item):
    if isinstance(item, tuple):
        return list(item)
    return item


def _dataframe_to_serialized_arrow_table(df):
    table = pa.Table.from_pandas(df)
    sink = pa.BufferOutputStream()
    writer = pa.RecordBatchStreamWriter(sink, table.schema)
    writer.write_table(table)
    writer.close()
    return sink.getvalue().to_pybytes()


def _marshall_data(proto, df):
    # Reset row and column indices
    df = df.T.reset_index(drop=True)
    df = df.T.reset_index(drop=True)

    # Serialize data
    proto.data = _dataframe_to_serialized_arrow_table(df)


def _use_display_values(df, styles):
    # TODO: rewrite this method without using regex
    import re

    # Convert all dataframe values to strings as we
    # only use them to show the result.
    df = df.astype(str)

    cell_selector_regex = re.compile(r"row(\d+)_col(\d+)")
    if "body" in styles:
        rows = styles["body"]
        for row in rows:
            for cell in row:
                cell_id = cell["id"]
                match = cell_selector_regex.match(cell_id)
                if match:
                    r = int(match.group(1))
                    c = int(match.group(2))
                    df.iat[r, c] = str(cell["display_value"])

    return df
