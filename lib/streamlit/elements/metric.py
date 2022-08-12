from dataclasses import dataclass
from textwrap import dedent
from typing import cast, TYPE_CHECKING, Union, Optional
from typing_extensions import TypeAlias, Literal

from streamlit.errors import StreamlitAPIException
from streamlit.proto.Metric_pb2 import Metric as MetricProto
from streamlit.string_util import clean_text
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    import numpy as np

    from streamlit.delta_generator import DeltaGenerator


Value: TypeAlias = Union["np.integer", "np.floating", float, str, None]
Delta: TypeAlias = Union[float, str, None]
DeltaColor: TypeAlias = Literal["normal", "inverse", "off"]


@dataclass(frozen=True)
class MetricColorAndDirection:
    color: "MetricProto.MetricColor.ValueType"
    direction: "MetricProto.MetricDirection.ValueType"


class MetricMixin:
    @gather_metrics
    def metric(
        self,
        label: str,
        value: Value,
        delta: Delta = None,
        delta_color: DeltaColor = "normal",
        help: Optional[str] = None,
    ) -> "DeltaGenerator":
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
        help : str
            An optional tooltip that gets displayed next to the metric label.

        Example
        -------
        >>> st.metric(label="Temperature", value="70 °F", delta="1.2 °F")

        .. output::
            https://doc-metric-example1.streamlitapp.com/
            height: 210px

        ``st.metric`` looks especially nice in combination with ``st.columns``:

        >>> col1, col2, col3 = st.columns(3)
        >>> col1.metric("Temperature", "70 °F", "1.2 °F")
        >>> col2.metric("Wind", "9 mph", "-8%")
        >>> col3.metric("Humidity", "86%", "4%")

        .. output::
            https://doc-metric-example2.streamlitapp.com/
            height: 210px

        The delta indicator color can also be inverted or turned off:

        >>> st.metric(label="Gas price", value=4, delta=-0.5,
        ...     delta_color="inverse")
        >>>
        >>> st.metric(label="Active developers", value=123, delta=123,
        ...     delta_color="off")

        .. output::
            https://doc-metric-example3.streamlitapp.com/
            height: 320px

        """
        metric_proto = MetricProto()
        metric_proto.body = self.parse_value(value)
        metric_proto.label = self.parse_label(label)
        metric_proto.delta = self.parse_delta(delta)
        if help is not None:
            metric_proto.help = dedent(help)

        color_and_direction = self.determine_delta_color_and_direction(
            cast(DeltaColor, clean_text(delta_color)), delta
        )
        metric_proto.color = color_and_direction.color
        metric_proto.direction = color_and_direction.direction

        return self.dg._enqueue("metric", metric_proto)

    @staticmethod
    def parse_label(label: str) -> str:
        if not isinstance(label, str):
            raise TypeError(
                f"'{str(label)}' is of type {str(type(label))}, which is not an accepted type."
                " label only accepts: str. Please convert the label to an accepted type."
            )
        return label

    @staticmethod
    def parse_value(value: Value) -> str:
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
                pass

        raise TypeError(
            f"'{str(value)}' is of type {str(type(value))}, which is not an accepted type."
            " value only accepts: int, float, str, or None."
            " Please convert the value to an accepted type."
        )

    @staticmethod
    def parse_delta(delta: Delta) -> str:
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

    def determine_delta_color_and_direction(
        self,
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

        if self.is_negative(delta):
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

    @staticmethod
    def is_negative(delta: Delta) -> bool:
        return dedent(str(delta)).startswith("-")

    @property
    def dg(self) -> "DeltaGenerator":
        return cast("DeltaGenerator", self)
