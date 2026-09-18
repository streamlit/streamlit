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

import sys
import threading
import types
import unittest
from contextlib import contextmanager
from copy import deepcopy
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, PropertyMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.connections import SQLConnection
from streamlit.connections import retry_util as sql_retry_util
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitMissingRequiredParameterError,
)
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.secrets import AttrDict
from tests.testutil import (
    create_mock_script_run_ctx,
    retry_without_sleep,
    script_run_ctx_and_cleared_cache,
)

if TYPE_CHECKING:
    from collections.abc import Iterator

DB_SECRETS = {
    "dialect": "postgres",
    "driver": "psycopg2",
    "username": "AzureDiamond",
    "password": "hunter2",
    "host": "localhost",
    "port": "5432",
    "database": "postgres",
}


@contextmanager
def _patched_sqlalchemy() -> Iterator[types.ModuleType]:
    """Install a fake ``sqlalchemy`` package so SQLConnection tests need no extra."""
    sqlalchemy_mod = types.ModuleType("sqlalchemy")
    engine_mod = types.ModuleType("sqlalchemy.engine")
    orm_mod = types.ModuleType("sqlalchemy.orm")
    exc_mod = types.ModuleType("sqlalchemy.exc")

    class DatabaseError(Exception):
        """Stand-in for ``sqlalchemy.exc.DatabaseError``."""

    engine_mod.URL = MagicMock()
    engine_mod.URL.create.return_value = "constructed-url"
    engine_mod.make_url = MagicMock(return_value="parsed-url")

    engine = MagicMock(name="engine")
    engine.driver = "psycopg2"
    sqlalchemy_mod.create_engine = MagicMock(return_value=engine)
    sqlalchemy_mod.text = MagicMock(side_effect=lambda sql: f"text:{sql}")
    sqlalchemy_mod.engine = engine_mod
    sqlalchemy_mod.orm = orm_mod
    sqlalchemy_mod.exc = exc_mod
    orm_mod.Session = MagicMock()
    exc_mod.DatabaseError = DatabaseError
    exc_mod.InternalError = DatabaseError
    exc_mod.OperationalError = DatabaseError

    with patch.dict(
        sys.modules,
        {
            "sqlalchemy": sqlalchemy_mod,
            "sqlalchemy.engine": engine_mod,
            "sqlalchemy.orm": orm_mod,
            "sqlalchemy.exc": exc_mod,
        },
    ):
        yield sqlalchemy_mod


@contextmanager
def _sqlalchemy_and_secrets(secrets: dict[str, object]) -> Iterator[types.ModuleType]:
    """Patch SQLAlchemy and ``SQLConnection._secrets`` together."""
    with (
        _patched_sqlalchemy() as sa,
        patch(
            "streamlit.connections.sql_connection.SQLConnection._secrets",
            PropertyMock(return_value=AttrDict(secrets)),
        ),
    ):
        yield sa


class TestSQLConnectionUnit:
    """SQLConnection tests that mock SQLAlchemy so they run without the integration extra."""

    @pytest.fixture(autouse=True)
    def _script_run_ctx_and_cache(self) -> Iterator[None]:
        """Attach a script context and clear ``cache_data`` after each test."""
        with script_run_ctx_and_cleared_cache():
            yield

    def test_error_if_no_config(self) -> None:
        """Missing secrets and kwargs raise a configuration error."""
        with (
            _sqlalchemy_and_secrets({}),
            pytest.raises(StreamlitAPIException, match="Missing SQL DB connection"),
        ):
            SQLConnection("my_sql_connection")

    @pytest.mark.parametrize("missing_param", ["dialect", "username", "host"])
    def test_error_if_missing_required_param(self, missing_param: str) -> None:
        """Each required URL field is validated when ``url`` is not provided."""
        secrets = deepcopy(DB_SECRETS)
        del secrets[missing_param]
        with (
            _sqlalchemy_and_secrets(secrets),
            pytest.raises(StreamlitMissingRequiredParameterError) as exc,
        ):
            SQLConnection("my_sql_connection")
        assert exc.value.exec_kwargs["parameter"] == missing_param

    def test_url_set_explicitly_in_secrets(self) -> None:
        """A ``url`` secret is parsed and passed to ``create_engine``."""
        with _sqlalchemy_and_secrets({"url": "sqlite://"}) as sa:
            SQLConnection("my_sql_connection")
        sa.engine.make_url.assert_called_once_with("sqlite://")
        sa.create_engine.assert_called_once_with("parsed-url")

    def test_url_constructed_from_secrets_params(self) -> None:
        """Dialect, driver, and credentials are assembled into a SQLAlchemy URL."""
        with _sqlalchemy_and_secrets(DB_SECRETS) as sa:
            SQLConnection("my_sql_connection")
        sa.engine.URL.create.assert_called_once_with(
            drivername="postgres+psycopg2",
            username="AzureDiamond",
            password="hunter2",
            host="localhost",
            port=5432,
            database="postgres",
            query={},
        )
        sa.create_engine.assert_called_once_with("constructed-url")

    def test_url_constructed_without_driver_or_port(self) -> None:
        """Driver and port are optional when building a URL from discrete params."""
        secrets = {"dialect": "sqlite", "username": "user", "host": "localhost"}
        with _sqlalchemy_and_secrets(secrets) as sa:
            SQLConnection("my_sql_connection")
        create_kwargs = sa.engine.URL.create.call_args.kwargs
        assert create_kwargs["drivername"] == "sqlite"
        assert create_kwargs["port"] is None

    def test_autocommit_sets_isolation_level(self) -> None:
        """``autocommit=True`` requests AUTOCOMMIT isolation on the engine."""
        with _sqlalchemy_and_secrets(DB_SECRETS) as sa:
            SQLConnection("my_sql_connection", autocommit=True)
        sa.create_engine.return_value.execution_options.assert_called_once_with(
            isolation_level="AUTOCOMMIT"
        )

    def test_create_engine_kwargs_from_secrets_are_overridable(self) -> None:
        """Kwargs override matching ``create_engine_kwargs`` from secrets."""
        secrets = {
            **DB_SECRETS,
            "create_engine_kwargs": {"foo": "bar", "baz": "from_secrets"},
        }
        with _sqlalchemy_and_secrets(secrets) as sa:
            SQLConnection("my_sql_connection", baz="from_kwargs")
        _, engine_kwargs = sa.create_engine.call_args
        assert engine_kwargs["foo"] == "bar"
        assert engine_kwargs["baz"] == "from_kwargs"

    @patch("streamlit.connections.sql_connection.SQLConnection._connect", MagicMock())
    @patch("pandas.read_sql")
    def test_query_returns_dataframe(self, patched_read_sql: MagicMock) -> None:
        """``.query()`` runs SQL through pandas and returns the resulting frame."""
        patched_read_sql.return_value = "i am a dataframe"
        with _patched_sqlalchemy():
            conn = SQLConnection("my_sql_connection")
            assert conn.query("SELECT 1;") == "i am a dataframe"
        patched_read_sql.assert_called_once()

    @patch("streamlit.connections.sql_connection.SQLConnection._connect", MagicMock())
    @patch("pandas.read_sql")
    def test_query_retries_database_errors(self, patched_read_sql: MagicMock) -> None:
        """Retryable SQLAlchemy errors reset the connection and are retried."""
        with (
            _patched_sqlalchemy() as sa,
            patch.object(sql_retry_util, "retry", retry_without_sleep),
        ):
            patched_read_sql.side_effect = sa.exc.DatabaseError("kaboom")
            conn = SQLConnection("my_sql_connection")
            with (
                patch.object(conn, "reset", wraps=conn.reset) as wrapped_reset,
                pytest.raises(sa.exc.DatabaseError),
            ):
                conn.query("SELECT 1;")
            assert wrapped_reset.call_count == 3

    def test_connect_engine_driver_and_session_helpers(self) -> None:
        """``connect``, ``engine``, ``driver``, and ``session`` delegate to the engine."""
        with _sqlalchemy_and_secrets(DB_SECRETS) as sa:
            conn = SQLConnection("my_sql_connection")
            assert conn.connect() is sa.create_engine.return_value.connect.return_value
            assert conn.engine is sa.create_engine.return_value
            assert conn.driver == "psycopg2"
            assert conn.session is sa.orm.Session.return_value
            sa.orm.Session.assert_called_once_with(sa.create_engine.return_value)


@pytest.mark.require_integration
class SQLConnectionTest(unittest.TestCase):
    def tearDown(self) -> None:
        st.cache_data.clear()

    @patch("sqlalchemy.engine.make_url", MagicMock(return_value="some_sql_conn_string"))
    @patch(
        "streamlit.connections.sql_connection.SQLConnection._secrets",
        PropertyMock(return_value=AttrDict({"url": "some_sql_conn_string"})),
    )
    @patch("sqlalchemy.create_engine")
    def test_url_set_explicitly_in_secrets(self, patched_create_engine):
        SQLConnection("my_sql_connection")

        patched_create_engine.assert_called_once_with("some_sql_conn_string")

    @patch(
        "streamlit.connections.sql_connection.SQLConnection._secrets",
        PropertyMock(return_value=AttrDict(DB_SECRETS)),
    )
    @patch("sqlalchemy.create_engine")
    def test_url_constructed_from_secrets_params(self, patched_create_engine):
        SQLConnection("my_sql_connection")

        patched_create_engine.assert_called_once()
        args, _ = patched_create_engine.call_args_list[0]
        assert (
            args[0].render_as_string(hide_password=False)
            == "postgres+psycopg2://AzureDiamond:hunter2@localhost:5432/postgres"
        )

    @patch(
        "streamlit.connections.sql_connection.SQLConnection._secrets",
        PropertyMock(return_value=AttrDict(DB_SECRETS)),
    )
    @patch("sqlalchemy.create_engine")
    def test_kwargs_overwrite_secrets_values(self, patched_create_engine):
        SQLConnection(
            "my_sql_connection",
            port=2345,
            username="DnomaidEruza",
            query={"charset": "utf8mb4"},
        )

        patched_create_engine.assert_called_once()
        args, _ = patched_create_engine.call_args_list[0]
        assert (
            args[0].render_as_string(hide_password=False)
            == "postgres+psycopg2://DnomaidEruza:hunter2@localhost:2345/postgres?charset=utf8mb4"
        )

    def test_error_if_no_config(self):
        with patch(
            "streamlit.connections.sql_connection.SQLConnection._secrets",
            PropertyMock(return_value=AttrDict({})),
        ):
            with pytest.raises(StreamlitAPIException) as e:
                SQLConnection("my_sql_connection")

            assert "Missing SQL DB connection configuration." in str(e.value)

    @parameterized.expand([("dialect",), ("username",), ("host",)])
    def test_error_if_missing_required_param(self, missing_param):
        secrets = deepcopy(DB_SECRETS)
        del secrets[missing_param]

        with patch(
            "streamlit.connections.sql_connection.SQLConnection._secrets",
            PropertyMock(return_value=AttrDict(secrets)),
        ):
            with pytest.raises(StreamlitMissingRequiredParameterError) as e:
                SQLConnection("my_sql_connection")

            assert e.value.exec_kwargs["parameter"] == missing_param
            assert "secrets.toml" in str(e.value)
            assert "st.connection" in str(e.value)

    @patch(
        "streamlit.connections.sql_connection.SQLConnection._secrets",
        PropertyMock(
            return_value=AttrDict(
                {
                    **DB_SECRETS,
                    "create_engine_kwargs": {"foo": "bar", "baz": "i get overwritten"},
                }
            )
        ),
    )
    @patch("sqlalchemy.create_engine")
    def test_create_engine_kwargs_secrets_section(self, patched_create_engine):
        SQLConnection("my_sql_connection", baz="qux")

        patched_create_engine.assert_called_once()
        _, kwargs = patched_create_engine.call_args_list[0]

        assert kwargs == {"foo": "bar", "baz": "qux"}

    @patch("streamlit.connections.sql_connection.SQLConnection._connect", MagicMock())
    @patch("pandas.read_sql")
    def test_query_caches_value(self, patched_read_sql):
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())
        patched_read_sql.return_value = "i am a dataframe"

        conn = SQLConnection("my_sql_connection")

        assert conn.query("SELECT 1;") == "i am a dataframe"
        assert conn.query("SELECT 1;") == "i am a dataframe"
        patched_read_sql.assert_called_once()

    @patch("streamlit.connections.sql_connection.SQLConnection._connect", MagicMock())
    @patch("pandas.read_sql")
    def test_does_not_reset_cache_when_ttl_changes(self, patched_read_sql):
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())
        patched_read_sql.return_value = "i am a dataframe"

        conn = SQLConnection("my_sql_connection")

        conn.query("SELECT 1;", ttl=10)
        conn.query("SELECT 2;", ttl=20)
        conn.query("SELECT 1;", ttl=10)
        conn.query("SELECT 2;", ttl=20)

        assert patched_read_sql.call_count == 2

    @patch("streamlit.connections.sql_connection.SQLConnection._connect", MagicMock())
    @patch("pandas.read_sql")
    def test_scopes_caches_by_connection_instance(self, patched_read_sql):
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())
        patched_read_sql.return_value = "i am a dataframe"

        conn1 = SQLConnection("my_sql_connection1", host="host1")
        conn2 = SQLConnection("my_sql_connection1", host="another_host")
        conn3 = SQLConnection("my_sql_connection2")

        conn1.query("SELECT 1;")
        assert patched_read_sql.call_count == 1
        conn1.query("SELECT 1;")
        assert patched_read_sql.call_count == 1
        conn2.query("SELECT 1;")
        assert patched_read_sql.call_count == 2
        conn2.query("SELECT 1;")
        assert patched_read_sql.call_count == 2
        conn3.query("SELECT 1;")
        assert patched_read_sql.call_count == 3
        conn3.query("SELECT 1;")
        assert patched_read_sql.call_count == 3

    @patch("streamlit.connections.sql_connection.SQLConnection._connect", MagicMock())
    @patch("pandas.read_sql")
    def test_retry_behavior(self, patched_read_sql):
        from sqlalchemy.exc import DatabaseError, InternalError, OperationalError

        for error_class in [DatabaseError, InternalError, OperationalError]:
            patched_read_sql.side_effect = error_class("kaboom", params=None, orig=None)

            conn = SQLConnection("my_sql_connection")

            with patch.object(conn, "reset", wraps=conn.reset) as wrapped_reset:
                with pytest.raises(error_class):
                    conn.query("SELECT 1;")

                # Our connection should have been reset after each failed attempt to call
                # query.
                assert wrapped_reset.call_count == 3

            # conn._connect should have been called three times: once in the initial
            # connection, then once each after the second and third attempts to call
            # query.
            assert conn._connect.call_count == 3
            conn._connect.reset_mock()

    @patch("streamlit.connections.sql_connection.SQLConnection._connect", MagicMock())
    @patch("pandas.read_sql")
    def test_retry_behavior_fails_fast_for_most_errors(self, patched_read_sql):
        patched_read_sql.side_effect = Exception("kaboom")

        conn = SQLConnection("my_sql_connection")

        with pytest.raises(Exception, match="kaboom"):
            conn.query("SELECT 1;")

        # conn._connect should have just been called once when first creating the
        # connection.
        assert conn._connect.call_count == 1
        conn._connect.reset_mock()
