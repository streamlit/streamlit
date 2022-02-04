# Copyright 2018-2022 Streamlit Inc.
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

"""Selects between our two DataFrame serialization methods ("legacy" and
"arrow") based on a config option"""

from typing import cast

import streamlit
from streamlit import config


def _use_arrow() -> bool:
    """True if we're using Apache Arrow for DataFrame serialization."""
    # Explicitly coerce to bool here because mypy is (incorrectly) complaining
    # that we're trying to return 'Any'.
    return bool(config.get_option("global.dataFrameSerialization") == "arrow")


class DataFrameSelectorMixin:
    def dataframe(self, data=None, width=None, height=None):
        """Display a dataframe as an interactive table.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, dict, or None
            The data to display.

            If 'data' is a pandas.Styler, it will be used to style its
            underyling DataFrame. Streamlit supports custom cell
            values and colors. (It does not support some of the more exotic
            pandas styling features, like bar charts, hovering, and captions.)
            Styler support is experimental!
            Pyarrow tables are not supported by Streamlit's legacy DataFrame serialization
            (i.e. with `config.dataFrameSerialization = "legacy"`).
            To use pyarrow tables, please enable pyarrow by changing the config setting,
            `config.dataFrameSerialization = "arrow"`.
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
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/data.dataframe.py
           height: 410px

        >>> st.dataframe(df, 200, 100)

        You can also pass a Pandas Styler object to change the style of
        the rendered DataFrame:

        >>> df = pd.DataFrame(
        ...    np.random.randn(10, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> st.dataframe(df.style.highlight_max(axis=0))

        .. output::
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/data.dataframe1.py
           height: 410px

        """
        if _use_arrow():
            return self.dg._arrow_dataframe(data, width, height)
        else:
            return self.dg._legacy_dataframe(data, width, height)

    def table(self, data=None):
        """Display a static table.

        This differs from `st.dataframe` in that the table in this case is
        static: its entire contents are laid out directly on the page.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, dict, or None
            The table data.
            Pyarrow tables are not supported by Streamlit's legacy DataFrame serialization
            (i.e. with `config.dataFrameSerialization = "legacy"`).
            To use pyarrow tables, please enable pyarrow by changing the config setting,
            `config.dataFrameSerialization = "arrow"`.

        Example
        -------
        >>> df = pd.DataFrame(
        ...    np.random.randn(10, 5),
        ...    columns=('col %d' % i for i in range(5)))
        ...
        >>> st.table(df)

        .. output::
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/data.table.py
           height: 480px

        """
        if _use_arrow():
            return self.dg._arrow_table(data)
        else:
            return self.dg._legacy_table(data)

    def line_chart(self, data=None, width=0, height=0, use_container_width=True):
        """Display a line chart.

        This is syntax-sugar around st.altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st.line_chart does not guess the data specification
        correctly, try specifying your desired chart using st.altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, dict or None
            Data to be plotted.
            Pyarrow tables are not supported by Streamlit's legacy DataFrame serialization
            (i.e. with `config.dataFrameSerialization = "legacy"`).
            To use pyarrow tables, please enable pyarrow by changing the config setting,
            `config.dataFrameSerialization = "arrow"`.

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> st.line_chart(chart_data)

        .. output::
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/charts.line_chart.py
           height: 400px

        """
        if _use_arrow():
            return self.dg._arrow_line_chart(data, width, height, use_container_width)
        else:
            return self.dg._legacy_line_chart(data, width, height, use_container_width)

    def area_chart(self, data=None, width=0, height=0, use_container_width=True):
        """Display an area chart.

        This is just syntax-sugar around st.altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st.area_chart does not guess the data specification
        correctly, try specifying your desired chart using st.altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, or dict
            Data to be plotted.
            Pyarrow tables are not supported by Streamlit's legacy DataFrame serialization
            (i.e. with `config.dataFrameSerialization = "legacy"`).
            To use pyarrow tables, please enable pyarrow by changing the config setting,
            `config.dataFrameSerialization = "arrow"`.

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> st.area_chart(chart_data)

        .. output::
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/charts.area_chart.py
           height: 400px

        """
        if _use_arrow():
            return self.dg._arrow_area_chart(data, width, height, use_container_width)
        else:
            return self.dg._legacy_area_chart(data, width, height, use_container_width)

    def bar_chart(self, data=None, width=0, height=0, use_container_width=True):
        """Display a bar chart.

        This is just syntax-sugar around st.altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st.bar_chart does not guess the data specification
        correctly, try specifying your desired chart using st.altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, or dict
            Data to be plotted.
            Pyarrow tables are not supported by Streamlit's legacy DataFrame serialization
            (i.e. with `config.dataFrameSerialization = "legacy"`).
            To use pyarrow tables, please enable pyarrow by changing the config setting,
            `config.dataFrameSerialization = "arrow"`.

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(50, 3),
        ...     columns=["a", "b", "c"])
        ...
        >>> st.bar_chart(chart_data)

        .. output::
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/charts.bar_chart.py
           height: 400px

        """

        if _use_arrow():
            return self.dg._arrow_bar_chart(data, width, height, use_container_width)
        else:
            return self.dg._legacy_bar_chart(data, width, height, use_container_width)

    def altair_chart(self, altair_chart, use_container_width=False):
        """Display a chart using the Altair library.

        Parameters
        ----------
        altair_chart : altair.vegalite.v2.api.Chart
            The Altair chart object to display.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Altair's native `width` value.

        Example
        -------

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
        >>> st.altair_chart(c, use_container_width=True)

        Examples of Altair charts can be found at
        https://altair-viz.github.io/gallery/.

        .. output::
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/charts.vega_lite_chart.py
           height: 300px

        """

        if _use_arrow():
            return self.dg._arrow_altair_chart(altair_chart, use_container_width)
        else:
            return self.dg._legacy_altair_chart(altair_chart, use_container_width)

    def vega_lite_chart(
        self,
        data=None,
        spec=None,
        use_container_width=False,
        **kwargs,
    ):
        """Display a chart using the Vega-Lite library.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, dict, or None
            Either the data to be plotted or a Vega-Lite spec containing the
            data (which more closely follows the Vega-Lite API).
            Pyarrow tables are not supported by Streamlit's legacy DataFrame serialization
            (i.e. with `config.dataFrameSerialization = "legacy"`).
            To use pyarrow tables, please enable pyarrow by changing the config setting,
            `config.dataFrameSerialization = "arrow"`.

        spec : dict or None
            The Vega-Lite spec for the chart. If the spec was already passed in
            the previous argument, this must be set to None. See
            https://vega.github.io/vega-lite/docs/ for more info.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Vega-Lite's native `width` value.

        **kwargs : any
            Same as spec, but as keywords.

        Example
        -------

        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(
        ...     np.random.randn(200, 3),
        ...     columns=['a', 'b', 'c'])
        >>>
        >>> st.vega_lite_chart(df, {
        ...     'mark': {'type': 'circle', 'tooltip': True},
        ...     'encoding': {
        ...         'x': {'field': 'a', 'type': 'quantitative'},
        ...         'y': {'field': 'b', 'type': 'quantitative'},
        ...         'size': {'field': 'c', 'type': 'quantitative'},
        ...         'color': {'field': 'c', 'type': 'quantitative'},
        ...     },
        ... })

        .. output::
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/charts.vega_lite_chart.py
           height: 300px

        Examples of Vega-Lite usage without Streamlit can be found at
        https://vega.github.io/vega-lite/examples/. Most of those can be easily
        translated to the syntax shown above.

        """
        if _use_arrow():
            return self.dg._arrow_vega_lite_chart(
                data, spec, use_container_width, **kwargs
            )
        else:
            return self.dg._legacy_vega_lite_chart(
                data, spec, use_container_width, **kwargs
            )

    def add_rows(self, data=None, **kwargs):
        """Concatenate a dataframe to the bottom of the current one.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, dict, or None
            Table to concat. Optional.
            Pyarrow tables are not supported by Streamlit's legacy DataFrame serialization
            (i.e. with `config.dataFrameSerialization = "legacy"`).
            To use pyarrow tables, please enable pyarrow by changing the config setting,
            `config.dataFrameSerialization = "arrow"`.

        **kwargs : pandas.DataFrame, numpy.ndarray, Iterable, dict, or None
            The named dataset to concat. Optional. You can only pass in 1
            dataset (including the one in the data parameter).

        Example
        -------
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
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
