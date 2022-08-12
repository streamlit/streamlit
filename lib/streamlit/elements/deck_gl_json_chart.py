import json
from typing import Any, Dict, Mapping, Optional, TYPE_CHECKING, cast

from typing_extensions import Final

from streamlit.proto.DeckGlJsonChart_pb2 import DeckGlJsonChart as PydeckProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from pydeck import Deck

    from streamlit.delta_generator import DeltaGenerator


# Mapping used when no data is passed.
EMPTY_MAP: Final[Mapping[str, Any]] = {
    "initialViewState": {"latitude": 0, "longitude": 0, "pitch": 0, "zoom": 1},
}


class PydeckMixin:
    @gather_metrics
    def pydeck_chart(
        self,
        pydeck_obj: Optional["Deck"] = None,
        use_container_width: bool = False,
    ) -> "DeltaGenerator":
        """Draw a chart using the PyDeck library.

        This supports 3D maps, point clouds, and more! More info about PyDeck
        at https://deckgl.readthedocs.io/en/latest/.

        These docs are also quite useful:

        - DeckGL docs: https://github.com/uber/deck.gl/tree/master/docs
        - DeckGL JSON docs: https://github.com/uber/deck.gl/tree/master/modules/json

        When using this command, we advise all users to use a personal Mapbox
        token. This ensures the map tiles used in this chart are more
        robust. You can do this with the mapbox.token config option.

        To get a token for yourself, create an account at
        https://mapbox.com. It's free! (for moderate usage levels). For more info
        on how to set config options, see
        https://docs.streamlit.io/library/advanced-features/configuration#set-configuration-options

        Parameters
        ----------
        pydeck_obj: pydeck.Deck or None
            Object specifying the PyDeck chart to draw.
        use_container_width: bool

        Example
        -------
        Here's a chart using a HexagonLayer and a ScatterplotLayer. It uses either the
        light or dark map style, based on which Streamlit theme is currently active:

        >>> df = pd.DataFrame(
        ...    np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
        ...    columns=['lat', 'lon'])
        >>>
        >>> st.pydeck_chart(pdk.Deck(
        ...     map_style=None,
        ...     initial_view_state=pdk.ViewState(
        ...         latitude=37.76,
        ...         longitude=-122.4,
        ...         zoom=11,
        ...         pitch=50,
        ...     ),
        ...     layers=[
        ...         pdk.Layer(
        ...            'HexagonLayer',
        ...            data=df,
        ...            get_position='[lon, lat]',
        ...            radius=200,
        ...            elevation_scale=4,
        ...            elevation_range=[0, 1000],
        ...            pickable=True,
        ...            extruded=True,
        ...         ),
        ...         pdk.Layer(
        ...             'ScatterplotLayer',
        ...             data=df,
        ...             get_position='[lon, lat]',
        ...             get_color='[200, 30, 0, 160]',
        ...             get_radius=200,
        ...         ),
        ...     ],
        ... ))

        .. output::
           https://doc-pydeck-chart.streamlitapp.com/
           height: 530px

        .. note::
           To make the PyDeck chart's style consistent with Streamlit's theme,
           you can set ``map_style=None`` in the ``pydeck.Deck`` object.

        """
        pydeck_proto = PydeckProto()
        marshall(pydeck_proto, pydeck_obj, use_container_width)
        return self.dg._enqueue("deck_gl_json_chart", pydeck_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def _get_pydeck_tooltip(pydeck_obj: Optional["Deck"]) -> Optional[Dict[str, str]]:
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
        return tooltip

    return None


def marshall(
    pydeck_proto: PydeckProto,
    pydeck_obj: Optional["Deck"],
    use_container_width: bool,
) -> None:
    if pydeck_obj is None:
        spec = json.dumps(EMPTY_MAP)
    else:
        spec = pydeck_obj.to_json()

    pydeck_proto.json = spec
    pydeck_proto.use_container_width = use_container_width

    tooltip = _get_pydeck_tooltip(pydeck_obj)
    if tooltip:
        pydeck_proto.tooltip = json.dumps(tooltip)
