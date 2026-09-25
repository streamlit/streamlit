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

"""Unit tests for load-test server startup retry."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from e2e_playwright.load_testing import conftest as load_testing_conftest
from e2e_playwright.load_testing.conftest import start_healthy_load_test_server


def test_start_healthy_load_test_server_retries_on_new_port(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Retry startup on a newly chosen port after a failed health check."""
    ports = iter([42_001, 42_002])
    wait_ports: list[int] = []
    started: list[MagicMock] = []

    monkeypatch.setattr(
        load_testing_conftest, "find_available_port", lambda: next(ports)
    )

    def fake_start(*_args: object, **_kwargs: object) -> MagicMock:
        process = MagicMock()
        started.append(process)
        return process

    def fake_wait(port: int, *_args: object, **_kwargs: object) -> bool:
        wait_ports.append(port)
        return port == 42_002

    monkeypatch.setattr(load_testing_conftest, "start_load_test_server", fake_start)
    monkeypatch.setattr(load_testing_conftest, "wait_for_server", fake_wait)

    process, port = start_healthy_load_test_server(Path("caching_app.py"))

    assert wait_ports == [42_001, 42_002]
    assert port == 42_002
    assert process is started[1]
    started[0].terminate.assert_called_once()
    started[1].terminate.assert_not_called()


def test_start_healthy_load_test_server_fails_after_all_attempts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fail only after every start attempt's health check misses."""
    ports = iter([42_001, 42_002, 42_003])
    wait_ports: list[int] = []

    def fake_wait(port: int, *_args: object, **_kwargs: object) -> bool:
        wait_ports.append(port)
        return False

    monkeypatch.setattr(
        load_testing_conftest, "find_available_port", lambda: next(ports)
    )
    monkeypatch.setattr(
        load_testing_conftest,
        "start_load_test_server",
        lambda *_args, **_kwargs: MagicMock(),
    )
    monkeypatch.setattr(load_testing_conftest, "wait_for_server", fake_wait)

    with pytest.raises(RuntimeError, match=r"ports: \[42001, 42002, 42003\]"):
        start_healthy_load_test_server(Path("caching_app.py"))

    assert wait_ports == [42_001, 42_002, 42_003]
