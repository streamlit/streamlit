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

"""Selects between our two DataFrame serialization methods ("legacy" and
"arrow") based on a config option.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, Iterable, Optional, Sequence, Union, cast

from typing_extensions import Literal

from streamlit import config
from streamlit.elements.lib.column_config_utils import ColumnConfigMappingInput
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from altair import Chart

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.arrow import Data


def _use_arrow() -> bool:
    """True if we're using Apache Arrow for DataFrame serialization."""
    # Explicitly coerce to bool here because mypy is (incorrectly) complaining
    # that we're trying to return 'Any'.
    return bool(config.get_option("global.dataFrameSerialization") == "arrow")


class DataFrameSelectorMixin:
    @gather_metrics("dataframe")
    def dataframe(
        self,
        data: "Data" = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        *,
        use_container_width: bool = False,
        hide_index: bool | None = None,
        column_order: Iterable[str] | None = None,
        column_config: ColumnConfigMappingInput | None = None,
    ) -> "DeltaGenerator":
        """Display a dataframe as an interactive table.

        This command works with dataframes from Pandas, PyArrow, Snowpark, and PySpark.
        It can also display several other types that can be converted to dataframes,
        e.g. numpy arrays, lists, sets and dictionaries.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Series, pandas.Styler, pandas.Index, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, dict, or None
            The data to display.

            If 'data' is a pandas.Styler, it will be used to style its
            underlying DataFrame. Streamlit supports custom cell
            values and colors. It does not support some of the more exotic
            pandas styling features, like bar charts, hovering, and captions.

        width : int or None
            Desired width of the dataframe expressed in pixels. If None, the width
            will be automatically calculated based on the column content.

        height : int or None
            Desired height of the dataframe expressed in pixels. If None, a
            default height is used.

        use_container_width : bool
            If True, set the dataframe width to the width of the parent container.
            This takes precedence over the width argument.
            This argument can only be supplied by keyword.

        hide_index : bool or None
            Whether to hide the index column(s). If None (default), the visibility of
            index columns is automatically determined based on the data.

        column_order : iterable of str or None
            Specifies the display order of columns. This also affects which columns are
            visible. For example, ``column_order=("col2", "col1")`` will display 'col2'
            first, followed by 'col1', and will hide all other non-index columns. If
            None (default), the order is inherited from the original data structure.

        column_config : dict or None
            Configures how columns are displayed, e.g. their title, visibility, type, or
            format. This needs to be a dictionary where each key is a column name and
            the value is one of:

            * ``None`` to hide the column.

            * A string to set the display label of the column.

            * One of the column types defined under ``st.column_config``, e.g.
              ``st.column_config.NumberColumn("Dollar values”, format=”$ %d")`` to show
              a column as dollar amounts. See more info on the available column types
              and config options `here <https://docs.streamlit.io/library/api-reference/data/st.column_config>`_.

            To configure the index column(s), use ``_index`` as the column name.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> st.dataframe(df)  # Same as st.write(df)

        .. output::
           https://doc-dataframe.streamlitapp.com/
           height: 410px

        You can also pass a Pandas Styler object to change the style of
        the rendered DataFrame:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(
        ...    np.random.randn(10, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> st.dataframe(df.style.highlight_max(axis=0))

        .. output::
           https://doc-dataframe1.streamlitapp.com/
           height: 410px

        Or you can customize the dataframe via ``column_config``, ``hide_index``, or ``column_order``:

        >>> import random
        >>> import pandas as pd
        >>> import streamlit as st
        >>>
        >>> df = pd.DataFrame(
        >>>     {
        >>>         "name": ["Roadmap", "Extras", "Issues"],
        >>>         "url": ["https://roadmap.streamlit.app", "https://extras.streamlit.app", "https://issues.streamlit.app"],
        >>>         "stars": [random.randint(0, 1000) for _ in range(3)],
        >>>         "views_history": [[random.randint(0, 5000) for _ in range(30)] for _ in range(3)],
        >>>     }
        >>> )
        >>> st.dataframe(
        >>>     df,
        >>>     column_config={
        >>>         "name": "App name",
        >>>         "stars": st.column_config.NumberColumn(
        >>>             "Github Stars",
        >>>             help="Number of stars on GitHub",
        >>>             format="%d ⭐",
        >>>         ),
        >>>         "url": st.column_config.LinkColumn("App URL"),
        >>>         "views_history": st.column_config.LineChartColumn(
        >>>             "Views (past 30 days)", y_min=0, y_max=5000
        >>>         ),
        >>>     },
        >>>     hide_index=True,
        >>> )

        .. output::
           https://doc-dataframe-config.streamlitapp.com/
           height: 350px

        """
        if _use_arrow():
            return self.dg._arrow_dataframe(
                data,
                width,
                height,
                use_container_width=use_container_width,
                hide_index=hide_index,
                column_order=column_order,
                column_config=column_config,
            )
        else:
            return self.dg._legacy_dataframe(data, width, height)

    @gather_metrics("table")
    def table(self, data: "Data" = None) -> "DeltaGenerator":
        """Display a static table.

        This differs from `st.dataframe` in that the table in this case is
        static: its entire contents are laid out directly on the page.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, dict, or None
            The table data.
            Pyarrow tables are not supported by Streamlit's legacy DataFrame serialization
            (i.e. with ``config.dataFrameSerialization = "legacy"``).
            To use pyarrow tables, please enable pyarrow by changing the config setting,
            ``config.dataFrameSerialization = "arrow"``.

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(
        ...    np.random.randn(10, 5),
        ...    columns=('col %d' % i for i in range(5)))
        ...
        >>> st.table(df)

        .. output::
           https://doc-table.streamlitapp.com/
           height: 480px

        """
        if _use_arrow():
            return self.dg._arrow_table(data)
        else:
            return self.dg._legacy_table(data)

    @gather_metrics("line_chart")
    def line_chart(
        self,
        data: "Data" = None,
        *,
        x: Union[str, None] = None,
        y: Union[str, Sequence[str], None] = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> "DeltaGenerator":
        """Display a line chart.

        This is syntax-sugar around st.altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st.line_chart does not guess the data specification
        correctly, try specifying your desired chart using st.altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, dict or None
            Data to be plotted.
            Pyarrow tables are not supported by Streamlit's legacy DataFrame serialization
            (i.e. with ``config.dataFrameSerialization = "legacy"``).
            To use pyarrow tables, please enable pyarrow by changing the config setting,
            ``config.dataFrameSerialization = "arrow"``.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.
            This argument can only be supplied by keyword.

        y : str, sequence of str, or None
            Column name(s) to use for the y-axis. If a sequence of strings, draws several series
            on the same chart by melting your wide-format table into a long-format table behind
            the scenes. If None, draws the data of all remaining columns as data series.
            This argument can only be supplied by keyword.

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
        >>> st.line_chart(chart_data)

        .. output::
           https://doc-line-chart.streamlitapp.com/
           height: 400px

        """
        if _use_arrow():
            return self.dg._arrow_line_chart(
                data,
                x=x,
                y=y,
                width=width,
                height=height,
                use_container_width=use_container_width,
            )
        else:
            return self.dg._legacy_line_chart(
                data,
                width=width,
                height=height,
                use_container_width=use_container_width,
            )

    @gather_metrics("area_chart")
    def area_chart(
        self,
        data: "Data" = None,
        *,
        x: Union[str, None] = None,
        y: Union[str, Sequence[str], None] = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> "DeltaGenerator":
        """Display an area chart.

        This is just syntax-sugar around st.altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st.area_chart does not guess the data specification
        correctly, try specifying your desired chart using st.altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, or dict
            Data to be plotted.
            Pyarrow tables are not supported by Streamlit's legacy DataFrame serialization
            (i.e. with ``config.dataFrameSerialization = "legacy"``).
            To use pyarrow tables, please enable pyarrow by changing the config setting,
            ``config.dataFrameSerialization = "arrow"``.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.
            This argument can only be supplied by keyword.

        y : str, sequence of str, or None
            Column name(s) to use for the y-axis. If a sequence of strings, draws several series
            on the same chart by melting your wide-format table into a long-format table behind
            the scenes. If None, draws the data of all remaining columns as data series.
            This argument can only be supplied by keyword.

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
        >>> st.area_chart(chart_data)

        .. output::
           https://doc-area-chart.streamlitapp.com/
           height: 400px

        """
        if _use_arrow():
            return self.dg._arrow_area_chart(
                data,
                x=x,
                y=y,
                width=width,
                height=height,
                use_container_width=use_container_width,
            )
        else:
            return self.dg._legacy_area_chart(
                data,
                width=width,
                height=height,
                use_container_width=use_container_width,
            )

    @gather_metrics("bar_chart")
    def bar_chart(
        self,
        data: "Data" = None,
        *,
        x: Union[str, None] = None,
        y: Union[str, Sequence[str], None] = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> "DeltaGenerator":
        """Display a bar chart.

        This is just syntax-sugar around st.altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st.bar_chart does not guess the data specification
        correctly, try specifying your desired chart using st.altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, or dict
            Data to be plotted.
            Pyarrow tables are not supported by Streamlit's legacy DataFrame serialization
            (i.e. with ``config.dataFrameSerialization = "legacy"``).
            To use pyarrow tables, please enable pyarrow by changing the config setting,
            ``config.dataFrameSerialization = "arrow"``.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.
            This argument can only be supplied by keyword.

        y : str, sequence of str, or None
            Column name(s) to use for the y-axis. If a sequence of strings, draws several series
            on the same chart by melting your wide-format table into a long-format table behind
            the scenes. If None, draws the data of all remaining columns as data series.
            This argument can only be supplied by keyword.

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
        ...     columns=["a", "b", "c"])
        ...
        >>> st.bar_chart(chart_data)

        .. output::
           https://doc-bar-chart.streamlitapp.com/
           height: 400px

        """

        if _use_arrow():
            return self.dg._arrow_bar_chart(
                data,
                x=x,
                y=y,
                width=width,
                height=height,
                use_container_width=use_container_width,
            )
        else:
            return self.dg._legacy_bar_chart(
                data,
                width=width,
                height=height,
                use_container_width=use_container_width,
            )

    @gather_metrics("altair_chart")
    def altair_chart(
        self,
        altair_chart: "Chart",
        use_container_width: bool = False,
        theme: Union[None, Literal["streamlit"]] = "streamlit",
    ) -> "DeltaGenerator":
        """Display a chart using the Altair library.

        Parameters
        ----------
        altair_chart : altair.Chart
            The Altair chart object to display.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Altair's native `width` value.

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
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> c = alt.Chart(chart_data).mark_circle().encode(
        ...     x='a', y='b', size='c', color='c', tooltip=['a', 'b', 'c'])
        >>>
        >>> st.altair_chart(c, use_container_width=True)

        Examples of Altair charts can be found at
        https://altair-viz.github.io/gallery/.

        .. output::
           https://doc-vega-lite-chart.streamlitapp.com/
           height: 300px

        """

        if _use_arrow():
            return self.dg._arrow_altair_chart(altair_chart, use_container_width, theme)
        else:
            return self.dg._legacy_altair_chart(altair_chart, use_container_width)

    @gather_metrics("vega_lite_chart")
    def vega_lite_chart(
        self,
        data: "Data" = None,
        spec: Optional[Dict[str, Any]] = None,
        use_container_width: bool = False,
        theme: Union[None, Literal["streamlit"]] = "streamlit",
        **kwargs: Any,
    ) -> "DeltaGenerator":
        """Display a chart using the Vega-Lite library.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, dict, or None
            Either the data to be plotted or a Vega-Lite spec containing the
            data (which more closely follows the Vega-Lite API).
            Pyarrow tables are not supported by Streamlit's legacy DataFrame serialization
            (i.e. with ``config.dataFrameSerialization = "legacy"``).
            To use pyarrow tables, please enable pyarrow by changing the config setting,
            ``config.dataFrameSerialization = "arrow"``.

        spec : dict or None
            The Vega-Lite spec for the chart. If the spec was already passed in
            the previous argument, this must be set to None. See
            https://vega.github.io/vega-lite/docs/ for more info.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Vega-Lite's native `width` value.

        theme : "streamlit" or None
            The theme of the chart. Currently, we only support "streamlit" for the Streamlit
            defined design or None to fallback to the default behavior of the library.

        **kwargs : any
            Same as spec, but as keywords.

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(200, 3),
        ...     columns=['a', 'b', 'c'])
        >>>
        >>> st.vega_lite_chart(chart_data, {
        ...     'mark': {'type': 'circle', 'tooltip': True},
        ...     'encoding': {
        ...         'x': {'field': 'a', 'type': 'quantitative'},
        ...         'y': {'field': 'b', 'type': 'quantitative'},
        ...         'size': {'field': 'c', 'type': 'quantitative'},
        ...         'color': {'field': 'c', 'type': 'quantitative'},
        ...     },
        ... })

        .. output::
           https://doc-vega-lite-chart.streamlitapp.com/
           height: 300px

        Examples of Vega-Lite usage without Streamlit can be found at
        https://vega.github.io/vega-lite/examples/. Most of those can be easily
        translated to the syntax shown above.

        """
        if _use_arrow():
            return self.dg._arrow_vega_lite_chart(
                data, spec, use_container_width, theme, **kwargs
            )
        else:
            return self.dg._legacy_vega_lite_chart(
                data, spec, use_container_width, **kwargs
            )

    @gather_metrics("add_rows")
    def add_rows(self, data: "Data" = None, **kwargs) -> Optional["DeltaGenerator"]:
        """Concatenate a dataframe to the bottom of the current one.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, Iterable, dict, or None
            Table to concat. Optional.
            Pyarrow tables are not supported by Streamlit's legacy DataFrame serialization
            (i.e. with ``config.dataFrameSerialization = "legacy"``).
            To use pyarrow tables, please enable pyarrow by changing the config setting,
            ``config.dataFrameSerialization = "arrow"``.

        **kwargs : pandas.DataFrame, numpy.ndarray, Iterable, dict, or None
            The named dataset to concat. Optional. You can only pass in 1
            dataset (including the one in the data parameter).

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df1 = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> my_table = st.table(df1)
        >>>
        >>> df2 = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> my_table.add_rows(df2)
        >>> # Now the table shown in the Streamlit app contains the data for
        >>> # df1 followed by the data for df2.

        You can do the same thing with plots. For example, if you want to add
        more data to a line chart:

        >>> # Assuming df1 and df2 from the example above still exist...
        >>> my_chart = st.line_chart(df1)
        >>> my_chart.add_rows(df2)
        >>> # Now the chart shown in the Streamlit app contains the data for
        >>> # df1 followed by the data for df2.

        And for plots whose datasets are named, you can pass the data with a
        keyword argument where the key is the name:

        >>> my_chart = st.vega_lite_chart({
        ...     'mark': 'line',
        ...     'encoding': {'x': 'a', 'y': 'b'},
        ...     'datasets': {
        ...       'some_fancy_name': df1,  # <-- named dataset
        ...      },
        ...     'data': {'name': 'some_fancy_name'},
        ... }),
        >>> my_chart.add_rows(some_fancy_name=df2)  # <-- name used as keyword

        """
        if _use_arrow():
            return self.dg._arrow_add_rows(data, **kwargs)
        else:
            return self.dg._legacy_add_rows(data, **kwargs)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
