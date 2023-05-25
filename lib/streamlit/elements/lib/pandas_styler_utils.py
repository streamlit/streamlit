# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from typing import TYPE_CHECKING, Any, List, Mapping, TypeVar

from pandas import DataFrame

from streamlit import type_util
from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto

if TYPE_CHECKING:
    from pandas.io.formats.style import Styler


def marshall_styler(proto: ArrowProto, styler: "Styler", default_uuid: str) -> None:
    """Marshall pandas.Styler into an Arrow proto.

    Parameters
    ----------
    proto : proto.Arrow
        Output. The protobuf for Streamlit Arrow proto.

    styler : pandas.Styler
        Helps style a DataFrame or Series according to the data with HTML and CSS.

    default_uuid : str
        If pandas.Styler uuid is not provided, this value will be used.

    """
    # pandas.Styler uuid should be set before _compute is called.
    _marshall_uuid(proto, styler, default_uuid)

    # We're using protected members of pandas.Styler to get styles,
    # which is not ideal and could break if the interface changes.
    styler._compute()

    # In Pandas 1.3.0, styler._translate() signature was changed.
    # 2 arguments were added: sparse_index and sparse_columns.
    # The functionality that they provide is not yet supported.
    if type_util.is_pandas_version_less_than("1.3.0"):
        pandas_styles = styler._translate()
    else:
        pandas_styles = styler._translate(False, False)

    _marshall_caption(proto, styler)
    _marshall_styles(proto, styler, pandas_styles)
    _marshall_display_values(proto, styler.data, pandas_styles)


def _marshall_uuid(proto: ArrowProto, styler: "Styler", default_uuid: str) -> None:
    """Marshall pandas.Styler uuid into an Arrow proto.

    Parameters
    ----------
    proto : proto.Arrow
        Output. The protobuf for Streamlit Arrow proto.

    styler : pandas.Styler
        Helps style a DataFrame or Series according to the data with HTML and CSS.

    default_uuid : str
        If pandas.Styler uuid is not provided, this value will be used.

    """
    if styler.uuid is None:
        styler.set_uuid(default_uuid)

    proto.styler.uuid = str(styler.uuid)


def _marshall_caption(proto: ArrowProto, styler: "Styler") -> None:
    """Marshall pandas.Styler caption into an Arrow proto.

    Parameters
    ----------
    proto : proto.Arrow
        Output. The protobuf for Streamlit Arrow proto.

    styler : pandas.Styler
        Helps style a DataFrame or Series according to the data with HTML and CSS.

    """
    if styler.caption is not None:
        proto.styler.caption = styler.caption


def _marshall_styles(
    proto: ArrowProto, styler: "Styler", styles: Mapping[str, Any]
) -> None:
    """Marshall pandas.Styler styles into an Arrow proto.

    Parameters
    ----------
    proto : proto.Arrow
        Output. The protobuf for Streamlit Arrow proto.

    styler : pandas.Styler
        Helps style a DataFrame or Series according to the data with HTML and CSS.

    styles : dict
        pandas.Styler translated styles.

    """
    css_rules = []

    if "table_styles" in styles:
        table_styles = styles["table_styles"]
        table_styles = _trim_pandas_styles(table_styles)
        for style in table_styles:
            # styles in "table_styles" have a space
            # between the uuid and selector.
            rule = _pandas_style_to_css(
                "table_styles", style, styler.uuid, separator=" "
            )
            css_rules.append(rule)

    if "cellstyle" in styles:
        cellstyle = styles["cellstyle"]
        cellstyle = _trim_pandas_styles(cellstyle)
        for style in cellstyle:
            rule = _pandas_style_to_css("cell_style", style, styler.uuid)
            css_rules.append(rule)

    if len(css_rules) > 0:
        proto.styler.styles = "\n".join(css_rules)


M = TypeVar("M", bound=Mapping[str, Any])


def _trim_pandas_styles(styles: List[M]) -> List[M]:
    """Filter out empty styles.

    Every cell will have a class, but the list of props
    may just be [['', '']].

    Parameters
    ----------
    styles : list
        pandas.Styler translated styles.

    """
    return [x for x in styles if any(any(y) for y in x["props"])]


def _pandas_style_to_css(
    style_type: str,
    style: Mapping[str, Any],
    uuid: str,
    separator: str = "",
) -> str:
    """Convert pandas.Styler translated style to CSS.

    Parameters
    ----------
    style_type : str
        Either "table_styles" or "cell_style".

    style : dict
        pandas.Styler translated style.

    uuid : str
        pandas.Styler uuid.

    separator : str
        A string separator used between table and cell selectors.

    """
    declarations = []
    for css_property, css_value in style["props"]:
        declaration = css_property.strip() + ": " + css_value.strip()
        declarations.append(declaration)

    table_selector = f"#T_{uuid}"

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
    if style_type == "table_styles" or (
        style_type == "cell_style" and type_util.is_pandas_version_less_than("1.1.0")
    ):
        cell_selectors = [style["selector"]]
    else:
        cell_selectors = style["selectors"]

    selectors = []
    for cell_selector in cell_selectors:
        selectors.append(table_selector + separator + cell_selector)
    selector = ", ".join(selectors)

    declaration_block = "; ".join(declarations)
    rule_set = selector + " { " + declaration_block + " }"

    return rule_set


def _marshall_display_values(
    proto: ArrowProto, df: DataFrame, styles: Mapping[str, Any]
) -> None:
    """Marshall pandas.Styler display values into an Arrow proto.

    Parameters
    ----------
    proto : proto.Arrow
        Output. The protobuf for Streamlit Arrow proto.

    df : pandas.DataFrame
        A dataframe with original values.

    styles : dict
        pandas.Styler translated styles.

    """
    new_df = _use_display_values(df, styles)
    proto.styler.display_values = type_util.data_frame_to_bytes(new_df)


def _use_display_values(df: DataFrame, styles: Mapping[str, Any]) -> DataFrame:
    """Create a new pandas.DataFrame where display values are used instead of original ones.

    Parameters
    ----------
    df : pandas.DataFrame
        A dataframe with original values.

    styles : dict
        pandas.Styler translated styles.

    """
    import re

    # If values in a column are not of the same type, Arrow
    # serialization would fail. Thus, we need to cast all values
    # of the dataframe to strings before assigning them display values.
    new_df = df.astype(str)

    cell_selector_regex = re.compile(r"row(\d+)_col(\d+)")
    if "body" in styles:
        rows = styles["body"]
        for row in rows:
            for cell in row:
                match = cell_selector_regex.match(cell["id"])
                if match:
                    r, c = map(int, match.groups())
                    new_df.iat[r, c] = str(cell["display_value"])

    return new_df
