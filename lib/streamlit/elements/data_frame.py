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

"""Selects between our two DataFrame serialization methods ("legacy" and
"arrow") based on a config option"""

from typing import cast

import streamlit


def _use_arrow() -> bool:
    """True if we're using Apache Arrow for DataFrame serialization."""
    return streamlit.get_option("global.dataFrameSerialization") == "arrow"


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
        if _use_arrow():
            raise RuntimeError("TODO!")
        else:
            return self.dg.legacy_data_frame(data, width, height)

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
        if _use_arrow():
            return self.dg.beta_table(data)
        else:
            return self.dg.legacy_table(data)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
