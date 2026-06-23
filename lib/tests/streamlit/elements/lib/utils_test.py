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

"""Unit tests for lib/streamlit/elements/lib/utils.py."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from streamlit.elements.lib import utils
from streamlit.proto.ChatInput_pb2 import ChatInput
from streamlit.proto.LabelVisibility_pb2 import LabelVisibility as LabelVisibilityProto
from streamlit.runtime.scriptrunner_utils.shared_run_state import SharedRunState
from streamlit.runtime.state.common import TESTING_KEY


@pytest.mark.parametrize(
    ("input_value", "expected"),
    [
        ("visible", LabelVisibilityProto.LabelVisibilityOptions.VISIBLE),
        ("hidden", LabelVisibilityProto.LabelVisibilityOptions.HIDDEN),
        ("collapsed", LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED),
    ],
)
def test_get_label_visibility_proto_value(input_value: str, expected: int) -> None:
    """Verify label visibility string maps to correct proto value."""
    assert utils.get_label_visibility_proto_value(input_value) == expected  # type: ignore[arg-type]


def test_get_label_visibility_proto_value_invalid() -> None:
    """Verify invalid label visibility raises ValueError."""
    with pytest.raises(ValueError, match="Unknown label visibility value"):
        utils.get_label_visibility_proto_value("invalid")  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("input_value", "expected"),
    [
        (False, ChatInput.AcceptFile.NONE),
        (True, ChatInput.AcceptFile.SINGLE),
        ("multiple", ChatInput.AcceptFile.MULTIPLE),
        ("directory", ChatInput.AcceptFile.DIRECTORY),
    ],
)
def test_get_chat_input_accept_file_proto_value(
    input_value: bool | str, expected: int
) -> None:
    """Verify accept_file value maps to correct proto value."""
    assert utils.get_chat_input_accept_file_proto_value(input_value) == expected  # type: ignore[arg-type]


def test_get_chat_input_accept_file_proto_value_invalid() -> None:
    """Verify invalid accept_file value raises ValueError."""
    with pytest.raises(ValueError, match="Unknown accept file value"):
        utils.get_chat_input_accept_file_proto_value("invalid")  # type: ignore[arg-type]


@pytest.mark.parametrize("element_id", ["", None])
def test_register_element_id_falsy_returns_early(element_id: Any) -> None:
    """Verify falsy element_id returns without registering."""
    mock_ctx = MagicMock()
    mock_ctx.shared = SharedRunState()

    utils._register_element_id(mock_ctx, "test_element", element_id)

    assert len(mock_ctx.shared.widget_user_keys_this_run.snapshot()) == 0
    assert len(mock_ctx.shared.widget_ids_this_run.snapshot()) == 0


@patch("streamlit.elements.lib.utils.config.get_option")
def test_save_for_app_testing_creates_dict_on_key_error(
    mock_get_option: MagicMock,
) -> None:
    """Verify KeyError path creates new TESTING_KEY dict."""
    mock_get_option.return_value = True
    mock_session_state: dict[str, Any] = {}

    mock_ctx = MagicMock()
    mock_ctx.session_state = mock_session_state

    utils.save_for_app_testing(mock_ctx, "test_key", "test_value")

    assert mock_session_state[TESTING_KEY] == {"test_key": "test_value"}


@patch("streamlit.elements.lib.utils.config.get_option")
def test_save_for_app_testing_appends_to_existing(mock_get_option: MagicMock) -> None:
    """Verify value is appended when TESTING_KEY already exists."""
    mock_get_option.return_value = True
    mock_session_state: dict[str, Any] = {
        TESTING_KEY: {"existing_key": "existing_value"}
    }

    mock_ctx = MagicMock()
    mock_ctx.session_state = mock_session_state

    utils.save_for_app_testing(mock_ctx, "new_key", "new_value")

    assert mock_session_state[TESTING_KEY] == {
        "existing_key": "existing_value",
        "new_key": "new_value",
    }


class _NoAccessDict(dict[str, Any]):
    """A dict subclass that raises AssertionError on any access."""

    def __getitem__(self, key: str) -> Any:
        raise AssertionError("Should not access session_state")

    def __setitem__(self, key: str, value: Any) -> None:
        raise AssertionError("Should not access session_state")


@patch("streamlit.elements.lib.utils.config.get_option")
def test_save_for_app_testing_noop_when_disabled(mock_get_option: MagicMock) -> None:
    """Verify nothing happens when global.appTest is False."""
    mock_get_option.return_value = False

    mock_ctx = MagicMock()
    mock_ctx.session_state = _NoAccessDict()

    utils.save_for_app_testing(mock_ctx, "key", "value")  # Should not raise
