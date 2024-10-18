# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
        help: str | None = None,
        label_visibility: LabelVisibility = "visible",
        sparkline: OptionSequence | None = None,
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
            Strikethroughs, Inline Code, and Links.

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

        help : str
            An optional tooltip that gets displayed next to the metric label.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. If "hidden", the label doesn't show but there
            is still empty space for it (equivalent to label="").
            If "collapsed", both the label and the space are removed. Default is
            "visible".

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> st.metric(label="Temperature", value="70 °F", delta="1.2 °F")

        .. output::
            https://doc-metric-example1.streamlit.app/
            height: 210px

        ``st.metric`` looks especially nice in combination with ``st.columns``:

        >>> import streamlit as st
        >>>
        >>> col1, col2, col3 = st.columns(3)
        >>> col1.metric("Temperature", "70 °F", "1.2 °F")
        >>> col2.metric("Wind", "9 mph", "-8%")
        >>> col3.metric("Humidity", "86%", "4%")

        .. output::
            https://doc-metric-example2.streamlit.app/
            height: 210px

        The delta indicator color can also be inverted or turned off:

        >>> import streamlit as st
        >>>
        >>> st.metric(label="Gas price", value=4, delta=-0.5, delta_color="inverse")
        >>>
        >>> st.metric(
        ...     label="Active developers", value=123, delta=123, delta_color="off"
        ... )

        .. output::
            https://doc-metric-example3.streamlit.app/
            height: 320px

        """
        maybe_raise_label_warnings(label, label_visibility)

        metric_proto = MetricProto()
        metric_proto.body = _parse_value(value)
        metric_proto.label = _parse_label(label)
        metric_proto.delta = _parse_delta(delta)
        if help is not None:
            metric_proto.help = dedent(help)

        color_and_direction = _determine_delta_color_and_direction(
            cast(DeltaColor, clean_text(delta_color)), delta
        )
        metric_proto.color = color_and_direction.color
        metric_proto.direction = color_and_direction.direction
        metric_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if sparkline is not None:
            prepared_sparkline: list[float] = []
            for value in convert_anything_to_list(sparkline):
                try:
                    prepared_sparkline.append(float(value))  # type: ignore
                except Exception as ex:
                    raise StreamlitAPIException(
                        "Only numeric values are supported for sparkline sequence. The "
                        f"value '{str(value)}' is of type {str(type(value))} and  "
                        "cannot be converted to float."
                    ) from ex
                if len(prepared_sparkline) > 0:
                    metric_proto.sparkline.extend(prepared_sparkline)
        return self.dg._enqueue("metric", metric_proto)

    @property
    def dg(self) -> DeltaGenerator:
        return cast("DeltaGenerator", self)


def _parse_label(label: str) -> str:
    if not isinstance(label, str):
        raise TypeError(
            f"'{str(label)}' is of type {str(type(label))}, which is not an accepted type."
            " label only accepts: str. Please convert the label to an accepted type."
        )
    return label


def _parse_value(value: Value) -> str:
    if value is None:
        return "—"
    if isinstance(value, int) or isinstance(value, float) or isinstance(value, str):
        return str(value)
    elif hasattr(value, "item"):
        # Add support for numpy values (e.g. int16, float64, etc.)
        try:
            # Item could also be just a variable, so we use try, except
            if isinstance(value.item(), float) or isinstance(value.item(), int):
                return str(value.item())
        except Exception:
            # If the numpy item is not a valid value, the TypeError below will be raised.
            pass

    raise TypeError(
        f"'{str(value)}' is of type {str(type(value))}, which is not an accepted type."
        " value only accepts: int, float, str, or None."
        " Please convert the value to an accepted type."
    )


def _parse_delta(delta: Delta) -> str:
    if delta is None or delta == "":
        return ""
    if isinstance(delta, str):
        return dedent(delta)
    elif isinstance(delta, int) or isinstance(delta, float):
        return str(delta)
    else:
        raise TypeError(
            f"'{str(delta)}' is of type {str(type(delta))}, which is not an accepted type."
            " delta only accepts: int, float, str, or None."
            " Please convert the value to an accepted type."
        )


def _determine_delta_color_and_direction(
    delta_color: DeltaColor,
    delta: Delta,
) -> MetricColorAndDirection:
    if delta_color not in {"normal", "inverse", "off"}:
        raise StreamlitAPIException(
            f"'{str(delta_color)}' is not an accepted value. delta_color only accepts: "
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
