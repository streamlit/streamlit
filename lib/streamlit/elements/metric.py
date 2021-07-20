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

from typing import cast
from textwrap import dedent

import streamlit
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Metric_pb2 import Metric as MetricProto
from .utils import clean_text


class MetricMixin:
    def metric(self, label, value, delta=None, delta_colors="normal"):
        """Display a metric widget.

        Parameters
        ----------
        label : str
            The header or Title for the metric
        value : Integer, Float, String, or None
             Value of the metric. None is rendered as a long dash.
        delta : Integer, Float, String, or None
            Indicator of how the metric changed, rendered with an arrow below
            the metric. If delta is negative (int/float) or starts with a minus
            sign (str), the arrow points down and the text is red; else the
            arrow points up and the text is green. If None (default), no delta
            indicator is shown.
        delta_colors :
             If "normal" (default), the delta indicator is shown as described
             above. If "inverse", it is red when positive and green when
             negative. This is useful when a negative change is considered
             good, e.g. if cost decreased. If "off", delta is  shown in gray
             regardless of its value.

        Returns
        -------

        Example
        -------
        >>> st.metric(label="Active developers", value=123, delta=123,
        ...     delta_colors="off")  # arrow up, gray

        """
        metric_proto = MetricProto()
        metric_proto.body = self.parse_value(value)
        metric_proto.label = self.parse_label(label)
        metric_proto.delta = self.parse_delta(delta)
        metric_proto.delta_colors = self.determine_delta_colors(
            clean_text(delta_colors), delta
        )
        return self.dg._enqueue("metric", metric_proto)

    def parse_label(self, label):
        if not isinstance(label, str):
            raise StreamlitAPIException(
                str(label) + " is not an accepted Type. label only accepts:"
                             " str"
            )
        return label

    def parse_value(self, value):
        if value is None:
            return "—"
        if isinstance(value, float) or isinstance(value, int) or isinstance(value, str):
            return str(value)
        else:
            raise StreamlitAPIException(
                str(value) + " is not an accepted Type. value only accepts:"
                " int, float, str, and None"
            )

    def parse_delta(self, delta):
        if delta is None:
            return ""
        if isinstance(delta, str):
            delta = dedent(delta)
            if delta[0] == "-":
                return delta[1:]
            return delta
        elif isinstance(delta, int):
            return str(abs(delta))
        elif isinstance(delta, float):
            return str(abs(delta))
        else:
            raise StreamlitAPIException(
                str(delta) + " is not an accepted Type. delta only accepts:"
                " int, float, str, and None"
            )

    def determine_delta_colors(self, delta_colors, delta):
        if delta is None:
            return 6

        # 1 will represent red and 0 will represent green
        if self.is_negative(delta):
            if delta_colors == "normal":
                return 0
            elif delta_colors == "inverse":
                return 1
            # represent down gray arrow with value
            elif delta_colors == "off":
                return 2
        else:
            if delta_colors == "normal":
                return 3
            elif delta_colors == "inverse":
                return 4
            # represent up gray arrow with value
            elif delta_colors == "off":
                return 5

        # did not find an accepted value, should we throw exception or return bad value
        raise StreamlitAPIException(
            str(delta_colors) + " is not an accepted Value. delta_colors only accepts:"
            '"inverse", "off", "none", or "normal"'
        )

    def is_negative(self, delta):
        if dedent(str(delta))[0] == "-":
            return True
        return False

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        return cast("streamlit.delta_generator.DeltaGenerator", self)
