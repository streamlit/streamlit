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
import re
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Literal, cast

import streamlit.elements.lib.dicttools as dicttools
from streamlit.attribute_dictionary import AttributeDictionary
from streamlit.chart_util import check_on_select_str
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


def replace_values_in_dict(
    d: Dict[str, Any] | List[Any], old_to_new_map: Dict[str, str]
) -> None:
    if isinstance(d, dict):
        for key, value in d.items():
            if isinstance(value, str) and value in old_to_new_map:
                d[key] = old_to_new_map[value]
            elif isinstance(value, dict):
                replace_values_in_dict(value, old_to_new_map)
            elif isinstance(value, list):
                for item in value:
                    replace_values_in_dict(item, old_to_new_map)
    elif isinstance(d, list):
        for item in d:
            replace_values_in_dict(item, old_to_new_map)


def _on_select(
    proto: ArrowVegaLiteChartProto,
    on_select: Literal["rerun", "ignore"] | Callable[..., None] | bool | None = None,
    key: str | None = None,
) -> AttributeDictionary:
    if (
        on_select is not None
        and on_select != False
        and on_select != ON_SELECTION_IGNORE
    ):
        # Must change on_select to None otherwise register_widget will error with on_change_handler to a bool or str
        if isinstance(on_select, bool) or isinstance(on_select, str):
            on_select = None

        def deserialize_vega_lite_event(ui_value, widget_id=""):
            if ui_value is None:
                return {}
            if isinstance(ui_value, str):
                return json.loads(ui_value)

            return AttributeDictionary(ui_value)

        def serialize_vega_lite_event(v):
            return json.dumps(v, default=str)

        current_value = register_widget(
            "arrow_vega_lite_chart",
            proto,
            user_key=key,
            on_change_handler=on_select,
            args=None,
            kwargs=None,
            deserializer=deserialize_vega_lite_event,
            serializer=serialize_vega_lite_event,
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
        on_select: Literal["rerun", "ignore"]
        | Callable[..., None]
        | bool
        | None = None,
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
            - False (default): Streamlit will not react to any selection events in the chart.
            - True: Streamlit will rerun the app when the user selects data points in the chart. In this case, st.altair_chart will return the selection data as a dictionary. This requires that you add a selection event to the figure object via add_params, see here.
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

        proto = ArrowVegaLiteChartProto()

        is_select_enabled = (
            on_select != None
            and on_select != False
            and on_select != ON_SELECTION_IGNORE
        )

        if not is_select_enabled and current_form_id(self.dg):
            # TODO(willhuang1997): double check the message of this
            raise StreamlitAPIException(
                "st.vega_lite_chart cannot be used inside forms!"
            )

        if is_select_enabled:
            on_select_callback = on_select
            # Must change on_select to None otherwise register_widget will error with on_change_handler to a bool or str
            if isinstance(on_select_callback, bool) or isinstance(
                on_select_callback, str
            ):
                on_select_callback = None

            key = to_key(key)
            check_callback_rules(self.dg, on_select_callback)
            check_session_state_rules(default_value={}, key=key, writes_allowed=False)
            check_on_select_str(on_select, "vega_lite_chart")

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
    is_select_enabled: Literal["rerun", "ignore"]
    | Callable[..., None]
    | bool
    | None = "ignore",
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
        spec["autosize"] = {"type": "fit", "contains": "padding"}

    data_id_counter = 0

    stable_ids = {}
    # Pull data out of spec dict when it's in a 'datasets' key:
    #   marshall(proto, {datasets: {foo: df1, bar: df2}, ...})
    if "datasets" in spec:
        for k, v in spec["datasets"].items():
            dataset = proto.datasets.add()
            if is_select_enabled:
                # map data ids to our own stable ids to replace later
                # otherwise the widget id will change and rerender a completely new chart
                stable_ids[k] = str(data_id_counter)
                dataset.name = str(data_id_counter)
                data_id_counter += 1
            else:
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
        # https://github.com/vega/altair/blob/f345cd9368ae2bbc98628e9245c93fa9fb582621/altair/vegalite/v5/api.py#L196
        # altair creates names for parameters when no name is created as it's required in vega
        # streamlit reruns will increment this counter by 1 so we need a stable name
        # otherwise the widget id will change and rerender a completely new chart
        regex = re.compile(r"^param_\d+$")
        param_counter = 0

        for param in spec["params"]:
            view_counter = 0
            name = param["name"]
            if regex.match(name):
                param["name"] = f"selection_{param_counter}"
                stable_ids[name] = f"selection_{param_counter}"
                param_counter += 1
            if "views" in param:
                # https://github.com/vega/altair/blob/f345cd9368ae2bbc98628e9245c93fa9fb582621/altair/vegalite/v5/api.py#L2885
                # altair creates auto generates names for views through a counter to map properties to each view
                # streamlit reruns will increment this counter by 1 so we need a stable name
                # otherwise the widget id will change and rerender a completely new chart
                for view_index, view in enumerate(param["views"]):
                    param["views"][view_index] = f"view_{view_counter}"
                    stable_ids[view] = f"view_{view_counter}"
                    view_counter += 1
        keys = ["hconcat", "vconcat", "layer", "encoding", "data"]
        for k in keys:
            if k in spec:
                replace_values_in_dict(spec[k], stable_ids)
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
