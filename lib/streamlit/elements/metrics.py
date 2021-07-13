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

import streamlit
from streamlit.proto.Metrics_pb2 import Metrics as MetricsProto
from .utils import clean_text


class MetricsMixin:
    def metrics(self, label, value, delta=None, delta_colors="normal"):
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
        metrics_proto = MetricsProto()
        metrics_proto.body = self.parse_value(value)
        metrics_proto.title = label
        metrics_proto.delta = str(delta)
        metrics_proto.delta_colors = self.parse_delta_colors(
            clean_text(delta_colors.lower())
        )
        print("Metrics proto: {}".format(metrics_proto))
        return self.dg._enqueue("metrics", metrics_proto)

    def parse_value(self, value):
        if value == None:
            return "-"
        else:
            return str(value)

    # stub
    def parse_delta_colors(self, delta_colors):
        if delta_colors == "normal":
            return 0
        elif delta_colors == "inverse":
            return 1
        elif delta_colors == "off":
            return 2
        # Did not find the accepted values
        else:
            return 3

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        return cast("streamlit.delta_generator.DeltaGenerator", self)
