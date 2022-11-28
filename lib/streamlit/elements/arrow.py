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
import json
import sys
from collections.abc import Iterable
from typing import (
    TYPE_CHECKING,
    Any,
    Dict,
    List,
    Mapping,
    Optional,
    TypeVar,
    Union,
    cast,
)

import pyarrow as pa
from numpy import ndarray
from pandas import DataFrame
from pandas.io.formats.style import Styler
from typing_extensions import Literal, TypedDict

from streamlit import type_util
from streamlit.elements.form import current_form_id
from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    get_session_state,
    register_widget,
)
from streamlit.type_util import Key, to_key

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

Data = Union[DataFrame, Styler, pa.Table, ndarray, Iterable, Dict[str, List[Any]], None]
ColumnType = Literal[
    "text",
    "number",
    "boolean",
    "list",
    "url",
    "image",
    "bar-chart",
    "line-chart",
    "progress-chart",
]


class ColumnConfig(TypedDict, total=False):
    width: Optional[int]
    title: Optional[str]
    type: Optional[ColumnType]
    hidden: Optional[bool]
    editable: Optional[bool]
    alignment: Optional[Literal["left", "center", "right"]]
    metadata: Optional[Dict]


def column_config(
    *,
    width: Optional[int] = None,
    title: Optional[str] = None,
    type: Optional[ColumnType] = None,
    hidden: Optional[bool] = None,
    editable: Optional[bool] = None,
    alignment: Optional[Literal["right", "left", "center"]] = None,
    metadata: Optional[Dict] = None,
) -> ColumnConfig:
    """Configures a dataframe column.
    Parameters
    ----------
    width: int or None
        The initial width of the column expressed in pixels.
    title: str or None
        The column title displayed on the frontend.
        This only changes the display value and does not have any impact on the actual data.
    type: str or None
        The type of the column.
        Available column types: text, number, boolean, list, url, image, bar-chart, line-chart, progress-chart,
    hidden: bool or None
        If `True`, the column will not be shown on the frontend.
        This can be used to hide index columns as well.
    editable: bool or None
        If `True`, the column will be editable.
    alignment: str or None
        The content alignment of the column. Available options: right, left, center.
    metadata: dict or None
        Column type specific metadata.

    Examples
    --------
    >>> df = pd.DataFrame(
    ...    np.random.randn(50, 20),
    ...    columns=('col %d' % i for i in range(20)))
    ...
    >>> st._arrow_dataframe(df, columns={
        "col 1": st.column_config(title="Column 1", width=100)
    })
    """
    return ColumnConfig(
        width=width,
        title=title,
        type=type,
        hidden=hidden,
        editable=editable,
        alignment=alignment,
        metadata=metadata,
    )


def _marshall_column_config(
    proto, columns: Optional[Dict[Union[int, str], ColumnConfig]] = None
) -> None:
    if columns is None:
        columns = {}
    # Ignore all None values and prefix columns specified by index
    proto.columns = json.dumps(
        {
            (f"index:{str(k)}" if isinstance(k, int) else k): v
            for (k, v) in columns.items()
            if v is not None
        }
    )


class ArrowMixin:
    @gather_metrics("_arrow_dataframe")
    def _arrow_dataframe(
        self,
        data: Data = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        *,
        use_container_width: bool = False,
        columns: Optional[Dict[Union[int, str], ColumnConfig]] = None,
    ) -> "DeltaGenerator":
        """Display a dataframe as an interactive table.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.DataFrame, Iterable, dict, or None
            The data to display.

            If 'data' is a pandas.Styler, it will be used to style its
            underlying DataFrame.

        width : int or None
            Desired width of the dataframe expressed in pixels. If None, the width
            will be automatically calculated based on the column content.

        height : int or None
            Desired height of the dataframe element expressed in pixels. If None, a
            default height is used.

        use_container_width : bool
            If True, set the dataframe width to the width of the parent container.
            This takes precedence over the width argument.
            This argument can only be supplied by keyword.

        Examples
        --------
        >>> df = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> st._arrow_dataframe(df)

        >>> st._arrow_dataframe(df, 200, 100)

        You can also pass a Pandas Styler object to change the style of
        the rendered DataFrame:

        >>> df = pd.DataFrame(
        ...    np.random.randn(10, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> st._arrow_dataframe(df.style.highlight_max(axis=0))

        """

        # If pandas.Styler uuid is not provided, a hash of the position
        # of the element will be used. This will cause a rerender of the table
        # when the position of the element is changed.
        delta_path = self.dg._get_delta_path_str()
        default_uuid = str(hash(delta_path))

        proto = ArrowProto()
        proto.use_container_width = use_container_width
        if width:
            proto.width = width
        if height:
            proto.height = height
        proto.editable = False
        marshall(proto, data, default_uuid)
        _marshall_column_config(proto, columns)

        return self.dg._enqueue("arrow_data_frame", proto)

    def experimental_data_editor(
        self,
        data: Data = None,
        *,
        width: Optional[int] = None,
        height: Optional[int] = None,
        use_container_width: bool = False,
        columns: Optional[Dict[Union[int, str], ColumnConfig]] = None,
        key: Optional[Key] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
    ) -> DataFrame:

        data = type_util.convert_anything_to_df(data)
        for col in data.columns:
            if type_util._is_colum_type_arrow_incompatible(data[col]):
                # TODO(lukasmasuch): Set column non-editbale through column config
                print(f"Column {col} is not editable")

        delta_path = self.dg._get_delta_path_str()
        default_uuid = str(hash(delta_path))

        proto = ArrowProto()
        proto.use_container_width = use_container_width
        if width:
            proto.width = width
        if height:
            proto.height = height
        proto.editable = True
        proto.form_id = current_form_id(self.dg)
        marshall(proto, data, default_uuid)
        _marshall_column_config(proto, columns)

        def deserialize_data_editor_event(ui_value, widget_id=""):
            if ui_value is None:
                return {}
            if isinstance(ui_value, str):
                return json.loads(ui_value)

            return ui_value

        def serialize_data_editor_event(v):
            return json.dumps(v, default=str)

        widget_state = register_widget(
            "data_editor",
            proto,
            user_key=to_key(key),
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_data_editor_event,
            serializer=serialize_data_editor_event,
            ctx=get_script_run_ctx(),
        )

        # TODO(lukasmasuch): Clean this app
        # loc: only work on index
        # iloc: work on position
        # at: get scalar values. It's a very fast loc
        # iat: Get scalar values. It's a very fast iloc

        new_df = data.copy()
        return_value = new_df
        widget_state_value = widget_state.value
        print(widget_state_value)
        if widget_state_value and "edited_cells" in widget_state_value:
            for edit in widget_state_value["edited_cells"].keys():
                col, row = edit.split(":")
                col, row = int(
                    col
                ) - new_df.index.nlevels if new_df.index.nlevels else 0, int(row)
                new_df.iat[row, col] = widget_state_value["edited_cells"][edit]
            return_value = new_df

        if widget_state_value and "added_rows" in widget_state_value:
            # TODO: implement appending rows:
            # via append, concat, or loc??
            # new_df.loc[row_idx] = [None for _ in range(new_df.shape[1])]
            pass

        if widget_state_value and "deleted_rows" in widget_state_value:
            # https://stackoverflow.com/questions/55851802/remove-rows-of-a-dataframe-based-on-the-row-number
            new_df.drop(new_df.index[widget_state_value["deleted_rows"]], inplace=True)

        self.dg._enqueue("arrow_data_frame", proto)
        return return_value

    @gather_metrics("_arrow_table")
    def _arrow_table(self, data: Data = None) -> "DeltaGenerator":
        """Display a static table.

        This differs from `st._arrow_dataframe` in that the table in this case is
        static: its entire contents are laid out directly on the page.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.DataFrame, Iterable, dict, or None
            The table data.

        Example
        -------
        >>> df = pd.DataFrame(
        ...    np.random.randn(10, 5),
        ...    columns=("col %d" % i for i in range(5)))
        ...
        >>> st._arrow_table(df)

        """

        # Check if data is uncollected, and collect it but with 100 rows max, instead of 10k rows, which is done in all other cases.
        # Avoid this and use 100 rows in st.table, because large tables render slowly, take too much screen space, and can crush the app.
        if type_util.is_snowpark_data_object(data) or type_util.is_type(
            data, type_util._PYSPARK_DF_TYPE_STR
        ):
            data = type_util.convert_anything_to_df(data, max_unevaluated_rows=100)

        # If pandas.Styler uuid is not provided, a hash of the position
        # of the element will be used. This will cause a rerender of the table
        # when the position of the element is changed.
        delta_path = self.dg._get_delta_path_str()
        default_uuid = str(hash(delta_path))

        proto = ArrowProto()
        marshall(proto, data, default_uuid)
        return self.dg._enqueue("arrow_table", proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def marshall(proto: ArrowProto, data: Data, default_uuid: Optional[str] = None) -> None:
    """Marshall pandas.DataFrame into an Arrow proto.

    Parameters
    ----------
    proto : proto.Arrow
        Output. The protobuf for Streamlit Arrow proto.

    data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.DataFrame, Iterable, dict, or None
        Something that is or can be converted to a dataframe.

    default_uuid : Optional[str]
        If pandas.Styler UUID is not provided, this value will be used.
        This attribute is optional and only used for pandas.Styler, other elements
        (e.g. charts) can ignore it.

    """
    if type_util.is_pandas_styler(data):
        # default_uuid is a string only if the data is a `Styler`,
        # and `None` otherwise.
        assert isinstance(
            default_uuid, str
        ), "Default UUID must be a string for Styler data."
        _marshall_styler(proto, data, default_uuid)

    if isinstance(data, pa.Table):
        proto.data = type_util.pyarrow_table_to_bytes(data)
    else:
        df = type_util.convert_anything_to_df(data)
        proto.data = type_util.data_frame_to_bytes(df)


def _marshall_styler(proto: ArrowProto, styler: Styler, default_uuid: str) -> None:
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


def _marshall_uuid(proto: ArrowProto, styler: Styler, default_uuid: str) -> None:
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


def _marshall_caption(proto: ArrowProto, styler: Styler) -> None:
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
    proto: ArrowProto, styler: Styler, styles: Mapping[str, Any]
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
