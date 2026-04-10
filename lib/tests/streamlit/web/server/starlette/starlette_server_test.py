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

"""Unit tests for starlette_server module."""

from __future__ import annotations

import asyncio
import errno
import socket
from typing import TYPE_CHECKING
from unittest import mock
from unittest.mock import AsyncMock, patch

import pytest

if TYPE_CHECKING:
    from collections.abc import Coroutine
    from typing import Any

from streamlit import config
from streamlit.runtime import Runtime
from streamlit.web.server.server import Server
from streamlit.web.server.starlette.starlette_server import (
    RetriesExceededError,
    UvicornRunner,
    _bind_socket,
    _get_websocket_settings,
    _is_port_manually_set,
    _server_address_is_unix_socket,
)
from tests.testutil import patch_config_options


class TestBindSocket:
    """Tests for _bind_socket function."""

    def test_creates_ipv4_socket(self) -> None:
        """Test that IPv4 address creates AF_INET socket."""

        mock_sock = mock.MagicMock()
        with patch("socket.socket", return_value=mock_sock) as mock_socket_cls:
            result = _bind_socket("127.0.0.1", 8501, 100)

            mock_socket_cls.assert_called_once_with(family=socket.AF_INET)
            mock_sock.setsockopt.assert_called_with(
                socket.SOL_SOCKET, socket.SO_REUSEADDR, 1
            )
            mock_sock.bind.assert_called_once_with(("127.0.0.1", 8501))
            mock_sock.listen.assert_called_once_with(100)
            mock_sock.setblocking.assert_called_once_with(False)
            mock_sock.set_inheritable.assert_called_once_with(True)
            assert result == mock_sock

    def test_creates_ipv6_socket(self) -> None:
        """Test that IPv6 address creates AF_INET6 socket."""

        mock_sock = mock.MagicMock()
        with patch("socket.socket", return_value=mock_sock) as mock_socket_cls:
            result = _bind_socket("::", 8501, 100)

            mock_socket_cls.assert_called_once_with(family=socket.AF_INET6)
            # Should set IPV6_V6ONLY to 0
            mock_sock.setsockopt.assert_any_call(
                socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0
            )
            assert result == mock_sock

    def test_detects_ipv6_by_colon(self) -> None:
        """Test that addresses with colons are treated as IPv6."""

        mock_sock = mock.MagicMock()
        with patch("socket.socket", return_value=mock_sock) as mock_socket_cls:
            _bind_socket("::1", 8501, 100)

            mock_socket_cls.assert_called_once_with(family=socket.AF_INET6)

    def test_closes_socket_on_bind_failure(self) -> None:
        """Test that socket is closed when bind raises an exception."""

        mock_sock = mock.MagicMock()
        mock_sock.bind.side_effect = OSError(errno.EADDRINUSE, "Address already in use")
        with patch("socket.socket", return_value=mock_sock):
            with pytest.raises(OSError, match="Address already in use"):
                _bind_socket("127.0.0.1", 8501, 100)

            mock_sock.close.assert_called_once()

    def test_closes_socket_on_listen_failure(self) -> None:
        """Test that socket is closed when listen raises an exception."""

        mock_sock = mock.MagicMock()
        mock_sock.listen.side_effect = OSError("Listen failed")
        with patch("socket.socket", return_value=mock_sock):
            with pytest.raises(OSError, match="Listen failed"):
                _bind_socket("127.0.0.1", 8501, 100)

            mock_sock.close.assert_called_once()


class TestGetWebsocketSettings:
    """Tests for _get_websocket_settings function."""

    @patch_config_options({"server.websocketPingInterval": None})
    def test_default_settings(self) -> None:
        """Test that default settings are returned when not configured."""

        interval, timeout = _get_websocket_settings()

        assert interval == 30
        assert timeout == 30

    @patch_config_options({"server.websocketPingInterval": 45})
    def test_custom_interval(self) -> None:
        """Test that custom interval is respected."""

        interval, timeout = _get_websocket_settings()

        assert interval == 45
        assert timeout == 45

    @patch_config_options({"server.websocketPingInterval": 10})
    def test_low_interval_accepted(self) -> None:
        """Test that low interval values are accepted."""

        interval, timeout = _get_websocket_settings()

        assert interval == 10
        assert timeout == 10


class TestServerPortIsManuallySet:
    """Tests for _is_port_manually_set function."""

    def test_returns_true_when_manually_set(self) -> None:
        """Test that True is returned when port is manually configured."""

        with patch("streamlit.config.is_manually_set", return_value=True):
            result = _is_port_manually_set()

        assert result is True

    def test_returns_false_when_default(self) -> None:
        """Test that False is returned when port is not manually configured."""

        with patch("streamlit.config.is_manually_set", return_value=False):
            result = _is_port_manually_set()

        assert result is False


class TestServerAddressIsUnixSocket:
    """Tests for _server_address_is_unix_socket function."""

    @patch_config_options({"server.address": "unix:///tmp/streamlit.sock"})
    def test_returns_true_for_unix_socket(self) -> None:
        """Test that True is returned for Unix socket address."""

        result = _server_address_is_unix_socket()

        assert result is True

    @patch_config_options({"server.address": "127.0.0.1"})
    def test_returns_false_for_ip_address(self) -> None:
        """Test that False is returned for IP address."""

        result = _server_address_is_unix_socket()

        assert result is False

    @patch_config_options({"server.address": None})
    def test_returns_false_for_none(self) -> None:
        """Test that False is returned when address is None."""

        result = _server_address_is_unix_socket()

        assert result is False

    @patch_config_options({"server.address": ""})
    def test_returns_false_for_empty_string(self) -> None:
        """Test that False is returned for empty string."""

        result = _server_address_is_unix_socket()

        assert result is False


class TestSslConfiguration:
    """Tests for SSL configuration validation in StarletteServer."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        Runtime._instance = None
        self.original_port = config.get_option("server.port")
        config.set_option("server.port", 8650)
        self.loop = asyncio.new_event_loop()

    def tearDown(self) -> None:
        """Tear down test fixtures."""
        Runtime._instance = None
        config.set_option("server.port", self.original_port)
        self.loop.close()

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self) -> None:
        """Pytest fixture for setup and teardown."""
        self.setUp()
        yield
        self.tearDown()

    def _create_server(self) -> Server:
        """Create a Server instance for testing."""
        server = Server("mock/script/path", is_hello=False)
        server._runtime._eventloop = self.loop
        return server

    def _run_async(self, coro: Coroutine[Any, Any, None]) -> None:
        """Run an async coroutine in the test event loop."""
        self.loop.run_until_complete(coro)

    @patch_config_options(
        {"server.sslCertFile": "/tmp/cert.pem", "server.sslKeyFile": None}
    )
    def test_exits_when_only_cert_file_set(self) -> None:
        """Test that server exits when only sslCertFile is set without sslKeyFile."""
        server = self._create_server()

        with pytest.raises(SystemExit):
            self._run_async(server.start())

    @patch_config_options(
        {"server.sslCertFile": None, "server.sslKeyFile": "/tmp/key.pem"}
    )
    def test_exits_when_only_key_file_set(self) -> None:
        """Test that server exits when only sslKeyFile is set without sslCertFile."""
        server = self._create_server()

        with pytest.raises(SystemExit):
            self._run_async(server.start())

    @patch_config_options({"server.sslCertFile": None, "server.sslKeyFile": None})
    def test_no_ssl_when_neither_option_set(self) -> None:
        """Test that server starts without SSL when neither option is set."""
        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                return_value=mock_socket,
            ),
            patch("uvicorn.Config") as uvicorn_config_cls,
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.main_loop = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            uvicorn_instance.should_exit = False
            uvicorn_server_cls.return_value = uvicorn_instance

            self._run_async(server.start())

            # Verify uvicorn.Config was called with ssl_certfile=None, ssl_keyfile=None
            uvicorn_config_cls.assert_called_once()
            call_kwargs = uvicorn_config_cls.call_args[1]
            assert call_kwargs["ssl_certfile"] is None
            assert call_kwargs["ssl_keyfile"] is None

    @patch_config_options(
        {"server.sslCertFile": "/tmp/cert.pem", "server.sslKeyFile": "/tmp/key.pem"}
    )
    def test_ssl_options_passed_to_uvicorn(self) -> None:
        """Test that SSL options are passed to uvicorn when both are set."""
        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                return_value=mock_socket,
            ),
            patch("uvicorn.Config") as uvicorn_config_cls,
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.main_loop = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            uvicorn_instance.should_exit = False
            uvicorn_server_cls.return_value = uvicorn_instance

            self._run_async(server.start())

            # Verify uvicorn.Config was called with the correct SSL options
            uvicorn_config_cls.assert_called_once()
            call_kwargs = uvicorn_config_cls.call_args[1]
            assert call_kwargs["ssl_certfile"] == "/tmp/cert.pem"
            assert call_kwargs["ssl_keyfile"] == "/tmp/key.pem"


class TestStartStarletteServer:
    """Integration tests for the Server.start() method."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        Runtime._instance = None
        self.original_port = config.get_option("server.port")
        config.set_option("server.port", 8600)
        self.loop = asyncio.new_event_loop()

    def tearDown(self) -> None:
        """Tear down test fixtures."""
        Runtime._instance = None
        config.set_option("server.port", self.original_port)
        self.loop.close()

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self) -> None:
        """Pytest fixture for setup and teardown."""

        self.setUp()
        yield
        self.tearDown()

    def _create_server(self) -> Server:
        """Create a Server instance for testing."""

        server = Server("mock/script/path", is_hello=False)
        server._runtime._eventloop = self.loop
        return server

    def _run_async(self, coro: Coroutine[Any, Any, None]) -> None:
        """Run an async coroutine in the test event loop."""

        self.loop.run_until_complete(coro)

    def test_retries_on_port_in_use(self) -> None:
        """Test that server retries the next port when the first is busy."""

        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                side_effect=[OSError(errno.EADDRINUSE, "busy"), mock_socket],
            ) as bind_socket,
            patch(
                "streamlit.web.server.starlette.starlette_server._is_port_manually_set",
                return_value=False,
            ),
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.main_loop = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            uvicorn_instance.should_exit = False
            uvicorn_server_cls.return_value = uvicorn_instance

            self._run_async(server.start())

        assert bind_socket.call_count == 2
        uvicorn_instance.startup.assert_awaited_once()
        assert config.get_option("server.port") == 8601

    def test_honors_manual_port_setting(self) -> None:
        """Test that server exits when manual port is busy."""

        server = self._create_server()

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                side_effect=OSError(errno.EADDRINUSE, "busy"),
            ),
            patch(
                "streamlit.web.server.starlette.starlette_server._is_port_manually_set",
                return_value=True,
            ),
        ):
            with pytest.raises(SystemExit):
                self._run_async(server.start())

    def test_raises_on_max_retries_exceeded(self) -> None:
        """Test that RetriesExceededError is raised after max retries."""

        server = self._create_server()

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                side_effect=OSError(errno.EADDRINUSE, "busy"),
            ),
            patch(
                "streamlit.web.server.starlette.starlette_server._is_port_manually_set",
                return_value=False,
            ),
        ):
            with pytest.raises(RetriesExceededError):
                self._run_async(server.start())

    def test_raises_on_unix_socket(self) -> None:
        """Test that RuntimeError is raised for Unix socket addresses."""

        server = self._create_server()

        with patch_config_options({"server.address": "unix:///tmp/streamlit.sock"}):
            with pytest.raises(RuntimeError, match="Unix sockets are not supported"):
                self._run_async(server.start())

    def test_retries_on_permission_denied(self) -> None:
        """Test that server retries on EACCES (permission denied) errors.

        On Windows, system-reserved ports return EACCES instead of EADDRINUSE.
        See: https://github.com/streamlit/streamlit/issues/13521
        """
        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                side_effect=[OSError(errno.EACCES, "permission denied"), mock_socket],
            ) as bind_socket,
            patch(
                "streamlit.web.server.starlette.starlette_server._is_port_manually_set",
                return_value=False,
            ),
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.main_loop = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            uvicorn_instance.should_exit = False
            uvicorn_server_cls.return_value = uvicorn_instance

            self._run_async(server.start())

        assert bind_socket.call_count == 2
        uvicorn_instance.startup.assert_awaited_once()
        assert config.get_option("server.port") == 8601

    def test_propagates_non_retryable_errors(self) -> None:
        """Test that non-retryable errors (not EADDRINUSE/EACCES) are propagated."""
        server = self._create_server()

        with patch(
            "streamlit.web.server.starlette.starlette_server._bind_socket",
            side_effect=OSError(errno.ENOENT, "no such file"),
        ):
            with pytest.raises(OSError, match="no such file") as exc_info:
                self._run_async(server.start())

            assert exc_info.value.errno == errno.ENOENT

    def test_uses_default_address_when_not_configured(self) -> None:
        """Test that 0.0.0.0 is used when address is not configured."""

        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)

        with (
            patch_config_options({"server.address": None}),
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                return_value=mock_socket,
            ) as bind_socket,
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.main_loop = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            uvicorn_instance.should_exit = False
            uvicorn_server_cls.return_value = uvicorn_instance

            self._run_async(server.start())

        bind_socket.assert_called_once()
        call_args = bind_socket.call_args[0]
        assert call_args[0] == "0.0.0.0"

    def test_uses_configured_address(self) -> None:
        """Test that configured address is used."""

        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)

        with (
            patch_config_options({"server.address": "192.168.1.100"}),
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                return_value=mock_socket,
            ) as bind_socket,
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.main_loop = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            uvicorn_instance.should_exit = False
            uvicorn_server_cls.return_value = uvicorn_instance

            self._run_async(server.start())

        bind_socket.assert_called_once()
        call_args = bind_socket.call_args[0]
        assert call_args[0] == "192.168.1.100"


class TestDynamicPort:
    """Tests for server.port=0 (ephemeral port) support in UvicornServer."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        Runtime._instance = None
        self.original_port = config.get_option("server.port")
        config.set_option("server.port", 0)
        self.loop = asyncio.new_event_loop()

    def tearDown(self) -> None:
        """Tear down test fixtures."""
        Runtime._instance = None
        config.set_option("server.port", self.original_port)
        self.loop.close()

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self) -> None:
        """Pytest fixture for setup and teardown."""
        self.setUp()
        yield
        self.tearDown()

    def _create_server(self) -> Server:
        """Create a Server instance for testing."""
        server = Server("mock/script/path", is_hello=False)
        server._runtime._eventloop = self.loop
        return server

    def _run_async(self, coro: Coroutine[Any, Any, None]) -> None:
        """Run an async coroutine in the test event loop."""
        self.loop.run_until_complete(coro)

    def test_updates_config_port_when_binding_to_zero(self) -> None:
        """Test that config is updated with the actual port when port=0."""
        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)
        mock_socket.getsockname.return_value = ("127.0.0.1", 54321)

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                return_value=mock_socket,
            ),
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.main_loop = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            uvicorn_instance.should_exit = False
            uvicorn_server_cls.return_value = uvicorn_instance

            self._run_async(server.start())

        assert config.get_option("server.port") == 54321
        uvicorn_config = uvicorn_server_cls.call_args[0][0]
        assert uvicorn_config.port == 54321

    def test_does_not_call_getsockname_for_nonzero_port(self) -> None:
        """Test that getsockname is not called when a specific port is configured."""
        config.set_option("server.port", 8501)
        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                return_value=mock_socket,
            ),
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.main_loop = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            uvicorn_instance.should_exit = False
            uvicorn_server_cls.return_value = uvicorn_instance

            self._run_async(server.start())

        mock_socket.getsockname.assert_not_called()
        assert config.get_option("server.port") == 8501


class TestServerLifecycle:
    """Tests for server lifecycle behavior required by bootstrap.

    These tests verify that the Starlette server correctly implements
    the lifecycle semantics that bootstrap.py depends on:
    - start() returns after server is ready (doesn't block forever)
    - stop() signals graceful shutdown
    - stopped property completes after shutdown
    """

    def setUp(self) -> None:
        """Set up test fixtures."""
        Runtime._instance = None
        self.original_port = config.get_option("server.port")
        config.set_option("server.port", 8700)
        self.loop = asyncio.new_event_loop()

    def tearDown(self) -> None:
        """Tear down test fixtures."""
        Runtime._instance = None
        config.set_option("server.port", self.original_port)
        self.loop.close()

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self) -> None:
        """Pytest fixture for setup and teardown."""
        self.setUp()
        yield
        self.tearDown()

    def _create_server(self) -> Server:
        """Create a Server instance for testing."""
        server = Server("mock/script/path", is_hello=False)
        server._runtime._eventloop = self.loop
        return server

    def _run_async(self, coro: Coroutine[Any, Any, None]) -> None:
        """Run an async coroutine in the test event loop."""
        self.loop.run_until_complete(coro)

    def test_start_returns_after_server_ready(self) -> None:
        """Test that start() returns after server is ready, not after shutdown.

        This is critical for bootstrap.py which expects to run _on_server_start()
        and set up signal handlers after start() returns.
        """
        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)
        start_returned = False

        async def verify_start_returns() -> None:
            nonlocal start_returned
            await server.start()
            # If we get here, start() returned (didn't block forever)
            start_returned = True

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                return_value=mock_socket,
            ),
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.main_loop = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            uvicorn_instance.should_exit = False
            uvicorn_server_cls.return_value = uvicorn_instance

            self._run_async(verify_start_returns())

        assert start_returned, "start() should return after server is ready"
        uvicorn_instance.startup.assert_awaited_once()

    def test_stop_signals_server_shutdown(self) -> None:
        """Test that stop() signals the uvicorn server to exit."""
        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                return_value=mock_socket,
            ),
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.main_loop = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            uvicorn_instance.should_exit = False
            uvicorn_server_cls.return_value = uvicorn_instance

            self._run_async(server.start())

            # Verify server is stored and can be stopped
            assert server._starlette_server is not None
            server.stop()

            # Verify should_exit was set to True
            assert uvicorn_instance.should_exit is True

    def test_stopped_property_returns_awaitable(self) -> None:
        """Test that stopped property returns an awaitable for Starlette mode."""
        import inspect

        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                return_value=mock_socket,
            ),
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.main_loop = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            uvicorn_instance.should_exit = False
            uvicorn_server_cls.return_value = uvicorn_instance

            self._run_async(server.start())

            # Verify stopped returns an awaitable
            stopped = server.stopped
            assert stopped is not None
            # Should be a coroutine or awaitable
            assert inspect.iscoroutine(stopped) or hasattr(stopped, "__await__")

            # Close the coroutine to avoid warning
            if inspect.iscoroutine(stopped):
                stopped.close()

    def test_starlette_server_stored_on_server_instance(self) -> None:
        """Test that StarletteServer is stored on Server instance, not global."""
        server1 = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                return_value=mock_socket,
            ),
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.main_loop = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            uvicorn_instance.should_exit = False
            uvicorn_server_cls.return_value = uvicorn_instance

            # Before start, _starlette_server should be None
            assert server1._starlette_server is None

            self._run_async(server1.start())

            # After start, _starlette_server should be set
            assert server1._starlette_server is not None

            # Verify it's instance-specific (not a module global)
            from streamlit.web.server.starlette.starlette_server import UvicornServer

            assert isinstance(server1._starlette_server, UvicornServer)

    def test_raises_on_startup_failure(self) -> None:
        """Test that RuntimeError is raised when uvicorn startup fails."""
        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                return_value=mock_socket,
            ),
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            # Simulate startup failure by setting should_exit to True after startup
            uvicorn_instance.should_exit = True
            uvicorn_server_cls.return_value = uvicorn_instance

            with pytest.raises(RuntimeError, match="Server startup failed"):
                self._run_async(server.start())

    def test_stopped_event_set_after_main_loop_completes(self) -> None:
        """Test that stopped event is set after the server main loop completes."""
        from streamlit.web.server.starlette.starlette_server import UvicornServer

        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)

        with (
            patch(
                "streamlit.web.server.starlette.starlette_server._bind_socket",
                return_value=mock_socket,
            ),
            patch("uvicorn.Server") as uvicorn_server_cls,
        ):
            uvicorn_instance = mock.MagicMock()
            uvicorn_instance.startup = AsyncMock()
            uvicorn_instance.shutdown = AsyncMock()
            uvicorn_instance.should_exit = False

            # Make main_loop complete immediately
            uvicorn_instance.main_loop = AsyncMock(return_value=None)
            uvicorn_server_cls.return_value = uvicorn_instance

            self._run_async(server.start())

            starlette_server: UvicornServer = server._starlette_server  # type: ignore
            assert starlette_server is not None

            # Give the background task time to complete
            self._run_async(asyncio.sleep(0.1))

            # The stopped event should be set after main_loop completes
            assert starlette_server.stopped.is_set()

    def test_no_deadlock_on_task_cancellation(self) -> None:
        """Test that start() doesn't deadlock if task is cancelled during startup.

        This tests a fix for a potential deadlock where CancelledError (which is
        a BaseException, not Exception) would bypass the exception handler that
        sets startup_complete, causing start() to hang forever on await
        startup_complete.wait().

        The fix ensures startup_complete is set in the finally block.
        """
        from streamlit.web.server.starlette.starlette_server import UvicornServer

        server = self._create_server()
        mock_socket = mock.MagicMock(spec=socket.socket)

        async def test_cancellation() -> None:
            with (
                patch(
                    "streamlit.web.server.starlette.starlette_server._bind_socket",
                    return_value=mock_socket,
                ),
                patch("uvicorn.Server") as uvicorn_server_cls,
            ):
                uvicorn_instance = mock.MagicMock()
                uvicorn_instance.shutdown = AsyncMock()
                uvicorn_instance.should_exit = False

                # Make startup raise CancelledError to simulate task cancellation
                uvicorn_instance.startup = AsyncMock(
                    side_effect=asyncio.CancelledError()
                )
                uvicorn_server_cls.return_value = uvicorn_instance

                starlette_server = UvicornServer(server._runtime)

                # This should raise CancelledError, not deadlock
                with pytest.raises(asyncio.CancelledError):
                    await asyncio.wait_for(starlette_server.start(), timeout=2.0)

                # The stopped event should still be set (cleanup happened)
                assert starlette_server.stopped.is_set()

        self._run_async(test_cancellation())


class TestUvicornRunner:
    """Tests for UvicornRunner class (sync blocking runner for st.App mode)."""

    def test_run_calls_uvicorn_with_correct_args(self) -> None:
        """Test that run() calls uvicorn.run with correct arguments."""
        with (
            patch_config_options({"server.address": "0.0.0.0", "server.port": 8502}),
            patch(
                "streamlit.web.server.starlette.starlette_server._get_uvicorn_config_kwargs",
                return_value={"ssl_certfile": None, "ssl_keyfile": None},
            ),
            patch("uvicorn.run") as mock_uvicorn_run,
        ):
            runner = UvicornRunner("myapp:app")
            runner.run()

            mock_uvicorn_run.assert_called_once()
            call_kwargs = mock_uvicorn_run.call_args
            assert call_kwargs[0][0] == "myapp:app"
            assert call_kwargs[1]["host"] == "0.0.0.0"
            assert call_kwargs[1]["port"] == 8502

    def test_run_retries_on_port_in_use(self) -> None:
        """Test that run() retries on EADDRINUSE."""
        call_count = 0

        def mock_run(*args: Any, **kwargs: Any) -> None:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise OSError(errno.EADDRINUSE, "Address already in use")
            # Second call succeeds

        with (
            patch_config_options({"server.address": "127.0.0.1", "server.port": 8501}),
            patch(
                "streamlit.web.server.starlette.starlette_server._get_uvicorn_config_kwargs",
                return_value={},
            ),
            patch(
                "streamlit.web.server.starlette.starlette_server._is_port_manually_set",
                return_value=False,
            ),
            patch("uvicorn.run", side_effect=mock_run),
        ):
            runner = UvicornRunner("myapp:app")
            runner.run()

            assert call_count == 2

    def test_run_exits_when_port_manually_set_and_unavailable(self) -> None:
        """Test that run() exits when port is manually set and unavailable."""
        with (
            patch_config_options({"server.address": "127.0.0.1", "server.port": 8501}),
            patch(
                "streamlit.web.server.starlette.starlette_server._get_uvicorn_config_kwargs",
                return_value={},
            ),
            patch(
                "streamlit.web.server.starlette.starlette_server._is_port_manually_set",
                return_value=True,
            ),
            patch(
                "uvicorn.run",
                side_effect=OSError(errno.EADDRINUSE, "Address already in use"),
            ),
            pytest.raises(SystemExit),
        ):
            runner = UvicornRunner("myapp:app")
            runner.run()

    def test_run_rejects_unix_sockets(self) -> None:
        """Test that run() raises for Unix socket addresses."""
        with (
            patch_config_options({"server.address": "unix://test.sock"}),
            patch(
                "streamlit.web.server.starlette.starlette_server._get_uvicorn_config_kwargs",
                return_value={},
            ),
        ):
            runner = UvicornRunner("myapp:app")
            with pytest.raises(RuntimeError, match="Unix sockets are not supported"):
                runner.run()
