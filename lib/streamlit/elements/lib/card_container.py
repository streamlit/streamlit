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

from typing import TYPE_CHECKING, Literal, Self

from streamlit.delta_generator import DeltaGenerator

if TYPE_CHECKING:
    from types import TracebackType

    from streamlit.cursor import Cursor


class CardContainer(DeltaGenerator):
    """The container returned by ``st.card``.

    The card is its own body: use ``with`` notation or call commands directly
    on the returned object to add elements below the card's header.
    """

    def __init__(
        self,
        root_container: int | None,
        cursor: Cursor | None,
        parent: DeltaGenerator | None,
        block_type: str | None,
    ) -> None:
        super().__init__(root_container, cursor, parent, block_type)
        # The card's header slots. `st.card` fills these right after creating
        # the body, so every card has the same three children in the same
        # order, whether or not a slot is ever written.
        self._header_extras: DeltaGenerator | None = None
        self._actions: DeltaGenerator | None = None

    def __enter__(self) -> Self:  # type: ignore[override]  # ty: ignore[incompatible-method-override]
        super().__enter__()
        return self

    def __exit__(
        self,
        typ: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> Literal[False]:
        return super().__exit__(typ, exc, tb)
