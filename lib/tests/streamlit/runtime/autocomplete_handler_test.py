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

"""Unit tests for the autocomplete backend operation handler."""

from __future__ import annotations

import asyncio
import contextlib
import threading
import time
from typing import TYPE_CHECKING
from unittest.mock import patch

from streamlit.errors import StreamlitAPIException
from streamlit.proto.BackMsg_pb2 import BackendOperationRequest
from streamlit.runtime.autocomplete_handler import (
    _AUTOCOMPLETE_GLOBAL_PERMITS,
    _AUTOCOMPLETE_RATE_BURST,
    _GLOBAL_PERMITS,
    AutocompleteHandler,
)
from streamlit.runtime.autocomplete_source_manager import (
    AutocompleteSourceManager,
    RegisteredAutocompleteSource,
)
from streamlit.runtime.state.session_state_proxy import get_session_state

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

    from streamlit.proto.ForwardMsg_pb2 import BackendOperationResponse


def _setup(
    func: Callable[[str], Sequence[str]] | None = None,
    *,
    session_id: str = "s1",
    element_id: str = "el1",
) -> tuple[
    AutocompleteHandler, AutocompleteSourceManager, RegisteredAutocompleteSource
]:
    """Create a handler + manager with one registered source."""
    mgr = AutocompleteSourceManager()
    if func is None:

        def _suggest(text: str) -> list[str]:
            return [f"{text}-a", f"{text}-b"] if text else []

        func = _suggest
    with (
        patch(
            "streamlit.runtime.autocomplete_source_manager._get_session_id",
            return_value=session_id,
        ),
        patch(
            "streamlit.runtime.autocomplete_source_manager._get_fragment_id",
            return_value=None,
        ),
    ):
        reg = mgr.register_source(func, element_id=element_id, max_chars=None)
    handler = AutocompleteHandler(lambda: mgr)
    return handler, mgr, reg


def _build_request(
    reg: RegisteredAutocompleteSource, *, text: str = "ap", request_id: str = "r1"
) -> BackendOperationRequest:
    """Build an autocomplete request for a registered source."""
    request = BackendOperationRequest(
        request_id=request_id,
        session_id=reg.session_id,
    )
    request.autocomplete.source_id = reg.source_id
    request.autocomplete.text = text
    return request


def test_handle_returns_suggestions() -> None:
    """A valid request returns an autocomplete payload with suggestions."""
    handler, _mgr, reg = _setup()
    request = _build_request(reg)

    response = asyncio.run(handler.handle(request, reg.session_id))

    assert response.error_msg == ""
    assert response.HasField("autocomplete")
    payload = response.autocomplete
    assert payload.source_id == reg.source_id
    assert payload.text == "ap"
    assert list(payload.suggestions) == ["ap-a", "ap-b"]


def test_handle_unknown_source_returns_empty_without_error() -> None:
    """An unknown source id fails closed to an empty list with no error_msg."""
    handler, _mgr, reg = _setup()
    request = _build_request(reg)
    request.autocomplete.source_id = "missing"

    response = asyncio.run(handler.handle(request, reg.session_id))

    assert response.error_msg == ""
    assert list(response.autocomplete.suggestions) == []


def test_handle_wrong_session_returns_error() -> None:
    """A request from a different session is rejected with error_msg."""
    handler, _mgr, reg = _setup()
    request = _build_request(reg)

    response = asyncio.run(handler.handle(request, "other-session"))

    assert "does not belong" in response.error_msg
    assert not response.HasField("autocomplete")


def test_handle_source_exception_fails_closed() -> None:
    """A raising source returns [] with no error_msg and logs once per type."""

    def boom(_text: str) -> list[str]:
        raise RuntimeError("secret")

    handler, _mgr, reg = _setup(boom)
    request = _build_request(reg)

    with patch(
        "streamlit.runtime.autocomplete_handler._LOGGER.warning"
    ) as mock_warning:
        response = asyncio.run(handler.handle(request, reg.session_id))
        second = asyncio.run(handler.handle(request, reg.session_id))

    assert response.error_msg == ""
    assert list(response.autocomplete.suggestions) == []
    assert list(second.autocomplete.suggestions) == []
    assert mock_warning.call_count == 1


def test_handle_session_state_access_fails_closed_and_logs() -> None:
    """Reading st.session_state from a source fails closed and is logged once."""

    def reads_state(_text: str) -> list[str]:
        get_session_state()["k"] = "v"
        return ["x"]

    handler, _mgr, reg = _setup(reads_state)
    request = _build_request(reg)

    with patch(
        "streamlit.runtime.autocomplete_handler._LOGGER.warning"
    ) as mock_warning:
        response = asyncio.run(handler.handle(request, reg.session_id))

    assert response.error_msg == ""
    assert list(response.autocomplete.suggestions) == []
    assert mock_warning.call_count == 1
    log_msg = str(mock_warning.call_args)
    assert "session-state-in-backend-operation-worker" in log_msg


def test_handle_session_scoped_cache_error_names_cause() -> None:
    """A session-scoped cache error is logged with that cause named."""

    def uses_session_cache(_text: str) -> list[str]:
        raise StreamlitAPIException(
            "session-scoped cache",
            error_id="session-scoped-cache-outside-app-thread",
        )

    handler, _mgr, reg = _setup(uses_session_cache)
    request = _build_request(reg)

    with patch(
        "streamlit.runtime.autocomplete_handler._LOGGER.warning"
    ) as mock_warning:
        response = asyncio.run(handler.handle(request, reg.session_id))

    assert list(response.autocomplete.suggestions) == []
    log_msg = str(mock_warning.call_args)
    assert "session-scoped-cache-outside-app-thread" in log_msg


def test_handle_coalesces_identical_concurrent_requests() -> None:
    """Identical requests share one worker operation."""
    call_count = 0
    call_lock = threading.Lock()
    started = threading.Event()
    release = threading.Event()

    def slow_suggest(text: str) -> list[str]:
        nonlocal call_count
        with call_lock:
            call_count += 1
        started.set()
        release.wait(timeout=5)
        return [text]

    handler, _mgr, reg = _setup(slow_suggest)

    async def run_requests() -> list[BackendOperationResponse]:
        requests = [_build_request(reg, request_id=f"r{i}") for i in range(4)]
        tasks = [
            asyncio.create_task(handler.handle(request, reg.session_id))
            for request in requests
        ]
        for _ in range(100):
            if started.is_set():
                break
            await asyncio.sleep(0.01)
        assert started.is_set()
        release.set()
        return await asyncio.gather(*tasks)

    responses = asyncio.run(run_requests())

    assert call_count == 1
    assert all(response.error_msg == "" for response in responses)
    assert all(
        list(response.autocomplete.suggestions) == ["ap"] for response in responses
    )


def test_coalesced_waiter_timeout_does_not_cancel_the_other() -> None:
    """One coalesced waiter expiring does not cancel the shared lookup."""
    started = threading.Event()
    release = threading.Event()

    def slow_suggest(text: str) -> list[str]:
        started.set()
        release.wait(timeout=5)
        return [text]

    handler, _mgr, reg = _setup(slow_suggest)
    request = _build_request(reg)

    async def run() -> BackendOperationResponse:
        t1 = asyncio.create_task(handler.handle(request, reg.session_id))
        t2 = asyncio.create_task(handler.handle(request, reg.session_id))
        for _ in range(100):
            if started.is_set():
                break
            await asyncio.sleep(0.01)
        assert started.is_set()
        t1.cancel()
        release.set()
        with contextlib.suppress(asyncio.CancelledError):
            await t1
        return await t2

    response = asyncio.run(run())
    assert list(response.autocomplete.suggestions) == ["ap"]


def test_timed_out_waiter_does_not_release_permits_until_worker_exits() -> None:
    """A timed-out waiter does not free permits until the worker exits."""
    started = threading.Event()
    release = threading.Event()

    def hung(_text: str) -> list[str]:
        started.set()
        release.wait(timeout=10)
        return ["done"]

    handler, _mgr, reg = _setup(hung)

    async def timed_out_then_retry() -> tuple[
        BackendOperationResponse,
        BackendOperationResponse,
        BackendOperationResponse | None,
    ]:
        request_a = _build_request(reg, text="a")
        with patch(
            "streamlit.runtime.autocomplete_handler._AUTOCOMPLETE_TIMEOUT_S",
            0.05,
        ):
            first = await handler.handle(request_a, reg.session_id)
        for _ in range(100):
            if started.is_set():
                break
            await asyncio.sleep(0.01)
        assert started.is_set()
        # Distinct text so this cannot coalesce onto the hung task. The source
        # permit is still held by the hung worker.
        request_b = _build_request(reg, text="b")
        blocked = await handler.handle(request_b, reg.session_id)
        release.set()
        # Wait until the hung worker's finally has released permits.
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            request_c = _build_request(reg, text="c")
            third = await handler.handle(request_c, reg.session_id)
            if list(third.autocomplete.suggestions) == ["done"]:
                return first, blocked, third
            await asyncio.sleep(0.01)
        return first, blocked, None

    first, blocked, third = asyncio.run(timed_out_then_retry())
    assert list(first.autocomplete.suggestions) == []
    assert list(blocked.autocomplete.suggestions) == []
    assert third is not None
    assert list(third.autocomplete.suggestions) == ["done"]


def test_failed_admission_does_not_leak_permits() -> None:
    """Filling global permits fails closed and does not leak a permit."""
    handler, _mgr, reg = _setup()
    acquired = 0
    try:
        while _GLOBAL_PERMITS.acquire(blocking=False):
            acquired += 1
        assert acquired == _AUTOCOMPLETE_GLOBAL_PERMITS
        remaining_before = _GLOBAL_PERMITS._value
        response = asyncio.run(handler.handle(_build_request(reg), reg.session_id))
        assert response.error_msg == ""
        assert list(response.autocomplete.suggestions) == []
        assert _GLOBAL_PERMITS._value == remaining_before
    finally:
        for _ in range(acquired):
            _GLOBAL_PERMITS.release()


def test_failed_submit_does_not_leak_permits() -> None:
    """If executor.submit raises, already-acquired permits are released."""
    handler, _mgr, reg = _setup()
    remaining_before = _GLOBAL_PERMITS._value
    with patch("streamlit.runtime.autocomplete_handler._EXECUTOR") as mock_executor:
        mock_executor.submit.side_effect = RuntimeError("cannot submit")
        response = asyncio.run(handler.handle(_build_request(reg), reg.session_id))

    assert response.error_msg == ""
    assert list(response.autocomplete.suggestions) == []
    assert _GLOBAL_PERMITS._value == remaining_before


def test_rate_budget_exhaustion_fails_closed_then_refills() -> None:
    """More than the burst of distinct texts fails closed, then succeeds after refill."""
    handler, _mgr, reg = _setup()

    async def fire() -> list[BackendOperationResponse]:
        responses = []
        for i in range(_AUTOCOMPLETE_RATE_BURST + 1):
            request = _build_request(reg, text=f"t{i}", request_id=f"r{i}")
            responses.append(await handler.handle(request, reg.session_id))
        return responses

    with patch(
        "streamlit.runtime.autocomplete_handler._LOGGER.warning"
    ) as mock_warning:
        responses = asyncio.run(fire())

    assert all(r.error_msg == "" for r in responses)
    assert list(responses[-1].autocomplete.suggestions) == []
    assert any("rate" in str(call) for call in mock_warning.call_args_list)

    # Wait for at least one token to refill (4/s).
    time.sleep(0.3)
    later = asyncio.run(
        handler.handle(
            _build_request(reg, text="after", request_id="later"),
            reg.session_id,
        )
    )
    assert list(later.autocomplete.suggestions) == ["after-a", "after-b"]


def test_asyncio_timeout_error_fails_closed_without_source_log() -> None:
    """``asyncio.TimeoutError`` (Python 3.10) fails closed and is not a source error."""
    handler, _mgr, reg = _setup(lambda _text: ["x"])

    async def raise_timeout(*_args: object, **_kwargs: object) -> list[str]:
        raise asyncio.TimeoutError

    async def run() -> BackendOperationResponse:
        with patch(
            "streamlit.runtime.autocomplete_handler.asyncio.wait_for",
            raise_timeout,
        ):
            with patch(
                "streamlit.runtime.autocomplete_handler._LOGGER.warning"
            ) as mock_warning:
                response = await handler.handle(
                    _build_request(reg),
                    reg.session_id,
                )
                mock_warning.assert_not_called()
                return response

    response = asyncio.run(run())
    assert list(response.autocomplete.suggestions) == []
    assert response.error_msg == ""
