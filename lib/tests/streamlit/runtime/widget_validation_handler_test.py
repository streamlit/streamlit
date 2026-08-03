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

"""Unit tests for the server-side widget validation backend operation handler."""

from __future__ import annotations

import asyncio
import time
from typing import TYPE_CHECKING
from unittest.mock import patch

from streamlit.proto.BackMsg_pb2 import BackendOperationRequest
from streamlit.runtime.widget_validation_handler import WidgetValidationHandler
from streamlit.runtime.widget_validator_manager import WidgetValidatorManager

if TYPE_CHECKING:
    from collections.abc import Callable


def _setup(
    validator: Callable[[str], bool | str],
    *,
    session_id: str = "s1",
) -> tuple[WidgetValidationHandler, WidgetValidatorManager, str]:
    """Create a handler + manager with one registered validator."""
    mgr = WidgetValidatorManager()
    with patch(
        "streamlit.runtime.widget_validator_manager._get_session_id",
        return_value=session_id,
    ):
        validator_id = mgr.register_validator(validator, "1.0.0")
    handler = WidgetValidationHandler(lambda: mgr)
    return handler, mgr, validator_id


def _build_request(
    validator_id: str, value: str, *, session_id: str = "s1"
) -> BackendOperationRequest:
    """Build a widget_validation request for a registered validator."""
    request = BackendOperationRequest(request_id="r1", session_id=session_id)
    request.widget_validation.validator_id = validator_id
    request.widget_validation.value = value
    return request


def test_handle_valid_value() -> None:
    """A value the validator accepts returns is_valid=True."""
    handler, _mgr, validator_id = _setup(lambda value: len(value) > 2)
    request = _build_request(validator_id, "hello")

    response = asyncio.run(handler.handle(request, "s1"))

    assert response.error_msg == ""
    assert response.HasField("widget_validation")
    assert response.widget_validation.is_valid is True
    assert response.widget_validation.error_message == ""


def test_handle_invalid_value_generic() -> None:
    """A False return returns is_valid=False with an empty (generic) message."""
    handler, _mgr, validator_id = _setup(lambda _value: False)
    request = _build_request(validator_id, "x")

    response = asyncio.run(handler.handle(request, "s1"))

    assert response.widget_validation.is_valid is False
    assert response.widget_validation.error_message == ""


def test_handle_invalid_value_custom_message() -> None:
    """A string return returns is_valid=False with that custom message."""
    handler, _mgr, validator_id = _setup(lambda _value: "Username taken.")
    request = _build_request(validator_id, "admin")

    response = asyncio.run(handler.handle(request, "s1"))

    assert response.widget_validation.is_valid is False
    assert response.widget_validation.error_message == "Username taken."


def test_handle_exception_is_generic_and_not_leaked() -> None:
    """A raising validator yields a generic invalid response without leaking details."""

    def boom(_value: str) -> bool:
        raise ValueError("secret internal detail")

    handler, _mgr, validator_id = _setup(boom)
    request = _build_request(validator_id, "x")

    response = asyncio.run(handler.handle(request, "s1"))

    assert response.widget_validation.is_valid is False
    assert "secret internal detail" not in response.widget_validation.error_message
    assert "secret internal detail" not in response.error_msg


def test_handle_unknown_validator_fails_closed() -> None:
    """An unknown validator id yields an invalid response rather than accepting."""
    handler, _mgr, _validator_id = _setup(lambda _value: True)
    request = _build_request("does-not-exist", "x")

    response = asyncio.run(handler.handle(request, "s1"))

    assert response.widget_validation.is_valid is False


def test_handle_wrong_session_fails_closed() -> None:
    """A request from a different session is rejected."""
    handler, _mgr, validator_id = _setup(lambda _value: True, session_id="s1")
    request = _build_request(validator_id, "x", session_id="other")

    response = asyncio.run(handler.handle(request, "other"))

    assert response.widget_validation.is_valid is False


def test_handle_timeout_returns_timeout_message() -> None:
    """A validator exceeding the timeout budget returns a timeout error message."""

    def slow(_value: str) -> bool:
        time.sleep(0.5)
        return True

    handler, _mgr, validator_id = _setup(slow)
    request = _build_request(validator_id, "x")

    # Patch the timeout to a tiny value so the slow validator trips it quickly.
    with patch(
        "streamlit.runtime.widget_validation_handler._VALIDATION_TIMEOUT_SECONDS",
        0.05,
    ):
        response = asyncio.run(handler.handle(request, "s1"))

    assert response.widget_validation.is_valid is False
    assert response.widget_validation.error_message
    assert "timed out" in response.widget_validation.error_message.lower()
