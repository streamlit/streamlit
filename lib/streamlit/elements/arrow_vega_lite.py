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

import inspect
import json
from typing import TYPE_CHECKING, Any, Literal, cast

import streamlit.elements.lib.dicttools as dicttools
from streamlit.attribute_dictionary import AttributeDictionary
from streamlit.constants import ON_SELECTION_IGNORE
from streamlit.elements import arrow
from streamlit.elements.arrow import Data
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ArrowVegaLiteChart_pb2 import (
    ArrowVegaLiteChart as ArrowVegaLiteChartProto,
)
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state.session_state_proxy import SessionStateProxy
from streamlit.runtime.state.widgets import register_widget
from streamlit.runtime.state.common import compute_widget_id

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


def _on_select(
    proto: ArrowVegaLiteChartProto,
    on_select: Union[str, Callable[..., None], None] = None,
    key: str | None = None,
):
    if on_select is not None and on_select != False:

        def deserialize_vega_lite_event(ui_value, widget_id=""):
            if ui_value is None:
                return {}
            if isinstance(ui_value, str):
                return json.loads(ui_value)

            return AttributeDictionary(ui_value)

        def serialize_vega_lite_event(v):
            return json.dumps(v, default=str)
        
        print(f'{proto.id=}')

        current_value = register_widget(
            "arrow_vega_lite_chart",
            proto,
            user_key=key,
            on_change_handler=None,
            args=None,
            kwargs=None,
            deserializer=deserialize_vega_lite_event,
            serializer=serialize_vega_lite_event,
            ctx=get_script_run_ctx(),
        )

        if isinstance(on_select, str):
            # Set in session state
            session_state = SessionStateProxy()
            session_state[on_select] = AttributeDictionary(current_value.value)
        elif callable(on_select):
            # Call the callback function
            kwargs_callback = {}
            arguments = inspect.getfullargspec(on_select).args
            if "selections" in arguments:
                kwargs_callback["selections"] = current_value
            on_select(**kwargs_callback)


class ArrowVegaLiteMixin:
    @gather_metrics("vega_lite_chart")
    def vega_lite_chart(
        self,
        data: Data = None,
        spec: dict[str, Any] | None = None,
        use_container_width: bool = False,
        theme: Literal["streamlit"] | None = "streamlit",
        on_select: Union[str, Callable[..., None], None] = None,
        **kwargs: Any,
    ) -> DeltaGenerator:
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
        proto = ArrowVegaLiteChartProto()
        marshall(
            proto,
            data,
            spec,
            use_container_width=use_container_width,
            theme=theme,
            on_select=on_select,
            key=key,
            **kwargs,
        )
        if on_select:
            _on_select(proto, on_select, key)
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
    on_select: Union[str, Callable[..., None], True, False, None] = None,
    key: str | None = None,
    **kwargs,
):
    """Construct a Vega-Lite chart object.

    See DeltaGenerator.vega_lite_chart for docs.
    """
    print(f'vega_lite marshall: {key=}')
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

    proto.spec = json.dumps(spec)
    proto.use_container_width = use_container_width
    proto.theme = theme or ""
    
    ctx = get_script_run_ctx()
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

    if on_select:
        proto.is_select_enabled = True
    else:
        proto.is_select_enabled = False

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
