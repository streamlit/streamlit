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

"""A Python wrapper around Altair.
Altair is a Python visualization library based on Vega-Lite,
a nice JSON schema for expressing graphs and charts.
"""
from __future__ import annotations

from contextlib import nullcontext
from datetime import date
from enum import Enum
from typing import (
    TYPE_CHECKING,
    Any,
    Collection,
    Dict,
    List,
    Optional,
    Sequence,
    Tuple,
    Union,
    cast,
)

import pandas as pd
from pandas.api.types import infer_dtype, is_integer_dtype
from typing_extensions import Literal

import streamlit.elements.arrow_vega_lite as arrow_vega_lite
from streamlit import type_util
from streamlit.color_util import (
    Color,
    is_color_like,
    is_color_tuple_like,
    is_hex_color_like,
    to_css_color,
)
from streamlit.elements.altair_utils import AddRowsMetadata
from streamlit.elements.arrow import Data
from streamlit.elements.utils import last_index_for_melted_dataframes
from streamlit.errors import Error, StreamlitAPIException
from streamlit.proto.ArrowVegaLiteChart_pb2 import (
    ArrowVegaLiteChart as ArrowVegaLiteChartProto,
)
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    import altair as alt

    from streamlit.delta_generator import DeltaGenerator


class ChartType(Enum):
    AREA = {"mark_type": "area"}
    BAR = {"mark_type": "bar"}
    LINE = {"mark_type": "line"}
    SCATTER = {"mark_type": "circle"}


# Color and size legends need different title paddings in order for them
# to be vertically aligned.
# NOTE: I don't think it's possible to *perfectly* align the size and
# color legends in all instances, since the "size" circles vary in size based
# on the data, and their container is top-aligned with the color container. But
# through trial-and-error I found this value to be a good enough middle ground.
# See e2e/scripts/st_arrow_scatter_chart.py for some alignment tests.
COLOR_LEGEND_SETTINGS = dict(titlePadding=5, offset=5, orient="bottom")
SIZE_LEGEND_SETTINGS = dict(titlePadding=0.5, offset=5, orient="bottom")

# User-readable names to give the index and melted columns.
SEPARATED_INDEX_COLUMN_TITLE = "index"
MELTED_Y_COLUMN_TITLE = "values"
MELTED_COLOR_COLUMN_TITLE = "color"

# Crazy internal (non-user-visible) names for the index and melted columns, in order to
# avoid collision with existing column names.
PROTECTION_SUFFIX = "--p5bJXXpQgvPz6yvQMFiy"
SEPARATED_INDEX_COLUMN_NAME = SEPARATED_INDEX_COLUMN_TITLE + PROTECTION_SUFFIX
MELTED_Y_COLUMN_NAME = MELTED_Y_COLUMN_TITLE + PROTECTION_SUFFIX
MELTED_COLOR_COLUMN_NAME = MELTED_COLOR_COLUMN_TITLE + PROTECTION_SUFFIX

# Name we use for a column we know doesn't exist in the data, to address a Vega-Lite rendering bug
# where empty charts need x, y encodings set in order to take up space.
NON_EXISTENT_COLUMN_NAME = "DOES_NOT_EXIST" + PROTECTION_SUFFIX


class ArrowAltairMixin:
    @gather_metrics("_arrow_line_chart")
    def _arrow_line_chart(
        self,
        data: Data = None,
        *,
        x: Optional[str] = None,
        y: Union[str, Sequence[str], None] = None,
        color: Union[str, Color, List[Color], None] = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> DeltaGenerator:
        """Display a line chart.

        This is syntax-sugar around st._arrow_altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st._arrow_line_chart does not guess the data specification
        correctly, try specifying your desired chart using st._arrow_altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, dict or None
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for
            the x-axis. This argument can only be supplied by keyword.

        y : str, sequence of str, or None
            Column name(s) to use for the y-axis. If a sequence of strings,
            draws several series on the same chart by melting your wide-format
            table into a long-format table behind the scenes. If None, draws
            the data of all remaining columns as data series. This argument
            can only be supplied by keyword.

        color : str, tuple, sequence of str, sequence of tuple, or None
            The color to use for different lines in this chart. This argument
            can only be supplied by keyword.

            For a line chart with just 1 line, this can be:

            * None, to use the default color.
            * A hex string like "#ffaa00" or "#ffaa0088".
            * An RGB or RGBA tuple with the red, green, #04f, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.

            For a line chart with multiple lines, where the dataframe is in
            long format (that is, y is None or just 1 column), this can be:

            * None, to use the default colors.
            * The name of a column in the dataset. Data points will be grouped
              into lines of the same color based on the value of this column.
              In addition, if the values in this column in one of the color
              formats above (hex string or color tuple), then that color will
              be used.

              For example: if the dataset has 1000 rows, but this column can
              only contains the values "adult", "child", "baby",
              then those 1000 datapoints will be grouped into 3 lines, whose
              colors will be automatically selected from the default palette.

              But, if for the same 1000-row dataset, this column contained
              the values "#ffaa00", "#f0f", "#0000ff", then then those 1000
              datapoints would still be grouped into 3 lines, but their
              colors would be "#ffaa00", "#f0f", "#0000ff" this time around.

            For a line chart with multiple lines, where the dataframe is in
            wide format (that is, y is a sequence of columns), this can be:

            * None, to use the default colors.
            * A list of string colors or color tuples to be used for each of
              the lines in the chart. This list should have the same length
              as the number of y values.

              For example, for a chart with have 3 lines this argument can
              be set to ``color=["#fd0", "#f0f", "#04f"]``.

        width : int
            The chart width in pixels. If 0, selects the width automatically.
            This argument can only be supplied by keyword.

        height : int
            The chart height in pixels. If 0, selects the height automatically.
            This argument can only be supplied by keyword.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.
            This argument can only be supplied by keyword.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> st._arrow_line_chart(chart_data)

        .. output::
           https://static.streamlit.io/0.50.0-td2L/index.html?id=BdxXG3MmrVBfJyqS2R2ki8
           height: 220px

        You can also choose different columns to use for x and y, as well as set
        the color dynamically based on a 3rd column (assuming your dataframe is in
        long format):

        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 4),
        ...     columns=['col1', 'col2', 'col3'])
        ...
        >>> st._arrow_line_chart(
        ...     chart_data,
        ...     x='col1',
        ...     y='col2',
        ...     color='col3',
        ... )

        Finally, if your dataframe is in wide format, you can group multiple
        columns under the y argument to show multiple lines with different
        colors:

        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 4),
        ...     columns=['col1', 'col2', 'col3'])
        ...
        >>> st._arrow_line_chart(
        ...     chart_data,
        ...     x='col1',
        ...     y=['col2', 'col3'],
        ...     color=['red', 'black'],
        ... )

        """
        proto = ArrowVegaLiteChartProto()
        chart, add_rows_metadata = _generate_chart(
            chart_type=ChartType.LINE,
            data=data,
            x_from_user=x,
            y_from_user=y,
            color_from_user=color,
            size_from_user=None,
            width=width,
            height=height,
        )
        marshall(proto, chart, use_container_width, theme="streamlit")

        return self.dg._enqueue(
            "arrow_line_chart", proto, add_rows_metadata=add_rows_metadata
        )

    @gather_metrics("_arrow_area_chart")
    def _arrow_area_chart(
        self,
        data: Data = None,
        *,
        x: Optional[str] = None,
        y: Union[str, Sequence[str], None] = None,
        color: Union[str, Color, List[Color], None] = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> DeltaGenerator:
        """Display an area chart.

        This is just syntax-sugar around st._arrow_altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st._arrow_area_chart does not guess the data specification
        correctly, try specifying your desired chart using st._arrow_altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, or dict
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for
            the x-axis. This argument can only be supplied by keyword.

        y : str, sequence of str, or None
            Column name(s) to use for the y-axis. If a sequence of strings,
            draws several series on the same chart by melting your wide-format
            table into a long-format table behind the scenes. If None, draws
            the data of all remaining columns as data series. This argument can
            only be supplied by keyword.

        color : str, tuple, sequence of str, sequence of tuple, or None
            The color to use for different series in this chart. This argument
            can only be supplied by keyword.

            For an area chart with just 1 series, this can be:

            * None, to use the default color.
            * A hex string like "#ffaa00" or "#ffaa0088".
            * An RGB or RGBA tuple with the red, green, #04f, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.

            For an area chart with multiple series, where the dataframe is in
            long format (that is, y is None or just 1 column), this can be:

            * None, to use the default colors.
            * The name of a column in the dataset. Data points will be grouped
              into series of the same color based on the value of this column.
              In addition, if the values in this column in one of the color
              formats above (hex string or color tuple), then that color will
              be used.

              For example: if the dataset has 1000 rows, but this column can
              only contains the values "adult", "child", "baby",
              then those 1000 datapoints will be grouped into 3 series, whose
              colors will be automatically selected from the default palette.

              But, if for the same 1000-row dataset, this column contained
              the values "#ffaa00", "#f0f", "#0000ff", then then those 1000
              datapoints would still be grouped into 3 series, but their
              colors would be "#ffaa00", "#f0f", "#0000ff" this time around.

            For an area chart with multiple series, where the dataframe is in
            wide format (that is, y is a sequence of columns), this can be:

            * None, to use the default colors.
            * A list of string colors or color tuples to be used for each of
              the series in the chart. This list should have the same length
              as the number of y values.

              For example, for a chart with have 3 series this argument can
              be set to ``color=["#fd0", "#f0f", "#04f"]``.

        width : int
            The chart width in pixels. If 0, selects the width automatically.
            This argument can only be supplied by keyword.

        height : int
            The chart height in pixels. If 0, selects the height automatically.
            This argument can only be supplied by keyword.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> st._arrow_area_chart(chart_data)

        .. output::
           https://static.streamlit.io/0.50.0-td2L/index.html?id=Pp65STuFj65cJRDfhGh4Jt
           height: 220px

        You can also choose different columns to use for x and y, as well as set
        the color dynamically based on a 3rd column (assuming your dataframe is in
        long format):

        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 4),
        ...     columns=['col1', 'col2', 'col3'])
        ...
        >>> st._arrow_area_chart(
        ...     chart_data,
        ...     x='col1',
        ...     y='col2',
        ...     color='col3',
        ... )

        Finally, if your dataframe is in wide format, you can group multiple
        columns under the y argument to show multiple lines with different
        colors:

        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 4),
        ...     columns=['col1', 'col2', 'col3'])
        ...
        >>> st._arrow_area_chart(
        ...     chart_data,
        ...     x='col1',
        ...     y=['col2', 'col3'],
        ...     color=['red', 'black'],
        ... )

        """

        proto = ArrowVegaLiteChartProto()
        chart, add_rows_metadata = _generate_chart(
            chart_type=ChartType.AREA,
            data=data,
            x_from_user=x,
            y_from_user=y,
            color_from_user=color,
            size_from_user=None,
            width=width,
            height=height,
        )
        marshall(proto, chart, use_container_width, theme="streamlit")

        return self.dg._enqueue(
            "arrow_area_chart", proto, add_rows_metadata=add_rows_metadata
        )

    @gather_metrics("_arrow_bar_chart")
    def _arrow_bar_chart(
        self,
        data: Data = None,
        *,
        x: Optional[str] = None,
        y: Union[str, Sequence[str], None] = None,
        color: Union[str, Color, List[Color], None] = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> DeltaGenerator:
        """Display a bar chart.

        This is just syntax-sugar around st._arrow_altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st._arrow_bar_chart does not guess the data specification
        correctly, try specifying your desired chart using st._arrow_altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, or dict
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index
            for the x-axis. This argument can only be supplied by keyword.

        y : str, sequence of str, or None
            Column name(s) to use for the y-axis. If a sequence of strings,
            draws several series on the same chart by melting your wide-format
            table into a long-format table behind the scenes. If None, draws
            the data of all remaining columns as data series. This argument
            can only be supplied by keyword.

        color : str, tuple, sequence of str, sequence of tuple, or None
            The color to use for different series in this chart. This argument
            can only be supplied by keyword.

            For a bar chart with just 1 series, this can be:

            * None, to use the default color.
            * A hex string like "#ffaa00" or "#ffaa0088".
            * An RGB or RGBA tuple with the red, green, #04f, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.

            For a bar chart with multiple series, where the dataframe is in
            long format (that is, y is None or just 1 column), this can be:

            * None, to use the default colors.
            * The name of a column in the dataset. Data points will be grouped
              into series of the same color based on the value of this column.
              In addition, if the values in this column in one of the color
              formats above (hex string or color tuple), then that color will
              be used.

              For example: if the dataset has 1000 rows, but this column can
              only contains the values "adult", "child", "baby",
              then those 1000 datapoints will be grouped into 3 series, whose
              colors will be automatically selected from the default palette.

              But, if for the same 1000-row dataset, this column contained
              the values "#ffaa00", "#f0f", "#0000ff", then then those 1000
              datapoints would still be grouped into 3 series, but their
              colors would be "#ffaa00", "#f0f", "#0000ff" this time around.

            For a bar chart with multiple series, where the dataframe is in
            wide format (that is, y is a sequence of columns), this can be:

            * None, to use the default colors.
            * A list of string colors or color tuples to be used for each of
              the series in the chart. This list should have the same length
              as the number of y values.

              For example, for a chart with have 3 series this argument can
              be set to ``color=["#fd0", "#f0f", "#04f"]``.

        width : int
            The chart width in pixels. If 0, selects the width automatically.
            This argument can only be supplied by keyword.

        height : int
            The chart height in pixels. If 0, selects the height automatically.
            This argument can only be supplied by keyword.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.
            This argument can only be supplied by keyword.

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(50, 3),
        ...     columns=["a", "b", "c"])
        ...
        >>> st._arrow_bar_chart(chart_data)

        .. output::
           https://static.streamlit.io/0.66.0-2BLtg/index.html?id=GaYDn6vxskvBUkBwsGVEaL
           height: 220px

        You can also choose different columns to use for x and y, as well as set
        the color dynamically based on a 3rd column (assuming your dataframe is in
        long format):

        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 4),
        ...     columns=['col1', 'col2', 'col3'])
        ...
        >>> st._arrow_bar_chart(
        ...     chart_data,
        ...     x='col1',
        ...     y='col2',
        ...     color='col3',
        ... )

        Finally, if your dataframe is in wide format, you can group multiple
        columns under the y argument to show multiple lines with different
        colors:

        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 4),
        ...     columns=['col1', 'col2', 'col3'])
        ...
        >>> st._arrow_bar_chart(
        ...     chart_data,
        ...     x='col1',
        ...     y=['col2', 'col3'],
        ...     color=['red', 'black'],
        ... )

        """

        proto = ArrowVegaLiteChartProto()
        chart, add_rows_metadata = _generate_chart(
            chart_type=ChartType.BAR,
            data=data,
            x_from_user=x,
            y_from_user=y,
            color_from_user=color,
            size_from_user=None,
            width=width,
            height=height,
        )
        marshall(proto, chart, use_container_width, theme="streamlit")

        return self.dg._enqueue(
            "arrow_bar_chart", proto, add_rows_metadata=add_rows_metadata
        )

    @gather_metrics("_arrow_scatter_chart")
    def _arrow_scatter_chart(
        self,
        data: Data = None,
        *,
        x: Optional[str] = None,
        y: Union[str, Sequence[str], None] = None,
        color: Union[str, Color, List[Color], None] = None,
        size: Union[str, float, None] = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> "DeltaGenerator":
        """Display a scatterplot chart.

        This is syntax-sugar around st.altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st.scatter_chart does not guess the data specification correctly,
        try specifying your desired chart using st.altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, dict or None
            Data to be plotted.
            Pyarrow tables are not supported by Streamlit's legacy DataFrame
            serialization (i.e. with `config.dataFrameSerialization = "legacy"`).
            To use pyarrow tables, please enable pyarrow by changing the config
            setting, `config.dataFrameSerialization = "arrow"`.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for
            the x-axis. This argument can only be supplied by keyword.

        y : str, sequence of str, or None
            Column name(s) to use for the y-axis. If a sequence of strings,
            draws several series on the same chart by melting your wide-format
            table into a long-format table behind the scenes. If None, draws
            the data of all remaining columns as data series. This argument can
            only be supplied by keyword.

        color : str, tuple, sequence of str, sequence of tuple, or None
            The color of the circles representing each datapoint. This argument
            can only be supplied by keyword.

            This can be:

            * None, to use the default color.
            * A hex string like "#ffaa00" or "#ffaa0088".
            * An RGB or RGBA tuple with the red, green, #04f, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.
            * The name of a column in the dataset where the color of that
              datapoint will come from.

              If the values in this column are in one of the color formats
              above (hex string or color tuple), then that color will be used.

              Otherwise, the color will be automatically picked from the
              default palette.

              For example: if the dataset has 1000 rows, but this column can
              only contains the values "adult", "child", "baby", then those
              1000 datapoints be shown using 3 colors from the default palette.

              But if this column only contains floats or ints, then those
              1000 datapoints will be shown using a colors from a continuous
              color gradient.

              Finally, if this column only contains the values "#ffaa00",
              "#f0f", "#0000ff", then then each of those 1000 datapoints will
              be assigned "#ffaa00", "#f0f", or "#0000ff" as appropriate.

            If the dataframe is in wide format (that is, y is a sequence of
            columns), this can also be:

            * A list of string colors or color tuples to be used for each of
              the series in the chart. This list should have the same length
              as the number of y values.

              For example, for a chart with have 3 series this argument can
              be set to ``color=["#fd0", "#f0f", "#04f"]``.

        size : str, float, or None
            The size of the circles representing each point. This argument can
            only be supplied by keyword.

            This can be:

            * A number like 100, to specify a single size to use for all
              datapoints.
            * The name of the column to use for the size. This allows each
              datapoint to be represented by a circle of a different size.

        width : int
            The chart width in pixels. If 0, selects the width automatically.
            This argument can only be supplied by keyword.

        height : int
            The chart height in pixels. If 0, selects the height automatically.
            This argument can only be supplied by keyword.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.
            This argument can only be supplied by keyword.

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> st._arrow_scatter_chart(chart_data)

        You can also choose different columns to use for x and y, as well as set
        the color dynamically based on a 3rd column (assuming your dataframe is in
        long format):

        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 4),
        ...     columns=['col1', 'col2', 'col3', 'col4'])
        ...
        >>> st._arrow_scatter_chart(
        ...     chart_data,
        ...     x='col1',
        ...     y='col2',
        ...     color='col3',
        ...     size='col4',
        ... )

        Finally, if your dataframe is in wide format, you can group multiple
        columns under the y argument to show multiple series with different
        colors:

        >>> st._arrow_scatter_chart(
        ...     chart_data,
        ...     x='col1',
        ...     y=['col2', 'col3'],
        ...     size='col4',
        ...     color=['red', 'black'],
        ... )

        """
        proto = ArrowVegaLiteChartProto()
        chart, add_rows_metadata = _generate_chart(
            chart_type=ChartType.SCATTER,
            data=data,
            x_from_user=x,
            y_from_user=y,
            color_from_user=color,
            size_from_user=size,
            width=width,
            height=height,
        )
        marshall(proto, chart, use_container_width, theme="streamlit")

        return self.dg._enqueue(
            "arrow_scatter_chart", proto, add_rows_metadata=add_rows_metadata
        )

    @gather_metrics("_arrow_altair_chart")
    def _arrow_altair_chart(
        self,
        altair_chart: alt.Chart,
        use_container_width: bool = False,
        theme: Union[None, Literal["streamlit"]] = "streamlit",
    ) -> DeltaGenerator:
        """Display a chart using the Altair library.

        Parameters
        ----------
        altair_chart : altair.Chart
            The Altair chart object to display.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Altair's native `width` value.

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>> import altair as alt
        >>>
        >>> df = pd.DataFrame(
        ...     np.random.randn(200, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> c = alt.Chart(df).mark_circle().encode(
        ...     x='a', y='b', size='c', color='c', tooltip=['a', 'b', 'c'])
        >>>
        >>> st._arrow_altair_chart(c, use_container_width=True)

        .. output::
           https://static.streamlit.io/0.25.0-2JkNY/index.html?id=8jmmXR8iKoZGV4kXaKGYV5
           height: 200px

        Examples of Altair charts can be found at
        https://altair-viz.github.io/gallery/.

        """
        if theme != "streamlit" and theme != None:
            raise StreamlitAPIException(
                f'You set theme="{theme}" while Streamlit charts only support theme=”streamlit” or theme=None to fallback to the default library theme.'
            )
        proto = ArrowVegaLiteChartProto()
        marshall(
            proto,
            altair_chart,
            use_container_width=use_container_width,
            theme=theme,
        )

        return self.dg._enqueue("arrow_vega_lite_chart", proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def _is_date_column(df: pd.DataFrame, name: Optional[str]) -> bool:
    """True if the column with the given name stores datetime.date values.

    This function just checks the first value in the given column, so
    it's meaningful only for columns whose values all share the same type.

    Parameters
    ----------
    df : pd.DataFrame
    name : str
        The column name

    Returns
    -------
    bool

    """
    if name is None:
        return False

    column = df[name]
    if column.size == 0:
        return False

    return isinstance(column.iloc[0], date)


def prep_data(
    df: pd.DataFrame,
    x_column: Optional[str],
    wide_y_columns: List[str],
    color_column: Optional[str],
    size_column: Optional[str],
) -> Tuple[pd.DataFrame, Optional[str], List[str], Optional[str], Optional[str]]:
    """Prepares the data for charting. This is also used in add_rows.

    Does a few things:
    * Resets the index if needed
    * Removes unnecessary columns
    * Converts colors to values we can use
    * Runs sanity checks

    Returns the prepared dataframe and the new names of the x column (taking the index reset into
    consideration) and y, color, and size columns (converting to str if needed).
    """

    # If y is provided, by x is not, we'll use the index as x.
    # So we need to pull the index into its own column.
    if x_column is None and len(wide_y_columns) > 0:
        if df.index.name is None:
            # Pick column name that is unlikely to collide with user-given names.
            x_column = SEPARATED_INDEX_COLUMN_NAME
        else:
            # Reuse index's name for the new column.
            x_column = df.index.name

        df = df.reset_index(names=x_column)

    # Drop columns we're not using.
    selected_data = _drop_unused_columns(
        df, x_column, color_column, size_column, *wide_y_columns
    )

    # Maybe convert color to CSS-valid colors.
    if color_column is not None and len(df[color_column]):
        first_color_datum = df[color_column][0]

        if is_hex_color_like(first_color_datum):
            # Hex is already CSS-valid.
            pass
        elif is_color_tuple_like(first_color_datum):
            # Tuples need to be converted to CSS-valid.
            selected_data[color_column] = selected_data[color_column].map(to_css_color)
        else:
            # Other kinds of colors columns (i.e. pure numbers or nominal strings) shouldn't
            # be converted since they are treated by Vega-Lite as sequential or categorical colors.
            pass

    # Arrow has problems with object types after melting two different dtypes
    # pyarrow.lib.ArrowTypeError: "Expected a <TYPE> object, got a object".
    prepped_data = type_util.fix_arrow_incompatible_column_types(selected_data)

    prepped_columns = _convert_col_names_to_str(
        prepped_data, x_column, wide_y_columns, color_column, size_column
    )

    # Return the data, but also the new names to use for x, y, and color.
    return prepped_data, *prepped_columns


def _generate_chart(
    chart_type: ChartType,
    data: Optional[Data],
    x_from_user: Optional[str] = None,
    y_from_user: Union[str, Sequence[str], None] = None,
    color_from_user: Union[str, Color, List[Color], None] = None,
    size_from_user: Union[str, float, None] = None,
    width: int = 0,
    height: int = 0,
) -> alt.Chart:
    """Function to use the chart's type, data columns and indices to figure out the chart's spec."""
    import altair as alt

    df = type_util.convert_anything_to_df(data)

    # From now on, use "df" instead of "data". Deleting "data" to guarantee we follow this.
    del data

    # Also, very important: we should NEVER mutate df. When required, we should instead
    # copy it, like we do in prep_data(). (Of course, we have a mutation test in
    # arrow_altair_test, so this notice is just for extra clarity!)

    # Convert arguments received from the user to things Vega-Lite understands.
    # Get name of column to use for x. This is never None.
    x_column = _parse_x_column(df, x_from_user)
    # Get name of columns to use for y. This is never None.
    wide_y_columns = _parse_y_columns(df, y_from_user, x_column)
    # Get name of column to use for color, or constant value to use. Any/both could be None.
    color_column, color_value = _parse_generic_column(df, color_from_user)
    # Get name of column to use for size, or constant value to use. Any/both could be None.
    size_column, size_value = _parse_generic_column(df, size_from_user)

    # Store this info for add_rows.
    add_rows_metadata = AddRowsMetadata(
        last_index=last_index_for_melted_dataframes(df),
        columns=dict(
            x_column=x_column,
            wide_y_columns=wide_y_columns,
            color_column=color_column,
            size_column=size_column,
        ),
    )

    # At this point, all foo_column variables are either None or actual columns that are guaranteed
    # to exist.

    df, x_column, wide_y_columns, color_column, size_column = prep_data(
        df, x_column, wide_y_columns, color_column, size_column
    )

    # At this point, x_column is only None if user did not provide one AND df is empty.
    # Similarly, wide_y_columns is only empty if the same conditions are true.

    # Create a Chart with no encodings.
    chart = alt.Chart(
        data=df,
        mark=chart_type.value["mark_type"],
        width=width,
        height=height,
    )

    # Set up melting (aka folding) if more than 1 item in wide_y_columns.
    chart, y_column, color_column = _maybe_melt(chart, wide_y_columns, color_column)

    # Set up x and y encodings.
    chart = chart.encode(
        x=_get_x_enc(df, x_column, x_from_user, chart_type),
        y=_get_y_enc(df, y_column, y_from_user, wide_y_columns),
    )

    # Set up opacity encoding.
    opacity_enc = _get_opacity_enc(chart_type, color_column)
    if opacity_enc is not None:
        chart = chart.encode(opacity=opacity_enc)

    # Set up color encoding.
    color_enc = _get_color_enc(
        df, color_from_user, color_value, color_column, wide_y_columns
    )
    if color_enc is not None:
        chart = chart.encode(color=color_enc)

    # Set up size encoding.
    size_enc = _get_size_enc(chart_type, size_column, size_value)
    if size_enc is not None:
        chart = chart.encode(size=size_enc)

    # Set up tooltip encoding.
    if x_column is not None and y_column is not None:
        chart = chart.encode(
            tooltip=_get_tooltip_enc(
                x_column,
                y_column,
                size_column,
                color_column,
                color_enc,
            )
        )

    return chart.interactive(), add_rows_metadata


def _convert_col_names_to_str(
    df: pd.DataFrame,
    x_column: Optional[str],
    wide_y_columns: List[str],
    color_column: Optional[str],
    size_column: Optional[str],
) -> Tuple[Optional[str], List[str], Optional[str], Optional[str]]:
    """Converts column names to strings, since Vega-Lite does not accept ints, etc."""
    column_names = list(df.columns)  # list() converts RangeIndex, etc, to regular list.
    str_column_names = [str(c) for c in column_names]
    df.columns = pd.Index(str_column_names)

    return (
        x_column,
        [str(c) for c in wide_y_columns],
        None if color_column is None else str(color_column),
        None if size_column is None else str(size_column),
    )


def _parse_generic_column(
    df: pd.DataFrame, column_or_value: Any
) -> Tuple[Optional[str], Any]:
    if isinstance(column_or_value, str) and column_or_value in df.columns:
        column_name = column_or_value
        value = None
    else:
        column_name = None
        value = column_or_value

    return column_name, value


def _parse_x_column(df: pd.DataFrame, x_from_user: Optional[str]) -> Optional[str]:
    if x_from_user is None:
        return None

    elif isinstance(x_from_user, str):
        if x_from_user not in df.columns:
            raise StreamlitAPIException(
                "x parameter is a str but does not appear to be a column name. "
                f"Value given: {x_from_user}"
            )

        return x_from_user

    else:
        raise StreamlitAPIException(
            "x parameter should be a column name (str) or None to use the "
            f" dataframe's index. Value given: {x_from_user}"
        )


def _parse_y_columns(
    df: pd.DataFrame,
    y_from_user: Union[str, Sequence[str], None],
    x_column: Union[str, None],
) -> List[str]:

    wide_y_columns: List[str] = []

    if y_from_user is None:
        wide_y_columns = list(df.columns)

    elif isinstance(y_from_user, str):
        wide_y_columns = [y_from_user]

    elif type_util.is_sequence(y_from_user):
        wide_y_columns = list(str(col) for col in y_from_user)

    else:
        raise StreamlitAPIException(
            "y parameter should be a column name (str) or list thereof. "
            f"Value given: {y_from_user}"
        )

    for col in wide_y_columns:
        if col not in df.columns:
            available_columns = ", ".join(str(c) for c in list(df.columns))
            raise StreamlitAPIException(
                f"Dataset does not have a column named {col}. "
                f"Available columns are: {available_columns}"
            )

    # wide_y_columns should only include x_column when user explicitly asked for it.
    if x_column in wide_y_columns and (not y_from_user or x_column not in y_from_user):
        wide_y_columns.remove(x_column)

    return wide_y_columns


def _drop_unused_columns(
    df: pd.DataFrame, *column_names: Optional[str]
) -> pd.DataFrame:
    """Returns a subset of df, selecting only column_names that aren't None."""

    # We can't just call set(col_names) because sets don't have stable ordering,
    # which means tests that depend on ordering will fail.
    # Performance-wise, it's not a problem, though, since this function is only ever
    # used on very small lists.
    seen = set()
    keep = []

    for x in column_names:
        if x is None:
            continue
        if x in seen:
            continue
        seen.add(x)
        keep.append(x)

    return df[keep]


def _get_opacity_enc(
    chart_type: ChartType, color_column: Optional[str]
) -> Optional[alt.OpacityValue]:
    import altair as alt

    if color_column and chart_type == ChartType.AREA:
        return alt.OpacityValue(0.7)

    return None


def _get_scale(df: pd.DataFrame, column_name: Optional[str]) -> alt.Scale:
    import altair as alt

    # Set the X and Y axes' scale to "utc" if they contain date values.
    # This causes time data to be displayed in UTC, rather the user's local
    # time zone. (By default, vega-lite displays time data in the browser's
    # local time zone, regardless of which time zone the data specifies:
    # https://vega.github.io/vega-lite/docs/timeunit.html#output).
    if _is_date_column(df, column_name):
        return alt.Scale(type="utc")

    return alt.Scale()


def _get_axis_config(
    df: pd.DataFrame, column_name: Optional[str], grid: bool
) -> alt.Axis:
    import altair as alt

    if column_name is not None and is_integer_dtype(df[column_name]):
        # Use a max tick size of 1 for integer columns (prevents zoom into float numbers)
        # and deactivate grid lines for x-axis
        return alt.Axis(tickMinStep=1, grid=grid)

    return alt.Axis(grid=grid)


def _maybe_melt(
    chart: alt.Chart, wide_y_columns: List[str], color_column: Optional[str]
) -> Tuple[alt.Chart, Optional[str], Optional[str]]:
    """If multiple columns are set for y, melt the dataframe into long format.

    (Melting is done automatically in Vega-Lite via a "fold" transform)
    """
    if len(wide_y_columns) == 0:
        y_column = None
    elif len(wide_y_columns) == 1:
        y_column = wide_y_columns[0]
    else:
        # Pick column names that are unlikely to collide with user-given names.
        y_column = MELTED_Y_COLUMN_NAME
        color_column = MELTED_COLOR_COLUMN_NAME

        chart = chart.transform_fold(wide_y_columns, as_=[color_column, y_column])

    return chart, y_column, color_column


def _get_x_enc(
    df: pd.DataFrame,
    x_column: Optional[str],
    x_from_user: Optional[str],
    chart_type: ChartType,
) -> alt.X:
    import altair as alt

    if x_column is None:
        # If no field is specified, the full axis disappears when no data is present.
        # Maybe a bug in vega-lite? So we pass a field that doesn't exist.
        x_field = NON_EXISTENT_COLUMN_NAME
        x_title = ""
    elif x_column == SEPARATED_INDEX_COLUMN_NAME:
        # If the x column name is the crazy anti-collision name we gave it, then need to set
        # up a title so we never show the crazy name to the user.
        x_field = x_column
        # Don't show a label in the x axis (not even a nice label like
        # SEPARATED_INDEX_COLUMN_TITLE) when we pull the x axis from the index.
        x_title = ""
    else:
        x_field = x_column

        # Only show a label in the x axis if the user passed a column explicitly. We
        # could go either way here, but I'm keeping this to avoid breaking the existing
        # behavior.
        if x_from_user is None:
            x_title = ""
        else:
            x_title = x_column

    return alt.X(
        x_field,
        title=x_title,
        type=_get_x_type(df, chart_type, x_column),
        scale=_get_scale(df, x_column),
        axis=_get_axis_config(df, x_column, grid=False),
    )


def _get_y_enc(
    df: pd.DataFrame,
    y_column: Optional[str],
    y_from_user: Union[str, Sequence[str], None],
    wide_y_columns: List[str],
) -> alt.Y:
    import altair as alt

    first_y_column: Optional[str]

    if y_column is None:
        # If no field is specified, the full axis disappears when no data is present.
        # Maybe a bug in vega-lite? So we pass a field that doesn't exist.
        y_field = NON_EXISTENT_COLUMN_NAME
        y_title = ""
    elif y_column == MELTED_Y_COLUMN_NAME:
        # If the y column name is the crazy anti-collision name we gave it, then need to set
        # up a title so we never show the crazy name to the user.
        y_field = y_column
        # Don't show a label in the y axis (not even a nice label like
        # MELTED_Y_COLUMN_TITLE) when we pull the x axis from the index.
        y_title = ""
    else:
        y_field = y_column

        # Only show a label in the y axis if the user passed a column explicitly. We
        # could go either way here, but I'm keeping this to avoid breaking the existing
        # behavior.
        if y_from_user is None:
            y_title = ""
        else:
            y_title = y_column

    if wide_y_columns:
        # For dataframes that will be folded, we use the type of the 1st y column as a
        # proxy to configure the chart. This is correct 99% of the times, since all y
        # columns typically have the same data type.
        first_y_column = wide_y_columns[0]
    else:
        first_y_column = y_column

    return alt.Y(
        field=y_field,
        title=y_title,
        type=_get_y_type(df, first_y_column),
        scale=_get_scale(df, first_y_column),
        axis=_get_axis_config(df, first_y_column, grid=True),
    )


def _get_tooltip_enc(
    x_column: str,
    y_column: str,
    size_column: Optional[str],
    color_column: Optional[str],
    color_enc: alt.Color,
) -> list[alt.Tooltip]:
    import altair as alt

    tooltip = []

    # If the x column name is the crazy anti-collision name we gave it, then need to set
    # up a tooltip title so we never show the crazy name to the user.
    if x_column == SEPARATED_INDEX_COLUMN_NAME:
        tooltip.append(alt.Tooltip(x_column, title=SEPARATED_INDEX_COLUMN_TITLE))
    else:
        tooltip.append(alt.Tooltip(x_column))

    # If the y column name is the crazy anti-collision name we gave it, then need to set
    # up a tooltip title so we never show the crazy name to the user.
    if y_column == MELTED_Y_COLUMN_NAME:
        tooltip.append(
            alt.Tooltip(
                y_column,
                title=MELTED_Y_COLUMN_TITLE,
                type="quantitative",  # Just picked something random. Doesn't really matter!
            )
        )
    else:
        tooltip.append(alt.Tooltip(y_column))

    # If we earlier decided that there should be no color legend, that's because the
    # user passed a color column with actual color values (like "#ff0"), so we should
    # not show the color values in the tooltip.
    if color_column and color_enc["legend"] is not None:
        # Use a human-readable title for the color.
        if color_column == MELTED_COLOR_COLUMN_NAME:
            tooltip.append(
                alt.Tooltip(
                    color_column,
                    title=MELTED_COLOR_COLUMN_TITLE,
                    type="nominal",
                )
            )
        else:
            tooltip.append(alt.Tooltip(color_column))

    if size_column:
        tooltip.append(alt.Tooltip(size_column))

    return tooltip


def _get_size_enc(
    chart_type: ChartType,
    size_column: Optional[str],
    size_value: Union[str, float, None],
) -> alt.Size:
    import altair as alt

    if chart_type == ChartType.SCATTER:
        if size_column is not None:
            return alt.Size(
                size_column,
                legend=SIZE_LEGEND_SETTINGS,
            )

        elif isinstance(size_value, (float, int)):
            return alt.SizeValue(size_value)
        elif size_value is None:
            return alt.SizeValue(100)
        else:
            raise StreamlitAPIException(
                f"This does not look like a valid size: {repr(size_value)}"
            )

    elif size_column is not None or size_value is not None:
        raise Error(
            f"Chart type {chart_type.name} does not not support size argument. "
            "This should never happen!"
        )

    return None


def _get_color_enc(
    df: pd.DataFrame,
    color_from_user: Union[str, Color, List[Color], None],
    color_value: Optional[Color],
    color_column: Optional[str],
    wide_y_columns: List[str],
) -> alt.Color:
    import altair as alt

    # If not color, nothing to do here.
    if color_value is None and color_column is None:
        return None

    # If user passed a color value, that should win over colors coming from the
    # color column (be them manual or auto-assigned due to melting)
    elif color_value is not None:

        # If the color value is color-like, return that.
        if is_color_like(color_value):
            return alt.ColorValue(to_css_color(color_value))

        # If the color value is a list of colors of approriate length, return that.
        elif isinstance(color_value, (list, tuple)):
            color_values = cast(Collection[Color], color_value)

            if len(color_values) != len(wide_y_columns):
                raise StreamlitAPIException(
                    f"The number of provided colors in `{color_values}` does not "
                    "match the number of columns to be colored, in "
                    f"`{wide_y_columns}`."
                )

            return alt.Color(
                field=color_column,
                scale=alt.Scale(range=[to_css_color(c) for c in color_values]),
                legend=COLOR_LEGEND_SETTINGS,
                type="nominal",
                title=" ",
            )

    elif color_column is not None:
        column_type: Union[str, Tuple[str, List[Any]]]

        if color_column == MELTED_COLOR_COLUMN_NAME:
            column_type = "nominal"
        else:
            column_type = type_util.infer_vegalite_type(df[color_column])

        color_enc = alt.Color(
            field=color_column, legend=COLOR_LEGEND_SETTINGS, type=column_type
        )

        # Fix title if DF was melted
        if color_column == MELTED_COLOR_COLUMN_NAME:
            # This has to contain an empty space, otherwise the
            # full y-axis disappears (maybe a bug in vega-lite)?
            color_enc["title"] = " "

        # If the 0th element in the color column looks like a color, we'll use the color column's
        # values as the colors in our chart.
        elif len(df[color_column]) and is_color_like(df[color_column][0]):
            color_range = [to_css_color(c) for c in df[color_column].unique()]
            color_enc["scale"] = alt.Scale(range=color_range)
            # Don't show the color legend, because it will just show text with the color values,
            # like #f00, #00f, etc, which are not user-readable.
            color_enc["legend"] = None

        # Otherwise, let Vega-Lite auto-assign colors.
        # This codepath is typically reached when the color column contains numbers (in which case
        # Vega-Lite uses a color gradient to represent them) or strings (in which case Vega-Lite
        # assigns one color for each unique value).
        else:
            pass

        return color_enc

    return None


def _get_x_type(
    df: pd.DataFrame, chart_type: ChartType, x_column: Optional[str]
) -> Union[str, Tuple[str, List[Any]]]:
    if x_column is None:
        return "quantitative"  # Anything. If None, Vega-Lite may hide the axis.

    # Bar charts should have a discrete (ordinal) x-axis, UNLESS type is date/time
    # https://github.com/streamlit/streamlit/pull/2097#issuecomment-714802475
    if chart_type == ChartType.BAR and not _is_date_column(df, x_column):
        return "ordinal"

    return type_util.infer_vegalite_type(df[x_column])


def _get_y_type(
    df: pd.DataFrame, first_y_column: Optional[str]
) -> Union[str, Tuple[str, List[Any]]]:
    if first_y_column:
        return type_util.infer_vegalite_type(df[first_y_column])

    return "quantitative"  # Pick anything. If undefined, Vega-Lite may hide the axis.


def _dedupe_and_remove_none(*items):
    """Returns a subset of "items" where there are no dupes or Nones."""

    # Can't just call set(items) because sets don't have stable ordering,
    # which means tests that depend on ordering will fail.
    # Performance-wise, it's not a problem, though, since this function is only ever
    # used on very small lists.
    seen = set()
    out = []

    for x in items:
        if x is None:
            continue
        if x in seen:
            continue
        seen.add(x)
        out.append(x)

    return out


def marshall(
    vega_lite_chart: ArrowVegaLiteChartProto,
    altair_chart: alt.Chart,
    use_container_width: bool = False,
    theme: Union[None, Literal["streamlit"]] = "streamlit",
    **kwargs: Any,
) -> None:
    """Marshall chart's data into proto."""
    import altair as alt

    # Normally altair_chart.to_dict() would transform the dataframe used by the
    # chart into an array of dictionaries. To avoid that, we install a
    # transformer that replaces datasets with a reference by the object id of
    # the dataframe. We then fill in the dataset manually later on.

    datasets = {}

    def id_transform(data) -> Dict[str, str]:
        """Altair data transformer that returns a fake named dataset with the
        object id.
        """
        datasets[id(data)] = data
        return {"name": str(id(data))}

    alt.data_transformers.register("id", id_transform)

    # The default altair theme has some width/height defaults defined
    # which are not useful for Streamlit. Therefore, we change the theme to
    # "none" to avoid those defaults.
    with alt.themes.enable("none") if alt.themes.active == "default" else nullcontext():
        with alt.data_transformers.enable("id"):
            chart_dict = altair_chart.to_dict()

            # Put datasets back into the chart dict but note how they weren't
            # transformed.
            chart_dict["datasets"] = datasets

            arrow_vega_lite.marshall(
                vega_lite_chart,
                chart_dict,
                use_container_width=use_container_width,
                theme=theme,
                **kwargs,
            )
