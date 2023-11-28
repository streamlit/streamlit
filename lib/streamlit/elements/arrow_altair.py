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
from typing import TYPE_CHECKING, Any, Collection, Dict, List, Sequence, Tuple, cast

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
#
# NOTE: I don't think it's possible to *perfectly* align the size and
# color legends in all instances, since the "size" circles vary in size based
# on the data, and their container is top-aligned with the color container. But
# through trial-and-error I found this value to be a good enough middle ground.
# See e2e/scripts/st_arrow_scatter_chart.py for some alignment tests.
#
# NOTE #2: In theory, we could move COLOR_LEGEND_SETTINGS into
# ArrowVegaLiteChart/CustomTheme.tsx, but this would impact existing behavior.
# (See https://github.com/streamlit/streamlit/pull/7164#discussion_r1307707345)
COLOR_LEGEND_SETTINGS = dict(titlePadding=5, offset=5, orient="bottom")
SIZE_LEGEND_SETTINGS = dict(titlePadding=0.5, offset=5, orient="bottom")

# User-readable names to give the index and melted columns.
SEPARATED_INDEX_COLUMN_TITLE = "index"
MELTED_Y_COLUMN_TITLE = "value"
MELTED_COLOR_COLUMN_TITLE = "color"

# Crazy internal (non-user-visible) names for the index and melted columns, in order to
# avoid collision with existing column names. The suffix below was generated with an
# online random number generator. Rationale: because it makes it even less likely to
# lead to a conflict than something that's human-readable (like "--streamlit-fake-field"
# or something).
PROTECTION_SUFFIX = "--p5bJXXpQgvPz6yvQMFiy"
SEPARATED_INDEX_COLUMN_NAME = SEPARATED_INDEX_COLUMN_TITLE + PROTECTION_SUFFIX
MELTED_Y_COLUMN_NAME = MELTED_Y_COLUMN_TITLE + PROTECTION_SUFFIX
MELTED_COLOR_COLUMN_NAME = MELTED_COLOR_COLUMN_TITLE + PROTECTION_SUFFIX

# Name we use for a column we know doesn't exist in the data, to address a Vega-Lite rendering bug
# where empty charts need x, y encodings set in order to take up space.
NON_EXISTENT_COLUMN_NAME = "DOES_NOT_EXIST" + PROTECTION_SUFFIX


class ArrowAltairMixin:
    @gather_metrics("line_chart")
    def line_chart(
        self,
        data: Data = None,
        *,
        x: str | None = None,
        y: str | Sequence[str] | None = None,
        color: str | Color | List[Color] | None = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> DeltaGenerator:
        """Display a line chart.

        This is syntax-sugar around ``st.altair_chart``. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If ``st.line_chart`` does not guess the data specification
        correctly, try specifying your desired chart using ``st.altair_chart``.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, dict or None
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.

        y : str, Sequence of str, or None
            Column name(s) to use for the y-axis. If a Sequence of strings,
            draws several series on the same chart by melting your wide-format
            table into a long-format table behind the scenes. If None, draws
            the data of all remaining columns as data series.

        color : str, tuple, Sequence of str, Sequence of tuple, or None
            The color to use for different lines in this chart.

            For a line chart with just one line, this can be:

            * None, to use the default color.
            * A hex string like "#ffaa00" or "#ffaa0088".
            * An RGB or RGBA tuple with the red, green, blue, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.

            For a line chart with multiple lines, where the dataframe is in
            long format (that is, y is None or just one column), this can be:

            * None, to use the default colors.
            * The name of a column in the dataset. Data points will be grouped
              into lines of the same color based on the value of this column.
              In addition, if the values in this column match one of the color
              formats above (hex string or color tuple), then that color will
              be used.

              For example: if the dataset has 1000 rows, but this column only
              contains the values "adult", "child", and "baby", then those 1000
              datapoints will be grouped into three lines whose colors will be
              automatically selected from the default palette.

              But, if for the same 1000-row dataset, this column contained
              the values "#ffaa00", "#f0f", "#0000ff", then then those 1000
              datapoints would still be grouped into three lines, but their
              colors would be "#ffaa00", "#f0f", "#0000ff" this time around.

            For a line chart with multiple lines, where the dataframe is in
            wide format (that is, y is a Sequence of columns), this can be:

            * None, to use the default colors.
            * A list of string colors or color tuples to be used for each of
              the lines in the chart. This list should have the same length
              as the number of y values (e.g. ``color=["#fd0", "#f0f", "#04f"]``
              for three lines).

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
        >>>
        >>> st.line_chart(chart_data)

        .. output::
           https://doc-line-chart.streamlit.app/
           height: 440px

        You can also choose different columns to use for x and y, as well as set
        the color dynamically based on a 3rd column (assuming your dataframe is in
        long format):

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(
        ...    {
        ...        "col1": np.random.randn(20),
        ...        "col2": np.random.randn(20),
        ...        "col3": np.random.choice(["A", "B", "C"], 20),
        ...    }
        ... )
        >>>
        >>> st.line_chart(chart_data, x="col1", y="col2", color="col3")

        .. output::
           https://doc-line-chart1.streamlit.app/
           height: 440px

        Finally, if your dataframe is in wide format, you can group multiple
        columns under the y argument to show multiple lines with different
        colors:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["col1", "col2", "col3"])
        >>>
        >>> st.line_chart(
        ...    chart_data, x="col1", y=["col2", "col3"], color=["#FF0000", "#0000FF"]  # Optional
        ... )

        .. output::
           https://doc-line-chart2.streamlit.app/
           height: 440px

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

    @gather_metrics("area_chart")
    def area_chart(
        self,
        data: Data = None,
        *,
        x: str | None = None,
        y: str | Sequence[str] | None = None,
        color: str | Color | List[Color] | None = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> DeltaGenerator:
        """Display an area chart.

        This is syntax-sugar around ``st.altair_chart``. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If ``st.area_chart`` does not guess the data specification
        correctly, try specifying your desired chart using ``st.altair_chart``.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, or dict
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.

        y : str, Sequence of str, or None
            Column name(s) to use for the y-axis. If a Sequence of strings,
            draws several series on the same chart by melting your wide-format
            table into a long-format table behind the scenes. If None, draws
            the data of all remaining columns as data series.

        color : str, tuple, Sequence of str, Sequence of tuple, or None
            The color to use for different series in this chart.

            For an area chart with just 1 series, this can be:

            * None, to use the default color.
            * A hex string like "#ffaa00" or "#ffaa0088".
            * An RGB or RGBA tuple with the red, green, blue, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.

            For an area chart with multiple series, where the dataframe is in
            long format (that is, y is None or just one column), this can be:

            * None, to use the default colors.
            * The name of a column in the dataset. Data points will be grouped
              into series of the same color based on the value of this column.
              In addition, if the values in this column match one of the color
              formats above (hex string or color tuple), then that color will
              be used.

              For example: if the dataset has 1000 rows, but this column only
              contains the values "adult", "child", and "baby", then those 1000
              datapoints will be grouped into three series whose colors will be
              automatically selected from the default palette.

              But, if for the same 1000-row dataset, this column contained
              the values "#ffaa00", "#f0f", "#0000ff", then then those 1000
              datapoints would still be grouped into 3 series, but their
              colors would be "#ffaa00", "#f0f", "#0000ff" this time around.

            For an area chart with multiple series, where the dataframe is in
            wide format (that is, y is a Sequence of columns), this can be:

            * None, to use the default colors.
            * A list of string colors or color tuples to be used for each of
              the series in the chart. This list should have the same length
              as the number of y values (e.g. ``color=["#fd0", "#f0f", "#04f"]``
              for three lines).

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
        >>>
        >>> st.area_chart(chart_data)

        .. output::
           https://doc-area-chart.streamlit.app/
           height: 440px

        You can also choose different columns to use for x and y, as well as set
        the color dynamically based on a 3rd column (assuming your dataframe is in
        long format):

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(
        ...    {
        ...        "col1": np.random.randn(20),
        ...        "col2": np.random.randn(20),
        ...        "col3": np.random.choice(["A", "B", "C"], 20),
        ...    }
        ... )
        >>>
        >>> st.area_chart(chart_data, x="col1", y="col2", color="col3")

        .. output::
           https://doc-area-chart1.streamlit.app/
           height: 440px

        Finally, if your dataframe is in wide format, you can group multiple
        columns under the y argument to show multiple series with different
        colors:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["col1", "col2", "col3"])
        >>>
        >>> st.area_chart(
        ...    chart_data, x="col1", y=["col2", "col3"], color=["#FF0000", "#0000FF"]  # Optional
        ... )

        .. output::
           https://doc-area-chart2.streamlit.app/
           height: 440px

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

    @gather_metrics("bar_chart")
    def bar_chart(
        self,
        data: Data = None,
        *,
        x: str | None = None,
        y: str | Sequence[str] | None = None,
        color: str | Color | List[Color] | None = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> DeltaGenerator:
        """Display a bar chart.

        This is syntax-sugar around ``st.altair_chart``. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If ``st.bar_chart`` does not guess the data specification
        correctly, try specifying your desired chart using ``st.altair_chart``.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, or dict
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.

        y : str, Sequence of str, or None
            Column name(s) to use for the y-axis. If a Sequence of strings,
            draws several series on the same chart by melting your wide-format
            table into a long-format table behind the scenes. If None, draws
            the data of all remaining columns as data series.

        color : str, tuple, Sequence of str, Sequence of tuple, or None
            The color to use for different series in this chart.

            For a bar chart with just one series, this can be:

            * None, to use the default color.
            * A hex string like "#ffaa00" or "#ffaa0088".
            * An RGB or RGBA tuple with the red, green, blue, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.

            For a bar chart with multiple series, where the dataframe is in
            long format (that is, y is None or just one column), this can be:

            * None, to use the default colors.
            * The name of a column in the dataset. Data points will be grouped
              into series of the same color based on the value of this column.
              In addition, if the values in this column match one of the color
              formats above (hex string or color tuple), then that color will
              be used.

              For example: if the dataset has 1000 rows, but this column only
              contains the values "adult", "child", and "baby", then those 1000
              datapoints will be grouped into three series whose colors will be
              automatically selected from the default palette.

              But, if for the same 1000-row dataset, this column contained
              the values "#ffaa00", "#f0f", "#0000ff", then then those 1000
              datapoints would still be grouped into 3 series, but their
              colors would be "#ffaa00", "#f0f", "#0000ff" this time around.

            For a bar chart with multiple series, where the dataframe is in
            wide format (that is, y is a Sequence of columns), this can be:

            * None, to use the default colors.
            * A list of string colors or color tuples to be used for each of
              the series in the chart. This list should have the same length
              as the number of y values (e.g. ``color=["#fd0", "#f0f", "#04f"]``
              for three lines).

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
        >>>
        >>> st.bar_chart(chart_data)

        .. output::
           https://doc-bar-chart.streamlit.app/
           height: 440px

        You can also choose different columns to use for x and y, as well as set
        the color dynamically based on a 3rd column (assuming your dataframe is in
        long format):

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(
        ...    {
        ...        "col1": list(range(20)) * 3,
        ...        "col2": np.random.randn(60),
        ...        "col3": ["A"] * 20 + ["B"] * 20 + ["C"] * 20,
        ...    }
        ... )
        >>>
        >>> st.bar_chart(chart_data, x="col1", y="col2", color="col3")

        .. output::
           https://doc-bar-chart1.streamlit.app/
           height: 440px

        Finally, if your dataframe is in wide format, you can group multiple
        columns under the y argument to show multiple series with different
        colors:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(
        ...    {"col1": list(range(20)), "col2": np.random.randn(20), "col3": np.random.randn(20)}
        ... )
        >>>
        >>> st.bar_chart(
        ...    chart_data, x="col1", y=["col2", "col3"], color=["#FF0000", "#0000FF"]  # Optional
        ... )

        .. output::
           https://doc-bar-chart2.streamlit.app/
           height: 440px

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

    @gather_metrics("scatter_chart")
    def scatter_chart(
        self,
        data: Data = None,
        *,
        x: str | None = None,
        y: str | Sequence[str] | None = None,
        color: str | Color | List[Color] | None = None,
        size: str | float | int | None = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> "DeltaGenerator":
        """Display a scatterplot chart.

        This is syntax-sugar around ``st.altair_chart``. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If ``st.scatter_chart`` does not guess the data specification correctly,
        try specifying your desired chart using ``st.altair_chart``.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, dict or None
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.

        y : str, Sequence of str, or None
            Column name(s) to use for the y-axis. If a Sequence of strings,
            draws several series on the same chart by melting your wide-format
            table into a long-format table behind the scenes. If None, draws
            the data of all remaining columns as data series.

        color : str, tuple, Sequence of str, Sequence of tuple, or None
            The color of the circles representing each datapoint.

            This can be:

            * None, to use the default color.
            * A hex string like "#ffaa00" or "#ffaa0088".
            * An RGB or RGBA tuple with the red, green, blue, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.
            * The name of a column in the dataset where the color of that
              datapoint will come from.

              If the values in this column are in one of the color formats
              above (hex string or color tuple), then that color will be used.

              Otherwise, the color will be automatically picked from the
              default palette.

              For example: if the dataset has 1000 rows, but this column only
              contains the values "adult", "child", and "baby", then those 1000
              datapoints be shown using three colors from the default palette.

              But if this column only contains floats or ints, then those
              1000 datapoints will be shown using a colors from a continuous
              color gradient.

              Finally, if this column only contains the values "#ffaa00",
              "#f0f", "#0000ff", then then each of those 1000 datapoints will
              be assigned "#ffaa00", "#f0f", or "#0000ff" as appropriate.

            If the dataframe is in wide format (that is, y is a Sequence of
            columns), this can also be:

            * A list of string colors or color tuples to be used for each of
              the series in the chart. This list should have the same length
              as the number of y values (e.g. ``color=["#fd0", "#f0f", "#04f"]``
              for three series).

        size : str, float, int, or None
            The size of the circles representing each point.

            This can be:

            * A number like 100, to specify a single size to use for all
              datapoints.
            * The name of the column to use for the size. This allows each
              datapoint to be represented by a circle of a different size.

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
        >>>
        >>> st.scatter_chart(chart_data)

        .. output::
           https://doc-scatter-chart.streamlit.app/
           height: 440px

        You can also choose different columns to use for x and y, as well as set
        the color dynamically based on a 3rd column (assuming your dataframe is in
        long format):

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["col1", "col2", "col3"])
        >>> chart_data['col4'] = np.random.choice(['A','B','C'], 20)
        >>>
        >>> st.scatter_chart(
        ...     chart_data,
        ...     x='col1',
        ...     y='col2',
        ...     color='col4',
        ...     size='col3',
        ... )

        .. output::
           https://doc-scatter-chart1.streamlit.app/
           height: 440px

        Finally, if your dataframe is in wide format, you can group multiple
        columns under the y argument to show multiple series with different
        colors:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 4), columns=["col1", "col2", "col3", "col4"])
        >>>
        >>> st.scatter_chart(
        ...     chart_data,
        ...     x='col1',
        ...     y=['col2', 'col3'],
        ...     size='col4',
        ...     color=['#FF0000', '#0000FF'],  # Optional
        ... )

        .. output::
           https://doc-scatter-chart2.streamlit.app/
           height: 440px

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

    @gather_metrics("altair_chart")
    def altair_chart(
        self,
        altair_chart: alt.Chart,
        use_container_width: bool = False,
        theme: Literal["streamlit"] | None = "streamlit",
    ) -> DeltaGenerator:
        """Display a chart using the Altair library.

        Parameters
        ----------
        altair_chart : altair.Chart
            The Altair chart object to display.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Altair's native ``width`` value.

        theme : "streamlit" or None
            The theme of the chart. Currently, we only support "streamlit" for the Streamlit
            defined design or None to fallback to the default behavior of the library.

        Example
        -------

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>> import altair as alt
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
        >>>
        >>> c = (
        ...    alt.Chart(chart_data)
        ...    .mark_circle()
        ...    .encode(x="a", y="b", size="c", color="c", tooltip=["a", "b", "c"])
        ... )
        >>>
        >>> st.altair_chart(c, use_container_width=True)

        .. output::
           https://doc-vega-lite-chart.streamlit.app/
           height: 300px

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


def _is_date_column(df: pd.DataFrame, name: str | None) -> bool:
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


def _melt_data(
    df: pd.DataFrame,
    columns_to_leave_alone: List[str],
    columns_to_melt: List[str] | None,
    new_y_column_name: str,
    new_color_column_name: str,
) -> pd.DataFrame:
    """Converts a wide-format dataframe to a long-format dataframe."""

    melted_df = pd.melt(
        df,
        id_vars=columns_to_leave_alone,
        value_vars=columns_to_melt,
        var_name=new_color_column_name,
        value_name=new_y_column_name,
    )

    y_series = melted_df[new_y_column_name]
    if (
        y_series.dtype == "object"
        and "mixed" in infer_dtype(y_series)
        and len(y_series.unique()) > 100
    ):
        raise StreamlitAPIException(
            "The columns used for rendering the chart contain too many values with mixed types. Please select the columns manually via the y parameter."
        )

    # Arrow has problems with object types after melting two different dtypes
    # pyarrow.lib.ArrowTypeError: "Expected a <TYPE> object, got a object"
    fixed_df = type_util.fix_arrow_incompatible_column_types(
        melted_df,
        selected_columns=[
            *columns_to_leave_alone,
            new_color_column_name,
            new_y_column_name,
        ],
    )

    return fixed_df


def prep_data(
    df: pd.DataFrame,
    x_column: str | None,
    y_column_list: List[str],
    color_column: str | None,
    size_column: str | None,
) -> Tuple[pd.DataFrame, str | None, str | None, str | None, str | None]:
    """Prepares the data for charting. This is also used in add_rows.

    Returns the prepared dataframe and the new names of the x column (taking the index reset into
    consideration) and y, color, and size columns.
    """

    # If y is provided, but x is not, we'll use the index as x.
    # So we need to pull the index into its own column.
    x_column = _maybe_reset_index_in_place(df, x_column, y_column_list)

    # Drop columns we're not using.
    selected_data = _drop_unused_columns(
        df, x_column, color_column, size_column, *y_column_list
    )

    # Maybe convert color to Vega colors.
    _maybe_convert_color_column_in_place(selected_data, color_column)

    # Make sure all columns have string names.
    (
        x_column,
        y_column_list,
        color_column,
        size_column,
    ) = _convert_col_names_to_str_in_place(
        selected_data, x_column, y_column_list, color_column, size_column
    )

    # Maybe melt data from wide format into long format.
    melted_data, y_column, color_column = _maybe_melt(
        selected_data, x_column, y_column_list, color_column, size_column
    )

    # Return the data, but also the new names to use for x, y, and color.
    return melted_data, x_column, y_column, color_column, size_column


def _generate_chart(
    chart_type: ChartType,
    data: Data | None,
    x_from_user: str | None = None,
    y_from_user: str | Sequence[str] | None = None,
    color_from_user: str | Color | List[Color] | None = None,
    size_from_user: str | float | None = None,
    width: int = 0,
    height: int = 0,
) -> Tuple[alt.Chart, AddRowsMetadata]:
    """Function to use the chart's type, data columns and indices to figure out the chart's spec."""
    import altair as alt

    df = type_util.convert_anything_to_df(data, ensure_copy=True)

    # From now on, use "df" instead of "data". Deleting "data" to guarantee we follow this.
    del data

    # Convert arguments received from the user to things Vega-Lite understands.
    # Get name of column to use for x.
    x_column = _parse_x_column(df, x_from_user)
    # Get name of columns to use for y.
    y_column_list = _parse_y_columns(df, y_from_user, x_column)
    # Get name of column to use for color, or constant value to use. Any/both could be None.
    color_column, color_value = _parse_generic_column(df, color_from_user)
    # Get name of column to use for size, or constant value to use. Any/both could be None.
    size_column, size_value = _parse_generic_column(df, size_from_user)

    # Store some info so we can use it in add_rows.
    add_rows_metadata = AddRowsMetadata(
        # The last index of df so we can adjust the input df in add_rows:
        last_index=last_index_for_melted_dataframes(df),
        # This is the input to prep_data (except for the df):
        columns=dict(
            x_column=x_column,
            y_column_list=y_column_list,
            color_column=color_column,
            size_column=size_column,
        ),
    )

    # At this point, all foo_column variables are either None/empty or contain actual
    # columns that are guaranteed to exist.

    df, x_column, y_column, color_column, size_column = prep_data(
        df, x_column, y_column_list, color_column, size_column
    )

    # At this point, x_column is only None if user did not provide one AND df is empty.

    # Create a Chart with x and y encodings.
    chart = alt.Chart(
        data=df,
        mark=chart_type.value["mark_type"],
        width=width,
        height=height,
    ).encode(
        x=_get_x_encoding(df, x_column, x_from_user, chart_type),
        y=_get_y_encoding(df, y_column, y_from_user),
    )

    # Set up opacity encoding.
    opacity_enc = _get_opacity_encoding(chart_type, color_column)
    if opacity_enc is not None:
        chart = chart.encode(opacity=opacity_enc)

    # Set up color encoding.
    color_enc = _get_color_encoding(
        df, color_value, color_column, y_column_list, color_from_user
    )
    if color_enc is not None:
        chart = chart.encode(color=color_enc)

    # Set up size encoding.
    size_enc = _get_size_encoding(chart_type, size_column, size_value)
    if size_enc is not None:
        chart = chart.encode(size=size_enc)

    # Set up tooltip encoding.
    if x_column is not None and y_column is not None:
        chart = chart.encode(
            tooltip=_get_tooltip_encoding(
                x_column,
                y_column,
                size_column,
                color_column,
                color_enc,
            )
        )

    return chart.interactive(), add_rows_metadata


def _maybe_reset_index_in_place(
    df: pd.DataFrame, x_column: str | None, y_column_list: List[str]
) -> str | None:
    if x_column is None and len(y_column_list) > 0:
        if df.index.name is None:
            # Pick column name that is unlikely to collide with user-given names.
            x_column = SEPARATED_INDEX_COLUMN_NAME
        else:
            # Reuse index's name for the new column.
            x_column = df.index.name

        df.index.name = x_column
        df.reset_index(inplace=True)

    return x_column


def _drop_unused_columns(df: pd.DataFrame, *column_names: str | None) -> pd.DataFrame:
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


def _maybe_convert_color_column_in_place(df: pd.DataFrame, color_column: str | None):
    """If needed, convert color column to a format Vega understands."""
    if color_column is None or len(df[color_column]) == 0:
        return

    first_color_datum = df[color_column][0]

    if is_hex_color_like(first_color_datum):
        # Hex is already CSS-valid.
        pass
    elif is_color_tuple_like(first_color_datum):
        # Tuples need to be converted to CSS-valid.
        df[color_column] = df[color_column].map(to_css_color)
    else:
        # Other kinds of colors columns (i.e. pure numbers or nominal strings) shouldn't
        # be converted since they are treated by Vega-Lite as sequential or categorical colors.
        pass


def _convert_col_names_to_str_in_place(
    df: pd.DataFrame,
    x_column: str | None,
    y_column_list: List[str],
    color_column: str | None,
    size_column: str | None,
) -> Tuple[str | None, List[str], str | None, str | None]:
    """Converts column names to strings, since Vega-Lite does not accept ints, etc."""
    column_names = list(df.columns)  # list() converts RangeIndex, etc, to regular list.
    str_column_names = [str(c) for c in column_names]
    df.columns = pd.Index(str_column_names)

    return (
        None if x_column is None else str(x_column),
        [str(c) for c in y_column_list],
        None if color_column is None else str(color_column),
        None if size_column is None else str(size_column),
    )


def _parse_generic_column(
    df: pd.DataFrame, column_or_value: Any
) -> Tuple[str | None, Any]:
    if isinstance(column_or_value, str) and column_or_value in df.columns:
        column_name = column_or_value
        value = None
    else:
        column_name = None
        value = column_or_value

    return column_name, value


def _parse_x_column(df: pd.DataFrame, x_from_user: str | None) -> str | None:
    if x_from_user is None:
        return None

    elif isinstance(x_from_user, str):
        if x_from_user not in df.columns:
            raise StreamlitColumnNotFoundError(df, x_from_user)

        return x_from_user

    else:
        raise StreamlitAPIException(
            "x parameter should be a column name (str) or None to use the "
            f" dataframe's index. Value given: {x_from_user} "
            f"(type {type(x_from_user)})"
        )


def _parse_y_columns(
    df: pd.DataFrame,
    y_from_user: str | Sequence[str] | None,
    x_column: str | None,
) -> List[str]:
    y_column_list: List[str] = []

    if y_from_user is None:
        y_column_list = list(df.columns)

    elif isinstance(y_from_user, str):
        y_column_list = [y_from_user]

    elif type_util.is_sequence(y_from_user):
        y_column_list = list(str(col) for col in y_from_user)

    else:
        raise StreamlitAPIException(
            "y parameter should be a column name (str) or list thereof. "
            f"Value given: {y_from_user} (type {type(y_from_user)})"
        )

    for col in y_column_list:
        if col not in df.columns:
            raise StreamlitColumnNotFoundError(df, col)

    # y_column_list should only include x_column when user explicitly asked for it.
    if x_column in y_column_list and (not y_from_user or x_column not in y_from_user):
        y_column_list.remove(x_column)

    return y_column_list


def _get_opacity_encoding(
    chart_type: ChartType, color_column: str | None
) -> alt.OpacityValue | None:
    import altair as alt

    if color_column and chart_type == ChartType.AREA:
        return alt.OpacityValue(0.7)

    return None


def _get_scale(df: pd.DataFrame, column_name: str | None) -> alt.Scale:
    import altair as alt

    # Set the X and Y axes' scale to "utc" if they contain date values.
    # This causes time data to be displayed in UTC, rather the user's local
    # time zone. (By default, vega-lite displays time data in the browser's
    # local time zone, regardless of which time zone the data specifies:
    # https://vega.github.io/vega-lite/docs/timeunit.html#output).
    if _is_date_column(df, column_name):
        return alt.Scale(type="utc")

    return alt.Scale()


def _get_axis_config(df: pd.DataFrame, column_name: str | None, grid: bool) -> alt.Axis:
    import altair as alt

    if column_name is not None and is_integer_dtype(df[column_name]):
        # Use a max tick size of 1 for integer columns (prevents zoom into float numbers)
        # and deactivate grid lines for x-axis
        return alt.Axis(tickMinStep=1, grid=grid)

    return alt.Axis(grid=grid)


def _maybe_melt(
    df: pd.DataFrame,
    x_column: str | None,
    y_column_list: List[str],
    color_column: str | None,
    size_column: str | None,
) -> Tuple[pd.DataFrame, str | None, str | None]:
    """If multiple columns are set for y, melt the dataframe into long format."""
    y_column: str | None

    if len(y_column_list) == 0:
        y_column = None
    elif len(y_column_list) == 1:
        y_column = y_column_list[0]
    elif x_column is not None:
        # Pick column names that are unlikely to collide with user-given names.
        y_column = MELTED_Y_COLUMN_NAME
        color_column = MELTED_COLOR_COLUMN_NAME

        columns_to_leave_alone = [x_column]
        if size_column:
            columns_to_leave_alone.append(size_column)

        df = _melt_data(
            df=df,
            columns_to_leave_alone=columns_to_leave_alone,
            columns_to_melt=y_column_list,
            new_y_column_name=y_column,
            new_color_column_name=color_column,
        )

    return df, y_column, color_column


def _get_x_encoding(
    df: pd.DataFrame,
    x_column: str | None,
    x_from_user: str | None,
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
        type=_get_x_encoding_type(df, chart_type, x_column),
        scale=_get_scale(df, x_column),
        axis=_get_axis_config(df, x_column, grid=False),
    )


def _get_y_encoding(
    df: pd.DataFrame,
    y_column: str | None,
    y_from_user: str | Sequence[str] | None,
) -> alt.Y:
    import altair as alt

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

    return alt.Y(
        field=y_field,
        title=y_title,
        type=_get_y_encoding_type(df, y_column),
        scale=_get_scale(df, y_column),
        axis=_get_axis_config(df, y_column, grid=True),
    )


def _get_color_encoding(
    df: pd.DataFrame,
    color_value: Color | None,
    color_column: str | None,
    y_column_list: List[str],
    color_from_user: str | Color | List[Color] | None,
) -> alt.Color | alt.ColorValue | None:
    import altair as alt

    has_color_value = color_value not in [None, [], tuple()]

    # If user passed a color value, that should win over colors coming from the
    # color column (be they manual or auto-assigned due to melting)
    if has_color_value:
        # If the color value is color-like, return that.
        if is_color_like(cast(Any, color_value)):
            if len(y_column_list) != 1:
                raise StreamlitColorLengthError([color_value], y_column_list)

            return alt.ColorValue(to_css_color(cast(Any, color_value)))

        # If the color value is a list of colors of approriate length, return that.
        elif isinstance(color_value, (list, tuple)):
            color_values = cast(Collection[Color], color_value)

            if len(color_values) != len(y_column_list):
                raise StreamlitColorLengthError(color_values, y_column_list)

            if len(color_value) == 1:
                return alt.ColorValue(to_css_color(cast(Any, color_value[0])))
            else:
                return alt.Color(
                    field=color_column,
                    scale=alt.Scale(range=[to_css_color(c) for c in color_values]),
                    legend=COLOR_LEGEND_SETTINGS,
                    type="nominal",
                    title=" ",
                )

        raise StreamlitInvalidColorError(df, color_from_user)

    elif color_column is not None:
        column_type: str | Tuple[str, List[Any]]

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


def _get_size_encoding(
    chart_type: ChartType,
    size_column: str | None,
    size_value: str | float | None,
) -> alt.Size | alt.SizeValue | None:
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
            f"Chart type {chart_type.name} does not support size argument. "
            "This should never happen!"
        )

    return None


def _get_tooltip_encoding(
    x_column: str,
    y_column: str,
    size_column: str | None,
    color_column: str | None,
    color_enc: alt.Color | alt.ColorValue | None,
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
    if color_column and getattr(color_enc, "legend", True) is not None:
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


def _get_x_encoding_type(
    df: pd.DataFrame, chart_type: ChartType, x_column: str | None
) -> type_util.VegaLiteType:
    if x_column is None:
        return "quantitative"  # Anything. If None, Vega-Lite may hide the axis.

    # Bar charts should have a discrete (ordinal) x-axis, UNLESS type is date/time
    # https://github.com/streamlit/streamlit/pull/2097#issuecomment-714802475
    if chart_type == ChartType.BAR and not _is_date_column(df, x_column):
        return "ordinal"

    return type_util.infer_vegalite_type(df[x_column])


def _get_y_encoding_type(
    df: pd.DataFrame, y_column: str | None
) -> type_util.VegaLiteType:
    if y_column:
        return type_util.infer_vegalite_type(df[y_column])

    return "quantitative"  # Pick anything. If undefined, Vega-Lite may hide the axis.


def marshall(
    vega_lite_chart: ArrowVegaLiteChartProto,
    altair_chart: alt.Chart,
    use_container_width: bool = False,
    theme: None | Literal["streamlit"] = "streamlit",
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
        name = str(id(data))
        datasets[name] = data
        return {"name": name}

    alt.data_transformers.register("id", id_transform)  # type: ignore[attr-defined,unused-ignore]

    # The default altair theme has some width/height defaults defined
    # which are not useful for Streamlit. Therefore, we change the theme to
    # "none" to avoid those defaults.
    with alt.themes.enable("none") if alt.themes.active == "default" else nullcontext():  # type: ignore[attr-defined,unused-ignore]
        with alt.data_transformers.enable("id"):  # type: ignore[attr-defined,unused-ignore]
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


class StreamlitColumnNotFoundError(StreamlitAPIException):
    def __init__(self, df, col_name, *args):
        available_columns = ", ".join(str(c) for c in list(df.columns))
        message = (
            f'Data does not have a column named `"{col_name}"`. '
            f"Available columns are `{available_columns}`"
        )
        super().__init__(message, *args)


class StreamlitInvalidColorError(StreamlitAPIException):
    def __init__(self, df, color_from_user, *args):
        ", ".join(str(c) for c in list(df.columns))
        message = f"""
This does not look like a valid color argument: `{color_from_user}`.

The color argument can be:

* A hex string like "#ffaa00" or "#ffaa0088".
* An RGB or RGBA tuple with the red, green, blue, and alpha
  components specified as ints from 0 to 255 or floats from 0.0 to
  1.0.
* The name of a column.
* Or a list of colors, matching the number of y columns to draw.
        """
        super().__init__(message, *args)


class StreamlitColorLengthError(StreamlitAPIException):
    def __init__(self, color_values, y_column_list, *args):
        message = (
            f"The list of colors `{color_values}` must have the same "
            "length as the list of columns to be colored "
            f"`{y_column_list}`."
        )
        super().__init__(message, *args)
