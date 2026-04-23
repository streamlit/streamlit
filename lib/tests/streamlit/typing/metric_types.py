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

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from decimal import Decimal

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.metric import MetricMixin

    metric = MetricMixin().metric

    # =====================================================================
    # st.metric return type tests
    # =====================================================================

    # Basic metric - returns DeltaGenerator
    assert_type(metric("Temperature", "70°F"), DeltaGenerator)
    assert_type(metric("Speed", 100), DeltaGenerator)
    assert_type(metric("Value", 3.14), DeltaGenerator)
    assert_type(metric("Decimal", Decimal("10.5")), DeltaGenerator)
    assert_type(metric("None value", None), DeltaGenerator)

    # Metric with delta parameter
    assert_type(metric("Temperature", "70°F", delta="1.2°F"), DeltaGenerator)
    assert_type(metric("Speed", 100, delta=5), DeltaGenerator)
    assert_type(metric("Value", 3.14, delta=-0.5), DeltaGenerator)
    assert_type(
        metric("Decimal", Decimal("10.5"), delta=Decimal("0.5")), DeltaGenerator
    )
    assert_type(metric("No delta", "100", delta=None), DeltaGenerator)

    # Metric with delta_color parameter
    assert_type(metric("Metric", 100, delta=5, delta_color="normal"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_color="inverse"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_color="off"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_color="red"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_color="orange"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_color="yellow"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_color="green"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_color="blue"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_color="violet"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_color="gray"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_color="grey"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_color="primary"), DeltaGenerator)

    # Metric with help parameter
    assert_type(metric("Metric", 100, help="This is help text"), DeltaGenerator)
    assert_type(metric("Metric", 100, help=None), DeltaGenerator)

    # Metric with label_visibility parameter
    assert_type(metric("Metric", 100, label_visibility="visible"), DeltaGenerator)
    assert_type(metric("Metric", 100, label_visibility="hidden"), DeltaGenerator)
    assert_type(metric("Metric", 100, label_visibility="collapsed"), DeltaGenerator)

    # Metric with border parameter
    assert_type(metric("Metric", 100, border=True), DeltaGenerator)
    assert_type(metric("Metric", 100, border=False), DeltaGenerator)

    # Metric with width parameter
    assert_type(metric("Metric", 100, width="stretch"), DeltaGenerator)
    assert_type(metric("Metric", 100, width="content"), DeltaGenerator)
    assert_type(metric("Metric", 100, width=200), DeltaGenerator)

    # Metric with height parameter
    assert_type(metric("Metric", 100, height="content"), DeltaGenerator)
    assert_type(metric("Metric", 100, height="stretch"), DeltaGenerator)
    assert_type(metric("Metric", 100, height=150), DeltaGenerator)

    # Metric with chart_data parameter
    assert_type(metric("Metric", 100, chart_data=[1, 2, 3, 4, 5]), DeltaGenerator)
    assert_type(metric("Metric", 100, chart_data=(1, 2, 3)), DeltaGenerator)
    assert_type(metric("Metric", 100, chart_data=None), DeltaGenerator)

    # Metric with chart_type parameter
    assert_type(
        metric("Metric", 100, chart_data=[1, 2, 3], chart_type="line"), DeltaGenerator
    )
    assert_type(
        metric("Metric", 100, chart_data=[1, 2, 3], chart_type="bar"), DeltaGenerator
    )
    assert_type(
        metric("Metric", 100, chart_data=[1, 2, 3], chart_type="area"), DeltaGenerator
    )

    # Metric with delta_arrow parameter
    assert_type(metric("Metric", 100, delta=5, delta_arrow="auto"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_arrow="up"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_arrow="down"), DeltaGenerator)
    assert_type(metric("Metric", 100, delta=5, delta_arrow="off"), DeltaGenerator)

    # Metric with format parameter
    assert_type(metric("Metric", 100, format="%.2f"), DeltaGenerator)
    assert_type(metric("Metric", 100, format=None), DeltaGenerator)

    # Metric with delta_description parameter
    assert_type(
        metric("Metric", 100, delta=5, delta_description="since yesterday"),
        DeltaGenerator,
    )
    assert_type(metric("Metric", 100, delta=5, delta_description=None), DeltaGenerator)

    # Metric with all parameters combined
    assert_type(
        metric(
            "Full Metric",
            100,
            delta=5,
            delta_color="normal",
            help="Full help text",
            label_visibility="visible",
            border=True,
            width="stretch",
            height="content",
            chart_data=[1, 2, 3, 4, 5],
            chart_type="line",
            delta_arrow="auto",
            format="%.1f",
            delta_description="since last week",
        ),
        DeltaGenerator,
    )
