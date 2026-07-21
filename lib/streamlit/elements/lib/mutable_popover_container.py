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

from typing import TYPE_CHECKING, Literal

from typing_extensions import Self

from streamlit.delta_generator import DeltaGenerator

if TYPE_CHECKING:
    from types import TracebackType

    from streamlit.cursor import Cursor


class PopoverContainer(DeltaGenerator):
    """A container returned by ``st.popover``.

    ``PopoverContainer`` is a Streamlit container with an ``.open`` property
    for lazy execution. Use ``with`` notation or call methods directly on the
    container to add elements to the popover.

    Attributes
    ----------
    open : bool or None
        Whether the popover is open. This is ``True`` if the popover is open
        and ``False`` if it's closed, or ``None`` if state tracking isn't
        enabled.

    Examples
    --------
    **Example 1: Lazy loading content**

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st
        import time

        drawer = st.popover("Open popover", on_change="rerun")
        with drawer:
            if drawer.open:
                with st.spinner("Loading popover..."):
                    time.sleep(2)
                st.write("This is the popover")

    .. output::
        https://doc-popover-lazy-load.streamlit.app/
        height: 300px

    **Example 2: Conditionally render content outside of the popover**

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        drawer = st.popover("Open popover", on_change="rerun")
        with drawer:
            st.write("This is the popover")

        st.space("large")
        st.write(f"The popover is {':green[open]' if drawer.open else ':red[closed]'}.")

    .. output::
        https://doc-popover-conditional-outside.streamlit.app/
        height: 300px

    """

    def __init__(
        self,
        root_container: int | None,
        cursor: Cursor | None,
        parent: DeltaGenerator | None,
        block_type: str | None,
    ) -> None:
        super().__init__(root_container, cursor, parent, block_type)
        self._open: bool | None = None

    @property
    def open(self) -> bool | None:
        """The open/closed state of the popover.

        Returns
        -------
        bool or None
            ``True`` if open, ``False`` if closed, or ``None`` if state
            tracking is not enabled (``on_change`` was not set or set to
            ``"ignore"``).
        """
        return self._open

    @open.setter  # noqa: A003
    def open(self, value: bool | None) -> None:
        self._open = value

    def __enter__(self) -> Self:  # type: ignore[override]
        super().__enter__()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> Literal[False]:
        return super().__exit__(exc_type, exc_val, exc_tb)
