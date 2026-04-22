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

from unittest.mock import MagicMock

from streamlit.runtime.state.presentation import apply_presenter


def test_apply_presenter_non_callable_presenter() -> None:
    """Test that a non-callable presenter returns the base value."""
    mock_session_state = MagicMock()
    meta = MagicMock()
    meta.presenter = "not-callable"
    mock_session_state._get_widget_metadata.return_value = meta

    result = apply_presenter(mock_session_state, "widget-1", 42)
    assert result == 42


def test_apply_presenter_callable_raises() -> None:
    """Test that an exception in the presenter returns the base value."""
    mock_session_state = MagicMock()
    meta = MagicMock()
    meta.presenter = MagicMock(side_effect=RuntimeError("boom"))
    mock_session_state._get_widget_metadata.return_value = meta

    result = apply_presenter(mock_session_state, "widget-1", 99)
    assert result == 99


def test_apply_presenter_metadata_lookup_raises() -> None:
    """Test that an exception during metadata lookup returns the base value."""
    mock_session_state = MagicMock()
    mock_session_state._get_widget_metadata.side_effect = RuntimeError("no metadata")

    result = apply_presenter(mock_session_state, "widget-1", "fallback")
    assert result == "fallback"


def test_apply_presenter_successful_transform() -> None:
    """Test that a working presenter transforms the value."""
    mock_session_state = MagicMock()
    meta = MagicMock()
    meta.presenter = lambda val, _ss: val * 2
    mock_session_state._get_widget_metadata.return_value = meta

    result = apply_presenter(mock_session_state, "widget-1", 5)
    assert result == 10
