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


class TabContainer(DeltaGenerator):
    """A container returned for each tab in ``st.tabs``.

    ``TabContainer`` is a ``DeltaGenerator`` subclass with an additional
    ``.open`` property for lazy execution. Use ``with`` notation or call
    methods directly on the container to add elements to the tab.

    Attributes
    ----------
    open : bool or None
        Whether this tab is the currently active tab. This is ``True`` if this
        tab is active and ``False`` if it is inactive, or ``None`` if state
        tracking isn't enabled.

    Examples
    --------
    **Example 1: Lazy loading content**

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st
        import time

        tab1, tab2, tab3 = st.tabs(["Cat", "Dog", "Owl"], on_change="rerun")

        if tab1.open:
            with tab1:
                with st.spinner("Loading cat..."):
                    time.sleep(2)
                tab1.write("This is the cat")

        if tab2.open:
            with tab2:
                with st.spinner("Loading dog..."):
                    time.sleep(2)
                tab2.write("This is the dog")

        if tab3.open:
            with tab3:
                with st.spinner("Loading owl..."):
                    time.sleep(2)
                tab3.write("This is the owl")

    .. output::
        https://doc-tabs-lazy-load.streamlit.app/
        height: 350px

    **Example 2: Use the tab state inside a callback**

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st


        def on_tab_change():
            st.toast(f"You opened the {st.session_state.animal} tab.")


        tab1, tab2, tab3 = st.tabs(
            ["Cat", "Dog", "Owl"], on_change=on_tab_change, key="animal"
        )

        if tab1.open:
            with tab1:
                st.write("This is the cat")

        if tab2.open:
            with tab2:
                st.write("This is the dog")

        if tab3.open:
            with tab3:
                st.write("This is the owl")

    .. output::
        https://doc-tabs-callback.streamlit.app/
        height: 250px

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
        """Whether this tab is the currently active tab.

        Returns
        -------
        bool or None
            ``True`` if this tab is active, ``False`` if inactive, or ``None``
            if state tracking is not enabled (``on_change`` was not set or
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
