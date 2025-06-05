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

import json
from dataclasses import dataclass
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Literal,
    TypedDict,
    cast,
    overload,
)

from typing_extensions import TypeAlias

from streamlit import config
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
from streamlit.util import AttributeDictionary

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping

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
    for mode in selection_mode_set:
        if mode == "single-object":
            parsed_selection_modes.append(PydeckProto.SelectionMode.SINGLE_OBJECT)
        elif mode == "multi-object":
            parsed_selection_modes.append(PydeckProto.SelectionMode.MULTI_OBJECT)
    return set(parsed_selection_modes)


class PydeckSelectionState(TypedDict, total=False):
    r"""
    The schema for the PyDeck chart selection state.

    The selection state is stored in a dictionary-like object that supports
    both key and attribute notation. Selection states cannot be
    programmatically changed or set through Session State.

    You must define ``id`` in ``pydeck.Layer`` to ensure statefulness when
    using selections with ``st.pydeck_chart``.

    Attributes
    ----------
    indices : dict[str, list[int]]
        A dictionary of selected objects by layer. Each key in the dictionary
        is a layer id, and each value is a list of object indices within that
        layer.
    objects : dict[str, list[dict[str, Any]]]
        A dictionary of object attributes by layer. Each key in the dictionary
        is a layer id, and each value is a list of metadata dictionaries for
        the selected objects in that layer.

    Examples
    --------
    The following example has multi-object selection enabled. The chart
    displays US state capitals by population (2023 US Census estimate). You
    can access this `data
    <https://github.com/streamlit/docs/blob/main/python/api-examples-source/data/capitals.csv>`_
    from GitHub.

    >>> import streamlit as st
    >>> import pydeck
    >>> import pandas as pd
    >>>
    >>> capitals = pd.read_csv(
    ...     "capitals.csv",
    ...     header=0,
    ...     names=[
    ...         "Capital",
    ...         "State",
    ...         "Abbreviation",
    ...         "Latitude",
    ...         "Longitude",
    ...         "Population",
    ...     ],
    ... )
    >>> capitals["size"] = capitals.Population / 10
    >>>
    >>> point_layer = pydeck.Layer(
    ...     "ScatterplotLayer",
    ...     data=capitals,
    ...     id="capital-cities",
    ...     get_position=["Longitude", "Latitude"],
    ...     get_color="[255, 75, 75]",
    ...     pickable=True,
    ...     auto_highlight=True,
    ...     get_radius="size",
    ... )
    >>>
    >>> view_state = pydeck.ViewState(
    ...     latitude=40, longitude=-117, controller=True, zoom=2.4, pitch=30
    ... )
    >>>
    >>> chart = pydeck.Deck(
    ...     point_layer,
    ...     initial_view_state=view_state,
    ...     tooltip={"text": "{Capital}, {Abbreviation}\nPopulation: {Population}"},
    ... )
    >>>
    >>> event = st.pydeck_chart(chart, on_select="rerun", selection_mode="multi-object")
    >>>
    >>> event.selection

    .. output ::
        https://doc-pydeck-event-state-selections.streamlit.app/
        height: 700px

    This is an example of the selection state when selecting a single object
    from a layer with id, ``"captial-cities"``:

    >>> {
    >>>   "indices":{
    >>>     "capital-cities":[
    >>>       2
    >>>     ]
    >>>   },
    >>>   "objects":{
    >>>     "capital-cities":[
    >>>       {
    >>>         "Abbreviation":" AZ"
    >>>         "Capital":"Phoenix"
    >>>         "Latitude":33.448457
    >>>         "Longitude":-112.073844
    >>>         "Population":1650070
    >>>         "State":" Arizona"
    >>>         "size":165007.0
    >>>       }
    >>>     ]
    >>>   }
    >>> }

    """

    indices: dict[str, list[int]]
    objects: dict[str, list[dict[str, Any]]]


class PydeckState(TypedDict, total=False):
    """
    The schema for the PyDeck event state.

    The event state is stored in a dictionary-like object that supports both
    key and attribute notation. Event states cannot be programmatically changed
    or set through Session State.

    Only selection events are supported at this time.

    Attributes
    ----------
    selection : dict
        The state of the ``on_select`` event. This attribute returns a
        dictionary-like object that supports both key and attribute notation.
        The attributes are described by the ``PydeckSelectionState``
        dictionary schema.

    """

    selection: PydeckSelectionState


@dataclass
class PydeckSelectionSerde:
    """PydeckSelectionSerde is used to serialize and deserialize the Pydeck selection state."""

    def deserialize(self, ui_value: str | None) -> PydeckState:
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

        return cast("PydeckState", AttributeDictionary(selection_state))

    def serialize(self, selection_state: PydeckState) -> str:
        return json.dumps(selection_state, default=str)


class PydeckMixin:
    @overload
    def pydeck_chart(
        self,
        pydeck_obj: Deck | None = None,
        *,
        use_container_width: bool = True,
        width: int | None = None,
        height: int | None = None,
        selection_mode: Literal[
            "single-object"
        ],  # Selection mode will only be activated by on_select param; default value here to make it work with mypy
        # No default value here to make it work with mypy
        on_select: Literal["ignore"],
        key: Key | None = None,
    ) -> DeltaGenerator: ...

    @overload
    def pydeck_chart(
        self,
        pydeck_obj: Deck | None = None,
        *,
        use_container_width: bool = True,
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
        use_container_width: bool = True,
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

        When using this command, a service called Carto_ provides the map tiles to render
        map content. If you're using advanced PyDeck features you may need to obtain
        an API key from Carto first. You can do that as
        ``pydeck.Deck(api_keys={"carto": YOUR_KEY})`` or by setting the CARTO_API_KEY
        environment variable. See `PyDeck's documentation`_ for more information.

        Another common provider for map tiles is Mapbox_. If you prefer to use that,
        you'll need to create an account at https://mapbox.com and specify your Mapbox
        key when creating the ``pydeck.Deck`` object. You can do that as
        ``pydeck.Deck(api_keys={"mapbox": YOUR_KEY})`` or by setting the MAPBOX_API_KEY
        environment variable.

        .. _Carto: https://carto.com
        .. _Mapbox: https://mapbox.com
        .. _PyDeck's documentation: https://deckgl.readthedocs.io/en/latest/deck.html

        Carto and Mapbox are third-party products and Streamlit accepts no responsibility
        or liability of any kind for Carto or Mapbox, or for any content or information
        made available by Carto or Mapbox. The use of Carto or Mapbox is governed by
        their respective Terms of Use.

        Parameters
        ----------
        pydeck_obj : pydeck.Deck or None
            Object specifying the PyDeck chart to draw.
        use_container_width : bool
            Whether to override the figure's native width with the width of
            the parent container. If ``use_container_width`` is ``True`` (default),
            Streamlit sets the width of the figure to match the width of the parent
            container. If ``use_container_width`` is ``False``, Streamlit sets the
            width of the chart to fit its contents according to the plotting library,
            up to the width of the parent container.
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
            How the figure should respond to user selection events. This controls
            whether or not the chart behaves like an input widget.
            ``on_select`` can be one of the following:

            - ``"ignore"`` (default): Streamlit will not react to any selection
              events in the chart. The figure will not behave like an
              input widget.
            - ``"rerun"``: Streamlit will rerun the app when the user selects
              data in the chart. In this case, ``st.pydeck_chart`` will return
              the selection data as a dictionary.
            - A ``callable``: Streamlit will rerun the app and execute the callable
              as a callback function before the rest of the app. In this case,
              ``st.pydeck_chart`` will return the selection data as a
              dictionary.

            If ``on_select`` is not ``"ignore"``, all layers must have a
            declared ``id`` to keep the chart stateful across reruns.
        selection_mode : "single-object" or "multi-object"
            The selection mode of the chart. This can be one of the following:

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

        Returns
        -------
        element or dict
            If ``on_select`` is ``"ignore"`` (default), this command returns an
            internal placeholder for the chart element. Otherwise, this method
            returns a dictionary-like object that supports both key and
            attribute notation. The attributes are described by the
            ``PydeckState`` dictionary schema.

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
        ...         map_style=None,  # Use Streamlit theme to pick map style
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

        spec = json.dumps(EMPTY_MAP) if pydeck_obj is None else pydeck_obj.to_json()

        pydeck_proto.json = spec
        pydeck_proto.use_container_width = use_container_width

        if width:
            pydeck_proto.width = width
        if height:
            pydeck_proto.height = height

        tooltip = _get_pydeck_tooltip(pydeck_obj)
        if tooltip:
            pydeck_proto.tooltip = json.dumps(tooltip)

        # Get the Mapbox key from the PyDeck object first, and then fallback to the
        # old mapbox.token config option.

        mapbox_token = getattr(pydeck_obj, "mapbox_key", None)
        if mapbox_token is None or mapbox_token == "":
            mapbox_token = config.get_option("mapbox.token")

        if mapbox_token:
            pydeck_proto.mapbox_token = mapbox_token

        key = to_key(key)
        is_selection_activated = on_select != "ignore"

        if on_select not in ["ignore", "rerun"] and not callable(on_select):
            raise StreamlitAPIException(
                f"You have passed {on_select} to `on_select`. "
                "But only 'ignore', 'rerun', or a callable is supported."
            )

        if is_selection_activated:
            # Selections are activated, treat Pydeck as a widget:
            pydeck_proto.selection_mode.extend(parse_selection_mode(selection_mode))

            # Run some checks that are only relevant when selections are activated
            is_callback = callable(on_select)
            check_widget_policies(
                self.dg,
                key,
                on_change=cast("WidgetCallback", on_select) if is_callback else None,
                default_value=None,
                writes_allowed=False,
                enable_check_callback_rules=is_callback,
            )
            pydeck_proto.form_id = current_form_id(self.dg)

            pydeck_proto.id = compute_and_register_element_id(
                "deck_gl_json_chart",
                user_key=key,
                dg=self.dg,
                is_selection_activated=is_selection_activated,
                selection_mode=selection_mode,
                use_container_width=use_container_width,
                spec=spec,
                form_id=pydeck_proto.form_id,
            )

            serde = PydeckSelectionSerde()

            widget_state = register_widget(
                pydeck_proto.id,
                ctx=ctx,
                deserializer=serde.deserialize,
                on_change_handler=on_select if callable(on_select) else None,
                serializer=serde.serialize,
                value_type="string_value",
            )

            self.dg._enqueue("deck_gl_json_chart", pydeck_proto)

            return cast("PydeckState", widget_state.value)

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
        return cast("dict[str, str]", tooltip)

    return None
