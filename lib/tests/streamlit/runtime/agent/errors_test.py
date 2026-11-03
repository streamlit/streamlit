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

"""The agent API's error catalog and the error a refused request raises."""

from __future__ import annotations

from typing import Final, get_args

import pytest

from streamlit.runtime.agent import errors

_EXPECTED_STATUSES: Final[dict[errors.AgentErrorCode, int]] = {
    "invalid_request": 400,
    "request_too_large": 413,
    "invalid_value": 400,
    "not_a_value": 400,
    "not_a_trigger": 400,
    "missing_form_submit": 400,
    "cross_dialog_batch": 400,
    "cross_form_batch": 400,
    "unsupported_element": 400,
    "unknown_key": 404,
    "unknown_session": 404,
    "unknown_page": 404,
    "not_on_page": 409,
    "disabled_widget": 409,
    "session_busy": 409,
    "wait_timed_out": 202,
    "internal_error": 500,
    "not_available": 403,
    "host_not_allowed": 403,
    "origin_not_allowed": 403,
    "too_many_sessions": 429,
}


def test_catalog_lists_exactly_the_error_codes() -> None:
    """The catalog, the code literal, and the expected codes are the same set."""
    codes = set(get_args(errors.AgentErrorCode))

    assert set(errors.ERROR_CATALOG) == codes
    assert set(_EXPECTED_STATUSES) == codes
    for _, meaning in errors.ERROR_CATALOG.values():
        assert meaning
        assert "\n" not in meaning


@pytest.mark.parametrize(("code", "status"), _EXPECTED_STATUSES.items())
def test_error_status(code: errors.AgentErrorCode, status: int) -> None:
    """Each code answers with its catalog status."""
    assert errors.error_status(code) == status


def test_error_status_raises_for_an_unknown_code() -> None:
    """A code missing from the catalog is a bug, not a default 400."""
    with pytest.raises(KeyError):
        errors.error_status("not_a_code")  # type: ignore[arg-type]


def test_agent_request_error_carries_its_fields() -> None:
    """The error keeps its code, message, handle, and details."""
    error = errors.AgentRequestError(
        "unknown_page",
        "No page has that url_path.",
        session_id="s_0123",
        details={"pages": [{"url_path": ""}]},
    )

    assert str(error) == "No page has that url_path."
    assert error.code == "unknown_page"
    assert error.message == "No page has that url_path."
    assert error.session_id == "s_0123"
    assert error.details == {"pages": [{"url_path": ""}]}


def test_agent_request_error_defaults() -> None:
    """Without a handle or details, the error carries None and an empty dict."""
    error = errors.AgentRequestError("session_busy", "Busy.")

    assert error.session_id is None
    assert error.details == {}


def test_mcp_catalog_lists_only_codes_no_http_route_returns() -> None:
    """The MCP-only codes are their literal's, apart from the HTTP catalog,
    and each has a one-line meaning.
    """
    codes = set(get_args(errors.McpErrorCode))

    assert set(errors.MCP_ERROR_CATALOG) == codes
    assert codes.isdisjoint(errors.ERROR_CATALOG)
    for meaning in errors.MCP_ERROR_CATALOG.values():
        assert meaning
        assert "\n" not in meaning


def test_error_body_carries_details_and_the_session_only_when_given() -> None:
    """Details join the error object, and `session_id` sits beside it."""
    bare = errors.error_body("unknown_file", "Gone.")
    full = errors.error_body(
        "unknown_page", "No page.", session_id="s_1", details={"pages": []}
    )

    assert bare == {"error": {"code": "unknown_file", "message": "Gone."}}
    assert full == {
        "error": {"code": "unknown_page", "message": "No page.", "pages": []},
        "session_id": "s_1",
    }
