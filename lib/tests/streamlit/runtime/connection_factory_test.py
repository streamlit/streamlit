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
import unittest
from datetime import timedelta
from typing import TYPE_CHECKING, Literal
from unittest.mock import MagicMock, mock_open, patch

import pytest
from parameterized import parameterized

from streamlit import config
from streamlit.connections import (
    BaseConnection,
    SnowflakeCallersRightsConnection,
    SnowflakeConnection,
    SQLConnection,
)
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitSecretNotFoundError,
    StreamlitValueError,
)
from streamlit.runtime import connection_factory as connection_factory_module
from streamlit.runtime.caching.cache_resource_api import _resource_caches
from streamlit.runtime.connection_factory import (
    _SNOWPARK_CONNECTION_REMOVED_ERROR,
    _create_connection,
    _get_first_party_connection,
    connection_factory,
)
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.secrets import secrets_singleton
from tests.testutil import create_mock_script_run_ctx

if TYPE_CHECKING:
    from collections.abc import Iterator


class MockConnection(BaseConnection[None]):
    def _connect(self, **kwargs):
        pass


class ConnectionFactoryTest(unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()

        # st.secrets modifies os.environ, so we save it here and
        # restore in tearDown.
        self._prev_environ = dict(os.environ)

        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self) -> None:
        super().tearDown()

        secrets_singleton._reset()
        _resource_caches.clear_all()

        os.environ.clear()
        os.environ.update(self._prev_environ)

    def test_create_connection_helper_explodes_if_not_BaseConnection_subclass(
        self,
    ):
        class NotABaseConnection:
            pass

        with pytest.raises(StreamlitAPIException) as e:
            _create_connection("my_connection", NotABaseConnection)

        assert "is not a subclass of BaseConnection" in str(e.value)

    @parameterized.expand(
        [
            ("snowflake", SnowflakeConnection),
            ("snowflake-callers-rights", SnowflakeCallersRightsConnection),
            ("sql", SQLConnection),
        ]
    )
    def test_get_first_party_connection_helper(
        self, connection_class_name, expected_connection_class
    ):
        assert (
            _get_first_party_connection(connection_class_name)
            == expected_connection_class
        )

    def test_get_first_party_connection_helper_errors_when_invalid(self):
        with pytest.raises(StreamlitAPIException) as e:
            _get_first_party_connection("not_a_first_party_connection")

        assert "Invalid connection" in str(e.value)

    def test_get_first_party_connection_helper_errors_when_snowpark(self):
        with pytest.raises(StreamlitAPIException) as e:
            _get_first_party_connection("snowpark")

        assert str(e.value) == _SNOWPARK_CONNECTION_REMOVED_ERROR

    @parameterized.expand(
        [
            # No type is specified, and there's no config file to find one
            # in.
            (None, StreamlitSecretNotFoundError, "No secrets found"),
            # Nonexistent module.
            (
                "nonexistent.module.SomeConnection",
                ModuleNotFoundError,
                "No module named 'nonexistent'",
            ),
            # The module exists, but the connection_class doesn't.
            (
                "streamlit.connections.Nonexistent",
                AttributeError,
                "module 'streamlit.connections' has no attribute 'Nonexistent'",
            ),
            # Invalid first party connection name.
            (
                "not_a_first_party_connection",
                StreamlitAPIException,
                "Invalid connection 'not_a_first_party_connection'",
            ),
        ]
    )
    def test_connection_factory_errors(
        self, type, expected_error_class, expected_error_msg
    ):
        with pytest.raises(expected_error_class) as e:
            connection_factory("nonexistsent_connection", type=type)

        assert expected_error_msg in str(e.value)

    @patch("streamlit.runtime.connection_factory._create_connection")
    def test_can_specify_class_with_full_name_in_kwargs(
        self, patched_create_connection
    ):
        connection_factory("my_connection", type="streamlit.connections.SQLConnection")

        patched_create_connection.assert_called_once_with(
            "my_connection", SQLConnection, max_entries=None, ttl=None
        )

    @patch("streamlit.runtime.connection_factory._create_connection")
    def test_can_specify_first_party_class_in_kwargs(self, patched_create_connection):
        connection_factory("my_connection", type="sql")

        patched_create_connection.assert_called_once_with(
            "my_connection", SQLConnection, max_entries=None, ttl=None
        )

    @patch("streamlit.runtime.connection_factory._create_connection")
    def test_can_specify_class_with_full_name_in_config(
        self, patched_create_connection
    ):
        mock_toml = """
[connections.my_connection]
type="streamlit.connections.SQLConnection"
"""
        with patch("builtins.open", new_callable=mock_open, read_data=mock_toml):
            connection_factory("my_connection")

        patched_create_connection.assert_called_once_with(
            "my_connection", SQLConnection, max_entries=None, ttl=None
        )

    @patch("streamlit.runtime.connection_factory._create_connection")
    def test_can_specify_first_party_class_in_config(self, patched_create_connection):
        mock_toml = """
[connections.my_connection]
type="snowflake"
"""
        with patch("builtins.open", new_callable=mock_open, read_data=mock_toml):
            connection_factory("my_connection")

        patched_create_connection.assert_called_once_with(
            "my_connection", SnowflakeConnection, max_entries=None, ttl=None
        )

    @parameterized.expand(
        [
            ("inferred", "snowpark", None),
            ("explicit", "my_connection", "snowpark"),
        ]
    )
    def test_connection_factory_errors_for_removed_snowpark_type(
        self, _case, name, connection_type
    ):
        with pytest.raises(StreamlitAPIException) as e:
            connection_factory(name, type=connection_type)

        assert str(e.value) == _SNOWPARK_CONNECTION_REMOVED_ERROR

    def test_connection_factory_errors_for_removed_snowpark_type_in_config(self):
        mock_toml = """
[connections.my_connection]
type="snowpark"
"""
        with (
            patch("builtins.open", new_callable=mock_open, read_data=mock_toml),
            pytest.raises(StreamlitAPIException) as e,
        ):
            connection_factory("my_connection")

        assert str(e.value) == _SNOWPARK_CONNECTION_REMOVED_ERROR

    def test_can_pass_class_directly_to_factory_func(self):
        conn = connection_factory("my_connection", MockConnection, foo="bar")
        assert conn._connection_name == "my_connection"
        assert conn._kwargs == {"foo": "bar"}

    def test_caches_connection_instance(self):
        conn = connection_factory("my_connection", MockConnection)
        assert connection_factory("my_connection", MockConnection) is conn

    def test_does_not_clear_cache_when_ttl_changes(self):
        with patch.object(
            MockConnection, "__init__", return_value=None
        ) as patched_init:
            connection_factory("my_connection1", MockConnection, ttl=10)
            connection_factory("my_connection2", MockConnection, ttl=20)
            connection_factory("my_connection1", MockConnection, ttl=10)
            connection_factory("my_connection2", MockConnection, ttl=20)

        assert patched_init.call_count == 2

    def test_does_not_clear_cache_when_max_entries_changes(self):
        with patch.object(
            MockConnection, "__init__", return_value=None
        ) as patched_init:
            connection_factory("my_connection1", MockConnection, max_entries=10)
            connection_factory("my_connection2", MockConnection, max_entries=20)
            connection_factory("my_connection1", MockConnection, max_entries=10)
            connection_factory("my_connection2", MockConnection, max_entries=20)

        assert patched_init.call_count == 2

    def test_friendly_error_for_bad_scope(self):
        """A bad scope on a BaseConnection class triggers an exception."""

        class BadScopeConnection(BaseConnection):
            @classmethod
            def scope(cls) -> Literal["request"]:
                return "request"

            def _connect(self, **kwargs):
                pass

        with pytest.raises(
            StreamlitValueError, match=r"BadScopeConnection.*has scope 'request'"
        ):
            connection_factory("my_connection", BadScopeConnection)

    def test_scope_is_passed_to_cache(self):
        """Scope should be passed to the underlying cache."""

        class SessionScopedConnection(BaseConnection):
            @classmethod
            def scope(cls) -> Literal["session"]:
                return "session"

            def _connect(self, **kwargs):
                pass

        class GloballyScopedConnection(BaseConnection):
            @classmethod
            def scope(cls) -> Literal["global"]:
                return "global"

            def _connect(self, **kwargs):
                pass

        with patch.object(
            connection_factory_module, "cache_resource"
        ) as mock_cache_resource:
            connection_factory("my_connection", SessionScopedConnection)

        mock_cache_resource.assert_called_once()
        assert mock_cache_resource.call_args.kwargs["scope"] == "session"

        with patch.object(
            connection_factory_module, "cache_resource"
        ) as mock_cache_resource:
            connection_factory("my_connection", GloballyScopedConnection)

        mock_cache_resource.assert_called_once()
        assert mock_cache_resource.call_args.kwargs["scope"] == "global"

    def test_close_is_passed_to_cache(self):
        """Close should be passed to the underlying cache as on_release."""

        class ConnectionWithClose(BaseConnection):
            def __init__(self):
                super().__init__("test")
                self.close_count = 0

            def _connect(self, **kwargs):
                pass

            def close(self):
                self.close_count += 1

        with patch.object(
            connection_factory_module, "cache_resource"
        ) as mock_cache_resource:
            connection_factory("my_connection", ConnectionWithClose)

        fake_connection = ConnectionWithClose()
        mock_cache_resource.assert_called_once()
        on_release = mock_cache_resource.call_args.kwargs["on_release"]
        on_release(fake_connection)
        assert fake_connection.close_count == 1, "connection should have been closed"

    @parameterized.expand(
        [
            ("MySQLdb", "mysqlclient"),
            ("psycopg2", "psycopg2-binary"),
            ("sqlalchemy", "sqlalchemy"),
            ("snowflake", "snowflake-connector-python"),
            ("snowflake.connector", "snowflake-connector-python"),
            ("snowflake.snowpark", "snowflake-snowpark-python"),
        ]
    )
    @patch("streamlit.runtime.connection_factory._create_connection")
    def test_friendly_error_with_certain_missing_dependencies(
        self, missing_module, pypi_package, patched_create_connection
    ):
        """Test that our error messages are extra-friendly when a ModuleNotFoundError
        error is thrown for certain missing packages.
        """

        patched_create_connection.side_effect = ModuleNotFoundError(
            f"No module named '{missing_module}'"
        )

        with pytest.raises(ModuleNotFoundError) as e:
            connection_factory("my_connection", MockConnection)
        assert str(e.value) == (
            f"No module named '{missing_module}'. "
            f"You need to install the '{pypi_package}' package to use this connection."
        )

    @patch(
        "streamlit.runtime.connection_factory._create_connection",
        MagicMock(side_effect=ModuleNotFoundError("No module named 'foo'")),
    )
    def test_generic_missing_dependency_error(self):
        """Test our generic error message when a ModuleNotFoundError is thrown."""
        with pytest.raises(ModuleNotFoundError) as e:
            connection_factory("my_connection", MockConnection)
        assert str(e.value) == (
            "No module named 'foo'. "
            "You may be missing a dependency required to use this connection."
        )

    @pytest.mark.skip(
        reason="Existing tests import some of these modules, so we need to figure out some other way to test this."
    )
    def test_optional_dependencies_not_imported(self):
        """Test that the dependencies of first party connections aren't transitively
        imported just by importing the connection_factory function.
        """

        DISALLOWED_IMPORTS = ["sqlalchemy"]

        modules = list(sys.modules.keys())

        for m in modules:
            for disallowed_import in DISALLOWED_IMPORTS:
                assert disallowed_import not in m

    @patch("streamlit.runtime.connection_factory._create_connection")
    def test_can_set_connection_name_via_env_var(self, patched_create_connection):
        os.environ["MY_CONN_NAME"] = "staging"
        connection_factory("env:MY_CONN_NAME", MockConnection)

        patched_create_connection.assert_called_once_with(
            "staging", MockConnection, max_entries=None, ttl=None
        )

    @patch("streamlit.runtime.connection_factory._create_connection")
    def test_can_only_set_name_if_equal_to_desired_type(
        self, patched_create_connection
    ):
        connection_factory("sql")

        patched_create_connection.assert_called_once_with(
            "sql", SQLConnection, max_entries=None, ttl=None
        )


@pytest.fixture
def restore_connection_default_ttl() -> Iterator[None]:
    """Restore the connection default TTL after the test."""
    key = "runner.connectionDefaultTTL"
    value = config.get_option(key)
    where_defined = config.get_where_defined(key)
    yield
    config._set_option(key, value, where_defined)


def _set_connection_default_ttl(ttl: object) -> None:
    """Set the server default TTL for the current test."""
    config._set_option("runner.connectionDefaultTTL", ttl, "test")


@pytest.mark.usefixtures("restore_connection_default_ttl")
@patch("streamlit.runtime.connection_factory._create_connection")
@pytest.mark.parametrize(
    ("name", "connection_type", "connection_class"),
    [
        ("snowflake", None, SnowflakeConnection),
        (
            "snowflake-callers-rights",
            None,
            SnowflakeCallersRightsConnection,
        ),
        ("sql", None, SQLConnection),
        ("custom", MockConnection, MockConnection),
    ],
)
def test_connection_uses_configured_default_ttl(
    patched_create_connection: MagicMock,
    name: str,
    connection_type: type[BaseConnection[object]] | None,
    connection_class: type[BaseConnection[object]],
) -> None:
    """The server default applies to every connection type."""
    _set_connection_default_ttl(30)
    if connection_type is None:
        connection_factory(name)
    else:
        connection_factory(name, type=connection_type)

    patched_create_connection.assert_called_once_with(
        name, connection_class, max_entries=None, ttl=30.0
    )


@pytest.mark.usefixtures("restore_connection_default_ttl")
@patch("streamlit.runtime.connection_factory._create_connection")
@pytest.mark.parametrize("explicit_ttl", [0, timedelta(minutes=5), float("inf")])
def test_explicit_connection_ttl_overrides_server_default(
    patched_create_connection: MagicMock,
    explicit_ttl: float | timedelta,
) -> None:
    """A caller-supplied ttl, including 0, a timedelta, and inf, wins over the server default.

    ``ttl=float("inf")`` is the documented way to opt one connection out of
    the server default and keep it cached indefinitely.
    """
    _set_connection_default_ttl(30)
    connection_factory("snowflake", ttl=explicit_ttl)

    patched_create_connection.assert_called_once_with(
        "snowflake", SnowflakeConnection, max_entries=None, ttl=explicit_ttl
    )


@pytest.mark.usefixtures("restore_connection_default_ttl")
def test_shares_cache_entry_for_equivalent_numeric_ttl() -> None:
    """An explicit int ttl and the equal server default float ttl share one connection."""
    _set_connection_default_ttl(30)
    with patch.object(MockConnection, "__init__", return_value=None) as patched_init:
        connection_factory("my_connection", MockConnection, ttl=30)
        connection_factory("my_connection", MockConnection)

    assert patched_init.call_count == 1


@pytest.mark.usefixtures("restore_connection_default_ttl")
@patch("streamlit.runtime.connection_factory._create_connection")
def test_numeric_connection_default_ttl_string_is_seconds(
    patched_create_connection: MagicMock,
) -> None:
    """A numeric config string is the default ttl in seconds."""
    _set_connection_default_ttl(" 12.5 ")
    connection_factory("sql")

    patched_create_connection.assert_called_once_with(
        "sql", SQLConnection, max_entries=None, ttl=12.5
    )


@pytest.mark.usefixtures("restore_connection_default_ttl")
@patch("streamlit.runtime.connection_factory._create_connection")
@pytest.mark.parametrize("configured_ttl", [-1, True, "soon", "inf"])
def test_invalid_connection_default_ttl_is_rejected(
    patched_create_connection: MagicMock,
    configured_ttl: object,
) -> None:
    """A bad server default fails instead of caching the connection forever."""
    _set_connection_default_ttl(configured_ttl)
    with pytest.raises(StreamlitAPIException, match="connectionDefaultTTL"):
        connection_factory("snowflake")

    patched_create_connection.assert_not_called()
