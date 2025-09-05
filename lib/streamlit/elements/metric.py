# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from __future__ import annotations

from dataclasses import dataclass
from textwrap import dedent
from typing import TYPE_CHECKING, Any, Literal, Union, cast

from typing_extensions import TypeAlias

from streamlit.dataframe_util import OptionSequence, convert_anything_to_list
from streamlit.elements.lib.layout_utils import (
    Height,
    LayoutConfig,
    Width,
    validate_height,
    validate_width,
)
from streamlit.elements.lib.policies import maybe_raise_label_warnings
from streamlit.elements.lib.utils import (
    LabelVisibility,
    get_label_visibility_proto_value,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Metric_pb2 import Metric as MetricProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text

if TYPE_CHECKING:
    import numpy as np

    from streamlit.delta_generator import DeltaGenerator


Value: TypeAlias = Union["np.integer[Any]", "np.floating[Any]", float, int, str, None]
Delta: TypeAlias = Union[float, int, str, None]
DeltaColor: TypeAlias = Literal["normal", "inverse", "off"]


@dataclass(frozen=True)
class MetricColorAndDirection:
    color: MetricProto.MetricColor.ValueType
    direction: MetricProto.MetricDirection.ValueType


class MetricMixin:
    @gather_metrics("metric")
    def metric(
        self,
        label: str,
        value: Value,
        delta: Delta = None,
        delta_color: DeltaColor = "normal",
        *,
        help: str | None = None,
        label_visibility: LabelVisibility = "visible",
        border: bool = False,
        width: Width = "stretch",
        height: Height = "content",
        chart_data: OptionSequence[Any] | None = None,
        chart_type: Literal["line", "bar", "area"] = "line",
    ) -> DeltaGenerator:
        r"""Display a metric in big bold font, with an optional indicator of how the metric changed.

        Tip: If you want to display a large number, it may be a good idea to
        shorten it using packages like `millify <https://github.com/azaitsev/millify>`_
        or `numerize <https://github.com/davidsa03/numerize>`_. E.g. ``1234`` can be
        displayed as ``1.2k`` using ``st.metric("Short number", millify(1234))``.

        Parameters
        ----------
        label : str
            The header or title for the metric. The label can optionally
            contain GitHub-flavored Markdown of the following types: Bold, Italics,
            Strikethroughs, Inline Code, Links, and Images. Images display like
            icons, with a max height equal to the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        value : int, float, str, or None
             Value of the metric. None is rendered as a long dash.

        delta : int, float, str, or None
            Indicator of how the metric changed, rendered with an arrow below
            the metric. If delta is negative (int/float) or starts with a minus
            sign (str), the arrow points down and the text is red; else the
            arrow points up and the text is green. If None (default), no delta
            indicator is shown.

        delta_color : "normal", "inverse", or "off"
             If "normal" (default), the delta indicator is shown as described
             above. If "inverse", it is red when positive and green when
             negative. This is useful when a negative change is considered
             good, e.g. if cost decreased. If "off", delta is  shown in gray
             regardless of its value.

        help : str or None
            A tooltip that gets displayed next to the metric label. Streamlit
            only displays the tooltip when ``label_visibility="visible"``. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        border : bool
            Whether to show a border around the metric container. If this is
            ``False`` (default), no border is shown. If this is ``True``, a
            border is shown.

        height : "content", "stretch", or int
            The height of the metric element. This can be one of the following:

            - ``"content"`` (default): The height of the element matches the
              height of its content.
            - ``"stretch"``: The height of the element matches the height of
              its content or the height of the parent container, whichever is
              larger. If the element is not in a parent container, the height
              of the element matches the height of its content.
            - An integer specifying the height in pixels: The element has a
              fixed height. If the content is larger than the specified
              height, scrolling is enabled.

        width : "stretch", "content", or int
            The width of the metric element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - ``"content"``: The width of the element matches the width of its
              content, but doesn't exceed the width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        chart_data : Iterable or None
            A sequence of numeric values to display as a sparkline chart. If
            this is ``None`` (default), no chart is displayed. The sequence can
            be anything supported by ``st.dataframe``, including a ``list`` or
            ``set``. If the sequence is dataframe-like, the first column will
            be used. Each value will be cast to ``float`` internally by
            default.

        chart_type : "line", "bar", or "area"
            The type of sparkline chart to display. This can be one of the
            following:

            - ``"line"`` (default): A simple sparkline.
            - ``"area"``: A sparkline with area shading.
            - ``"bar"``: A bar chart.

        Examples
        --------
        **Example 1: Show a metric**

        >>> import streamlit as st
        >>>
        >>> st.metric(label="Temperature", value="70 °F", delta="1.2 °F")

        .. output::
            https://doc-metric-example1.streamlit.app/
            height: 210px

        **Example 2: Create a row of metrics**

        ``st.metric`` looks especially nice in combination with ``st.columns``.

        >>> import streamlit as st
        >>>
        >>> col1, col2, col3 = st.columns(3)
        >>> col1.metric("Temperature", "70 °F", "1.2 °F")
        >>> col2.metric("Wind", "9 mph", "-8%")
        >>> col3.metric("Humidity", "86%", "4%")

        .. output::
            https://doc-metric-example2.streamlit.app/
            height: 210px

        **Example 3: Modify the delta indicator**

        The delta indicator color can also be inverted or turned off.

        >>> import streamlit as st
        >>>
        >>> st.metric(label="Gas price", value=4, delta=-0.5, delta_color="inverse")
        >>>
        >>> st.metric(
        ...     label="Active developers",
        ...     value=123,
        ...     delta=123,
        ...     delta_color="off",
        ... )

        .. output::
            https://doc-metric-example3.streamlit.app/
            height: 320px

        **Example 4: Create a grid of metric cards**

        Add borders to your metrics to create a dashboard look.

        >>> import streamlit as st
        >>>
        >>> a, b = st.columns(2)
        >>> c, d = st.columns(2)
        >>>
        >>> a.metric("Temperature", "30°F", "-9°F", border=True)
        >>> b.metric("Wind", "4 mph", "2 mph", border=True)
        >>>
        >>> c.metric("Humidity", "77%", "5%", border=True)
        >>> d.metric("Pressure", "30.34 inHg", "-2 inHg", border=True)

        .. output::
            https://doc-metric-example4.streamlit.app/
            height: 350px

        **Example 5: Show sparklines**

        To show trends over time, add sparklines.

        >>> import streamlit as st
        >>> from numpy.random import default_rng as rng
        >>>
        >>> changes = list(rng(4).standard_normal(20))
        >>> data = [sum(changes[:i]) for i in range(20)]
        >>> delta = round(data[-1], 2)
        >>>
        >>> row = st.container(horizontal=True)
        >>> with row:
        >>>     st.metric(
        ...         "Line", 10, delta, chart_data=data, chart_type="line", border=True
        ...     )
        >>>     st.metric(
        ...         "Area", 10, delta, chart_data=data, chart_type="area", border=True
        ...     )
        >>>     st.metric(
        ...         "Bar", 10, delta, chart_data=data, chart_type="bar", border=True
        ...     )

        .. output::
            https://doc-metric-example5.streamlit.app/
            height: 300px

        """
        maybe_raise_label_warnings(label, label_visibility)

        metric_proto = MetricProto()
        metric_proto.body = _parse_value(value)
        metric_proto.label = _parse_label(label)
        metric_proto.delta = _parse_delta(delta)
        metric_proto.show_border = border
        if help is not None:
            metric_proto.help = dedent(help)

        color_and_direction = _determine_delta_color_and_direction(
            cast("DeltaColor", clean_text(delta_color)), delta
        )
        metric_proto.color = color_and_direction.color
        metric_proto.direction = color_and_direction.direction
        metric_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if chart_data is not None:
            prepared_data: list[float] = []
            for val in convert_anything_to_list(chart_data):
                try:
                    prepared_data.append(float(val))
                except Exception as ex:  # noqa: PERF203
                    raise StreamlitAPIException(
                        "Only numeric values are supported for chart data sequence. The "
                        f"value '{val}' is of type {type(val)} and "
                        "cannot be converted to float."
                    ) from ex
            if len(prepared_data) > 0:
                metric_proto.chart_data.extend(prepared_data)

        metric_proto.chart_type = _parse_chart_type(chart_type)

        validate_height(height, allow_content=True)
        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width, height=height)

        return self.dg._enqueue("metric", metric_proto, layout_config=layout_config)

    @property
    def dg(self) -> DeltaGenerator:
        return cast("DeltaGenerator", self)


def _parse_chart_type(
    chart_type: Literal["line", "bar", "area"],
) -> MetricProto.ChartType.ValueType:
    if chart_type == "bar":
        return MetricProto.ChartType.BAR
    if chart_type == "area":
        return MetricProto.ChartType.AREA
    # Use line as default chart:
    return MetricProto.ChartType.LINE


def _parse_label(label: str) -> str:
    if not isinstance(label, str):
        raise TypeError(
            f"'{label}' is of type {type(label)}, which is not an accepted type."
            " label only accepts: str. Please convert the label to an accepted type."
        )
    return label


def _parse_value(value: Value) -> str:
    if value is None:
        return "—"
    if isinstance(value, (int, float, str)):
        return str(value)
    if hasattr(value, "item"):
        # Add support for numpy values (e.g. int16, float64, etc.)
        try:
            # Item could also be just a variable, so we use try, except
            if isinstance(value.item(), (float, int)):
                return str(value.item())
        except Exception:  # noqa: S110
            # If the numpy item is not a valid value, the TypeError below will be raised.
            pass

    raise TypeError(
        f"'{value}' is of type {type(value)}, which is not an accepted type."
        " value only accepts: int, float, str, or None."
        " Please convert the value to an accepted type."
    )


def _parse_delta(delta: Delta) -> str:
    if delta is None or delta == "":
        return ""
    if isinstance(delta, str):
        return dedent(delta)
    if isinstance(delta, (int, float)):
        return str(delta)
    raise TypeError(
        f"'{delta}' is of type {type(delta)}, which is not an accepted type."
        " delta only accepts: int, float, str, or None."
        " Please convert the value to an accepted type."
    )


def _determine_delta_color_and_direction(
    delta_color: DeltaColor,
    delta: Delta,
) -> MetricColorAndDirection:
    if delta_color not in {"normal", "inverse", "off"}:
        raise StreamlitAPIException(
            f"'{delta_color}' is not an accepted value. delta_color only accepts: "
            "'normal', 'inverse', or 'off'"
        )

    if delta is None or delta == "":
        return MetricColorAndDirection(
            color=MetricProto.MetricColor.GRAY,
            direction=MetricProto.MetricDirection.NONE,
        )

    if _is_negative_delta(delta):
        if delta_color == "normal":
            cd_color = MetricProto.MetricColor.RED
        elif delta_color == "inverse":
            cd_color = MetricProto.MetricColor.GREEN
        else:
            cd_color = MetricProto.MetricColor.GRAY
        cd_direction = MetricProto.MetricDirection.DOWN
    else:
        if delta_color == "normal":
            cd_color = MetricProto.MetricColor.GREEN
        elif delta_color == "inverse":
            cd_color = MetricProto.MetricColor.RED
        else:
            cd_color = MetricProto.MetricColor.GRAY
        cd_direction = MetricProto.MetricDirection.UP

    return MetricColorAndDirection(
        color=cd_color,
        direction=cd_direction,
    )


def _is_negative_delta(delta: Delta) -> bool:
    return dedent(str(delta)).startswith("-")
