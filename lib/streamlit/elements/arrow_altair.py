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

"""A Python wrapper around Altair.
Altair is a Python visualization library based on Vega-Lite,
a nice JSON schema for expressing graphs and charts.
"""
from __future__ import annotations

from contextlib import nullcontext
from typing import TYPE_CHECKING, Any, Literal, cast

import streamlit.elements.arrow_vega_lite as arrow_vega_lite
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ArrowVegaLiteChart_pb2 import (
    ArrowVegaLiteChart as ArrowVegaLiteChartProto,
)
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    import altair as alt

    from streamlit.delta_generator import DeltaGenerator


class ArrowAltairMixin:
    @gather_metrics("altair_chart")
    def altair_chart(
        self,
        altair_chart: alt.Chart,
        use_container_width: bool = False,
        theme: Literal["streamlit"] | None = "streamlit",
    ) -> DeltaGenerator:
        """Display a chart using the Altair library.

        Parameters
        ----------
        altair_chart : altair.Chart
            The Altair chart object to display.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Altair's native ``width`` value.

        theme : "streamlit" or None
            The theme of the chart. Currently, we only support "streamlit" for the Streamlit
            defined design or None to fallback to the default behavior of the library.

        Example
        -------

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>> import altair as alt
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
        >>>
        >>> c = (
        ...    alt.Chart(chart_data)
        ...    .mark_circle()
        ...    .encode(x="a", y="b", size="c", color="c", tooltip=["a", "b", "c"])
        ... )
        >>>
        >>> st.altair_chart(c, use_container_width=True)

        .. output::
           https://doc-vega-lite-chart.streamlit.app/
           height: 300px

        Examples of Altair charts can be found at
        https://altair-viz.github.io/gallery/.

        """
        if theme != "streamlit" and theme != None:
            raise StreamlitAPIException(
                f'You set theme="{theme}" while Streamlit charts only support theme=”streamlit” or theme=None to fallback to the default library theme.'
            )
        proto = ArrowVegaLiteChartProto()
        marshall(
            proto,
            altair_chart,
            use_container_width=use_container_width,
            theme=theme,
        )

        return self.dg._enqueue("arrow_vega_lite_chart", proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def marshall(
    vega_lite_chart: ArrowVegaLiteChartProto,
    altair_chart: alt.Chart,
    use_container_width: bool = False,
    theme: None | Literal["streamlit"] = "streamlit",
    **kwargs: Any,
) -> None:
    """Marshall chart's data into proto."""
    import altair as alt

    # Normally altair_chart.to_dict() would transform the dataframe used by the
    # chart into an array of dictionaries. To avoid that, we install a
    # transformer that replaces datasets with a reference by the object id of
    # the dataframe. We then fill in the dataset manually later on.

    datasets = {}

    def id_transform(data) -> dict[str, str]:
        """Altair data transformer that returns a fake named dataset with the
        object id.
        """
        name = str(id(data))
        datasets[name] = data
        return {"name": name}

    alt.data_transformers.register("id", id_transform)  # type: ignore[attr-defined,unused-ignore]

    # The default altair theme has some width/height defaults defined
    # which are not useful for Streamlit. Therefore, we change the theme to
    # "none" to avoid those defaults.
    with alt.themes.enable("none") if alt.themes.active == "default" else nullcontext():  # type: ignore[attr-defined,unused-ignore]
        with alt.data_transformers.enable("id"):  # type: ignore[attr-defined,unused-ignore]
            chart_dict = altair_chart.to_dict()

            # Put datasets back into the chart dict but note how they weren't
            # transformed.
            chart_dict["datasets"] = datasets

            arrow_vega_lite.marshall(
                vega_lite_chart,
                chart_dict,
                use_container_width=use_container_width,
                theme=theme,
                **kwargs,
            )
