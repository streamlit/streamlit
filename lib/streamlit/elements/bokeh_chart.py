# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""A Python wrapper around Bokeh."""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from streamlit.deprecation_util import (
    show_deprecation_warning,
)
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class BokehMixin:
    @gather_metrics("bokeh_chart")
    def bokeh_chart(
        self,
        figure: object,  # noqa: ARG002
        use_container_width: bool = True,  # noqa: ARG002
    ) -> DeltaGenerator:
        """Display an interactive Bokeh chart.

        Bokeh is a charting library for Python. You can find
        more about Bokeh at https://bokeh.pydata.org.

        .. Important::
            This command has been deprecated and removed. Please use our custom
            component, |streamlit-bokeh|_, instead. Calling st.bokeh_chart will
            do nothing.

        .. |streamlit-bokeh| replace:: ``streamlit-bokeh``
        .. _streamlit-bokeh: https://github.com/streamlit/streamlit-bokeh

        Parameters
        ----------
        figure : bokeh.plotting.figure.Figure
            A Bokeh figure to plot.

        use_container_width : bool
            Whether to override the figure's native width with the width of
            the parent container. If ``use_container_width`` is ``True`` (default),
            Streamlit sets the width of the figure to match the width of the parent
            container. If ``use_container_width`` is ``False``, Streamlit sets the
            width of the chart to fit its contents according to the plotting library,
            up to the width of the parent container.
        """

        show_deprecation_warning(
            "st.bokeh_chart has been deprecated and removed. "
            "Please use our custom component, "
            "[streamlit-bokeh](https://github.com/streamlit/streamlit-bokeh), "
            "instead. Calling st.bokeh_chart will do nothing."
        )
        return self.dg

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
