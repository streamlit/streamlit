# Copyright 2018-2020 Streamlit Inc.
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

"""A Python wrapper around DeckGl."""

import json
from typing import Any, List

from streamlit import case_converters
from streamlit import config
from streamlit.proto.DeckGlChart_pb2 import DeckGlChart as DeckGlChartProto
import streamlit.elements.lib.dicttools as dicttools
import streamlit.elements.data_frame_proto as data_frame_proto

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


class DeckGlMixin:
    def deck_gl_chart(dg, spec=None, use_container_width=False, **kwargs):
        """Draw a map chart using the Deck.GL library.

        This API closely follows Deck.GL's JavaScript API
        (https://deck.gl/#/documentation), with a few small adaptations and
        some syntax sugar.

        When using this command, we advise all users to use a personal Mapbox
        token. This ensures the map tiles used in this chart are more
        robust. You can do this with the mapbox.token config option.

        To get a token for yourself, create an account at
        https://mapbox.com. It's free! (for moderate usage levels) See
        https://docs.streamlit.io/en/latest/cli.html#view-all-config-options for more
        info on how to set config options.

        Parameters
        ----------

        spec : dict
            Keys in this dict can be:

            - Anything accepted by Deck.GL's top level element, such as
              "viewport", "height", "width".

            - "layers": a list of dicts containing information to build a new
              Deck.GL layer in the map. Each layer accepts the following keys:

                - "data" : DataFrame
                  The data for the current layer.

                - "type" : str
                  One of the Deck.GL layer types that are currently supported
                  by Streamlit: ArcLayer, GridLayer, HexagonLayer, LineLayer,
                  PointCloudLayer, ScatterplotLayer, ScreenGridLayer,
                  TextLayer.

                - Plus anything accepted by that layer type. The exact keys that
                  are accepted depend on the "type" field, above. For example, for
                  ScatterplotLayer you can set fields like "opacity", "filled",
                  "stroked", and so on.

                  In addition, Deck.GL"s documentation for ScatterplotLayer
                  shows you can use a "getRadius" field to individually set
                  the radius of each circle in the plot. So here you would
                  set "getRadius": "my_column" where "my_column" is the name
                  of the column containing the radius data.

                  For things like "getPosition", which expect an array rather
                  than a scalar value, we provide alternates that make the
                  API simpler to use with dataframes:

                  - Instead of "getPosition" : use "getLatitude" and
                    "getLongitude".
                  - Instead of "getSourcePosition" : use "getLatitude" and
                    "getLongitude".
                  - Instead of "getTargetPosition" : use "getTargetLatitude"
                    and "getTargetLongitude".
                  - Instead of "getColor" : use "getColorR", "getColorG",
                    "getColorB", and (optionally) "getColorA", for red,
                    green, blue and alpha.
                  - Instead of "getSourceColor" : use the same as above.
                  - Instead of "getTargetColor" : use "getTargetColorR", etc.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the figure's native `width` value.

        **kwargs : any
            Same as spec, but as keywords. Keys are "unflattened" at the
            underscore characters. For example, foo_bar_baz=123 becomes
            foo={'bar': {'bar': 123}}.

        Example
        -------
        >>> st.deck_gl_chart(
        ...     viewport={
        ...         'latitude': 37.76,
        ...         'longitude': -122.4,
        ...         'zoom': 11,
        ...         'pitch': 50,
        ...     },
        ...     layers=[{
        ...         'type': 'HexagonLayer',
        ...         'data': df,
        ...         'radius': 200,
        ...         'elevationScale': 4,
        ...         'elevationRange': [0, 1000],
        ...         'pickable': True,
        ...         'extruded': True,
        ...     }, {
        ...         'type': 'ScatterplotLayer',
        ...         'data': df,
        ...     }])
        ...

        .. output::
           https://share.streamlit.io/0.50.0-td2L/index.html?id=3GfRygWqxuqB5UitZLjz9i
           height: 530px

        """

        suppress_deprecation_warning = config.get_option(
            "global.suppressDeprecationWarnings"
        )
        if not suppress_deprecation_warning:
            import streamlit as st

            st.warning(
                """
                The `deck_gl_chart` widget is deprecated and will be removed on
                2020-05-01. To render a map, you should use `st.pydeck_chart` widget.
            """
            )

        deck_gl_proto = DeckGlChartProto()
        marshall(deck_gl_proto, spec, use_container_width, **kwargs)
        return dg._enqueue("deck_gl_chart", deck_gl_proto)  # type: ignore


def marshall(proto, spec=None, use_container_width=False, **kwargs):
    """Marshall a proto with DeckGL chart info.

    See DeltaGenerator.deck_gl_chart for docs.
    """
    data = []  # type: List[Any]

    if spec is None:
        spec = dict()

    # Merge spec with unflattened kwargs, where kwargs take precedence.
    # This only works for string keys, but kwarg keys are strings anyways.
    spec = dict(spec, **dicttools.unflatten(kwargs))

    if "layers" not in spec:
        spec["layers"] = []

        # Syntax sugar: if no layers defined and data is passed at the top
        # level, create a scatterplot layer with the top-level data by default.
        if data is not None:
            spec["layers"].append({"data": data, "type": "ScatterplotLayer"})

    for layer in spec["layers"]:
        # Don't add layers that have no data.
        if "data" not in layer:
            continue

        # Remove DataFrame because it's not JSON-serializable
        data = layer.pop("data")

        layer_proto = proto.layers.add()
        fixed_layer = case_converters.convert_dict_keys(
            case_converters.to_lower_camel_case, layer
        )
        layer_proto.spec = json.dumps(fixed_layer)
        # TODO: If several layers use the same data frame, the data gets resent
        # for each layer. Need to improve this.
        data_frame_proto.marshall_data_frame(data, layer_proto.data)

    del spec["layers"]

    # Dump JSON after removing DataFrames (see loop above), because DataFrames
    # are not JSON-serializable.
    proto.spec = json.dumps(spec)
    proto.use_container_width = use_container_width
