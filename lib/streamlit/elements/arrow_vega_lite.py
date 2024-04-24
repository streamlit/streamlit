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

"""A Python wrapper around Vega-Lite."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Callable, Literal, cast

import streamlit.elements.lib.dicttools as dicttools
from streamlit.constants import (
    NO_SELECTION_OBJECTS_ERROR_VEGA_LITE,
    ON_SELECTION_IGNORE,
)
from streamlit.elements import arrow
from streamlit.elements.arrow import Data
from streamlit.elements.form import current_form_id
from streamlit.elements.utils import (
    check_callback_rules,
    check_session_state_rules,
    last_index_for_melted_dataframes,
)
from streamlit.errors import StreamlitAPIException
from streamlit.event_utils import AttributeDictionary
from streamlit.proto.ArrowVegaLiteChart_pb2 import (
    ArrowVegaLiteChart as ArrowVegaLiteChartProto,
)
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state.common import compute_widget_id
from streamlit.runtime.state.widgets import register_widget
from streamlit.type_util import Key, to_key

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


@dataclass
class VegaLiteSelectionSerde:
    """VegaLiteSelectionSerde is used to serialize and deserialize the Vega Lite Chart selection state."""

    def deserialize(
        self, ui_value: str | None, widget_id: str = ""
    ) -> AttributeDictionary:
        selection_state: AttributeDictionary = (
            AttributeDictionary(
                {
                    "select": {},
                }
            )
            if ui_value is None
            else AttributeDictionary(json.loads(ui_value))
        )

        if "select" not in selection_state:
            selection_state = AttributeDictionary(
                {
                    "select": {},
                }
            )

        return selection_state

    def serialize(self, selection_state: AttributeDictionary) -> str:
        return json.dumps(selection_state, default=str)


def _on_select(
    proto: ArrowVegaLiteChartProto,
    on_select: Literal["rerun", "ignore"] | Callable[..., None] = "ignore",
    key: str | None = None,
) -> AttributeDictionary:
    if on_select != ON_SELECTION_IGNORE:
        vega_lite_serde = VegaLiteSelectionSerde()
        current_value = register_widget(
            "arrow_vega_lite_chart",
            proto,
            user_key=key,
            on_change_handler=on_select if callable(on_select) else None,
            args=None,
            kwargs=None,
            deserializer=vega_lite_serde.deserialize,
            serializer=vega_lite_serde.serialize,
            ctx=get_script_run_ctx(),
        )
        return AttributeDictionary(current_value.value)
    return AttributeDictionary({})


class ArrowVegaLiteMixin:
    @gather_metrics("vega_lite_chart")
    def vega_lite_chart(
        self,
        data: Data = None,
        spec: dict[str, Any] | None = None,
        use_container_width: bool = False,
        theme: Literal["streamlit"] | None = "streamlit",
        on_select: Literal["rerun", "ignore"] | Callable[..., None] = "ignore",
        key: str | None = None,
        **kwargs: Any,
    ) -> DeltaGenerator | AttributeDictionary:
        """Display a chart using the Vega-Lite library.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, dict, or None
            Either the data to be plotted or a Vega-Lite spec containing the
            data (which more closely follows the Vega-Lite API).

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

        on_select: Controls the behavior in response to selection events in the chart. Can be one of:
            - “ignore” (default): Streamlit will not react to any selection events in the chart.
            - “rerun”: Streamlit will rerun the app when the user selects data points in the chart. In this case, st.altair_chart will return the selection data as a dictionary. This requires that you add a selection event to the figure object via add_params, see here.
            - callable: If a callable is provided, Streamlit will rerun and execute the callable as a callback function before the rest of the app. The selection data can be retrieved through session state by setting the key parameter.

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        **kwargs : any
            Same as spec, but as keywords.

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(200, 3), columns=["a", "b", "c"])
        >>>
        >>> st.vega_lite_chart(
        ...    chart_data,
        ...    {
        ...        "mark": {"type": "circle", "tooltip": True},
        ...        "encoding": {
        ...            "x": {"field": "a", "type": "quantitative"},
        ...            "y": {"field": "b", "type": "quantitative"},
        ...            "size": {"field": "c", "type": "quantitative"},
        ...            "color": {"field": "c", "type": "quantitative"},
        ...        },
        ...    },
        ... )

        .. output::
           https://doc-vega-lite-chart.streamlit.app/
           height: 300px

        Examples of Vega-Lite usage without Streamlit can be found at
        https://vega.github.io/vega-lite/examples/. Most of those can be easily
        translated to the syntax shown above.

        """
        if theme != "streamlit" and theme != None:
            raise StreamlitAPIException(
                f'You set theme="{theme}" while Streamlit charts only support theme=”streamlit” or theme=None to fallback to the default library theme.'
            )

        if on_select not in ["ignore", "rerun"] and not callable(on_select):
            raise StreamlitAPIException(
                f"You have passed {on_select} to `on_select`. But only 'ignore', 'rerun', or a callable is supported."
            )

        proto = ArrowVegaLiteChartProto()

        is_select_enabled = on_select != ON_SELECTION_IGNORE

        if not is_select_enabled and current_form_id(self.dg):
            # TODO(willhuang1997): double check the message of this
            raise StreamlitAPIException(
                "st.vega_lite_chart cannot be used inside forms!"
            )

        if is_select_enabled:
            if callable(on_select):
                check_callback_rules(self.dg, on_select)

            key = to_key(key)
            check_session_state_rules(default_value={}, key=key, writes_allowed=False)

            current_widget = None
            if spec is not None:
                if "params" not in spec:
                    raise StreamlitAPIException(NO_SELECTION_OBJECTS_ERROR_VEGA_LITE)
                has_selection_object = False
                for param in spec["params"]:
                    if (
                        "name" in param
                        and "select" in param
                        and "type" in param["select"]
                    ):
                        has_selection_object = True
                if not has_selection_object:
                    raise StreamlitAPIException(NO_SELECTION_OBJECTS_ERROR_VEGA_LITE)

            marshall(
                proto,
                data,
                spec,
                use_container_width=use_container_width,
                theme=theme,
                is_select_enabled=is_select_enabled,
                key=key,
                **kwargs,
            )
            current_widget = _on_select(proto, on_select, key)

            self.dg._enqueue("arrow_vega_lite_chart", proto)
            return current_widget
        else:
            marshall(
                proto,
                data,
                spec,
                use_container_width=use_container_width,
                theme=theme,
                **kwargs,
            )
            return self.dg._enqueue("arrow_vega_lite_chart", proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def marshall(
    proto: ArrowVegaLiteChartProto,
    data: Data = None,
    spec: dict[str, Any] | None = None,
    use_container_width: bool = False,
    theme: None | Literal["streamlit"] = "streamlit",
    is_select_enabled: bool = False,
    key: str | None = None,
    **kwargs,
):
    """Construct a Vega-Lite chart object.

    See DeltaGenerator.vega_lite_chart for docs.
    """
    # Support passing data inside spec['datasets'] and spec['data'].
    # (The data gets pulled out of the spec dict later on.)
    if isinstance(data, dict) and spec is None:
        spec = data
        data = None

    # Support passing no spec arg, but filling it with kwargs.
    # Example:
    #   marshall(proto, baz='boz')
    if spec is None:
        spec = dict()
    else:
        # Clone the spec dict, since we may be mutating it.
        spec = dict(spec)

    # Support passing in kwargs. Example:
    #   marshall(proto, {foo: 'bar'}, baz='boz')
    if len(kwargs):
        # Merge spec with unflattened kwargs, where kwargs take precedence.
        # This only works for string keys, but kwarg keys are strings anyways.
        spec = dict(spec, **dicttools.unflatten(kwargs, _CHANNELS))

    if len(spec) == 0:
        raise ValueError("Vega-Lite charts require a non-empty spec dict.")

    if "autosize" not in spec:
        # type fit does not work for many chart types. This change focuses
        # on vconcat with use_container_width=True as there are unintended
        # consequences of changing the default autosize for all charts.
        # fit-x fits the width and height can be adjusted.
        if "vconcat" in spec and use_container_width:
            spec["autosize"] = {"type": "fit-x", "contains": "padding"}
        else:
            spec["autosize"] = {"type": "fit", "contains": "padding"}

    # Pull data out of spec dict when it's in a 'datasets' key:
    #   marshall(proto, {datasets: {foo: df1, bar: df2}, ...})
    if "datasets" in spec:
        for k, v in spec["datasets"].items():
            dataset = proto.datasets.add()
            dataset.name = str(k)
            dataset.has_name = True
            arrow.marshall(dataset.data, v)
        del spec["datasets"]

    # Pull data out of spec dict when it's in a top-level 'data' key:
    #   marshall(proto, {data: df})
    #   marshall(proto, {data: {values: df, ...}})
    #   marshall(proto, {data: {url: 'url'}})
    #   marshall(proto, {data: {name: 'foo'}})
    if "data" in spec:
        data_spec = spec["data"]

        if isinstance(data_spec, dict):
            if "values" in data_spec:
                data = data_spec["values"]
                del spec["data"]
        else:
            data = data_spec
            del spec["data"]

    ctx = get_script_run_ctx()

    if is_select_enabled:
        id = compute_widget_id(
            "arrow_vega_lite",
            user_key=key,
            data=data,
            spec=spec,
            use_container_width=use_container_width,
            key=key,
            theme=theme,
            page=ctx.page_script_hash if ctx else None,
        )
        proto.id = id
        proto.is_select_enabled = True
    else:
        proto.is_select_enabled = False

    proto.spec = json.dumps(spec)
    proto.use_container_width = use_container_width
    proto.theme = theme or ""

    if data is not None:
        arrow.marshall(proto.data, data)


# See https://vega.github.io/vega-lite/docs/encoding.html
_CHANNELS = {
    "x",
    "y",
    "x2",
    "y2",
    "xError",
    "xError2",
    "yError",
    "yError2",
    "longitude",
    "latitude",
    "color",
    "opacity",
    "fillOpacity",
    "strokeOpacity",
    "strokeWidth",
    "size",
    "shape",
    "text",
    "tooltip",
    "href",
    "key",
    "order",
    "detail",
    "facet",
    "row",
    "column",
}
