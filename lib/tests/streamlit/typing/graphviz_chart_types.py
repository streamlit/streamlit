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

from typing import TYPE_CHECKING, cast

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    import graphviz

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.graphviz_chart import GraphvizMixin

    graphviz_chart = GraphvizMixin().graphviz_chart

    graph = cast("graphviz.Graph", object())
    digraph = cast("graphviz.Digraph", object())
    source = cast("graphviz.Source", object())

    # =====================================================================
    # st.graphviz_chart return type tests
    # =====================================================================

    # Basic usage with a dot string - returns DeltaGenerator
    assert_type(graphviz_chart("digraph { a -> b }"), DeltaGenerator)

    # With graphviz figure objects
    assert_type(graphviz_chart(graph), DeltaGenerator)
    assert_type(graphviz_chart(digraph), DeltaGenerator)
    assert_type(graphviz_chart(source), DeltaGenerator)

    # With width parameter
    assert_type(graphviz_chart("digraph { a -> b }", width="content"), DeltaGenerator)
    assert_type(graphviz_chart("digraph { a -> b }", width="stretch"), DeltaGenerator)
    assert_type(graphviz_chart("digraph { a -> b }", width=500), DeltaGenerator)

    # With height parameter
    assert_type(graphviz_chart("digraph { a -> b }", height="content"), DeltaGenerator)
    assert_type(graphviz_chart("digraph { a -> b }", height="stretch"), DeltaGenerator)
    assert_type(graphviz_chart("digraph { a -> b }", height=400), DeltaGenerator)

    # With all parameters combined
    assert_type(
        graphviz_chart(
            digraph,
            width="stretch",
            height=400,
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width / height values (only int or "stretch" / "content", and
    # None is not allowed)
    graphviz_chart("digraph { a -> b }", width="invalid")  # type: ignore[arg-type]
    graphviz_chart("digraph { a -> b }", width=None)  # type: ignore[arg-type]
    graphviz_chart("digraph { a -> b }", height="invalid")  # type: ignore[arg-type]
    graphviz_chart("digraph { a -> b }", height=None)  # type: ignore[arg-type]
