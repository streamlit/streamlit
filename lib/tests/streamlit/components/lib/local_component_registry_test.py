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

"""Unit tests for streamlit.components.lib.local_component_registry."""

from __future__ import annotations

from streamlit.components.lib.local_component_registry import LocalComponentRegistry


def test_repr_contains_class_name() -> None:
    """The registry repr includes its class name for debugging."""
    assert "LocalComponentRegistry" in repr(LocalComponentRegistry())


def test_get_component_returns_none_for_unregistered_name() -> None:
    """Return None when requesting a component that was never registered."""
    registry = LocalComponentRegistry()
    assert registry.get_component("does_not_exist") is None
