# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform type checking tests for st.echarts_chart.
if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.echarts_chart import EChartsMixin

    echarts_chart = EChartsMixin().echarts_chart

    spec: dict[str, object] = {"series": [{"type": "bar", "data": [1, 2, 3]}]}
    spec_json = '{"series": [{"type": "bar", "data": [1, 2, 3]}]}'

    # =====================================================================
    # Basic return type tests with different option inputs
    # =====================================================================

    assert_type(echarts_chart(spec), DeltaGenerator)
    assert_type(echarts_chart(spec_json), DeltaGenerator)

    # =====================================================================
    # Test width parameter ("stretch", "content", or int)
    # =====================================================================

    assert_type(echarts_chart(spec, width="stretch"), DeltaGenerator)
    assert_type(echarts_chart(spec, width="content"), DeltaGenerator)
    assert_type(echarts_chart(spec, width=500), DeltaGenerator)

    # =====================================================================
    # Test height parameter ("content", "stretch", or int)
    # =====================================================================

    assert_type(echarts_chart(spec, height="content"), DeltaGenerator)
    assert_type(echarts_chart(spec, height="stretch"), DeltaGenerator)
    assert_type(echarts_chart(spec, height=400), DeltaGenerator)

    # =====================================================================
    # Test theme parameter ("streamlit" or None)
    # =====================================================================

    assert_type(echarts_chart(spec, theme="streamlit"), DeltaGenerator)
    assert_type(echarts_chart(spec, theme=None), DeltaGenerator)

    # =====================================================================
    # Test key parameter (str, int, or None)
    # =====================================================================

    assert_type(echarts_chart(spec, key="my_chart"), DeltaGenerator)
    assert_type(echarts_chart(spec, key=123), DeltaGenerator)
    assert_type(echarts_chart(spec, key=None), DeltaGenerator)

    # =====================================================================
    # Test renderer parameter ("canvas" or "svg")
    # =====================================================================

    assert_type(echarts_chart(spec, renderer="canvas"), DeltaGenerator)
    assert_type(echarts_chart(spec, renderer="svg"), DeltaGenerator)

    # =====================================================================
    # Test with all parameters combined
    # =====================================================================

    assert_type(
        echarts_chart(
            spec,
            width="stretch",
            height="content",
            theme="streamlit",
            key="full_chart",
            renderer="canvas",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid theme value (only "streamlit" or None)
    echarts_chart(spec, theme="dark")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Invalid width / height values (only int or "stretch" / "content")
    echarts_chart(spec, width="invalid")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    echarts_chart(spec, height=None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Invalid renderer value (only "canvas" or "svg")
    echarts_chart(spec, renderer="webgl")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
