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

# Perform type checking tests for st.pydeck_chart.
# The return type depends on the on_select parameter:
# - no on_select / on_select="rerun" / callable -> returns PydeckState
# - on_select="ignore" (with selection_mode="single-object") -> returns
#   DeltaGenerator
# Note: because the "ignore" overload has no default value, omitting on_select
# resolves to the "rerun" overload and therefore returns PydeckState.
if TYPE_CHECKING:
    from pydeck import Deck

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.deck_gl_json_chart import PydeckMixin, PydeckState

    pydeck_chart = PydeckMixin().pydeck_chart

    deck = cast("Deck", object())

    # =====================================================================
    # Basic return type tests
    # (no on_select -> resolves to the "rerun" overload -> PydeckState)
    # =====================================================================

    assert_type(pydeck_chart(deck), PydeckState)
    assert_type(pydeck_chart(None), PydeckState)
    assert_type(pydeck_chart(), PydeckState)

    # =====================================================================
    # Return type tests with on_select="ignore" -> DeltaGenerator
    # (requires selection_mode="single-object" to match the overload)
    # =====================================================================

    assert_type(
        pydeck_chart(deck, on_select="ignore", selection_mode="single-object"),
        DeltaGenerator,
    )

    # =====================================================================
    # Return type tests with on_select="rerun" -> PydeckState
    # =====================================================================

    assert_type(pydeck_chart(deck, on_select="rerun"), PydeckState)

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
    # (both the "rerun" -> PydeckState and "ignore" -> DeltaGenerator paths)
    # =====================================================================

    assert_type(pydeck_chart(deck, width="stretch"), PydeckState)
    assert_type(pydeck_chart(deck, width=500), PydeckState)
    assert_type(
        pydeck_chart(
            deck, on_select="ignore", selection_mode="single-object", width=500
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Test height parameter ("stretch" or int)
    # (both the "rerun" -> PydeckState and "ignore" -> DeltaGenerator paths)
    # =====================================================================

    assert_type(pydeck_chart(deck, height="stretch"), PydeckState)
    assert_type(pydeck_chart(deck, height=400), PydeckState)
    assert_type(
        pydeck_chart(
            deck, on_select="ignore", selection_mode="single-object", height=400
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Test use_container_width parameter (deprecated bool or None)
    # (both the "rerun" -> PydeckState and "ignore" -> DeltaGenerator paths)
    # =====================================================================

    assert_type(pydeck_chart(deck, use_container_width=True), PydeckState)
    assert_type(pydeck_chart(deck, use_container_width=False), PydeckState)
    assert_type(pydeck_chart(deck, use_container_width=None), PydeckState)
    assert_type(
        pydeck_chart(
            deck,
            on_select="ignore",
            selection_mode="single-object",
            use_container_width=True,
        ),
        DeltaGenerator,
    )

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
    # (both the "rerun" -> PydeckState and "ignore" -> DeltaGenerator paths)
    # =====================================================================

    assert_type(pydeck_chart(deck, key="my_chart"), PydeckState)
    assert_type(pydeck_chart(deck, key=123), PydeckState)
    assert_type(pydeck_chart(deck, key=None), PydeckState)
    assert_type(
        pydeck_chart(
            deck, on_select="ignore", selection_mode="single-object", key="my_chart"
        ),
        DeltaGenerator,
    )

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
    pydeck_chart(deck, width="invalid")  # type: ignore[call-overload]
    pydeck_chart(deck, height=None)  # type: ignore[call-overload]

    # Invalid selection_mode value
    pydeck_chart(deck, on_select="rerun", selection_mode="invalid")  # type: ignore[call-overload]

    # Invalid on_select value
    pydeck_chart(deck, on_select="invalid")  # type: ignore[call-overload]
