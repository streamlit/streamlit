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

"""Bottom container proxy with context restrictions."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from streamlit.delta_generator_singletons import context_dg_stack
from streamlit.errors import StreamlitAPIException
from streamlit.proto.RootContainer_pb2 import RootContainer

if TYPE_CHECKING:
    from types import TracebackType

    from streamlit.delta_generator import DeltaGenerator


class BottomContainerProxy:
    """Proxy for the bottom container that restricts usage to the main app area.

    Using st.bottom from within the sidebar, dialogs, or event containers
    raises an exception.
    """

    _bottom_dg: DeltaGenerator

    def __init__(self, bottom_dg: DeltaGenerator) -> None:
        # Use object.__setattr__ to avoid triggering __getattr__
        object.__setattr__(self, "_bottom_dg", bottom_dg)

    def _check_context(self) -> None:
        """Raise StreamlitAPIException if st.bottom is used in an invalid context."""
        current_stack = context_dg_stack.get()
        if not current_stack:
            return

        current_dg = current_stack[-1]
        root_container = current_dg._root_container

        if root_container == RootContainer.SIDEBAR:
            raise StreamlitAPIException(
                "`st.bottom` cannot be used inside `st.sidebar`. "
                "The bottom container is only available in the main app area."
            )
        # Check for dialog first since dialogs use EVENT root container
        # but should get a more specific error message
        if "dialog" in current_dg._ancestor_block_types:
            raise StreamlitAPIException(
                "`st.bottom` cannot be used inside a dialog. "
                "The bottom container is only available in the main app area."
            )
        if root_container == RootContainer.EVENT:
            raise StreamlitAPIException(
                "`st.bottom` cannot be used inside event containers. "
                "The bottom container is only available in the main app area."
            )

    def __getattr__(self, name: str) -> Any:
        self._check_context()
        return getattr(self._bottom_dg, name)

    def __dir__(self) -> list[str]:
        """Return DeltaGenerator methods for IDE autocompletion."""
        return dir(self._bottom_dg)

    def __enter__(self) -> None:
        self._check_context()
        self._bottom_dg.__enter__()

    def __exit__(
        self,
        typ: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> bool:
        return self._bottom_dg.__exit__(typ, exc, tb)
