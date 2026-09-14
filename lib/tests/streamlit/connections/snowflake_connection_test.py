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

import os
import sys
import threading
import types
import unittest
from contextlib import contextmanager
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, PropertyMock, patch

import pytest

import streamlit as st
from streamlit.connections import SnowflakeCallersRightsConnection, SnowflakeConnection
from streamlit.connections import retry_util as snowflake_retry_util
from streamlit.connections.snowflake_connection import SNOWPARK_USER_TOKEN_HEADER_NAME
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.secrets import AttrDict
from tests.testutil import (
    create_mock_script_run_ctx,
    retry_without_sleep,
    script_run_ctx_and_cleared_cache,
)

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path


class SomeError(Exception):
    def __init__(self, message, **kwargs):
        self.__dict__.update(kwargs)
        super().__init__(self, message)


def _snowflake_connector_modules() -> dict[str, types.ModuleType]:
    snowflake_mod = types.ModuleType("snowflake")
    connector_mod = types.ModuleType("snowflake.connector")
    connector_mod.Error = type("SnowflakeError", (Exception,), {})
    connector_mod.connect = MagicMock()
    snowflake_mod.connector = connector_mod
    return {"snowflake": snowflake_mod, "snowflake.connector": connector_mod}


@contextmanager
def _patched_sis(active_session: object) -> Iterator[types.ModuleType]:
    """Patch Snowflake modules and treat the process as running in Streamlit in Snowflake."""
    modules = _snowflake_connector_modules()
    context_mod = types.ModuleType("snowflake.snowpark.context")
    snowpark_mod = types.ModuleType("snowflake.snowpark")
    context_mod.get_active_session = MagicMock(return_value=active_session)
    modules["snowflake.snowpark"] = snowpark_mod
    modules["snowflake.snowpark.context"] = context_mod
    with (
        patch.dict(sys.modules, modules),
        patch(
            "streamlit.connections.snowflake_connection.running_in_sis",
            return_value=True,
        ),
    ):
        yield modules["snowflake.connector"]


@contextmanager
def _patched_snowpark(
    *, in_sis: bool
) -> Iterator[tuple[types.ModuleType, types.ModuleType]]:
    """Install fake Snowpark modules and control ``running_in_sis``.

    Used by ``session()`` tests that should not import the Snowflake extra.
    """
    context_mod = types.ModuleType("snowflake.snowpark.context")
    session_mod = types.ModuleType("snowflake.snowpark.session")
    snowpark_mod = types.ModuleType("snowflake.snowpark")
    snowflake_mod = types.ModuleType("snowflake")
    context_mod.get_active_session = MagicMock(return_value="active-session")
    session_mod.Session = MagicMock()
    with (
        patch.dict(
            sys.modules,
            {
                "snowflake": snowflake_mod,
                "snowflake.snowpark": snowpark_mod,
                "snowflake.snowpark.context": context_mod,
                "snowflake.snowpark.session": session_mod,
            },
        ),
        patch(
            "streamlit.connections.snowflake_connection.running_in_sis",
            return_value=in_sis,
        ),
    ):
        yield context_mod, session_mod


class TestSnowflakeConnectionConfiguration:
    """Tests for Snowflake configuration selection without the Snowflake dependency."""

    @staticmethod
    @contextmanager
    def _patched_snowflake(
        secrets: dict[str, str] | None = None,
    ) -> Iterator[types.ModuleType]:
        """Patch the Snowflake connector and Streamlit secrets, yielding the connector module."""
        modules = _snowflake_connector_modules()
        with (
            patch.dict(sys.modules, modules),
            patch(
                "streamlit.connections.snowflake_connection.running_in_sis",
                MagicMock(return_value=False),
            ),
            patch(
                "streamlit.connections.snowflake_connection.SnowflakeConnection._secrets",
                PropertyMock(return_value=AttrDict(secrets or {})),
            ),
        ):
            yield modules["snowflake.connector"]

    @pytest.mark.parametrize(
        ("connection_name", "kwargs", "expected_connect_kwargs"),
        [
            ("my_connection", {}, {"connection_name": "my_connection"}),
            ("my_connection", {"account": "my_account"}, {"account": "my_account"}),
            ("snowflake", {}, {}),
            ("", {}, {}),
        ],
        ids=[
            "custom_name_uses_named_configuration",
            "custom_name_with_kwargs_keeps_kwargs_behavior",
            "snowflake_name_uses_default_configuration",
            "empty_name_uses_default_configuration",
        ],
    )
    def test_connect_selects_expected_configuration(
        self,
        connection_name: str,
        kwargs: dict[str, str],
        expected_connect_kwargs: dict[str, str],
    ) -> None:
        """Test that connect() is called with the configuration implied by name and kwargs."""
        with self._patched_snowflake() as connector:
            SnowflakeConnection(connection_name, **kwargs)
            connector.connect.assert_called_once_with(**expected_connect_kwargs)

    def test_failing_named_connection_raises_friendly_error(self) -> None:
        """Test that a failing named connection without config raises a friendly error."""
        with self._patched_snowflake() as connector:
            connector.connect.side_effect = connector.Error("connection not found")

            with pytest.raises(StreamlitAPIException, match="Missing Snowflake"):
                SnowflakeConnection("unknown_connection")

    def test_connect_uses_streamlit_secrets_when_present(self) -> None:
        """Non-empty Streamlit secrets are forwarded to ``connector.connect``."""
        with self._patched_snowflake({"account": "acct", "user": "alice"}) as connector:
            SnowflakeConnection("snowflake", warehouse="wh")
        connector.connect.assert_called_once_with(
            account="acct", user="alice", warehouse="wh"
        )

    def test_connect_reraises_connector_error_when_config_is_present(self) -> None:
        """A connector error is re-raised when kwargs provide configuration."""
        with self._patched_snowflake() as connector:
            connector.connect.side_effect = connector.Error("auth failed")
            with pytest.raises(connector.Error, match="auth failed"):
                SnowflakeConnection("my_connection", account="acct")


@pytest.mark.require_integration
class SnowflakeConnectionTest(unittest.TestCase):
    def tearDown(self) -> None:
        st.cache_data.clear()

    @patch(
        "snowflake.snowpark.context.get_active_session",
    )
    @patch(
        "streamlit.connections.snowflake_connection.running_in_sis",
        MagicMock(return_value=True),
    )
    def test_uses_active_session_if_in_sis(self, patched_get_active_session):
        active_session_mock = MagicMock()
        active_session_mock.connection = "some active session"
        patched_get_active_session.return_value = active_session_mock

        conn = SnowflakeConnection("my_snowflake_connection")
        assert conn._instance == "some active session"

    @patch(
        "streamlit.connections.snowflake_connection.SnowflakeConnection._secrets",
        PropertyMock(
            return_value=AttrDict({"account": "some_val_1", "some_key": "some_val_2"})
        ),
    )
    @patch("snowflake.connector.connect")
    def test_uses_streamlit_secrets_if_available(self, patched_connect):
        SnowflakeConnection("my_snowflake_connection")
        patched_connect.assert_called_once_with(
            account="some_val_1", some_key="some_val_2"
        )

    @patch("snowflake.connector.connect")
    def test_uses_config_manager_if_available(self, patched_connect):
        SnowflakeConnection("snowflake", some_kwarg="some_value")

        patched_connect.assert_called_once_with()

    def test_throws_friendly_error_if_no_config_set(self):
        with pytest.raises(StreamlitAPIException) as e:
            SnowflakeConnection("snowflake")

        assert "Missing Snowflake connection configuration." in str(e.value)

    @patch(
        "streamlit.connections.snowflake_connection.SnowflakeConnection._connect",
        MagicMock(),
    )
    def test_query_caches_value(self):
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

        mock_cursor = MagicMock()
        mock_cursor.fetch_pandas_all = MagicMock(return_value="i am a dataframe")
        conn = SnowflakeConnection("my_snowflake_connection")
        conn._instance.cursor.return_value = mock_cursor

        assert conn.query("SELECT 1;") == "i am a dataframe"
        assert conn.query("SELECT 1;") == "i am a dataframe"

        conn._instance.cursor.assert_called_once()
        mock_cursor.execute.assert_called_once_with("SELECT 1;", params=None)

    @patch(
        "streamlit.connections.snowflake_connection.SnowflakeConnection._connect",
        MagicMock(),
    )
    def test_query_caches_separately_for_different_params(self):
        """Test that different params values create separate cache entries."""
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

        mock_cursor = MagicMock()
        mock_cursor.fetch_pandas_all = MagicMock(return_value="i am a dataframe")
        conn = SnowflakeConnection("my_snowflake_connection_params")
        conn._instance.cursor.return_value = mock_cursor

        # Call with different params - should result in separate cache entries
        conn.query("SELECT * FROM t WHERE status = ?", params=["active"])
        conn.query("SELECT * FROM t WHERE status = ?", params=["inactive"])
        # Call again with same params - should hit cache
        conn.query("SELECT * FROM t WHERE status = ?", params=["active"])
        conn.query("SELECT * FROM t WHERE status = ?", params=["inactive"])

        # Should have been called twice (once for each unique params value)
        assert conn._instance.cursor.call_count == 2
        assert mock_cursor.execute.call_count == 2
        # Verify execute was called with the correct params
        mock_cursor.execute.assert_any_call(
            "SELECT * FROM t WHERE status = ?", params=["active"]
        )
        mock_cursor.execute.assert_any_call(
            "SELECT * FROM t WHERE status = ?", params=["inactive"]
        )

    @patch(
        "streamlit.connections.snowflake_connection.SnowflakeConnection._connect",
        MagicMock(),
    )
    def test_does_not_reset_cache_when_ttl_changes(self):
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

        mock_cursor = MagicMock()
        mock_cursor.fetch_pandas_all = MagicMock(return_value="i am a dataframe")
        conn = SnowflakeConnection("my_snowflake_connection")
        conn._instance.cursor.return_value = mock_cursor

        conn.query("SELECT 1;", ttl=10)
        conn.query("SELECT 2;", ttl=20)
        conn.query("SELECT 1;", ttl=10)
        conn.query("SELECT 2;", ttl=20)

        assert conn._instance.cursor.call_count == 2
        assert mock_cursor.execute.call_count == 2

    @patch(
        "streamlit.connections.snowflake_connection.SnowflakeConnection._connect",
        MagicMock(),
    )
    def test_scopes_caches_by_connection_name(self):
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())
        mock_cursor = MagicMock()
        mock_cursor.fetch_pandas_all = MagicMock(return_value="i am a dataframe")

        conn1 = SnowflakeConnection("my_snowflake_connection1", host="host1")
        conn2 = SnowflakeConnection("my_snowflake_connection1", host="another_host")
        conn3 = SnowflakeConnection("my_snowflake_connection2")

        conn1._instance.cursor.return_value = mock_cursor
        assert conn1._instance.cursor is conn2._instance.cursor
        assert conn2._instance.cursor is conn3._instance.cursor

        conn1.query("SELECT 1;")
        assert mock_cursor.execute.call_count == 1
        conn1.query("SELECT 1;")
        assert mock_cursor.execute.call_count == 1
        conn2.query("SELECT 1;")
        assert mock_cursor.execute.call_count == 2
        conn2.query("SELECT 1;")
        assert mock_cursor.execute.call_count == 2
        conn3.query("SELECT 1;")
        assert mock_cursor.execute.call_count == 3
        conn3.query("SELECT 1;")
        assert mock_cursor.execute.call_count == 3

    @patch(
        "streamlit.connections.snowflake_connection.SnowflakeConnection._connect",
        MagicMock(),
    )
    def test_retry_behavior(self):
        mock_cursor = MagicMock()
        mock_cursor.fetch_pandas_all = MagicMock(
            side_effect=SomeError("oh no", sqlstate="08001")
        )

        conn = SnowflakeConnection("my_snowflake_connection")
        conn._instance.cursor.return_value = mock_cursor

        with patch.object(conn, "reset", wraps=conn.reset) as wrapped_reset:
            with pytest.raises(SomeError):
                conn.query("SELECT 1;")

            # Our connection should have been reset after each failed attempt to call
            # query.
            assert wrapped_reset.call_count == 3

        # conn._connect should have been called three times: once in the initial
        # connection, then once each after the second and third attempts to call
        # query.
        assert conn._connect.call_count == 3

    @patch(
        "streamlit.connections.snowflake_connection.SnowflakeConnection._connect",
        MagicMock(),
    )
    def test_retry_fails_fast_for_programming_errors_with_wrong_sqlstate(self):
        mock_cursor = MagicMock()
        mock_cursor.fetch_pandas_all = MagicMock(
            side_effect=SomeError("oh no", sqlstate="42")
        )

        conn = SnowflakeConnection("my_snowflake_connection")
        conn._instance.cursor.return_value = mock_cursor

        with pytest.raises(SomeError):
            conn.query("SELECT 1;")

        # conn._connect should have just been called once when first creating the
        # connection.
        assert conn._connect.call_count == 1

    @patch(
        "streamlit.connections.snowflake_connection.SnowflakeConnection._connect",
        MagicMock(),
    )
    def test_retry_fails_fast_for_general_snowflake_errors(self):
        from snowflake.connector.errors import Error as SnowflakeError

        mock_cursor = MagicMock()
        mock_cursor.fetch_pandas_all = MagicMock(side_effect=SnowflakeError("oh no"))

        conn = SnowflakeConnection("my_snowflake_connection")
        conn._instance.cursor.return_value = mock_cursor

        with pytest.raises(SnowflakeError):
            conn.query("SELECT 1;")

        # conn._connect should have just been called once when first creating the
        # connection.
        assert conn._connect.call_count == 1

    @patch(
        "streamlit.connections.snowflake_connection.SnowflakeConnection._connect",
        MagicMock(),
    )
    def test_retry_fails_fast_for_other_errors(self):
        mock_cursor = MagicMock()
        mock_cursor.fetch_pandas_all = MagicMock(side_effect=Exception("oh no"))

        conn = SnowflakeConnection("my_snowflake_connection")
        conn._instance.cursor.return_value = mock_cursor

        with pytest.raises(Exception, match="oh no"):
            conn.query("SELECT 1;")

        # conn._connect should have just been called once when first creating the
        # connection.
        assert conn._connect.call_count == 1


class TestSnowflakeConnectionClose:
    """Tests for SnowflakeConnection.close() method (no integration required)."""

    def test_close_resets_raw_instance(self) -> None:
        """Tests that close() closes the connection and resets _raw_instance.

        After close() is called, the next access to _instance should create a new
        connection, not return the closed one.
        """
        mock_connection = MagicMock()
        second_mock_connection = MagicMock()

        with patch(
            "streamlit.connections.snowflake_connection.SnowflakeConnection._connect"
        ) as mock_connect:
            mock_connect.side_effect = [mock_connection, second_mock_connection]

            conn = SnowflakeConnection("my_snowflake_connection")

            # First access creates the connection
            assert conn._instance is mock_connection
            mock_connect.assert_called_once()

            # Close the connection
            conn.close()
            mock_connection.close.assert_called_once()

            # _raw_instance should be None after close
            assert conn._raw_instance is None

            # Next access to _instance should create a new connection
            assert conn._instance is second_mock_connection
            assert mock_connect.call_count == 2

    def test_close_is_noop_when_not_connected(self) -> None:
        """Tests that close() doesn't fail when _raw_instance is None."""
        with patch(
            "streamlit.connections.snowflake_connection.SnowflakeConnection._connect"
        ) as mock_connect:
            mock_connect.return_value = MagicMock()

            conn = SnowflakeConnection("my_snowflake_connection")
            # Reset the connection to simulate it not being connected
            conn._raw_instance = None

            # close() should not raise when _raw_instance is None
            conn.close()

            # _raw_instance should still be None
            assert conn._raw_instance is None


class TestSnowflakeCallersRightsConnection:
    def test_get_connection_params_errors_on_missing_env(self):
        """Tests that _get_connection_params handles missing environment variables."""

        env_var_names = [
            "SNOWFLAKE_ACCOUNT",
            "SNOWFLAKE_HOST",
            "SNOWFLAKE_DATABASE",
            "SNOWFLAKE_SCHEMA",
        ]

        # Validate that we throw an exception if any env vars are missing.
        for missing_var in env_var_names:

            def fake_getenv(key: str) -> str | None:
                if key == missing_var:  # noqa: B023 (deliberately capturing loop var)
                    return None
                return "exists"

            with patch.object(os, "getenv", new=fake_getenv):
                with pytest.raises(
                    StreamlitAPIException, match=f"Environment variable.*{missing_var}"
                ):
                    SnowflakeCallersRightsConnection._get_connection_params()

    def test_get_connection_params_missing_file(self):
        """Tests that a missing token file produces an error."""

        with patch.object(os, "getenv"):
            with pytest.raises(StreamlitAPIException, match=r"Token file.*not found"):
                SnowflakeCallersRightsConnection._get_connection_params()

    def test_get_connection_params_missing_headers(self):
        """Tests that a missing token header produces an error."""

        with (
            patch.object(os, "getenv"),
            patch.object(os.path, "exists"),
            patch.object(SnowflakeCallersRightsConnection, "_read_token_file"),
            patch.object(st, "context") as mock_context,
        ):
            mock_context.headers = {}
            with pytest.raises(StreamlitAPIException, match="Token header not found"):
                SnowflakeCallersRightsConnection._get_connection_params()

    def test_get_connection_params_all_values_ok(self):
        """Tests that correct parameters are generated when all values are present."""

        fake_env_values = {
            "SNOWFLAKE_ACCOUNT": "my-account",
            "SNOWFLAKE_HOST": "account.snowf.com",
            "SNOWFLAKE_DATABASE": "my_database",
            "SNOWFLAKE_SCHEMA": "streamlit_schema",
        }

        def fake_getenv(key: str) -> str:
            return fake_env_values.get(key)

        fake_file_token = "ondisk_secret"
        fake_header_token = "header_secret"
        fake_headers = {SNOWPARK_USER_TOKEN_HEADER_NAME: fake_header_token}

        with (
            patch.object(os, "getenv", new=fake_getenv),
            patch.object(os.path, "exists"),
            patch.object(
                SnowflakeCallersRightsConnection, "_read_token_file"
            ) as mock_read_token_file,
            patch.object(st, "context") as mock_context,
        ):
            mock_read_token_file.return_value = fake_file_token
            mock_context.headers = fake_headers
            got_params = SnowflakeCallersRightsConnection._get_connection_params()

        assert got_params == {
            "authenticator": "oauth",
            "ocsp_fail_open": True,
            "client_session_keep_alive": True,
            "account": "my-account",
            "host": "account.snowf.com",
            "database": "my_database",
            "schema": "streamlit_schema",
            "token": "ondisk_secret.header_secret",
        }

    @pytest.mark.require_integration
    def test_connect(self):
        """Tests that _connect works."""

        fake_params = {"account": "from_env", "token": "its_a_token"}

        with (
            patch("snowflake.connector") as mock_connector,
            patch.object(
                SnowflakeCallersRightsConnection, "_get_connection_params"
            ) as mock_get_connection_params,
        ):
            mock_get_connection_params.return_value = fake_params

            SnowflakeCallersRightsConnection(
                "snowflake-callers-rights",
                account="account_override",
                some_kwarg="some_value",
            )

            assert mock_connector.paramstyle == "qmark"
            mock_connector.connect.assert_called_once_with(
                account="account_override", token="its_a_token", some_kwarg="some_value"
            )


class TestSnowflakeConnectionMethods:
    """SnowflakeConnection methods that can be exercised without the Snowflake extra."""

    @pytest.fixture(autouse=True)
    def _script_run_ctx_and_connect(self) -> Iterator[None]:
        """Mock ``_connect``, attach a script-run context, and clear cache_data."""
        with (
            script_run_ctx_and_cleared_cache(),
            patch(
                "streamlit.connections.snowflake_connection.SnowflakeConnection._connect",
                MagicMock(),
            ),
        ):
            yield

    def test_query_returns_dataframe(self) -> None:
        """``.query()`` executes SQL on a cursor and returns ``fetch_pandas_all``."""
        mock_cursor = MagicMock()
        mock_cursor.fetch_pandas_all = MagicMock(return_value="i am a dataframe")
        conn = SnowflakeConnection("my_snowflake_connection")
        conn._instance.cursor.return_value = mock_cursor

        assert conn.query("SELECT 1;") == "i am a dataframe"
        mock_cursor.execute.assert_called_once_with("SELECT 1;", params=None)

    def test_query_retries_connection_not_established(self) -> None:
        """SQLSTATE 08001 errors reset the connection and are retried."""
        mock_cursor = MagicMock()
        mock_cursor.fetch_pandas_all = MagicMock(
            side_effect=SomeError("oh no", sqlstate="08001")
        )
        with patch.object(snowflake_retry_util, "retry", retry_without_sleep):
            conn = SnowflakeConnection("my_snowflake_connection")
            conn._instance.cursor.return_value = mock_cursor
            with (
                patch.object(conn, "reset", wraps=conn.reset) as wrapped_reset,
                pytest.raises(SomeError),
            ):
                conn.query("SELECT 1;")
            assert wrapped_reset.call_count == 3

    def test_write_pandas_delegates_to_connector(self) -> None:
        """``write_pandas`` forwards the live connection and returns the connector tuple."""
        pandas_tools_mod = types.ModuleType("snowflake.connector.pandas_tools")
        pandas_tools_mod.write_pandas = MagicMock(return_value=(True, 2, 10, "extra"))
        modules = _snowflake_connector_modules()
        modules["snowflake.connector.pandas_tools"] = pandas_tools_mod
        df = MagicMock(name="df")

        with patch.dict(sys.modules, modules):
            conn = SnowflakeConnection("my_snowflake_connection")
            result = conn.write_pandas(
                df, "my_table", database="db", schema="public", chunk_size=5
            )

        assert result == (True, 2, 10)
        pandas_tools_mod.write_pandas.assert_called_once_with(
            conn=conn._instance,
            df=df,
            table_name="my_table",
            database="db",
            schema="public",
            chunk_size=5,
        )

    def test_cursor_and_raw_connection(self) -> None:
        """``cursor`` and ``raw_connection`` expose the underlying connector objects."""
        conn = SnowflakeConnection("my_snowflake_connection")
        assert conn.cursor() is conn._instance.cursor.return_value
        assert conn.raw_connection is conn._instance

    def test_session_uses_active_session_in_sis(self) -> None:
        """In SiS, ``session()`` returns the Snowpark active session."""
        with _patched_snowpark(in_sis=True) as (context_mod, session_mod):
            conn = SnowflakeConnection("my_snowflake_connection")
            assert conn.session() == "active-session"
        context_mod.get_active_session.assert_called_once()
        session_mod.Session.builder.configs.assert_not_called()

    def test_session_builds_snowpark_session_outside_sis(self) -> None:
        """Outside SiS, ``session()`` builds a Snowpark session from the connector."""
        created_session = MagicMock(name="created-session")
        with _patched_snowpark(in_sis=False) as (context_mod, session_mod):
            session_mod.Session.builder.configs.return_value.create.return_value = (
                created_session
            )
            conn = SnowflakeConnection("my_snowflake_connection")
            assert conn.session() is created_session
        session_mod.Session.builder.configs.assert_called_once_with(
            {"connection": conn._instance}
        )
        context_mod.get_active_session.assert_not_called()


class TestSnowflakeConnectInSis:
    """Test ``_connect`` for Streamlit in Snowflake without the optional dependency."""

    def test_uses_session_connection_attr(self) -> None:
        """SiS prefers ``session.connection`` when the attribute exists."""
        active_session = MagicMock()
        active_session.connection = "sis-connection"
        with _patched_sis(active_session) as connector:
            conn = SnowflakeConnection("my_snowflake_connection")
        assert conn._instance == "sis-connection"
        connector.connect.assert_not_called()

    def test_falls_back_to_internal_conn_without_connection_attr(self) -> None:
        """Older Snowpark sessions expose the connector via ``session._conn._conn``."""
        active_session = MagicMock(spec=["_conn"])
        active_session._conn._conn = "legacy-sis-connection"
        with _patched_sis(active_session):
            conn = SnowflakeConnection("my_snowflake_connection")
        assert conn._instance == "legacy-sis-connection"


class TestSnowflakeCallersRightsConnectionUnit:
    """Caller's-rights helpers that do not require the Snowflake extra."""

    def test_scope_is_session(self) -> None:
        """Caller's-rights connections are session-scoped."""
        assert SnowflakeCallersRightsConnection.scope() == "session"

    def test_read_token_file(self, tmp_path: Path) -> None:
        """The Snowpark token file is read as UTF-8 text."""
        token_path = tmp_path / "token"
        token_path.write_text("login-token", encoding="utf-8")
        with patch(
            "streamlit.connections.snowflake_connection.SNOWPARK_CONNECTION_TOKEN_FILE",
            str(token_path),
        ):
            assert SnowflakeCallersRightsConnection._read_token_file() == "login-token"

    def test_connect_merges_generated_params_with_kwargs(self) -> None:
        """``_connect`` sets qmark paramstyle and lets kwargs override generated params."""
        modules = _snowflake_connector_modules()
        connector_mod = modules["snowflake.connector"]
        connector_mod.connect = MagicMock(return_value="callers-conn")
        fake_params = {"account": "from_env", "token": "its_a_token"}

        with (
            patch.dict(sys.modules, modules),
            patch.object(
                SnowflakeCallersRightsConnection,
                "_get_connection_params",
                return_value=fake_params,
            ),
        ):
            conn = SnowflakeCallersRightsConnection(
                "snowflake-callers-rights",
                account="account_override",
                some_kwarg="some_value",
            )

        assert connector_mod.paramstyle == "qmark"
        connector_mod.connect.assert_called_once_with(
            account="account_override", token="its_a_token", some_kwarg="some_value"
        )
        assert conn._instance == "callers-conn"
