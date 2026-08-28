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

"""Regression tests for FIPS-friendly internal hashing."""

from __future__ import annotations

import contextlib
import hashlib
import inspect
import os
import socket
import subprocess
import sys
import time
import urllib.request
from typing import TYPE_CHECKING, Any, NoReturn

import pytest
from websockets.sync.client import connect

from streamlit import util
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ClientState_pb2 import ClientState
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.caching.cache_utils import _make_function_key, _make_value_key
from streamlit.runtime.memory_media_file_storage import _calculate_file_id
from streamlit.watcher.util import calc_hash_with_blocking_retries

if TYPE_CHECKING:
    from pathlib import Path

_STREAMLIT_SERVER_STARTUP_TIMEOUT_SECS = 30
# Deadline for the WebSocket smoke session (rerun request to script finish),
# kept separate from the server-startup timeout so each reads independently.
_FIPS_SMOKE_SESSION_TIMEOUT_SECS = 30
# Number of times to retry starting the server on a fresh port, guarding against
# the small window where the chosen port is claimed between selection and bind.
_SERVER_START_ATTEMPTS = 3
_FIPS_SMOKE_MARKER = "FIPS runtime guard and WebSocket smoke test passed"
_REJECT_BLAKE2_DIGEST_SIZE_ENV = "STREAMLIT_TEST_REJECT_BLAKE2_DIGEST_SIZE"
_FIPS_HASHLIB_SITE_CUSTOMIZE = """
from __future__ import annotations

import functools
import hashlib
import os

# SHA-1 stays available because OpenSSL's FIPS provider exposes it and the
# WebSocket handshake requires it. Ruff separately prevents new Streamlit uses.
FIPS_RESTRICTED_ALGORITHMS = {"md5", "blake2b", "blake2s"}
REJECT_BLAKE2_DIGEST_SIZE = os.environ.get(
    "__FIPS_REJECT_ENV__"
) == "1"


def guard_algorithm(name, original):
    @functools.wraps(original)
    def guarded(*args, **kwargs):
        if kwargs.get("usedforsecurity", True) is not False:
            raise ValueError(f"FIPS mode blocks {name} for security use")
        if name == "blake2b" and REJECT_BLAKE2_DIGEST_SIZE and "digest_size" in kwargs:
            raise ValueError("FIPS provider rejects a custom BLAKE2b digest size")

        return original(*args, **kwargs)

    return guarded


for algorithm in FIPS_RESTRICTED_ALGORITHMS:
    if hasattr(hashlib, algorithm):
        setattr(hashlib, algorithm, guard_algorithm(algorithm, getattr(hashlib, algorithm)))

original_new = hashlib.new


def guarded_new(name, *args, **kwargs):
    if name.lower() in FIPS_RESTRICTED_ALGORITHMS and kwargs.get("usedforsecurity", True) is not False:
        raise ValueError(f"FIPS mode blocks {name} for security use")

    return original_new(name, *args, **kwargs)


hashlib.new = guarded_new
""".replace("__FIPS_REJECT_ENV__", _REJECT_BLAKE2_DIGEST_SIZE_ENV)


@pytest.mark.parametrize(
    "blake2b_error",
    [None, TypeError, ValueError],
    ids=["blake2b", "md5-fallback-type-error", "md5-fallback-value-error"],
)
def test_internal_hashing_uses_non_security_hashes(
    blake2b_error: type[Exception] | None,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """Fail if internal cache, media, or watcher hashing omits
    ``usedforsecurity=False`` under FIPS-like BLAKE2b/MD5 restrictions."""
    real_blake2b = hashlib.blake2b
    real_new = hashlib.new
    blake2b_call_count = 0
    md5_call_count = 0

    def fips_blake2b(*args: Any, **kwargs: Any) -> Any:
        nonlocal blake2b_call_count
        blake2b_call_count += 1
        if kwargs.get("usedforsecurity", True) is not False:
            raise ValueError("FIPS mode blocks BLAKE2b for security use")
        if blake2b_error is not None and "digest_size" in kwargs:
            raise blake2b_error("FIPS provider rejects a custom BLAKE2b digest size")

        return real_blake2b(*args, **kwargs)

    def fips_new(name: str, *args: Any, **kwargs: Any) -> Any:
        nonlocal md5_call_count
        if name.lower() == "md5":
            md5_call_count += 1
            if kwargs.get("usedforsecurity", True) is not False:
                raise ValueError("FIPS mode blocks MD5 for security use")

        return real_new(name, *args, **kwargs)

    monkeypatch.setattr(hashlib, "blake2b", fips_blake2b)
    monkeypatch.setattr(hashlib, "new", fips_new)

    assert util.calc_hash("streamlit") == util.calc_hash(b"streamlit")

    def cached_func(value: int) -> int:
        return value

    assert _make_function_key(CacheType.DATA, cached_func)
    assert _make_value_key(
        CacheType.DATA,
        cached_func,
        func_args=({"value": [1, 2, 3]},),
        func_kwargs={},
        hash_funcs=None,
    )
    assert _calculate_file_id(b"media-data", "text/plain", "media.txt")

    watched_file = tmp_path / "watched.py"
    watched_file.write_text("print('changed')", encoding="utf-8")

    assert calc_hash_with_blocking_retries(str(watched_file))
    assert blake2b_call_count > 0
    if blake2b_error is None:
        assert md5_call_count == 0  # BLAKE2b succeeded, so no MD5 fallback.
    else:
        assert md5_call_count > 0  # BLAKE2b was rejected, so we fell back to MD5.


def test_wait_for_streamlit_health_retries_socket_timeout(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Retry when urllib raises a raw ``TimeoutError`` instead of ``URLError``.

    A 1s socket timeout during ``getresponse()``/``read()`` is
    ``TimeoutError("timed out")`` and is not wrapped in ``URLError``. That is
    the failure this smoke test flakes with under CI load if the health poll
    does not catch it.
    """

    class _AliveProcess:
        def poll(self) -> None:
            return None

    class _OkResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return b"ok"

    calls = {"n": 0}

    def fake_open(_url: str, timeout: float = 1) -> _OkResponse:
        calls["n"] += 1
        if calls["n"] < 3:
            raise TimeoutError("timed out")
        return _OkResponse()

    class _FakeOpener:
        open = staticmethod(fake_open)

    monkeypatch.setattr(
        urllib.request, "build_opener", lambda *_args, **_kwargs: _FakeOpener()
    )
    monkeypatch.setattr(time, "sleep", lambda _seconds: None)

    log_path = tmp_path / "streamlit_server.log"
    log_path.write_text("", encoding="utf-8")
    process: Any = _AliveProcess()
    assert _wait_for_streamlit_health(process, 12345, log_path) is True
    assert calls["n"] == 3


@pytest.mark.parametrize("reject_blake2_digest_size", [False, True])
def test_streamlit_run_serves_app_when_fips_rejects_security_hashes(
    reject_blake2_digest_size: bool, tmp_path: Path
) -> None:
    """Run a Streamlit session under FIPS-like hash restrictions."""
    (tmp_path / "sitecustomize.py").write_text(
        _FIPS_HASHLIB_SITE_CUSTOMIZE, encoding="utf-8"
    )

    app_path = tmp_path / "fips_smoke_app.py"
    app_path.write_text(
        f"""\
import hashlib

import streamlit as st
from streamlit import util

try:
    hashlib.md5(b"blocked")
except ValueError:
    pass
else:
    raise RuntimeError("FIPS runtime guard was not installed")

hashlib.md5(b"allowed", usedforsecurity=False)
assert util.calc_hash("exercise the Streamlit hasher")
st.write("{_FIPS_SMOKE_MARKER}")
""",
        encoding="utf-8",
    )

    env = os.environ.copy()
    python_path = env.get("PYTHONPATH")
    env["PYTHONPATH"] = (
        f"{tmp_path}{os.pathsep}{python_path}" if python_path else str(tmp_path)
    )
    env[_REJECT_BLAKE2_DIGEST_SIZE_ENV] = "1" if reject_blake2_digest_size else "0"
    # Disable stdout/stderr buffering so the redirected server log is populated
    # promptly, keeping failure diagnostics from looking empty under buffering.
    env["PYTHONUNBUFFERED"] = "1"

    # The server output is sent to a log file rather than a pipe so that reading
    # it for diagnostics never blocks and a chatty server cannot deadlock on a
    # full pipe buffer while we poll for health.
    log_path = tmp_path / "streamlit_server.log"
    process, port = _start_streamlit_server(app_path, env, log_path)
    try:
        _run_streamlit_websocket_session(port, log_path)
    finally:
        _terminate(process)


def _start_streamlit_server(
    app_path: Path, env: dict[str, str], log_path: Path
) -> tuple[subprocess.Popen[str], int]:
    """Start ``streamlit run`` and return the process once it is healthy."""
    last_output = ""
    for _attempt in range(_SERVER_START_ATTEMPTS):
        port = _get_free_tcp_port()
        with log_path.open("w", encoding="utf-8") as log_file:
            process = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "streamlit",
                    "run",
                    str(app_path),
                    "--server.headless=true",
                    f"--server.port={port}",
                    "--browser.gatherUsageStats=false",
                    "--global.developmentMode=false",
                ],
                env=env,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                text=True,
            )

        if _wait_for_streamlit_health(process, port, log_path):
            return process, port

        # The server exited before becoming healthy (most likely the port was
        # taken between selection and bind); capture its output and retry.
        last_output = log_path.read_text(encoding="utf-8", errors="replace")
        _terminate(process)

    pytest.fail(
        f"Streamlit did not become healthy after {_SERVER_START_ATTEMPTS} "
        f"attempts.\nLast output:\n{last_output}"
    )


def _run_streamlit_websocket_session(port: int, log_path: Path) -> None:
    """Drive a rerun over the WebSocket and assert the smoke session succeeds.

    Sends a ``BackMsg`` rerun request, then asserts that the app emits the
    smoke-marker markdown and a ``FINISHED_SUCCESSFULLY`` script status.
    """
    websocket_url = f"ws://127.0.0.1:{port}/_stcore/stream"
    rerun_request = BackMsg(rerun_script=ClientState()).SerializeToString()
    deadline = time.monotonic() + _FIPS_SMOKE_SESSION_TIMEOUT_SECS
    connect_kwargs: dict[str, Any] = {
        "subprotocols": ["streamlit"],
        # Generous close timeout so teardown cannot fail a completed session
        # when the server is still flushing under FIPS hash-fallback load.
        "close_timeout": 10,
        # This is a short smoke test; disable client pings so keepalive
        # timeouts cannot surface as a raw ``TimeoutError: timed out``.
        "ping_interval": None,
    }
    # websockets>=13 honors HTTP_PROXY by default. Force direct loopback,
    # matching the health check's ProxyHandler({}). websockets 12 (min-deps)
    # has no proxy argument and forwards unknown kwargs to create_connection.
    if "proxy" in inspect.signature(connect).parameters:
        connect_kwargs["proxy"] = None

    websocket = None
    last_connect_error: BaseException | None = None
    while time.monotonic() < deadline:
        try:
            websocket = connect(
                websocket_url,
                open_timeout=max(0.1, deadline - time.monotonic()),
                **connect_kwargs,
            )
            break
        except (TimeoutError, OSError, ConnectionError) as ex:
            last_connect_error = ex
            time.sleep(0.2)

    if websocket is None:
        _fail_with_server_log(
            log_path,
            f"Timed out opening the FIPS smoke WebSocket at {websocket_url}. "
            f"Last error: {last_connect_error!r}",
        )

    saw_smoke_marker = False
    try:
        websocket.send(rerun_request)
        while time.monotonic() < deadline:
            try:
                payload = websocket.recv(timeout=max(0.1, deadline - time.monotonic()))
            except TimeoutError:
                _fail_with_server_log(
                    log_path,
                    "Timed out waiting for the FIPS smoke app's messages",
                )
            assert isinstance(payload, bytes)

            forward_msg = ForwardMsg.FromString(payload)
            if (
                forward_msg.HasField("delta")
                and forward_msg.delta.HasField("new_element")
                and forward_msg.delta.new_element.HasField("markdown")
                and forward_msg.delta.new_element.markdown.body == _FIPS_SMOKE_MARKER
            ):
                saw_smoke_marker = True

            if forward_msg.WhichOneof("type") == "script_finished":
                assert forward_msg.script_finished == ForwardMsg.FINISHED_SUCCESSFULLY
                break
        else:
            _fail_with_server_log(
                log_path, "Streamlit did not finish the FIPS smoke app"
            )
    finally:
        # Close is best-effort: a close-handshake timeout must not replace a
        # real session failure (or fail a session that already succeeded).
        with contextlib.suppress(Exception):
            websocket.close()

    if not saw_smoke_marker:
        _fail_with_server_log(log_path, "The FIPS runtime canaries did not complete")


def _wait_for_streamlit_health(
    process: subprocess.Popen[str], port: int, log_path: Path
) -> bool:
    """Poll the health endpoint until it returns 'ok'.

    Returns ``False`` if the process exits early; calls ``pytest.fail`` on
    timeout after terminating the still-running server.
    """
    deadline = time.monotonic() + _STREAMLIT_SERVER_STARTUP_TIMEOUT_SECS
    health_url = f"http://127.0.0.1:{port}/_stcore/health"
    # Bypass any configured proxy so the loopback request is not routed away.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    last_error: BaseException | None = None

    while time.monotonic() < deadline:
        if process.poll() is not None:
            return False

        try:
            with opener.open(health_url, timeout=1) as response:
                if response.read().decode("utf-8") == "ok":
                    return True
        except OSError as ex:
            # urllib wraps connect/send failures in URLError (an OSError). A
            # 1s socket timeout during getresponse()/read() can also raise
            # TimeoutError("timed out") directly. Catch both so a slow
            # response retries until the startup deadline instead of failing
            # the test with an uncaught TimeoutError.
            last_error = ex

        time.sleep(0.2)

    # Tear down the still-running server so a timeout does not leak a live
    # child process into subsequent tests.
    _terminate(process)
    output = log_path.read_text(encoding="utf-8", errors="replace")
    pytest.fail(
        f"Streamlit did not serve {health_url} within "
        f"{_STREAMLIT_SERVER_STARTUP_TIMEOUT_SECS} seconds.\n"
        f"Last error: {last_error!r}\n"
        f"Output:\n{output}"
    )


def _fail_with_server_log(log_path: Path, message: str) -> NoReturn:
    """Fail the test, appending the Streamlit server log for diagnostics."""
    output = log_path.read_text(encoding="utf-8", errors="replace")
    pytest.fail(f"{message}\nOutput:\n{output}")


def _terminate(process: subprocess.Popen[str]) -> None:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        # Reap the killed process; if even SIGKILL does not settle in time there
        # is nothing more to do, so avoid masking the real failure with a
        # teardown error.
        with contextlib.suppress(subprocess.TimeoutExpired):
            process.wait(timeout=5)


def _get_free_tcp_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]
