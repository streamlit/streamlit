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

import json
from dataclasses import dataclass
from typing import (
    TYPE_CHECKING,
    Any,
    Dict,
    Final,
    Iterable,
    Literal,
    Mapping,
    TypedDict,
    cast,
    overload,
)

from typing_extensions import TypeAlias

from streamlit import config
from streamlit.elements.lib.event_utils import AttributeDictionary
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import Key, compute_and_register_element_id, to_key
from streamlit.errors import StreamlitAPIException
from streamlit.proto.DeckGlJsonChart_pb2 import DeckGlJsonChart as PydeckProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import (
    WidgetCallback,
    register_widget,
)

if TYPE_CHECKING:
    from pydeck import Deck

    from streamlit.delta_generator import DeltaGenerator


# Mapping used when no data is passed.
EMPTY_MAP: Final[Mapping[str, Any]] = {
    "initialViewState": {"latitude": 0, "longitude": 0, "pitch": 0, "zoom": 1},
}

SelectionMode: TypeAlias = Literal["single-object", "multi-object"]
_SELECTION_MODES: Final[set[SelectionMode]] = {
    "single-object",
    "multi-object",
}


def parse_selection_mode(
    selection_mode: SelectionMode | Iterable[SelectionMode],
) -> set[PydeckProto.SelectionMode.ValueType]:
    """Parse and check the user provided selection modes."""
    if isinstance(selection_mode, str):
        # Only a single selection mode was passed
        selection_mode_set = {selection_mode}
    else:
        # Multiple selection modes were passed.
        # This is not yet supported as a functionality, but the infra is here to
        # support it in the future!
        # @see DeckGlJsonChart.tsx
        raise StreamlitAPIException(
            f"Invalid selection mode: {selection_mode}. ",
            "Selection mode must be a single value, but got a set instead.",
        )

    if not selection_mode_set.issubset(_SELECTION_MODES):
        raise StreamlitAPIException(
            f"Invalid selection mode: {selection_mode}. "
            f"Valid options are: {_SELECTION_MODES}"
        )

    if selection_mode_set.issuperset({"single-object", "multi-object"}):
        raise StreamlitAPIException(
            "Only one of `single-object` or `multi-object` can be selected as selection mode."
        )

    parsed_selection_modes = []
    for selection_mode in selection_mode_set:
        if selection_mode == "single-object":
            parsed_selection_modes.append(PydeckProto.SelectionMode.SINGLE_OBJECT)
        elif selection_mode == "multi-object":
            parsed_selection_modes.append(PydeckProto.SelectionMode.MULTI_OBJECT)
    return set(parsed_selection_modes)


class PydeckSelectionState(TypedDict, total=False):
    """
    The schema for the PyDeck Layer Selection State

    Attributes
    ----------
    indices : dict[str, list[int]]
        Dictionary where keys are the layer id and values are lists of indices
        of selected objects.
    objects : dict[str, list[dict[str, Any]]]
        Dictionary where keys are the layer id and values are lists of metadata
        objects for the selected items.
    """

    indices: dict[str, list[int]]
    objects: dict[str, list[dict[str, Any]]]


class PydeckState(TypedDict, total=False):
    """
    The schema for the PyDeck State

    Attributes
    ----------
    selection : PydeckSelectionState
        The selection state of the PyDeck layers.
    """

    selection: PydeckSelectionState


@dataclass
class PydeckSelectionSerde:
    """PydeckSelectionSerde is used to serialize and deserialize the Pydeck selection state."""

    def deserialize(self, ui_value: str | None, widget_id: str = "") -> PydeckState:
        empty_selection_state: PydeckState = {
            "selection": {
                "indices": {},
                "objects": {},
            }
        }

        selection_state = (
            empty_selection_state if ui_value is None else json.loads(ui_value)
        )

        # We have seen some situations where the ui_value was just an empty
        # dict, so we want to ensure that it always returns the empty state in
        # case this happens.
        if "selection" not in selection_state:
            selection_state = empty_selection_state

        return cast(PydeckState, AttributeDictionary(selection_state))

    def serialize(self, selection_state: PydeckState) -> str:
        return json.dumps(selection_state, default=str)


class PydeckMixin:
    @overload
    def pydeck_chart(
        self,
        pydeck_obj: Deck | None = None,
        *,
        use_container_width: bool = False,
        width: int | None = None,
        height: int | None = None,
        selection_mode: Literal[
            "single-object"
        ],  # Selection mode will only be activated by on_select param, this is a default value here to make it work with mypy
        on_select: Literal["ignore"],  # No default value here to make it work with mypy
        key: Key | None = None,
    ) -> DeltaGenerator: ...

    @overload
    def pydeck_chart(
        self,
        pydeck_obj: Deck | None = None,
        *,
        use_container_width: bool = False,
        width: int | None = None,
        height: int | None = None,
        selection_mode: SelectionMode = "single-object",
        on_select: Literal["rerun"] | WidgetCallback = "rerun",
        key: Key | None = None,
    ) -> PydeckState: ...

    @gather_metrics("pydeck_chart")
    def pydeck_chart(
        self,
        pydeck_obj: Deck | None = None,
        *,
        use_container_width: bool = False,
        width: int | None = None,
        height: int | None = None,
        selection_mode: SelectionMode = "single-object",
        on_select: Literal["rerun", "ignore"] | WidgetCallback = "ignore",
        key: Key | None = None,
    ) -> DeltaGenerator | PydeckState:
        """Draw a chart using the PyDeck library.

        This supports 3D maps, point clouds, and more! More info about PyDeck
        at https://deckgl.readthedocs.io/en/latest/.

        These docs are also quite useful:

        - DeckGL docs: https://github.com/uber/deck.gl/tree/master/docs
        - DeckGL JSON docs: https://github.com/uber/deck.gl/tree/master/modules/json

        When using this command, Mapbox provides the map tiles to render map
        content. Note that Mapbox is a third-party product and Streamlit accepts
        no responsibility or liability of any kind for Mapbox or for any content
        or information made available by Mapbox.

        Mapbox requires users to register and provide a token before users can
        request map tiles. Currently, Streamlit provides this token for you, but
        this could change at any time. We strongly recommend all users create and
        use their own personal Mapbox token to avoid any disruptions to their
        experience. You can do this with the ``mapbox.token`` config option. The
        use of Mapbox is governed by Mapbox's Terms of Use.

        To get a token for yourself, create an account at https://mapbox.com.
        For more info on how to set config options, see
        https://docs.streamlit.io/develop/api-reference/configuration/config.toml.

        Parameters
        ----------
        pydeck_obj : pydeck.Deck or None
            Object specifying the PyDeck chart to draw.
        use_container_width : bool
            Whether to override the figure's native width with the width of
            the parent container. If ``use_container_width`` is ``False``
            (default), Streamlit sets the width of the chart to fit its contents
            according to the plotting library, up to the width of the parent
            container. If ``use_container_width`` is ``True``, Streamlit sets
            the width of the figure to match the width of the parent container.
        width : int or None
            Desired width of the chart expressed in pixels. If ``width`` is
            ``None`` (default), Streamlit sets the width of the chart to fit
            its contents according to the plotting library, up to the width of
            the parent container. If ``width`` is greater than the width of the
            parent container, Streamlit sets the chart width to match the width
            of the parent container.

            To use ``width``, you must set ``use_container_width=False``.
        height : int or None
            Desired height of the chart expressed in pixels. If ``height`` is
            ``None`` (default), Streamlit sets the height of the chart to fit
            its contents according to the plotting library.
        on_select : "ignore" or "rerun" or callable
            How the chart should respond to user selection events. This controls
            whether or not the dataframe behaves like an input widget.
            ``on_select`` can be one of the following:

            - ``"ignore"`` (default): Streamlit will not react to any selection
              events in the dataframe. The dataframe will not behave like an
              input widget.
            - ``"rerun"``: Rerun the script when a selection is made.
            - callable: A Python callable that will be called when a selection
                is made. The callable will be passed the selection state as a
                dictionary.

            If ``on_select`` is not ``"ignore"``, ensure that the layers given
            to the ``pydeck_obj`` have stable IDs so that selection state can be
            maintained across reruns.
        selection_mode : "single-object" or "multi-object"
            The types of selections Streamlit should allow. This can be one of
            the following:

            - ``"single-object"`` (default): Only one object can be selected at
              a time.
            - ``"multi-object"``: Multiple objects can be selected at a time.
        key : str
            An optional string to use for giving this element a stable
            identity. If ``key`` is ``None`` (default), this element's identity
            will be determined based on the values of the other parameters.

            Additionally, if selections are activated and ``key`` is provided,
            Streamlit will register the key in Session State to store the
            selection state. The selection state is read-only.

        Example
        -------
        Here's a chart using a HexagonLayer and a ScatterplotLayer. It uses either the
        light or dark map style, based on which Streamlit theme is currently active:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>> import pydeck as pdk
        >>>
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
        ...     columns=["lat", "lon"],
        ... )
        >>>
        >>> st.pydeck_chart(
        ...     pdk.Deck(
        ...         map_style=None,
        ...         initial_view_state=pdk.ViewState(
        ...             latitude=37.76,
        ...             longitude=-122.4,
        ...             zoom=11,
        ...             pitch=50,
        ...         ),
        ...         layers=[
        ...             pdk.Layer(
        ...                 "HexagonLayer",
        ...                 data=chart_data,
        ...                 get_position="[lon, lat]",
        ...                 radius=200,
        ...                 elevation_scale=4,
        ...                 elevation_range=[0, 1000],
        ...                 pickable=True,
        ...                 extruded=True,
        ...             ),
        ...             pdk.Layer(
        ...                 "ScatterplotLayer",
        ...                 data=chart_data,
        ...                 get_position="[lon, lat]",
        ...                 get_color="[200, 30, 0, 160]",
        ...                 get_radius=200,
        ...             ),
        ...         ],
        ...     )
        ... )

        .. output::
           https://doc-pydeck-chart.streamlit.app/
           height: 530px

        .. note::
           To make the PyDeck chart's style consistent with Streamlit's theme,
           you can set ``map_style=None`` in the ``pydeck.Deck`` object.

        """
        pydeck_proto = PydeckProto()

        ctx = get_script_run_ctx()

        if pydeck_obj is None:
            spec = json.dumps(EMPTY_MAP)
        else:
            spec = pydeck_obj.to_json()

        pydeck_proto.json = spec
        pydeck_proto.use_container_width = use_container_width

        if width:
            pydeck_proto.width = width
        if height:
            pydeck_proto.height = height

        tooltip = _get_pydeck_tooltip(pydeck_obj)
        if tooltip:
            pydeck_proto.tooltip = json.dumps(tooltip)

        mapbox_token = config.get_option("mapbox.token")
        if mapbox_token:
            pydeck_proto.mapbox_token = mapbox_token

        key = to_key(key)
        is_selection_activated = on_select != "ignore"

        if on_select not in ["ignore", "rerun"] and not callable(on_select):
            raise StreamlitAPIException(
                f"You have passed {on_select} to `on_select`. But only 'ignore', 'rerun', or a callable is supported."
            )

        if is_selection_activated:
            # Selections are activated, treat Pydeck as a widget:
            pydeck_proto.selection_mode.extend(parse_selection_mode(selection_mode))

            # Run some checks that are only relevant when selections are activated
            is_callback = callable(on_select)
            check_widget_policies(
                self.dg,
                key,
                on_change=cast(WidgetCallback, on_select) if is_callback else None,
                default_value=None,
                writes_allowed=False,
                enable_check_callback_rules=is_callback,
            )
            pydeck_proto.form_id = current_form_id(self.dg)

            pydeck_proto.id = compute_and_register_element_id(
                "deck_gl_json_chart",
                user_key=key,
                is_selection_activated=is_selection_activated,
                selection_mode=selection_mode,
                use_container_width=use_container_width,
                spec=spec,
                form_id=pydeck_proto.form_id,
            )

            serde = PydeckSelectionSerde()

            widget_state = register_widget(
                "deck_gl_json_chart",
                pydeck_proto,
                ctx=ctx,
                deserializer=serde.deserialize,
                on_change_handler=on_select if callable(on_select) else None,
                serializer=serde.serialize,
            )

            self.dg._enqueue("deck_gl_json_chart", pydeck_proto)

            return cast(PydeckState, widget_state.value)

        return self.dg._enqueue("deck_gl_json_chart", pydeck_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def _get_pydeck_tooltip(pydeck_obj: Deck | None) -> dict[str, str] | None:
    if pydeck_obj is None:
        return None

    # For pydeck <0.8.1 or pydeck>=0.8.1 when jupyter extra is installed.
    desk_widget = getattr(pydeck_obj, "deck_widget", None)
    if desk_widget is not None and isinstance(desk_widget.tooltip, dict):
        return desk_widget.tooltip

    # For pydeck >=0.8.1 when jupyter extra is not installed.
    # For details, see: https://github.com/visgl/deck.gl/pull/7125/files
    tooltip = getattr(pydeck_obj, "_tooltip", None)
    if tooltip is not None and isinstance(tooltip, dict):
        return cast(Dict[str, str], tooltip)

    return None
