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

from textwrap import dedent
from typing import cast, Optional

import attr

import streamlit
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Metric_pb2 import Metric as MetricProto
from .utils import clean_text


@attr.s(auto_attribs=True, slots=True)
class MetricColorAndDirection:
    color: Optional[int]
    direction: Optional[int]


class MetricMixin:
    def metric(self, label, value, delta=None, delta_color="normal"):
        """Display a metric in big bold font, with an optional indicator of how the metric changed.

        Tip: If you want to display a large number, it may be a good idea to
        shorten it using packages like `millify <https://github.com/azaitsev/millify>`_
        or `numerize <https://github.com/davidsa03/numerize>`_. E.g. ``1234`` can be
        displayed as ``1.2k`` using ``st.metric("Short number", millify(1234))``.

        Parameters
        ----------
        label : str
            The header or Title for the metric
        value : int, float, str, or None
             Value of the metric. None is rendered as a long dash.
        delta : int, float, str, or None
            Indicator of how the metric changed, rendered with an arrow below
            the metric. If delta is negative (int/float) or starts with a minus
            sign (str), the arrow points down and the text is red; else the
            arrow points up and the text is green. If None (default), no delta
            indicator is shown.
        delta_color : str
             If "normal" (default), the delta indicator is shown as described
             above. If "inverse", it is red when positive and green when
             negative. This is useful when a negative change is considered
             good, e.g. if cost decreased. If "off", delta is  shown in gray
             regardless of its value.

        Example
        -------
        >>> st.metric(label="Temperature", value="70 °F", delta="1.2 °F")

        .. output::
            https://static.streamlit.io/0.86.0-mT2t/index.html?id=1TxwRhgBgFg62p2AXqJdM
            height: 175px

        ``st.metric`` looks especially nice in combination with ``st.columns``:

        >>> col1, col2, col3 = st.columns(3)
        >>> col1.metric("Temperature", "70 °F", "1.2 °F")
        >>> col2.metric("Wind", "9 mph", "-8%")
        >>> col3.metric("Humidity", "86%", "4%")

        .. output::
            https://static.streamlit.io/0.86.0-mT2t/index.html?id=4K9bKXhiPAxBNhktd8cxbg
            height: 175px

        The delta indicator color can also be inverted or turned off:

        >>> st.metric(label="Gas price", value=4, delta=-0.5,
        ...     delta_color="inverse")
        >>>
        >>> st.metric(label="Active developers", value=123, delta=123,
        ...     delta_color="off")

        .. output::
            https://static.streamlit.io/0.86.0-mT2t/index.html?id=UTtQvbBQFaPtCmPcQ23wpP
            height: 275px

        """
        metric_proto = MetricProto()
        metric_proto.body = self.parse_value(value)
        metric_proto.label = self.parse_label(label)
        metric_proto.delta = self.parse_delta(delta)

        color_and_direction = self.determine_delta_color_and_direction(
            clean_text(delta_color), delta
        )
        metric_proto.color = color_and_direction.color
        metric_proto.direction = color_and_direction.direction

        return str(self.dg._enqueue("metric", metric_proto))

    def parse_label(self, label):
        if not isinstance(label, str):
            raise TypeError(
                f"'{str(label)}' is not an accepted type. label only accepts: str"
            )
        return label

    def parse_value(self, value):
        if value is None:
            return "—"
        if isinstance(value, float) or isinstance(value, int) or isinstance(value, str):
            return str(value)
        else:
            raise TypeError(
                f"'{str(value)}' is not an accepted type. value only accepts: "
                "int, float, str, or None"
            )

    def parse_delta(self, delta):
        if delta is None or delta == "":
            return ""
        if isinstance(delta, str):
            return dedent(delta)
        elif isinstance(delta, int) or isinstance(delta, float):
            return str(delta)
        else:
            raise TypeError(
                f"'{str(delta)}' is not an accepted type. delta only accepts:"
                " int, float, str, or None"
            )

    def determine_delta_color_and_direction(self, delta_color, delta):
        cd = MetricColorAndDirection(color=None, direction=None)

        if delta is None or delta == "":
            cd.color = MetricProto.MetricColor.GRAY
            cd.direction = MetricProto.MetricDirection.NONE
            return cd

        if self.is_negative(delta):
            if delta_color == "normal":
                cd.color = MetricProto.MetricColor.RED
            elif delta_color == "inverse":
                cd.color = MetricProto.MetricColor.GREEN
            elif delta_color == "off":
                cd.color = MetricProto.MetricColor.GRAY
            cd.direction = MetricProto.MetricDirection.DOWN
        else:
            if delta_color == "normal":
                cd.color = MetricProto.MetricColor.GREEN
            elif delta_color == "inverse":
                cd.color = MetricProto.MetricColor.RED
            elif delta_color == "off":
                cd.color = MetricProto.MetricColor.GRAY
            cd.direction = MetricProto.MetricDirection.UP

        if cd.color is None or cd.direction is None:
            raise StreamlitAPIException(
                f"'{str(delta_color)}' is not an accepted value. delta_color only accepts: "
                "'normal', 'inverse', or 'off'"
            )
        return cd

    def is_negative(self, delta):
        return dedent(str(delta)).startswith("-")

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        return cast("streamlit.delta_generator.DeltaGenerator", self)
