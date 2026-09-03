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

from typing import TYPE_CHECKING, Any, Literal, cast

from typing_extensions import assert_type

# Perform type checking tests for st.pydeck_chart.
# Return type depends on on_select:
# - omitted or "ignore" -> DeltaGenerator
# - "rerun" or a callback -> PydeckState
if TYPE_CHECKING:
    from pydeck import Deck

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.deck_gl_json_chart import PydeckMixin, PydeckSelectionState
    from streamlit.typing import PydeckState

    pydeck_chart = PydeckMixin().pydeck_chart

    deck = cast("Deck", object())

    # =====================================================================
    # Basic return type tests
    # (omitted on_select -> DeltaGenerator)
    # =====================================================================

    assert_type(pydeck_chart(deck), DeltaGenerator)
    assert_type(pydeck_chart(None), DeltaGenerator)
    assert_type(pydeck_chart(), DeltaGenerator)

    pydeck_state = pydeck_chart(deck, on_select="rerun")
    assert_type(pydeck_state.selection, PydeckSelectionState)
    assert_type(pydeck_state["selection"], PydeckSelectionState)
    assert_type(pydeck_state.selection.indices, dict[str, list[int]])
    assert_type(pydeck_state.selection["indices"], dict[str, list[int]])
    assert_type(pydeck_state.selection.objects, dict[str, list[dict[str, Any]]])
    assert_type(pydeck_state.selection["objects"], dict[str, list[dict[str, Any]]])

    # =====================================================================
    # Return type tests with on_select="ignore" -> DeltaGenerator
    # =====================================================================

    assert_type(pydeck_chart(deck, on_select="ignore"), DeltaGenerator)
    assert_type(
        pydeck_chart(deck, on_select="ignore", selection_mode="single-object"),
        DeltaGenerator,
    )
    assert_type(
        pydeck_chart(deck, on_select="ignore", selection_mode="multi-object"),
        DeltaGenerator,
    )

    # =====================================================================
    # Return type tests with on_select="rerun" -> PydeckState
    # =====================================================================

    assert_type(pydeck_chart(deck, on_select="rerun"), PydeckState)

    # Non-literal on_select returns the union of both result types.
    on_select: Literal["ignore", "rerun"] = "rerun"
    # ty infers `PydeckState` rather than the union of both overloads.
    assert_type(  # ty: ignore[type-assertion-failure]
        pydeck_chart(deck, on_select=on_select), DeltaGenerator | PydeckState
    )

    # =====================================================================
    # Return type tests with callback function -> PydeckState
    # =====================================================================

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(pydeck_chart(deck, on_select=my_callback), PydeckState)
    assert_type(pydeck_chart(deck, on_select=callback_with_args), PydeckState)
    assert_type(pydeck_chart(deck, on_select=lambda: None), PydeckState)

    # =====================================================================
    # Test width parameter ("stretch" or int)
    # =====================================================================

    assert_type(pydeck_chart(deck, width="stretch"), DeltaGenerator)
    assert_type(pydeck_chart(deck, width=500), DeltaGenerator)

    # =====================================================================
    # Test height parameter ("stretch" or int)
    # =====================================================================

    assert_type(pydeck_chart(deck, height="stretch"), DeltaGenerator)
    assert_type(pydeck_chart(deck, height=400), DeltaGenerator)

    # =====================================================================
    # Test use_container_width parameter (deprecated bool or None)
    # =====================================================================

    assert_type(pydeck_chart(deck, use_container_width=True), DeltaGenerator)
    assert_type(pydeck_chart(deck, use_container_width=False), DeltaGenerator)
    assert_type(pydeck_chart(deck, use_container_width=None), DeltaGenerator)

    # =====================================================================
    # Test selection_mode parameter ("single-object" or "multi-object")
    # =====================================================================

    assert_type(
        pydeck_chart(deck, on_select="rerun", selection_mode="single-object"),
        PydeckState,
    )
    assert_type(
        pydeck_chart(deck, on_select="rerun", selection_mode="multi-object"),
        PydeckState,
    )

    # =====================================================================
    # Test key parameter (str, int, or None)
    # =====================================================================

    assert_type(pydeck_chart(deck, key="my_chart"), DeltaGenerator)
    assert_type(pydeck_chart(deck, key=123), DeltaGenerator)
    assert_type(pydeck_chart(deck, key=None), DeltaGenerator)

    # =====================================================================
    # Test with all parameters combined (on_select="ignore" -> DeltaGenerator)
    # =====================================================================

    assert_type(
        pydeck_chart(
            deck,
            width="stretch",
            use_container_width=None,
            height=500,
            selection_mode="single-object",
            on_select="ignore",
            key="full_chart",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Test with all parameters combined (on_select="rerun" -> PydeckState)
    # =====================================================================

    assert_type(
        pydeck_chart(
            deck,
            width=600,
            use_container_width=None,
            height=400,
            selection_mode="multi-object",
            on_select="rerun",
            key="selectable_chart",
        ),
        PydeckState,
    )

    # =====================================================================
    # Test with all parameters combined (on_select=callback -> PydeckState)
    # =====================================================================

    assert_type(
        pydeck_chart(
            deck,
            width="stretch",
            use_container_width=None,
            height="stretch",
            selection_mode="single-object",
            on_select=my_callback,
            key="callback_chart",
        ),
        PydeckState,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width / height values (only int or "stretch")
    pydeck_chart(deck, width="invalid")  # type: ignore[call-overload]  # ty: ignore[invalid-argument-type]
    pydeck_chart(deck, height=None)  # type: ignore[call-overload]  # ty: ignore[invalid-argument-type]

    # Invalid selection_mode value
    pydeck_chart(deck, on_select="rerun", selection_mode="invalid")  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]

    # Invalid on_select value
    pydeck_chart(deck, on_select="invalid")  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
