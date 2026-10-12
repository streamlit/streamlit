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

"""Tests for the BidiComponentManager accessor."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from streamlit.components.v2.component_manager import BidiComponentManager
from streamlit.components.v2.get_bidi_component_manager import (
    get_bidi_component_manager,
)


def test_get_bidi_component_manager_without_runtime() -> None:
    """A local manager is created when no Streamlit runtime is running."""
    with patch("streamlit.runtime.Runtime.exists", return_value=False):
        manager = get_bidi_component_manager()
    assert isinstance(manager, BidiComponentManager)


def test_get_bidi_component_manager_uses_runtime_registry() -> None:
    """The runtime's registered manager is returned when a runtime exists."""
    runtime = MagicMock()
    runtime.bidi_component_registry = BidiComponentManager()
    with (
        patch("streamlit.runtime.Runtime.exists", return_value=True),
        patch("streamlit.runtime.Runtime.instance", return_value=runtime),
    ):
        assert get_bidi_component_manager() is runtime.bidi_component_registry
