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

# Keep Attributes before Examples in API docstrings.

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from typing_extensions import Self

from streamlit.delta_generator import DeltaGenerator

if TYPE_CHECKING:
    from types import TracebackType

    from streamlit.cursor import Cursor


class ExpanderContainer(DeltaGenerator):
    """A container returned by ``st.expander``.

    ``ExpanderContainer`` is a Streamlit container with an ``.open`` property
    for lazy execution. Use ``with`` notation or call methods directly on the
    container to add elements to the expander.

    Attributes
    ----------
    open : bool or None
        Whether the expander is open. This is ``True`` if the expander is open
        and ``False`` if it's collapsed, or ``None`` if state tracking isn't
        enabled.

    Examples
    --------
    **Example 1: Lazy loading content**

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st
        import time

        summary = st.expander("Summary", on_change="rerun")

        if summary.open:
            with summary:
                with st.spinner("Loading summary..."):
                    time.sleep(2)
                st.write("This is the summary")

    .. output::
        https://doc-expander-lazy-load.streamlit.app/
        height: 300px

    **Example 2: Conditionally render content outside of the expander**

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        summary = st.expander("Summary", on_change="rerun")
        with summary:
            st.write("This is the summary")

        st.write(
            f"The expander is {':green[open]' if summary.open else ':red[closed]'}."
        )

    .. output::
        https://doc-expander-conditional-outside.streamlit.app/
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
        """The open/collapsed state of the expander.

        Returns
        -------
        bool or None
            ``True`` if expanded, ``False`` if collapsed, or ``None`` if
            state tracking is not enabled (``on_change`` was not set or
            set to ``"ignore"``).
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
