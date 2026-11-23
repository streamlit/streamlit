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


"""Type tests for st.card."""

from __future__ import annotations

from typing import TYPE_CHECKING, assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.card import CardMixin
    from streamlit.elements.lib.card_container import CardContainer

    card = CardMixin().card

    # st.card returns CardContainer
    assert_type(card("Revenue"), CardContainer)

    # Check that the container is usable anywhere a DeltaGenerator is expected.
    # The annotated assignment is the subtype check: assert_type here would only
    # see the DeltaGenerator annotation, so it could never fail.
    _card_as_delta_generator: DeltaGenerator = card("Revenue")

    # Context manager returns Self
    with card("Revenue") as ctx:
        assert_type(ctx, CardContainer)

    # Header parameters accept str or None
    assert_type(card("Revenue", icon=None, caption=None, help=None), CardContainer)
    assert_type(
        card("Revenue", icon="🔥", caption="Last 12 months", help="Tooltip"),
        CardContainer,
    )

    # key accepts str, int, or None
    assert_type(card("Revenue", key="revenue"), CardContainer)
    assert_type(card("Revenue", key=1), CardContainer)

    # Surface parameters accept bool
    assert_type(card("Revenue", border=False, background=True), CardContainer)

    # width and height accept "stretch", "content", or int
    assert_type(card("Revenue", width="stretch", height="stretch"), CardContainer)
    assert_type(card("Revenue", width="content", height="content"), CardContainer)
    assert_type(card("Revenue", width=400, height=300), CardContainer)
